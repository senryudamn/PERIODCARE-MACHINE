/**
 * PERIODCARE MACHINE - Main JavaScript
 * Modul: Navigasi, Animasi, Live Tracker (Firebase IoT), Transparansi Data, Validasi Form
 */

// 1. IMPORT MODUL FIREBASE (Menggunakan versi modular ES6 dari CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// 2. KONFIGURASI FIREBASE
// PENTING: Nanti ganti nilai di bawah ini dengan config dari Project Firebase Anda
const firebaseConfig = {
    apiKey: "API_KEY_ANDA",
    authDomain: "periodcare-xxx.firebaseapp.com",
    databaseURL: "https://periodcare-xxx-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "periodcare-xxx",
    storageBucket: "periodcare-xxx.appspot.com",
    messagingSenderId: "SENDER_ID",
    appId: "APP_ID"
};

// 3. INISIALISASI FIREBASE
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Array global untuk menampung data mesin dari database
let machinesData = [];

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initScrollAnimation();
    initFirebaseLiveTracker(); // Modul Tracker kini menggunakan Firebase
    initDonationDashboard();
    initFormValidation();
});

/* =======================================================
   1. MODUL NAVIGASI & ANIMASI
   ======================================================= */
const initNavigation = () => {
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const navbar = document.getElementById('navbar');
    const mobileLinks = document.querySelectorAll('.mobile-link');

    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));
    }
    
    // Tutup menu mobile jika link diklik
    mobileLinks.forEach(link => {
        link.addEventListener('click', () => mobileMenu.classList.add('hidden'));
    });
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 10) {
            navbar.classList.add('shadow-md'); navbar.classList.remove('shadow-sm');
        } else {
            navbar.classList.add('shadow-sm'); navbar.classList.remove('shadow-md');
        }
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

/* =======================================================
   2. MODUL LIVE TRACKER & GOOGLE MAPS LINK (FIREBASE)
   ======================================================= */
const initFirebaseLiveTracker = () => {
    const container = document.getElementById('machine-list-container');
    const searchInput = document.getElementById('search-machine');
    const filterSelect = document.getElementById('filter-status');

    if(!container) return; // Guard clause jika elemen tidak ada

    // Fungsi Render UI Card Mesin
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
                    <div class="w-full sm:w-24 bg-gray-200 rounded-full h-1.5 mt-2">
                        <div class="${statusColor} h-1.5 rounded-full" style="width: ${machine.stock}%"></div>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    };

    // Fungsi Filter Data
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

    // --- MENGAMBIL DATA DARI FIREBASE REALTIME DATABASE ---
    const machinesRef = ref(db, 'machines');
    
    // onValue akan membaca data pertama kali, DAN setiap kali sensor IoT mengupdate data
    onValue(machinesRef, (snapshot) => {
        const data = snapshot.val();
        machinesData = []; // Kosongkan array lama

        if (data) {
            // Ubah format JSON Object Firebase menjadi Array JavaScript
            for (let key in data) {
                machinesData.push({
                    id: key,
                    name: data[key].name || 'Mesin Tanpa Nama',
                    location: data[key].location || 'Lokasi Belum Diatur',
                    stock: data[key].stock || 0,
                    mapsLink: data[key].mapsLink || '#'
                });
            }
        }
        
        // Render ulang UI setelah data terbaru ditarik
        applyFilters(); 
    }, (error) => {
        console.error("Error fetching data from Firebase:", error);
        container.innerHTML = '<p class="text-red-500 text-center py-4">Gagal terhubung ke database. Cek koneksi Anda.</p>';
    });

    // Event Listener untuk Search dan Filter
    searchInput.addEventListener('input', applyFilters);
    filterSelect.addEventListener('change', applyFilters);
};

/* =======================================================
   3. MODUL DASHBOARD TRANSPARANSI DONASI
   ======================================================= */
const financialData = {
    target: 50000000,
    collected: 37500000,
    expenses: [
        { date: '2026-04-10', category: 'Pembelian Stok', desc: 'Pembalut Softex 10 Karton', amount: 3500000 },
        { date: '2026-04-05', category: 'Maintenance', desc: 'Perbaikan Sensor Motor Dispenser 001', amount: 150000 },
        { date: '2026-03-20', category: 'Operasional', desc: 'Transportasi Relawan Distribusi', amount: 200000 },
        { date: '2026-03-15', category: 'Pembelian Stok', desc: 'Pembalut Berbagai Ukuran 5 Karton', amount: 1750000 }
    ]
};

const initDonationDashboard = () => {
    const totalEl = document.getElementById('total-donation-text');
    if(!totalEl) return; // Guard clause

    const formatIDR = (number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(number);

    document.getElementById('target-donation-text').textContent = formatIDR(financialData.target);
    totalEl.textContent = formatIDR(financialData.collected);
    
    let percentage = Math.round((financialData.collected / financialData.target) * 100);
    if(percentage > 100) percentage = 100;

    setTimeout(() => {
        document.getElementById('progress-bar').style.width = `${percentage}%`;
        document.getElementById('progress-percent').textContent = `${percentage}% Tercapai`;
    }, 500);

    const tbody = document.getElementById('expenses-table-body');
    tbody.innerHTML = ''; 

    financialData.expenses.forEach(exp => {
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
};

/* =======================================================
   4. MODUL VALIDASI FORM
   ======================================================= */
const initFormValidation = () => {
    // Fungsi umum untuk menangani submit form (Mencegah reload dan memunculkan pesan sukses)
    const handleFormSubmit = (formId, successMsgId) => {
        const form = document.getElementById(formId);
        const successMsg = document.getElementById(successMsgId);

        if (form && successMsg) {
            form.addEventListener('submit', (e) => {
                e.preventDefault(); // Mencegah reload halaman
                
                const btn = form.querySelector('button[type="submit"]');
                const originalText = btn.textContent;
                btn.textContent = 'Memproses...';
                btn.disabled = true;
                btn.classList.add('opacity-70', 'cursor-not-allowed');

                setTimeout(() => {
                    // Reset tombol
                    btn.textContent = originalText;
                    btn.disabled = false;
                    btn.classList.remove('opacity-70', 'cursor-not-allowed');
                    
                    // Tampilkan pesan sukses
                    successMsg.classList.remove('hidden');
                    form.reset(); // Kosongkan input form

                    // Sembunyikan pesan sukses setelah 5 detik
                    setTimeout(() => {
                        successMsg.classList.add('hidden');
                    }, 5000);
                }, 1200); // Simulasi waktu proses 1.2 detik
            });
        }
    };

    // Terapkan ke 3 form yang ada
    handleFormSubmit('donation-form', 'donasi-success');
    handleFormSubmit('volunteer-form', 'volunteer-success');
    handleFormSubmit('contact-form', 'contact-success');
};
