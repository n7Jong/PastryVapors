// Firebase Configuration
// Replace these values with your actual Firebase project credentials
// Get these from: Firebase Console > Project Settings > General > Your apps > SDK setup and configuration

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, orderBy, Timestamp, getDoc, setDoc, increment, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Your web app's Firebase configuration
// TODO: Replace with your Firebase project configuration
const firebaseConfig = {
    apiKey: "AIzaSyAV4HfUNPZL-O-1o5JdADYbWemEh8C3w30",
    authDomain: "pastry-vapors.firebaseapp.com",
    projectId: "pastry-vapors",
    storageBucket: "pastry-vapors.firebasestorage.app",
    messagingSenderId: "538514051142",
    appId: "1:538514051142:web:e6c80ad671acf22d017a47",
    measurementId: "G-XND6TY3HEB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Export Firebase services
export { 
    auth, 
    db, 
    signInWithEmailAndPassword, 
    signInWithPopup, 
    GoogleAuthProvider, 
    createUserWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged, 
    collection, 
    addDoc, 
    getDocs, 
    doc, 
    updateDoc, 
    deleteDoc, 
    query, 
    where, 
    orderBy, 
    Timestamp, 
    getDoc, 
    setDoc, 
    increment, 
    onSnapshot,
    firebaseConfig
};

// Helper function to check if user is admin
export async function isAdmin(userId) {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        return userDoc.exists() && userDoc.data().isAdmin === true;
    } catch (error) {
        console.error('Error checking admin status:', error);
        return false;
    }
}

// Helper function to get user role
export async function getUserRole(userId) {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
            return userDoc.data().role || 'promoter';
        }
        return 'guest';
    } catch (error) {
        console.error('Error getting user role:', error);
        return 'guest';
    }
}

// Demo accounts for testing
export const DEMO_ACCOUNTS = {
    admin: {
        email: 'admin@pastryvapors.com',
        password: 'admin123',
        role: 'admin'
    },
    promoter: {
        email: 'promoter@pastryvapors.com',
        password: 'promoter123',
        role: 'promoter'
    },
    guest: {
        email: 'guest@pastryvapors.com',
        password: 'guest123',
        role: 'guest'
    }
};
