// Forgot Password Page JavaScript
import { auth } from './firebase-config.js';
import { sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// Forgot Password Form Handler
const forgotPasswordForm = document.getElementById('forgotPasswordForm');
const successMessage = document.getElementById('successMessage');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');

if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('emailInput').value.trim();
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        
        // Hide previous messages
        successMessage.classList.add('hidden');
        errorMessage.classList.add('hidden');
        
        try {
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Sending...';
            submitBtn.disabled = true;
            
            console.log('→ Sending password reset email to:', email);
            
            // Send password reset email
            await sendPasswordResetEmail(auth, email);
            
            console.log('✓ Password reset email sent successfully');
            
            // Show success message
            successMessage.classList.remove('hidden');
            
            // Clear the form
            document.getElementById('emailInput').value = '';
            
            // Optional: Redirect to login page after 5 seconds
            setTimeout(() => {
                console.log('→ Redirecting to login page...');
                window.location.href = 'index.html';
            }, 5000);
            
            submitBtn.innerHTML = '<i class="fas fa-check mr-2"></i>Email Sent!';
            submitBtn.disabled = false;
            
        } catch (error) {
            console.error('✗ Password reset error:', error);
            console.error('→ Error code:', error.code);
            console.error('→ Error message:', error.message);
            
            // Handle specific errors
            let errorMessageText = '';
            switch (error.code) {
                case 'auth/user-not-found':
                    errorMessageText = 'No account found with this email address.';
                    break;
                case 'auth/invalid-email':
                    errorMessageText = 'Invalid email address format.';
                    break;
                case 'auth/too-many-requests':
                    errorMessageText = 'Too many attempts. Please try again later.';
                    break;
                case 'auth/network-request-failed':
                    errorMessageText = 'Network error. Please check your connection.';
                    break;
                default:
                    errorMessageText = error.message || 'Failed to send reset email. Please try again.';
            }
            
            errorText.textContent = errorMessageText;
            errorMessage.classList.remove('hidden');
            
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    });
}
