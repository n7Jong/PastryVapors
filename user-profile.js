import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { doc, getDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

let currentUser = null;
let uploadedImageFile = null; // Store file object instead of URL
let previewImageUrl = null; // Local preview URL

// Cloudinary configuration
const CLOUDINARY_CLOUD_NAME = 'dy9tkp58u';
const CLOUDINARY_UPLOAD_PRESET = 'pastryvapors_preset';

// Check authentication state
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        await loadUserProfile();
    } else {
        window.location.href = 'index.html';
    }
});

// Load user profile data
async function loadUserProfile() {
    try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // Populate read-only fields
            document.getElementById('firstName').value = userData.firstName || '';
            document.getElementById('middleName').value = userData.middleName || '';
            document.getElementById('lastName').value = userData.lastName || '';
            document.getElementById('email').value = userData.email || currentUser.email;
            
            // Populate editable fields
            document.getElementById('birthdate').value = userData.birthdate || '';
            document.getElementById('address').value = userData.address || '';
            document.getElementById('contactNumber').value = userData.contactNumber || '';
            
            // Populate gender
            if (userData.gender) {
                document.getElementById('selectedGender').value = userData.gender;
                // Update gender button UI
                document.querySelectorAll('.gender-btn').forEach(btn => {
                    btn.classList.remove('bg-blue-600', 'bg-pink-600', 'text-white');
                    btn.classList.add('bg-black/50', 'border', 'border-gray-600', 'text-gray-400');
                    
                    if (btn.dataset.gender === userData.gender) {
                        btn.classList.remove('bg-black/50', 'border', 'border-gray-600', 'text-gray-400');
                        if (userData.gender === 'male') {
                            btn.classList.add('bg-blue-600', 'text-white');
                        } else {
                            btn.classList.add('bg-pink-600', 'text-white');
                        }
                    }
                });
            }
            
            // Populate Facebook links
            document.getElementById('primaryFbLink').value = userData.primaryFbLink || '';
            document.getElementById('promoterFbLink').value = userData.promoterFbLink || '';
            
            // Load profile picture if exists
            if (userData.profilePicture) {
                document.getElementById('profilePicture').src = userData.profilePicture;
            }
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        showMessage('Error loading profile data', 'error');
    }
}

// Handle profile picture upload button click
document.getElementById('uploadBtn').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = handleProfilePictureSelect;
    input.click();
});

// Handle profile picture selection
async function handleProfilePictureSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showMessage('Please select an image file', 'error');
        return;
    }
    
    // Store the file
    uploadedImageFile = file;
    
    // Create local preview
    if (previewImageUrl) {
        URL.revokeObjectURL(previewImageUrl);
    }
    previewImageUrl = URL.createObjectURL(file);
    
    // Show preview
    document.getElementById('profilePicture').src = previewImageUrl;
    showMessage('Profile picture selected! Click "Save Changes" to upload.', 'success');
}

// Compress image function (same as promoter.js)
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

// Handle contact number formatting
document.getElementById('contactNumber').addEventListener('input', function(e) {
    let value = e.target.value.replace(/\D/g, '');
    
    if (!value.startsWith('63')) {
        if (value.startsWith('0')) {
            value = '63' + value.substring(1);
        } else if (value.length > 0) {
            value = '63' + value;
        }
    }
    
    if (value.length > 12) {
        value = value.substring(0, 12);
    }
    
    let formatted = '+' + value;
    
    if (value.length > 2) {
        formatted = '+63 ' + value.substring(2);
    }
    if (value.length > 5) {
        formatted = '+63 ' + value.substring(2, 5) + ' ' + value.substring(5);
    }
    if (value.length > 8) {
        formatted = '+63 ' + value.substring(2, 5) + ' ' + value.substring(5, 8) + ' ' + value.substring(8);
    }
    
    e.target.value = formatted;
});

// Handle form submission
document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const saveBtn = document.getElementById('saveBtn');
    const originalText = saveBtn.innerHTML;
    
    try {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Saving...';
        
        // Get form values (only editable fields - gender is read-only)
        const birthdate = document.getElementById('birthdate').value;
        const address = document.getElementById('address').value;
        const contactNumber = document.getElementById('contactNumber').value;
        const primaryFbLink = document.getElementById('primaryFbLink').value.trim();
        const promoterFbLink = document.getElementById('promoterFbLink').value.trim();
        
        // Validate birthdate (must be 18 years or older)
        const birthdateObj = new Date(birthdate);
        const today = new Date();
        const age = today.getFullYear() - birthdateObj.getFullYear();
        const monthDiff = today.getMonth() - birthdateObj.getMonth();
        
        if (age < 18 || (age === 18 && monthDiff < 0) || 
            (age === 18 && monthDiff === 0 && today.getDate() < birthdateObj.getDate())) {
            showMessage('You must be at least 18 years old', 'error');
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalText;
            return;
        }
        
        // Check if profile picture exists
        const currentProfilePic = document.getElementById('profilePicture').src;
        const isPlaceholder = currentProfilePic.includes('placeholder') || currentProfilePic.includes('ui-avatars.com');
        
        if (isPlaceholder && !uploadedImageFile) {
            showMessage('Please upload a profile picture before saving', 'error');
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalText;
            return;
        }
        
        let uploadedImageUrl = null;
        
        // Upload profile picture to Cloudinary if a new one was selected
        if (uploadedImageFile) {
            try {
                showLoadingOverlay('Compressing profile picture...');
                
                console.log('🗜️ Compressing profile image:', uploadedImageFile.name, 'Original size:', (uploadedImageFile.size / 1024 / 1024).toFixed(2), 'MB');
                const compressedBlob = await compressImage(uploadedImageFile);
                console.log('✅ Compressed size:', (compressedBlob.size / 1024 / 1024).toFixed(2), 'MB');
                
                showLoadingOverlay('Uploading profile picture...');
                
                const formData = new FormData();
                formData.append('file', compressedBlob, uploadedImageFile.name);
                formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
                
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
                uploadedImageUrl = data.secure_url;
                console.log('✅ Profile picture uploaded:', uploadedImageUrl);
                
            } catch (error) {
                console.error('❌ Error uploading profile picture:', error);
                hideLoadingOverlay();
                showMessage('Failed to upload profile picture: ' + error.message, 'error');
                saveBtn.disabled = false;
                saveBtn.innerHTML = originalText;
                return;
            }
        }
        
        showLoadingOverlay('Saving profile changes...');
        
        // Prepare update data (excluding name, email, and gender - gender is permanent)
        const updateData = {
            birthdate: birthdate,
            address: address,
            contactNumber: contactNumber,
            primaryFbLink: primaryFbLink,
            promoterFbLink: promoterFbLink,
            updatedAt: new Date().toISOString()
        };
        
        // Add profile picture if uploaded
        if (uploadedImageUrl) {
            updateData.profilePicture = uploadedImageUrl;
        }
        
        // Update Firestore
        await updateDoc(doc(db, 'users', currentUser.uid), updateData);
        
        hideLoadingOverlay();
        showMessage('Profile updated successfully!', 'success');
        
        // Clean up
        if (previewImageUrl) {
            URL.revokeObjectURL(previewImageUrl);
            previewImageUrl = null;
        }
        uploadedImageFile = null;
        
        // Reload profile data
        setTimeout(() => {
            loadUserProfile();
        }, 1500);
        
    } catch (error) {
        console.error('Error updating profile:', error);
        hideLoadingOverlay();
        showMessage('Error updating profile: ' + error.message, 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
    }
});

// Handle cancel button
document.getElementById('cancelBtn').addEventListener('click', () => {
    // Clean up preview URL
    if (previewImageUrl) {
        URL.revokeObjectURL(previewImageUrl);
        previewImageUrl = null;
    }
    uploadedImageFile = null;
    
    loadUserProfile(); // Reload original data
    showMessage('Changes cancelled', 'info');
});

// Handle logout
document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
        await signOut(auth);
        localStorage.clear();
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Error signing out:', error);
    }
});

// Show message function
function showMessage(message, type) {
    const messageContainer = document.getElementById('messageContainer');
    messageContainer.className = 'p-4 rounded-lg mb-4';
    
    if (type === 'success') {
        messageContainer.className += ' bg-green-500/20 border border-green-500 text-green-500';
        messageContainer.innerHTML = `<i class="fas fa-check-circle mr-2"></i>${message}`;
    } else if (type === 'error') {
        messageContainer.className += ' bg-red-500/20 border border-red-500 text-red-500';
        messageContainer.innerHTML = `<i class="fas fa-exclamation-circle mr-2"></i>${message}`;
    } else if (type === 'info') {
        messageContainer.className += ' bg-blue-500/20 border border-blue-500 text-blue-500';
        messageContainer.innerHTML = `<i class="fas fa-info-circle mr-2"></i>${message}`;
    }
    
    messageContainer.classList.remove('hidden');
    
    setTimeout(() => {
        messageContainer.classList.add('hidden');
    }, 5000);
}
