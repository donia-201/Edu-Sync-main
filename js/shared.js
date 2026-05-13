// ===== SHARED.JS - Settings Integration for All Pages =====

function loadUserSettings() {
  const settings = localStorage.getItem('eduSyncSettings');
  if (settings) {
    try { return JSON.parse(settings); } catch (e) { return null; }
  }
  return null;
}

// ===== Apply Theme =====
// FIX: supports dark/light toggle + color themes
function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.body.classList.add('dark-mode');
    document.body.classList.remove('light-mode');
    return;
  }
  if (theme === 'light' || theme === 'auto') {
    document.documentElement.setAttribute('data-theme', 'light');
    document.body.classList.remove('dark-mode');
    document.body.classList.add('light-mode');
    return;
  }
  const themes = {
    blue:   { primary: '#abc4ff', bg: '#e2eafc', accent: '#b6ccfe', border: '#ccd6f6' },
    purple: { primary: '#d4a5ff', bg: '#f3e5ff', accent: '#e5c5ff', border: '#e5c5ff' },
    green:  { primary: '#a8e6cf', bg: '#dcf5ea', accent: '#b9f0d8', border: '#b9f0d8' },
    pink:   { primary: '#ffb3d9', bg: '#ffe6f4', accent: '#ffc9e5', border: '#ffc9e5' },
    sunset: { primary: '#ffb380', bg: '#ffe5d9', accent: '#ffc499', border: '#ffc499' },
    ocean:  { primary: '#80d6ff', bg: '#d9f0ff', accent: '#99ddff', border: '#99ddff' }
  };
  if (themes[theme]) {
    document.documentElement.style.setProperty('--color-primary-dark', themes[theme].primary);
    document.documentElement.style.setProperty('--color-bg-alt',       themes[theme].bg);
    document.documentElement.style.setProperty('--color-primary',      themes[theme].accent);
    document.documentElement.style.setProperty('--color-border',       themes[theme].border);
  }
}

function applyFontSize(size) {
  const sizes = { small: '90%', medium: '100%', large: '110%', 'extra-large': '120%' };
  if (sizes[size]) document.documentElement.style.fontSize = sizes[size];
}

function applyLanguage(lang) {
  if (lang === 'ar') {
    document.documentElement.setAttribute('dir', 'rtl');
    document.documentElement.setAttribute('lang', 'ar');
  } else {
    document.documentElement.setAttribute('dir', 'ltr');
    document.documentElement.setAttribute('lang', lang || 'en');
  }
}

function applyAnimations(enabled) {
  const existingStyle = document.getElementById('disable-animations');
  if (enabled === false) {
    if (!existingStyle) {
      const style = document.createElement('style');
      style.id = 'disable-animations';
      style.textContent = `*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }`;
      document.head.appendChild(style);
    }
  } else {
    if (existingStyle) existingStyle.remove();
  }
}

// ===== FIX: Main apply function — called on every page load and settings change =====
function applyAllSettings() {
  const settings = loadUserSettings();
  if (!settings) return;
  if (settings.theme)                    applyTheme(settings.theme);
  if (settings.fontSize)                 applyFontSize(settings.fontSize);
  if (settings.language)                 applyLanguage(settings.language);
  if (settings.animations !== undefined) applyAnimations(settings.animations);
}

function getPomodoroSettings() {
  const s = loadUserSettings() || {};
  return {
    pomodoroDuration:     parseInt(s.pomodoroDuration) || 25,
    breakDuration:        parseInt(s.breakDuration) || 5,
    longBreakDuration:    parseInt(s.longBreakDuration) || 30,
    autoStart:            s.autoStart === true,
    soundEffects:         s.soundEffects !== false,
    studyReminders:       s.studyReminders !== false,
    breakNotifications:   s.breakNotifications !== false,
    desktopNotifications: s.desktopNotifications === true
  };
}

function getNotificationSettings() {
  const s = loadUserSettings() || {};
  return {
    studyReminders:       s.studyReminders !== false,
    breakNotifications:   s.breakNotifications !== false,
    examReminders:        s.examReminders !== false,
    weeklyReport:         s.weeklyReport !== false,
    soundEffects:         s.soundEffects !== false,
    desktopNotifications: s.desktopNotifications === true
  };
}

function getCalendarSettings() {
  const s = loadUserSettings() || {};
  return {
    googleCalendar:  s.googleCalendar === true,
    autoAddSessions: s.autoAddSessions === true,
    syncExams:       s.syncExams === true
  };
}

async function requestNotificationPermission() {
  const settings = getNotificationSettings();
  if (settings.desktopNotifications && 'Notification' in window) {
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return Notification.permission === 'granted';
  }
  return false;
}

function showNotification(title, message, options = {}) {
  const notifSettings = getNotificationSettings();
  if (!notifSettings.desktopNotifications) return;
  if ('Notification' in window && Notification.permission === 'granted') {
    const notification = new Notification(title, {
      body: message,
      icon: options.icon || '../imgs/education.png',
      badge: '../imgs/education.png',
      tag: options.tag || 'eduSync',
      requireInteraction: options.requireInteraction || false,
      silent: !notifSettings.soundEffects,
      vibrate: [200, 100, 200]
    });
    notification.onclick = () => { window.focus(); notification.close(); if (options.onClick) options.onClick(); };
    if (options.autoClose !== false) setTimeout(() => notification.close(), options.duration || 5000);
    if (notifSettings.soundEffects) playNotificationSound();
    return notification;
  }
}

function playNotificationSound() {
  const settings = getNotificationSettings();
  if (!settings.soundEffects) return;
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.value = 0.3;
    oscillator.start();
    setTimeout(() => oscillator.stop(), 200);
  } catch(e) {}
}

// ===== FIX: re-apply settings whenever another tab/page changes them =====
window.addEventListener('storage', (e) => {
  if (e.key === 'eduSyncSettings') {
    applyAllSettings();
  }
});

// ===== FIX: Sync settings FROM backend on load =====
// Backend is the source of truth; merges into localStorage
async function syncSettingsFromBackend() {
  const token = localStorage.getItem('session_token') || localStorage.getItem('authToken');
  if (!token) return;
  try {
    const res = await fetch('https://edu-sync-back-end-production.up.railway.app/api/user/settings', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!data.success) return;

    const local = loadUserSettings() || {};
    const b = data.settings;

    const merged = {
      ...local,
      theme:             b.theme            || local.theme       || 'light',
      language:          b.language         || local.language    || 'en',
      fontSize:          b.font_size        || local.fontSize    || 'medium',
      pomodoroDuration:  b.pomodoro_duration|| local.pomodoroDuration || 25,
      breakDuration:     b.short_break      || local.breakDuration    || 5,
      longBreakDuration: b.long_break       || local.longBreakDuration|| 30,
      soundEffects:      b.sound_enabled !== undefined ? b.sound_enabled : (local.soundEffects !== false)
    };

    localStorage.setItem('eduSyncSettings', JSON.stringify(merged));
    applyAllSettings();
  } catch (e) {
    // Silently use local settings if backend is down
  }
}

// ===== Export =====
window.EduSyncSettings = {
  load: loadUserSettings,
  apply: applyAllSettings,
  applyTheme, applyFontSize, applyLanguage, applyAnimations,
  getPomodoro: getPomodoroSettings,
  getNotifications: getNotificationSettings,
  getCalendar: getCalendarSettings,
  requestNotificationPermission,
  showNotification,
  playSound: playNotificationSound
};

// ===== Auto-apply on every page load =====
document.addEventListener('DOMContentLoaded', () => {
  applyAllSettings();           // immediate from localStorage
  syncSettingsFromBackend();    // then sync from backend

  const settings = loadUserSettings();
  if (settings && settings.desktopNotifications) {
    requestNotificationPermission();
  }
});