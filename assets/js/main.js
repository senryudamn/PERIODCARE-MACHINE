/**
 * PERIODCARE MACHINE - Main JavaScript
 * Fitur: Mesin Interaktif, Fisika Lemparan Natural, Cooldown Darurat, IoT Tracker
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onValue, push } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

let db; 
let machinesData = [];

// === STATE MESIN VISUAL & PHYSICS ENGINE ===
let visualMachine = { 
    stockReguler: 12, 
    stockMaxi: 12, 
    maxPerStack: 24, 
    isProcessing: false,
    isOnCooldown: false // Fitur Jeda (Lock) Mesin
};

let activePads = []; 
// Fisika disesuaikan: Pembalut itu ringan (gravitasi kecil, pantulan empuk)
const physics = { gravity: 0.6, friction: 0.96, bounce: 0.35 };

document.addEventListener('DOMContentLoaded', async () => {
    const loader = document.getElementById('loader');
    if (loader) setTimeout(() => { loader.classList.add('opacity-0'); setTimeout(() => { loader.style.display = 'none'; }, 500); }, 500); 

    renderPhysicalStacks(); updatePhysicalScreen();
    requestAnimationFrame(physicsLoop); 

    // Sambungkan tombol fisik di mesin
    const btnReg = document.getElementById('btn-reguler');
    const btnMax = document.getElementById('btn-maxi');
    if(btnReg) btnReg.addEventListener('click', () => dispensePad('reguler'));
    if(btnMax) btnMax.addEventListener('click', () => dispensePad('maxi'));

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
    const led = document.getElementById('machine-led');
    const screen = document.getElementById('screen-status');
    if(led) led.className = `w-4 h-4 rounded-full bg-${color}-500 shadow-[0_0_12px_var(--tw-shadow-color)] shadow-${color}-500 ${isBusy ? 'led-blink-fast' : ''}`;
    if(screen) {
        screen.textContent = msg;
        screen.className = `text-${color}-400 text-[12px] font-mono font-bold text-center px-1 ${isBusy ? 'led-blink-fast' : 'animate-pulse'}`;
    }
}

// 1. KELUARKAN PEMBALUT (DENGAN COOLDOWN DARURAT 5 DETIK)
function dispensePad(type) {
    if (visualMachine.isProcessing || visualMachine.isOnCooldown) return;
    if ((type === 'reguler' && visualMachine.stockReguler <= 0) || (type === 'maxi' && visualMachine.stockMaxi <= 0)) return alert("Stok Kosong!");
    
    visualMachine.isProcessing = true;
    document.getElementById('btn-reguler').disabled = true; document.getElementById('btn-maxi').disabled = true;
    setMachineBusy(true, "MEMPROSES...", "yellow");

    setTimeout(() => {
        // Kurangi stok di dalam kaca
        if(type === 'reguler') visualMachine.stockReguler--; else visualMachine.stockMaxi--;
        renderPhysicalStacks(); updatePhysicalScreen();
        
        // Ciptakan pembalut fisik
        spawnDraggablePad(type); 

        // FITUR JEDA: Kunci mesin selama 5 detik
        visualMachine.isProcessing = false;
        visualMachine.isOnCooldown = true;
        setMachineBusy(true, "TUNGGU 5 DETIK", "red"); 

        let countdown = 5;
        const cdInterval = setInterval(() => {
            countdown--;
            if (countdown > 0) {
                document.getElementById('screen-status').textContent = `TUNGGU ${countdown} DETIK`;
            } else {
                clearInterval(cdInterval);
                visualMachine.isOnCooldown = false;
                document.getElementById('btn-reguler').disabled = false; 
                document.getElementById('btn-maxi').disabled = false;
                setMachineBusy(false, "SIAP DIGUNAKAN", "green");
            }
        }, 1000);

    }, 800); 
}

// 2. FISIKA DRAG & DROP NATURAL
function spawnDraggablePad(type) {
    const pad = document.createElement('div');
    const isReg = type === 'reguler';
    
    // PERBAIKAN: Menambahkan 'top-0 left-0' agar spawn sempurna
    pad.className = `absolute top-0 left-0 z-[99999] cursor-grab touch-none flex items-center justify-center rounded border shadow-[0_5px_15px_rgba(0,0,0,0.4)] ${isReg ? 'w-12 h-5 bg-pink-100 border-pink-300 text-pink-600' : 'w-16 h-5 bg-orange-100 border-orange-300 text-orange-600'}`;
    pad.innerHTML = `<span class="text-[8px] font-bold pointer-events-none">${isReg ? 'REG' : 'MAXI'}</span>`;
    
    const box = document.getElementById('pickup-box');
    const boxRect = box.getBoundingClientRect();
    
    // Perhitungkan Posisi Absolut
    let startX = boxRect.left + window.scrollX + (boxRect.width/2) - (isReg ? 24 : 32);
    let startY = boxRect.top + window.scrollY + 10; 
    let targetY = boxRect.top + window.scrollY + boxRect.height - 35; 
    
    document.body.appendChild(pad);

    let padObj = { 
        el: pad, type: type, 
        x: startX, y: startY, 
        w: isReg ? 48 : 64, h: 20, 
        vx: 0, vy: 0, 
        rotation: 0, vr: 0, 
        isDragging: false,
        isResting: true // Menunggu diambil, jangan jatuh dulu
    };
    activePads.push(padObj);

    // Animasi Jatuh Awal
    pad.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    pad.style.transform = `translate(${startX}px, ${startY}px)`;

    setTimeout(() => {
        padObj.y = targetY;
        pad.style.transform = `translate(${startX}px, ${targetY}px)`;
        setTimeout(() => pad.style.transition = 'none', 450); // Hapus transition agar siap di drag
    }, 50);

    // LOGIKA DRAG MOUSE / TOUCH
    let lastX = 0, lastY = 0;
    let offsetX = 0, offsetY = 0; 
    
    const onMove = (e) => {
        if(!padObj.isDragging) return;
        const pageX = e.touches ? e.touches[0].pageX : e.pageX;
        const pageY = e.touches ? e.touches[0].pageY : e.pageY;
        
        // Sensitivitas lemparan dilembutkan
        padObj.vx = (pageX - lastX) * 0.6; 
        padObj.vy = (pageY - lastY) * 0.6;
        
        padObj.x = pageX - offsetX; 
        padObj.y = pageY - offsetY;
        
        lastX = pageX; lastY = pageY;
        padObj.rotation = padObj.vx * 1.5; 
        pad.style.transform = `translate(${padObj.x}px, ${padObj.y}px) rotate(${padObj.rotation}deg) scale(1.1)`;
    };

    const onUp = (e) => {
        if(!padObj.isDragging) return;
        padObj.isDragging = false;
        pad.classList.remove('cursor-grabbing', 'scale-110'); pad.classList.add('cursor-grab');
        padObj.vr = padObj.vx * 0.5;

        window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp);
        window.removeEventListener('touchmove', onMove); window.removeEventListener('touchend', onUp);
        
        checkDonationDrop(padObj);
    };

    const onDown = (e) => {
        e.preventDefault();
        padObj.isDragging = true; padObj.isResting = false; 
        padObj.vx = 0; padObj.vy = 0; padObj.vr = 0;
        
        pad.classList.remove('cursor-grab'); pad.classList.add('cursor-grabbing');
        
        const pageX = e.touches ? e.touches[0].pageX : e.pageX;
        const pageY = e.touches ? e.touches[0].pageY : e.pageY;

        lastX = pageX; lastY = pageY;
        offsetX = pageX - padObj.x; offsetY = pageY - padObj.y;
        
        window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
        window.addEventListener('touchmove', onMove, {passive: false}); 
        window.addEventListener('touchend', onUp);
    };

    pad.addEventListener('pointerdown', onDown);
    pad.addEventListener('touchstart', onDown, {passive: false});
}

// 3. LOGIKA SLOT DONASI (ATAS MESIN)
function checkDonationDrop(padObj) {
    const dropZones = document.querySelectorAll('.drop-zone');
    
    // Perhitungkan koordinat terhadap layar (Viewport) agar sama dengan kotak slot
    let padViewportX = padObj.x + padObj.w/2 - window.scrollX;
    let padViewportY = padObj.y + padObj.h/2 - window.scrollY; 

    for (let zone of dropZones) {
        let zRect = zone.getBoundingClientRect();
        
        // Cek jika pembalut dilepas tepat di atas slot donasi
        if (padViewportX > zRect.left && padViewportX < zRect.right && padViewportY > zRect.top && padViewportY < zRect.bottom) {
            let slotType = zone.getAttribute('data-type');
            
            // JIKA UKURAN SALAH
            if (slotType !== padObj.type) {
                padObj.el.style.backgroundColor = '#fecaca'; 
                padObj.vy = -12; padObj.vx = (Math.random() - 0.5) * 15; // Terpental
                setTimeout(() => padObj.el.style.backgroundColor = '', 500);
                return;
            }

            if((slotType === 'reguler' && visualMachine.stockReguler >= visualMachine.maxPerStack) || 
               (slotType === 'maxi' && visualMachine.stockMaxi >= visualMachine.maxPerStack)) {
                alert('Rak Donasi di dalam mesin sudah penuh!'); return;
            }

            // JIKA UKURAN BENAR: Sedot ke dalam mesin
            activePads = activePads.filter(p => p !== padObj);
            padObj.el.style.transition = 'all 0.5s ease-in';
            padObj.el.style.transform = `translate(${zRect.left + window.scrollX}px, ${zRect.top + window.scrollY + 20}px) scale(0) rotate(90deg)`;
            padObj.el.style.opacity = '0';
            
            setTimeout(() => {
                padObj.el.remove();
                if(slotType === 'reguler') visualMachine.stockReguler++; else visualMachine.stockMaxi++;
                renderPhysicalStacks(); updatePhysicalScreen();
            }, 500);
            
            return;
        }
    }
}

// 4. ENGINE FISIKA (GRAVITASI & PANTULAN)
function physicsLoop() {
    const colliders = Array.from(document.querySelectorAll('.collider'));

    activePads.forEach(pad => {
        if (pad.isDragging || pad.isResting) return; 

        pad.vy += physics.gravity; 
        pad.vx *= physics.friction; 
        pad.vr *= 0.98; 

        pad.x += pad.vx;
        pad.y += pad.vy;
        pad.rotation += pad.vr;

        if (pad.x < 0) { pad.x = 0; pad.vx *= -physics.bounce; pad.vr *= -1; }
        let docWidth = document.documentElement.scrollWidth;
        if (pad.x + pad.w > docWidth) { pad.x = docWidth - pad.w; pad.vx *= -physics.bounce; pad.vr *= -1; }

        let docHeight = document.documentElement.scrollHeight;
        if (pad.y + pad.h > docHeight) {
            pad.y = docHeight - pad.h;
            pad.vy *= -physics.bounce;
            pad.vx *= 0.8; 
            pad.vr *= 0.8;
            if(Math.abs(pad.vy) < 1) { pad.vy = 0; pad.vr = 0; }
        }

        let isRestingOnCollider = false;
        for (let el of colliders) {
            let rect = el.getBoundingClientRect();
            let elTop = rect.top + window.scrollY;
            let elBottom = rect.bottom + window.scrollY;
            let elLeft = rect.left + window.scrollX;
            let elRight = rect.right + window.scrollX;

            if (pad.vy > 0 && pad.y + pad.h >= elTop && pad.y + pad.h - pad.vy <= elTop + 15 && pad.x + pad.w > elLeft && pad.x < elRight) {
                pad.y = elTop - pad.h;
                pad.vy *= -physics.bounce;
                pad.vx *= 0.8;
                pad.vr *= 0.5;
                isRestingOnCollider = true;
            }
            else if (pad.y + pad.h > elTop && pad.y < elBottom) {
                if (pad.vx > 0 && pad.x + pad.w >= elLeft && pad.x + pad.w - pad.vx <= elLeft) { pad.x = elLeft - pad.w; pad.vx *= -physics.bounce; pad.vr *= -1; }
                else if (pad.vx < 0 && pad.x <= elRight && pad.x - pad.vx >= elRight) { pad.x = elRight; pad.vx *= -physics.bounce; pad.vr *= -1; }
            }
        }

        pad.el.style.transform = `translate(${pad.x}px, ${pad.y}px) rotate(${pad.rotation}deg)`;
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
