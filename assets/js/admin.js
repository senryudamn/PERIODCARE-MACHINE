/**
 * PERIODCARE MACHINE - Admin JavaScript
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getDatabase, ref, set, onValue, push, remove } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

let auth, db;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/config');
        const firebaseConfig = await response.json();
        const app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getDatabase(app);
        initAdminPanel();
    } catch (error) { console.error(error); }
});

function initAdminPanel() {
    const loginScreen = document.getElementById('login-screen');
    const dashboardScreen = document.getElementById('dashboard-screen');
    const loginForm = document.getElementById('login-form');
    
    onAuthStateChanged(auth, (user) => {
        if (user) { loginScreen.classList.add('hidden'); dashboardScreen.classList.remove('hidden'); loadDashboardData(); } 
        else { loginScreen.classList.remove('hidden'); dashboardScreen.classList.add('hidden'); }
    });

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value)
            .catch(() => { document.getElementById('login-error').textContent = "Gagal login!"; document.getElementById('login-error').classList.remove('hidden'); });
    });

    document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

    document.getElementById('callcenter-form').addEventListener('submit', (e) => {
        e.preventDefault(); set(ref(db, 'settings/callCenter'), document.getElementById('callcenter-input').value).then(() => alert('Nomor diperbarui!'));
    });
    onValue(ref(db, 'settings/callCenter'), (snapshot) => { if(snapshot.exists()) document.getElementById('callcenter-input').value = snapshot.val(); });

    document.getElementById('maps-form').addEventListener('submit', (e) => {
        e.preventDefault(); let link = document.getElementById('maps-input').value;
        if (link.includes('<iframe')) { const match = link.match(/src="([^"]+)"/); if (match) link = match[1]; }
        if (!link.includes('embed')) return alert("⚠️ Harus link Sematkan/Embed!");
        set(ref(db, 'settings/mapsLink'), link).then(() => { alert('Peta Diperbarui!'); document.getElementById('maps-input').value = ''; });
    });

    document.getElementById('qris-form').addEventListener('submit', async (e) => {
        e.preventDefault(); const file = document.getElementById('qris-input').files[0]; const btn = document.getElementById('qris-btn');
        if(!file) return alert("Pilih foto!"); btn.textContent = "Mengunggah..."; btn.disabled = true;
        try {
            const formData = new FormData(); formData.append('file', file); formData.append('upload_preset', document.getElementById('upload-preset').value);
            const res = await fetch(`https://api.cloudinary.com/v1_1/${document.getElementById('cloud-name').value}/image/upload`, { method: 'POST', body: formData });
            const data = await res.json(); await set(ref(db, 'settings/qrisUrl'), data.secure_url); alert("QRIS Diperbarui!");
        } catch (error) { alert("Gagal!"); } finally { btn.textContent = "Upload & Perbarui QRIS"; btn.disabled = false; }
    });

    document.getElementById('target-form').addEventListener('submit', (e) => {
        e.preventDefault(); set(ref(db, 'settings/targetDonation'), document.getElementById('target-input').value).then(() => alert('Target diperbarui!'));
    });
    onValue(ref(db, 'settings/targetDonation'), (snapshot) => { if(snapshot.exists()) document.getElementById('target-input').value = snapshot.val(); });

    document.getElementById('expense-form').addEventListener('submit', async (e) => {
        e.preventDefault(); const btn = document.getElementById('exp-btn'); btn.textContent = "Menyimpan..."; btn.disabled = true;
        try {
            await push(ref(db, 'expenses'), { date: document.getElementById('exp-date').value, category: document.getElementById('exp-category').value, desc: document.getElementById('exp-desc').value, amount: document.getElementById('exp-amount').value, timestamp: new Date().toISOString() });
            alert('Pengeluaran dicatat!'); document.getElementById('expense-form').reset();
        } catch (error) { alert('Gagal!'); } finally { btn.textContent = "Catat ke Laporan"; btn.disabled = false; }
    });

    document.getElementById('machine-form').addEventListener('submit', async (e) => {
        e.preventDefault(); const btn = document.getElementById('mac-btn'); btn.textContent = "Menyimpan..."; btn.disabled = true;
        const id = document.getElementById('mac-id').value.trim();
        const macData = { name: document.getElementById('mac-name').value, location: document.getElementById('mac-loc').value, stock: parseInt(document.getElementById('mac-stock').value), mapsLink: document.getElementById('mac-link').value };
        try {
            await set(ref(db, 'machines/' + id), macData); alert('Data Mesin disimpan!'); document.getElementById('machine-form').reset();
        } catch (error) { alert('Gagal!'); } finally { btn.textContent = "Simpan Data Mesin"; btn.disabled = false; }
    });

    document.getElementById('table-machines').addEventListener('click', async (e) => {
        if(e.target.classList.contains('btn-delete-mac')) { const id = e.target.getAttribute('data-id'); if(confirm('Hapus mesin ' + id + '?')) await remove(ref(db, 'machines/' + id)); }
    });
}

function loadDashboardData() {
    const formatDate = (iso) => { if(!iso) return '-'; const d = new Date(iso); return d.toLocaleDateString('id-ID') + ' ' + d.toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'}); };
    const createStars = (r) => '⭐'.repeat(r) + '☆'.repeat(5 - r); 

    onValue(ref(db, 'machines'), (s) => {
        const tbody = document.getElementById('table-machines'); if(!tbody) return; tbody.innerHTML = '';
        s.forEach(c => { const d = c.val(); let sV = parseInt(d.stock) || 0; let sC = sV > 12 ? 'text-green-500' : (sV > 0 ? 'text-yellow-500' : 'text-red-500'); tbody.innerHTML += `<tr class="hover:bg-gray-50"><td class="p-4 font-mono font-bold text-gray-700">${c.key}</td><td class="p-4"><strong>${d.name}</strong><br><span class="text-xs text-gray-500">${d.location}</span></td><td class="p-4 text-center font-black ${sC} text-lg">${sV}<span class="text-sm text-gray-500">/24</span></td><td class="p-4 text-center"><button data-id="${c.key}" class="btn-delete-mac bg-red-100 text-red-500 px-3 py-1 rounded text-xs font-bold">Hapus</button></td></tr>`; });
    });

    onValue(ref(db, 'feedbacks'), (s) => {
        const tbody = document.getElementById('table-feedbacks'); if(!tbody) return; tbody.innerHTML = '';
        const arr = []; s.forEach(c => arr.push(c.val())); arr.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
        arr.forEach(d => tbody.innerHTML += `<tr><td class="p-4 text-gray-500">${formatDate(d.timestamp)}</td><td class="p-4 font-bold">${d.name}</td><td class="p-4 text-yellow-500">${createStars(parseInt(d.rating))}</td><td class="p-4 text-gray-700">${d.message}</td></tr>`);
    });

    onValue(ref(db, 'messages'), (s) => {
        const tbody = document.getElementById('table-messages'); if(!tbody) return; tbody.innerHTML = '';
        s.forEach(c => { const d = c.val(); tbody.innerHTML = `<tr><td class="p-4 text-gray-500">${formatDate(d.timestamp)}</td><td class="p-4 font-bold">${d.name}</td><td class="p-4">${d.email}</td><td class="p-4">${d.message}</td></tr>` + tbody.innerHTML; });
    });

    onValue(ref(db, 'volunteers'), (s) => {
        const tbody = document.getElementById('table-volunteers'); if(!tbody) return; tbody.innerHTML = '';
        s.forEach(c => { const d = c.val(); tbody.innerHTML = `<tr><td class="p-4 text-gray-500">${formatDate(d.timestamp)}</td><td class="p-4 font-bold">${d.name}</td><td class="p-4">${d.email}</td><td class="p-4 uppercase text-xs font-bold text-pink-500">${d.role}</td></tr>` + tbody.innerHTML; });
    });

    onValue(ref(db, 'donations'), (s) => {
        const tbody = document.getElementById('table-donations'); if(!tbody) return; tbody.innerHTML = '';
        s.forEach(c => { const d = c.val(); tbody.innerHTML = `<tr><td class="p-4 text-gray-500">${formatDate(d.timestamp)}</td><td class="p-4 font-bold">${d.name}</td><td class="p-4 text-right font-mono">Rp ${parseInt(d.amount).toLocaleString('id-ID')}</td></tr>` + tbody.innerHTML; });
    });
}

// =======================================================
// MANAJEMEN TIM DOMPET KITA DENGAN DRAG & ZOOM (1:1)
// =======================================================
document.addEventListener('DOMContentLoaded', () => {
    const teamForm = document.getElementById('teamForm');
    const photoInput = document.getElementById('teamPhoto');
    const preview = document.getElementById('photoPreview');
    const zoomSlider = document.getElementById('zoomSlider');
    const cropContainer = document.getElementById('cropContainer');
    
    let currentPhotoBase64 = null; 
    
    let pScale = 1, pTx = 0, pTy = 0;
    let isDragging = false, startX, startY;

    if(teamForm) {
        const updateTransform = () => {
            if(preview) preview.style.transform = `translate(${pTx}%, ${pTy}%) scale(${pScale})`;
        };

        if(zoomSlider) {
            zoomSlider.addEventListener('input', (e) => {
                pScale = parseFloat(e.target.value);
                updateTransform();
            });
        }

        if(cropContainer) {
            const handleDragStart = (e) => {
                if(!currentPhotoBase64) return;
                isDragging = true;
                cropContainer.classList.add('cursor-grabbing');
                cropContainer.classList.remove('cursor-grab');
                
                let clientX = e.touches ? e.touches[0].clientX : e.clientX;
                let clientY = e.touches ? e.touches[0].clientY : e.clientY;
                let rect = cropContainer.getBoundingClientRect();
                
                let currentPx = (pTx * rect.width) / 100;
                let currentPy = (pTy * rect.height) / 100;
                
                startX = clientX - currentPx;
                startY = clientY - currentPy;
            };

            const handleDragMove = (e) => {
                if (!isDragging) return;
                e.preventDefault(); 
                let clientX = e.touches ? e.touches[0].clientX : e.clientX;
                let clientY = e.touches ? e.touches[0].clientY : e.clientY;
                let rect = cropContainer.getBoundingClientRect();
                
                let newPx = clientX - startX;
                let newPy = clientY - startY;
                
                pTx = (newPx / rect.width) * 100;
                pTy = (newPy / rect.height) * 100;
                
                updateTransform();
            };

            const handleDragEnd = () => {
                isDragging = false;
                cropContainer.classList.remove('cursor-grabbing');
                cropContainer.classList.add('cursor-grab');
            };

            cropContainer.addEventListener('mousedown', handleDragStart);
            window.addEventListener('mousemove', handleDragMove);
            window.addEventListener('mouseup', handleDragEnd);
            cropContainer.addEventListener('touchstart', handleDragStart, {passive: false});
            window.addEventListener('touchmove', handleDragMove, {passive: false});
            window.addEventListener('touchend', handleDragEnd);
        }

        photoInput.addEventListener('change', async function() {
            if (this.files && this.files[0]) {
                currentPhotoBase64 = await convertToBase64(this.files[0]);
                preview.src = currentPhotoBase64;
                pTx = 0; pTy = 0; pScale = 1; zoomSlider.value = 1; updateTransform();
            }
        });

        teamForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const idInput = document.getElementById('teamId').value;
            const name = document.getElementById('teamName').value;
            const role = document.getElementById('teamRole').value;
            const desc = document.getElementById('teamDesc').value;
            
            const submitBtn = document.getElementById('teamSubmitBtn');
            const originalText = submitBtn.innerText;
            submitBtn.innerText = "Menyimpan...";
            submitBtn.disabled = true;
            
            let photoData = currentPhotoBase64;
            if (!photoData) { photoData = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=fbcfe8&color=be185d&size=400`; }

            let team = JSON.parse(localStorage.getItem('periodCareTeam')) || [];

            if (idInput) {
                team = team.map(m => m.id === idInput ? { ...m, name, role, desc, photo: photoData, photoTx: pTx, photoTy: pTy, photoScale: pScale } : m);
            } else {
                const newMember = { id: 'team_' + Date.now().toString(), name: name, role: role, desc: desc, photo: photoData, photoTx: pTx, photoTy: pTy, photoScale: pScale };
                team.push(newMember);
            }

            localStorage.setItem('periodCareTeam', JSON.stringify(team));
            
            // Tampilkan notifikasi sukses
            const successMsg = document.getElementById('teamSuccessMsg');
            if (successMsg) {
                successMsg.classList.remove('hidden');
                setTimeout(() => {
                    successMsg.classList.add('hidden');
                }, 3000); // Hilang otomatis setelah 3 detik
            }
            
            cancelEditTeam(); 
        });
    }
    
    loadAdminTeam();
});

window.cancelEditTeam = function() {
    document.getElementById('teamForm').reset();
    document.getElementById('teamId').value = "";
    
    currentPhotoBase64 = null;
    document.getElementById('photoPreview').src = "https://via.placeholder.com/200x200?text=Preview";
    
    const zoomSlider = document.getElementById('zoomSlider');
    if (zoomSlider) zoomSlider.value = 1;
    
    const preview = document.getElementById('photoPreview');
    if (preview) preview.style.transform = "translate(0%, 0%) scale(1)";
    
    document.getElementById('teamSubmitBtn').innerText = "+ Tambahkan Anggota";
    document.getElementById('teamSubmitBtn').disabled = false;
    document.getElementById('teamCancelBtn').classList.add('hidden');
    
    loadAdminTeam();
};

window.editTeamMember = function(id) {
    const team = JSON.parse(localStorage.getItem('periodCareTeam')) || [];
    const member = team.find(m => m.id === id);
    if(!member) return;

    document.getElementById('teamId').value = member.id;
    document.getElementById('teamName').value = member.name;
    document.getElementById('teamRole').value = member.role;
    document.getElementById('teamDesc').value = member.desc;
    
    currentPhotoBase64 = member.photo;
    document.getElementById('photoPreview').src = member.photo;
    
    const savedTx = member.photoTx || 0;
    const savedTy = member.photoTy || 0;
    const savedScale = member.photoScale || 1;
    
    const zoomSlider = document.getElementById('zoomSlider');
    if (zoomSlider) zoomSlider.value = savedScale;
    
    const preview = document.getElementById('photoPreview');
    if (preview) preview.style.transform = `translate(${savedTx}%, ${savedTy}%) scale(${savedScale})`;

    document.getElementById('teamSubmitBtn').innerText = "Simpan Perubahan";
    document.getElementById('teamCancelBtn').classList.remove('hidden');
    
    window.scrollTo({ top: document.getElementById('teamForm').offsetTop - 50, behavior: 'smooth' });
};

function convertToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result); reader.onerror = error => reject(error);
    });
}

function loadAdminTeam() {
    const tbody = document.getElementById('adminTeamList');
    if(!tbody) return; 

    const team = JSON.parse(localStorage.getItem('periodCareTeam')) || [];
    if (team.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-gray-500">Belum ada anggota tim terdaftar.</td></tr>`;
        return;
    }

    tbody.innerHTML = team.map(member => {
        const tx = member.photoTx || 0;
        const ty = member.photoTy || 0;
        const scale = member.photoScale || 1;
        
        return `
        <tr class="border-b border-gray-50 hover:bg-gray-50 transition-colors">
            <td class="p-3">
                <!-- Thumbnail tabel diubah menjadi aspect-square agar 1:1 -->
                <div class="w-16 h-16 rounded-xl overflow-hidden border border-gray-200 bg-gray-100 relative flex justify-center items-center">
                    <img src="${member.photo}" class="absolute w-full h-full object-cover" style="transform: translate(${tx}%, ${ty}%) scale(${scale});">
                </div>
            </td>
            <td class="p-3">
                <div class="font-bold text-gray-800">${member.name}</div>
                <div class="text-[11px] font-bold text-pink-700 bg-pink-100 inline-block px-2 py-0.5 rounded mt-1 uppercase tracking-wider">${member.role}</div>
            </td>
            <td class="p-3 text-sm text-gray-600">${member.desc}</td>
            <td class="p-3 text-right">
                <div class="flex justify-end gap-2">
                    <button onclick="editTeamMember('${member.id}')" class="text-blue-500 hover:text-white border border-blue-500 hover:bg-blue-500 px-3 py-1 rounded-lg text-sm font-medium transition-colors">Edit</button>
                    <button onclick="deleteTeamMember('${member.id}')" class="text-red-500 hover:text-white border border-red-500 hover:bg-red-500 px-3 py-1 rounded-lg text-sm font-medium transition-colors">Hapus</button>
                </div>
            </td>
        </tr>
        `;
    }).join('');
}

window.deleteTeamMember = function(id) {
    if(!confirm('Apakah Anda yakin ingin menghapus anggota tim ini?')) return;
    let team = JSON.parse(localStorage.getItem('periodCareTeam')) || [];
    team = team.filter(m => m.id !== id);
    localStorage.setItem('periodCareTeam', JSON.stringify(team));
    loadAdminTeam();
}
