import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { doc, getDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

let currentUser = null;
let cloudinaryWidget = null;
let uploadedImageUrl = null;

// Cloudinary configuration
const CLOUDINARY_CLOUD_NAME = 'dy9tkp58u';
const CLOUDINARY_UPLOAD_PRESET = 'pastryvapors_preset'; // Use default unsigned preset for now

// Initialize Cloudinary Upload Widget
function initCloudinaryWidget() {
    cloudinaryWidget = cloudinary.createUploadWidget({
        cloudName: CLOUDINARY_CLOUD_NAME,
        uploadPreset: CLOUDINARY_UPLOAD_PRESET,
        sources: ['local', 'camera'],
        multiple: false,
        maxFiles: 1,
        maxFileSize: 5000000, // 5MB
        clientAllowedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        folder: 'pastryvapors',
        resourceType: 'image',
        cropping: true,
        croppingAspectRatio: 1,
        croppingShowDimensions: true,
        showSkipCropButton: false,
        styles: {
            palette: {
                window: "#1a1a1a",
                sourceBg: "#0a0a0a",
                windowBorder: "#F59E0B",
                tabIcon: "#F59E0B",
                inactiveTabIcon: "#666666",
                menuIcons: "#F59E0B",
                link: "#F59E0B",
                action: "#F59E0B",
                inProgress: "#EAB308",
                complete: "#10B981",
                error: "#EF4444",
                textDark: "#ffffff",
                textLight: "#cccccc"
            }
        }
    }, (error, result) => {
        if (!error && result && result.event === "success") {
            uploadedImageUrl = result.info.secure_url;
            document.getElementById('profilePicture').src = uploadedImageUrl;
            showMessage('Profile picture uploaded successfully! Click "Save Changes" to update your profile.', 'success');
        }
        if (error) {
            console.error('Cloudinary upload error:', error);
            showMessage('Error uploading image. Please try again.', 'error');
        }
    });
}

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
                uploadedImageUrl = userData.profilePicture;
            }
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        showMessage('Error loading profile data', 'error');
    }
}

// Handle profile picture upload button click
document.getElementById('uploadBtn').addEventListener('click', () => {
    if (!cloudinaryWidget) {
        initCloudinaryWidget();
    }
    cloudinaryWidget.open();
});

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
        
        // Get form values (only editable fields)
        const birthdate = document.getElementById('birthdate').value;
        const address = document.getElementById('address').value;
        const contactNumber = document.getElementById('contactNumber').value;
        const gender = document.getElementById('selectedGender').value;
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
        
        // Prepare update data (excluding name and email)
        const updateData = {
            birthdate: birthdate,
            address: address,
            contactNumber: contactNumber,
            gender: gender,
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
        
        showMessage('Profile updated successfully!', 'success');
        
        // Reload profile data
        setTimeout(() => {
            loadUserProfile();
        }, 1500);
        
    } catch (error) {
        console.error('Error updating profile:', error);
        showMessage('Error updating profile: ' + error.message, 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
    }
});

// Handle cancel button
document.getElementById('cancelBtn').addEventListener('click', () => {
    loadUserProfile(); // Reload original data
    uploadedImageUrl = null; // Reset uploaded image
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
