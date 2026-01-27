// Main Application JavaScript - Login Page
import { auth, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, isAdmin, db, doc, getDoc, setDoc, Timestamp } from './firebase-config.js';

// Check if user is already logged in
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Check if user is admin using boolean
        const userIsAdmin = await isAdmin(user.uid);
        
        // Automatically redirect based on isAdmin boolean
        if (userIsAdmin === true) {
            // User is admin
            localStorage.setItem('userRole', 'admin');
            window.location.href = 'admin-dashboard.html';
        } else {
            // User is promoter (isAdmin === false)
            localStorage.setItem('userRole', 'promoter');
            window.location.href = 'promoter-dashboard.html';
        }
    }
});

// Login Form Handler
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('emailInput').value;
        const password = document.getElementById('passwordInput').value;
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        
        try {
            submitBtn.textContent = 'Signing in...';
            submitBtn.disabled = true;
            
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            console.log('✓ User authenticated:', user.uid);
            console.log('✓ Email:', user.email);
            
            // IMPORTANT: Create user document in Firestore
            const userDocRef = doc(db, 'users', user.uid);
            let userDoc = await getDoc(userDocRef);
            
            if (!userDoc.exists()) {
                console.log('⚠ User document does NOT exist in Firestore');
                console.log('→ Creating user document now...');
                
                // Force create the document
                await setDoc(userDocRef, {
                    email: user.email,
                    isAdmin: false,
                    createdAt: Timestamp.now(),
                    createdBy: 'email_login'
                }, { merge: false });
                
                console.log('✓ User document created in Firestore!');
                console.log('→ Document ID:', user.uid);
                console.log('→ Email:', user.email);
                console.log('→ isAdmin: false (can be changed to true in Firebase Console)');
                
                // Verify it was created
                userDoc = await getDoc(userDocRef);
                if (userDoc.exists()) {
                    console.log('✓ VERIFIED: User document exists in Firestore');
                } else {
                    console.error('✗ FAILED: User document still does not exist!');
                }
            } else {
                console.log('✓ User document already exists in Firestore');
                const userData = userDoc.data();
                console.log('→ Current isAdmin:', userData.isAdmin);
            }
            
            // Small delay to ensure Firestore write completes
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Check if user is admin using boolean
            const userIsAdmin = await isAdmin(user.uid);
            console.log('→ isAdmin check result:', userIsAdmin);
            
            // Automatically redirect based on isAdmin boolean
            if (userIsAdmin === true) {
                console.log('→ Redirecting to ADMIN dashboard');
                localStorage.setItem('userRole', 'admin');
                window.location.href = 'admin-dashboard.html';
            } else {
                console.log('→ Redirecting to PROMOTER dashboard');
                localStorage.setItem('userRole', 'promoter');
                window.location.href = 'promoter-dashboard.html';
            }
            
        } catch (error) {
            console.error('✗ Login error:', error);
            alert('Login failed: ' + error.message);
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });
}

// Google Sign-In Handler
const googleSignInBtn = document.getElementById('googleSignInBtn');
if (googleSignInBtn) {
    googleSignInBtn.addEventListener('click', async () => {
        const provider = new GoogleAuthProvider();
        const originalText = googleSignInBtn.textContent;
        
        try {
            googleSignInBtn.textContent = 'Signing in with Google...';
            googleSignInBtn.disabled = true;
            
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
            
            console.log('✓ Google user authenticated:', user.uid);
            console.log('✓ Email:', user.email);
            console.log('✓ Display Name:', user.displayName);
            
            // IMPORTANT: Create user document in Firestore
            const userDocRef = doc(db, 'users', user.uid);
            let userDoc = await getDoc(userDocRef);
            
            if (!userDoc.exists()) {
                console.log('⚠ Google user document does NOT exist in Firestore');
                console.log('→ Creating user document now...');
                
                try {
                    // Extract name parts from displayName
                    const nameParts = (user.displayName || '').split(' ');
                    const firstName = nameParts[0] || '';
                    const lastName = nameParts.slice(1).join(' ') || '';
                    
                    // Create complete user document matching signup structure
                    const userData = {
                        // Personal Information
                        firstName: firstName,
                        middleName: '',
                        lastName: lastName,
                        fullName: user.displayName || '',
                        birthdate: '',
                        address: '',
                        contactNumber: '',
                        
                        // Account Information
                        email: user.email,
                        isAdmin: false,
                        
                        // Google specific
                        displayName: user.displayName || '',
                        photoURL: user.photoURL || '',
                        
                        // Metadata
                        createdAt: Timestamp.now(),
                        createdBy: 'google_login',
                        
                        // Additional fields
                        points: 0,
                        totalApprovedPosts: 0
                    };
                    
                    console.log('→ User data to save:', userData);
                    
                    // Create document in users collection
                    await setDoc(userDocRef, userData);
                    
                    console.log('✓ Google user document created in users collection!');
                    console.log('→ Document ID:', user.uid);
                    console.log('→ Email:', user.email);
                    console.log('→ isAdmin: false (can be changed to true in Firebase Console)');
                    
                    // ALSO create document in googleAccounts collection
                    const googleAccountRef = doc(db, 'googleAccounts', user.uid);
                    const googleAccountData = {
                        uid: user.uid,
                        email: user.email,
                        displayName: user.displayName || '',
                        photoURL: user.photoURL || '',
                        firstName: firstName,
                        lastName: lastName,
                        emailVerified: user.emailVerified,
                        createdAt: Timestamp.now(),
                        lastLoginAt: Timestamp.now(),
                        provider: 'google.com',
                        isAdmin: false
                    };
                    
                    await setDoc(googleAccountRef, googleAccountData);
                    console.log('✓ Google account document created in googleAccounts collection!');
                    
                    // Verify it was created
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
                    userDoc = await getDoc(userDocRef);
                    const googleDoc = await getDoc(googleAccountRef);
                    
                    if (userDoc.exists()) {
                        console.log('✓ VERIFIED: User document exists in users collection');
                        console.log('→ Document data:', userDoc.data());
                    } else {
                        console.error('✗ FAILED: User document still does not exist!');
                        throw new Error('Failed to create user document in Firestore');
                    }
                    
                    if (googleDoc.exists()) {
                        console.log('✓ VERIFIED: Google account exists in googleAccounts collection');
                        console.log('→ Google account data:', googleDoc.data());
                    } else {
                        console.error('✗ WARNING: Google account document was not created');
                    }
                } catch (firestoreError) {
                    console.error('✗ Firestore write error:', firestoreError);
                    console.error('→ Error code:', firestoreError.code);
                    console.error('→ Error message:', firestoreError.message);
                    throw firestoreError;
                }
            } else {
                console.log('✓ Google user document already exists in users collection');
                const userData = userDoc.data();
                console.log('→ Current isAdmin:', userData.isAdmin);
                console.log('→ Full document:', userData);
                
                // Update last login in googleAccounts collection
                try {
                    const googleAccountRef = doc(db, 'googleAccounts', user.uid);
                    const googleDoc = await getDoc(googleAccountRef);
                    
                    if (googleDoc.exists()) {
                        // Update last login time
                        await setDoc(googleAccountRef, {
                            lastLoginAt: Timestamp.now()
                        }, { merge: true });
                        console.log('✓ Updated last login in googleAccounts collection');
                    } else {
                        // Create googleAccount if it doesn't exist
                        const nameParts = (user.displayName || '').split(' ');
                        const firstName = nameParts[0] || '';
                        const lastName = nameParts.slice(1).join(' ') || '';
                        
                        await setDoc(googleAccountRef, {
                            uid: user.uid,
                            email: user.email,
                            displayName: user.displayName || '',
                            photoURL: user.photoURL || '',
                            firstName: firstName,
                            lastName: lastName,
                            emailVerified: user.emailVerified,
                            createdAt: Timestamp.now(),
                            lastLoginAt: Timestamp.now(),
                            provider: 'google.com',
                            isAdmin: userData.isAdmin || false
                        });
                        console.log('✓ Created googleAccount for existing user');
                    }
                } catch (googleError) {
                    console.error('✗ Error updating googleAccounts:', googleError);
                }
            }
            
            // Small delay to ensure Firestore write completes
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Check if user is admin using boolean
            const userIsAdmin = await isAdmin(user.uid);
            console.log('→ isAdmin check result:', userIsAdmin);
            
            // Automatically redirect based on isAdmin boolean
            if (userIsAdmin === true) {
                console.log('→ Redirecting to ADMIN dashboard');
                localStorage.setItem('userRole', 'admin');
                window.location.href = 'admin-dashboard.html';
            } else {
                console.log('→ Redirecting to PROMOTER dashboard');
                localStorage.setItem('userRole', 'promoter');
                window.location.href = 'promoter-dashboard.html';
            }
            
        } catch (error) {
            console.error('✗ Google sign-in error:', error);
            if (error.code !== 'auth/popup-closed-by-user') {
                alert('Google sign-in failed: ' + error.message);
            }
            googleSignInBtn.textContent = originalText;
            googleSignInBtn.disabled = false;
        }
    });
}
