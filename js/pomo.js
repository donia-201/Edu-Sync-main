// ===== POMODORO TIMER =====

window.addEventListener('DOMContentLoaded', () => {

// ===== Load Settings Dynamically =====
function getSettings() {
    const saved = localStorage.getItem('eduSyncSettings');
    if (saved) {
        try {
            const settings = JSON.parse(saved);
            return {
                pomodoroDuration:     parseInt(settings.pomodoroDuration) || 25,
                breakDuration:        parseInt(settings.breakDuration) || 5,
                longBreakDuration:    parseInt(settings.longBreakDuration) || 30,
                soundEffects:         settings.soundEffects !== false,
                desktopNotifications: settings.desktopNotifications === true,
                // FIX 1: read autoStart from settings (default false = manual)
                autoStartNext:        settings.autoStart === true,
                // FIX 2: read study goal for goal notification
                studyGoal:            parseInt(settings.studyGoal) || 0
            };
        } catch (e) {
            console.error('Error loading settings:', e);
        }
    }
    return {
        pomodoroDuration: 25, breakDuration: 5, longBreakDuration: 30,
        soundEffects: true, desktopNotifications: false,
        autoStartNext: false, studyGoal: 0
    };
}

const SESSIONS_BEFORE_LONG_BREAK = 4;
const GROW_STAGES  = 4;
const focusGifUrl  = "../imgs/200w.webp";
const breakGifUrl  = "../imgs/200w-1.webp";
const API_BASE_URL = 'https://edu-sync-back-end-production.up.railway.app';

const startBtn        = document.getElementById("startBtn");
const pauseBtn        = document.getElementById("pauseBtn");
const resetBtn        = document.getElementById("resetBtn");
const timeDisplay     = document.getElementById("timeDisplay");
const modeText        = document.getElementById("modeText");
const sessionsTodayEl = document.getElementById("sessionsToday");
const focusGif        = document.getElementById("focusGif");
const treeContainer   = document.getElementById("treeContainer");
const stageText       = document.getElementById("stageText");
const plantReset      = document.getElementById("plantReset");

let mode = "focus";
let remaining = 0;
let timer = null;
let sessionsCompleted = 0;
let sessionsToday = 0;

// FIX 3: added focusStart / breakStart / goalReached messages
const motivationalMessages = {
    focus: [
        { ar: "🎉 رائع! أكملت جلسة تركيز كاملة. أنت تقترب من هدفك!", en: "Amazing! You completed a full focus session!" },
        { ar: "🎉 إنجاز عظيم! كل دقيقة من تركيزك تبني مستقبلك.", en: "Great achievement! Every minute builds your future." },
        { ar: "🎉 مذهل! أنت تثبت أن الإرادة أقوى من أي شيء.", en: "Incredible! You're proving willpower conquers all." },
        { ar: "🎉 ممتاز! استمر في هذا الزخم، النجاح قريب جداً.", en: "Excellent! Keep this momentum, success is close." },
        { ar: "🎉 فخور بك! أنت تحول أحلامك إلى واقع خطوة بخطوة.", en: "Proud of you! You're turning dreams into reality." }
    ],
    break: [
        { ar: "☕ وقت الاستراحة! اشرب ماء، تمدد قليلاً، وعد بطاقة أكبر.", en: "Break time! Drink water, stretch, come back stronger." },
        { ar: "☕ خذ نفساً عميقاً... أنت تستحق هذه الراحة.", en: "Take a deep breath... you deserve this rest." },
        { ar: "☕ استرخ الآن! العقل يحتاج راحة ليبدع أكثر.", en: "Relax now! The mind needs rest to be creative." },
        { ar: "☕ استراحة جميلة! حرك جسمك قليلاً واشحن طاقتك.", en: "Nice break! Move your body and recharge." }
    ],
    // FIX: start notifications
    focusStart: [
        { ar: "🎯 جلسة مذاكرة جديدة بدأت. تركيز كامل!", en: "🎯 Focus session started! Time to study." },
        { ar: "🎯 ابدأ التركيز الآن! وقت المذاكرة بدأ.", en: "🎯 Let's go! Focus session started." }
    ],
    breakStart: [
        { ar: "☕ وقت الراحة بدأ! استرخ قليلاً.", en: "☕ Break started! Take it easy." },
        { ar: "☕ استراحة مكتسبة! انت تستاهل.", en: "☕ Well-earned break! You deserve it." }
    ],
    // FIX: goal reached notification
    goalReached: [
        { ar: "🏆 أحسنت! لقد وصلت لهدف الدراسة اليومي!", en: "🏆 Awesome! You've reached your daily study goal!" },
        { ar: "🌟 مبروك! هدفك اليومي اكتمل. أنت بطل!", en: "🌟 Congrats! Daily goal complete. You're a champion!" }
    ]
};

// ===== Request Notification Permission =====
async function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }
    return Notification.permission === 'granted';
}

// ===== Show Browser Notification =====
function showBrowserNotification(message, type) {
    const settings = getSettings();
    if (!settings.desktopNotifications) return;
    if ('Notification' in window && Notification.permission === 'granted') {
        const titles = {
            focus:      '🎉 Focus Session Complete!',
            break:      '☕ Break Complete!',
            focusStart: '🎯 Focus Session Started!',
            breakStart: '☕ Break Started!',
            goalReached:'🏆 Study Goal Reached!'
        };
        const icon = (type === 'focus' || type === 'focusStart') ? focusGifUrl : breakGifUrl;
        const notification = new Notification(titles[type] || '🔔 EduSync', {
            body: message.ar + '\n' + message.en,
            icon: icon,
            badge: '../imgs/education.png',
            tag: `pomodoro-${type}-${Date.now()}`,
            requireInteraction: false,
            silent: false,
            vibrate: [200, 100, 200]
        });
        notification.onclick = () => { window.focus(); notification.close(); };
        setTimeout(() => notification.close(), 5000);
    }
}

// ===== Save Notification to Backend =====
async function saveNotificationToBackend(message, type) {
    try {
        const token = localStorage.getItem('session_token') || localStorage.getItem('authToken');
        if (!token) return;
        const isStart = type.endsWith('Start');
        await fetch(`${API_BASE_URL}/api/notifications`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                title: isStart
                    ? (type === 'focusStart' ? '🎯 Focus Session Started!' : '☕ Break Started!')
                    : type === 'goalReached' ? '🏆 Study Goal Reached!'
                    : type === 'focus' ? '🎉 Focus Session Complete!' : '☕ Break Complete!',
                message: message.ar + ' | ' + message.en,
                type: type === 'goalReached' ? 'event' : 'pomodoro',
                category: type.replace('Start', ''),
                created_at: new Date().toISOString()
            })
        });
    } catch (e) {
        console.error('Error saving notification:', e);
    }
}

// ===== Save Notification to LocalStorage =====
function saveNotificationToLocal(message, type) {
    try {
        const NOTIFICATIONS_KEY = "pomodoro_notifications";
        let notifications = JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || '[]');
        notifications.unshift({
            id: Date.now(), message, type: type.replace('Start',''),
            category: 'pomodoro', timestamp: new Date().toISOString(),
            date: new Date().toLocaleString('en-US', { year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' })
        });
        if (notifications.length > 100) notifications = notifications.slice(0, 100);
        localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
    } catch(e) { console.error('Error saving notification:', e); }
}

// ===== Play Notification Sound =====
function playNotificationSound() {
    const settings = getSettings();
    if (!settings.soundEffects) return;
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode   = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch(e) { console.error('Audio not supported:', e); }
}

// ===== Show Motivational Message =====
function showMotivationalMessage(type) {
    const messages = motivationalMessages[type];
    if (!messages) return;
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    showBrowserNotification(randomMessage, type);
    saveNotificationToBackend(randomMessage, type);
    saveNotificationToLocal(randomMessage, type);
    playNotificationSound();
}

// FIX: check if daily study goal was just reached
function checkGoalReached() {
    const s = getSettings();
    if (!s.studyGoal || s.studyGoal <= 0) return;
    const goalMinutes    = s.studyGoal * 60;
    const studiedMinutes = sessionsToday * s.pomodoroDuration;
    // Only fire exactly when crossing the goal (not every session after)
    if (studiedMinutes >= goalMinutes && (studiedMinutes - s.pomodoroDuration) < goalMinutes) {
        showMotivationalMessage('goalReached');
    }
}

// ===== State =====
const STATE_KEY = "pomodoro_forest_state_v2";

function loadState() {
    try {
        const raw = localStorage.getItem(STATE_KEY);
        if (!raw) return { stage:0, sessionsToday:0, sessionsCompleted:0, lastDate:new Date().toDateString() };
        const s = JSON.parse(raw);
        if (s.lastDate !== new Date().toDateString()) {
            s.sessionsToday = 0; s.sessionsCompleted = 0; s.lastDate = new Date().toDateString();
        }
        return s;
    } catch (e) {
        return { stage:0, sessionsToday:0, sessionsCompleted:0, lastDate:new Date().toDateString() };
    }
}

function saveState(state) { localStorage.setItem(STATE_KEY, JSON.stringify(state)); }

const state = loadState();
let stage = state.stage || 0;
sessionsToday     = state.sessionsToday     || 0;
sessionsCompleted = state.sessionsCompleted || 0;

// ===== Get Current Duration =====
function getCurrentDuration() {
    const settings = getSettings();
    if (mode === "focus")      return settings.pomodoroDuration * 60;
    if (mode === "shortBreak") return settings.breakDuration * 60;
    return settings.longBreakDuration * 60;
}

// ===== Format Time =====
function formatTime(s) {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
}

// ===== Update UI =====
function updateUI() {
    const settings = getSettings();
    timeDisplay.textContent = formatTime(remaining);

    let modeLabel = '';
    if (mode === "focus")           modeLabel = `Mode: Focus (${settings.pomodoroDuration}m)`;
    else if (mode === "shortBreak") modeLabel = `Mode: Short Break (${settings.breakDuration}m)`;
    else                            modeLabel = `Mode: Long Break (${settings.longBreakDuration}m)`;
    modeText.textContent = modeLabel;

    sessionsTodayEl.textContent = `Today's Pomodoros: ${sessionsToday} | Cycle: ${sessionsCompleted % SESSIONS_BEFORE_LONG_BREAK}/${SESSIONS_BEFORE_LONG_BREAK}`;

    focusGif.src = mode === "focus" ? focusGifUrl : breakGifUrl;
    focusGif.alt = mode === "focus" ? "Focus Mode" : "Break Mode";

    if (treeContainer) treeContainer.className = "tree stage-" + Math.min(stage, GROW_STAGES);
    const names = ["Seed","Seedling","Young Tree","Mature Tree","Fully Grown Tree"];
    if (stageText) stageText.textContent = `Level: ${names[Math.min(stage, GROW_STAGES)]}`;

    const trunk = document.querySelector('.trunk');
    if (trunk) {
        trunk.style.transition = "none";
        trunk.style.strokeDashoffset = "300";
        setTimeout(() => {
            trunk.style.transition = "stroke-dashoffset 900ms ease";
            trunk.style.strokeDashoffset = "0";
        }, 10);
    }

    document.title = `${formatTime(remaining)} - EduSync ${mode === 'focus' ? '🎯' : '☕'}`;
}

// ===== Timer Tick =====
function tick() {
    if (remaining > 0) {
        remaining--;
        updateUI();
        if (remaining % 10 === 0) {
            localStorage.setItem("pomodoroRemaining", remaining);
            localStorage.setItem("pomodoroTimestamp", Date.now());
        }
    } else {
        clearInterval(timer);
        timer = null;

        // Notify on session END
        const notificationType = mode === 'focus' ? 'focus' : 'break';
        showMotivationalMessage(notificationType);

        if (mode === "focus") {
            sessionsToday++;
            sessionsCompleted++;
            stage = Math.min(stage + 1, GROW_STAGES);
            saveState({ stage, sessionsToday, sessionsCompleted, lastDate: new Date().toDateString() });
            // FIX: check daily goal after each focus session
            checkGoalReached();
        }

        // Switch mode
        if (mode === "focus") {
            mode = sessionsCompleted % SESSIONS_BEFORE_LONG_BREAK === 0 ? "longBreak" : "shortBreak";
        } else {
            mode = "focus";
        }

        remaining = getCurrentDuration();
        updateUI();

        // FIX 1: only auto-start if setting is enabled
        if (getSettings().autoStartNext) {
            setTimeout(() => { startTimer(); }, 2000);
        } else {
            // Reset button to allow manual start
            startBtn.textContent = "▶ Start";
            startBtn.disabled = false;
            pauseBtn.disabled = true;
        }
    }
}

// ===== Start Timer =====
// FIX: isResume param — no start notification when resuming paused timer
function startTimer(isResume = false) {
    if (timer) return;

    // FIX: send start notification only on NEW session (not resume)
    if (!isResume) {
        showMotivationalMessage(mode === 'focus' ? 'focusStart' : 'breakStart');
    }

    timer = setInterval(tick, 1000);
    startBtn.textContent = mode === "focus" ? "🎯 Studying..." : "☕ Relaxing...";
    startBtn.disabled = true;
    pauseBtn.disabled = false;

    localStorage.setItem("pomodoroRunning", "true");
    localStorage.setItem("pomodoroMode", mode);
    localStorage.setItem("pomodoroRemaining", remaining);
    localStorage.setItem("pomodoroTimestamp", Date.now());
    localStorage.setItem("pomodoroSessionsCompleted", sessionsCompleted);
}

// ===== Pause Timer =====
function pauseTimer() {
    if (timer) {
        clearInterval(timer);
        timer = null;
        startBtn.textContent = "▶ Resume";
        startBtn.disabled = false;
        pauseBtn.disabled = true;
        localStorage.setItem("pomodoroPaused", "true");
        localStorage.removeItem("pomodoroRunning");
    }
}

// ===== Reset Timer =====
function resetTimer() {
    pauseTimer();
    mode = "focus";
    remaining = getCurrentDuration();
    localStorage.removeItem("pomodoroRunning");
    localStorage.removeItem("pomodoroPaused");
    localStorage.removeItem("pomodoroMode");
    localStorage.removeItem("pomodoroRemaining");
    localStorage.removeItem("pomodoroTimestamp");
    localStorage.removeItem("pomodoroSessionsCompleted");
    startBtn.textContent = "▶ Start";
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    updateUI();
}

// ===== Initialize Timer =====
function initializeTimer() {
    const wasRunning     = localStorage.getItem("pomodoroRunning");
    const wasPaused      = localStorage.getItem("pomodoroPaused");
    const savedMode      = localStorage.getItem("pomodoroMode");
    const savedRemaining = parseInt(localStorage.getItem("pomodoroRemaining"));
    const savedTimestamp = parseInt(localStorage.getItem("pomodoroTimestamp"));
    const savedSessions  = parseInt(localStorage.getItem("pomodoroSessionsCompleted") || '0');

    if (savedMode) { mode = savedMode; sessionsCompleted = savedSessions; }

    if (wasRunning && savedRemaining && savedTimestamp) {
        const elapsed = Math.floor((Date.now() - savedTimestamp) / 1000);
        const newRemaining = savedRemaining - elapsed;
        if (newRemaining > 0) {
            remaining = newRemaining;
            updateUI();
            // FIX: resume = true → no duplicate start notification
            startTimer(true);
            return;
        }
    } else if (wasPaused && savedRemaining) {
        remaining = savedRemaining;
        startBtn.textContent = "▶ Resume";
        updateUI();
        return;
    }

    remaining = getCurrentDuration();
    updateUI();
    requestNotificationPermission();
}

// ===== Event Listeners =====
startBtn.addEventListener("click", () => { startTimer(false); });
pauseBtn.addEventListener("click", () => { pauseTimer(); });
resetBtn.addEventListener("click", () => {
    if (confirm('Are you sure you want to reset the timer?')) { resetTimer(); }
});

if (plantReset) {
    plantReset.addEventListener("click", () => {
        if (confirm("Reset progress and start a new tree?")) {
            stage = 0; sessionsToday = 0; sessionsCompleted = 0;
            saveState({ stage, sessionsToday, sessionsCompleted, lastDate: new Date().toDateString() });
            resetTimer();
        }
    });
}

document.addEventListener('visibilitychange', () => {
    if (!document.hidden && timer) {
        const savedRemaining = parseInt(localStorage.getItem("pomodoroRemaining"));
        const savedTimestamp = parseInt(localStorage.getItem("pomodoroTimestamp"));
        if (savedRemaining && savedTimestamp) {
            const elapsed = Math.floor((Date.now() - savedTimestamp) / 1000);
            const newRemaining = savedRemaining - elapsed;
            if (newRemaining > 0) { remaining = newRemaining; updateUI(); }
        }
        localStorage.setItem("pomodoroRemaining", remaining);
        localStorage.setItem("pomodoroTimestamp", Date.now());
    }
});

window.addEventListener("beforeunload", () => {
    if (timer) {
        localStorage.setItem("pomodoroRemaining", remaining);
        localStorage.setItem("pomodoroTimestamp", Date.now());
    }
    saveState({ stage, sessionsToday, sessionsCompleted, lastDate: new Date().toDateString() });
});

window.addEventListener('storage', (e) => {
    if (e.key === 'eduSyncSettings') { updateUI(); }
});

initializeTimer();

}); // end DOMContentLoaded


 // Direction
  if (lang === 'ar') {
    document.documentElement.setAttribute('dir', 'rtl');
    document.documentElement.setAttribute('lang', 'ar');
  } else {
    document.documentElement.setAttribute('dir', 'ltr');
    document.documentElement.setAttribute('lang', lang);
  }

  // Update labels by data-i18n attribute
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key]) el.textContent = t[key];
  });