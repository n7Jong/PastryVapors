import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { collection, query, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

let currentUser = null;

// Check authentication state
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        await loadRankings();
    } else {
        window.location.href = 'index.html';
    }
});

// Load promoter rankings
async function loadRankings() {
    try {
        // Query all users from Firestore
        const q = query(collection(db, 'users'));
        
        const querySnapshot = await getDocs(q);
        const promoters = [];
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            // Filter promoters only (isAdmin = false) and sort in JavaScript
            if (data.isAdmin === false) {
                promoters.push({
                    id: doc.id,
                    ...data,
                    points: data.points || 0,
                    totalApprovedPosts: data.totalApprovedPosts || 0
                });
            }
        });

        // Sort by points descending
        promoters.sort((a, b) => b.points - a.points);

        // Display top 3 podium
        displayPodium(promoters.slice(0, 3));
        
        // Display full rankings table
        displayRankingsTable(promoters);
        
    } catch (error) {
        console.error('Error loading rankings:', error);
        document.getElementById('rankingsTableBody').innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-12 text-red-500">
                    <i class="fas fa-exclamation-circle text-3xl mb-3"></i>
                    <p>Error loading rankings</p>
                </td>
            </tr>
        `;
    }
}

// Display top 3 podium
function displayPodium(topThree) {
    const podiumContainer = document.getElementById('podiumContainer');
    
    if (topThree.length === 0) {
        podiumContainer.innerHTML = `
            <div class="text-center text-gray-400 py-12">
                <i class="fas fa-users-slash text-5xl mb-4"></i>
                <p class="text-xl">No promoters yet</p>
            </div>
        `;
        return;
    }
    
    // Reorder for podium display: 2nd, 1st, 3rd
    const podiumOrder = [
        topThree[1], // 2nd place (left)
        topThree[0], // 1st place (center)
        topThree[2]  // 3rd place (right)
    ];
    
    const positions = ['2', '1', '3'];
    const colors = {
        '1': { border: '#FFD700', bg: 'gold' },
        '2': { border: '#C0C0C0', bg: 'silver' },
        '3': { border: '#CD7F32', bg: 'bronze' }
    };
    
    podiumContainer.innerHTML = podiumOrder.map((promoter, index) => {
        if (!promoter) return '';
        
        const rank = positions[index];
        const avgPoints = promoter.totalApprovedPosts > 0 
            ? (promoter.points / promoter.totalApprovedPosts).toFixed(1) 
            : '0';
        
        const profilePic = promoter.profilePicture || 
            `https://ui-avatars.com/api/?name=${encodeURIComponent(promoter.fullName || 'User')}&background=F59E0B&color=000&size=200`;
        
        return `
            <div class="podium-item podium-${rank}">
                <div class="podium-platform">
                    <div class="rank-badge rank-${rank} mx-auto mb-4">
                        <i class="fas fa-trophy text-black"></i>
                    </div>
                    <img 
                        src="${profilePic}" 
                        alt="${promoter.fullName || 'Promoter'}" 
                        class="profile-avatar"
                        style="border-color: ${colors[rank].border}"
                    >
                    <h3 class="text-xl font-bold mb-2">${promoter.fullName || 'Anonymous'}</h3>
                    <div class="text-3xl font-bold text-amber-500 mb-2">
                        ${promoter.points}
                        <span class="text-sm text-gray-400">pts</span>
                    </div>
                    <div class="text-sm text-gray-400">
                        ${promoter.totalApprovedPosts} posts • ${avgPoints} avg
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Display full rankings table
function displayRankingsTable(promoters) {
    const tableBody = document.getElementById('rankingsTableBody');
    
    if (promoters.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-12 text-gray-400">
                    <i class="fas fa-users-slash text-3xl mb-3"></i>
                    <p>No promoters to display</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tableBody.innerHTML = promoters.map((promoter, index) => {
        const rank = index + 1;
        const avgPoints = promoter.totalApprovedPosts > 0 
            ? (promoter.points / promoter.totalApprovedPosts).toFixed(1) 
            : '0.0';
        
        const profilePic = promoter.profilePicture || 
            `https://ui-avatars.com/api/?name=${encodeURIComponent(promoter.fullName || 'User')}&background=1a1a1a&color=F59E0B&size=80`;
        
        let rankBadge = `<span class="text-gray-400 font-bold text-xl">#${rank}</span>`;
        
        if (rank === 1) {
            rankBadge = `<div class="flex items-center gap-2">
                <i class="fas fa-crown text-yellow-500 text-2xl"></i>
                <span class="text-yellow-500 font-bold text-xl">#1</span>
            </div>`;
        } else if (rank === 2) {
            rankBadge = `<div class="flex items-center gap-2">
                <i class="fas fa-medal text-gray-400 text-xl"></i>
                <span class="text-gray-400 font-bold text-xl">#2</span>
            </div>`;
        } else if (rank === 3) {
            rankBadge = `<div class="flex items-center gap-2">
                <i class="fas fa-medal text-orange-600 text-xl"></i>
                <span class="text-orange-600 font-bold text-xl">#3</span>
            </div>`;
        }
        
        return `
            <tr class="border-b border-gray-800 hover:bg-gray-800/50">
                <td class="py-4 px-4">${rankBadge}</td>
                <td class="py-4 px-4">
                    <div class="flex items-center gap-3">
                        <img 
                            src="${profilePic}" 
                            alt="${promoter.fullName || 'Promoter'}" 
                            class="w-12 h-12 rounded-full object-cover border-2 border-amber-500/30"
                        >
                        <div>
                            <div class="font-semibold">${promoter.fullName || 'Anonymous'}</div>
                            <div class="text-sm text-gray-400">${promoter.email || ''}</div>
                        </div>
                    </div>
                </td>
                <td class="py-4 px-4">
                    <span class="text-2xl font-bold text-amber-500">${promoter.points}</span>
                </td>
                <td class="py-4 px-4">
                    <span class="text-lg">${promoter.totalApprovedPosts}</span>
                </td>
                <td class="py-4 px-4">
                    <span class="text-lg text-gray-300">${avgPoints}</span>
                </td>
            </tr>
        `;
    }).join('');
}

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
