// ===== POMODORO TIMER - FIXED VERSION =====
window.addEventListener('DOMContentLoaded', () => {

  // FIX: always read settings fresh from localStorage — persists across sessions
  function getSettings() {
    try {
      const s = JSON.parse(localStorage.getItem('eduSyncSettings') || '{}');
      return {
        pomodoroDuration:     parseInt(s.pomodoroDuration) || 25,
        breakDuration:        parseInt(s.breakDuration) || 5,
        longBreakDuration:    parseInt(s.longBreakDuration) || 30,
        soundEffects:         s.soundEffects !== false,
        desktopNotifications: s.desktopNotifications === true,
        // FIX: autoStart read from settings, not hardcoded
        autoStartNext:        s.autoStart === true,
        studyGoal:            parseInt(s.studyGoal) || 0
      };
    } catch (e) {
      return { pomodoroDuration:25, breakDuration:5, longBreakDuration:30, soundEffects:true, desktopNotifications:false, autoStartNext:false, studyGoal:0 };
    }
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
  // FIX: track if current run is a resume (don't re-send start notification)
  let isResume = false;

  const motivationalMessages = {
    focus: [
      { ar: "رائع! أكملت جلسة تركيز كاملة!", en: "Amazing! You completed a full focus session!" },
      { ar: "إنجاز عظيم! كل دقيقة تبني مستقبلك.", en: "Great! Every minute builds your future." },
      { ar: "مذهل! استمر وأنت على الطريق الصحيح.", en: "Incredible! Keep going, you're on track." }
    ],
    break: [
      { ar: "وقت الاستراحة! اشرب ماء وتمدد.", en: "Break time! Drink water and stretch." },
      { ar: "خذ نفساً عميقاً... أنت تستحق هذه الراحة.", en: "Take a deep breath... you deserve this rest." }
    ],
    focusStart: [
      { ar: "🎯 جلسة مذاكرة جديدة بدأت. تركيز كامل!", en: "🎯 Focus session started! Time to study." }
    ],
    breakStart: [
      { ar: "☕ وقت الراحة بدأ! استرخ قليلاً.", en: "☕ Break started! Take it easy." }
    ],
    // FIX: goal reached notification
    goalReached: [
      { ar: "🏆 أحسنت! لقد وصلت لهدف الدراسة اليومي!", en: "🏆 Awesome! You've reached your daily study goal!" },
      { ar: "🌟 مبروك! هدفك اليومي اكتمل. أنت بطل!", en: "🌟 Congrats! Daily goal complete. You're a champion!" }
    ]
  };

  async function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    return Notification.permission === 'granted';
  }

  function showBrowserNotification(message, type) {
    const s = getSettings();
    if (!s.desktopNotifications || Notification.permission !== 'granted') return;
    const titles = { focus:'🎉 Focus Complete!', break:'☕ Break Complete!', focusStart:'🎯 Focus Started!', breakStart:'☕ Break Started!', goalReached:'🏆 Goal Reached!' };
    const icon   = (type === 'focus' || type === 'focusStart') ? focusGifUrl : breakGifUrl;
    const n = new Notification(titles[type] || '🔔 EduSync', {
      body: (message.ar || '') + ' ' + (message.en || message),
      icon, tag: `pomo-${type}-${Date.now()}`
    });
    n.onclick = () => { window.focus(); n.close(); };
    setTimeout(() => n.close(), 5000);
  }

  async function saveNotificationToBackend(message, type) {
    try {
      const token = localStorage.getItem('session_token') || localStorage.getItem('authToken');
      if (!token) return;
      const isStart = type.endsWith('Start');
      await fetch(`${API_BASE_URL}/api/notifications`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${token}` },
        body: JSON.stringify({
          title:    isStart ? (type === 'focusStart' ? '🎯 Focus Session Started!' : '☕ Break Started!') :
                    type === 'focus' ? '🎉 Focus Session Complete!' :
                    type === 'goalReached' ? '🏆 Study Goal Reached!' : '☕ Break Complete!',
          message:  (message.ar || '') + ' | ' + (message.en || message),
          type:     type === 'goalReached' ? 'event' : 'pomodoro',
          category: type.replace('Start',''),
          created_at: new Date().toISOString()
        })
      });
    } catch (e) { console.error('Backend notification error:', e); }
  }

  function saveNotificationToLocal(message, type) {
    try {
      const notifs = JSON.parse(localStorage.getItem("pomodoro_notifications") || '[]');
      notifs.unshift({ id:Date.now(), message, type:type.replace('Start',''), category:'pomodoro', timestamp:new Date().toISOString(), date:new Date().toLocaleString() });
      localStorage.setItem("pomodoro_notifications", JSON.stringify(notifs.slice(0,100)));
    } catch(e) {}
  }

  function playNotificationSound() {
    if (!getSettings().soundEffects) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain= ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 800; osc.type = 'sine'; gain.gain.value = 0.3;
      osc.start(); setTimeout(() => osc.stop(), 200);
    } catch(e) {}
  }

  function sendNotification(type) {
    const msgs = motivationalMessages[type];
    if (!msgs) return;
    const msg = msgs[Math.floor(Math.random() * msgs.length)];
    showBrowserNotification(msg, type);
    saveNotificationToBackend(msg, type);
    saveNotificationToLocal(msg, type);
    playNotificationSound();
  }

  // FIX: check if daily goal was reached after each focus session
  function checkGoalReached() {
    const s = getSettings();
    if (!s.studyGoal || s.studyGoal <= 0) return;
    const goalMinutes = s.studyGoal * 60;
    const studiedMinutes = sessionsToday * s.pomodoroDuration;
    if (studiedMinutes >= goalMinutes && (studiedMinutes - s.pomodoroDuration) < goalMinutes) {
      // Just crossed the goal threshold
      sendNotification('goalReached');
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
    } catch (e) { return { stage:0, sessionsToday:0, sessionsCompleted:0, lastDate:new Date().toDateString() }; }
  }

  function saveState(s) { localStorage.setItem(STATE_KEY, JSON.stringify(s)); }

  const state = loadState();
  let stage = state.stage || 0;
  sessionsToday = state.sessionsToday || 0;
  sessionsCompleted = state.sessionsCompleted || 0;

  function getCurrentDuration() {
    const s = getSettings();
    if (mode === "focus")      return s.pomodoroDuration * 60;
    if (mode === "shortBreak") return s.breakDuration * 60;
    return s.longBreakDuration * 60;
  }

  function formatTime(s) {
    return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
  }

  function updateUI() {
    const s = getSettings();
    if (timeDisplay) timeDisplay.textContent = formatTime(remaining);
    if (modeText) {
      modeText.textContent = mode === "focus"
        ? `Mode: Focus (${s.pomodoroDuration}m)`
        : mode === "shortBreak"
          ? `Mode: Short Break (${s.breakDuration}m)`
          : `Mode: Long Break (${s.longBreakDuration}m)`;
    }
    if (sessionsTodayEl) sessionsTodayEl.textContent = `Today: ${sessionsToday} sessions | Cycle: ${sessionsCompleted % SESSIONS_BEFORE_LONG_BREAK}/${SESSIONS_BEFORE_LONG_BREAK}`;
    if (focusGif) { focusGif.src = mode === "focus" ? focusGifUrl : breakGifUrl; }
    if (treeContainer) treeContainer.className = "tree stage-" + Math.min(stage, GROW_STAGES);
    const names = ["Seed","Seedling","Young Tree","Mature Tree","Fully Grown Tree"];
    if (stageText) stageText.textContent = `Level: ${names[Math.min(stage, GROW_STAGES)]}`;
    document.title = `${formatTime(remaining)} - EduSync ${mode==='focus'?'🎯':'☕'}`;
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
      isResume = false;

      // Notify session END
      sendNotification(mode === 'focus' ? 'focus' : 'break');

      if (mode === "focus") {
        sessionsToday++;
        sessionsCompleted++;
        stage = Math.min(stage + 1, GROW_STAGES);
        saveState({ stage, sessionsToday, sessionsCompleted, lastDate: new Date().toDateString() });
        // FIX: check if daily goal reached
        checkGoalReached();
      }

      // Switch mode
      mode = mode === "focus"
        ? (sessionsCompleted % SESSIONS_BEFORE_LONG_BREAK === 0 ? "longBreak" : "shortBreak")
        : "focus";

      remaining = getCurrentDuration();
      updateUI();

      if (startBtn) { startBtn.textContent = "▶ Start"; startBtn.disabled = false; }
      if (pauseBtn) pauseBtn.disabled = true;

      // FIX: only auto-start next session if autoStartNext is enabled in settings
      if (getSettings().autoStartNext) {
        setTimeout(() => startTimer(false), 2000);
      }
    }
  }

  // FIX: isResume param — don't send start notification on resume
  function startTimer(resume = false) {
    if (timer) return;
    isResume = resume;

    // Only send start notification on NEW session, not resume
    if (!resume) {
      sendNotification(mode === 'focus' ? 'focusStart' : 'breakStart');
    }

    timer = setInterval(tick, 1000);
    if (startBtn) { startBtn.textContent = mode === "focus" ? "🎯 Studying..." : "☕ Relaxing..."; startBtn.disabled = true; }
    if (pauseBtn) pauseBtn.disabled = false;

    localStorage.setItem("pomodoroRunning", "true");
    localStorage.setItem("pomodoroPaused", "false");
    localStorage.setItem("pomodoroMode", mode);
    localStorage.setItem("pomodoroRemaining", remaining);
    localStorage.setItem("pomodoroTimestamp", Date.now());
    localStorage.setItem("pomodoroSessionsCompleted", sessionsCompleted);
  }

  function pauseTimer() {
    if (timer) {
      clearInterval(timer); timer = null;
      if (startBtn) { startBtn.textContent = "▶ Resume"; startBtn.disabled = false; }
      if (pauseBtn) pauseBtn.disabled = true;
      localStorage.setItem("pomodoroPaused", "true");
      localStorage.removeItem("pomodoroRunning");
    }
  }

  function resetTimer() {
    pauseTimer();
    mode = "focus"; remaining = getCurrentDuration(); isResume = false;
    localStorage.removeItem("pomodoroRunning");
    localStorage.removeItem("pomodoroPaused");
    localStorage.removeItem("pomodoroMode");
    localStorage.removeItem("pomodoroRemaining");
    localStorage.removeItem("pomodoroTimestamp");
    localStorage.removeItem("pomodoroSessionsCompleted");
    if (startBtn) { startBtn.textContent = "▶ Start"; startBtn.disabled = false; }
    if (pauseBtn) pauseBtn.disabled = true;
    updateUI();
  }

  function initializeTimer() {
    const wasRunning     = localStorage.getItem("pomodoroRunning") === "true";
    const wasPaused      = localStorage.getItem("pomodoroPaused") === "true";
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
      if (startBtn) startBtn.textContent = "▶ Resume";
      updateUI();
      return;
    }

    remaining = getCurrentDuration();
    updateUI();
    requestNotificationPermission();
  }

  startBtn?.addEventListener("click", () => startTimer(false));
  pauseBtn?.addEventListener("click", () => pauseTimer());
  resetBtn?.addEventListener("click", () => { if (confirm('Reset timer?')) resetTimer(); });

  plantReset?.addEventListener("click", () => {
    if (confirm("Reset progress and start a new tree?")) {
      stage = 0; sessionsToday = 0; sessionsCompleted = 0;
      saveState({ stage, sessionsToday, sessionsCompleted, lastDate: new Date().toDateString() });
      resetTimer();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && timer) {
      const saved = parseInt(localStorage.getItem("pomodoroRemaining"));
      const ts    = parseInt(localStorage.getItem("pomodoroTimestamp"));
      if (saved && ts) {
        const elapsed = Math.floor((Date.now() - ts) / 1000);
        if (saved - elapsed > 0) { remaining = saved - elapsed; updateUI(); }
      }
      localStorage.setItem("pomodoroRemaining", remaining);
      localStorage.setItem("pomodoroTimestamp", Date.now());
    }
  });

  window.addEventListener("beforeunload", () => {
    if (timer) { localStorage.setItem("pomodoroRemaining", remaining); localStorage.setItem("pomodoroTimestamp", Date.now()); }
    saveState({ stage, sessionsToday, sessionsCompleted, lastDate: new Date().toDateString() });
  });

  // FIX: update UI if settings change while timer is open
  window.addEventListener('storage', e => { if (e.key === 'eduSyncSettings') updateUI(); });

  initializeTimer();
});