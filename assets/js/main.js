/**
 * PERIODCARE MACHINE - Main JavaScript
 * Fitur: Skematik 3-Panel, Real Scale Physics, Global Coordinates Drag, Visual Reward Partikel
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
    isOnCooldown: false 
};

let activePads = []; 
let hintTimeout; 

const physics = { gravity: 0.85, friction: 0.95, bounce: 0.30 };

document.addEventListener('DOMContentLoaded', async () => {
    const loader = document.getElementById('loader');
    if (loader) setTimeout(() => { loader.classList.add('opacity-0'); setTimeout(() => { loader.style.display = 'none'; }, 500); }, 500); 

    renderPhysicalStacks(); updatePhysicalScreen();
    requestAnimationFrame(physicsLoop); 

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
   ANIMASI TUTORIAL DRAG (KURSOR ESTETIK)
   ======================================================= */
function showDragHint() {
    const hint = document.getElementById('drag-hint-wrapper');
    const icon = document.getElementById('drag-hint-icon');
    if(hint && icon) {
        hint.classList.remove('hidden');
        icon.classList.add('animate-swipe-cursor');
        clearTimeout(hintTimeout);
        hintTimeout = setTimeout(() => {
            hint.classList.add('hidden');
            icon.classList.remove('animate-swipe-cursor');
        }, 10000); 
    }
}

function hideDragHint() {
    const hint = document.getElementById('drag-hint-wrapper');
    const icon = document.getElementById('drag-hint-icon');
    if(hint && icon) {
        hint.classList.add('hidden');
        icon.classList.remove('animate-swipe-cursor');
        clearTimeout(hintTimeout);
    }
}

/* =======================================================
   MODUL MESIN INTERAKTIF & SINKRONISASI TIGA PANEL
   ======================================================= */

function renderPhysicalStacks() {
    const stackReg = document.getElementById('stack-regular'); 
    const stackMax = document.getElementById('stack-maxi');
    if(stackReg && stackMax) {
        stackReg.innerHTML = '<div class="absolute top-0 w-full text-center text-[8px] text-gray-500 font-bold bg-gray-900/80 py-1 z-10">REGULER</div>';
        stackMax.innerHTML = '<div class="absolute top-0 w-full text-center text-[8px] text-gray-500 font-bold bg-gray-900/80 py-1 z-10">MAXI</div>';
        for(let i = 0; i < visualMachine.stockReguler; i++) stackReg.innerHTML += `<div class="w-[80%] h-[7px] bg-pink-100 rounded-[1px] border border-pink-300 pad-item shadow-sm z-0 transition-all duration-300"></div>`;
        for(let i = 0; i < visualMachine.stockMaxi; i++) stackMax.innerHTML += `<div class="w-[90%] h-[7px] bg-orange-100 rounded-[1px] border border-orange-300 pad-item shadow-sm z-0 transition-all duration-300"></div>`;
    }

    let regVisualCount = Math.min(visualMachine.stockReguler, 36);
    let maxiVisualCount = Math.min(visualMachine.stockMaxi, 36);

    const stackLeftFrontReg = document.getElementById('stack-left-front-reg');
    const stackLeftBackMaxi = document.getElementById('stack-left-back-maxi');
    if(stackLeftFrontReg) {
        stackLeftFrontReg.innerHTML = '';
        for(let i=0; i<regVisualCount; i++) stackLeftFrontReg.innerHTML += `<div class="w-[85%] h-[6px] bg-pink-200 rounded-[1px] border border-pink-400 shadow-[0_1px_2px_rgba(0,0,0,0.5)] shrink-0 transition-all duration-300"></div>`;
    }
    if(stackLeftBackMaxi) {
        stackLeftBackMaxi.innerHTML = '';
        for(let i=0; i<maxiVisualCount; i++) stackLeftBackMaxi.innerHTML += `<div class="w-[85%] h-[6px] bg-orange-300/40 rounded-[1px] border border-orange-400/40 shadow-sm shrink-0 transition-all duration-300"></div>`;
    }

    const stackRightFrontMaxi = document.getElementById('stack-right-front-maxi');
    const stackRightBackReg = document.getElementById('stack-right-back-reg');
    if(stackRightFrontMaxi) {
        stackRightFrontMaxi.innerHTML = '';
        for(let i=0; i<maxiVisualCount; i++) stackRightFrontMaxi.innerHTML += `<div class="w-[85%] h-[6px] bg-orange-200 rounded-[1px] border border-orange-400 shadow-[0_1px_2px_rgba(0,0,0,0.5)] shrink-0 transition-all duration-300"></div>`;
    }
    if(stackRightBackReg) {
        stackRightBackReg.innerHTML = '';
        for(let i=0; i<regVisualCount; i++) stackRightBackReg.innerHTML += `<div class="w-[85%] h-[6px] bg-pink-300/40 rounded-[1px] border border-pink-400/40 shadow-sm shrink-0 transition-all duration-300"></div>`;
    }
}

function updatePhysicalScreen() {
    const totalStock = visualMachine.stockReguler + visualMachine.stockMaxi;
    const maxTotal = visualMachine.maxPerStack * 2;
    const screenStock = document.getElementById('screen-stock-text');
    if(screenStock) {
        screenStock.textContent = `Stok: ${totalStock}/${maxTotal}`;
        screenStock.className = totalStock > 12 ? "text-green-400 text-[11px] font-mono mt-1 font-bold transition-colors" : (totalStock > 0 ? "text-yellow-400 text-[11px] font-mono mt-1 font-bold transition-colors" : "text-red-500 text-[11px] font-mono mt-1 font-bold transition-colors");
    }
}

function setMachineBusy(isBusy, msg, color) {
    const led = document.getElementById('machine-led');
    const screen = document.getElementById('screen-status');
    
    if(led) led.className = `w-4 h-4 rounded-full bg-${color}-500 shadow-[0_0_12px_var(--tw-shadow-color)] shadow-${color}-500 ${isBusy ? 'led-blink-fast' : ''}`;
    
    if(screen) {
        screen.classList.replace('opacity-100', 'opacity-0');
        setTimeout(() => {
            screen.textContent = msg;
            screen.className = `text-${color}-400 text-[12px] font-mono font-bold text-center px-2 transition-opacity duration-300 ease-in-out opacity-100 ${isBusy ? 'led-blink-fast' : 'animate-pulse'}`;
        }, 300);
    }
}

function dispensePad(type) {
    if (visualMachine.isProcessing || visualMachine.isOnCooldown) return;
    if ((type === 'reguler' && visualMachine.stockReguler <= 0) || (type === 'maxi' && visualMachine.stockMaxi <= 0)) return alert("Stok Kosong!");
    
    visualMachine.isProcessing = true;
    document.getElementById('btn-reguler').disabled = true; document.getElementById('btn-maxi').disabled = true;
    
    setMachineBusy(true, "MEMPROSES...", "yellow");

    const isReg = type === 'reguler';

    const armId = isReg ? 'pusher-arm-left' : 'pusher-arm-right';
    const arm = document.getElementById(armId);
    if(arm) {
        arm.style.transform = 'scaleX(1.8)'; 
        setTimeout(() => { arm.style.transform = 'scaleX(1)'; }, 200); 
    }

    if(isReg) visualMachine.stockReguler--; else visualMachine.stockMaxi--;
    renderPhysicalStacks(); updatePhysicalScreen();

    const sidePadId = isReg ? 'side-drop-pad-left' : 'side-drop-pad-right';
    const sidePad = document.getElementById(sidePadId);

    if(sidePad) {
        sidePad.className = `w-12 h-[6px] rounded-[1px] shadow border absolute bottom-[144px] right-[44px] z-30 pointer-events-none opacity-100 ${isReg ? 'bg-pink-200 border-pink-400' : 'bg-orange-200 border-orange-400'}`;
        
        void sidePad.offsetWidth; 
        sidePad.classList.add('animate-side-push-drop'); 
        
        setTimeout(() => {
            sidePad.classList.remove('animate-side-push-drop');
            sidePad.style.opacity = '0'; 
            
            spawnDraggablePad(type); 
            setTimeout(showDragHint, 600);

            visualMachine.isProcessing = false;
            visualMachine.isOnCooldown = true;
            setMachineBusy(true, "TUNGGU 5 DETIK", "red"); 

            let countdown = 5;
            const cdInterval = setInterval(() => {
                countdown--;
                if (countdown > 0) {
                    setMachineBusy(true, `TUNGGU ${countdown} DETIK`, "red");
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
}

// ========================================================
// CORE FIX: LOCAL COORDINATE PHYSICS SYSTEM & DRAG FIX
// ========================================================
function spawnDraggablePad(type) {
    const machine = document.getElementById('machine-body');
    if(!machine) return;

    const pad = document.createElement('div');
    const isReg = type === 'reguler';
    
    pad.className = `absolute z-20 cursor-grab touch-none flex items-center justify-center rounded border shadow-[0_5px_15px_rgba(0,0,0,0.4)] ${isReg ? 'bg-pink-100 border-pink-300 text-pink-600' : 'bg-orange-100 border-orange-300 text-orange-600'}`;
    pad.innerHTML = `<span class="text-[8px] font-bold pointer-events-none">${isReg ? 'REG' : 'MAXI'}</span>`;
    
    let padW = isReg ? 48 : 64;
    pad.style.width = padW + 'px';
    pad.style.height = '20px';

    machine.appendChild(pad);

    let startX = 160 - (padW / 2); 
    let startY = 460; 

    let padObj = { 
        el: pad, type: type, 
        x: startX, y: startY, 
        w: padW, h: 20, 
        vx: (Math.random() - 0.5) * 4, 
        vy: -6, // Efek Pop up dari mesin
        rotation: (Math.random() - 0.5) * 30, 
        vr: (Math.random() - 0.5) * 10, 
        isDragging: false,
        isResting: false 
    };
    activePads.push(padObj);

    pad.style.transform = `translate(${startX}px, ${startY}px) rotate(${padObj.rotation}deg)`;

    let lastX = 0, lastY = 0;
    let offsetX = 0, offsetY = 0; 
    
    const onMove = (e) => {
        if(!padObj.isDragging) return;
        e.preventDefault(); 

        const mRect = machine.getBoundingClientRect();
        const scale = mRect.width / 320; 
        
        const absoluteLeft = mRect.left + window.scrollX;
        const absoluteTop = mRect.top + window.scrollY;

        const pageX = e.touches ? e.touches[0].pageX : e.pageX;
        const pageY = e.touches ? e.touches[0].pageY : e.pageY;

        const localX = (pageX - absoluteLeft) / scale;
        const localY = (pageY - absoluteTop) / scale;

        padObj.vx = (localX - lastX) * 0.7; 
        padObj.vy = (localY - lastY) * 0.7;
        
        padObj.x = localX - offsetX; 
        padObj.y = localY - offsetY;
        
        lastX = localX; 
        lastY = localY;

        padObj.rotation = padObj.vx * 1.2; 
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
        hideDragHint();

        pad.classList.replace('z-20', 'z-50');

        padObj.isDragging = true;
        padObj.isResting = false; 
        padObj.vx = 0; padObj.vy = 0; padObj.vr = 0;
        
        pad.classList.remove('cursor-grab'); pad.classList.add('cursor-grabbing');
        
        const mRect = machine.getBoundingClientRect();
        const scale = mRect.width / 320;
        const absoluteLeft = mRect.left + window.scrollX;
        const absoluteTop = mRect.top + window.scrollY;

        const pageX = e.touches ? e.touches[0].pageX : e.pageX;
        const pageY = e.touches ? e.touches[0].pageY : e.pageY;

        const localX = (pageX - absoluteLeft) / scale;
        const localY = (pageY - absoluteTop) / scale;

        lastX = localX; 
        lastY = localY;
        offsetX = localX - padObj.x;
        offsetY = localY - padObj.y;
        
        window.addEventListener('pointermove', onMove, {passive: false}); window.addEventListener('pointerup', onUp);
        window.addEventListener('touchmove', onMove, {passive: false}); window.addEventListener('touchend', onUp);
    };

    pad.addEventListener('pointerdown', onDown);
    pad.addEventListener('touchstart', onDown, {passive: false});
}

function checkDonationDrop(padObj) {
    const dropZones = document.querySelectorAll('.drop-zone');
    
    const padRect = padObj.el.getBoundingClientRect();
    const padCenterX = padRect.left + padRect.width / 2;
    const padCenterY = padRect.top + padRect.height / 2;

    for (let zone of dropZones) {
        let zRect = zone.getBoundingClientRect();
        
        if (padCenterX > zRect.left && padCenterX < zRect.right && padCenterY > zRect.top && padCenterY < zRect.bottom) {
            let slotType = zone.getAttribute('data-type');
            
            if (slotType !== padObj.type) {
                padObj.el.style.backgroundColor = '#fecaca'; 
                padObj.vy = -12; padObj.vx = (Math.random() - 0.5) * 15; 
                setTimeout(() => padObj.el.style.backgroundColor = '', 500);
                return;
            }

            if((slotType === 'reguler' && visualMachine.stockReguler >= visualMachine.maxPerStack) || 
               (slotType === 'maxi' && visualMachine.stockMaxi >= visualMachine.maxPerStack)) {
                alert('Rak Donasi di dalam mesin sudah penuh!'); return;
            }

            const isReg = slotType === 'reguler';

            activePads = activePads.filter(p => p !== padObj);
            padObj.el.style.transition = 'all 0.5s cubic-bezier(0.25, 1, 0.5, 1)';
            
            const machine = document.getElementById('machine-body');
            const mRect = machine.getBoundingClientRect();
            const scale = mRect.width / 320;
            const absoluteLeft = mRect.left + window.scrollX;
            const absoluteTop = mRect.top + window.scrollY;

            let targetLocalX = (zRect.left + window.scrollX - absoluteLeft) / scale;
            let targetLocalY = (zRect.top + window.scrollY + 20 - absoluteTop) / scale;
            
            padObj.el.style.transform = `translate(${targetLocalX}px, ${targetLocalY}px) scale(0) rotate(90deg)`;
            padObj.el.style.opacity = '0';
            
            setMachineBusy(true, "MENERIMA DONASI...", "pink");

            const sideDonatePadId = isReg ? 'side-donate-pad-left' : 'side-donate-pad-right';
            const sideDonatePad = document.getElementById(sideDonatePadId);

            if(sideDonatePad) {
                sideDonatePad.className = `w-12 h-[6px] rounded-[1px] shadow border absolute top-[30px] right-[44px] z-30 pointer-events-none opacity-100 ${isReg ? 'bg-pink-200 border-pink-400' : 'bg-orange-200 border-orange-400'}`;
                void sideDonatePad.offsetWidth; 
                sideDonatePad.classList.add('animate-side-donate-drop');
            }

            for(let i=0; i<6; i++){
                setTimeout(() => {
                    let particle = document.createElement('div');
                    particle.innerHTML = ['✨','💖','⭐','🎀'][Math.floor(Math.random()*4)];
                    particle.className = 'animate-particle drop-shadow-md';
                    particle.style.left = (padCenterX - 15) + 'px';
                    particle.style.top = padCenterY + 'px';
                    particle.style.setProperty('--tx', `${(Math.random() - 0.5) * 80}px`);
                    particle.style.setProperty('--ty', `${(Math.random() - 1) * 120}px`);
                    document.body.appendChild(particle);
                    setTimeout(() => particle.remove(), 1000);
                }, i * 100);
            }

            setTimeout(() => {
                padObj.el.remove();
                if(sideDonatePad) {
                    sideDonatePad.classList.remove('animate-side-donate-drop');
                    sideDonatePad.style.opacity = '0';
                }
                
                if(isReg) visualMachine.stockReguler++; else visualMachine.stockMaxi++;
                
                renderPhysicalStacks(); updatePhysicalScreen();
                setMachineBusy(false, "TERIMA KASIH!", "green");
            }, 600);
            
            return;
        }
    }
}

// MESIN FISIKA LOKAL (ANTI JATUH KELUAR)
function physicsLoop() {
    activePads.forEach(pad => {
        if (pad.isDragging || pad.isResting) return; 

        pad.vy += physics.gravity; 
        pad.vx *= physics.friction; 
        pad.vr *= 0.98; 

        pad.x += pad.vx;
        pad.y += pad.vy;
        pad.rotation += pad.vr;

        // Bounding Box Lokal (Mesin 320x560)
        if (pad.x < 10) { pad.x = 10; pad.vx *= -physics.bounce; pad.vr *= -0.5; }
        if (pad.x + pad.w > 310) { pad.x = 310 - pad.w; pad.vx *= -physics.bounce; pad.vr *= -0.5; }

        // Membatasi lantai hanya sampai bagian dasar kotak pengambilan hitam
        if (pad.y + pad.h > 530) {
            pad.y = 530 - pad.h;
            pad.vy *= -physics.bounce;
            pad.vx *= 0.8; 
            pad.vr *= 0.5;
            if(Math.abs(pad.vy) < 1) { pad.vy = 0; pad.vr = 0; }
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
            container.innerHTML += `<div class="p-4 rounded-xl border border-gray-100 ${sBg} flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all hover:shadow-md"><div class="w-full sm:w-auto flex-1"><div class="flex items-center gap-2 mb-1"><span class="text-xs font-mono font-bold text-gray-500">${m.id}</span><span class="px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${sC}">${sT}</span></div><h4 class="font-bold text-dark text-sm mb-1">${m.name}</h4><p class="text-xs text-gray-600 mb-2">${m.location}</p><a href="${m.mapsLink}" target="_blank" class="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-[11px] font-semibold text-gray-600 hover:text-primary hover:shadow-sm">📍 Buka di Maps</a></div><div class="text-left sm:text-right w-full sm:w-auto mt-2 sm:mt-0"><div class="text-xs text-gray-500 font-semibold mb-1">Stok Mesin:</div><div class="text-2xl font-bold text-dark leading-none">${stockVal} <span class="text-sm font-medium text-gray-400">/ ${maxStock}</span></div><div class="w-full sm:w-24 bg-gray-200 rounded-full h-1.5 mt-2"><div class="${sC} h-1.5 rounded-full" style="width: ${percent}%"></div></div></div></div>`;
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

/* =======================================================
   FITUR POPUP TIM DOMPET KITA
   ======================================================= */
window.openTeamModal = function() {
    const modal = document.getElementById('teamModal');
    const content = document.getElementById('teamModalContent');
    
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        content.classList.remove('scale-95');
    }, 10);
    
    loadTeamMembersUser();
}

window.closeTeamModal = function() {
    const modal = document.getElementById('teamModal');
    const content = document.getElementById('teamModalContent');
    
    modal.classList.add('opacity-0');
    content.classList.add('scale-95');
    
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

function loadTeamMembersUser() {
    const teamData = JSON.parse(localStorage.getItem('periodCareTeam')) || [];
    const container = document.getElementById('teamContainer');
    
    if (teamData.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-8">
                <p class="text-gray-500 italic">Data tim belum ditambahkan. Silakan atur melalui panel Admin.</p>
            </div>`;
        return;
    }

    container.innerHTML = teamData.map(member => {
        const tx = member.photoTx || 0;
        const ty = member.photoTy || 0;
        const scale = member.photoScale || 1;
        
        return `
        <div class="bg-white border border-gray-100 rounded-3xl flex flex-col overflow-hidden shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
            <div class="w-full h-64 bg-gray-100 relative overflow-hidden flex items-center justify-center">
                <div class="w-full h-full relative transition-opacity duration-300 group-hover:opacity-90">
                    <img src="${member.photo}" alt="${member.name}" class="absolute w-full h-full object-cover" style="transform: translate(${tx}%, ${ty}%) scale(${scale});">
                </div>
            </div>
            <div class="p-6 flex flex-col items-center text-center bg-white relative z-10 border-t-[5px] border-pink-100 group-hover:border-pink-400 transition-colors">
                <span class="text-[10px] font-bold text-pink-700 bg-pink-100 px-3 py-1 rounded-full mb-3 uppercase tracking-wider">${member.role}</span>
                <h3 class="font-bold text-gray-800 text-xl">${member.name}</h3>
                <p class="text-sm text-gray-500 mt-1 font-medium">${member.desc}</p>
            </div>
        </div>
        `;
    }).join('');
}
