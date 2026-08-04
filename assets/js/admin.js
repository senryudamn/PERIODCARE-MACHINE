/**
 * PERIODCARE MACHINE - Admin JavaScript
 * Konfigurasi API disembunyikan dan dipanggil dari Backend Vercel
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getDatabase, ref, set, onValue, push } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

let auth, db; // Variabel global

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 1. Panggil API Key secara aman dari Backend Vercel
        const response = await fetch('/api/config');
        const firebaseConfig = await response.json();

        // 2. Inisialisasi Firebase
        const app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getDatabase(app);

        // 3. Jalankan fungsi Admin
        initAdminPanel();

    } catch (error) {
        console.error("Gagal mengambil konfigurasi dari Backend:", error);
        alert("Sistem Admin gagal terhubung ke API tersembunyi.");
    }
});

function initAdminPanel() {
    const loginScreen = document.getElementById('login-screen');
    const dashboardScreen = document.getElementById('dashboard-screen');
    const loginForm = document.getElementById('login-form');
    const logoutBtn = document.getElementById('logout-btn');

    onAuthStateChanged(auth, (user) => {
        if (user) {
            loginScreen.classList.add('hidden');
            dashboardScreen.classList.remove('hidden');
            loadDashboardData(); 
        } else {
            loginScreen.classList.remove('hidden');
            dashboardScreen.classList.add('hidden');
        }
    });

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const errorText = document.getElementById('login-error');
        
        signInWithEmailAndPassword(auth, email, password)
            .catch((error) => {
                errorText.textContent = "Gagal login: Periksa email & password Anda.";
                errorText.classList.remove('hidden');
            });
    });

    logoutBtn.addEventListener('click', () => signOut(auth));

    document.getElementById('maps-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const link = document.getElementById('maps-input').value;
        set(ref(db, 'settings/mapsLink'), link).then(() => alert('Link Maps berhasil diperbarui!'));
    });

    document.getElementById('qris-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const file = document.getElementById('qris-input').files[0];
        const cloudName = document.getElementById('cloud-name').value;
        const uploadPreset = document.getElementById('upload-preset').value;
        const btn = document.getElementById('qris-btn');
        const statusText = document.getElementById('qris-status');

        if(!file) return alert("Pilih foto terlebih dahulu!");

        btn.textContent = "Mengunggah...";
        btn.disabled = true;

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', uploadPreset);

            const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: formData });
            const data = await res.json();
            if(data.error) throw new Error(data.error.message);

            await set(ref(db, 'settings/qrisUrl'), data.secure_url);
            statusText.textContent = "✅ QRIS Berhasil Diperbarui!";
            statusText.className = "text-xs font-bold text-center text-green-500 mt-2";
        } catch (error) {
            statusText.textContent = "❌ Gagal: " + error.message;
            statusText.className = "text-xs font-bold text-center text-red-500 mt-2";
        } finally {
            btn.textContent = "Upload & Perbarui QRIS";
            btn.disabled = false;
        }
    });

    document.getElementById('target-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const target = document.getElementById('target-input').value;
        set(ref(db, 'settings/targetDonation'), target).then(() => alert('Target Donasi diperbarui!'));
    });

    onValue(ref(db, 'settings/targetDonation'), (snapshot) => {
        if(snapshot.exists()) document.getElementById('target-input').value = snapshot.val();
    });

    document.getElementById('expense-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('exp-btn');
        const originalText = btn.textContent;
        btn.textContent = "Menyimpan...";
        btn.disabled = true;

        const expData = {
            date: document.getElementById('exp-date').value,
            category: document.getElementById('exp-category').value,
            desc: document.getElementById('exp-desc').value,
            amount: document.getElementById('exp-amount').value,
            timestamp: new Date().toISOString()
        };

        try {
            await push(ref(db, 'expenses'), expData);
            alert('Pengeluaran berhasil dicatat!');
            document.getElementById('expense-form').reset();
        } catch (error) {
            alert('Gagal mencatat pengeluaran: ' + error.message);
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    });
}

function loadDashboardData() {
    const formatDate = (isoString) => {
        if(!isoString) return '-';
        const d = new Date(isoString);
        return d.toLocaleDateString('id-ID') + ' ' + d.toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'});
    };

    onValue(ref(db, 'messages'), (snapshot) => {
        const tbody = document.getElementById('table-messages');
        if(!tbody) return;
        tbody.innerHTML = '';
        snapshot.forEach(child => {
            const data = child.val();
            tbody.innerHTML = `<tr><td class="p-4 text-gray-500">${formatDate(data.timestamp)}</td><td class="p-4 font-bold">${data.name}</td><td class="p-4">${data.email}</td><td class="p-4">${data.message}</td></tr>` + tbody.innerHTML;
        });
    });

    onValue(ref(db, 'volunteers'), (snapshot) => {
        const tbody = document.getElementById('table-volunteers');
        if(!tbody) return;
        tbody.innerHTML = '';
        snapshot.forEach(child => {
            const data = child.val();
            tbody.innerHTML = `<tr><td class="p-4 text-gray-500">${formatDate(data.timestamp)}</td><td class="p-4 font-bold">${data.name}</td><td class="p-4">${data.email}</td><td class="p-4 uppercase text-xs font-bold text-pink-500">${data.role}</td></tr>` + tbody.innerHTML;
        });
    });

    onValue(ref(db, 'donations'), (snapshot) => {
        const tbody = document.getElementById('table-donations');
        if(!tbody) return;
        tbody.innerHTML = '';
        snapshot.forEach(child => {
            const data = child.val();
            tbody.innerHTML = `<tr><td class="p-4 text-gray-500">${formatDate(data.timestamp)}</td><td class="p-4 font-bold">${data.name}</td><td class="p-4 text-right font-mono">Rp ${parseInt(data.amount).toLocaleString('id-ID')}</td></tr>` + tbody.innerHTML;
        });
    });
}
