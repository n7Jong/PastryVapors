// Admin Dashboard JavaScript
import { auth, db, signOut, onAuthStateChanged, collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy, getDoc, onSnapshot, where, addDoc, setDoc, Timestamp } from './firebase-config.js';

let currentUser = null;
let allPosts = [];
let allPromoters = [];
let currentActionUserId = null;
let currentPostId = null;
let selectedPoints = 0;
const isDemoMode = localStorage.getItem('demoMode') === 'true';

// Check authentication and admin role
onAuthStateChanged(auth, async (user) => {
    if (!user && !isDemoMode) {
        localStorage.removeItem('userRole'); // Clear cached role
        window.location.href = 'index.html';
        return;
    }
    
    if (!isDemoMode) {
        // Check if user is admin from Firestore (not just localStorage)
        try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (!userDoc.exists() || userDoc.data().isAdmin !== true) {
                alert('Access denied. Admin privileges required.');
                localStorage.removeItem('userRole'); // Clear cached role
                window.location.href = 'index.html';
                return;
            }
        } catch (error) {
            console.error('Error checking admin status:', error);
            localStorage.removeItem('userRole'); // Clear cached role
            window.location.href = 'index.html';
            return;
        }
    }
    
    currentUser = user;
    if (isDemoMode) {
        loadDemoData();
    } else {
        console.log('🎯 Admin authenticated:', user.email);
        setupNotificationListener();
        loadAdminData();
        loadSignupStatus();
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
        console.log('📊 Loading admin data...');
        const postsQuery = query(collection(db, 'posts'));
        const querySnapshot = await getDocs(postsQuery);
        
        console.log('📝 Posts found:', querySnapshot.size);
        console.log('📝 Query snapshot:', querySnapshot);
        
        allPosts = [];
        querySnapshot.forEach((doc) => {
            const postData = doc.data();
            console.log('Post:', doc.id, postData);
            allPosts.push({ id: doc.id, ...postData });
        });
        
        console.log('✅ Total posts loaded:', allPosts.length);
        console.log('✅ All posts array:', allPosts);
        
        // Sort by createdAt in JavaScript (descending)
        allPosts.sort((a, b) => {
            const aTime = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
            const bTime = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
            return bTime - aTime;
        });
        
        console.log('📊 Updating stats and table...');
        updateAdminStats(allPosts);
        updatePostsTable(allPosts);
        updateNotificationBadge(allPosts);
        console.log('✅ Admin data loaded successfully');
        
    } catch (error) {
        console.error('❌ Error loading admin data:', error);
        console.error('Error details:', error.message);
        console.error('Error stack:', error.stack);
        
        // Show error message in the table
        const tbody = document.getElementById('postsTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="py-8 text-center text-red-500">
                        <i class="fas fa-exclamation-circle text-3xl mb-3"></i>
                        <p>Error loading submissions: ${error.message}</p>
                        <p class="text-sm mt-2">Check console for details</p>
                    </td>
                </tr>
            `;
        }
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
    console.log('📋 updatePostsTable called with', posts.length, 'posts');
    const tbody = document.getElementById('postsTableBody');
    console.log('📋 Table body element:', tbody);
    
    if (!tbody) {
        console.error('❌ Table body element not found!');
        return;
    }
    
    if (posts.length === 0) {
        console.log('📋 No posts to display');
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="py-8 text-center text-gray-500">
                    No submissions to review yet.
                </td>
            </tr>
        `;
        return;
    }
    
    console.log('📋 Generating table HTML for', posts.length, 'posts');
    
    try {
        tbody.innerHTML = posts.map((post, index) => {
        const date = post.createdAt ? 
            (post.createdAt.toDate ? post.createdAt.toDate().toISOString().split('T')[0] : post.createdAt) :
            new Date().toISOString().split('T')[0];
            
        const platformColor = post.platform === 'facebook' ? 'blue' : 'pink';
        const platformIcon = post.platform === 'facebook' ? 'facebook-f' : 'instagram';
        const statusInfo = getStatusInfo(post.status);
        const userName = post.userName || (post.userEmail ? post.userEmail.split('@')[0] : 'User ' + (index + 1));
        
        // Get task type display
        const taskTypeMap = {
            'hand-check': { icon: 'hand-point-up', text: 'Hand-check', color: 'amber' },
            'video-content': { icon: 'video', text: 'Video Content', color: 'purple' },
            'group-share': { icon: 'share-nodes', text: 'Group Share', color: 'blue' },
            'hype-comment': { icon: 'comment', text: 'Hype Comment', color: 'green' }
        };
        
        // Debug log for task type
        if (index === 0) {
            console.log('📝 Post task data:', {
                taskType: post.taskType,
                taskPoints: post.taskPoints,
                postId: post.id
            });
        }
        
        const taskInfo = taskTypeMap[post.taskType] || { icon: 'file', text: 'Unknown', color: 'gray' };
        
        return `
            <tr class="border-b border-gray-800 hover:bg-gray-800/50" data-status="${post.status}" data-post-id="${post.id}">
                <td class="py-4 px-4">${date}</td>
                <td class="py-4 px-4">
                    <div class="flex items-center gap-3" data-user-id="${post.userId}">
                        <img src="" class="user-profile-pic w-10 h-10 rounded-full object-cover border-2 border-amber-500/30" 
                             onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=f59e0b&color=000&size=128'">
                        <div>
                            <div class="font-semibold">${userName}</div>
                            <div class="text-xs text-gray-400">
                                <i class="fas fa-${taskInfo.icon} text-${taskInfo.color}-500 mr-1"></i>
                                ${taskInfo.text} (${post.taskPoints || 0} pts)
                            </div>
                        </div>
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
                    ${post.screenshots && post.screenshots.length > 0 ? `
                        <button class="view-screenshots-btn text-amber-500 hover:text-amber-400 text-sm mt-1 flex items-center gap-1" data-post-id="${post.id}">
                            <i class="fas fa-images"></i> View ${post.screenshots.length} screenshot${post.screenshots.length > 1 ? 's' : ''}
                        </button>
                    ` : ''}
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
                <td class="py-4 px-4">
                    <button class="view-details-btn bg-amber-500 hover:bg-amber-600 text-black px-4 py-2 rounded-lg text-sm font-semibold transition" data-post-id="${post.id}">
                        <i class="fas fa-eye mr-1"></i>View
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    console.log('✅ Table HTML generated successfully');
    
    // Attach event listeners to approve/reject buttons
    attachActionButtons();
    
    // Load profile pictures for users
    loadUserProfilePictures();
    
    } catch (error) {
        console.error('❌ Error generating table HTML:', error);
        console.error('Error details:', error.message);
        console.error('Error stack:', error.stack);
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="py-8 text-center text-red-500">
                    Error displaying posts: ${error.message}
                </td>
            </tr>
        `;
    }
}

// Load profile pictures for users in the table
async function loadUserProfilePictures() {
    const userCells = document.querySelectorAll('[data-user-id]');
    
    for (const cell of userCells) {
        const userId = cell.dataset.userId;
        if (!userId) continue;
        
        try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                const img = cell.querySelector('.user-profile-pic');
                if (img && userData.profilePicture) {
                    img.src = userData.profilePicture;
                }
            }
        } catch (error) {
            console.error('Error loading profile picture for user:', userId, error);
        }
    }
}

// Attach event listeners to action buttons
function attachActionButtons() {
    console.log('🔘 Attaching action buttons...');
    
    const approveBtns = document.querySelectorAll('.approve-btn');
    const rejectBtns = document.querySelectorAll('.reject-btn');
    const screenshotBtns = document.querySelectorAll('.view-screenshots-btn');
    const viewDetailsBtns = document.querySelectorAll('.view-details-btn');
    
    console.log('Found approve buttons:', approveBtns.length);
    console.log('Found reject buttons:', rejectBtns.length);
    console.log('Found screenshot buttons:', screenshotBtns.length);
    console.log('Found view details buttons:', viewDetailsBtns.length);
    
    approveBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const postId = e.currentTarget.dataset.postId;
            console.log('✅ Approve clicked for post:', postId);
            showApprovalModal(postId);
        });
    });
    
    rejectBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const postId = e.currentTarget.dataset.postId;
            console.log('❌ Reject clicked for post:', postId);
            showRejectionModal(postId);
        });
    });
    
    screenshotBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const postId = e.currentTarget.dataset.postId;
            console.log('📷 View screenshots clicked for post:', postId);
            showScreenshotModal(postId);
        });
    });
    
    viewDetailsBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const postId = e.currentTarget.dataset.postId;
            console.log('👁️ View details clicked for post:', postId);
            showSubmissionDetailsModal(postId);
        });
    });
}

// Screenshot viewer
let currentScreenshots = [];
let currentScreenshotIndex = 0;

function showScreenshotModal(postId) {
    const post = allPosts.find(p => p.id === postId);
    if (!post || !post.screenshots || post.screenshots.length === 0) return;
    
    currentScreenshots = post.screenshots;
    currentScreenshotIndex = 0;
    updateScreenshotDisplay();
    
    document.getElementById('screenshotModal').classList.remove('hidden');
}

function updateScreenshotDisplay() {
    const img = document.getElementById('currentScreenshot');
    const counter = document.getElementById('screenshotCounter');
    const thumbnailStrip = document.getElementById('thumbnailStrip');
    
    img.src = currentScreenshots[currentScreenshotIndex];
    counter.textContent = `${currentScreenshotIndex + 1} / ${currentScreenshots.length}`;
    
    // Update thumbnails
    thumbnailStrip.innerHTML = currentScreenshots.map((url, index) => `
        <img 
            src="${url}" 
            alt="Thumbnail ${index + 1}"
            class="w-20 h-20 object-cover rounded cursor-pointer border-2 ${index === currentScreenshotIndex ? 'border-amber-500' : 'border-transparent'} hover:border-amber-500"
            onclick="currentScreenshotIndex = ${index}; updateScreenshotDisplay();"
        >
    `).join('');
}

document.getElementById('closeScreenshotModal')?.addEventListener('click', () => {
    document.getElementById('screenshotModal').classList.add('hidden');
});

document.getElementById('prevScreenshot')?.addEventListener('click', () => {
    if (currentScreenshotIndex > 0) {
        currentScreenshotIndex--;
        updateScreenshotDisplay();
    }
});

document.getElementById('nextScreenshot')?.addEventListener('click', () => {
    if (currentScreenshotIndex < currentScreenshots.length - 1) {
        currentScreenshotIndex++;
        updateScreenshotDisplay();
    }
});

// Screenshot Zoom Lightbox Functions
window.openScreenshotZoom = function() {
    const zoomLightbox = document.getElementById('screenshotZoomLightbox');
    const zoomedImg = document.getElementById('zoomedScreenshot');
    const zoomedCounter = document.getElementById('zoomedCounter');
    
    if (zoomLightbox && zoomedImg && currentScreenshots.length > 0) {
        zoomedImg.src = currentScreenshots[currentScreenshotIndex];
        zoomedCounter.textContent = `${currentScreenshotIndex + 1} / ${currentScreenshots.length}`;
        zoomLightbox.classList.remove('hidden');
    }
};

window.closeScreenshotZoom = function() {
    const zoomLightbox = document.getElementById('screenshotZoomLightbox');
    if (zoomLightbox) {
        zoomLightbox.classList.add('hidden');
    }
};

window.navigateZoomedScreenshot = function(direction) {
    currentScreenshotIndex += direction;
    
    // Loop around
    if (currentScreenshotIndex < 0) {
        currentScreenshotIndex = currentScreenshots.length - 1;
    } else if (currentScreenshotIndex >= currentScreenshots.length) {
        currentScreenshotIndex = 0;
    }
    
    // Update both the zoom view and the background modal
    const zoomedImg = document.getElementById('zoomedScreenshot');
    const zoomedCounter = document.getElementById('zoomedCounter');
    
    if (zoomedImg) {
        zoomedImg.src = currentScreenshots[currentScreenshotIndex];
    }
    if (zoomedCounter) {
        zoomedCounter.textContent = `${currentScreenshotIndex + 1} / ${currentScreenshots.length}`;
    }
    
    // Also update the background screenshot viewer
    updateScreenshotDisplay();
};

// Keyboard navigation for zoomed screenshot
document.addEventListener('keydown', (e) => {
    const zoomLightbox = document.getElementById('screenshotZoomLightbox');
    if (zoomLightbox && !zoomLightbox.classList.contains('hidden')) {
        if (e.key === 'Escape') {
            closeScreenshotZoom();
        } else if (e.key === 'ArrowLeft') {
            navigateZoomedScreenshot(-1);
        } else if (e.key === 'ArrowRight') {
            navigateZoomedScreenshot(1);
        }
    }
});

// Submission Details Modal
function showSubmissionDetailsModal(postId) {
    const post = allPosts.find(p => p.id === postId);
    if (!post) return;
    
    // Format date
    const date = post.createdAt ? 
        (post.createdAt.toDate ? post.createdAt.toDate().toLocaleDateString() : post.createdAt) :
        new Date().toLocaleDateString();
    
    // Get user name
    const userName = post.userName || (post.userEmail ? post.userEmail.split('@')[0] : 'Unknown User');
    
    // Platform display
    const platformColor = post.platform === 'facebook' ? 'blue' : 'pink';
    const platformIcon = post.platform === 'facebook' ? 'facebook-f' : 'instagram';
    const platformHTML = `
        <div class="inline-flex items-center gap-2 bg-gray-800 px-3 py-1 rounded-lg">
            <i class="fab fa-${platformIcon} text-${platformColor}-500"></i>
            <span class="text-white capitalize">${post.platform}</span>
        </div>
    `;
    
    // Status display
    const statusInfo = getStatusInfo(post.status);
    const statusHTML = `
        <span class="inline-block px-3 py-1 rounded-full text-sm font-semibold bg-${statusInfo.color}-500/20 text-${statusInfo.color}-400">
            <i class="${statusInfo.icon} mr-1"></i>${statusInfo.text}
        </span>
    `;
    
    // Actions HTML
    let actionsHTML = '';
    if (post.status === 'pending') {
        actionsHTML = `
            <button class="approve-btn-modal bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition" data-post-id="${post.id}">
                <i class="fas fa-check mr-1"></i>Approve
            </button>
            <button class="reject-btn-modal bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition" data-post-id="${post.id}">
                <i class="fas fa-times mr-1"></i>Reject
            </button>
        `;
    } else {
        actionsHTML = `
            <span class="text-gray-400 text-sm">
                ${post.status === 'approved' ? '✓ Approved (+' + (post.points || 150) + ' points)' : '✗ Rejected'}
            </span>
        `;
    }
    
    // Populate modal
    document.getElementById('detailDate').textContent = date;
    document.getElementById('detailPromoter').textContent = userName;
    document.getElementById('detailPlatform').innerHTML = platformHTML;
    document.getElementById('detailPostUrl').href = post.postUrl;
    document.getElementById('detailPostUrl').textContent = post.postUrl;
    document.getElementById('detailStatus').innerHTML = statusHTML;
    document.getElementById('detailActions').innerHTML = actionsHTML;
    
    // Handle screenshots button
    const viewScreenshotsBtn = document.getElementById('viewScreenshotsBtn');
    if (post.screenshots && post.screenshots.length > 0) {
        viewScreenshotsBtn.style.display = 'inline-block';
        viewScreenshotsBtn.onclick = () => {
            document.getElementById('submissionDetailsModal').classList.add('hidden');
            showScreenshotModal(postId);
        };
    } else {
        viewScreenshotsBtn.style.display = 'none';
    }
    
    // Show modal
    document.getElementById('submissionDetailsModal').classList.remove('hidden');
    
    // Attach event listeners to modal action buttons
    const approveBtnModal = document.querySelector('.approve-btn-modal');
    const rejectBtnModal = document.querySelector('.reject-btn-modal');
    
    if (approveBtnModal) {
        approveBtnModal.addEventListener('click', () => {
            document.getElementById('submissionDetailsModal').classList.add('hidden');
            showApprovalModal(postId);
        });
    }
    
    if (rejectBtnModal) {
        rejectBtnModal.addEventListener('click', () => {
            document.getElementById('submissionDetailsModal').classList.add('hidden');
            showRejectionModal(postId);
        });
    }
}

// Close submission details modal
document.getElementById('closeSubmissionDetailsBtn')?.addEventListener('click', () => {
    document.getElementById('submissionDetailsModal').classList.add('hidden');
});


// Keyboard navigation
document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('screenshotModal');
    if (!modal.classList.contains('hidden')) {
        if (e.key === 'ArrowLeft') {
            document.getElementById('prevScreenshot').click();
        } else if (e.key === 'ArrowRight') {
            document.getElementById('nextScreenshot').click();
        } else if (e.key === 'Escape') {
            modal.classList.add('hidden');
        }
    }
});

// Show approval modal with fixed points based on task type
function showApprovalModal(postId) {
    console.log('📋 Opening approval modal for post:', postId);
    currentPostId = postId;
    const post = allPosts.find(p => p.id === postId);
    
    if (!post) {
        console.error('❌ Post not found:', postId);
        return;
    }
    
    console.log('📋 Post data:', post);
    
    const modal = document.getElementById('approvalModal');
    
    if (!modal) {
        console.error('❌ Approval modal not found!');
        return;
    }
    
    // Update modal to show task-specific information
    const taskTypeMap = {
        'hand-check': { name: 'Hand-check', points: 15, adjustable: false },
        'video-content': { name: 'Video Content', points: 25, adjustable: false },
        'group-share': { name: 'Group Share', points: post.taskPoints || post.screenshots?.length || 1, adjustable: true },
        'hype-comment': { name: 'Hype Comment', points: post.taskPoints || post.screenshots?.length || 1, adjustable: true }
    };
    
    const taskInfo = taskTypeMap[post.taskType] || { name: 'Post', points: 15, adjustable: false };
    selectedPoints = taskInfo.points;
    
    const modalText = modal.querySelector('#approvalModalMessage');
    const pointsInputSection = document.getElementById('pointsInputSection');
    const pointsInput = document.getElementById('pointsInput');
    
    if (taskInfo.adjustable) {
        // Show points input for group-share and hype-comment
        const screenshotCount = post.screenshots?.length || 0;
        modalText.textContent = `This ${taskInfo.name} has ${screenshotCount} screenshot${screenshotCount !== 1 ? 's' : ''}. Adjust points if needed:`;
        pointsInputSection.classList.remove('hidden');
        pointsInput.value = selectedPoints;
        pointsInput.max = screenshotCount * 2; // Allow up to 2 points per screenshot
        
        // Update selectedPoints when input changes
        pointsInput.oninput = (e) => {
            selectedPoints = parseInt(e.target.value) || 1;
        };
    } else {
        // Fixed points for hand-check and video-content
        modalText.textContent = `This ${taskInfo.name} will award ${selectedPoints} points.`;
        pointsInputSection.classList.add('hidden');
    }
    
    modal.classList.remove('hidden');
    console.log('✅ Approval modal opened with', selectedPoints, 'points');
}

// Show rejection modal
function showRejectionModal(postId) {
    console.log('📋 Opening rejection modal for post:', postId);
    currentPostId = postId;
    const modal = document.getElementById('rejectionModal');
    
    if (!modal) {
        console.error('❌ Rejection modal not found!');
        return;
    }
    
    modal.classList.remove('hidden');
    console.log('✅ Rejection modal opened');
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
        // Get points from input if visible, otherwise use selectedPoints
        const pointsInput = document.getElementById('pointsInput');
        const pointsInputSection = document.getElementById('pointsInputSection');
        
        let finalPoints = selectedPoints;
        if (pointsInputSection && !pointsInputSection.classList.contains('hidden')) {
            finalPoints = parseInt(pointsInput.value) || selectedPoints;
        }
        
        console.log('✅ Approving with', finalPoints, 'points');
        await handleAction('approve', currentPostId, finalPoints);
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

// Real-time notification listener
let notificationsUnsubscribe = null;
let allNotifications = [];

function setupNotificationListener() {
    // Query without orderBy to avoid index requirement
    const notificationsQuery = query(
        collection(db, 'notifications'),
        where('read', '==', false)
    );
    
    notificationsUnsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
        allNotifications = [];
        snapshot.forEach((doc) => {
            allNotifications.push({ id: doc.id, ...doc.data() });
        });
        
        // Sort by createdAt in JavaScript instead
        allNotifications.sort((a, b) => {
            const aTime = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
            const bTime = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
            return bTime - aTime; // Descending order (newest first)
        });
        
        // Update badge
        const badge = document.getElementById('notificationBadge');
        if (allNotifications.length > 0) {
            badge.textContent = allNotifications.length;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
        
        // Update panel if it's open
        const panel = document.getElementById('notificationsPanel');
        if (panel && !panel.classList.contains('hidden')) {
            loadNotifications();
        }
        
        console.log('🔔 Notifications updated:', allNotifications.length);
        console.log('📋 Notification data:', allNotifications);
    }, (error) => {
        console.error('❌ Error listening to notifications:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
    });
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
async function loadNotifications() {
    const notificationsList = document.getElementById('notificationsList');
    
    if (allNotifications.length === 0) {
        notificationsList.innerHTML = `
            <div class="text-center text-gray-400 py-6">
                <i class="fas fa-check-circle text-3xl mb-2"></i>
                <p>No new notifications</p>
            </div>
        `;
        return;
    }
    
    notificationsList.innerHTML = allNotifications.map(notification => {
        const date = notification.createdAt?.toDate ? notification.createdAt.toDate().toLocaleString() : 'Just now';
        const userName = notification.userName || notification.userEmail?.split('@')[0] || 'User';
        const taskTypeMap = {
            'hand-check': 'Hand-check',
            'video-content': 'Video Content',
            'group-share': 'Group Share',
            'hype-comment': 'Hype Comment'
        };
        const taskName = taskTypeMap[notification.taskType] || 'post';
        
        return `
            <div class="border-b border-gray-700 py-3 hover:bg-gray-800/30 rounded px-2 cursor-pointer" onclick="markNotificationRead('${notification.id}')">
                <div class="flex items-start gap-3">
                    <div class="bg-yellow-500/20 p-2 rounded">
                        <i class="fas fa-file-lines text-yellow-500"></i>
                    </div>
                    <div class="flex-1">
                        <p class="text-white font-semibold">${userName} submitted a ${taskName}</p>
                        <p class="text-gray-400 text-sm">${notification.platform} • ${date}</p>
                    </div>
                    <button class="text-gray-400 hover:text-white" onclick="event.stopPropagation(); deleteNotification('${notification.id}')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Mark notification as read
window.markNotificationRead = async function(notificationId) {
    try {
        await updateDoc(doc(db, 'notifications', notificationId), {
            read: true
        });
        console.log('✅ Notification marked as read');
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
};

// Delete notification
window.deleteNotification = async function(notificationId) {
    try {
        await deleteDoc(doc(db, 'notifications', notificationId));
        console.log('🗑️ Notification deleted');
    } catch (error) {
        console.error('Error deleting notification:', error);
    }
};

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
        const usersQuery = query(collection(db, 'users'), where('isAdmin', '==', false));
        const querySnapshot = await getDocs(usersQuery);
        
        allPromoters = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            allPromoters.push({ id: doc.id, ...data });
        });
        
        console.log('✅ Loaded promoters:', allPromoters.length);
        
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
        const isSuspended = promoter.suspended === true;
        const suspendedUntil = promoter.suspendedUntil ? new Date(promoter.suspendedUntil).toLocaleDateString() : '';
        const isExpired = promoter.suspendedUntil && new Date(promoter.suspendedUntil) <= new Date();
        
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
                            <i class="fas fa-ban mr-1"></i>Suspended ${isExpired ? '(Expired)' : `until ${suspendedUntil}`}
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
                        ${isSuspended ? `
                            <button class="unsuspend-btn bg-green-500/20 hover:bg-green-500 hover:text-white text-green-500 px-3 py-1 rounded text-sm transition" data-user-id="${promoter.id}" data-user-name="${promoter.fullName || 'User'}">
                                <i class="fas fa-check"></i> Unsuspend
                            </button>
                        ` : `
                            <button class="suspend-btn bg-orange-500/20 hover:bg-orange-500 hover:text-white text-orange-500 px-3 py-1 rounded text-sm transition" data-user-id="${promoter.id}" data-user-name="${promoter.fullName || 'User'}">
                                <i class="fas fa-ban"></i>
                            </button>
                        `}
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
    
    document.querySelectorAll('.unsuspend-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const userId = e.currentTarget.dataset.userId;
            const userName = e.currentTarget.dataset.userName;
            
            if (confirm(`Are you sure you want to unsuspend ${userName}?`)) {
                try {
                    const userRef = doc(db, 'users', userId);
                    await updateDoc(userRef, {
                        suspended: false,
                        suspendedUntil: null
                    });
                    
                    alert(`${userName} has been unsuspended`);
                    await loadPromoters();
                } catch (error) {
                    console.error('Error unsuspending user:', error);
                    alert('Failed to unsuspend user: ' + error.message);
                }
            }
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
        // Delete all posts by this user from Firestore (not just from local array)
        const postsQuery = query(collection(db, 'posts'), where('userId', '==', currentActionUserId));
        const postsSnapshot = await getDocs(postsQuery);
        
        const deletePromises = [];
        postsSnapshot.forEach((postDoc) => {
            deletePromises.push(deleteDoc(doc(db, 'posts', postDoc.id)));
        });
        
        // Delete all posts
        await Promise.all(deletePromises);
        
        // Delete notifications related to this user
        const notificationsQuery = query(collection(db, 'notifications'), where('userId', '==', currentActionUserId));
        const notificationsSnapshot = await getDocs(notificationsQuery);
        const notificationPromises = [];
        notificationsSnapshot.forEach((notifDoc) => {
            notificationPromises.push(deleteDoc(doc(db, 'notifications', notifDoc.id)));
        });
        await Promise.all(notificationPromises);
        
        // Delete Google account if exists
        try {
            await deleteDoc(doc(db, 'googleAccounts', currentActionUserId));
        } catch (e) {
            console.log('No Google account to delete or error:', e);
        }
        
        // Finally, delete user document
        await deleteDoc(doc(db, 'users', currentActionUserId));
        
        alert('Promoter permanently removed from system');
        document.getElementById('kickModal').classList.add('hidden');
        await loadPromoters();
        await loadAdminData(); // Refresh posts
    } catch (error) {
        console.error('Error kicking user:', error);
        alert('Failed to kick user: ' + error.message);
    }
});

// Announcement Modal Handlers
document.getElementById('createAnnouncementBtn')?.addEventListener('click', () => {
    document.getElementById('announcementModal').classList.remove('hidden');
});

document.getElementById('cancelAnnouncementBtn')?.addEventListener('click', () => {
    document.getElementById('announcementModal').classList.add('hidden');
    document.getElementById('announcementForm').reset();
});

document.getElementById('announcementForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const title = document.getElementById('announcementTitle').value;
    const message = document.getElementById('announcementMessage').value;
    const priority = document.getElementById('announcementPriority').value;
    
    try {
        await addDoc(collection(db, 'announcements'), {
            title: title,
            message: message,
            priority: priority,
            createdAt: Timestamp.now(),
            createdBy: currentUser.uid,
            active: true
        });
        
        alert('Announcement created successfully!');
        document.getElementById('announcementModal').classList.add('hidden');
        document.getElementById('announcementForm').reset();
    } catch (error) {
        console.error('Error creating announcement:', error);
        alert('Failed to create announcement: ' + error.message);
    }
});

// Load and display signup status
async function loadSignupStatus() {
    try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'signup'));
        const statusElement = document.getElementById('signupStatus');
        
        if (settingsDoc.exists()) {
            const isEnabled = settingsDoc.data().enabled;
            updateSignupStatusUI(isEnabled);
        } else {
            // Default to enabled if no setting exists
            await updateDoc(doc(db, 'settings', 'signup'), { enabled: true });
            updateSignupStatusUI(true);
        }
    } catch (error) {
        console.error('Error loading signup status:', error);
        // If document doesn't exist, create it
        try {
            await setDoc(doc(db, 'settings', 'signup'), { enabled: true });
            updateSignupStatusUI(true);
        } catch (e) {
            console.error('Error creating signup settings:', e);
        }
    }
}

function updateSignupStatusUI(isEnabled) {
    const statusElement = document.getElementById('signupStatus');
    if (statusElement) {
        statusElement.textContent = isEnabled ? 'ON' : 'OFF';
        statusElement.className = isEnabled ? 'text-green-500 font-bold' : 'text-red-500 font-bold';
    }
}

// Toggle signup button handler
document.getElementById('toggleSignupBtn')?.addEventListener('click', async () => {
    try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'signup'));
        const currentStatus = settingsDoc.exists() ? settingsDoc.data().enabled : true;
        const newStatus = !currentStatus;
        
        if (confirm(`Are you sure you want to ${newStatus ? 'ENABLE' : 'DISABLE'} the signup page?`)) {
            await setDoc(doc(db, 'settings', 'signup'), { 
                enabled: newStatus,
                lastUpdated: Timestamp.now(),
                updatedBy: currentUser.uid
            });
            
            updateSignupStatusUI(newStatus);
            alert(`Signup page has been ${newStatus ? 'ENABLED' : 'DISABLED'}`);
        }
    } catch (error) {
        console.error('Error toggling signup:', error);
        alert('Failed to toggle signup: ' + error.message);
    }
});

// Track Inactive Queens/Kings
let selectedInactivePromoters = [];

document.getElementById('trackInactiveBtn')?.addEventListener('click', async () => {
    try {
        console.log('🔍 Checking for inactive Queens and Kings...');
        
        // Get all users with Queen or King rank
        const usersQuery = query(collection(db, 'users'));
        const usersSnapshot = await getDocs(usersQuery);
        
        const royals = [];
        usersSnapshot.forEach((doc) => {
            const userData = doc.data();
            if (userData.rank === 'Queen' || userData.rank === 'King') {
                royals.push({ id: doc.id, ...userData });
            }
        });
        
        console.log('👑 Total Queens/Kings:', royals.length);
        
        // Get today's date range (midnight to midnight)
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        
        console.log('📅 Checking submissions from:', todayStart, 'to:', todayEnd);
        
        // Get today's posts
        const postsQuery = query(
            collection(db, 'posts'),
            where('createdAt', '>=', Timestamp.fromDate(todayStart)),
            where('createdAt', '<=', Timestamp.fromDate(todayEnd))
        );
        const postsSnapshot = await getDocs(postsQuery);
        
        // Get list of user IDs who submitted today
        const activeUserIds = new Set();
        postsSnapshot.forEach((doc) => {
            const postData = doc.data();
            activeUserIds.add(postData.userId);
        });
        
        console.log('✅ Active users today:', activeUserIds.size);
        
        // Find inactive royals
        const inactiveRoyals = royals.filter(royal => !activeUserIds.has(royal.id));
        
        console.log('⚠️ Inactive Queens/Kings:', inactiveRoyals.length);
        
        // Display results
        displayInactiveRoyals(inactiveRoyals);
        
    } catch (error) {
        console.error('Error tracking inactive royals:', error);
        alert('Failed to track inactive Queens/Kings: ' + error.message);
    }
});

function displayInactiveRoyals(inactiveRoyals) {
    const modal = document.getElementById('inactiveRoyalsModal');
    const listContainer = document.getElementById('inactiveRoyalsList');
    const noInactiveMessage = document.getElementById('noInactiveRoyals');
    
    selectedInactivePromoters = [];
    
    if (inactiveRoyals.length === 0) {
        listContainer.classList.add('hidden');
        noInactiveMessage.classList.remove('hidden');
    } else {
        listContainer.classList.remove('hidden');
        noInactiveMessage.classList.add('hidden');
        
        listContainer.innerHTML = inactiveRoyals.map(royal => `
            <div class="card rounded-lg p-4 flex items-center justify-between">
                <div class="flex items-center gap-4">
                    <input 
                        type="checkbox" 
                        class="inactive-checkbox w-5 h-5 rounded border-gray-600 bg-black/30 text-amber-500 focus:ring-amber-500"
                        data-user-id="${royal.id}"
                        data-user-name="${royal.firstName} ${royal.lastName}"
                    >
                    <div>
                        <p class="text-white font-semibold flex items-center gap-2">
                            ${royal.firstName} ${royal.lastName}
                            <span class="text-xs ${royal.rank === 'Queen' ? 'text-pink-400' : 'text-blue-400'}">
                                <i class="fas fa-crown mr-1"></i>${royal.rank}
                            </span>
                        </p>
                        <p class="text-gray-400 text-sm">${royal.email}</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-gray-400 text-sm">Points: <span class="text-amber-500 font-semibold">${royal.points || 0}</span></p>
                </div>
            </div>
        `).join('');
        
        // Add event listeners to checkboxes
        document.querySelectorAll('.inactive-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', updateSelectedInactive);
        });
    }
    
    modal.classList.remove('hidden');
    modal.classList.add('active');
}

function updateSelectedInactive() {
    selectedInactivePromoters = [];
    document.querySelectorAll('.inactive-checkbox:checked').forEach(checkbox => {
        selectedInactivePromoters.push({
            id: checkbox.dataset.userId,
            name: checkbox.dataset.userName
        });
    });
    console.log('Selected promoters:', selectedInactivePromoters.length);
}

// Close inactive royals modal
document.getElementById('closeInactiveRoyalsBtn')?.addEventListener('click', () => {
    document.getElementById('inactiveRoyalsModal').classList.add('hidden');
    document.getElementById('inactiveRoyalsModal').classList.remove('active');
    selectedInactivePromoters = [];
});

// Select all inactive
document.getElementById('selectAllInactiveBtn')?.addEventListener('click', () => {
    document.querySelectorAll('.inactive-checkbox').forEach(checkbox => {
        checkbox.checked = true;
    });
    updateSelectedInactive();
});

// Deselect all inactive
document.getElementById('deselectAllInactiveBtn')?.addEventListener('click', () => {
    document.querySelectorAll('.inactive-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });
    updateSelectedInactive();
});

// Warn selected inactive promoters
document.getElementById('warnSelectedBtn')?.addEventListener('click', () => {
    if (selectedInactivePromoters.length === 0) {
        alert('Please select at least one promoter to warn.');
        return;
    }
    
    document.getElementById('bulkWarningCount').textContent = selectedInactivePromoters.length;
    document.getElementById('bulkWarningModal').classList.remove('hidden');
    document.getElementById('bulkWarningModal').classList.add('active');
});

// Cancel bulk warning
document.getElementById('cancelBulkWarningBtn')?.addEventListener('click', () => {
    document.getElementById('bulkWarningModal').classList.add('hidden');
    document.getElementById('bulkWarningModal').classList.remove('active');
    document.getElementById('bulkWarningMessage').value = '';
});

// Confirm bulk warning
document.getElementById('confirmBulkWarningBtn')?.addEventListener('click', async () => {
    const message = document.getElementById('bulkWarningMessage').value.trim();
    
    if (!message) {
        alert('Please enter a warning message.');
        return;
    }
    
    try {
        console.log('📨 Sending warnings to', selectedInactivePromoters.length, 'promoters...');
        
        const warningPromises = selectedInactivePromoters.map(async (promoter) => {
            // Add notification for the promoter
            await addDoc(collection(db, 'notifications'), {
                userId: promoter.id,
                type: 'warning',
                title: 'Inactivity Warning',
                message: message,
                createdAt: Timestamp.now(),
                read: false,
                priority: 'high'
            });
            
            // Update user's warning count
            const userRef = doc(db, 'users', promoter.id);
            const userDoc = await getDoc(userRef);
            if (userDoc.exists()) {
                const currentWarnings = userDoc.data().warnings || 0;
                await updateDoc(userRef, {
                    warnings: currentWarnings + 1,
                    lastWarning: Timestamp.now()
                });
            }
        });
        
        await Promise.all(warningPromises);
        
        alert(`Warning sent to ${selectedInactivePromoters.length} promoter(s) successfully!`);
        
        // Close modals
        document.getElementById('bulkWarningModal').classList.add('hidden');
        document.getElementById('bulkWarningModal').classList.remove('active');
        document.getElementById('inactiveRoyalsModal').classList.add('hidden');
        document.getElementById('inactiveRoyalsModal').classList.remove('active');
        
        // Reset
        document.getElementById('bulkWarningMessage').value = '';
        selectedInactivePromoters = [];
        
    } catch (error) {
        console.error('Error sending bulk warnings:', error);
        alert('Failed to send warnings: ' + error.message);
    }
});
