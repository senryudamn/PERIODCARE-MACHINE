/**
 * PERIODCARE MACHINE - Admin JavaScript
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
// Ditambahkan fitur 'remove' untuk menghapus data mesin
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
    } catch (error) {
        alert("Sistem Admin gagal terhubung ke Server.");
    }
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

    // UPDATE CALL CENTER
    document.getElementById('callcenter-form').addEventListener('submit', (e) => {
        e.preventDefault();
        set(ref(db, 'settings/callCenter'), document.getElementById('callcenter-input').value).then(() => alert('Nomor Call Center diperbarui!'));
    });
    onValue(ref(db, 'settings/callCenter'), (snapshot) => {
        if(snapshot.exists()) document.getElementById('callcenter-input').value = snapshot.val();
    });

    // UPDATE MAPS PINTAR (Otomatis ambil link jika user paste <iframe>)
    document.getElementById('maps-form').addEventListener('submit', (e) => {
        e.preventDefault();
        let link = document.getElementById('maps-input').value;
        
        // Ekstrak link dari kode <iframe> jika ada
        if (link.includes('<iframe')) {
            const match = link.match(/src="([^"]+)"/);
            if (match) link = match[1];
        }

        // Cek jika link tidak mengandung kata "embed"
        if (!link.includes('embed')) {
            alert("⚠️ URL Tidak Valid!\n\nAnda memasukkan link peta biasa. Buka Google Maps, klik menu 'Bagikan' (Share), lalu pilih tab 'Sematkan Peta' (Embed a map), salin kodenya dan paste di sini.");
            return;
        }

        set(ref(db, 'settings/mapsLink'), link).then(() => {
            alert('Peta Berhasil Diperbarui!');
            document.getElementById('maps-input').value = '';
        });
    });

    // UPLOAD QRIS
    document.getElementById('qris-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const file = document.getElementById('qris-input').files[0];
        const btn = document.getElementById('qris-btn');
        if(!file) return alert("Pilih foto terlebih dahulu!");
        btn.textContent = "Mengunggah..."; btn.disabled = true;
        try {
            const formData = new FormData(); formData.append('file', file); formData.append('upload_preset', document.getElementById('upload-preset').value);
            const res = await fetch(`https://api.cloudinary.com/v1_1/${document.getElementById('cloud-name').value}/image/upload`, { method: 'POST', body: formData });
            const data = await res.json();
            await set(ref(db, 'settings/qrisUrl'), data.secure_url);
            alert("QRIS Berhasil Diperbarui!");
        } catch (error) { alert("Gagal upload QRIS!"); } finally { btn.textContent = "Upload & Perbarui QRIS"; btn.disabled = false; }
    });

    // SET TARGET DONASI
    document.getElementById('target-form').addEventListener('submit', (e) => {
        e.preventDefault(); set(ref(db, 'settings/targetDonation'), document.getElementById('target-input').value).then(() => alert('Target diperbarui!'));
    });
    onValue(ref(db, 'settings/targetDonation'), (snapshot) => { if(snapshot.exists()) document.getElementById('target-input').value = snapshot.val(); });

    // CATAT PENGELUARAN
    document.getElementById('expense-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('exp-btn'); btn.textContent = "Menyimpan..."; btn.disabled = true;
        try {
            await push(ref(db, 'expenses'), { date: document.getElementById('exp-date').value, category: document.getElementById('exp-category').value, desc: document.getElementById('exp-desc').value, amount: document.getElementById('exp-amount').value, timestamp: new Date().toISOString() });
            alert('Pengeluaran dicatat!'); document.getElementById('expense-form').reset();
        } catch (error) { alert('Gagal!'); } finally { btn.textContent = "Catat ke Laporan"; btn.disabled = false; }
    });

    // SIMPAN/EDIT DATA MESIN (BARU)
    document.getElementById('machine-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('mac-btn');
        btn.textContent = "Menyimpan..."; btn.disabled = true;

        const id = document.getElementById('mac-id').value.trim();
        const macData = {
            name: document.getElementById('mac-name').value,
            location: document.getElementById('mac-loc').value,
            stock: parseInt(document.getElementById('mac-stock').value),
            mapsLink: document.getElementById('mac-link').value
        };

        try {
            await set(ref(db, 'machines/' + id), macData);
            alert('Data Mesin berhasil disimpan ke IoT Tracker!');
            document.getElementById('machine-form').reset();
        } catch (error) {
            alert('Gagal menyimpan: ' + error.message);
        } finally {
            btn.textContent = "Simpan Data Mesin"; btn.disabled = false;
        }
    });

    // HAPUS MESIN (BARU - Event Delegation)
    document.getElementById('table-machines').addEventListener('click', async (e) => {
        if(e.target.classList.contains('btn-delete-mac')) {
            const id = e.target.getAttribute('data-id');
            if(confirm('Yakin ingin menghapus mesin ' + id + '?')) {
                await remove(ref(db, 'machines/' + id));
            }
        }
    });
}

function loadDashboardData() {
    const formatDate = (isoString) => { if(!isoString) return '-'; const d = new Date(isoString); return d.toLocaleDateString('id-ID') + ' ' + d.toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'}); };
    const createStars = (rating) => { return '⭐'.repeat(rating) + '☆'.repeat(5 - rating); }; 

    // LOAD DATA MESIN (BARU)
    onValue(ref(db, 'machines'), (snapshot) => {
        const tbody = document.getElementById('table-machines'); if(!tbody) return; tbody.innerHTML = '';
        snapshot.forEach(child => {
            const id = child.key;
            const data = child.val();
            let statusColor = data.stock > 50 ? 'text-green-500' : (data.stock > 0 ? 'text-yellow-500' : 'text-red-500');
            
            tbody.innerHTML += `
            <tr class="hover:bg-gray-50">
                <td class="p-4 font-mono font-bold text-gray-700">${id}</td>
                <td class="p-4"><strong>${data.name}</strong><br><span class="text-xs text-gray-500">${data.location}</span></td>
                <td class="p-4 text-center font-black ${statusColor} text-lg">${data.stock}%</td>
                <td class="p-4 text-center">
                    <button data-id="${id}" class="btn-delete-mac bg-red-100 text-red-500 px-3 py-1 rounded text-xs font-bold hover:bg-red-200 transition-colors">Hapus</button>
                </td>
            </tr>`;
        });
    });

    onValue(ref(db, 'feedbacks'), (snapshot) => {
        const tbody = document.getElementById('table-feedbacks'); if(!tbody) return; tbody.innerHTML = '';
        const dataArr = []; snapshot.forEach(child => dataArr.push(child.val())); dataArr.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
        dataArr.forEach(data => { tbody.innerHTML += `<tr><td class="p-4 text-gray-500">${formatDate(data.timestamp)}</td><td class="p-4 font-bold">${data.name}</td><td class="p-4 text-yellow-500">${createStars(parseInt(data.rating))}</td><td class="p-4 text-gray-700">${data.message}</td></tr>`; });
    });

    onValue(ref(db, 'messages'), (snapshot) => {
        const tbody = document.getElementById('table-messages'); if(!tbody) return; tbody.innerHTML = '';
        snapshot.forEach(child => { const data = child.val(); tbody.innerHTML = `<tr><td class="p-4 text-gray-500">${formatDate(data.timestamp)}</td><td class="p-4 font-bold">${data.name}</td><td class="p-4">${data.email}</td><td class="p-4">${data.message}</td></tr>` + tbody.innerHTML; });
    });

    onValue(ref(db, 'volunteers'), (snapshot) => {
        const tbody = document.getElementById('table-volunteers'); if(!tbody) return; tbody.innerHTML = '';
        snapshot.forEach(child => { const data = child.val(); tbody.innerHTML = `<tr><td class="p-4 text-gray-500">${formatDate(data.timestamp)}</td><td class="p-4 font-bold">${data.name}</td><td class="p-4">${data.email}</td><td class="p-4 uppercase text-xs font-bold text-pink-500">${data.role}</td></tr>` + tbody.innerHTML; });
    });

    onValue(ref(db, 'donations'), (snapshot) => {
        const tbody = document.getElementById('table-donations'); if(!tbody) return; tbody.innerHTML = '';
        snapshot.forEach(child => { const data = child.val(); tbody.innerHTML = `<tr><td class="p-4 text-gray-500">${formatDate(data.timestamp)}</td><td class="p-4 font-bold">${data.name}</td><td class="p-4 text-right font-mono">Rp ${parseInt(data.amount).toLocaleString('id-ID')}</td></tr>` + tbody.innerHTML; });
    });
}
