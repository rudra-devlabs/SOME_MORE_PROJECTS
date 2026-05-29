// JEE OS - Desktop Operating System
// Handles window management, app launching, drag functionality, and JEE tools

let openWindows = new Map();
let windowCount = 0;
let activeWindow = null;
let notes = JSON.parse(localStorage.getItem('jeeNotes')) || {};
let currentNoteId = null;
let timerInterval = null;
let seconds = 0;
let timerRunning = false;

// Clock
function updateClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
    });
    document.getElementById('clock').textContent = timeString;
}
setInterval(updateClock, 1000);
updateClock();

// Context Menu
document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const menu = document.getElementById('context-menu');
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;
    menu.classList.remove('hidden');
});

document.addEventListener('click', () => {
    document.getElementById('context-menu').classList.add('hidden');
});

function showMenu(menu) {
    console.log(`Menu: ${menu}`);
}

// Window Management
function openApp(appName) {
    if (openWindows.has(appName)) {
        const existingWindow = openWindows.get(appName);
        existingWindow.classList.add('active');
        bringToFront(existingWindow);
        return;
    }

    windowCount++;
    const windowId = `window-${windowCount}`;
    const windowDiv = document.createElement('div');
    windowDiv.className = 'app-window active';
    windowDiv.id = windowId;
    windowDiv.style.left = `${50 + (windowCount * 20) % 200}px`;
    windowDiv.style.top = `${50 + (windowCount * 20) % 150}px`;
    windowDiv.style.width = '600px';
    windowDiv.style.height = '400px';
    windowDiv.dataset.app = appName;

    const appContent = getAppContent(appName);
    
    windowDiv.innerHTML = `
        <div class="window-titlebar" onmousedown="startDrag(event, '${windowId}')">
            <div class="window-buttons">
                <button class="window-btn close-btn" onclick="closeWindow('${windowId}')"></button>
                <button class="window-btn minimize-btn" onclick="minimizeWindow('${windowId}')"></button>
                <button class="window-btn maximize-btn" onclick="maximizeWindow('${windowId}')"></button>
            </div>
            <div class="window-title">${getAppTitle(appName)}</div>
        </div>
        <div class="window-content">
            ${appContent}
        </div>
    `;

    document.getElementById('windows-container').appendChild(windowDiv);
    openWindows.set(appName, windowDiv);
    
    bringToFront(windowDiv);
    setupWindowEvents(windowDiv);
    
    // Initialize app-specific functionality
    initializeApp(appName, windowDiv);
    
    // Update menu
    document.getElementById('current-app').textContent = getAppTitle(appName);
}

function getAppTitle(appName) {
    const titles = {
        'physics': 'Physics - JEE Formulas',
        'chemistry': 'Chemistry - JEE Formulas',
        'math': 'Mathematics - JEE Formulas',
        'timer': 'Study Timer',
        'notes': 'Notes',
        'calculator': 'Calculator',
        'settings': 'System Settings'
    };
    return titles[appName] || 'JEE OS';
}

function getAppContent(appName) {
    switch(appName) {
        case 'physics':
            return getPhysicsContent();
        case 'chemistry':
            return getChemistryContent();
        case 'math':
            return getMathContent();
        case 'timer':
            return getTimerContent();
        case 'notes':
            return getNotesContent();
        case 'calculator':
            return getCalculatorContent();
        case 'settings':
            return getSettingsContent();
        default:
            return '<div style="padding: 20px;">App coming soon...</div>';
    }
}

function getPhysicsContent() {
    return `
        <div class="app-physics">
            <h2>Physics Formulas</h2>
            <div class="formula-card">
                <h3>Newton's Second Law</h3>
                <div class="formula">F = ma</div>
                <p>Force equals mass times acceleration. Unit: Newton (N)</p>
            </div>
            <div class="formula-card">
                <h3>Kinetic Energy</h3>
                <div class="formula">KE = ½mv²</div>
                <p>Energy of motion. Unit: Joule (J)</p>
            </div>
            <div class="formula-card">
                <h3>Coulomb's Law</h3>
                <div class="formula">F = k(q₁q₂)/r²</div>
                <p>Electrostatic force between charges. Unit: Newton (N)</p>
            </div>
            <div class="formula-card">
                <h3>Ohm's Law</h3>
                <div class="formula">V = IR</div>
                <p>Voltage equals current times resistance. Unit: Volt (V)</p>
            </div>
        </div>
    `;
}

function getChemistryContent() {
    return `
        <div class="app-chemistry">
            <h2>Chemistry Formulas</h2>
            <div class="formula-card">
                <h3>Ideal Gas Law</h3>
                <div class="formula">PV = nRT</div>
                <p>Pressure × Volume = moles × Gas constant × Temperature</p>
            </div>
            <div class="formula-card">
                <h3>Molarity</h3>
                <div class="formula">M = n/V</div>
                <p>Molarity = moles of solute / liters of solution</p>
            </div>
            <div class="formula-card">
                <h3>pH Calculation</h3>
                <div class="formula">pH = -log[H⁺]</div>
                <p>Negative logarithm of hydrogen ion concentration</p>
            </div>
            <div class="formula-card">
                <h3>Arrhenius Equation</h3>
                <div class="formula">k = A·e^(-Ea/RT)</div>
                <p>Rate constant depends on activation energy and temperature</p>
            </div>
        </div>
    `;
}

function getMathContent() {
    return `
        <div class="app-math">
            <h2>Mathematics Formulas</h2>
            <div class="formula-card">
                <h3>Integration by Parts</h3>
                <div class="formula">∫u dv = uv - ∫v du</div>
                <p>Useful for products of functions</p>
            </div>
            <div class="formula-card">
                <h3>Quadratic Formula</h3>
                <div class="formula">x = (-b ± √(b²-4ac)) / 2a</div>
                <p>Solutions to ax² + bx + c = 0</p>
            </div>
            <div class="formula-card">
                <h3>Binomial Expansion</h3>
                <div class="formula">(a + b)ⁿ = Σ(nCk · aⁿ⁻ᵏ · bᵏ)</div>
                <p>Expand (a+b) raised to any power</p>
            </div>
            <div class="formula-card">
                <h3>Derivative Rules</h3>
                <div class="formula">d/dx(xⁿ) = nxⁿ⁻¹</div>
                <p>Power rule for differentiation</p>
            </div>
        </div>
    `;
}

function getTimerContent() {
    return `
        <div class="app-timer" style="padding: 20px;">
            <h2>Study Timer</h2>
            <div class="timer-display" id="timer-display">00:00:00</div>
            <div class="timer-controls">
                <button class="timer-btn primary" onclick="startTimer()">Start</button>
                <button class="timer-btn" onclick="pauseTimer()">Pause</button>
                <button class="timer-btn" onclick="resetTimer()">Reset</button>
            </div>
            <div style="margin-top: 30px; text-align: center;">
                <button class="timer-btn" onclick="setTimerMinutes(25)">Pomodoro (25m)</button>
                <button class="timer-btn" onclick="setTimerMinutes(50)">Long Study (50m)</button>
            </div>
        </div>
    `;
}

function getNotesContent() {
    return `
        <div class="notes-container">
            <div class="notes-sidebar">
                <button class="btn-add-note" onclick="addNote()">New Note</button>
                <div class="notes-list" id="notes-list"></div>
            </div>
            <div class="notes-editor" id="notes-editor">
                <input type="text" class="note-title-input" id="note-title" placeholder="Note Title" oninput="saveCurrentNote()">
                <textarea class="note-content-input" id="note-content" placeholder="Start writing your notes here..." oninput="saveCurrentNote()"></textarea>
            </div>
        </div>
    `;
}

function getCalculatorContent() {
    return `
        <div class="calculator">
            <div class="calc-display" id="calc-display">0</div>
            <button class="calc-btn" onclick="calcClear()">C</button>
            <button class="calc-btn" onclick="calcOp('(')">(</button>
            <button class="calc-btn" onclick="calcOp(')')">)</button>
            <button class="calc-btn operator" onclick="calcOp('/')">÷</button>
            <button class="calc-btn" onclick="calcNum('7')">7</button>
            <button class="calc-btn" onclick="calcNum('8')">8</button>
            <button class="calc-btn" onclick="calcNum('9')">9</button>
            <button class="calc-btn operator" onclick="calcOp('*')">×</button>
            <button class="calc-btn" onclick="calcNum('4')">4</button>
            <button class="calc-btn" onclick="calcNum('5')">5</button>
            <button class="calc-btn" onclick="calcNum('6')">6</button>
            <button class="calc-btn operator" onclick="calcOp('-')">-</button>
            <button class="calc-btn" onclick="calcNum('1')">1</button>
            <button class="calc-btn" onclick="calcNum('2')">2</button>
            <button class="calc-btn" onclick="calcNum('3')">3</button>
            <button class="calc-btn operator" onclick="calcOp('+')">+</button>
            <button class="calc-btn" onclick="calcNum('0')">0</button>
            <button class="calc-btn" onclick="calcNum('.')">.</button>
            <button class="calc-btn equals" onclick="calcEquals()">=</button>
        </div>
    `;
}

function getSettingsContent() {
    return `
        <div style="padding: 20px;">
            <h2>System Settings</h2>
            <div style="margin-top: 20px;">
                <h3 style="margin-bottom: 12px; color: #fff;">Appearance</h3>
                <button class="timer-btn" onclick="changeTheme('dark')" style="margin-right: 8px;">Dark Theme</button>
                <button class="timer-btn" onclick="changeTheme('light')">Light Theme</button>
            </div>
            <div style="margin-top: 20px;">
                <h3 style="margin-bottom: 12px; color: #fff;">Study Preferences</h3>
                <label style="color: #a0a0a0; display: block; margin-bottom: 8px;">Pomodoro Timer (minutes):</label>
                <input type="number" value="25" class="note-title-input" style="width: 100px;" id="pomodoro-time">
            </div>
        </div>
    `;
}

// Initialize App-Specific Functionality
function initializeApp(appName, windowDiv) {
    if (appName === 'notes') {
        renderNotesList();
    }
}

// Window Dragging
let dragWindow = null;
let dragOffset = { x: 0, y: 0 };

function startDrag(event, windowId) {
    const windowDiv = document.getElementById(windowId);
    dragWindow = windowDiv;
    const rect = windowDiv.getBoundingClientRect();
    dragOffset = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };
    bringToFront(windowDiv);
    event.preventDefault();
}

document.addEventListener('mousemove', (event) => {
    if (dragWindow) {
        dragWindow.style.left = `${event.clientX - dragOffset.x}px`;
        dragWindow.style.top = `${Math.max(24, event.clientY - dragOffset.y)}px`;
    }
});

document.addEventListener('mouseup', () => {
    dragWindow = null;
});

function bringToFront(windowDiv) {
    openWindows.forEach(w => w.classList.remove('active'));
    windowDiv.classList.add('active');
    activeWindow = windowDiv;
    
    // Update z-index
    const zIndex = 100 + Array.from(openWindows.values()).indexOf(windowDiv);
    windowDiv.style.zIndex = zIndex;
}

function setupWindowEvents(windowDiv) {
    windowDiv.addEventListener('mousedown', () => {
        bringToFront(windowDiv);
    });
}

function closeWindow(windowId) {
    const windowDiv = typeof windowId === 'string' ? document.getElementById(windowId) : windowId.closest('.app-window');
    const appName = windowDiv.dataset.app;
    windowDiv.remove();
    openWindows.delete(appName);
    if (activeWindow === windowDiv) {
        activeWindow = null;
        document.getElementById('current-app').textContent = 'JEE OS';
    }
}

function minimizeWindow(windowId) {
    const windowDiv = typeof windowId === 'string' ? document.getElementById(windowId) : windowId.closest('.app-window');
    windowDiv.style.display = 'none';
}

function maximizeWindow(windowId) {
    const windowDiv = typeof windowId === 'string' ? document.getElementById(windowId) : windowId.closest('.app-window');
    if (windowDiv.style.width === '100%') {
        windowDiv.style.width = '600px';
        windowDiv.style.height = '400px';
        windowDiv.style.left = '50px';
        windowDiv.style.top = '50px';
    } else {
        windowDiv.style.width = '100%';
        windowDiv.style.height = 'calc(100% - 24px)';
        windowDiv.style.left = '0';
        windowDiv.style.top = '24px';
    }
}

// Timer Functionality
function startTimer() {
    if (!timerRunning) {
        timerRunning = true;
        timerInterval = setInterval(() => {
            seconds++;
            updateTimerDisplay();
        }, 1000);
    }
}

function pauseTimer() {
    timerRunning = false;
    clearInterval(timerInterval);
}

function resetTimer() {
    timerRunning = false;
    clearInterval(timerInterval);
    seconds = 0;
    updateTimerDisplay();
}

function setTimerMinutes(minutes) {
    pauseTimer();
    seconds = minutes * 60;
    updateTimerDisplay();
}

function updateTimerDisplay() {
    const display = document.getElementById('timer-display');
    if (display) {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        display.textContent = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
}

// Notes Functionality
function addNote() {
    const noteId = Date.now().toString();
    const note = {
        id: noteId,
        title: 'New Note',
        content: ''
    };
    notes[noteId] = note;
    currentNoteId = noteId;
    renderNotesList();
    selectNote(noteId);
    saveNotes();
}

function renderNotesList() {
    const notesList = document.getElementById('notes-list');
    if (!notesList) return;
    
    notesList.innerHTML = '';
    Object.values(notes).forEach(note => {
        const div = document.createElement('div');
        div.className = `note-item ${note.id === currentNoteId ? 'active' : ''}`;
        div.textContent = note.title || 'Untitled Note';
        div.onclick = () => selectNote(note.id);
        notesList.appendChild(div);
    });
}

function selectNote(noteId) {
    currentNoteId = noteId;
    const note = notes[noteId];
    if (note) {
        document.getElementById('note-title').value = note.title;
        document.getElementById('note-content').value = note.content;
    }
    renderNotesList();
}

function saveCurrentNote() {
    if (currentNoteId && notes[currentNoteId]) {
        const titleInput = document.getElementById('note-title');
        const contentInput = document.getElementById('note-content');
        
        notes[currentNoteId].title = titleInput.value;
        notes[currentNoteId].content = contentInput.value;
        saveNotes();
        renderNotesList();
    }
}

function saveNotes() {
    localStorage.setItem('jeeNotes', JSON.stringify(notes));
}

// Calculator Functionality
let calcExpression = '';

function calcNum(num) {
    const display = document.getElementById('calc-display');
    if (calcExpression === '0' && num !== '.') {
        calcExpression = num;
    } else {
        calcExpression += num;
    }
    display.textContent = calcExpression || '0';
}

function calcOp(op) {
    const display = document.getElementById('calc-display');
    calcExpression += op;
    display.textContent = calcExpression;
}

function calcEquals() {
    const display = document.getElementById('calc-display');
    try {
        calcExpression = eval(calcExpression).toString();
        display.textContent = calcExpression;
    } catch (e) {
        display.textContent = 'Error';
        calcExpression = '';
    }
}

function calcClear() {
    const display = document.getElementById('calc-display');
    calcExpression = '';
    display.textContent = '0';
}

// System Settings
function createNewFile() {
    alert('New file created on desktop');
}

function createNewFolder() {
    alert('New folder created on desktop');
}

function changeWallpaper() {
    const colors = [
        '#1a1a2e', '#162a4a', '#2d4a6f', '#1a1a1a', '#0f0f23'
    ];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    document.body.style.background = `radial-gradient(circle at 50% 50%, ${randomColor}, #000000)`;
}

function changeTheme(theme) {
    if (theme === 'light') {
        document.body.style.filter = 'invert(1) hue-rotate(180deg)';
    } else {
        document.body.style.filter = 'none';
    }
}

// Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.getElementById('context-menu').classList.add('hidden');
    }
});

// Initialize
console.log('JEE OS v1.0 - Ready');
console.log('Welcome to JEE OS - Your study companion!');