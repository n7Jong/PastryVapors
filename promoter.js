// Promoter Dashboard JavaScript
import { auth, db, signOut, onAuthStateChanged, collection, addDoc, getDocs, getDoc, query, where, orderBy, Timestamp, doc, updateDoc } from './firebase-config.js';

let currentUser = null;
let currentUserData = null;
const isDemoMode = localStorage.getItem('demoMode') === 'true';

// Check authentication
onAuthStateChanged(auth, async (user) => {
    if (!user && !isDemoMode) {
        window.location.href = 'index.html';
        return;
    }
    currentUser = user;
    if (!isDemoMode) {
        await checkUserStatus();
        loadPromoterData();
    } else {
        loadDemoData();
    }
});

// Check user suspension status
async function checkUserStatus() {
    try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
            currentUserData = userDoc.data();
            
            // Check if user is suspended
            if (currentUserData.suspended) {
                const suspendedUntil = new Date(currentUserData.suspendedUntil);
                const now = new Date();
                
                if (suspendedUntil > now) {
                    // User is still suspended
                    showSuspensionNotice(suspendedUntil);
                    return true;
                } else {
                    // Suspension expired, remove it
                    await updateDoc(doc(db, 'users', currentUser.uid), {
                        suspended: false,
                        suspendedUntil: null
                    });
                    currentUserData.suspended = false;
                }
            }
            
            // Show warnings if any
            if (currentUserData.warnings && currentUserData.warnings > 0) {
                showWarningNotice(currentUserData.warnings, currentUserData.lastWarning);
            }
        }
        return false;
    } catch (error) {
        console.error('Error checking user status:', error);
        return false;
    }
}

// Show suspension notice
function showSuspensionNotice(suspendedUntil) {
    const submitForm = document.getElementById('submitPostForm');
    if (submitForm) {
        submitForm.innerHTML = `
            <div class="bg-orange-500/20 border border-orange-500 rounded-lg p-6 text-center">
                <i class="fas fa-ban text-orange-500 text-4xl mb-4"></i>
                <h3 class="text-xl font-bold text-orange-500 mb-2">Account Suspended</h3>
                <p class="text-gray-300 mb-2">You cannot submit posts until:</p>
                <p class="text-white font-bold text-lg">${suspendedUntil.toLocaleDateString()} ${suspendedUntil.toLocaleTimeString()}</p>
                <p class="text-gray-400 text-sm mt-4">Please contact an administrator for more information.</p>
            </div>
        `;
    }
}

// Show warning notice
function showWarningNotice(warningCount, lastWarning) {
    const statsCards = document.querySelector('.grid');
    if (statsCards && lastWarning) {
        const warningBanner = document.createElement('div');
        warningBanner.className = 'col-span-full bg-yellow-500/20 border border-yellow-500 rounded-lg p-4 mb-4';
        warningBanner.innerHTML = `
            <div class="flex items-start gap-3">
                <i class="fas fa-exclamation-triangle text-yellow-500 text-2xl"></i>
                <div class="flex-1">
                    <h3 class="text-yellow-500 font-bold mb-1">Warning Notice (${warningCount} total)</h3>
                    <p class="text-white">${lastWarning.message}</p>
                    <p class="text-gray-400 text-sm mt-2">${new Date(lastWarning.timestamp).toLocaleString()}</p>
                </div>
            </div>
        `;
        statsCards.insertBefore(warningBanner, statsCards.firstChild);
    }
}

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
        
        // Check if user is suspended
        if (currentUserData?.suspended) {
            alert('You are currently suspended and cannot submit posts.');
            return;
        }
        
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
                // Get user's name for display
                let userName = 'Unknown User';
                if (currentUserData) {
                    const firstName = currentUserData.firstName || '';
                    const lastName = currentUserData.lastName || '';
                    userName = `${firstName} ${lastName}`.trim() || currentUser.email.split('@')[0];
                }
                
                const postData = {
                    userId: currentUser.uid,
                    userEmail: currentUser.email,
                    userName: userName,
                    platform: platform,
                    postUrl: postUrl,
                    status: 'pending',
                    createdAt: Timestamp.now(),
                    points: 0
                };
                
                console.log('📤 Submitting post:', postData);
                const docRef = await addDoc(collection(db, 'posts'), postData);
                console.log('✅ Post submitted with ID:', docRef.id);
                
                // Create notification for admin
                await addDoc(collection(db, 'notifications'), {
                    type: 'new_post',
                    postId: docRef.id,
                    userId: currentUser.uid,
                    userName: userName,
                    userEmail: currentUser.email,
                    platform: platform,
                    postUrl: postUrl,
                    read: false,
                    createdAt: Timestamp.now()
                });
                console.log('🔔 Notification created for admin');
            }
            
            alert('Post submitted successfully! Admin will review it soon.');
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
