// ===== POMODORO TIMER - FIXED VERSION =====
window.addEventListener('DOMContentLoaded', () => {

  function getSettings() {
    const saved = localStorage.getItem('eduSyncSettings');
    if (saved) {
      try {
        const s = JSON.parse(saved);
        return {
          pomodoroDuration:     parseInt(s.pomodoroDuration) || 25,
          breakDuration:        parseInt(s.breakDuration) || 5,
          longBreakDuration:    parseInt(s.longBreakDuration) || 30,
          soundEffects:         s.soundEffects !== false,
          desktopNotifications: s.desktopNotifications === true
        };
      } catch (e) {}
    }
    return { pomodoroDuration: 25, breakDuration: 5, longBreakDuration: 30, soundEffects: true, desktopNotifications: false };
  }

  const SESSIONS_BEFORE_LONG_BREAK = 4;
  const GROW_STAGES = 4;
  const focusGifUrl = "../imgs/200w.webp";
  const breakGifUrl = "../imgs/200w-1.webp";
  const API_BASE_URL = 'https://edu-sync-back-end-production.up.railway.app';

  const startBtn      = document.getElementById("startBtn");
  const pauseBtn      = document.getElementById("pauseBtn");
  const resetBtn      = document.getElementById("resetBtn");
  const timeDisplay   = document.getElementById("timeDisplay");
  const modeText      = document.getElementById("modeText");
  const sessionsTodayEl = document.getElementById("sessionsToday");
  const focusGif      = document.getElementById("focusGif");
  const treeContainer = document.getElementById("treeContainer");
  const stageText     = document.getElementById("stageText");
  const plantReset    = document.getElementById("plantReset");

  let mode = "focus";
  let remaining = 0;
  let timer = null;
  let sessionsCompleted = 0;
  let sessionsToday = 0;

  const motivationalMessages = {
    focus: [
      { ar: "رائع! أكملت جلسة تركيز كاملة. أنت تقترب من هدفك!", en: "Amazing! You completed a full focus session!" },
      { ar: "إنجاز عظيم! كل دقيقة من تركيزك تبني مستقبلك.", en: "Great achievement! Every minute builds your future." },
      { ar: "مذهل! أنت تثبت أن الإرادة أقوى من أي شيء.", en: "Incredible! You're proving willpower conquers all." },
      { ar: "ممتاز! استمر في هذا الزخم، النجاح قريب جداً.", en: "Excellent! Keep this momentum, success is close." },
      { ar: "فخور بك! أنت تحول أحلامك إلى واقع خطوة بخطوة.", en: "Proud of you! You're turning dreams into reality." }
    ],
    break: [
      { ar: "وقت الاستراحة! اشرب ماء، تمدد قليلاً، وعد بطاقة أكبر.", en: "Break time! Drink water, stretch, come back stronger." },
      { ar: "خذ نفساً عميقاً... أنت تستحق هذه الراحة.", en: "Take a deep breath... you deserve this rest." },
      { ar: "استرخ الآن! العقل يحتاج راحة ليبدع أكثر.", en: "Relax now! The mind needs rest to be creative." },
      { ar: "استراحة جميلة! حرك جسمك قليلاً واشحن طاقتك.", en: "Nice break! Move your body and recharge." }
    ],
    // FIX: added start messages for session start notifications
    focusStart: [
      { ar: "🎯 ابدأ التركيز الآن! وقت المذاكرة بدأ.", en: "🎯 Focus session started! Time to study." },
      { ar: "🎯 جلسة مذاكرة جديدة بدأت. تركيز كامل!", en: "🎯 New focus session started. Full concentration!" }
    ],
    breakStart: [
      { ar: "☕ وقت الراحة بدأ! استرخ قليلاً.", en: "☕ Break started! Take it easy." },
      { ar: "☕ استراحة مكتسبة! انت تستاهل.", en: "☕ Well-earned break! You deserve it." }
    ]
  };

  async function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return Notification.permission === 'granted';
  }

  function showBrowserNotification(message, type) {
    const settings = getSettings();
    if (!settings.desktopNotifications) return;
    if ('Notification' in window && Notification.permission === 'granted') {
      const title = type === 'focus' ? '🎉 Focus Session Complete!' :
                    type === 'focusStart' ? '🎯 Focus Session Started!' :
                    type === 'breakStart' ? '☕ Break Time Started!' : '☕ Break Complete!';
      const icon = (type === 'focus' || type === 'focusStart') ? focusGifUrl : breakGifUrl;
      const notification = new Notification(title, {
        body: message.ar + '\n' + message.en,
        icon: icon,
        badge: '../imgs/education.png',
        tag: `pomodoro-${type}-${Date.now()}`,
        requireInteraction: false,
        silent: false
      });
      notification.onclick = () => { window.focus(); notification.close(); };
      setTimeout(() => notification.close(), 5000);
    }
  }

  async function saveNotificationToBackend(message, type) {
    try {
      const token = localStorage.getItem('session_token');
      if (!token) return;

      const isStart = type === 'focusStart' || type === 'breakStart';
      const category = type.replace('Start', '');

      await fetch(`${API_BASE_URL}/api/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          title: isStart
            ? (type === 'focusStart' ? '🎯 Focus Session Started!' : '☕ Break Started!')
            : (type === 'focus' ? '🎉 Focus Session Complete!' : '☕ Break Complete!'),
          message: message.ar + ' | ' + message.en,
          type: 'pomodoro',
          category: category,
          created_at: new Date().toISOString()
        })
      });
    } catch (e) {
      console.error('Error saving notification to backend:', e);
    }
  }

  function saveNotificationToLocal(message, type) {
    try {
      const NOTIFICATIONS_KEY = "pomodoro_notifications";
      let notifications = JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || '[]');
      notifications.unshift({
        id: Date.now(),
        message: message,
        type: type.replace('Start', ''),
        category: 'pomodoro',
        timestamp: new Date().toISOString(),
        date: new Date().toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      });
      if (notifications.length > 100) notifications = notifications.slice(0, 100);
      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
    } catch(e) {}
  }

  function playNotificationSound() {
    const settings = getSettings();
    if (!settings.soundEffects) return;
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch(e) {}
  }

  // ===== FIX: sendSessionNotification — fires for BOTH start and end =====
  function sendSessionNotification(sessionType) {
    const messages = motivationalMessages[sessionType];
    if (!messages) return;
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    showBrowserNotification(randomMessage, sessionType);
    saveNotificationToBackend(randomMessage, sessionType);
    saveNotificationToLocal(randomMessage, sessionType);
    playNotificationSound();
  }

  const STATE_KEY = "pomodoro_forest_state_v2";

  function loadState() {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (!raw) return { stage: 0, sessionsToday: 0, sessionsCompleted: 0, lastDate: new Date().toDateString() };
      const s = JSON.parse(raw);
      if (s.lastDate !== new Date().toDateString()) {
        s.sessionsToday = 0; s.sessionsCompleted = 0; s.lastDate = new Date().toDateString();
      }
      return s;
    } catch (e) {
      return { stage: 0, sessionsToday: 0, sessionsCompleted: 0, lastDate: new Date().toDateString() };
    }
  }

  function saveState(state) {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  }

  const state = loadState();
  let stage = state.stage || 0;
  sessionsToday = state.sessionsToday || 0;
  sessionsCompleted = state.sessionsCompleted || 0;

  function getCurrentDuration() {
    const settings = getSettings();
    if (mode === "focus")      return settings.pomodoroDuration * 60;
    if (mode === "shortBreak") return settings.breakDuration * 60;
    return settings.longBreakDuration * 60;
  }

  function formatTime(s) {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  }

  function updateUI() {
    const settings = getSettings();
    timeDisplay.textContent = formatTime(remaining);

    let modeLabel = mode === "focus"
      ? `Mode: Focus (${settings.pomodoroDuration}m)`
      : mode === "shortBreak"
        ? `Mode: Short Break (${settings.breakDuration}m)`
        : `Mode: Long Break (${settings.longBreakDuration}m)`;

    modeText.textContent = modeLabel;
    sessionsTodayEl.textContent = `Today's Pomodoros: ${sessionsToday} | Cycle: ${sessionsCompleted % SESSIONS_BEFORE_LONG_BREAK}/${SESSIONS_BEFORE_LONG_BREAK}`;
    focusGif.src = mode === "focus" ? focusGifUrl : breakGifUrl;
    focusGif.alt = mode === "focus" ? "Focus Mode" : "Break Mode";

    if (treeContainer) treeContainer.className = "tree stage-" + Math.min(stage, GROW_STAGES);
    const names = ["Seed", "Seedling", "Young Tree", "Mature Tree", "Fully Grown Tree"];
    if (stageText) stageText.textContent = `Level: ${names[Math.min(stage, GROW_STAGES)]}`;

    const trunk = document.querySelector('.trunk');
    if (trunk) {
      trunk.style.transition = "none";
      trunk.style.strokeDashoffset = "300";
      setTimeout(() => { trunk.style.transition = "stroke-dashoffset 900ms ease"; trunk.style.strokeDashoffset = "0"; }, 10);
    }

    document.title = `${formatTime(remaining)} - EduSync ${mode === 'focus' ? '🎯' : '☕'}`;
  }

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

      const endType = mode === 'focus' ? 'focus' : 'break';
      sendSessionNotification(endType);

      if (mode === "focus") {
        sessionsToday++;
        sessionsCompleted++;
        stage = Math.min(stage + 1, GROW_STAGES);
        saveState({ stage, sessionsToday, sessionsCompleted, lastDate: new Date().toDateString() });
      }

      if (mode === "focus") {
        mode = sessionsCompleted % SESSIONS_BEFORE_LONG_BREAK === 0 ? "longBreak" : "shortBreak";
      } else {
        mode = "focus";
      }

      remaining = getCurrentDuration();
      updateUI();

      // Auto-start next session
      setTimeout(() => { startTimer(); }, 2000);
    }
  }

  function startTimer() {
    if (timer) return;
            if (!isResume) {
    const startType = mode === 'focus' ? 'focusStart' : 'breakStart';
    sendSessionNotification(startType);
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

  function initializeTimer() {
    startTimer(true); 
    const wasRunning    = localStorage.getItem("pomodoroRunning");
    const wasPaused     = localStorage.getItem("pomodoroPaused");
    const savedMode     = localStorage.getItem("pomodoroMode");
    const savedRemaining= parseInt(localStorage.getItem("pomodoroRemaining"));
    const savedTimestamp= parseInt(localStorage.getItem("pomodoroTimestamp"));
    const savedSessions = parseInt(localStorage.getItem("pomodoroSessionsCompleted") || '0');

    if (savedMode) { mode = savedMode; sessionsCompleted = savedSessions; }

    if (wasRunning && savedRemaining && savedTimestamp) {
      const elapsed = Math.floor((Date.now() - savedTimestamp) / 1000);
      const newRemaining = savedRemaining - elapsed;
      if (newRemaining > 0) {
        remaining = newRemaining;
        updateUI();
        startTimer();
        return;
      }
    } else if (wasPaused && savedRemaining) {
      remaining = savedRemaining;
      updateUI();
      return;
    }

    remaining = getCurrentDuration();
    updateUI();
    requestNotificationPermission();
  }

  startBtn.addEventListener("click", () => { startTimer(); });
  pauseBtn.addEventListener("click", () => { pauseTimer(); });
  resetBtn.addEventListener("click", () => {
    if (confirm('Are you sure you want to reset the timer?')) resetTimer();
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
      const savedRemaining  = parseInt(localStorage.getItem("pomodoroRemaining"));
      const savedTimestamp  = parseInt(localStorage.getItem("pomodoroTimestamp"));
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

  // FIX: re-read settings if they change while timer is running
  window.addEventListener('storage', (e) => {
    if (e.key === 'eduSyncSettings') updateUI();
  });

  initializeTimer();
});