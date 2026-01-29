// Promoter Dashboard JavaScript
import { auth, db, signOut, onAuthStateChanged, collection, addDoc, getDocs, getDoc, query, where, orderBy, Timestamp, doc, updateDoc } from './firebase-config.js';

let currentUser = null;
let currentUserData = null;
const isDemoMode = localStorage.getItem('demoMode') === 'true';
let uploadedScreenshots = []; // Will store File objects instead of URLs
let screenshotPreviewUrls = []; // Local blob URLs for preview
const MAX_SCREENSHOTS = 10;

// Cloudinary configuration
const CLOUDINARY_CLOUD_NAME = 'dy9tkp58u';
const CLOUDINARY_UPLOAD_PRESET = 'pastryvapors_preset';

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
        loadAnnouncements();
        calculateStreak();
    } else {
        loadDemoData();
    }
});

// Screenshot upload handlers
const screenshotDropZone = document.getElementById('screenshotDropZone');
const screenshotInput = document.getElementById('screenshotInput');
const screenshotPreview = document.getElementById('screenshotPreview');
const screenshotCount = document.getElementById('screenshotCount');

screenshotDropZone?.addEventListener('click', () => {
    screenshotInput.click();
});

screenshotInput?.addEventListener('change', handleScreenshotUpload);

screenshotDropZone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    screenshotDropZone.classList.add('border-amber-500');
});

screenshotDropZone?.addEventListener('dragleave', () => {
    screenshotDropZone.classList.remove('border-amber-500');
});

screenshotDropZone?.addEventListener('drop', (e) => {
    e.preventDefault();
    screenshotDropZone.classList.remove('border-amber-500');
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    handleScreenshotFiles(files);
});

async function handleScreenshotUpload(e) {
    const files = Array.from(e.target.files);
    await handleScreenshotFiles(files);
}

async function handleScreenshotFiles(files) {
    const remainingSlots = MAX_SCREENSHOTS - uploadedScreenshots.length;
    const filesToUpload = files.slice(0, remainingSlots);
    
    if (files.length > remainingSlots) {
        alert(`You can only upload ${remainingSlots} more screenshot(s). Maximum is ${MAX_SCREENSHOTS}.`);
    }
    
    // Just store files locally, don't upload yet
    for (const file of filesToUpload) {
        if (uploadedScreenshots.length >= MAX_SCREENSHOTS) break;
        
        // Store the file object
        uploadedScreenshots.push(file);
        
        // Create local preview URL
        const previewUrl = URL.createObjectURL(file);
        screenshotPreviewUrls.push(previewUrl);
    }
    
    updateScreenshotPreview();
}

// Compress image using canvas
async function compressImage(file, maxSizeMB = 5, maxWidthOrHeight = 1920, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const img = new Image();
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Calculate new dimensions
                let width = img.width;
                let height = img.height;
                
                if (width > height) {
                    if (width > maxWidthOrHeight) {
                        height = (height * maxWidthOrHeight) / width;
                        width = maxWidthOrHeight;
                    }
                } else {
                    if (height > maxWidthOrHeight) {
                        width = (width * maxWidthOrHeight) / height;
                        height = maxWidthOrHeight;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                
                // Draw and compress
                ctx.drawImage(img, 0, 0, width, height);
                
                // Convert to blob with quality adjustment
                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            // If still too large, reduce quality further
                            if (blob.size > maxSizeMB * 1024 * 1024 && quality > 0.3) {
                                compressImage(file, maxSizeMB, maxWidthOrHeight, quality - 0.1)
                                    .then(resolve)
                                    .catch(reject);
                            } else {
                                resolve(blob);
                            }
                        } else {
                            reject(new Error('Failed to compress image'));
                        }
                    },
                    'image/jpeg',
                    quality
                );
            };
            
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = e.target.result;
        };
        
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

function updateScreenshotPreview() {
    screenshotPreview.innerHTML = screenshotPreviewUrls.map((url, index) => `
        <div class="relative group">
            <img 
                src="${url}" 
                alt="Screenshot ${index + 1}" 
                class="w-full h-20 object-cover rounded-lg cursor-pointer hover:opacity-80 transition"
                onclick="viewScreenshot(${index})"
            >
            <button 
                type="button"
                onclick="event.stopPropagation(); removeScreenshot(${index})"
                class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
            >
                <i class="fas fa-times text-xs"></i>
            </button>
        </div>
    `).join('');
    
    screenshotCount.textContent = `${uploadedScreenshots.length}/${MAX_SCREENSHOTS} screenshots`;
}

window.removeScreenshot = function(index) {
    // Revoke the blob URL to free memory
    URL.revokeObjectURL(screenshotPreviewUrls[index]);
    
    uploadedScreenshots.splice(index, 1);
    screenshotPreviewUrls.splice(index, 1);
    updateScreenshotPreview();
};

// Clear all screenshots
window.clearAllScreenshots = function() {
    // Revoke all blob URLs to free memory
    screenshotPreviewUrls.forEach(url => URL.revokeObjectURL(url));
    
    uploadedScreenshots = [];
    screenshotPreviewUrls = [];
    updateScreenshotPreview();
};

// Screenshot viewer for uploaded images
let currentViewIndex = 0;

window.viewScreenshot = function(index) {
    currentViewIndex = index;
    const modal = document.getElementById('screenshotViewerModal');
    
    if (!modal) {
        createScreenshotViewerModal();
    }
    
    updateScreenshotViewer();
    document.getElementById('screenshotViewerModal').classList.remove('hidden');
};

function createScreenshotViewerModal() {
    const modal = document.createElement('div');
    modal.id = 'screenshotViewerModal';
    modal.className = 'fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center hidden';
    modal.innerHTML = `
        <div class="relative w-full h-full flex items-center justify-center p-4">
            <button 
                onclick="document.getElementById('screenshotViewerModal').classList.add('hidden')"
                class="absolute top-4 right-4 bg-red-500 hover:bg-red-600 text-white rounded-full w-12 h-12 flex items-center justify-center transition z-10"
            >
                <i class="fas fa-times text-xl"></i>
            </button>
            
            <button 
                onclick="previousScreenshot()"
                class="absolute left-4 bg-gray-800/80 hover:bg-gray-700 text-white rounded-full w-12 h-12 flex items-center justify-center transition"
            >
                <i class="fas fa-chevron-left text-xl"></i>
            </button>
            
            <div class="max-w-5xl max-h-full flex flex-col items-center">
                <img 
                    id="viewerImage" 
                    src="" 
                    alt="Screenshot" 
                    class="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
                >
                <div class="mt-4 bg-gray-800/80 px-6 py-3 rounded-full">
                    <p class="text-white font-semibold" id="viewerCounter">1 / 1</p>
                </div>
            </div>
            
            <button 
                onclick="nextScreenshot()"
                class="absolute right-4 bg-gray-800/80 hover:bg-gray-700 text-white rounded-full w-12 h-12 flex items-center justify-center transition"
            >
                <i class="fas fa-chevron-right text-xl"></i>
            </button>
        </div>
    `;
    document.body.appendChild(modal);
}

function updateScreenshotViewer() {
    const img = document.getElementById('viewerImage');
    const counter = document.getElementById('viewerCounter');
    
    if (img && counter && screenshotPreviewUrls.length > 0) {
        img.src = screenshotPreviewUrls[currentViewIndex];
        counter.textContent = `${currentViewIndex + 1} / ${screenshotPreviewUrls.length}`;
    }
}

window.previousScreenshot = function() {
    if (currentViewIndex > 0) {
        currentViewIndex--;
        updateScreenshotViewer();
    }
};

window.nextScreenshot = function() {
    if (currentViewIndex < screenshotPreviewUrls.length - 1) {
        currentViewIndex++;
        updateScreenshotViewer();
    }
};

// Keyboard navigation for screenshot viewer
document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('screenshotViewerModal');
    if (modal && !modal.classList.contains('hidden')) {
        if (e.key === 'ArrowLeft') {
            window.previousScreenshot();
        } else if (e.key === 'ArrowRight') {
            window.nextScreenshot();
        } else if (e.key === 'Escape') {
            modal.classList.add('hidden');
        }
    }
});

// Loading overlay functions
function showLoadingOverlay(message = 'Loading...') {
    let overlay = document.getElementById('loadingOverlay');
    
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loadingOverlay';
        overlay.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center';
        overlay.innerHTML = `
            <div class="bg-gray-900 rounded-2xl p-8 max-w-sm mx-4 text-center border border-amber-500/30">
                <div class="mb-4">
                    <div class="inline-block animate-spin rounded-full h-16 w-16 border-4 border-gray-700 border-t-amber-500"></div>
                </div>
                <p class="text-white text-lg font-semibold" id="loadingMessage">${message}</p>
            </div>
        `;
        document.body.appendChild(overlay);
    } else {
        document.getElementById('loadingMessage').textContent = message;
        overlay.classList.remove('hidden');
    }
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
}

// Check user suspension status
// Check if user profile is complete
function isProfileComplete(userData) {
    if (!userData) return false;
    
    const requiredFields = [
        'firstName',
        'lastName',
        'email',
        'birthdate',
        'address',
        'contactNumber',
        'gender',
        'primaryFbLink',
        'profilePicture'
    ];
    
    for (const field of requiredFields) {
        if (!userData[field] || userData[field].trim() === '') {
            return false;
        }
    }
    
    // Check if profile picture is not a placeholder
    if (userData.profilePicture && 
        (userData.profilePicture.includes('placeholder') || 
         userData.profilePicture.includes('ui-avatars.com'))) {
        return false;
    }
    
    return true;
}

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
        // Check if warning is minimized
        const minimizedWarnings = JSON.parse(localStorage.getItem('minimizedWarnings') || '[]');
        const warningId = lastWarning.timestamp || Date.now();
        
        if (minimizedWarnings.includes(warningId.toString())) {
            return; // Don't show if minimized
        }
        
        const warningBanner = document.createElement('div');
        warningBanner.id = `warning-${warningId}`;
        warningBanner.className = 'col-span-full bg-yellow-500/20 border border-yellow-500 rounded-lg p-4 mb-4';
        warningBanner.innerHTML = `
            <div class="flex items-start gap-3">
                <i class="fas fa-exclamation-triangle text-yellow-500 text-2xl"></i>
                <div class="flex-1">
                    <h3 class="text-yellow-500 font-bold mb-1">Warning Notice (${warningCount} total)</h3>
                    <p class="text-white">${lastWarning.message}</p>
                    <p class="text-gray-400 text-sm mt-2">${new Date(lastWarning.timestamp).toLocaleString()}</p>
                </div>
                <button onclick="minimizeWarning('${warningId}')" class="text-white/50 hover:text-white transition-colors ml-2">
                    <i class="fas fa-times text-xl"></i>
                </button>
            </div>
        `;
        statsCards.insertBefore(warningBanner, statsCards.firstChild);
    }
}

// Minimize warning
window.minimizeWarning = function(warningId) {
    // Get current minimized list
    const minimizedWarnings = JSON.parse(localStorage.getItem('minimizedWarnings') || '[]');
    
    // Add this warning if not already minimized
    if (!minimizedWarnings.includes(warningId.toString())) {
        minimizedWarnings.push(warningId.toString());
        localStorage.setItem('minimizedWarnings', JSON.stringify(minimizedWarnings));
    }
    
    // Remove from DOM with animation
    const element = document.getElementById(`warning-${warningId}`);
    if (element) {
        element.style.transition = 'opacity 0.3s, transform 0.3s';
        element.style.opacity = '0';
        element.style.transform = 'translateX(100%)';
        setTimeout(() => {
            element.remove();
        }, 300);
    }
};

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
        
        // Check if profile is complete
        if (!isProfileComplete(currentUserData)) {
            alert('Please complete your profile before submitting tasks. Go to your User Profile and fill in all required fields including profile picture.');
            return;
        }
        
        const platform = document.getElementById('selectedPlatform').value;
        const postUrl = document.getElementById('postUrlInput').value;
        const taskType = document.getElementById('selectedTaskType').value;
        let taskPoints = parseInt(document.getElementById('taskPoints').value);
        
        console.log('📤 Submitting:', { taskType, postUrl, screenshots: uploadedScreenshots.length });
        
        // Validate based on task type
        if (taskType === 'hand-check' || taskType === 'video-content') {
            // URL-based tasks: require valid URL, ignore screenshots
            if (!postUrl || !isValidUrl(postUrl, platform)) {
                alert(`Please enter a valid ${platform} URL`);
                return;
            }
        } else if (taskType === 'group-share' || taskType === 'hype-comment') {
            // Screenshot-based tasks: require screenshots, ignore URL
            if (uploadedScreenshots.length === 0) {
                alert('Please upload at least one screenshot for this task type');
                return;
            }
            // Calculate points based on screenshots
            taskPoints = uploadedScreenshots.length; // 1 point per picture
        }
        
        // Show loading
        showLoadingOverlay('Submitting your post...');
        
        try {
            // Upload screenshots to Cloudinary if any
            let uploadedUrls = [];
            if (uploadedScreenshots.length > 0) {
                showLoadingOverlay(`Uploading screenshots (0/${uploadedScreenshots.length})...`);
                
                for (let i = 0; i < uploadedScreenshots.length; i++) {
                    const file = uploadedScreenshots[i];
                    
                    try {
                        // Compress image before uploading
                        console.log('🗜️ Compressing image:', file.name, 'Original size:', (file.size / 1024 / 1024).toFixed(2), 'MB');
                        showLoadingOverlay(`Compressing screenshot ${i + 1}/${uploadedScreenshots.length}...`);
                        
                        const compressedBlob = await compressImage(file);
                        console.log('✅ Compressed size:', (compressedBlob.size / 1024 / 1024).toFixed(2), 'MB');
                        
                        const formData = new FormData();
                        formData.append('file', compressedBlob, file.name);
                        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
                        
                        showLoadingOverlay(`Uploading screenshot ${i + 1}/${uploadedScreenshots.length}...`);
                        console.log('📤 Uploading screenshot to Cloudinary...');
                        
                        const response = await fetch(
                            `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
                            {
                                method: 'POST',
                                body: formData
                            }
                        );
                        
                        if (!response.ok) {
                            const errorData = await response.json();
                            console.error('❌ Cloudinary error:', errorData);
                            throw new Error(errorData.error?.message || 'Upload failed');
                        }
                        
                        const data = await response.json();
                        console.log('✅ Screenshot uploaded:', data.secure_url);
                        uploadedUrls.push(data.secure_url);
                        
                    } catch (error) {
                        console.error('❌ Error uploading screenshot:', error);
                        hideLoadingOverlay();
                        alert('Failed to upload screenshot: ' + error.message);
                        return;
                    }
                }
            }
            
            showLoadingOverlay('Saving your submission...');
            
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
                    postUrl: postUrl || '',
                    taskType: taskType,
                    taskPoints: taskPoints,
                    screenshots: uploadedUrls,
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
                    taskType: taskType,
                    postUrl: postUrl || '',
                    read: false,
                    createdAt: Timestamp.now()
                });
                console.log('🔔 Notification created for admin');
            }
            
            hideLoadingOverlay();
            alert('Post submitted successfully! Admin will review it soon.');
            submitPostForm.reset();
            document.getElementById('selectedPlatform').value = 'facebook';
            document.getElementById('selectedTaskType').value = 'hand-check';
            document.getElementById('taskPoints').value = '15';
            
            // Clean up blob URLs
            screenshotPreviewUrls.forEach(url => URL.revokeObjectURL(url));
            uploadedScreenshots = [];
            screenshotPreviewUrls = [];
            updateScreenshotPreview();
            
            // Reset UI to show postUrl section
            document.getElementById('postUrlSection').style.display = 'block';
            document.getElementById('screenshotsSection').style.display = 'none';
            document.getElementById('postUrlInput').required = true;
            document.getElementById('screenshotInput').required = false;
            
            // Reload data
            if (isDemoMode) {
                loadDemoData();
            } else {
                loadPromoterData();
            }
            
        } catch (error) {
            console.error('Error submitting post:', error);
            hideLoadingOverlay();
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
        
        // Recalculate streak after loading data
        await calculateStreak();
        
        // Show daily reminder after user data is loaded
        showDailyReminder();
        
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

// Load announcements
async function loadAnnouncements() {
    try {
        const announcementsQuery = query(
            collection(db, 'announcements'),
            where('active', '==', true)
        );
        
        const snapshot = await getDocs(announcementsQuery);
        const banner = document.getElementById('announcementsBanner');
        
        if (snapshot.empty) {
            banner.innerHTML = '';
            return;
        }
        
        // Get minimized announcements from localStorage
        const minimizedAnnouncements = JSON.parse(localStorage.getItem('minimizedAnnouncements') || '[]');
        
        // Sort by createdAt in JavaScript to avoid composite index
        const announcements = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(announcement => !minimizedAnnouncements.includes(announcement.id))
            .sort((a, b) => {
                const aTime = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
                const bTime = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
                return bTime - aTime;
            });
        
        if (announcements.length === 0) {
            banner.innerHTML = '';
            return;
        }
        
        banner.innerHTML = announcements.map(announcement => {
            const data = announcement;
            const priorityColors = {
                'info': { bg: 'bg-blue-500/20', border: 'border-blue-500', text: 'text-blue-400', icon: 'fa-info-circle' },
                'warning': { bg: 'bg-yellow-500/20', border: 'border-yellow-500', text: 'text-yellow-400', icon: 'fa-exclamation-triangle' },
                'important': { bg: 'bg-red-500/20', border: 'border-red-500', text: 'text-red-400', icon: 'fa-exclamation-circle' }
            };
            const colors = priorityColors[data.priority] || priorityColors['info'];
            
            return `
                <div id="announcement-${announcement.id}" class="${colors.bg} border ${colors.border} rounded-lg p-4 mb-6">
                    <div class="flex items-start gap-3">
                        <i class="fas ${colors.icon} ${colors.text} text-2xl mt-1"></i>
                        <div class="flex-1">
                            <h4 class="font-bold ${colors.text} mb-1">${data.title}</h4>
                            <p class="text-white">${data.message}</p>
                        </div>
                        <button onclick="minimizeAnnouncement('${announcement.id}')" class="text-white/50 hover:text-white transition-colors ml-2">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading announcements:', error);
    }
}

// Minimize announcement
window.minimizeAnnouncement = function(announcementId) {
    // Get current minimized list
    const minimizedAnnouncements = JSON.parse(localStorage.getItem('minimizedAnnouncements') || '[]');
    
    // Add this announcement if not already minimized
    if (!minimizedAnnouncements.includes(announcementId)) {
        minimizedAnnouncements.push(announcementId);
        localStorage.setItem('minimizedAnnouncements', JSON.stringify(minimizedAnnouncements));
    }
    
    // Remove from DOM with animation
    const element = document.getElementById(`announcement-${announcementId}`);
    if (element) {
        element.style.transition = 'opacity 0.3s, transform 0.3s';
        element.style.opacity = '0';
        element.style.transform = 'translateX(100%)';
        setTimeout(() => {
            element.remove();
        }, 300);
    }
};

// Calculate and display streak
async function calculateStreak() {
    try {
        const postsQuery = query(
            collection(db, 'posts'),
            where('userId', '==', currentUser.uid),
            where('status', '==', 'approved')
        );
        
        const snapshot = await getDocs(postsQuery);
        // Sort by createdAt in JavaScript to avoid composite index
        const posts = snapshot.docs
            .map(doc => doc.data())
            .sort((a, b) => {
                const aTime = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
                const bTime = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
                return bTime - aTime;
            });
        
        if (posts.length === 0) {
            updateStreakDisplay(0);
            return;
        }
        
        // Group posts by date (ignore multiple posts on same day)
        const postDates = new Set();
        posts.forEach(post => {
            const postDate = post.createdAt.toDate();
            postDate.setHours(0, 0, 0, 0);
            postDates.add(postDate.getTime());
        });
        
        // Sort dates descending
        const sortedDates = Array.from(postDates).sort((a, b) => b - a);
        
        // Calculate streak
        let streak = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let expectedDate = today.getTime();
        
        for (const dateTimestamp of sortedDates) {
            if (dateTimestamp === expectedDate) {
                streak++;
                expectedDate -= 24 * 60 * 60 * 1000; // Move to previous day
            } else {
                // Found a gap in the streak
                break;
            }
        }
        
        console.log('🔥 Streak calculated:', streak, 'days');
        updateStreakDisplay(streak);
        
        // Update streak in user data
        await updateDoc(doc(db, 'users', currentUser.uid), {
            currentStreak: streak,
            lastStreakUpdate: Timestamp.now()
        });
        
    } catch (error) {
        console.error('Error calculating streak:', error);
        updateStreakDisplay(0);
    }
}

function updateStreakDisplay(days) {
    const streakDays = document.getElementById('streakDays');
    const streakMessage = document.getElementById('streakMessage');
    const streakIcon = document.getElementById('streakIcon');
    
    streakDays.textContent = days;
    
    if (days === 0) {
        streakMessage.textContent = 'Start your streak!';
        streakIcon.style.opacity = '0.3';
    } else if (days === 1) {
        streakMessage.textContent = 'Great start! Keep it up!';
        streakIcon.style.opacity = '1';
    } else if (days < 7) {
        streakMessage.textContent = `${days} days strong! 🚀`;
        streakIcon.style.opacity = '1';
    } else if (days < 30) {
        streakMessage.textContent = `Amazing streak! 🔥`;
        streakIcon.style.opacity = '1';
    } else {
        streakMessage.textContent = `Legendary streak! 👑`;
        streakIcon.style.opacity = '1';
    }
}

// Daily Reminder System
function showDailyReminder() {
    if (!currentUserData) return;
    
    const dayOfWeek = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
    const userGender = currentUserData.gender;
    
    const reminderBanner = document.getElementById('dailyReminderBanner');
    const reminderTitle = document.getElementById('reminderTitle');
    const reminderMessage = document.getElementById('reminderMessage');
    const reminderIcon = document.getElementById('reminderIcon');
    const submitDisabledOverlay = document.getElementById('submitDisabledOverlay');
    const disabledTitle = document.getElementById('disabledTitle');
    const disabledMessage = document.getElementById('disabledMessage');
    const yourSchedule = document.getElementById('yourSchedule');
    
    // Monday = 1, Tuesday = 2, Wednesday = 3, Thursday = 4, Friday = 5, Saturday = 6, Sunday = 0
    const queensDays = [1, 3, 5]; // Monday, Wednesday, Friday
    const kingsDays = [2, 4, 6];  // Tuesday, Thursday, Saturday
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayName = dayNames[dayOfWeek];
    
    let canPost = false;
    let title = '';
    let message = '';
    let icon = '';
    let schedule = '';
    
    if (userGender === 'female') {
        schedule = 'Monday, Wednesday, Friday';
        if (queensDays.includes(dayOfWeek)) {
            canPost = true;
            title = '👑 Queens Day - Post Now!';
            message = `Today is ${todayName}! Submit your posts to maintain your streak and earn points.`;
            icon = '♀️';
        } else {
            title = '🚫 Not a Queens Day';
            message = `Today is ${todayName}. Come back on Monday, Wednesday, or Friday to post!`;
            icon = '📅';
        }
    } else if (userGender === 'male') {
        schedule = 'Tuesday, Thursday, Saturday';
        if (kingsDays.includes(dayOfWeek)) {
            canPost = true;
            title = '👑 Kings Day - Post Now!';
            message = `Today is ${todayName}! Submit your posts to maintain your streak and earn points.`;
            icon = '♂️';
        } else {
            title = '🚫 Not a Kings Day';
            message = `Today is ${todayName}. Come back on Tuesday, Thursday, or Saturday to post!`;
            icon = '📅';
        }
    }
    
    // Update reminder banner
    if (reminderBanner) {
        reminderBanner.classList.remove('hidden');
        if (reminderTitle) reminderTitle.textContent = title;
        if (reminderMessage) reminderMessage.textContent = message;
        if (reminderIcon) reminderIcon.textContent = icon;
    }
    
    // Enable/disable submit form based on schedule
    if (submitDisabledOverlay && disabledMessage && yourSchedule) {
        if (!canPost) {
            submitDisabledOverlay.classList.remove('hidden');
            submitDisabledOverlay.classList.add('flex');
            if (disabledTitle) disabledTitle.textContent = title;
            disabledMessage.textContent = message;
            yourSchedule.textContent = `Your Schedule: ${schedule}`;
        } else {
            submitDisabledOverlay.classList.add('hidden');
            submitDisabledOverlay.classList.remove('flex');
        }
    }
}
