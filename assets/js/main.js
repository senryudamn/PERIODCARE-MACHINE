/**
 * PERIODCARE MACHINE - Main JavaScript
 * Terhubung ke Firebase (Realtime Database & Forms)
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onValue, push } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// KONFIGURASI FIREBASE FINAL
const firebaseConfig = {
    apiKey: "AIzaSyB2hA3tXY8A87pBwZGzDdxxUCNpzU9Q-GA",
    authDomain: "periodcare-d3afa.firebaseapp.com",
    databaseURL: "https://periodcare-d3afa-default-rtdb.firebaseio.com",
    projectId: "periodcare-d3afa",
    storageBucket: "periodcare-d3afa.firebasestorage.app",
    messagingSenderId: "501107071095",
    appId: "1:501107071095:web:ab9f04e4eb867a7ab48e72"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
let machinesData = [];

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initScrollAnimation();
    initFirebaseLiveTracker();
    initDonationDashboard(); // Diperbarui menjadi REAL-TIME
    initDynamicSettings();
    initFormValidationAndSubmission(); 
});

const initNavigation = () => {
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const navbar = document.getElementById('navbar');
    const mobileLinks = document.querySelectorAll('.mobile-link');

    if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));
    mobileLinks.forEach(link => link.addEventListener('click', () => mobileMenu.classList.add('hidden')));
    window.addEventListener('scroll', () => {
        if (window.scrollY > 10) { navbar.classList.add('shadow-md'); navbar.classList.remove('shadow-sm'); } 
        else { navbar.classList.add('shadow-sm'); navbar.classList.remove('shadow-md'); }
    });
};

const initScrollAnimation = () => {
    const animatedElements = document.querySelectorAll('.scroll-animate');
    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.remove('opacity-0', 'translate-y-10');
                entry.target.classList.add('opacity-100', 'translate-y-0', 'transition-all', 'duration-700', 'ease-out');
                obs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });
    animatedElements.forEach(el => observer.observe(el));
};

window.addEventListener('load', () => {
    const loader = document.getElementById('loader');
    if (loader) {
        setTimeout(() => {
            loader.classList.add('opacity-0');
            setTimeout(() => { loader.style.display = 'none'; }, 700);
        }, 800); 
    }
});

const initFirebaseLiveTracker = () => {
    const container = document.getElementById('machine-list-container');
    const searchInput = document.getElementById('search-machine');
    const filterSelect = document.getElementById('filter-status');
    if(!container) return; 

    const renderMachines = (data) => {
        container.innerHTML = ''; 
        if(data.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-4">Memuat data sensor atau mesin tidak ditemukan...</p>';
            return;
        }
        data.forEach(machine => {
            let statusColor, statusBg, statusText;
            if (machine.stock > 50) { statusColor = 'bg-green-500'; statusBg = 'bg-green-50'; statusText = 'Aman'; } 
            else if (machine.stock > 0) { statusColor = 'bg-yellow-500'; statusBg = 'bg-yellow-50'; statusText = 'Hampir Habis'; } 
            else { statusColor = 'bg-red-500'; statusBg = 'bg-red-50'; statusText = 'Kosong'; }
            const card = document.createElement('div');
            card.className = `p-4 rounded-xl border border-gray-100 ${statusBg} flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all hover:shadow-md`;
            card.innerHTML = `
                <div class="w-full sm:w-auto flex-1">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="text-xs font-mono font-bold text-gray-500">${machine.id}</span>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${statusColor}">${statusText}</span>
                    </div>
                    <h4 class="font-bold text-dark text-sm mb-1">${machine.name}</h4>
                    <p class="text-xs text-gray-600 mb-2">${machine.location}</p>
                    <a href="${machine.mapsLink}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-[11px] font-semibold text-gray-600 hover:text-primary hover:border-primary hover:shadow-sm transition-all">📍 Buka di Maps</a>
                </div>
                <div class="text-left sm:text-right w-full sm:w-auto mt-2 sm:mt-0">
                    <div class="text-xs text-gray-500 font-semibold mb-1">Stok IoT:</div>
                    <div class="text-2xl font-bold text-dark leading-none">${machine.stock}%</div>
                    <div class="w-full sm:w-24 bg-gray-200 rounded-full h-1.5 mt-2"><div class="${statusColor} h-1.5 rounded-full" style="width: ${machine.stock}%"></div></div>
                </div>
            `;
            container.appendChild(card);
        });
    };

    const applyFilters = () => {
        const query = searchInput.value.toLowerCase();
        const status = filterSelect.value;
        const filtered = machinesData.filter(m => {
            const matchSearch = m.name.toLowerCase().includes(query) || m.location.toLowerCase().includes(query);
            let mStatus = 'aman';
            if(m.stock === 0) mStatus = 'kosong'; else if(m.stock <= 50) mStatus = 'hampir-habis';
            const matchStatus = (status === 'all') || (mStatus === status);
            return matchSearch && matchStatus;
        });
        renderMachines(filtered);
    };

    onValue(ref(db, 'machines'), (snapshot) => {
        const data = snapshot.val();
        machinesData = []; 
        if (data) {
            for (let key in data) {
                machinesData.push({
                    id: key, name: data[key].name || 'Mesin Tanpa Nama', location: data[key].location || 'Lokasi Belum Diatur',
                    stock: data[key].stock || 0, mapsLink: data[key].mapsLink || '#'
                });
            }
        }
        applyFilters(); 
    }, (error) => {
        container.innerHTML = '<p class="text-red-500 text-center py-4">Gagal terhubung ke database. Cek koneksi Anda.</p>';
    });

    searchInput.addEventListener('input', applyFilters);
    filterSelect.addEventListener('change', applyFilters);
};

/* =======================================================
   3. MODUL DASHBOARD TRANSPARANSI DONASI (REAL-TIME)
   ======================================================= */
const initDonationDashboard = () => {
    const totalEl = document.getElementById('total-donation-text');
    if(!totalEl) return; 
    
    const formatIDR = (number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(number);

    let targetValue = 50000000; // Target Default
    let collectedValue = 0;

    // Fungsi Render Progress Bar
    const updateProgressUI = () => {
        document.getElementById('target-donation-text').textContent = formatIDR(targetValue);
        totalEl.textContent = formatIDR(collectedValue);
        
        let percentage = targetValue > 0 ? Math.round((collectedValue / targetValue) * 100) : 0;
        if(percentage > 100) percentage = 100;
        
        document.getElementById('progress-bar').style.width = `${percentage}%`; 
        document.getElementById('progress-percent').textContent = `${percentage}% Tercapai`;
    };

    // A. Baca Target Donasi dari Firebase
    onValue(ref(db, 'settings/targetDonation'), (snapshot) => {
        if(snapshot.exists()) targetValue = parseInt(snapshot.val());
        updateProgressUI();
    });

    // B. Baca Semua Donasi yang Masuk untuk dihitung totalnya
    onValue(ref(db, 'donations'), (snapshot) => {
        collectedValue = 0;
        if(snapshot.exists()) {
            snapshot.forEach(child => {
                const data = child.val();
                if(data.amount) collectedValue += parseInt(data.amount);
            });
        }
        updateProgressUI();
    });

    // C. Baca Laporan Pengeluaran untuk Tabel
    onValue(ref(db, 'expenses'), (snapshot) => {
        const tbody = document.getElementById('expenses-table-body');
        tbody.innerHTML = ''; 

        if (!snapshot.exists()) {
            tbody.innerHTML = '<tr><td colspan="4" class="py-4 text-center text-sm text-gray-500">Belum ada data pengeluaran tercatat.</td></tr>';
            return;
        }

        const expensesArray = [];
        snapshot.forEach(child => expensesArray.push(child.val()));

        // Urutkan dari yang terbaru ke terlama
        expensesArray.sort((a, b) => new Date(b.date) - new Date(a.date));

        expensesArray.forEach(exp => {
            let badgeColor = 'bg-gray-100 text-gray-600';
            if(exp.category === 'Pembelian Stok') badgeColor = 'bg-pink-100 text-primary';
            if(exp.category === 'Maintenance') badgeColor = 'bg-orange-100 text-accent';
            if(exp.category === 'Operasional') badgeColor = 'bg-blue-100 text-blue-600';

            const tr = document.createElement('tr');
            tr.className = 'border-b border-gray-50 hover:bg-gray-50 transition-colors';
            tr.innerHTML = `
                <td class="py-3 px-4 text-sm text-gray-500 whitespace-nowrap">${exp.date}</td>
                <td class="py-3 px-4 text-sm"><span class="px-2 py-1 rounded text-xs font-semibold ${badgeColor}">${exp.category}</span></td>
                <td class="py-3 px-4 text-sm text-gray-700">${exp.desc}</td>
                <td class="py-3 px-4 text-sm font-bold text-dark text-right whitespace-nowrap">${formatIDR(exp.amount)}</td>
            `;
            tbody.appendChild(tr);
        });
    });
};

const initDynamicSettings = () => {
    onValue(ref(db, 'settings'), (snapshot) => {
        const settings = snapshot.val();
        if (settings) {
            if (settings.mapsLink) {
                const mapsIframe = document.getElementById('maps-iframe');
                if (mapsIframe) mapsIframe.src = settings.mapsLink;
            }
            if (settings.qrisUrl) {
                const qrisImg = document.getElementById('qris-img');
                if (qrisImg) qrisImg.src = settings.qrisUrl;
            }
        }
    });
};

const initFormValidationAndSubmission = () => {
    const handleFormSubmit = (formId, successMsgId, dbNode, getDataCallback) => {
        const form = document.getElementById(formId);
        const successMsg = document.getElementById(successMsgId);

        if (form && successMsg) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault(); 
                const btn = form.querySelector('button[type="submit"]');
                const originalText = btn.textContent;
                btn.textContent = 'Mengirim...';
                btn.disabled = true;
                btn.classList.add('opacity-70', 'cursor-not-allowed');

                try {
                    const dataToPush = getDataCallback();
                    dataToPush.timestamp = new Date().toISOString(); 
                    await push(ref(db, dbNode), dataToPush);

                    successMsg.classList.remove('hidden');
                    form.reset(); 
                    setTimeout(() => { successMsg.classList.add('hidden'); }, 5000);
                } catch (error) {
                    alert("Terjadi kesalahan saat menghubungi server. Silakan coba lagi.");
                } finally {
                    btn.textContent = originalText;
                    btn.disabled = false;
                    btn.classList.remove('opacity-70', 'cursor-not-allowed');
                }
            });
        }
    };

    handleFormSubmit('donation-form', 'donasi-success', 'donations', () => ({
        name: document.getElementById('donator-name').value || 'Anonim',
        amount: document.getElementById('donation-amount').value
    }));

    handleFormSubmit('volunteer-form', 'volunteer-success', 'volunteers', () => ({
        name: document.getElementById('vol-name').value,
        email: document.getElementById('vol-email').value,
        role: document.getElementById('vol-role').value
    }));

    handleFormSubmit('contact-form', 'contact-success', 'messages', () => ({
        name: document.getElementById('contact-name').value,
        email: document.getElementById('contact-email').value,
        message: document.getElementById('contact-message').value
    }));
};
