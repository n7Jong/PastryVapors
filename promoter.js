// Promoter Dashboard JavaScript
import { auth, db, signOut, onAuthStateChanged, collection, addDoc, getDocs, query, where, orderBy, Timestamp } from './firebase-config.js';

let currentUser = null;
const isDemoMode = localStorage.getItem('demoMode') === 'true';

// Check authentication
onAuthStateChanged(auth, (user) => {
    if (!user && !isDemoMode) {
        window.location.href = 'index.html';
        return;
    }
    currentUser = user;
    if (!isDemoMode) {
        loadPromoterData();
    } else {
        loadDemoData();
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

// Submit Post Form
const submitPostForm = document.getElementById('submitPostForm');
if (submitPostForm) {
    submitPostForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const platform = document.getElementById('selectedPlatform').value;
        const postUrl = document.getElementById('postUrlInput').value;
        
        // Validate URL
        if (!isValidUrl(postUrl, platform)) {
            alert(`Please enter a valid ${platform} URL`);
            return;
        }
        
        try {
            if (isDemoMode) {
                // Demo mode - save to localStorage
                saveDemoPost(platform, postUrl);
            } else {
                // Firebase mode
                await addDoc(collection(db, 'posts'), {
                    userId: currentUser.uid,
                    userEmail: currentUser.email,
                    platform: platform,
                    postUrl: postUrl,
                    status: 'pending',
                    createdAt: Timestamp.now(),
                    points: 0
                });
            }
            
            alert('Post submitted successfully!');
            submitPostForm.reset();
            document.getElementById('selectedPlatform').value = 'facebook';
            
            // Reload data
            if (isDemoMode) {
                loadDemoData();
            } else {
                loadPromoterData();
            }
            
        } catch (error) {
            console.error('Error submitting post:', error);
            alert('Failed to submit post: ' + error.message);
        }
    });
}

// Load promoter data from Firebase
async function loadPromoterData() {
    try {
        const postsQuery = query(
            collection(db, 'posts'),
            where('userId', '==', currentUser.uid)
        );
        
        const querySnapshot = await getDocs(postsQuery);
        const posts = [];
        
        querySnapshot.forEach((doc) => {
            posts.push({ id: doc.id, ...doc.data() });
        });
        
        // Sort by createdAt in JavaScript (descending)
        posts.sort((a, b) => {
            const aTime = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
            const bTime = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
            return bTime - aTime;
        });
        
        updateStats(posts);
        updateHistoryTable(posts);
        
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// Load demo data from localStorage
function loadDemoData() {
    const posts = getDemoPosts();
    updateStats(posts);
    updateHistoryTable(posts);
}

// Update statistics
function updateStats(posts) {
    const approved = posts.filter(p => p.status === 'approved');
    const pending = posts.filter(p => p.status === 'pending');
    const totalPoints = approved.reduce((sum, p) => sum + (p.points || 0), 0);
    
    document.getElementById('totalPoints').textContent = totalPoints;
    document.getElementById('approvedPosts').textContent = approved.length;
    document.getElementById('pendingPosts').textContent = pending.length;
}

// Update history table
function updateHistoryTable(posts) {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;
    
    if (posts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="py-8 text-center text-gray-500">
                    No submissions yet. Submit your first post above!
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = posts.map(post => {
        const date = post.createdAt ? 
            (post.createdAt.toDate ? post.createdAt.toDate().toISOString().split('T')[0] : post.createdAt) :
            new Date().toISOString().split('T')[0];
            
        const platformColor = post.platform === 'facebook' ? 'blue' : 'pink';
        const statusInfo = getStatusInfo(post.status);
        
        return `
            <tr class="border-b border-gray-800 hover:bg-gray-800/50">
                <td class="py-4 px-4">${date}</td>
                <td class="py-4 px-4">
                    <span class="bg-${platformColor}-600/20 text-${platformColor}-400 px-3 py-1 rounded-full text-sm">
                        <i class="fab fa-${post.platform === 'facebook' ? 'facebook-f' : 'instagram'} mr-1"></i>
                        ${post.platform}
                    </span>
                </td>
                <td class="py-4 px-4 text-gray-400 truncate max-w-xs">${post.postUrl}</td>
                <td class="py-4 px-4">
                    <span class="flex items-center gap-2 text-${statusInfo.color}">
                        <i class="${statusInfo.icon}"></i>
                        ${statusInfo.text}
                    </span>
                </td>
                <td class="py-4 px-4 ${post.status === 'approved' ? 'text-amber-500 font-bold' : 'text-gray-500'}">
                    ${post.status === 'approved' ? '+' + post.points : '-'}
                </td>
            </tr>
        `;
    }).join('');
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

// Validate URL
function isValidUrl(url, platform) {
    try {
        const urlObj = new URL(url);
        if (platform === 'facebook') {
            return urlObj.hostname.includes('facebook.com');
        } else if (platform === 'instagram') {
            return urlObj.hostname.includes('instagram.com');
        }
        return false;
    } catch {
        return false;
    }
}

// Demo mode functions
function saveDemoPost(platform, postUrl) {
    const posts = getDemoPosts();
    const newPost = {
        id: Date.now().toString(),
        platform: platform,
        postUrl: postUrl,
        status: 'pending',
        createdAt: new Date().toISOString().split('T')[0],
        points: 0
    };
    posts.push(newPost);
    localStorage.setItem('demoPosts', JSON.stringify(posts));
}

function getDemoPosts() {
    const stored = localStorage.getItem('demoPosts');
    if (stored) {
        return JSON.parse(stored);
    }
    
    // Return sample data
    return [
        {
            id: '1',
            platform: 'facebook',
            postUrl: 'https://facebook.com/post/12345',
            status: 'approved',
            createdAt: '2026-01-18',
            points: 150
        },
        {
            id: '2',
            platform: 'instagram',
            postUrl: 'https://instagram.com/p/abcdef',
            status: 'approved',
            createdAt: '2026-01-17',
            points: 200
        },
        {
            id: '3',
            platform: 'facebook',
            postUrl: 'https://facebook.com/post/67890',
            status: 'pending',
            createdAt: '2026-01-19',
            points: 0
        }
    ];
}
