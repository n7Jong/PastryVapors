// Admin Dashboard JavaScript
import { auth, db, signOut, onAuthStateChanged, collection, getDocs, doc, updateDoc, query, orderBy } from './firebase-config.js';

let currentUser = null;
let allPosts = [];
const isDemoMode = localStorage.getItem('demoMode') === 'true';

// Check authentication and admin role
onAuthStateChanged(auth, async (user) => {
    if (!user && !isDemoMode) {
        window.location.href = 'index.html';
        return;
    }
    
    // Check if user is admin
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'admin') {
        alert('Access denied. Admin privileges required.');
        window.location.href = 'index.html';
        return;
    }
    
    currentUser = user;
    if (isDemoMode) {
        loadDemoData();
    } else {
        loadAdminData();
    }
});

// Logout handler
document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    try {
        if (!isDemoMode) {
            await signOut(auth);
        }
        localStorage.clear();
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Logout error:', error);
    }
});

// Load all posts from Firebase
async function loadAdminData() {
    try {
        const postsQuery = query(collection(db, 'posts'));
        const querySnapshot = await getDocs(postsQuery);
        
        allPosts = [];
        querySnapshot.forEach((doc) => {
            allPosts.push({ id: doc.id, ...doc.data() });
        });
        
        // Sort by createdAt in JavaScript (descending)
        allPosts.sort((a, b) => {
            const aTime = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
            const bTime = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
            return bTime - aTime;
        });
        
        updateAdminStats(allPosts);
        updatePostsTable(allPosts);
        
    } catch (error) {
        console.error('Error loading admin data:', error);
    }
}

// Load demo data
function loadDemoData() {
    allPosts = getAllDemoPosts();
    updateAdminStats(allPosts);
    updatePostsTable(allPosts);
}

// Update admin statistics
function updateAdminStats(posts) {
    const pending = posts.filter(p => p.status === 'pending');
    const approved = posts.filter(p => p.status === 'approved');
    const rejected = posts.filter(p => p.status === 'rejected');
    
    document.getElementById('totalSubmissions').textContent = posts.length;
    document.getElementById('pendingReview').textContent = pending.length;
    document.getElementById('approvedCount').textContent = approved.length;
    document.getElementById('rejectedCount').textContent = rejected.length;
}

// Update posts table
function updatePostsTable(posts) {
    const tbody = document.getElementById('postsTableBody');
    if (!tbody) return;
    
    if (posts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="py-8 text-center text-gray-500">
                    No submissions to review yet.
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = posts.map((post, index) => {
        const date = post.createdAt ? 
            (post.createdAt.toDate ? post.createdAt.toDate().toISOString().split('T')[0] : post.createdAt) :
            new Date().toISOString().split('T')[0];
            
        const platformColor = post.platform === 'facebook' ? 'blue' : 'pink';
        const platformIcon = post.platform === 'facebook' ? 'facebook-f' : 'instagram';
        const statusInfo = getStatusInfo(post.status);
        const userName = post.userEmail ? post.userEmail.split('@')[0] : 'User ' + (index + 1);
        const userInitial = userName.charAt(0).toUpperCase();
        const avatarColors = ['yellow', 'purple', 'blue', 'green', 'pink'];
        const avatarColor = avatarColors[index % avatarColors.length];
        
        return `
            <tr class="border-b border-gray-800 hover:bg-gray-800/50" data-status="${post.status}" data-post-id="${post.id}">
                <td class="py-4 px-4">${date}</td>
                <td class="py-4 px-4">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 bg-${avatarColor}-500 rounded-full flex items-center justify-center text-white font-bold">
                            ${userInitial}
                        </div>
                        <span>${userName}</span>
                    </div>
                </td>
                <td class="py-4 px-4">
                    <span class="bg-${platformColor}-600/20 text-${platformColor}-400 px-3 py-1 rounded-full text-sm">
                        <i class="fab fa-${platformIcon} mr-1"></i>${post.platform}
                    </span>
                </td>
                <td class="py-4 px-4">
                    <a href="${post.postUrl}" target="_blank" class="text-blue-400 hover:underline truncate block max-w-xs">
                        ${post.postUrl}
                    </a>
                </td>
                <td class="py-4 px-4">
                    <span class="flex items-center gap-2 text-${statusInfo.color}">
                        <i class="${statusInfo.icon}"></i>
                        ${statusInfo.text}
                    </span>
                </td>
                <td class="py-4 px-4">
                    ${post.status === 'pending' ? `
                        <div class="flex gap-2">
                            <button class="approve-btn bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition" data-post-id="${post.id}">
                                <i class="fas fa-check mr-1"></i>Approve
                            </button>
                            <button class="reject-btn bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition" data-post-id="${post.id}">
                                <i class="fas fa-times mr-1"></i>Reject
                            </button>
                        </div>
                    ` : `
                        <span class="text-gray-500 text-sm">
                            ${post.status === 'approved' ? '+' + (post.points || 150) + ' points' : 'Rejected'}
                        </span>
                    `}
                </td>
            </tr>
        `;
    }).join('');
    
    // Attach event listeners to approve/reject buttons
    attachActionButtons();
}

// Attach event listeners to action buttons
function attachActionButtons() {
    document.querySelectorAll('.approve-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const postId = e.currentTarget.dataset.postId;
            showConfirmModal('approve', postId);
        });
    });
    
    document.querySelectorAll('.reject-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const postId = e.currentTarget.dataset.postId;
            showConfirmModal('reject', postId);
        });
    });
}

// Show confirmation modal
function showConfirmModal(action, postId) {
    const modal = document.getElementById('confirmModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const confirmBtn = document.getElementById('confirmBtn');
    
    if (action === 'approve') {
        modalTitle.textContent = 'Approve Post';
        modalMessage.textContent = 'Are you sure you want to approve this post? The promoter will receive points.';
        confirmBtn.className = 'flex-1 bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-semibold transition';
    } else {
        modalTitle.textContent = 'Reject Post';
        modalMessage.textContent = 'Are you sure you want to reject this post? The promoter will not receive points.';
        confirmBtn.className = 'flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-lg font-semibold transition';
    }
    
    modal.classList.add('active');
    
    // Remove previous event listeners
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    
    // Add new event listener
    newConfirmBtn.addEventListener('click', async () => {
        modal.classList.remove('active');
        await handlePostAction(action, postId);
    });
}

// Handle approve/reject action
async function handlePostAction(action, postId) {
    try {
        if (isDemoMode) {
            updateDemoPost(postId, action);
        } else {
            const postRef = doc(db, 'posts', postId);
            const points = action === 'approve' ? calculatePoints() : 0;
            
            await updateDoc(postRef, {
                status: action === 'approve' ? 'approved' : 'rejected',
                points: points,
                reviewedAt: new Date()
            });
        }
        
        // Reload data
        if (isDemoMode) {
            loadDemoData();
        } else {
            await loadAdminData();
        }
        
        alert(`Post ${action === 'approve' ? 'approved' : 'rejected'} successfully!`);
        
    } catch (error) {
        console.error('Error updating post:', error);
        alert('Failed to update post: ' + error.message);
    }
}

// Calculate points for approved post
function calculatePoints() {
    // Random points between 150-200
    return Math.floor(Math.random() * 51) + 150;
}

// Get status display info
function getStatusInfo(status) {
    switch(status) {
        case 'approved':
            return { color: 'green-500', icon: 'fas fa-circle-check', text: 'Approved' };
        case 'rejected':
            return { color: 'red-500', icon: 'fas fa-circle-xmark', text: 'Rejected' };
        case 'pending':
        default:
            return { color: 'yellow-500', icon: 'fas fa-clock', text: 'Pending' };
    }
}

// Demo mode functions
function getAllDemoPosts() {
    const stored = localStorage.getItem('allDemoPosts');
    if (stored) {
        return JSON.parse(stored);
    }
    
    // Return sample data
    const samplePosts = [
        {
            id: '1',
            userEmail: 'john@example.com',
            platform: 'facebook',
            postUrl: 'https://facebook.com/post/xyz123',
            status: 'pending',
            createdAt: '2026-01-27',
            points: 0
        },
        {
            id: '2',
            userEmail: 'sarah@example.com',
            platform: 'instagram',
            postUrl: 'https://instagram.com/p/abc456',
            status: 'approved',
            createdAt: '2026-01-26',
            points: 200
        },
        {
            id: '3',
            userEmail: 'mike@example.com',
            platform: 'facebook',
            postUrl: 'https://facebook.com/post/def789',
            status: 'pending',
            createdAt: '2026-01-27',
            points: 0
        }
    ];
    
    localStorage.setItem('allDemoPosts', JSON.stringify(samplePosts));
    return samplePosts;
}

function updateDemoPost(postId, action) {
    const posts = getAllDemoPosts();
    const postIndex = posts.findIndex(p => p.id === postId);
    
    if (postIndex !== -1) {
        posts[postIndex].status = action === 'approve' ? 'approved' : 'rejected';
        posts[postIndex].points = action === 'approve' ? calculatePoints() : 0;
        localStorage.setItem('allDemoPosts', JSON.stringify(posts));
        
        // Also update promoter's posts if they're the same user
        const demoPosts = JSON.parse(localStorage.getItem('demoPosts') || '[]');
        const promoterPostIndex = demoPosts.findIndex(p => p.id === postId);
        if (promoterPostIndex !== -1) {
            demoPosts[promoterPostIndex].status = posts[postIndex].status;
            demoPosts[promoterPostIndex].points = posts[postIndex].points;
            localStorage.setItem('demoPosts', JSON.stringify(demoPosts));
        }
    }
}
