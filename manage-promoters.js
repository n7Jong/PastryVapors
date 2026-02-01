import { auth, db, where } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { collection, query, getDocs, doc, updateDoc, deleteDoc, getDoc, increment } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

let allPromoters = [];
let currentPromoter = null;
let isLoading = false;

// Show loading screen
function showLoadingScreen() {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        loadingScreen.classList.remove('hidden');
    }
}

// Hide loading screen with minimum display time
function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        // Minimum 5 seconds display time
        setTimeout(() => {
            loadingScreen.classList.add('hidden');
        }, 5000);
    }
}

// Auth State Observer
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists() && userDoc.data().isAdmin) {
            showLoadingScreen();
            await loadPromoters();
            hideLoadingScreen();
        } else {
            window.location.href = 'index.html';
        }
    } else {
        window.location.href = 'index.html';
    }
});

// Load All Promoters
async function loadPromoters() {
    try {
        console.log('👥 Loading promoters from Firebase users collection...');
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('isAdmin', '==', false));
        const querySnapshot = await getDocs(q);
        
        console.log('📝 Promoters from Firebase (isAdmin=false):', querySnapshot.size);
        
        allPromoters = [];
        
        for (const docSnap of querySnapshot.docs) {
            const userData = docSnap.data();
            console.log('Promoter:', docSnap.id, userData.email, userData);
            
            // Count posts for this promoter
            const postsRef = collection(db, 'posts');
            const postsQuery = query(postsRef, where('userId', '==', docSnap.id));
            const postsSnapshot = await getDocs(postsQuery);
            const postCount = postsSnapshot.size;
            
            allPromoters.push({
                id: docSnap.id,
                ...userData,
                postCount: postCount
            });
        }
        
        console.log('✅ Total promoters loaded:', allPromoters.length);
        
        displayPromoters();
        updateStats();
    } catch (error) {
        console.error('❌ Error loading promoters:', error);
        console.error('Error details:', error.message);
    }
}

// Display Promoters in Table
function displayPromoters() {
    const tbody = document.getElementById('promotersTableBody');
    const noResults = document.getElementById('noResults');
    
    // Get filter values
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;
    const genderFilter = document.getElementById('genderFilter').value;
    const sortBy = document.getElementById('sortBy').value;
    
    // Filter promoters
    let filteredPromoters = allPromoters.filter(promoter => {
        const firstName = promoter.firstName || '';
        const lastName = promoter.lastName || '';
        const email = promoter.email || '';
        const matchesSearch = firstName.toLowerCase().includes(searchTerm) ||
                            lastName.toLowerCase().includes(searchTerm) ||
                            email.toLowerCase().includes(searchTerm);
        
        let matchesStatus = true;
        if (statusFilter === 'active') {
            matchesStatus = !promoter.suspended;
        } else if (statusFilter === 'suspended') {
            matchesStatus = promoter.suspended === true;
        }
        
        let matchesGender = true;
        if (genderFilter === 'male') {
            matchesGender = promoter.gender === 'male';
        } else if (genderFilter === 'female') {
            matchesGender = promoter.gender === 'female';
        }
        
        return matchesSearch && matchesStatus && matchesGender;
    });
    
    // Sort promoters
    filteredPromoters.sort((a, b) => {
        switch(sortBy) {
            case 'points-desc':
                return (b.points || 0) - (a.points || 0);
            case 'points-asc':
                return (a.points || 0) - (b.points || 0);
            case 'name-asc':
                return (a.firstName || '').localeCompare(b.firstName || '');
            case 'warnings-desc':
                return (b.warnings || 0) - (a.warnings || 0);
            default:
                return 0;
        }
    });
    
    if (filteredPromoters.length === 0) {
        tbody.innerHTML = '';
        noResults.classList.remove('hidden');
        return;
    }
    
    noResults.classList.add('hidden');
    
    tbody.innerHTML = filteredPromoters.map(promoter => {
        const isSuspended = promoter.suspended === true;
        const statusClass = isSuspended ? 'status-suspended' : 'status-active';
        const statusText = isSuspended ? 'Suspended' : 'Active';
        
        const firstName = promoter.firstName || '';
        const lastName = promoter.lastName || '';
        const middleName = promoter.middleName || '';
        const fullName = `${firstName} ${middleName} ${lastName}`.trim() || 'Unknown User';
        const displayName = `${firstName} ${lastName}`.trim() || 'Unknown User';
        
        const profilePic = promoter.profilePicture || 
            `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=f59e0b&color=000&size=128`;
        
        const genderClass = promoter.gender === 'male' ? 'gender-male' : 
                             promoter.gender === 'female' ? 'gender-female' : '';
        const genderBadge = promoter.gender === 'male' ? 
            '<span class="gender-badge-male"><i class="fas fa-mars"></i> Male</span>' :
            promoter.gender === 'female' ? 
            '<span class="gender-badge-female"><i class="fas fa-venus"></i> Female</span>' : '';
        
        // Debug logging - show first 3 promoters
        const index = filteredPromoters.indexOf(promoter);
        if (index < 3) {
            console.log(`Promoter ${index + 1}:`, displayName, 'Gender:', promoter.gender, 'Class:', genderClass);
        }
        
        return `
            <tr class="hover:bg-gray-700 transition ${genderClass}">
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                        <img src="${profilePic}" alt="${displayName}" 
                             class="w-12 h-12 rounded-full object-cover">
                        <div>
                            <div class="flex items-center gap-2">
                                <p class="text-white font-semibold">${displayName}</p>
                                ${genderBadge}
                            </div>
                            <p class="text-gray-400 text-sm">${promoter.email}</p>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 text-center hidden md:table-cell">
                    <span class="text-amber-500 font-bold text-lg">${promoter.points || 0}</span>
                </td>
                <td class="px-6 py-4 text-center hidden md:table-cell">
                    <span class="text-white font-semibold">${promoter.postCount || 0}</span>
                </td>
                <td class="px-6 py-4 text-center hidden md:table-cell">
                    <span class="text-white font-semibold ${(promoter.warnings || 0) > 0 ? 'text-red-500' : ''}">${promoter.warnings || 0}</span>
                </td>
                <td class="px-6 py-4 text-center hidden sm:table-cell">
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </td>
                <td class="px-6 py-4">
                    <!-- Desktop Actions -->
                    <div class="desktop-actions gap-2 justify-center flex-wrap hidden md:flex">
                        <button onclick="viewPromoterDetails('${promoter.id}')" 
                                class="action-btn" style="background-color: #3b82f6; color: white;">
                            <i class="fas fa-eye mr-1"></i>View
                        </button>
                        <button onclick="openWarningModal('${promoter.id}', '${displayName.replace(/'/g, "\\'").replace(/"/g, '&quot;')}')" 
                                class="action-btn warning-btn">
                            <i class="fas fa-exclamation-triangle mr-1"></i>Warn
                        </button>
                        ${isSuspended ? `
                            <button onclick="unsuspendPromoter('${promoter.id}', '${displayName.replace(/'/g, "\\'").replace(/"/g, '&quot;')}')" 
                                    class="action-btn" style="background-color: #10b981; color: white;">
                                <i class="fas fa-check mr-1"></i>Unsuspend
                            </button>
                        ` : `
                            <button onclick="openSuspendModal('${promoter.id}', '${displayName.replace(/'/g, "\\'").replace(/"/g, '&quot;')}')" 
                                    class="action-btn suspend-btn">
                                <i class="fas fa-ban mr-1"></i>Suspend
                            </button>
                        `}
                        <button onclick="openKickModal('${promoter.id}', '${displayName.replace(/'/g, "\\'").replace(/"/g, '&quot;')}')" 
                                class="action-btn kick-btn">
                            <i class="fas fa-user-times mr-1"></i>Kick
                        </button>
                    </div>
                    
                    <!-- Mobile Actions Menu -->
                    <div class="mobile-actions-btn md:hidden actions-menu">
                        <button onclick="toggleActionsMenu('${promoter.id}')" 
                                class="action-btn" style="background-color: #6b7280; color: white;">
                            <i class="fas fa-ellipsis-v"></i>
                        </button>
                        <div id="actions-menu-${promoter.id}" class="actions-dropdown">
                            <button onclick="viewPromoterDetails('${promoter.id}'); closeAllMenus();">
                                <i class="fas fa-eye mr-2"></i>View
                            </button>
                            <button onclick="openWarningModal('${promoter.id}', '${displayName.replace(/'/g, "\\'").replace(/"/g, '&quot;')}'); closeAllMenus();">
                                <i class="fas fa-exclamation-triangle mr-2"></i>Warn
                            </button>
                            ${isSuspended ? `
                                <button onclick="unsuspendPromoter('${promoter.id}', '${displayName.replace(/'/g, "\\'").replace(/"/g, '&quot;')}'); closeAllMenus();">
                                    <i class="fas fa-check mr-2"></i>Unsuspend
                                </button>
                            ` : `
                                <button onclick="openSuspendModal('${promoter.id}', '${displayName.replace(/'/g, "\\'").replace(/"/g, '&quot;')}'); closeAllMenus();">
                                    <i class="fas fa-ban mr-2"></i>Suspend
                                </button>
                            `}
                            <button onclick="openKickModal('${promoter.id}', '${displayName.replace(/'/g, "\\'").replace(/"/g, '&quot;')}'); closeAllMenus();">
                                <i class="fas fa-user-times mr-2"></i>Kick
                            </button>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Update Stats
function updateStats() {
    const total = allPromoters.length;
    const active = allPromoters.filter(p => !p.suspended).length;
    const suspended = allPromoters.filter(p => p.suspended === true).length;
    const totalWarnings = allPromoters.reduce((sum, p) => sum + (p.warnings || 0), 0);
    
    document.getElementById('totalPromoters').textContent = total;
    document.getElementById('activePromoters').textContent = active;
    document.getElementById('suspendedPromoters').textContent = suspended;
    document.getElementById('totalWarnings').textContent = totalWarnings;
}

// View Promoter Details
window.viewPromoterDetails = async (userId) => {
    const promoter = allPromoters.find(p => p.id === userId);
    if (!promoter) return;
    
    const firstName = promoter.firstName || '';
    const lastName = promoter.lastName || '';
    const middleName = promoter.middleName || '';
    const fullName = `${firstName} ${middleName} ${lastName}`.trim() || 'Unknown User';
    const displayName = `${firstName} ${lastName}`.trim() || 'Unknown User';
    const profilePic = promoter.profilePicture || 
        `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=f59e0b&color=000&size=200`;
    
    const genderIcon = promoter.gender === 'male' ? '<i class="fas fa-mars text-blue-500"></i>' :
                       promoter.gender === 'female' ? '<i class="fas fa-venus text-pink-500"></i>' : '';
    const genderText = promoter.gender === 'male' ? 'Male' : promoter.gender === 'female' ? 'Female' : 'Not specified';
    
    // Fetch promoter's posts/tasks
    let postsHTML = '';
    try {
        const postsRef = collection(db, 'posts');
        const postsQuery = query(postsRef, where('userId', '==', userId));
        const postsSnapshot = await getDocs(postsQuery);
        
        if (postsSnapshot.empty) {
            postsHTML = `
                <div class="no-screenshots">
                    <i class="fas fa-images"></i>
                    <p class="text-lg">No submitted tasks yet</p>
                </div>
            `;
        } else {
            const posts = postsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const screenshots = [];
            
            posts.forEach(post => {
                if (post.imageUrl) {
                    screenshots.push({
                        url: post.imageUrl,
                        description: post.description || 'No description',
                        timestamp: post.timestamp || post.createdAt || 'Unknown date',
                        postId: post.id
                    });
                }
            });
            
            if (screenshots.length === 0) {
                postsHTML = `
                    <div class="no-screenshots">
                        <i class="fas fa-images"></i>
                        <p class="text-lg">No screenshots in submitted tasks</p>
                    </div>
                `;
            } else {
                postsHTML = `
                    <div class="screenshot-grid">
                        ${screenshots.map((screenshot, index) => `
                            <div class="screenshot-item" onclick="openLightbox(${index}, '${userId}')">
                                <img src="${screenshot.url}" alt="Task screenshot" loading="lazy">
                                <div class="screenshot-overlay">
                                    <i class="fas fa-search-plus text-white text-2xl"></i>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <p class="text-gray-400 text-sm mt-3">
                        <i class="fas fa-info-circle mr-1"></i>
                        Click on any screenshot to view in full size
                    </p>
                `;
                
                // Store screenshots data for lightbox
                window.currentScreenshots = screenshots;
            }
        }
    } catch (error) {
        console.error('Error fetching posts:', error);
        postsHTML = `
            <div class="no-screenshots">
                <i class="fas fa-exclamation-triangle text-red-500"></i>
                <p class="text-lg">Error loading screenshots</p>
            </div>
        `;
    }
    
    const modalHTML = `
        <div id="viewPromoterModal" class="modal active">
            <div class="bg-gray-800 rounded-lg p-8 max-w-2xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
                <div class="flex justify-between items-start mb-6">
                    <h3 class="text-2xl font-bold text-white">
                        <i class="fas fa-user-circle text-amber-500 mr-2"></i>Promoter Details
                    </h3>
                    <button onclick="closeViewModal()" class="text-gray-400 hover:text-white text-2xl">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="space-y-6">
                    <!-- Profile Picture -->
                    <div class="text-center">
                        <img src="${profilePic}" alt="${displayName}" 
                             class="w-32 h-32 rounded-full object-cover mx-auto border-4 border-amber-500">
                    </div>
                    
                    <!-- Personal Information -->
                    <div class="bg-gray-900 rounded-lg p-6">
                        <h4 class="text-amber-500 font-semibold mb-4 flex items-center gap-2">
                            <i class="fas fa-user"></i> Personal Information
                        </h4>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <p class="text-gray-400 text-sm">Full Name</p>
                                <p class="text-white font-semibold">${fullName}</p>
                            </div>
                            <div>
                                <p class="text-gray-400 text-sm">Gender</p>
                                <p class="text-white font-semibold">${genderIcon} ${genderText}</p>
                            </div>
                            <div>
                                <p class="text-gray-400 text-sm">Email</p>
                                <p class="text-white font-semibold">${promoter.email || 'N/A'}</p>
                            </div>
                            <div>
                                <p class="text-gray-400 text-sm">Contact Number</p>
                                <p class="text-white font-semibold">${promoter.contactNumber || 'N/A'}</p>
                            </div>
                            <div class="col-span-2">
                                <p class="text-gray-400 text-sm">Address</p>
                                <p class="text-white font-semibold">${promoter.address || 'N/A'}</p>
                            </div>
                            <div>
                                <p class="text-gray-400 text-sm">Birthdate</p>
                                <p class="text-white font-semibold">${promoter.birthdate || 'N/A'}</p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Facebook Links -->
                    <div class="bg-gray-900 rounded-lg p-6">
                        <h4 class="text-amber-500 font-semibold mb-4 flex items-center gap-2">
                            <i class="fab fa-facebook"></i> Facebook Links
                        </h4>
                        <div class="space-y-3">
                            <div>
                                <p class="text-gray-400 text-sm">Primary Facebook</p>
                                <a href="${promoter.primaryFbLink || '#'}" target="_blank" 
                                   class="text-blue-400 hover:text-blue-300 break-all">
                                    ${promoter.primaryFbLink || 'Not provided'}
                                </a>
                            </div>
                            <div>
                                <p class="text-gray-400 text-sm">Promoter Facebook</p>
                                <a href="${promoter.promoterFbLink || '#'}" target="_blank" 
                                   class="text-blue-400 hover:text-blue-300 break-all">
                                    ${promoter.promoterFbLink || 'Not provided'}
                                </a>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Performance Stats -->
                    <div class="bg-gray-900 rounded-lg p-6">
                        <h4 class="text-amber-500 font-semibold mb-4 flex items-center gap-2">
                            <i class="fas fa-chart-line"></i> Performance Stats
                        </h4>
                        <div class="grid grid-cols-3 gap-4">
                            <div class="text-center">
                                <p class="text-gray-400 text-sm">Total Points</p>
                                <p class="text-2xl font-bold text-amber-500">${promoter.points || 0}</p>
                            </div>
                            <div class="text-center">
                                <p class="text-gray-400 text-sm">Total Posts</p>
                                <p class="text-2xl font-bold text-white">${promoter.postCount || 0}</p>
                            </div>
                            <div class="text-center">
                                <p class="text-gray-400 text-sm">Warnings</p>
                                <p class="text-2xl font-bold ${(promoter.warnings || 0) > 0 ? 'text-red-500' : 'text-white'}">${promoter.warnings || 0}</p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Status -->
                    <div class="bg-gray-900 rounded-lg p-6">
                        <h4 class="text-amber-500 font-semibold mb-4 flex items-center gap-2">
                            <i class="fas fa-info-circle"></i> Account Status
                        </h4>
                        <div>
                            <p class="text-gray-400 text-sm">Current Status</p>
                            <p class="text-white font-semibold">
                                <span class="status-badge ${promoter.suspended ? 'status-suspended' : 'status-active'}">
                                    ${promoter.suspended ? 'Suspended' : 'Active'}
                                </span>
                            </p>
                        </div>
                    </div>
                    
                    <!-- Submitted Tasks Screenshots -->
                    <div class="bg-gray-900 rounded-lg p-6">
                        <h4 class="text-amber-500 font-semibold mb-4 flex items-center gap-2">
                            <i class="fas fa-images"></i> Submitted Tasks Screenshots
                        </h4>
                        ${postsHTML}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
};

window.closeViewModal = () => {
    const modal = document.getElementById('viewPromoterModal');
    if (modal) {
        modal.remove();
    }
};

// Warning Modal Functions
window.openWarningModal = (userId, userName) => {
    currentPromoter = userId;
    document.getElementById('warningPromoterName').textContent = userName;
    document.getElementById('warningMessage').value = '';
    document.getElementById('warningModal').classList.add('active');
};

document.getElementById('cancelWarningBtn').addEventListener('click', () => {
    document.getElementById('warningModal').classList.remove('active');
});

document.getElementById('sendWarningBtn').addEventListener('click', async () => {
    const message = document.getElementById('warningMessage').value.trim();
    
    if (!message) {
        alert('Please enter a warning message.');
        return;
    }
    
    try {
        const userRef = doc(db, 'users', currentPromoter);
        await updateDoc(userRef, {
            warnings: increment(1),
            lastWarning: {
                message: message,
                timestamp: new Date().toISOString()
            }
        });
        
        document.getElementById('warningModal').classList.remove('active');
        alert('Warning sent successfully!');
        loadPromoters();
    } catch (error) {
        console.error('Error sending warning:', error);
        alert('Failed to send warning. Please try again.');
    }
});

// Suspend Modal Functions
window.openSuspendModal = (userId, userName) => {
    currentPromoter = userId;
    document.getElementById('suspendPromoterName').textContent = userName;
    document.getElementById('suspendModal').classList.add('active');
};

document.getElementById('cancelSuspendBtn').addEventListener('click', () => {
    document.getElementById('suspendModal').classList.remove('active');
});

document.getElementById('confirmSuspendBtn').addEventListener('click', async () => {
    const duration = parseInt(document.getElementById('suspendDuration').value);
    
    try {
        const suspendedUntil = new Date();
        suspendedUntil.setDate(suspendedUntil.getDate() + duration);
        
        const userRef = doc(db, 'users', currentPromoter);
        await updateDoc(userRef, {
            suspended: true,
            suspendedUntil: suspendedUntil.toISOString()
        });
        
        document.getElementById('suspendModal').classList.remove('active');
        alert(`Promoter suspended for ${duration} day(s)!`);
        loadPromoters();
    } catch (error) {
        console.error('Error suspending promoter:', error);
        alert('Failed to suspend promoter. Please try again.');
    }
});

// Unsuspend Promoter Function
window.unsuspendPromoter = async (userId, userName) => {
    if (confirm(`Are you sure you want to unsuspend ${userName}?`)) {
        try {
            const userRef = doc(db, 'users', userId);
            await updateDoc(userRef, {
                suspended: false,
                suspendedUntil: null
            });
            
            alert(`${userName} has been unsuspended!`);
            loadPromoters();
        } catch (error) {
            console.error('Error unsuspending promoter:', error);
            alert('Failed to unsuspend promoter. Please try again.');
        }
    }
};

// Kick Modal Functions
window.openKickModal = (userId, userName) => {
    currentPromoter = userId;
    document.getElementById('kickPromoterName').textContent = userName;
    document.getElementById('kickModal').classList.add('active');
};

document.getElementById('cancelKickBtn').addEventListener('click', () => {
    document.getElementById('kickModal').classList.remove('active');
});

document.getElementById('confirmKickBtn').addEventListener('click', async () => {
    try {
        // Delete all posts by this promoter
        const postsRef = collection(db, 'posts');
        const postsQuery = query(postsRef, where('userId', '==', currentPromoter));
        const postsSnapshot = await getDocs(postsQuery);
        
        const deletePromises = postsSnapshot.docs.map(postDoc => deleteDoc(doc(db, 'posts', postDoc.id)));
        await Promise.all(deletePromises);
        
        // Delete notifications related to this promoter
        const notificationsRef = collection(db, 'notifications');
        const notificationsQuery = query(notificationsRef, where('userId', '==', currentPromoter));
        const notificationsSnapshot = await getDocs(notificationsQuery);
        const notificationPromises = notificationsSnapshot.docs.map(notifDoc => deleteDoc(doc(db, 'notifications', notifDoc.id)));
        await Promise.all(notificationPromises);
        
        // Delete Google account if exists
        try {
            await deleteDoc(doc(db, 'googleAccounts', currentPromoter));
        } catch (e) {
            console.log('No Google account to delete or error:', e);
        }
        
        // Delete the user
        await deleteDoc(doc(db, 'users', currentPromoter));
        
        document.getElementById('kickModal').classList.remove('active');
        alert('Promoter has been kicked successfully!');
        loadPromoters();
    } catch (error) {
        console.error('Error kicking promoter:', error);
        alert('Failed to kick promoter. Please try again.');
    }
});

// Search and Filter Event Listeners
document.getElementById('searchInput').addEventListener('input', displayPromoters);
document.getElementById('statusFilter').addEventListener('change', displayPromoters);
document.getElementById('genderFilter').addEventListener('change', displayPromoters);
document.getElementById('sortBy').addEventListener('change', displayPromoters);

// Logout
document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
        await signOut(auth);
        localStorage.clear();
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Error signing out:', error);
    }
});

// Mobile Actions Menu Functions
window.toggleActionsMenu = (promoterId) => {
    const menu = document.getElementById(`actions-menu-${promoterId}`);
    const allMenus = document.querySelectorAll('.actions-dropdown');
    
    // Close all other menus
    allMenus.forEach(m => {
        if (m.id !== `actions-menu-${promoterId}`) {
            m.classList.remove('active');
        }
    });
    
    // Toggle current menu
    menu.classList.toggle('active');
};

window.closeAllMenus = () => {
    const allMenus = document.querySelectorAll('.actions-dropdown');
    allMenus.forEach(m => m.classList.remove('active'));
};

// Close menus when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.actions-menu')) {
        closeAllMenus();
    }
});

// Lightbox functionality for screenshots
let currentLightboxIndex = 0;
window.currentScreenshots = [];

window.openLightbox = (index, userId) => {
    currentLightboxIndex = index;
    
    // Create lightbox if it doesn't exist
    if (!document.getElementById('screenshotLightbox')) {
        const lightboxHTML = `
            <div id="screenshotLightbox" class="lightbox">
                <div class="lightbox-content">
                    <button class="lightbox-close" onclick="closeLightbox()">
                        <i class="fas fa-times"></i> Close
                    </button>
                    <button class="lightbox-nav lightbox-prev" onclick="navigateLightbox(-1)">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <img id="lightboxImage" class="lightbox-image" src="" alt="Screenshot">
                    <button class="lightbox-nav lightbox-next" onclick="navigateLightbox(1)">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                    <div class="lightbox-info">
                        <p id="lightboxDescription" class="font-semibold mb-1"></p>
                        <p id="lightboxTimestamp" class="text-sm text-gray-400"></p>
                        <p id="lightboxCounter" class="text-sm text-amber-500 mt-2"></p>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', lightboxHTML);
    }
    
    // Show the image AFTER creating the lightbox
    showLightboxImage();
    
    // Then make it visible
    document.getElementById('screenshotLightbox').classList.add('active');
};

window.closeLightbox = () => {
    const lightbox = document.getElementById('screenshotLightbox');
    if (lightbox) {
        lightbox.classList.remove('active');
    }
};

window.navigateLightbox = (direction) => {
    currentLightboxIndex += direction;
    
    // Loop around
    if (currentLightboxIndex < 0) {
        currentLightboxIndex = window.currentScreenshots.length - 1;
    } else if (currentLightboxIndex >= window.currentScreenshots.length) {
        currentLightboxIndex = 0;
    }
    
    showLightboxImage();
};

function showLightboxImage() {
    if (!window.currentScreenshots || window.currentScreenshots.length === 0) return;
    
    const screenshot = window.currentScreenshots[currentLightboxIndex];
    const lightboxImage = document.getElementById('lightboxImage');
    const lightboxDescription = document.getElementById('lightboxDescription');
    const lightboxTimestamp = document.getElementById('lightboxTimestamp');
    const lightboxCounter = document.getElementById('lightboxCounter');
    
    if (lightboxImage) lightboxImage.src = screenshot.url;
    if (lightboxDescription) lightboxDescription.textContent = screenshot.description;
    if (lightboxTimestamp) {
        const timestamp = screenshot.timestamp;
        let dateStr = 'Unknown date';
        
        if (timestamp) {
            try {
                const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
                dateStr = date.toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            } catch (e) {
                console.error('Error parsing date:', e);
            }
        }
        
        lightboxTimestamp.textContent = dateStr;
    }
    if (lightboxCounter) {
        lightboxCounter.textContent = `Screenshot ${currentLightboxIndex + 1} of ${window.currentScreenshots.length}`;
    }
    
    // Show/hide navigation buttons
    const prevBtn = document.querySelector('.lightbox-prev');
    const nextBtn = document.querySelector('.lightbox-next');
    
    if (window.currentScreenshots.length <= 1) {
        if (prevBtn) prevBtn.style.display = 'none';
        if (nextBtn) nextBtn.style.display = 'none';
    } else {
        if (prevBtn) prevBtn.style.display = 'block';
        if (nextBtn) nextBtn.style.display = 'block';
    }
}

// Keyboard navigation for lightbox
document.addEventListener('keydown', (e) => {
    const lightbox = document.getElementById('screenshotLightbox');
    if (lightbox && lightbox.classList.contains('active')) {
        if (e.key === 'Escape') {
            closeLightbox();
        } else if (e.key === 'ArrowLeft') {
            navigateLightbox(-1);
        } else if (e.key === 'ArrowRight') {
            navigateLightbox(1);
        }
    }
});
