/**
 * PERIODCARE MACHINE - Main JavaScript
 * Fitur: Mesin Interaktif 2.5D, Fisika Drag & Drop, IoT Tracker
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onValue, push } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

let db; 
let machinesData = [];

// === STATE MESIN VISUAL & PHYSICS ENGINE ===
let visualMachine = { stockReguler: 12, stockMaxi: 12, maxPerStack: 24, isProcessing: false };
let activePads = []; // Menampung pembalut yang sedang dilempar/dijatuhkan
const physics = { gravity: 0.8, friction: 0.85, bounce: 0.5 };

document.addEventListener('DOMContentLoaded', async () => {
    const loader = document.getElementById('loader');
    if (loader) setTimeout(() => { loader.classList.add('opacity-0'); setTimeout(() => { loader.style.display = 'none'; }, 500); }, 500); 

    renderPhysicalStacks(); updatePhysicalScreen();
    requestAnimationFrame(physicsLoop); // Jalankan Physics Engine

    // Event Listener untuk Tombol Dispense Mesin
    document.getElementById('btn-reguler').addEventListener('click', () => dispensePad('reguler'));
    document.getElementById('btn-maxi').addEventListener('click', () => dispensePad('maxi'));

    try {
        const response = await fetch('/api/config');
        const app = initializeApp(await response.json());
        db = getDatabase(app);
        initNavigation(); initScrollAnimation(); initFirebaseLiveTracker(); initDonationDashboard(); initDynamicSettings(); initFormValidationAndSubmission(); 
    } catch (error) { console.error("Firebase API Error"); }
});

/* =======================================================
   MODUL MESIN INTERAKTIF & PHYSICS (DRAG, DROP, GRAVITY)
   ======================================================= */

function renderPhysicalStacks() {
    const stackReg = document.getElementById('stack-regular'); const stackMax = document.getElementById('stack-maxi');
    if(!stackReg || !stackMax) return;
    stackReg.innerHTML = '<div class="absolute top-0 w-full text-center text-[8px] text-gray-500 font-bold bg-gray-900/80 py-1 z-10">REGULER</div>';
    stackMax.innerHTML = '<div class="absolute top-0 w-full text-center text-[8px] text-gray-500 font-bold bg-gray-900/80 py-1 z-10">MAXI</div>';
    for(let i = 0; i < visualMachine.stockReguler; i++) stackReg.innerHTML += `<div class="w-[80%] h-[7px] bg-pink-100 rounded-sm border border-pink-200 pad-item shadow-sm z-0"></div>`;
    for(let i = 0; i < visualMachine.stockMaxi; i++) stackMax.innerHTML += `<div class="w-[90%] h-[7px] bg-orange-100 rounded-sm border border-orange-200 pad-item shadow-sm z-0"></div>`;
}

function updatePhysicalScreen() {
    const totalStock = visualMachine.stockReguler + visualMachine.stockMaxi;
    const maxTotal = visualMachine.maxPerStack * 2;
    const screenStock = document.getElementById('screen-stock-text');
    if(screenStock) {
        screenStock.textContent = `Stok: ${totalStock}/${maxTotal}`;
        screenStock.className = totalStock > 12 ? "text-green-400 text-[11px] font-mono mt-1 font-bold" : (totalStock > 0 ? "text-yellow-400 text-[11px] font-mono mt-1 font-bold" : "text-red-500 text-[11px] font-mono mt-1 font-bold");
    }
}

function setMachineBusy(isBusy, msg, color) {
    visualMachine.isProcessing = isBusy;
    document.getElementById('btn-reguler').disabled = isBusy; document.getElementById('btn-maxi').disabled = isBusy;
    document.getElementById('machine-led').className = `w-4 h-4 rounded-full bg-${color}-500 shadow-[0_0_12px_var(--tw-shadow-color)] shadow-${color}-500 ${isBusy ? 'led-blink-fast' : ''}`;
    document.getElementById('screen-status').textContent = msg;
    document.getElementById('screen-status').className = `text-${color}-400 text-[12px] font-mono font-bold text-center px-1 ${isBusy ? 'led-blink-fast' : 'animate-pulse'}`;
}

// 1. KELUARKAN PEMBALUT KE PICKUP BOX (DENGAN JEDA)
function dispensePad(type) {
    if (visualMachine.isProcessing) return;
    if ((type === 'reguler' && visualMachine.stockReguler <= 0) || (type === 'maxi' && visualMachine.stockMaxi <= 0)) return alert("Stok Kosong!");
    
    setMachineBusy(true, "MEMPROSES...", "yellow");

    // Jeda 1.5 Detik agar mesin seolah memproses secara mekanik
    setTimeout(() => {
        if(type === 'reguler') visualMachine.stockReguler--; else visualMachine.stockMaxi--;
        renderPhysicalStacks(); updatePhysicalScreen();
        
        spawnDraggablePad(type); 
        
        setTimeout(() => {
            setMachineBusy(false, "SIAP DIGUNAKAN", "green");
        }, 500); // Tunggu animasi pad jatuh selesai
    }, 1500);
}

// 2. CIPTAKAN PEMBALUT FISIK (ANIMASI JATUH & DRAGGABLE)
function spawnDraggablePad(type) {
    const pad = document.createElement('div');
    const isReg = type === 'reguler';
    pad.className = `fixed top-0 left-0 z-[99999] cursor-grab touch-none flex items-center justify-center rounded border shadow-[0_5px_15px_rgba(0,0,0,0.4)] ${isReg ? 'w-12 h-5 bg-pink-100 border-pink-300 text-pink-600' : 'w-16 h-5 bg-orange-100 border-orange-300 text-orange-600'}`;
    pad.innerHTML = `<span class="text-[8px] font-bold pointer-events-none">${isReg ? 'REG' : 'MAXI'}</span>`;
    
    const box = document.getElementById('pickup-box').getBoundingClientRect();
    
    // Titik awal dari dalam mesin (atas), titik akhir di dasar kotak
    let startX = box.left + box.width/2 - (isReg ? 24 : 32);
    let startY = box.top - 20; 
    let targetY = box.top + box.height - 35; 
    
    document.body.appendChild(pad);

    let padObj = { 
        el: pad, type: type, 
        x: startX, y: startY, 
        w: isReg ? 48 : 64, h: 20, 
        vx: 0, vy: 0, 
        isDragging: false,
        isResting: true // Mencegah gravitasi langsung menariknya tembus layar
    };
    activePads.push(padObj);

    // Animasi Pantulan Jatuh (Bounce)
    pad.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    pad.style.transform = `translate(${startX}px, ${startY}px)`;

    // Paksa browser membaca titik awal sebelum animasi
    void pad.offsetWidth;

    // Gerakkan ke dasar Pickup Box
    padObj.y = targetY;
    pad.style.transform = `translate(${startX}px, ${targetY}px)`;

    setTimeout(() => {
        pad.style.transition = 'none'; // Hapus CSS transition agar drag lancar
    }, 450);

    // Logika Mouse/Touch (Sistem Drag)
    let lastX = 0, lastY = 0;
    
    const onMove = (e) => {
        if(!padObj.isDragging) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        padObj.vx = clientX - lastX; 
        padObj.vy = clientY - lastY;
        padObj.x = clientX - padObj.w/2; 
        padObj.y = clientY - padObj.h/2;
        lastX = clientX; lastY = clientY;
        pad.style.transform = `translate(${padObj.x}px, ${padObj.y}px) rotate(${padObj.vx * 2}deg) scale(1.1)`;
    };

    const onUp = (e) => {
        if(!padObj.isDragging) return;
        padObj.isDragging = false;
        pad.classList.remove('cursor-grabbing', 'scale-110'); pad.classList.add('cursor-grab');
        pad.style.transform = `translate(${padObj.x}px, ${padObj.y}px) rotate(0deg) scale(1)`;
        
        window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp);
        window.removeEventListener('touchmove', onMove); window.removeEventListener('touchend', onUp);
        
        checkDonationDrop(padObj);
    };

    const onDown = (e) => {
        e.preventDefault();
        padObj.isDragging = true;
        padObj.isResting = false; // Melepas efek anti-gravitasi
        padObj.vx = 0; padObj.vy = 0;
        pad.classList.remove('cursor-grab'); pad.classList.add('cursor-grabbing');
        
        lastX = e.touches ? e.touches[0].clientX : e.clientX;
        lastY = e.touches ? e.touches[0].clientY : e.clientY;
        
        window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
        window.addEventListener('touchmove', onMove, {passive: false}); window.addEventListener('touchend', onUp);
    };

    pad.addEventListener('pointerdown', onDown);
    pad.addEventListener('touchstart', onDown, {passive: false});
}

// 3. LOGIKA SLOT DONASI (VALIDASI UKURAN)
function checkDonationDrop(padObj) {
    const dropZones = document.querySelectorAll('.drop-zone');
    let padRect = padObj.el.getBoundingClientRect();
    let padCenterX = padRect.left + padRect.width/2;
    let padCenterY = padRect.top + padRect.height/2;

    for (let zone of dropZones) {
        let zRect = zone.getBoundingClientRect();
        // Cek apakah pembalut dilepas tepat di atas slot donasi
        if (padCenterX > zRect.left && padCenterX < zRect.right && padCenterY > zRect.top && padCenterY < zRect.bottom) {
            
            let slotType = zone.getAttribute('data-type');
            
            // Validasi Ukuran (Beda Ukuran = Terpental)
            if (slotType !== padObj.type) {
                padObj.el.style.backgroundColor = '#fecaca'; // Kedip Merah Error
                padObj.vy = -15; padObj.vx = (Math.random() - 0.5) * 20; 
                setTimeout(() => padObj.el.style.backgroundColor = '', 500);
                return;
            }

            // Benar, masuk!
            if((slotType === 'reguler' && visualMachine.stockReguler >= visualMachine.maxPerStack) || 
               (slotType === 'maxi' && visualMachine.stockMaxi >= visualMachine.maxPerStack)) {
                alert('Rak Donasi di dalam mesin sudah penuh!'); return;
            }

            // Hapus dari list fisika, jalankan animasi tersedot
            activePads = activePads.filter(p => p !== padObj);
            padObj.el.style.transition = 'all 0.5s ease-in';
            padObj.el.style.transform = `translate(${zRect.left}px, ${zRect.top + 20}px) scale(0) rotate(90deg)`;
            padObj.el.style.opacity = '0';
            
            setMachineBusy(true, "MENERIMA DONASI...", "pink");
            
            setTimeout(() => {
                padObj.el.remove(); // Hapus elemen
                if(slotType === 'reguler') visualMachine.stockReguler++; else visualMachine.stockMaxi++;
                renderPhysicalStacks(); updatePhysicalScreen();
                setMachineBusy(false, "TERIMA KASIH! 💖", "green");
                setTimeout(() => { if(!visualMachine.isProcessing) setMachineBusy(false, "SIAP DIGUNAKAN", "green"); }, 2000);
            }, 500);
            
            return;
        }
    }
}

// 4. PHYSICS ENGINE (GRAVITASI & COLLISION PADA KONTEN WEB)
function physicsLoop() {
    const colliders = Array.from(document.querySelectorAll('.collider'));

    activePads.forEach(pad => {
        if (pad.isDragging || pad.isResting) return; // Abaikan gravitasi jika sedang ditarik atau diam di kotak bawah

        pad.vy += physics.gravity; // Terapkan Gravitasi
        pad.x += pad.vx;
        pad.y += pad.vy;

        // Batas Kiri Kanan Layar
        if (pad.x < 0) { pad.x = 0; pad.vx *= -physics.bounce; }
        if (pad.x + pad.w > window.innerWidth) { pad.x = window.innerWidth - pad.w; pad.vx *= -physics.bounce; }

        // Batas Bawah Layar
        if (pad.y + pad.h > window.innerHeight) {
            pad.y = window.innerHeight - pad.h;
            pad.vy *= -physics.bounce;
            pad.vx *= physics.friction;
            if(Math.abs(pad.vy) < 1) pad.vy = 0;
        }

        // Tumbukan (Collision) dengan elemen HTML (.collider)
        let isRestingOnCollider = false;
        for (let el of colliders) {
            let rect = el.getBoundingClientRect();
            // Cek tumbukan atas
            if (pad.vy > 0 && 
                pad.y + pad.h >= rect.top && pad.y + pad.h - pad.vy <= rect.top + 15 && 
                pad.x + pad.w > rect.left && pad.x < rect.right) {
                    pad.y = rect.top - pad.h;
                    pad.vy *= -physics.bounce;
                    pad.vx *= physics.friction;
                    isRestingOnCollider = true;
            }
            // Pantulan tembok elemen
            else if (pad.y + pad.h > rect.top && pad.y < rect.bottom) {
                if (pad.vx > 0 && pad.x + pad.w >= rect.left && pad.x + pad.w - pad.vx <= rect.left) { pad.x = rect.left - pad.w; pad.vx *= -physics.bounce; }
                else if (pad.vx < 0 && pad.x <= rect.right && pad.x - pad.vx >= rect.right) { pad.x = rect.right; pad.vx *= -physics.bounce; }
            }
        }

        if(!isRestingOnCollider && pad.vy !== 0) pad.vx *= 0.99; // Gesekan udara

        pad.el.style.transform = `translate(${pad.x}px, ${pad.y}px)`;
    });

    requestAnimationFrame(physicsLoop);
}

/* =======================================================
   KODE LAMA (TRACKER IOT ASLI, NAVIGASI, DASHBOARD, DLL)
   ======================================================= */
const initNavigation = () => {
    const mobileMenuBtn = document.getElementById('mobile-menu-btn'); const mobileMenu = document.getElementById('mobile-menu'); const navbar = document.getElementById('navbar');
    if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));
    document.querySelectorAll('.mobile-link').forEach(link => link.addEventListener('click', () => mobileMenu.classList.add('hidden')));
    window.addEventListener('scroll', () => { if (window.scrollY > 10) { navbar.classList.add('shadow-md'); navbar.classList.remove('shadow-sm'); } else { navbar.classList.add('shadow-sm'); navbar.classList.remove('shadow-md'); } });
};

const initScrollAnimation = () => {
    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.remove('opacity-0', 'translate-y-10'); entry.target.classList.add('opacity-100', 'translate-y-0', 'transition-all', 'duration-700', 'ease-out'); obs.unobserve(entry.target); } });
    }, { threshold: 0.1 });
    document.querySelectorAll('.scroll-animate').forEach(el => observer.observe(el));
};

const initFirebaseLiveTracker = () => {
    const container = document.getElementById('machine-list-container'); const searchInput = document.getElementById('search-machine'); const filterSelect = document.getElementById('filter-status');
    if(!container) return; const maxStock = 24;
    const renderMachines = (data) => {
        container.innerHTML = ''; if(data.length === 0) { container.innerHTML = '<p class="text-gray-500 text-center py-4">Mesin tidak ditemukan...</p>'; return; }
        data.forEach(m => {
            let stockVal = parseInt(m.stock) || 0; if (stockVal > maxStock) stockVal = maxStock; let percent = Math.round((stockVal / maxStock) * 100);
            let sC = stockVal > 12 ? 'bg-green-500' : (stockVal > 0 ? 'bg-yellow-500' : 'bg-red-500'); let sBg = stockVal > 12 ? 'bg-green-50' : (stockVal > 0 ? 'bg-yellow-50' : 'bg-red-50'); let sT = stockVal > 12 ? 'Aman' : (stockVal > 0 ? 'Hampir Habis' : 'Kosong');
            container.innerHTML += `<div class="p-4 rounded-xl border border-gray-100 ${sBg} flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all hover:shadow-md collider"><div class="w-full sm:w-auto flex-1"><div class="flex items-center gap-2 mb-1"><span class="text-xs font-mono font-bold text-gray-500">${m.id}</span><span class="px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${sC}">${sT}</span></div><h4 class="font-bold text-dark text-sm mb-1">${m.name}</h4><p class="text-xs text-gray-600 mb-2">${m.location}</p><a href="${m.mapsLink}" target="_blank" class="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-[11px] font-semibold text-gray-600 hover:text-primary hover:shadow-sm">📍 Buka di Maps</a></div><div class="text-left sm:text-right w-full sm:w-auto mt-2 sm:mt-0"><div class="text-xs text-gray-500 font-semibold mb-1">Stok Mesin:</div><div class="text-2xl font-bold text-dark leading-none">${stockVal} <span class="text-sm font-medium text-gray-400">/ ${maxStock}</span></div><div class="w-full sm:w-24 bg-gray-200 rounded-full h-1.5 mt-2"><div class="${sC} h-1.5 rounded-full" style="width: ${percent}%"></div></div></div></div>`;
        });
    };
    const applyFilters = () => {
        const query = searchInput.value.toLowerCase(); const status = filterSelect.value;
        renderMachines(machinesData.filter(m => {
            const matchSearch = m.name.toLowerCase().includes(query) || m.location.toLowerCase().includes(query);
            let sV = parseInt(m.stock) || 0; let mS = sV === 0 ? 'kosong' : (sV <= 12 ? 'hampir-habis' : 'aman');
            return matchSearch && (status === 'all' || mS === status);
        }));
    };
    onValue(ref(db, 'machines'), (snapshot) => {
        const data = snapshot.val(); machinesData = []; 
        if (data) for (let key in data) machinesData.push({ id: key, name: data[key].name, location: data[key].location, stock: data[key].stock || 0, mapsLink: data[key].mapsLink });
        applyFilters(); 
    });
    searchInput.addEventListener('input', applyFilters); filterSelect.addEventListener('change', applyFilters);
};

const initDonationDashboard = () => {
    const totalEl = document.getElementById('total-donation-text'); if(!totalEl) return; 
    const fIDR = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
    let target = 50000000; let collected = 0;
    const updateUI = () => {
        document.getElementById('target-donation-text').textContent = fIDR(target); totalEl.textContent = fIDR(collected);
        let p = target > 0 ? Math.round((collected / target) * 100) : 0; if(p > 100) p = 100;
        document.getElementById('progress-bar').style.width = `${p}%`; document.getElementById('progress-percent').textContent = `${p}% Tercapai`;
    };
    onValue(ref(db, 'settings/targetDonation'), (s) => { if(s.exists()) target = parseInt(s.val()); updateUI(); });
    onValue(ref(db, 'donations'), (s) => { collected = 0; if(s.exists()) s.forEach(c => { if(c.val().amount) collected += parseInt(c.val().amount); }); updateUI(); });
    onValue(ref(db, 'expenses'), (s) => {
        const tbody = document.getElementById('expenses-table-body'); tbody.innerHTML = ''; 
        if (!s.exists()) return tbody.innerHTML = '<tr><td colspan="4" class="py-4 text-center text-sm text-gray-500">Belum ada pengeluaran.</td></tr>';
        const arr = []; s.forEach(c => arr.push(c.val())); arr.sort((a, b) => new Date(b.date) - new Date(a.date));
        arr.forEach(e => {
            let bc = e.category === 'Pembelian Stok' ? 'bg-pink-100 text-primary' : (e.category === 'Maintenance' ? 'bg-orange-100 text-accent' : 'bg-blue-100 text-blue-600');
            tbody.innerHTML += `<tr class="border-b border-gray-50 hover:bg-gray-50"><td class="py-3 px-4 text-sm text-gray-500">${e.date}</td><td class="py-3 px-4 text-sm"><span class="px-2 py-1 rounded text-xs font-semibold ${bc}">${e.category}</span></td><td class="py-3 px-4 text-sm text-gray-700">${e.desc}</td><td class="py-3 px-4 text-sm font-bold text-dark text-right">${fIDR(e.amount)}</td></tr>`;
        });
    });
};

const initDynamicSettings = () => {
    onValue(ref(db, 'settings'), (s) => {
        const d = s.val(); if (!d) return;
        if (d.mapsLink && document.getElementById('maps-iframe')) document.getElementById('maps-iframe').src = d.mapsLink;
        if (d.qrisUrl && document.getElementById('qris-img')) document.getElementById('qris-img').src = d.qrisUrl;
        if (d.callCenter) {
            const t = document.getElementById('call-center-text'); const l = document.getElementById('call-center-link');
            if (t) t.textContent = d.callCenter;
            if (l) { let p = d.callCenter.replace(/\D/g,''); if(p.startsWith('0')) p = '62' + p.substring(1); l.href = `https://wa.me/${p}`; }
        }
    });
};

const initFormValidationAndSubmission = () => {
    const handle = (id, msgId, dbNode, getD) => {
        const form = document.getElementById(id); const msg = document.getElementById(msgId);
        if (form && msg) form.addEventListener('submit', async (e) => {
            e.preventDefault(); const btn = form.querySelector('button[type="submit"]'); const txt = btn.textContent;
            btn.textContent = 'Mengirim...'; btn.disabled = true; btn.classList.add('opacity-70');
            try { const d = getD(); d.timestamp = new Date().toISOString(); await push(ref(db, dbNode), d);
                msg.classList.remove('hidden'); form.reset(); setTimeout(() => msg.classList.add('hidden'), 5000);
            } catch (error) { alert("Terjadi kesalahan."); } finally { btn.textContent = txt; btn.disabled = false; btn.classList.remove('opacity-70'); }
        });
    };
    handle('donation-form', 'donasi-success', 'donations', () => ({ name: document.getElementById('donator-name').value || 'Anonim', amount: document.getElementById('donation-amount').value }));
    handle('volunteer-form', 'volunteer-success', 'volunteers', () => ({ name: document.getElementById('vol-name').value, email: document.getElementById('vol-email').value, role: document.getElementById('vol-role').value }));
    handle('contact-form', 'contact-success', 'messages', () => ({ name: document.getElementById('contact-name').value, email: document.getElementById('contact-email').value, message: document.getElementById('contact-message').value }));
    handle('feedback-form', 'feedback-success', 'feedbacks', () => ({ name: document.getElementById('fb-name').value || 'Pengguna Anonim', rating: document.getElementById('fb-rating').value, message: document.getElementById('fb-message').value }));
};
