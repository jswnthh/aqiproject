// ============================================================================
// GLOBAL STATE & CONFIGURATION
// ============================================================================

let notifications = [];
let analyticsChart = null;
window.sensorState = {};
window.activeSensorCount = 1;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe.replace(/[&<"'>]/g, function (m) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }[m];
    });
}

function getAQIColor(aqi) {
    if (aqi <= 50) return '#00E396';      // Good (Green)
    if (aqi <= 100) return '#FEB019';     // Moderate (Yellow)
    if (aqi <= 150) return '#f05233';     // Poor (Orange)
    return '#ce1c1c';                     // Severe (Red)
}

/**
 * Get CSRF token from cookies
 */
async function getCSRFToken() {
    const name = 'csrftoken';
    const cookies = document.cookie ? document.cookie.split(';') : [];
    for (let i = 0; i < cookies.length; i++) {
        const c = cookies[i].trim();
        if (c.startsWith(name + '=')) {
            return decodeURIComponent(c.substring(name.length + 1));
        }
    }
    return '';
}

/**
 * Drag and drop event handlers
 */
function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function highlight(e) {
    e.currentTarget.classList.add('dragover');
}

function unhighlight(e) {
    e.currentTarget.classList.remove('dragover');
}

// ============================================================================
// SENSOR CARD RENDERING
// ============================================================================

/**
 * Build HTML for a single sensor card
 */
function buildSensorCardHTML(sensor) {
    const color = sensor.aqi === '—' ? '#999' : getAQIColor(sensor.aqi);

    const category =
        sensor.aqi === '—' ? 'Waiting for data' :
            sensor.aqi <= 50 ? 'Good' :
                sensor.aqi <= 100 ? 'Moderate' :
                    sensor.aqi <= 150 ? 'Unhealthy' :
                        'Hazardous';

    return `
        <div class="sensor-card-inner">
            <!-- FRONT -->
            <div class="sensor-card front">
                <div class="sensor-card-header">
                    <div class="sensor-icon-badge">
                        <i class="fas fa-broadcast-tower"></i>
                    </div>
                    <div class="sensor-identity">
                        <h4>${sensor.id}</h4>
                        <p><i class="fas fa-map-marker-alt"></i> ${sensor.name}</p>
                    </div>
                    <div class="sensor-status-badge ${sensor.status || 'loading'}">
                        <i class="fas fa-circle"></i>
                    </div>
                </div>
                
                <div class="aqi-display">
                    <div class="aqi-label">
                        <i class="fas fa-wind"></i> Air Quality Index
                    </div>
                    <div class="aqi-value-wrapper">
                        <div class="aqi-value" style="color: ${color};">
                            ${sensor.aqi}
                        </div>
                        <div class="aqi-category" style="color: ${color};">
                            ${category}
                        </div>
                    </div>
                </div>
                
                <button class="flip-btn" onclick="event.stopPropagation();">
                    <i class="fas fa-info-circle"></i> View Details
                </button>
            </div>

            <!-- BACK -->
            <div class="sensor-card back">
                <div class="sensor-card-header">
                    <div class="sensor-icon-badge">
                        <i class="fas fa-chart-line"></i>
                    </div>
                    <div class="sensor-identity">
                        <h4>Pollutant Levels</h4>
                        <p><i class="fas fa-flask"></i> Live Readings</p>
                    </div>
                </div>
                
                <div class="details-grid">
                    <div class="detail-row">
                        <div class="detail-icon no2">
                            <i class="fas fa-smog"></i>
                        </div>
                        <div class="detail-content">
                            <span class="detail-label">Nitrogen Dioxide</span>
                            <span class="detail-value">
                                ${sensor.no2} <span class="detail-unit">ppb</span>
                            </span>
                        </div>
                    </div>
                    
                    <div class="detail-row">
                        <div class="detail-icon co">
                            <i class="fas fa-fire"></i>
                        </div>
                        <div class="detail-content">
                            <span class="detail-label">Carbon Monoxide</span>
                            <span class="detail-value">
                                ${sensor.co} <span class="detail-unit">ppm</span>
                            </span>
                        </div>
                    </div>
                    
                    <div class="detail-row">
                        <div class="detail-icon smoke">
                            <i class="fas fa-cloud"></i>
                        </div>
                        <div class="detail-content">
                            <span class="detail-label">Smoke Particles</span>
                            <span class="detail-value">
                                ${sensor.smoke} <span class="detail-unit">µg/m³</span>
                            </span>
                        </div>
                    </div>
                </div>
                
                <button class="flip-btn" onclick="event.stopPropagation();">
                    <i class="fas fa-arrow-left"></i> Back to Overview
                </button>
            </div>
        </div>
    `;
}

/**
 * Render initial sensor cards with loading state
 */
function renderSensorCards(count) {
    const grid = document.querySelector('.sensor-grid');
    if (!grid) return;

    grid.innerHTML = '';
    const mapSensors = window.sensors || {};

    for (let i = 1; i <= count; i++) {
        const mapSensor = mapSensors[i];
        if (!mapSensor) {
            console.warn(`No sensor definition for index ${i}`);
            continue;
        }

        const card = document.createElement('div');
        card.className = 'sensor-card-wrapper';
        card.dataset.sensorId = mapSensor.id;
        card.dataset.sensorIndex = i;
        console.log(`Rendering card for sensor: ${mapSensor.id} (${mapSensor.name})`);

        // Initial render with loading state
        card.innerHTML = buildSensorCardHTML({
            id: mapSensor.id,
            name: mapSensor.name,
            aqi: '—',
            no2: '—',
            co: '—',
            smoke: '—',
            status: 'loading'
        });

        grid.appendChild(card);
    }

    bindFlipButtons();
}

/**
 * Update existing sensor cards with fresh data from sensorState
 */
function updateSensorCardsFromDB() {
    const wrappers = document.querySelectorAll('.sensor-card-wrapper');

    wrappers.forEach(wrapper => {
        const sensorId = wrapper.dataset.sensorId;
        const sensorIndex = wrapper.dataset.sensorIndex;
        const mapSensor = window.sensors[sensorIndex];

        if (!mapSensor) return;

        // Get live data from sensorState
        const liveData = window.sensorState[sensorId] || window.sensorState[mapSensor.name];

        // Build sensor object
        const sensor = {
            id: mapSensor.id,
            name: mapSensor.name,
            aqi: liveData?.aqi ?? '—',
            no2: liveData?.no2 ?? '—',
            co: liveData?.co ?? '—',
            smoke: liveData?.smoke ?? '—',
            status: liveData ? 'online' : 'loading'
        };

        // Update the card HTML
        wrapper.innerHTML = buildSensorCardHTML(sensor);
    });

    // Re-bind event handlers after updating HTML
    bindFlipButtons();
}

/**
 * Bind flip button and analytics click handlers
 */
function bindFlipButtons() {
    // Flip button handlers
    document.querySelectorAll('.flip-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            btn.closest('.sensor-card-wrapper').classList.toggle('flipped');
        };
    });

    // Card click for analytics
    document.querySelectorAll('.sensor-card-wrapper').forEach(wrapper => {
        wrapper.onclick = (e) => {
            // Don't trigger if clicking the flip button
            if (e.target.closest('.flip-btn')) return;

            const sensorId = wrapper.dataset.sensorId;
            const sensorIndex = wrapper.dataset.sensorIndex;

            showSensorAnalytics(sensorId, sensorIndex);
        };
    });
}

// ============================================================================
// SENSOR ANALYTICS MODAL
// ============================================================================

/**
 * Show analytics modal for specific sensor
 */
function showSensorAnalytics(sensorId, sensorIndex) {
    console.log('📊 Opening analytics for sensor:', sensorId);

    const mapSensor = window.sensors[sensorIndex];
    const liveData = window.sensorState[sensorId] || window.sensorState[mapSensor?.name];

    if (!mapSensor) {
        console.error('Sensor not found:', sensorId);
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'analytics-modal';
    modal.innerHTML = `
        <div class="analytics-modal-overlay" onclick="this.parentElement.remove()"></div>
        <div class="analytics-modal-content">
            <div class="analytics-header">
                <div>
                    <h2>${sensorId}</h2>
                    <p>${mapSensor.name}</p>
                </div>
                <button class="close-analytics" onclick="this.closest('.analytics-modal').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="analytics-body">
                <div class="analytics-current">
                    <h3>Current Readings</h3>
                    <div class="analytics-stats">
                        <div class="analytics-stat">
                            <span class="stat-label">AQI</span>
                            <span class="stat-value" style="color: ${getAQIColor(liveData?.aqi ?? 50)}">
                                ${liveData?.aqi ?? '--'}
                            </span>
                        </div>
                        <div class="analytics-stat">
                            <span class="stat-label">NO₂</span>
                            <span class="stat-value">${liveData?.no2 ?? '--'} ppb</span>
                        </div>
                        <div class="analytics-stat">
                            <span class="stat-label">CO</span>
                            <span class="stat-value">${liveData?.co ?? '--'} ppm</span>
                        </div>
                        <div class="analytics-stat">
                            <span class="stat-label">Smoke</span>
                            <span class="stat-value">${liveData?.smoke ?? '--'} µg/m³</span>
                        </div>
                    </div>
                </div>
                
                <div class="analytics-chart-section">
                    <h3>24-Hour Trend</h3>
                    <div class="analytics-chart-placeholder">
                        <canvas id="sensorChart-${sensorId}"></canvas>
                    </div>
                </div>
                
                <div class="analytics-logs">
                    <h3>Recent Activity</h3>
                    <div class="log-list" id="logs-${sensorId}">
                        <div class="log-entry">
                            <span class="log-time">${new Date().toLocaleTimeString()}</span>
                            <span class="log-message">Sensor reading updated</span>
                        </div>
                        <div class="log-entry">
                            <span class="log-time">${new Date(Date.now() - 300000).toLocaleTimeString()}</span>
                            <span class="log-message">AQI status: ${liveData?.aqi > 100 ? 'Moderate' : 'Good'}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Initialize chart after modal is in DOM
    setTimeout(() => {
        initSensorChart(sensorId, liveData?.aqi ?? 50);
    }, 100);
}

/**
 * Initialize sensor-specific chart
 */
function initSensorChart(sensorId, currentAqi) {
    const ctx = document.getElementById(`sensorChart-${sensorId}`);
    if (!ctx) return;

    // Generate 24-hour historical data (simulated)
    const labels = [];
    const data = [];
    const now = new Date();

    for (let i = 23; i >= 0; i--) {
        const hour = new Date(now - i * 3600000);
        labels.push(hour.getHours() + ':00');
        data.push(Math.max(10, currentAqi + (Math.random() - 0.5) * 20));
    }

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'AQI',
                data: data,
                borderColor: getAQIColor(currentAqi),
                backgroundColor: getAQIColor(currentAqi) + '20',
                borderWidth: 2,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#aaa'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#aaa',
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 8
                    }
                }
            }
        }
    });
}

// ============================================================================
// SENSOR COUNT CONTROL
// ============================================================================

function initSensorCounterButtons() {
    const btnMinus = document.getElementById('sensorMinus');
    const btnPlus = document.getElementById('sensorPlus');
    const countEl = document.getElementById('sensorCount');

    if (!btnMinus || !btnPlus || !countEl) return;

    const MIN = 1;
    const MAX = 10;

    if (typeof window.activeSensorCount !== 'number') {
        window.activeSensorCount = MIN;
    }

    countEl.textContent = window.activeSensorCount;
    renderSensorCards(window.activeSensorCount);

    // function sync() {
    //     countEl.textContent = window.activeSensorCount;
    //     renderSensorCards(window.activeSensorCount);

    //     // Notify map.js
    //     window.dispatchEvent(
    //         new CustomEvent('sensorCountChanged', {
    //             detail: window.activeSensorCount
    //         })
    //     );

    //     console.log('✅ Sensor Count Synced:', window.activeSensorCount);
    // }
    async function sync() {
        countEl.textContent = window.activeSensorCount;
        renderSensorCards(window.activeSensorCount);

        // ✅ CRITICAL FIX: Notify backend of the count change
        try {
            const response = await fetch('/api/set_sensor_count/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': await getCSRFToken()
                },
                body: JSON.stringify({
                    count: window.activeSensorCount
                })
            });

            const data = await response.json();
            if (data.success) {
                console.log('✅ Backend sensor count updated:', data.sensor_count);
            } else {
                console.error('❌ Failed to update backend sensor count');
            }
        } catch (error) {
            console.error('❌ Error updating backend sensor count:', error);
        }

        // Notify map.js
        window.dispatchEvent(
            new CustomEvent('sensorCountChanged', {
                detail: window.activeSensorCount
            })
        );

        console.log('✅ Sensor Count Synced:', window.activeSensorCount);
    }

    btnPlus.onclick = () => {
        if (window.activeSensorCount >= MAX) return;
        window.activeSensorCount++;
        sync();
    };

    btnMinus.onclick = () => {
        if (window.activeSensorCount <= MIN) return;
        window.activeSensorCount--;
        sync();
    };
}

// ============================================================================
// TERMINAL SIDEBAR
// ============================================================================

function initTerminalSidebar() {
    const widgetBtn = document.getElementById("widgetToggle");
    const terminalSidebar = document.getElementById("terminalSidebar");
    const closeBtn = document.getElementById("closeSidebar");
    const startSimBtn = document.getElementById("startSimBtn");
    const stopSimBtn = document.getElementById("stopSimBtn");
    const resetSimBtn = document.getElementById("resetSimBtn");
    const terminalContent = document.getElementById("terminalContent");

    if (!widgetBtn || !terminalSidebar || !terminalContent) {
        console.warn("Terminal sidebar elements missing");
        return;
    }

    let logPollingInterval = null;
    let isPolling = false;

    widgetBtn.addEventListener("click", () => {
        terminalSidebar.classList.remove("hidden");
        terminalSidebar.classList.toggle("open");

        if (terminalSidebar.classList.contains("open")) {
            checkSimulationStatus();
        }
    });

    closeBtn?.addEventListener("click", () => {
        terminalSidebar.classList.remove("open");
    });

    function addTerminalLog(type, message, timestamp = null) {
        const time = timestamp || new Date().toLocaleTimeString();
        const logLine = document.createElement("div");
        logLine.className = `terminal-line log-${type.toLowerCase()}`;
        logLine.innerHTML = `
            <span class="terminal-timestamp">[${time}]</span>
            <span class="terminal-prompt">[${type}]</span>
            <span class="terminal-text">${message}</span>
        `;
        terminalContent.appendChild(logLine);
        terminalContent.scrollTop = terminalContent.scrollHeight;
    }

    function clearTerminal() {
        terminalContent.innerHTML = `
            <div class="terminal-line">
                <span class="terminal-prompt">[SYSTEM]</span>
                <span class="terminal-text">Environment Simulator Ready</span>
            </div>
            <div class="terminal-line">
                <span class="terminal-prompt">[INFO]</span>
                <span class="terminal-text">Awaiting command...</span>
            </div>
        `;
    }

    async function fetchLogs() {
        try {
            const response = await fetch("/api/logs/");
            if (!response.ok) throw new Error("Failed to fetch logs");

            const data = await response.json();
            terminalContent.innerHTML = "";

            if (data.logs && data.logs.length > 0) {
                data.logs.forEach(log => {
                    addTerminalLog(log.level, log.message, log.timestamp);
                });
            } else {
                clearTerminal();
            }
        } catch (err) {
            console.error("Log fetch error:", err);
            addTerminalLog("ERROR", "Failed to fetch logs from server");
        }
    }

    function startLogPolling() {
        if (isPolling) return;
        isPolling = true;
        fetchLogs();
        logPollingInterval = setInterval(fetchLogs, 2000);
    }

    function stopLogPolling() {
        isPolling = false;
        if (logPollingInterval) {
            clearInterval(logPollingInterval);
            logPollingInterval = null;
        }
    }

    async function checkSimulationStatus() {
        try {
            const response = await fetch("/api/simulation_status/");
            const data = await response.json();

            if (data.running) {
                startSimBtn.disabled = true;
                stopSimBtn.disabled = false;
                startLogPolling();
            } else {
                startSimBtn.disabled = false;
                stopSimBtn.disabled = true;
                stopLogPolling();
            }
        } catch (err) {
            console.error("Status check error:", err);
        }
    }

    async function startSimulation() {
        try {
            startSimBtn.disabled = true;
            addTerminalLog("SYSTEM", "Initializing simulation...");

            const sensorCount = parseInt(
                document.getElementById("sensorCount").textContent
            );

            const response = await fetch("/api/simulation/start/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    sensor_count: sensorCount
                })
            });

            const data = await response.json();

            if (data.success) {
                addTerminalLog("SUCCESS", data.message);
                stopSimBtn.disabled = false;
                startLogPolling();
            } else {
                addTerminalLog("ERROR", data.message);
                startSimBtn.disabled = false;
            }
        } catch (err) {
            console.error("Start simulation error:", err);
            addTerminalLog("ERROR", "Failed to start simulation");
            startSimBtn.disabled = false;
        }
    }

    async function stopSimulation() {
        try {
            stopSimBtn.disabled = true;
            addTerminalLog("SYSTEM", "Stopping simulation...");

            const response = await fetch("/api/simulation/stop/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                }
            });

            const data = await response.json();

            if (data.success) {
                addTerminalLog("SUCCESS", data.message);
                startSimBtn.disabled = false;
                stopLogPolling();
            } else {
                addTerminalLog("ERROR", data.message);
                stopSimBtn.disabled = false;
            }
        } catch (err) {
            console.error("Stop simulation error:", err);
            addTerminalLog("ERROR", "Failed to stop simulation");
            stopSimBtn.disabled = false;
        }
    }

    async function resetSimulation() {
        try {
            stopLogPolling();
            addTerminalLog("SYSTEM", "Resetting simulation...");

            const response = await fetch("/api/simulation/reset/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                }
            });

            const data = await response.json();

            if (data.success) {
                setTimeout(() => {
                    clearTerminal();
                    addTerminalLog("SUCCESS", "Simulation reset complete");
                }, 500);

                startSimBtn.disabled = false;
                stopSimBtn.disabled = true;
            } else {
                addTerminalLog("ERROR", data.message);
            }
        } catch (err) {
            console.error("Reset simulation error:", err);
            addTerminalLog("ERROR", "Failed to reset simulation");
        }
    }

    startSimBtn?.addEventListener("click", startSimulation);
    stopSimBtn?.addEventListener("click", stopSimulation);
    resetSimBtn?.addEventListener("click", resetSimulation);

    checkSimulationStatus();
}

// ============================================================================
// MOBILE SIDEBAR
// ============================================================================

function initMobileSidebar() {
    const menuToggle = document.querySelector('.menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('mobile-visible');
            if (overlay) overlay.classList.toggle('active');
        });
    }

    if (overlay) {
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('mobile-visible');
            overlay.classList.remove('active');
        });
    }
}

// ============================================================================
// THEME MANAGEMENT
// ============================================================================

function initTheme() {
    const themeToggle = document.getElementById('themeToggle');
    const settingsToggle = document.getElementById('settingsThemeToggle');
    const htmlElement = document.documentElement;
    const icon = themeToggle ? themeToggle.querySelector('i') : null;

    function applyTheme(isLight) {
        const theme = isLight ? 'light' : 'dark';

        if (isLight) {
            htmlElement.classList.add('light-mode');
            if (icon) {
                icon.classList.remove('fa-sun');
                icon.classList.add('fa-moon');
            }
        } else {
            htmlElement.classList.remove('light-mode');
            if (icon) {
                icon.classList.remove('fa-moon');
                icon.classList.add('fa-sun');
            }
        }

        localStorage.setItem('theme', theme);

        if (settingsToggle) {
            settingsToggle.checked = !isLight;
        }

        window.dispatchEvent(new CustomEvent('themeChanged', {
            detail: { theme }
        }));
    }

    const savedTheme = localStorage.getItem('theme');
    let isLightInit;

    if (savedTheme === 'light' || savedTheme === 'dark') {
        isLightInit = savedTheme === 'light';
    } else {
        isLightInit = false;
    }

    applyTheme(isLightInit);

    setTimeout(() => {
        if (!htmlElement.classList.contains('theme-transition')) {
            htmlElement.classList.add('theme-transition');
        }
    }, 100);

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            if (!htmlElement.classList.contains('theme-transition')) {
                htmlElement.classList.add('theme-transition');
            }
            const isLightNow = htmlElement.classList.contains('light-mode');
            applyTheme(!isLightNow);
        });
    }

    if (settingsToggle) {
        settingsToggle.addEventListener('change', (e) => {
            const isDark = e.target.checked;
            applyTheme(!isDark);
        });
    }
}

// ============================================================================
// DATA FETCHING
// ============================================================================

/**
 * Fetch simulated sensor data from backend
 */
async function fetchSimulatedSensorData() {
    try {
        const res = await fetch('/api/sensor-data/');
        const json = await res.json();

        if (!json.data) return;

        // Clear previous state
        window.sensorState = {};

        // Get active sensor count
        const count = window.activeSensorCount;

        // Only process data for active sensors
        json.data.slice(0, count).forEach((s, index) => {
            const mapSensor = window.sensors[index + 1];
            if (!mapSensor) return;

            window.sensorState[mapSensor.id] = {
                id: mapSensor.id,
                name: mapSensor.name,
                lat: s.latitude,
                lng: s.longitude,
                aqi: s.aqi,
                no2: s.no2,
                co: s.co,
                smoke: s.smoke
            };
        });

        console.log('✅ Fetched data for sensors:', Object.keys(window.sensorState));

        // Update UI components
        updateSensorCardsFromDB();
        updateMarkerColors();
        updatePeakPollutionHours();
        updateMonthlyAQI();
        updateHeatmap();

    } catch (error) {
        console.error('Error fetching simulated sensor data:', error);
    }
}

/**
 * Update marker colors based on current AQI
 */
function updateMarkerColors() {
    if (!window.markerStack || !window.sensors) return;

    Object.keys(window.markerStack).forEach(index => {
        const sensor = window.sensors[index];
        if (!sensor) return;

        const marker = window.markerStack[index];
        const sensorData = window.sensorState[sensor.id] || window.sensorState[sensor.name];
        const aqi = sensorData?.aqi ?? (25 + (parseInt(index) * 15));
        const color = getAQIColor(aqi);

        marker.setStyle({
            fillColor: color
        });

        marker.setPopupContent(`
            <b>${sensor.id}</b><br>
            ${sensor.name}<br>
            AQI: ${aqi}
        `);
    });
}

async function fetchDashboardData() {
    try {
        const response = await fetch('/api/readings/?limit=1');
        const json = await response.json();
        const data = Array.isArray(json) ? json : (json.results || []);

        if (data && data.length > 0) {
            updateStats(data);
        }
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
    }
}

function updateStats(readings) {
    const latest = readings[0];

    const aqiElement = document.querySelector('.stat-card:nth-child(1) .stat-value');
    if (aqiElement) {
        aqiElement.textContent = latest.aqi;
    }

    const aqiStatus = document.getElementById("aqi_category");
    if (aqiStatus) {
        const category = latest.aqi_category.toUpperCase();
        aqiStatus.textContent = category;

        aqiStatus.classList.remove("excellent", "moderate", "poor");
        aqiStatus.style.color = "";

        if (category === "EXCELLENT") {
            aqiStatus.classList.add("excellent");
        } else if (category === "MODERATE") {
            aqiStatus.classList.add("moderate");
        } else if (category === "POOR") {
            aqiStatus.classList.add("poor");
        }
    }

    const tempElement = document.querySelector('.stat-card:nth-child(2) .stat-value');
    if (tempElement) {
        tempElement.textContent = `${latest.temperature}°C`;
    }

    const humElement = document.querySelector('.stat-card:nth-child(3) .stat-value');
    if (humElement) {
        humElement.textContent = `${latest.humidity}%`;
    }

    checkDangerLevel(latest);
}

// ============================================================================
// ANALYTICS CHART
// ============================================================================

function initAnalyticsChart() {
    const ctx = document.getElementById('analyticsChart');
    if (!ctx) return;

    const chartData = {
        labels: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00', '24:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00', '07:00'],
        datasets: [{
            label: 'Sensor A (Dwntwn)',
            data: [42, 45, 48, 55, 60, 58, 52, 48, 50, 55],
            borderColor: '#00E396',
            backgroundColor: 'rgba(0, 227, 150, 0.2)',
            borderWidth: 2,
            pointBackgroundColor: '#00E396',
            tension: 0.4,
            fill: false
        }]
    };

    const config = {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#fff'
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#aaa'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#aaa'
                    }
                }
            },
            interaction: {
                mode: 'index',
                intersect: false,
            },
        }
    };

    try {
        if (analyticsChart) {
            analyticsChart.destroy();
            analyticsChart = null;
        }

        analyticsChart = new Chart(ctx, config);
    } catch (err) {
        console.error('Error creating analytics chart:', err);
    }

    initChartControls();
    window.addEventListener('themeChanged', updateChartTheme);
}

function initChartControls() {
    window.updateChartType = function (type) {
        const curveBtn = document.getElementById('curveBtn');
        const barBtn = document.getElementById('barBtn');

        if (type === 'line') {
            if (curveBtn) curveBtn.classList.add('active');
            if (barBtn) barBtn.classList.remove('active');
            if (analyticsChart) analyticsChart.config.type = 'line';
        } else {
            if (barBtn) barBtn.classList.add('active');
            if (curveBtn) curveBtn.classList.remove('active');
            if (analyticsChart) analyticsChart.config.type = 'bar';
        }

        if (analyticsChart) analyticsChart.update();
    };

    const sensorFilter = document.getElementById('sensorFilter');
    if (sensorFilter) {
        sensorFilter.addEventListener('change', (e) => {
            const val = e.target.value;

            analyticsChart.data.datasets.forEach((dataset, index) => {
                if (val === 'all') {
                    dataset.hidden = false;
                } else {
                    dataset.hidden = index !== parseInt(val);
                }
            });

            analyticsChart.update();
        });
    }
}

function updateChartTheme(e) {
    if (!analyticsChart) return;

    const isLight = e.detail.theme === 'light';
    const textColor = isLight ? '#333' : '#fff';
    const gridColor = isLight ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';

    analyticsChart.options.plugins.legend.labels.color = textColor;
    analyticsChart.options.scales.x.ticks.color = textColor;
    analyticsChart.options.scales.y.ticks.color = textColor;
    analyticsChart.options.scales.y.grid.color = gridColor;
    analyticsChart.update();
}

// ============================================================================
// WIDGETS
// ============================================================================

function initHeatmap() {
    const heatmapGrid = document.getElementById('heatmapGrid');
    if (!heatmapGrid) return;

    for (let i = 0; i < 168; i++) {
        const cell = document.createElement('div');
        cell.className = 'heat-cell';

        const intensity = Math.random();
        let color;

        if (intensity < 0.6) {
            color = `rgba(0, 227, 150, ${0.2 + (Math.random() * 0.4)})`;
        } else if (intensity < 0.85) {
            color = `rgba(254, 176, 25, ${0.3 + (Math.random() * 0.5)})`;
        } else {
            color = `rgba(255, 69, 96, ${0.4 + (Math.random() * 0.6)})`;
        }

        cell.style.backgroundColor = color;

        const day = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][Math.floor(i / 24)];
        const hour = i % 24;
        cell.title = `${day} ${hour}:00 - AQI: ${Math.floor(intensity * 100)}`;

        heatmapGrid.appendChild(cell);
    }
}

function updatePeakPollutionHours() {
    const container = document.querySelector('.peak-bars');
    if (!container) return;

    const sensors = Object.values(window.sensorState);
    if (sensors.length === 0) return;

    const avgAQI = sensors.reduce((s, x) => s + x.aqi, 0) / sensors.length;

    const hours = [
        { time: '06:00', factor: 0.9 },
        { time: '09:00', factor: 1.3 },
        { time: '12:00', factor: 1.0 },
        { time: '18:00', factor: 1.5 },
        { time: '22:00', factor: 0.7 }
    ];

    container.innerHTML = hours.map(h => {
        const percent = Math.min(100, Math.round(avgAQI * h.factor));
        let cls = 'success';
        if (percent > 70) cls = 'warning';
        if (percent > 85) cls = 'danger';

        return `
            <div class="peak-row">
                <span class="time-label">${h.time}</span>
                <div class="bar-container">
                    <div class="bar-fill ${cls}" style="width:${percent}%"></div>
                </div>
                <span class="value-label ${cls}">${percent}%</span>
            </div>
        `;
    }).join('');
}

function updateMonthlyAQI() {
    const chart = document.querySelector('.monthly-chart');
    if (!chart) return;

    const sensors = Object.values(window.sensorState);
    if (sensors.length === 0) return;

    const avgAQI = sensors.reduce((s, x) => s + x.aqi, 0) / sensors.length;

    const months = ['SEP', 'OCT', 'NOV', 'DEC', 'JAN'];

    chart.innerHTML = months.map((m, i) => {
        const value = i === months.length - 1 ? avgAQI : avgAQI * (0.7 + Math.random() * 0.3);

        return `
            <div class="month-bar ${i === months.length - 1 ? 'active' : ''}">
                <div class="bar" style="height:${Math.min(100, value)}px"></div>
                <span>${m}</span>
            </div>
        `;
    }).join('');
}

function updateHeatmap() {
    const grid = document.getElementById('heatmapGrid');
    if (!grid) return;

    const sensors = Object.values(window.sensorState);
    if (sensors.length === 0) return;

    const avgAQI = sensors.reduce((s, x) => s + x.aqi, 0) / sensors.length;
    grid.innerHTML = '';

    for (let d = 0; d < 7; d++) {
        for (let h = 0; h < 24; h++) {
            const cell = document.createElement('div');
            cell.className = 'heat-cell';

            let intensity = avgAQI / 150;

            if (h >= 7 && h <= 9) intensity += 0.3;
            if (h >= 17 && h <= 19) intensity += 0.4;

            intensity = Math.min(1, Math.max(0.2, intensity + (Math.random() - 0.5) * 0.2));

            let color =
                intensity < 0.4 ? `rgba(0,227,150,${intensity})` :
                    intensity < 0.7 ? `rgba(254,176,25,${intensity})` :
                        `rgba(206,28,28,${intensity})`;

            cell.style.backgroundColor = color;
            cell.title = `Day ${d + 1}, ${h}:00 | AQI ${Math.round(intensity * 150)}`;

            grid.appendChild(cell);
        }
    }
}

// ============================================================================
// BLOG POST MANAGEMENT
// ============================================================================

function initBlogForm() {
    const addTitleBtn = document.getElementById('addTitleBtn');
    const blogForm = document.getElementById('blogForm');
    const closeFormBtn = document.getElementById('closeFormBtn');
    const clearBtn = document.getElementById('clearBtn');
    const sendBtn = document.getElementById('sendBtn');
    const dropZone = document.getElementById('dropZone');
    const postImageInput = document.getElementById('postImage');
    const postTitle = document.getElementById('postTitle');
    const titleCount = document.getElementById('titleCount');
    const postDesc = document.getElementById('postDesc');
    const descCount = document.getElementById('descCount');

    if (addTitleBtn && blogForm) {
        addTitleBtn.addEventListener('click', () => {
            if (blogForm.style.display === 'none' || blogForm.style.display === '') {
                blogForm.style.display = 'block';
            } else {
                blogForm.style.display = 'none';
            }
        });
    }

    if (closeFormBtn && blogForm) {
        closeFormBtn.addEventListener('click', () => {
            blogForm.style.display = 'none';
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (postTitle) postTitle.value = '';
            if (postDesc) postDesc.value = '';
            if (postImageInput) postImageInput.value = '';
            if (document.getElementById('postAuthor')) {
                document.getElementById('postAuthor').value = '';
            }
            if (blogForm) blogForm.style.display = 'none';
        });
    }

    if (postTitle && titleCount) {
        postTitle.addEventListener('input', function () {
            titleCount.textContent = `${this.value.length}/90`;
        });
    }

    if (postDesc && descCount) {
        postDesc.addEventListener('input', function () {
            descCount.textContent = `${this.value.length}/2000`;
        });
    }

    if (dropZone && postImageInput) {
        dropZone.addEventListener('click', () => postImageInput.click());

        dropZone.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                postImageInput.click();
            }
        });

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, preventDefaults, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, highlight, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, unhighlight, false);
        });

        dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files && files[0]) {
                postImageInput.files = files;
            }
        });
    }

    if (sendBtn) {
        sendBtn.addEventListener('click', handlePostSubmit);
    }

    if (document.getElementById('blogGrid')) {
        fetchPosts();
    }
}

async function handlePostSubmit() {
    const sendBtn = document.getElementById('sendBtn');
    const postTitle = document.getElementById('postTitle');
    const postAuthor = document.getElementById('postAuthor');
    const postDesc = document.getElementById('postDesc');
    const postImageInput = document.getElementById('postImage');
    const blogForm = document.getElementById('blogForm');

    const title = postTitle ? postTitle.value.trim() : '';
    const author = postAuthor ? postAuthor.value.trim() : '';
    const content = postDesc ? postDesc.value.trim() : '';

    if (!title || !content) {
        alert('Please provide a title and content.');
        return;
    }

    const slug = title
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim() + '-' + Date.now();

    const fd = new FormData();
    fd.append('title', title);
    fd.append('slug', slug);
    fd.append('content', content);
    fd.append('excerpt', content.slice(0, 250));
    fd.append('status', 'published');

    if (postImageInput && postImageInput.files && postImageInput.files[0]) {
        fd.append('image', postImageInput.files[0]);
    }

    try {
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';

        const res = await fetch('/api/posts/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': await getCSRFToken(),
            },
            body: fd
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({
                detail: 'Server error'
            }));
            console.error('Error creating post:', err);
            alert('Error creating post: ' + (err.slug ? err.slug[0] : err.detail || JSON.stringify(err)));
            return;
        }

        if (postTitle) postTitle.value = '';
        if (postAuthor) postAuthor.value = '';
        if (postDesc) postDesc.value = '';
        if (postImageInput) postImageInput.value = '';

        if (blogForm) blogForm.style.display = 'none';

        await fetchPosts();
        alert('✓ Post submitted successfully!');

    } catch (err) {
        console.error('Submit error:', err);
        alert('Network error submitting post: ' + err.message);
    } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Submit Post';
    }
}

async function fetchPosts() {
    try {
        const res = await fetch('/api/posts/');
        const posts = await res.json();
        renderPosts(posts);
    } catch (err) {
        console.error('Error loading posts:', err);
        const grid = document.getElementById('blogGrid');
        if (grid) {
            grid.innerHTML = '<div class="empty-state" style="padding:20px; text-align:center; color:var(--danger);">Failed to load posts</div>';
        }
    }
}

function renderPosts(posts) {
    const grid = document.getElementById('blogGrid');
    if (!grid) return;

    grid.innerHTML = '';

    if (!posts || posts.length === 0) {
        grid.innerHTML = '<div class="empty-state" style="padding:20px; text-align:center; color:var(--text-secondary);">No posts yet</div>';
        return;
    }

    posts.forEach(p => {
        const card = document.createElement('a');
        card.href = `/blog/${p.slug}/`;
        card.className = 'blog-card';
        card.style.textDecoration = 'none';
        card.style.color = 'inherit';

        card.innerHTML = `
            <h3>${escapeHtml(p.title)}</h3>
            <p>${escapeHtml(p.excerpt || '')}</p>
        `;

        grid.appendChild(card);
    });
}

// ============================================================================
// NOTIFICATION SYSTEM
// ============================================================================

function initNotifications() {
    const notificationBtn = document.getElementById('notificationBtn');
    const notificationDropdown = document.getElementById('notificationDropdown');
    const clearNotifs = document.getElementById('clearNotifs');

    if (!notificationBtn || !notificationDropdown) return;

    function closeNotifDropdown() {
        if (!notificationDropdown.classList.contains('hidden')) {
            notificationDropdown.classList.add('hidden');
            notificationBtn.setAttribute('aria-expanded', 'false');
        }
    }

    function openNotifDropdown() {
        if (notificationDropdown.classList.contains('hidden')) {
            notificationDropdown.classList.remove('hidden');
            notificationBtn.setAttribute('aria-expanded', 'true');
        }
    }

    notificationBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (notificationDropdown.classList.contains('hidden')) {
            openNotifDropdown();
        } else {
            closeNotifDropdown();
        }
    });

    window.addEventListener('click', (e) => {
        if (!notificationDropdown.classList.contains('hidden')) {
            if (!notificationDropdown.contains(e.target) &&
                e.target !== notificationBtn &&
                !notificationBtn.contains(e.target)) {
                closeNotifDropdown();
            }
        }
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeNotifDropdown();
        }
    });

    notificationDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    if (clearNotifs) {
        clearNotifs.addEventListener('click', () => {
            notifications = [];
            renderNotifications();
            const notifBadge = document.getElementById('notifBadge');
            if (notifBadge) notifBadge.classList.add('hidden');
        });
    }

    notificationBtn.setAttribute('aria-expanded',
        notificationDropdown.classList.contains('hidden') ? 'false' : 'true'
    );
}

function checkDangerLevel(data) {
    if (data.aqi > 100) {
        const msg = `Critical Warning: High AQI (${data.aqi}) detected!`;
        const exists = notifications.some(n => n.message === msg);

        if (!exists) {
            addNotification(msg, 'danger');
        }
    }
}

function addNotification(message, type) {
    notifications.unshift({
        message,
        type,
        time: new Date()
    });

    const notifBadge = document.getElementById('notifBadge');
    if (notifBadge) notifBadge.classList.remove('hidden');

    renderNotifications();
}

function renderNotifications() {
    const notifList = document.getElementById('notifList');
    if (!notifList) return;

    notifList.innerHTML = '';

    if (notifications.length === 0) {
        notifList.innerHTML = '<div class="empty-state" style="padding:10px; color:var(--text-secondary); font-size:12px;">No new alerts</div>';
        return;
    }

    notifications.forEach(n => {
        const item = document.createElement('div');
        item.className = `notif-item ${n.type}`;
        item.innerHTML = `
            <i class="fa-solid fa-triangle-exclamation notif-icon"></i>
            <div>
                <div style="font-weight: 600;">High AQI Alert</div>
                <div style="color: var(--text-secondary);">${n.message}</div>
                <div style="font-size: 10px; color: #666; margin-top: 4px;">Just now</div>
            </div>
        `;
        notifList.appendChild(item);
    });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    initMobileSidebar();
    initTheme();
    initAnalyticsChart();
    initHeatmap();
    initBlogForm();
    initNotifications();
    initTerminalSidebar();
    initSensorCounterButtons();

    // Fetch initial data
    fetchSimulatedSensorData();
    fetchDashboardData();

    // Set up polling intervals
    setInterval(fetchDashboardData, 10000);
    setInterval(fetchSimulatedSensorData, 3000);
});