import { auth, db, where } from './firebase-config.js';
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
        // Query Firebase users collection - ONLY get promoters (isAdmin = false)
        const q = query(
            collection(db, 'users'),
            where('isAdmin', '==', false)
        );
        
        const querySnapshot = await getDocs(q);
        const promoters = [];
        
        console.log('📊 Total promoters from Firebase:', querySnapshot.size);
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            console.log(`✓ Promoter: ${data.fullName || data.email}, Points: ${data.points || 0}, isAdmin: ${data.isAdmin}`);
            
            promoters.push({
                id: doc.id,
                ...data,
                points: data.points || 0,
                totalApprovedPosts: data.totalApprovedPosts || 0
            });
        });
        
        console.log('✅ Total promoters loaded:', promoters.length);

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

// Helper function to convert full name to initials
function getInitials(fullName) {
    if (!fullName) return 'AN';
    const names = fullName.trim().split(' ');
    if (names.length === 1) {
        return names[0].substring(0, 2).toUpperCase();
    }
    return names.map(name => name.charAt(0).toUpperCase()).join('');
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
        
        const initials = getInitials(promoter.fullName);
        const fullName = promoter.fullName || 'Anonymous';
        
        // Create unique data attributes for modal
        const rankText = rank === '1' ? '🥇 First Place' : rank === '2' ? '🥈 Second Place' : '🥉 Third Place';
        const trophyIcon = rank === '1' ? '🏆' : rank === '2' ? '🥈' : '🥉';
        
        return `
            <div class="podium-item podium-${rank}">
                <div class="podium-platform">
                    <div class="rank-badge rank-${rank} mx-auto mb-4">
                        <i class="fas fa-trophy text-black"></i>
                    </div>
                    <img 
                        src="${profilePic}" 
                        alt="${fullName}" 
                        class="profile-avatar"
                        style="border-color: ${colors[rank].border}"
                    >
                    <h3 class="text-xl font-bold mb-2 transition-colors" 
                        onclick="showNameModal('${fullName.replace(/'/g, "\\'")}', '${rankText}', '${trophyIcon}', ${promoter.points}, ${promoter.totalApprovedPosts})" 
                        title="Click to view details">
                        <span class="name-full">${fullName}</span>
                        <span class="name-initials">${initials}</span>
                    </h3>
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
    
    // Helper function to format name for mobile (initials + lastname)
    function formatMobileName(fullName) {
        if (!fullName) return 'Anonymous';
        const parts = fullName.trim().split(' ');
        if (parts.length === 1) return fullName;
        
        // Get first name initial, middle name initial (if exists), and last name
        const firstName = parts[0];
        const lastName = parts[parts.length - 1];
        
        let initials = firstName.charAt(0).toUpperCase() + '.';
        
        // Add middle initial if exists
        if (parts.length > 2) {
            initials += parts[1].charAt(0).toUpperCase() + '.';
        }
        
        return `${initials} ${lastName}`;
    }
    
    // Skip top 3 as they are already shown in podium
    const displayPromoters = promoters.slice(3);
    
    if (displayPromoters.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-12 text-gray-400">
                    <i class="fas fa-trophy text-3xl mb-3"></i>
                    <p>Top promoters are shown in the podium above</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tableBody.innerHTML = displayPromoters.map((promoter, index) => {
        const rank = index + 4; // Start from rank 4
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
        
        const genderClass = promoter.gender === 'male' ? 'gender-male' : 
                             promoter.gender === 'female' ? 'gender-female' : '';
        const genderBadge = promoter.gender === 'male' ? 
            '<span class="gender-badge-male"><i class="fas fa-crown"></i> Kings</span>' :
            promoter.gender === 'female' ? 
            '<span class="gender-badge-female"><i class="fas fa-crown"></i> Queens</span>' : '';
        
        // Debug logging
        if (index < 5) {
            console.log(`Promoter ${index + 1}:`, promoter.fullName, 'Gender:', promoter.gender, 'Class:', genderClass);
        }
        
        // Format mobile name
        const mobileDisplayName = formatMobileName(promoter.fullName);
        
        return `
            <tr class="border-b border-gray-800 hover:bg-gray-800/50 ${genderClass}">
                <td class="py-4 px-6 align-middle" data-label="Rank">${rankBadge}</td>
                <td class="py-4 px-6 align-middle" data-label="Promoter">
                    <div class="flex items-center gap-4">
                        <img 
                            src="${profilePic}" 
                            alt="${promoter.fullName || 'Promoter'}" 
                            class="w-12 h-12 rounded-full object-cover border-2 border-amber-500/30"
                        >
                        <div class="flex flex-col justify-center gap-1">
                            <div class="flex items-center gap-3">
                                <span class="font-semibold hidden md:inline">${promoter.fullName || 'Anonymous'}</span>
                                <span class="font-semibold md:hidden">${mobileDisplayName}</span>
                                ${genderBadge}
                            </div>
                            <div class="text-sm text-gray-400 hidden md:block">${promoter.email || ''}</div>
                        </div>
                    </div>
                </td>
                <td class="py-4 px-6 align-middle" data-label="Total Points">
                    <span class="text-2xl font-bold text-amber-500">${promoter.points}</span>
                </td>
                <td class="py-4 px-6 align-middle hide-mobile" data-label="Approved Posts">
                    <span class="text-lg">${promoter.totalApprovedPosts}</span>
                </td>
                <td class="py-4 px-6 align-middle hide-mobile" data-label="Avg Points">
                    <span class="text-lg text-gray-300">${avgPoints}</span>
                </td>
            </tr>
        `;
    }).join('');
}

// Show name modal
window.showNameModal = function(name, rank, trophy, points, posts) {
    document.getElementById('modalName').textContent = name;
    document.getElementById('modalRank').textContent = rank;
    document.getElementById('modalTrophy').textContent = trophy;
    document.getElementById('modalPoints').textContent = points;
    document.getElementById('modalPosts').textContent = posts;
    document.getElementById('nameModal').classList.add('active');
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
