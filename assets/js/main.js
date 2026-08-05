/**
 * PERIODCARE MACHINE - Main JavaScript
 * Fitur Visual 3D Interaktif + Tracker IoT Firebase
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onValue, push } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

let db; 
let machinesData = [];

// === LOGIKA MESIN VISUAL INTERAKTIF ===
let visualMachine = {
    stockReguler: 12,
    stockMaxi: 12,
    maxPerStack: 12,
    isProcessing: false,
    hasUnclaimedPad: false
};

document.addEventListener('DOMContentLoaded', async () => {
    // Hilangkan Preloader
    const loader = document.getElementById('loader');
    if (loader) setTimeout(() => { loader.classList.add('opacity-0'); setTimeout(() => { loader.style.display = 'none'; }, 500); }, 500); 

    // Render Awal Tumpukan Pembalut Fisik di Layar
    renderPhysicalStacks();
    updatePhysicalScreen();

    try {
        const response = await fetch('/api/config');
        const firebaseConfig = await response.json();
        const app = initializeApp(firebaseConfig);
        db = getDatabase(app);

        initNavigation();
        initScrollAnimation();
        initFirebaseLiveTracker();
        initDonationDashboard();
        initDynamicSettings(); 
        initFormValidationAndSubmission(); 
    } catch (error) {
        console.error("Gagal Firebase:", error);
    }
});

/* --- FUNGSI INTERAKSI FISIK MESIN --- */

// Fungsi untuk menggambar ulang kotak-kotak pembalut di dalam rak kaca
function renderPhysicalStacks() {
    const stackReg = document.getElementById('stack-regular');
    const stackMax = document.getElementById('stack-maxi');
    if(!stackReg || !stackMax) return;

    // Bersihkan rak (kecuali label atas)
    stackReg.innerHTML = '<div class="absolute top-0 w-full text-center text-[8px] text-gray-500 font-bold bg-gray-900/80 py-1">REGULER</div>';
    stackMax.innerHTML = '<div class="absolute top-0 w-full text-center text-[8px] text-gray-500 font-bold bg-gray-900/80 py-1">MAXI</div>';

    // Tambahkan kotak pembalut sesuai jumlah
    for(let i = 0; i < visualMachine.stockReguler; i++) {
        stackReg.innerHTML += `<div class="w-[80%] h-[8px] bg-pink-100 rounded-sm border border-pink-200 pad-item shadow-sm"></div>`;
    }
    for(let i = 0; i < visualMachine.stockMaxi; i++) {
        stackMax.innerHTML += `<div class="w-[90%] h-[8px] bg-orange-100 rounded-sm border border-orange-200 pad-item shadow-sm"></div>`;
    }
}

// Fungsi update Layar Digital
function updatePhysicalScreen() {
    const totalStock = visualMachine.stockReguler + visualMachine.stockMaxi;
    const maxTotal = visualMachine.maxPerStack * 2;
    const screenStock = document.getElementById('screen-stock-text');
    const led = document.getElementById('machine-led');
    
    if(screenStock) {
        screenStock.textContent = `Stok: ${totalStock}/${maxTotal}`;
        // Ubah warna teks berdasarkan stok
        if(totalStock > 12) screenStock.className = "text-green-400 text-[11px] font-mono mt-1 font-bold";
        else if(totalStock > 0) screenStock.className = "text-yellow-400 text-[11px] font-mono mt-1 font-bold";
        else screenStock.className = "text-red-500 text-[11px] font-mono mt-1 font-bold";
    }

    if(led && !visualMachine.isProcessing) {
        led.className = "w-4 h-4 rounded-full bg-green-500 text-green-500 shadow-[0_0_12px_#22c55e] transition-colors duration-300";
    }
}

// FUNGSI 1: TEKAN TOMBOL PENGAMBILAN
window.triggerMachineDispense = function(type) {
    if (visualMachine.isProcessing) return;
    if (visualMachine.hasUnclaimedPad) {
        alert("Silakan ambil pembalut yang sudah keluar di kotak bawah terlebih dahulu!");
        return;
    }

    if (type === 'reguler' && visualMachine.stockReguler <= 0) return alert("Stok Reguler Kosong!");
    if (type === 'maxi' && visualMachine.stockMaxi <= 0) return alert("Stok Maxi Kosong!");

    // Set Status Mesin Sibuk (Cooldown)
    visualMachine.isProcessing = true;
    
    // Ubah LED jadi Merah Kedap Kedip Cepat & Layar Kuning
    document.getElementById('machine-led').className = "w-4 h-4 rounded-full bg-red-500 text-red-500 led-blink-fast";
    document.getElementById('screen-status').textContent = "MEMPROSES...";
    document.getElementById('screen-status').className = "text-yellow-400 text-[13px] font-mono font-bold text-center px-2 led-blink-fast";
    
    // Nonaktifkan tombol sementara
    document.getElementById('btn-reguler').disabled = true;
    document.getElementById('btn-maxi').disabled = true;

    // Animasi Jatuh (Jeda 1.5 detik mesin "berpikir")
    setTimeout(() => {
        // Kurangi Stok
        if(type === 'reguler') visualMachine.stockReguler--;
        else visualMachine.stockMaxi--;
        
        renderPhysicalStacks();
        updatePhysicalScreen();

        // Munculkan pad di kotak bawah
        const droppedPad = document.getElementById('dropped-pad-box');
        droppedPad.classList.remove('translate-y-12', 'opacity-0');
        droppedPad.classList.add('translate-y-0', 'opacity-100');
        
        // Kembalikan status mesin menjadi siap tapi menunggu diambil
        visualMachine.hasUnclaimedPad = true;
        visualMachine.isProcessing = false;

        document.getElementById('machine-led').className = "w-4 h-4 rounded-full bg-yellow-400 text-yellow-400 led-blink-slow shadow-[0_0_12px_#facc15]";
        document.getElementById('screen-status').textContent = "SILAKAN AMBIL BAWAH";
        document.getElementById('screen-status').className = "text-yellow-300 text-[10px] font-mono font-bold text-center px-2 animate-pulse";

        // Tombol tetap nonaktif sampai pad diambil
    }, 1500);
};

// FUNGSI 2: AMBIL PEMBALUT DARI KOTAK
window.takeDroppedPad = function() {
    if(!visualMachine.hasUnclaimedPad) return;
    
    const droppedPad = document.getElementById('dropped-pad-box');
    droppedPad.classList.remove('translate-y-0', 'opacity-100');
    droppedPad.classList.add('translate-y-12', 'opacity-0');

    visualMachine.hasUnclaimedPad = false;

    // Reset Layar dan LED ke Hijau
    document.getElementById('machine-led').className = "w-4 h-4 rounded-full bg-green-500 text-green-500 shadow-[0_0_12px_#22c55e]";
    document.getElementById('screen-status').textContent = "SIAP DIGUNAKAN";
    document.getElementById('screen-status').className = "text-white text-[13px] font-mono font-bold text-center px-2 animate-pulse";
    
    document.getElementById('btn-reguler').disabled = false;
    document.getElementById('btn-maxi').disabled = false;
};

// FUNGSI 3: SIMULASI DONASI MASUK DARI ATAS
window.triggerMachineDonation = function() {
    if (visualMachine.isProcessing) return;
    const totalStock = visualMachine.stockReguler + visualMachine.stockMaxi;
    if (totalStock >= (visualMachine.maxPerStack * 2)) return alert("Rak di dalam mesin sudah penuh! (24/24)");

    visualMachine.isProcessing = true;
    document.getElementById('btn-reguler').disabled = true;
    document.getElementById('btn-maxi').disabled = true;

    // LED Kuning Kedip
    document.getElementById('machine-led').className = "w-4 h-4 rounded-full bg-yellow-400 text-yellow-400 led-blink-fast";
    document.getElementById('screen-status').textContent = "MENERIMA DONASI...";
    document.getElementById('screen-status').className = "text-pink-400 text-[11px] font-mono font-bold text-center px-2 led-blink-fast";

    // Animasi kotak masuk dari atas
    const animPad = document.getElementById('anim-donate-pad');
    animPad.classList.remove('opacity-0', 'translate-y-0');
    animPad.classList.add('opacity-100', 'translate-y-10'); // turun ke arah slot

    setTimeout(() => {
        // Hilangkan elemen animasi
        animPad.classList.remove('opacity-100', 'translate-y-10');
        animPad.classList.add('opacity-0', 'translate-y-0');

        // Tambah stok ke rak yang masih muat (Prioritas Reguler, lalu Maxi)
        if(visualMachine.stockReguler < visualMachine.maxPerStack) {
            visualMachine.stockReguler++;
        } else if (visualMachine.stockMaxi < visualMachine.maxPerStack) {
            visualMachine.stockMaxi++;
        }

        renderPhysicalStacks();
        updatePhysicalScreen();

        // Tampilkan Terima Kasih sejenak
        document.getElementById('machine-led').className = "w-4 h-4 rounded-full bg-green-500 text-green-500 shadow-[0_0_12px_#22c55e]";
        document.getElementById('screen-status').textContent = "TERIMA KASIH! 💖";
        document.getElementById('screen-status').className = "text-green-400 text-[13px] font-mono font-bold text-center px-2";

        setTimeout(() => {
            visualMachine.isProcessing = false;
            document.getElementById('screen-status').textContent = "SIAP DIGUNAKAN";
            document.getElementById('screen-status').className = "text-white text-[13px] font-mono font-bold text-center px-2 animate-pulse";
            if(!visualMachine.hasUnclaimedPad) {
                document.getElementById('btn-reguler').disabled = false;
                document.getElementById('btn-maxi').disabled = false;
            }
        }, 2000);

    }, 800); // Durasi jatuh masuk mesin
};


/* ========================================================
   KODE LAMA (TRACKER IOT ASLI, NAVIGASI, DASHBOARD, DLL) 
   ======================================================== */

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

const initFirebaseLiveTracker = () => {
    const container = document.getElementById('machine-list-container');
    const searchInput = document.getElementById('search-machine');
    const filterSelect = document.getElementById('filter-status');
    if(!container) return; 

    const maxStock = 24;

    const renderMachines = (data) => {
        container.innerHTML = ''; 
        if(data.length === 0) { container.innerHTML = '<p class="text-gray-500 text-center py-4">Memuat data sensor atau mesin tidak ditemukan...</p>'; return; }
        
        data.forEach(machine => {
            let stockVal = parseInt(machine.stock) || 0;
            if (stockVal > maxStock) stockVal = maxStock; 
            let percent = Math.round((stockVal / maxStock) * 100);

            let statusColor, statusBg, statusText;
            if (stockVal > 12) { statusColor = 'bg-green-500'; statusBg = 'bg-green-50'; statusText = 'Aman'; } 
            else if (stockVal > 0) { statusColor = 'bg-yellow-500'; statusBg = 'bg-yellow-50'; statusText = 'Hampir Habis'; } 
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
                    <a href="${machine.mapsLink}" target="_blank" class="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-[11px] font-semibold text-gray-600 hover:text-primary hover:border-primary hover:shadow-sm transition-all">📍 Buka di Maps</a>
                </div>
                <div class="text-left sm:text-right w-full sm:w-auto mt-2 sm:mt-0">
                    <div class="text-xs text-gray-500 font-semibold mb-1">Stok Mesin:</div>
                    <div class="text-2xl font-bold text-dark leading-none">${stockVal} <span class="text-sm font-medium text-gray-400">/ ${maxStock}</span></div>
                    <div class="w-full sm:w-24 bg-gray-200 rounded-full h-1.5 mt-2">
                        <div class="${statusColor} h-1.5 rounded-full" style="width: ${percent}%"></div>
                    </div>
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
            let stockVal = parseInt(m.stock) || 0;
            let mStatus = 'aman'; 
            if(stockVal === 0) mStatus = 'kosong'; else if(stockVal <= 12) mStatus = 'hampir-habis';
            return matchSearch && (status === 'all' || mStatus === status);
        });
        renderMachines(filtered);
    };
    
    onValue(ref(db, 'machines'), (snapshot) => {
        const data = snapshot.val(); machinesData = []; 
        if (data) for (let key in data) machinesData.push({ id: key, name: data[key].name || 'Mesin Tanpa Nama', location: data[key].location || 'Lokasi Belum Diatur', stock: data[key].stock || 0, mapsLink: data[key].mapsLink || '#' });
        applyFilters(); 
    }, () => { container.innerHTML = '<p class="text-red-500 text-center py-4">Gagal terhubung ke database. Cek koneksi Anda.</p>'; });
    searchInput.addEventListener('input', applyFilters); filterSelect.addEventListener('change', applyFilters);
};

const initDonationDashboard = () => {
    const totalEl = document.getElementById('total-donation-text');
    if(!totalEl) return; 
    const formatIDR = (number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(number);
    let targetValue = 50000000; let collectedValue = 0;
    const updateProgressUI = () => {
        document.getElementById('target-donation-text').textContent = formatIDR(targetValue);
        totalEl.textContent = formatIDR(collectedValue);
        let percentage = targetValue > 0 ? Math.round((collectedValue / targetValue) * 100) : 0;
        if(percentage > 100) percentage = 100;
        document.getElementById('progress-bar').style.width = `${percentage}%`; 
        document.getElementById('progress-percent').textContent = `${percentage}% Tercapai`;
    };
    onValue(ref(db, 'settings/targetDonation'), (snapshot) => { if(snapshot.exists()) targetValue = parseInt(snapshot.val()); updateProgressUI(); });
    onValue(ref(db, 'donations'), (snapshot) => { collectedValue = 0; if(snapshot.exists()) snapshot.forEach(child => { if(child.val().amount) collectedValue += parseInt(child.val().amount); }); updateProgressUI(); });
    onValue(ref(db, 'expenses'), (snapshot) => {
        const tbody = document.getElementById('expenses-table-body'); tbody.innerHTML = ''; 
        if (!snapshot.exists()) { tbody.innerHTML = '<tr><td colspan="4" class="py-4 text-center text-sm text-gray-500">Belum ada data pengeluaran tercatat.</td></tr>'; return; }
        const expensesArray = []; snapshot.forEach(child => expensesArray.push(child.val()));
        expensesArray.sort((a, b) => new Date(b.date) - new Date(a.date));
        expensesArray.forEach(exp => {
            let badgeColor = 'bg-gray-100 text-gray-600'; if(exp.category === 'Pembelian Stok') badgeColor = 'bg-pink-100 text-primary'; if(exp.category === 'Maintenance') badgeColor = 'bg-orange-100 text-accent'; if(exp.category === 'Operasional') badgeColor = 'bg-blue-100 text-blue-600';
            const tr = document.createElement('tr'); tr.className = 'border-b border-gray-50 hover:bg-gray-50 transition-colors';
            tr.innerHTML = `<td class="py-3 px-4 text-sm text-gray-500 whitespace-nowrap">${exp.date}</td><td class="py-3 px-4 text-sm"><span class="px-2 py-1 rounded text-xs font-semibold ${badgeColor}">${exp.category}</span></td><td class="py-3 px-4 text-sm text-gray-700">${exp.desc}</td><td class="py-3 px-4 text-sm font-bold text-dark text-right whitespace-nowrap">${formatIDR(exp.amount)}</td>`;
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
            if (settings.callCenter) {
                const callText = document.getElementById('call-center-text');
                const callLink = document.getElementById('call-center-link');
                if (callText) callText.textContent = settings.callCenter;
                if (callLink) {
                    let parsedNum = settings.callCenter.replace(/\D/g,'');
                    if(parsedNum.startsWith('0')) parsedNum = '62' + parsedNum.substring(1);
                    callLink.href = `https://wa.me/${parsedNum}`;
                }
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
                btn.textContent = 'Mengirim...'; btn.disabled = true; btn.classList.add('opacity-70', 'cursor-not-allowed');

                try {
                    const dataToPush = getDataCallback();
                    dataToPush.timestamp = new Date().toISOString(); 
                    await push(ref(db, dbNode), dataToPush);

                    successMsg.classList.remove('hidden'); form.reset(); 
                    setTimeout(() => { successMsg.classList.add('hidden'); }, 5000);
                } catch (error) { alert("Terjadi kesalahan saat menghubungi server.");
                } finally { btn.textContent = originalText; btn.disabled = false; btn.classList.remove('opacity-70', 'cursor-not-allowed'); }
            });
        }
    };

    handleFormSubmit('donation-form', 'donasi-success', 'donations', () => ({ name: document.getElementById('donator-name').value || 'Anonim', amount: document.getElementById('donation-amount').value }));
    handleFormSubmit('volunteer-form', 'volunteer-success', 'volunteers', () => ({ name: document.getElementById('vol-name').value, email: document.getElementById('vol-email').value, role: document.getElementById('vol-role').value }));
    handleFormSubmit('contact-form', 'contact-success', 'messages', () => ({ name: document.getElementById('contact-name').value, email: document.getElementById('contact-email').value, message: document.getElementById('contact-message').value }));
    handleFormSubmit('feedback-form', 'feedback-success', 'feedbacks', () => ({ name: document.getElementById('fb-name').value || 'Pengguna Anonim', rating: document.getElementById('fb-rating').value, message: document.getElementById('fb-message').value }));
};
