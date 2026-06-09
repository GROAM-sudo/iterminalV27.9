if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
}
let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let cursorOuter = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let cursorInner = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let soundEnabled = true;
let currentWeatherType = 'clear'; // clear, rain, clouds, snow, storm

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
}

document.addEventListener("DOMContentLoaded", () => {
    const cOuter = document.getElementById('custom-cursor');
    const cInner = document.getElementById('custom-cursor-dot');
    const txtEditor = document.getElementById('editor');
    const charCount = document.getElementById('char-count');

    // --- 1. MOTEUR DE CURSEUR LERP ---
    window.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
    function renderCursorLoop() {
        if (cOuter && cInner) {
            cursorOuter.x += (mouse.x - cursorOuter.x) * 0.15;
            cursorOuter.y += (mouse.y - cursorOuter.y) * 0.15;
            cursorInner.x += (mouse.x - cursorInner.x) * 0.35;
            cursorInner.y += (mouse.y - cursorInner.y) * 0.35;
            cOuter.style.left = `${cursorOuter.x}px`; cOuter.style.top = `${cursorOuter.y}px`;
            cInner.style.left = `${cursorInner.x}px`; cInner.style.top = `${cursorInner.y}px`;
        }
        requestAnimationFrame(renderCursorLoop);
    }
    renderCursorLoop();

    // --- 2. GESTION DES RELEVES METEO REELS (COMPARTIMENTÉE & SÉCURISÉE) ---
    function initRealWeather() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(async (position) => {
                const lat = position.coords.latitude.toFixed(4);
                const lon = position.coords.longitude.toFixed(4);
                
                if (document.getElementById('w-coords')) {
                    document.getElementById('w-coords').textContent = `LAT: ${lat} | LON: ${lon}`;
                }
                addLog(`[WEATHER] Position GPS validée. Analyse des flux atmosphériques...`);
                
                // Flux A : Récupération de la ville (Optionnel, ne bloque plus le reste)
                let cityName = "Station Terrestre";
                try {
                    const geoRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=fr`);
                    const geoData = await geoRes.json();
                    cityName = geoData.city || geoData.locality || "Station Terrestre";
                } catch (geoErr) {
                    console.warn("[WEATHER] Échec du géocodage nominal, passage en mode standard.");
                }

                if (document.getElementById('w-city')) document.getElementById('w-city').textContent = cityName.toUpperCase();
                if (document.getElementById('cyber-weather')) {
                    document.getElementById('cyber-weather').innerHTML = `<i class="fa-solid fa-cloud"></i> METEO : ${cityName.toUpperCase()}`;
                }

                // Flux B : Récupération des données météo physiques (Open-Meteo)
                try {
                    const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=relativehumidity_2m,uv_index`);
                    const weatherData = await weatherRes.json();
                    
                    if (weatherData && weatherData.current_weather) {
                        const current = weatherData.current_weather;
                        const temp = Math.round(current.temperature);
                        const wind = Math.round(current.windspeed);
                        const code = current.weathercode;

                        if (document.getElementById('w-temp')) document.getElementById('w-temp').textContent = `${temp}°C`;
                        if (document.getElementById('w-wind')) document.getElementById('w-wind').textContent = `${wind} km/h`;
                        if (document.getElementById('w-humidity')) {
                            document.getElementById('w-humidity').textContent = (weatherData.hourly?.relativehumidity_2m?.[0] || 50) + "%";
                        }
                        if (document.getElementById('w-uv')) {
                            document.getElementById('w-uv').textContent = (weatherData.hourly?.uv_index?.[0] || "0.5");
                        }

                        interpretWMOCode(code);
                    }
                } catch (err) {
                    addLog("[ERREUR] Liaison satellite Open-Meteo interrompue.");
                    interpretWMOCode(3); // Mode secours (Nuages)
                }
            }, (error) => {
                addLog(`[SYSTEM] Géolocalisation indisponible (Code ${error.code}). Mode simulation.`);
                if (document.getElementById('w-city')) document.getElementById('w-city').textContent = "CYBER STATION SPATIALE";
                interpretWMOCode(3);
            });
        }
    }
    initRealWeather();

    // Traduction des codes meteo standard mondiaux (WMO)
    function interpretWMOCode(code) {
        const desc = document.getElementById('w-desc');
        const iconZone = document.getElementById('w-icon');
        if (!desc || !iconZone) return;
        
        if (code === 0) {
            currentWeatherType = 'clear';
            desc.textContent = "CIEL PUR — RADIATIONS SOLAIRES OPTIMALES";
            iconZone.innerHTML = `<i class="fa-solid fa-sun"></i>`;
        } else if ([1, 2, 3].includes(code)) {
            currentWeatherType = 'clouds';
            desc.textContent = "CUMULUS DE CODE — COUVERTURE PARTIELLE";
            iconZone.innerHTML = `<i class="fa-solid fa-cloud-sun"></i>`;
        } else if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) {
            currentWeatherType = 'rain';
            desc.textContent = "PLUIE ACIDE ANALOGIQUE — PRENEZ VOS COUVERTURES";
            iconZone.innerHTML = `<i class="fa-solid fa-cloud-showers-water"></i>`;
        } else if ([71, 73, 75, 77, 85, 86].includes(code)) {
            currentWeatherType = 'snow';
            desc.textContent = "GEL CRYOGÉNIQUE INFRA-ROUGE — TEMPÉRATURES FAIBLES";
            iconZone.innerHTML = `<i class="fa-solid fa-snowflake"></i>`;
        } else {
            currentWeatherType = 'storm';
            desc.textContent = "ORAGE CYBERNETIQUE — SURTENSION CELLULAIRE PROBABLE";
            iconZone.innerHTML = `<i class="fa-solid fa-cloud-bolt"></i>`;
        }
        addLog(`[ENV] Météo mise à jour : ${currentWeatherType.toUpperCase()}`);
    }

    // --- 3. MOTEUR ANIMATION RENDU CANVAS METEO ---
    const canvas = document.getElementById('weather-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let particles = [];

        function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        class Particle {
            constructor() { this.reset(); }
            reset() {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * -canvas.height;
                this.speed = 4 + Math.random() * 6;
                this.size = 1 + Math.random() * 2;
                this.opacity = 0.1 + Math.random() * 0.5;
                this.text = Math.random() > 0.5 ? "1" : "0";
            }
            update() {
                if (currentWeatherType === 'rain' || currentWeatherType === 'storm') {
                    this.y += this.speed * 1.5;
                    this.x += (mouse.x - window.innerWidth/2) * 0.01;
                } else if (currentWeatherType === 'snow') {
                    this.y += this.speed * 0.3;
                    this.x += Math.sin(this.y / 30) * 0.5;
                } else if (currentWeatherType === 'clouds') {
                    this.x += this.speed * 0.05;
                    if (this.x > canvas.width) this.x = -50;
                }
                if (this.y > canvas.height) this.reset();
            }
            draw() {
                ctx.fillStyle = `rgba(0, 255, 65, ${this.opacity})`;
                if (currentWeatherType === 'rain' || currentWeatherType === 'storm') {
                    ctx.font = `${this.size * 6}px monospace`;
                    ctx.fillText(this.text, this.x, this.y);
                } else if (currentWeatherType === 'snow') {
                    ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
                    ctx.beginPath(); ctx.arc(this.x, this.y, this.size * 2, 0, Math.PI * 2); ctx.fill();
                } else if (currentWeatherType === 'clouds') {
                    ctx.fillStyle = `rgba(255, 255, 255, 0.015)`;
                    ctx.beginPath(); ctx.arc(this.x, this.y, this.size * 30, 0, Math.PI * 2); ctx.fill();
                }
            }
        }

        for(let i=0; i<150; i++) particles.push(new Particle());

        function animateWeather() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            if (currentWeatherType === 'clear') {
                let gradient = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 10, canvas.width/2, canvas.height/2, canvas.width/1.2);
                gradient.addColorStop(0, 'rgba(255, 110, 0, 0.04)');
                gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = gradient; ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            
            if (currentWeatherType === 'storm' && Math.random() > 0.98) {
                ctx.fillStyle = 'rgba(255,255,255,0.15)';
                ctx.fillRect(0,0,canvas.width,canvas.height);
            }

            particles.forEach(p => { p.update(); p.draw(); });
            requestAnimationFrame(animateWeather);
        }
        animateWeather();
    }

    // --- 4. CLAVIER MECANIQUE AUDIO & EDITEUR ---
    if (txtEditor) {
        txtEditor.innerHTML = localStorage.getItem("iterminal_pwa_save") || `<p><span style="color: var(--accent-color); font-weight: bold;">// STANDALONE APPLICATION INITIALIZED...</span></p>`;
        txtEditor.addEventListener('input', () => {
            localStorage.setItem("iterminal_pwa_save", txtEditor.innerHTML);
            if (charCount) charCount.textContent = txtEditor.innerText.length;
            if (soundEnabled) {
                let audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                let osc = audioCtx.createOscillator(); let gain = audioCtx.createGain();
                osc.type = 'sine'; osc.frequency.setValueAtTime(140 + Math.random() * 180, audioCtx.currentTime);
                gain.gain.setValueAtTime(0.03, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.03);
                osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + 0.03);
            }
        });
    }

    // Horloge synchrone
    setInterval(() => {
        const clockEl = document.getElementById('system-clock');
        if (clockEl) clockEl.innerHTML = `<i class="fa-solid fa-clock"></i> ` + new Date().toLocaleTimeString();
    }, 1000);
});

// --- 5. SYSTEM ACTIONS INTERFACES ---
function openWeatherPage() { 
    document.getElementById('weather-page').classList.add('open'); 
    document.getElementById('main-terminal-view').style.filter = "blur(15px) scale(0.98)";
}
function closeWeatherPage() { 
    document.getElementById('weather-page').classList.remove('open'); 
    document.getElementById('main-terminal-view').style.filter = "none";
}
function toggleSettings() { document.getElementById('settings-panel').classList.toggle('open'); }
function addLog(m) { 
    const consoleEl = document.getElementById('log-console');
    if (consoleEl) consoleEl.innerHTML += `<br>[${new Date().toLocaleTimeString()}] ${m}`; 
}
function execCmd(c, v=null) { document.execCommand(c, false, v); }
function toggleSound() { soundEnabled = !soundEnabled; document.getElementById('sound-toggle').innerHTML = soundEnabled ? `<i class="fa-solid fa-volume-high"></i> AUDIO ON` : `<i class="fa-solid fa-volume-xmark"></i> MUTED`; }
function updateGlass() {
    const op = document.getElementById('opacity-picker').value; const bl = document.getElementById('blur-picker').value;
    document.documentElement.style.setProperty('--glass-bg', `rgba(9, 10, 15, ${op / 100})`);
    document.documentElement.style.setProperty('--glass-blur', `${bl}px`);
}
function toggleDayNight() {
    document.body.classList.toggle('light-terminal');
    const isLight = document.body.classList.contains('light-terminal');
    document.getElementById('daynight-toggle').innerHTML = isLight ? `<i class="fa-solid fa-sun"></i> DAY` : `<i class="fa-solid fa-moon"></i> NIGHT`;
    document.documentElement.style.setProperty('--accent-color', isLight ? '#d84315' : '#00ff41');
}
function changeTheme(theme) {
    currentWeatherType = theme === 'matrix' ? 'storm' : 'clear';
    addLog(`[THEME] Changement d'univers visuel.`);
}

// --- 6. EXPORT ---
function exportStyledFile() {
    const dataContent = document.getElementById('editor').innerHTML;
    const currentAccent = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim();

    const compiledSource = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <title>Terminal Export — Cryptographic Stream</title>
        <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { background-color: #030306; color: #ffffff; font-family: 'JetBrains Mono', monospace; min-height: 100vh; display: flex; justify-content: center; align-items: center; padding: 40px; position: relative; overflow: hidden; }
            canvas { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; }
            .window { width: 100%; max-width: 880px; background: rgba(10, 11, 18, 0.95); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; box-shadow: 0 45px 90px rgba(0,0,0,0.85); overflow: hidden; position: relative; z-index: 10; backdrop-filter: blur(10px); }
            .header { background: rgba(255, 255, 255, 0.02); padding: 16px 24px; display: flex; align-items: center; border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
            .dots { display: flex; gap: 7px; margin-right: 20px; } .dot { width: 12px; height: 12px; border-radius: 50%; }
            .r { background: #ff5f56; } .y { background: #ffbd2e; } .g { background: #27c93f; }
            .title { font-size: 12px; color: rgba(255, 255, 255, 0.35); }
            .body { padding: 40px; line-height: 1.7; font-size: 16px; position: relative; }
            :root { --accent: ${currentAccent}; }
            h1, h2, h3 { color: var(--accent); }
        </style>
    </head>
    <body>
        <canvas id="rickCanvas"></canvas>
        <div class="window">
            <div class="header">
                <div class="dots"><div class="dot r"></div><div class="dot y"></div><div class="dot g"></div></div>
                <div class="title">root@ios27-standalone:~ /Output/package.html</div>
            </div>
            <div class="body">${dataContent}</div>
        </div>
        <script>
            const canvas = document.getElementById('rickCanvas'); const ctx = canvas.getContext('2d');
            function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; } resize();
            const textStream = "NEVER GONNA GIVE YOU UP NEVER GONNA LET YOU DOWN 010101 ";
            const columns = Math.floor(canvas.width / 16); const drops = Array(columns).fill(1);
            function draw() {
                ctx.fillStyle = 'rgba(3, 3, 6, 0.06)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '${currentAccent}'; ctx.font = '12px monospace';
                for (let i = 0; i < drops.length; i++) {
                    const txt = textStream[Math.floor(Math.random() * textStream.length)];
                    ctx.fillText(txt, i * 16, drops[i] * 16);
                    if (drops[i] * 16 > canvas.height && Math.random() > 0.975) drops[i] = 0;
                    drops[i]++;
                }
            } setInterval(draw, 33);
        </script>
    </body>
    </html>`;

    const blob = new Blob([compiledSource], { type: "text/html" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob); link.download = "terminal_note.html"; link.click();
}