import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, getDoc, increment } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

let allPromoters = [];
let currentPromoter = null;

// Auth State Observer
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists() && userDoc.data().isAdmin) {
            loadPromoters();
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
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('isAdmin', '==', false));
        const querySnapshot = await getDocs(q);
        
        allPromoters = [];
        
        for (const docSnap of querySnapshot.docs) {
            const userData = docSnap.data();
            
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
        
        displayPromoters();
        updateStats();
    } catch (error) {
        console.error('Error loading promoters:', error);
    }
}

// Display Promoters in Table
function displayPromoters() {
    const tbody = document.getElementById('promotersTableBody');
    const noResults = document.getElementById('noResults');
    
    // Get filter values
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;
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
        
        return matchesSearch && matchesStatus;
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
        
        return `
            <tr class="hover:bg-gray-700 transition">
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                        <img src="${profilePic}" alt="${displayName}" 
                             class="w-12 h-12 rounded-full object-cover">
                        <div>
                            <p class="text-white font-semibold">${displayName}</p>
                            <p class="text-gray-400 text-sm">${promoter.email}</p>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 text-center">
                    <span class="text-amber-500 font-bold text-lg">${promoter.points || 0}</span>
                </td>
                <td class="px-6 py-4 text-center">
                    <span class="text-white font-semibold">${promoter.postCount || 0}</span>
                </td>
                <td class="px-6 py-4 text-center">
                    <span class="text-white font-semibold ${(promoter.warnings || 0) > 0 ? 'text-red-500' : ''}">${promoter.warnings || 0}</span>
                </td>
                <td class="px-6 py-4 text-center">
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </td>
                <td class="px-6 py-4">
                    <div class="flex gap-2 justify-center">
                        <button onclick="openWarningModal('${promoter.id}', '${displayName.replace(/'/g, "\\'").replace(/"/g, '&quot;')}')" 
                                class="action-btn warning-btn">
                            <i class="fas fa-exclamation-triangle mr-1"></i>Warn
                        </button>
                        <button onclick="openSuspendModal('${promoter.id}', '${displayName.replace(/'/g, "\\'").replace(/"/g, '&quot;')}')" 
                                class="action-btn suspend-btn">
                            <i class="fas fa-ban mr-1"></i>Suspend
                        </button>
                        <button onclick="openKickModal('${promoter.id}', '${displayName.replace(/'/g, "\\'").replace(/"/g, '&quot;')}')" 
                                class="action-btn kick-btn">
                            <i class="fas fa-user-times mr-1"></i>Kick
                        </button>
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
