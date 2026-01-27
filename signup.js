// Signup Page JavaScript
import { auth, db, createUserWithEmailAndPassword, doc, setDoc, Timestamp } from './firebase-config.js';

// Helper function to capitalize first letter
function capitalizeFirstLetter(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// Auto-capitalize name fields on input
document.getElementById('firstName')?.addEventListener('input', function(e) {
    const cursorPos = e.target.selectionStart;
    e.target.value = capitalizeFirstLetter(e.target.value);
    e.target.setSelectionRange(cursorPos, cursorPos);
});

document.getElementById('middleName')?.addEventListener('input', function(e) {
    const cursorPos = e.target.selectionStart;
    e.target.value = capitalizeFirstLetter(e.target.value);
    e.target.setSelectionRange(cursorPos, cursorPos);
});

document.getElementById('lastName')?.addEventListener('input', function(e) {
    const cursorPos = e.target.selectionStart;
    e.target.value = capitalizeFirstLetter(e.target.value);
    e.target.setSelectionRange(cursorPos, cursorPos);
});

// Signup Form Handler
const signupForm = document.getElementById('signupForm');
if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Get form values with capitalization
        const firstName = capitalizeFirstLetter(document.getElementById('firstName').value.trim());
        const middleName = capitalizeFirstLetter(document.getElementById('middleName').value.trim());
        const lastName = capitalizeFirstLetter(document.getElementById('lastName').value.trim());
        const birthdate = document.getElementById('birthdate').value;
        const address = document.getElementById('address').value.trim();
        const contactNumber = document.getElementById('contactNumber').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const agreeTerms = document.getElementById('agreeTerms').checked;
        
        // Validation
        if (!agreeTerms) {
            alert('Please agree to the Terms and Conditions');
            return;
        }
        
        if (password !== confirmPassword) {
            alert('Passwords do not match');
            return;
        }
        
        if (password.length < 6) {
            alert('Password must be at least 6 characters');
            return;
        }
        
        // Validate age (must be 18+)
        const birthdateObj = new Date(birthdate);
        const today = new Date();
        let age = today.getFullYear() - birthdateObj.getFullYear();
        const monthDiff = today.getMonth() - birthdateObj.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthdateObj.getDate())) {
            age--;
        }
        if (age < 18) {
            alert('You must be at least 18 years old to sign up');
            return;
        }
        
        const submitBtn = signupForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        
        try {
            submitBtn.textContent = 'Creating account...';
            submitBtn.disabled = true;
            
            console.log('→ Creating Firebase Authentication account...');
            
            // Create user in Firebase Authentication
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            console.log('✓ Authentication account created:', user.uid);
            console.log('→ Creating Firestore user document...');
            
            // Create user document in Firestore with all details
            const fullName = middleName 
                ? `${firstName} ${middleName} ${lastName}`
                : `${firstName} ${lastName}`;
            
            await setDoc(doc(db, 'users', user.uid), {
                // Personal Information
                firstName: firstName,
                middleName: middleName || '',
                lastName: lastName,
                fullName: fullName,
                birthdate: birthdate,
                address: address,
                contactNumber: contactNumber,
                
                // Account Information
                email: email,
                isAdmin: false, // Default is promoter (not admin)
                
                // Metadata
                createdAt: Timestamp.now(),
                createdBy: 'signup_form',
                
                // Additional fields
                photoURL: '',
                points: 0,
                totalApprovedPosts: 0
            });
            
            console.log('✓ User document created in Firestore');
            console.log('✓ Full Name:', fullName);
            console.log('✓ Email:', email);
            console.log('✓ isAdmin: false');
            
            // Success message
            alert('Account created successfully! You will now be redirected to your dashboard.');
            
            // Redirect to promoter dashboard (new users are promoters by default)
            localStorage.setItem('userRole', 'promoter');
            window.location.href = 'promoter-dashboard.html';
            
        } catch (error) {
            console.error('✗ Signup error:', error);
            
            // Handle specific errors
            let errorMessage = 'Sign up failed: ';
            switch (error.code) {
                case 'auth/email-already-in-use':
                    errorMessage += 'This email is already registered. Please sign in instead.';
                    break;
                case 'auth/invalid-email':
                    errorMessage += 'Invalid email address.';
                    break;
                case 'auth/weak-password':
                    errorMessage += 'Password is too weak. Use at least 6 characters.';
                    break;
                case 'auth/network-request-failed':
                    errorMessage += 'Network error. Please check your connection.';
                    break;
                default:
                    errorMessage += error.message;
            }
            
            alert(errorMessage);
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });
}

// Format phone number as user types
const contactNumberInput = document.getElementById('contactNumber');
if (contactNumberInput) {
    contactNumberInput.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, ''); // Remove non-digits
        
        // Format: +63 912 345 6789
        if (value.startsWith('63')) {
            value = value.substring(2); // Remove 63 prefix if user types it
        }
        
        if (value.length > 0) {
            if (value.length <= 3) {
                e.target.value = '+63 ' + value;
            } else if (value.length <= 6) {
                e.target.value = '+63 ' + value.substring(0, 3) + ' ' + value.substring(3);
            } else {
                e.target.value = '+63 ' + value.substring(0, 3) + ' ' + value.substring(3, 6) + ' ' + value.substring(6, 10);
            }
        }
    });
}
