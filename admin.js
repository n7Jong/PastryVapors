// Admin Dashboard JavaScript
import { auth, db, signOut, onAuthStateChanged, collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy, getDoc } from './firebase-config.js';

let currentUser = null;
let allPosts = [];
let allPromoters = [];
let currentActionUserId = null;
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
        updateNotificationBadge(allPosts);
        
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
        const userName = post.userName || (post.userEmail ? post.userEmail.split('@')[0] : 'User ' + (index + 1));
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
            showApprovalModal(postId);
        });
    });
    
    document.querySelectorAll('.reject-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const postId = e.currentTarget.dataset.postId;
            showRejectionModal(postId);
        });
    });
}

let currentPostId = null;
let selectedPoints = 75; // Default points

// Show approval modal with points selection
function showApprovalModal(postId) {
    currentPostId = postId;
    selectedPoints = 75; // Reset to default
    
    const modal = document.getElementById('approvalModal');
    modal.classList.remove('hidden');
    
    // Reset points buttons
    document.querySelectorAll('.points-btn').forEach(btn => {
        btn.classList.remove('bg-amber-500', 'text-black', 'border-amber-500');
        btn.classList.add('bg-gray-800', 'border-gray-600');
        if (btn.dataset.points === '75') {
            btn.classList.add('bg-amber-500', 'text-black', 'border-amber-500');
            btn.classList.remove('bg-gray-800', 'border-gray-600');
        }
    });
}

// Show rejection modal
function showRejectionModal(postId) {
    currentPostId = postId;
    const modal = document.getElementById('rejectionModal');
    modal.classList.remove('hidden');
}

// Points selection handlers
document.querySelectorAll('.points-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        // Remove active state from all
        document.querySelectorAll('.points-btn').forEach(b => {
            b.classList.remove('bg-amber-500', 'text-black', 'border-amber-500');
            b.classList.add('bg-gray-800', 'border-gray-600');
        });
        
        // Add active state to clicked
        this.classList.add('bg-amber-500', 'text-black', 'border-amber-500');
        this.classList.remove('bg-gray-800', 'border-gray-600');
        
        selectedPoints = parseInt(this.dataset.points);
    });
});

// Approval modal handlers
document.getElementById('cancelApprovalBtn')?.addEventListener('click', () => {
    document.getElementById('approvalModal').classList.add('hidden');
    currentPostId = null;
});

document.getElementById('confirmApprovalBtn')?.addEventListener('click', async () => {
    if (currentPostId) {
        await handleAction('approve', currentPostId, selectedPoints);
        document.getElementById('approvalModal').classList.add('hidden');
        currentPostId = null;
    }
});

// Rejection modal handlers
document.getElementById('cancelRejectionBtn')?.addEventListener('click', () => {
    document.getElementById('rejectionModal').classList.add('hidden');
    currentPostId = null;
});

document.getElementById('confirmRejectionBtn')?.addEventListener('click', async () => {
    if (currentPostId) {
        await handleAction('reject', currentPostId, 0);
        document.getElementById('rejectionModal').classList.add('hidden');
        currentPostId = null;
    }
});

// Handle approve/reject action
async function handleAction(action, postId, points) {
    try {
        if (isDemoMode) {
            updateDemoPost(postId, action, points);
        } else {
            const post = allPosts.find(p => p.id === postId);
            if (!post) return;
            
            const postRef = doc(db, 'posts', postId);
            
            await updateDoc(postRef, {
                status: action === 'approve' ? 'approved' : 'rejected',
                points: points,
                reviewedAt: new Date()
            });
            
            // Update user's points and post count if approved
            if (action === 'approve' && post.userId) {
                const userRef = doc(db, 'users', post.userId);
                const userDoc = await getDoc(userRef);
                
                if (userDoc.exists()) {
                    const currentPoints = userDoc.data().points || 0;
                    const currentPosts = userDoc.data().totalApprovedPosts || 0;
                    
                    await updateDoc(userRef, {
                        points: currentPoints + points,
                        totalApprovedPosts: currentPosts + 1
                    });
                }
            }
        }
        
        // Reload data
        if (isDemoMode) {
            loadDemoData();
        } else {
            await loadAdminData();
        }
        
        alert(`Post ${action === 'approve' ? 'approved with ' + points + ' points' : 'rejected'} successfully!`);
        
    } catch (error) {
        console.error('Error updating post:', error);
        alert('Failed to update post: ' + error.message);
    }
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

// Update notification badge
function updateNotificationBadge(posts) {
    const pendingCount = posts.filter(p => p.status === 'pending').length;
    const badge = document.getElementById('notificationBadge');
    if (pendingCount > 0) {
        badge.textContent = pendingCount;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

// Notification button handler
document.getElementById('notificationBtn')?.addEventListener('click', () => {
    const panel = document.getElementById('notificationsPanel');
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) {
        loadNotifications();
    }
});

document.getElementById('closeNotificationsBtn')?.addEventListener('click', () => {
    document.getElementById('notificationsPanel').classList.add('hidden');
});

// Load notifications
function loadNotifications() {
    const pendingPosts = allPosts.filter(p => p.status === 'pending');
    const notificationsList = document.getElementById('notificationsList');
    
    if (pendingPosts.length === 0) {
        notificationsList.innerHTML = `
            <div class="text-center text-gray-400 py-6">
                <i class="fas fa-check-circle text-3xl mb-2"></i>
                <p>No new notifications</p>
            </div>
        `;
        return;
    }
    
    notificationsList.innerHTML = pendingPosts.map(post => {
        const date = post.createdAt?.toDate ? post.createdAt.toDate().toLocaleString() : post.createdAt;
        const userName = post.userName || (post.userEmail?.split('@')[0]) || 'User';
        
        return `
            <div class="border-b border-gray-700 py-3 hover:bg-gray-800/30 rounded px-2">
                <div class="flex items-start gap-3">
                    <div class="bg-yellow-500/20 p-2 rounded">
                        <i class="fas fa-file-lines text-yellow-500"></i>
                    </div>
                    <div class="flex-1">
                        <p class="text-white font-semibold">${userName} submitted a post</p>
                        <p class="text-gray-400 text-sm">${post.platform} • ${date}</p>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Manage Promoters button handler
document.getElementById('managePromotersBtn')?.addEventListener('click', async () => {
    document.getElementById('managePromotersModal').classList.remove('hidden');
    await loadPromoters();
});

document.getElementById('closePromotersBtn')?.addEventListener('click', () => {
    document.getElementById('managePromotersModal').classList.add('hidden');
});

// Load all promoters
async function loadPromoters() {
    try {
        const usersQuery = query(collection(db, 'users'));
        const querySnapshot = await getDocs(usersQuery);
        
        allPromoters = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.isAdmin === false) {
                allPromoters.push({ id: doc.id, ...data });
            }
        });
        
        displayPromoters();
    } catch (error) {
        console.error('Error loading promoters:', error);
    }
}

// Display promoters table
function displayPromoters() {
    const tableBody = document.getElementById('promotersTableBody');
    
    if (allPromoters.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-8 text-gray-400">
                    No promoters found
                </td>
            </tr>
        `;
        return;
    }
    
    tableBody.innerHTML = allPromoters.map(promoter => {
        const warnings = promoter.warnings || 0;
        const isSuspended = promoter.suspended && new Date(promoter.suspendedUntil) > new Date();
        const suspendedUntil = promoter.suspendedUntil ? new Date(promoter.suspendedUntil).toLocaleDateString() : '';
        
        return `
            <tr class="border-b border-gray-800 hover:bg-gray-800/50">
                <td class="py-4 px-4">
                    <div class="flex items-center gap-3">
                        <img 
                            src="${promoter.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(promoter.fullName || 'User')}&background=1a1a1a&color=F59E0B&size=80`}" 
                            alt="${promoter.fullName || 'User'}" 
                            class="w-10 h-10 rounded-full object-cover border-2 border-amber-500/30"
                        >
                        <div>
                            <div class="font-semibold">${promoter.fullName || 'Anonymous'}</div>
                            <div class="text-sm text-gray-400">${promoter.email || ''}</div>
                        </div>
                    </div>
                </td>
                <td class="py-4 px-4">
                    <span class="text-amber-500 font-bold">${promoter.points || 0}</span>
                </td>
                <td class="py-4 px-4">
                    <span>${promoter.totalApprovedPosts || 0}</span>
                </td>
                <td class="py-4 px-4">
                    ${warnings > 0 ? `
                        <span class="bg-yellow-500/20 text-yellow-500 px-2 py-1 rounded-full text-sm">
                            <i class="fas fa-exclamation-triangle mr-1"></i>${warnings}
                        </span>
                    ` : `
                        <span class="text-gray-500">0</span>
                    `}
                </td>
                <td class="py-4 px-4">
                    ${isSuspended ? `
                        <span class="bg-orange-500/20 text-orange-500 px-2 py-1 rounded-full text-sm">
                            <i class="fas fa-ban mr-1"></i>Suspended until ${suspendedUntil}
                        </span>
                    ` : `
                        <span class="text-green-500">
                            <i class="fas fa-circle-check mr-1"></i>Active
                        </span>
                    `}
                </td>
                <td class="py-4 px-4">
                    <div class="flex gap-2">
                        <button class="warn-btn bg-yellow-500/20 hover:bg-yellow-500 hover:text-black text-yellow-500 px-3 py-1 rounded text-sm transition" data-user-id="${promoter.id}" data-user-name="${promoter.fullName || 'User'}">
                            <i class="fas fa-exclamation-triangle"></i>
                        </button>
                        <button class="suspend-btn bg-orange-500/20 hover:bg-orange-500 hover:text-white text-orange-500 px-3 py-1 rounded text-sm transition" data-user-id="${promoter.id}" data-user-name="${promoter.fullName || 'User'}">
                            <i class="fas fa-ban"></i>
                        </button>
                        <button class="kick-btn bg-red-500/20 hover:bg-red-500 hover:text-white text-red-500 px-3 py-1 rounded text-sm transition" data-user-id="${promoter.id}" data-user-name="${promoter.fullName || 'User'}">
                            <i class="fas fa-user-slash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    attachPromoterActionButtons();
}

// Attach action buttons to promoters
function attachPromoterActionButtons() {
    document.querySelectorAll('.warn-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentActionUserId = e.currentTarget.dataset.userId;
            document.getElementById('warningPromoterName').textContent = e.currentTarget.dataset.userName;
            document.getElementById('warningModal').classList.remove('hidden');
        });
    });
    
    document.querySelectorAll('.suspend-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentActionUserId = e.currentTarget.dataset.userId;
            document.getElementById('suspendPromoterName').textContent = e.currentTarget.dataset.userName;
            document.getElementById('suspendModal').classList.remove('hidden');
        });
    });
    
    document.querySelectorAll('.kick-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentActionUserId = e.currentTarget.dataset.userId;
            document.getElementById('kickPromoterName').textContent = e.currentTarget.dataset.userName;
            document.getElementById('kickModal').classList.remove('hidden');
        });
    });
}

// Warning modal handlers
document.getElementById('cancelWarningBtn')?.addEventListener('click', () => {
    document.getElementById('warningModal').classList.add('hidden');
    document.getElementById('warningMessage').value = '';
});

document.getElementById('confirmWarningBtn')?.addEventListener('click', async () => {
    const message = document.getElementById('warningMessage').value;
    if (!message.trim()) {
        alert('Please enter a warning message');
        return;
    }
    
    try {
        const userRef = doc(db, 'users', currentActionUserId);
        const userDoc = await getDoc(userRef);
        const currentWarnings = userDoc.data().warnings || 0;
        
        await updateDoc(userRef, {
            warnings: currentWarnings + 1,
            lastWarning: {
                message: message,
                timestamp: new Date().toISOString()
            }
        });
        
        alert('Warning sent successfully');
        document.getElementById('warningModal').classList.add('hidden');
        document.getElementById('warningMessage').value = '';
        await loadPromoters();
    } catch (error) {
        console.error('Error sending warning:', error);
        alert('Failed to send warning: ' + error.message);
    }
});

// Suspend modal handlers
document.getElementById('cancelSuspendBtn')?.addEventListener('click', () => {
    document.getElementById('suspendModal').classList.add('hidden');
});

document.getElementById('confirmSuspendBtn')?.addEventListener('click', async () => {
    const days = parseInt(document.getElementById('suspensionDuration').value);
    const suspendUntil = new Date();
    suspendUntil.setDate(suspendUntil.getDate() + days);
    
    try {
        const userRef = doc(db, 'users', currentActionUserId);
        
        await updateDoc(userRef, {
            suspended: true,
            suspendedUntil: suspendUntil.toISOString()
        });
        
        alert(`Promoter suspended for ${days} day(s)`);
        document.getElementById('suspendModal').classList.add('hidden');
        await loadPromoters();
    } catch (error) {
        console.error('Error suspending user:', error);
        alert('Failed to suspend user: ' + error.message);
    }
});

// Kick modal handlers
document.getElementById('cancelKickBtn')?.addEventListener('click', () => {
    document.getElementById('kickModal').classList.add('hidden');
});

document.getElementById('confirmKickBtn')?.addEventListener('click', async () => {
    try {
        // Delete user document
        await deleteDoc(doc(db, 'users', currentActionUserId));
        
        // Delete all posts by this user
        const userPosts = allPosts.filter(p => p.userId === currentActionUserId);
        for (const post of userPosts) {
            await deleteDoc(doc(db, 'posts', post.id));
        }
        
        alert('Promoter permanently removed from system');
        document.getElementById('kickModal').classList.add('hidden');
        await loadPromoters();
        await loadAdminData(); // Refresh posts
    } catch (error) {
        console.error('Error kicking user:', error);
        alert('Failed to kick user: ' + error.message);
    }
});
