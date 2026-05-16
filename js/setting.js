// ===== SETTINGS PAGE - FIXED VERSION =====

const API_BASE_URL = 'https://edu-sync-back-end-production.up.railway.app';

// ===== Toast instead of alert =====
function showToast(message, type = 'success') {
  let toast = document.getElementById('settings-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'settings-toast';
    toast.style.cssText = `
      position:fixed;bottom:30px;left:50%;transform:translateX(-50%);
      padding:12px 24px;border-radius:25px;font-size:14px;font-weight:600;
      z-index:9999;opacity:0;transition:opacity 0.3s ease;
      box-shadow:0 4px 15px rgba(0,0,0,0.2);max-width:90vw;text-align:center;color:#fff;
    `;
    document.body.appendChild(toast);
  }
  const colors = { success:'#4CAF50', error:'#f44336', warning:'#FF9800', info:'#2196F3' };
  toast.style.background = colors[type] || colors.success;
  toast.textContent = message;
  toast.style.opacity = '1';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { toast.style.opacity = '0'; }, 3000);
}

// ===== TRANSLATIONS (for language change) =====
// FIX: changing language changes all visible text, not just direction
const TRANSLATIONS = {
  en: {
    welcomeBack: "Welcome back",
    settings: "Settings",
    saveSettings: "Save Settings",
    account: "Account",
    displayName: "Display Name",
    email: "Email",
    studyField: "Study Field",
    appearance: "Appearance",
    theme: "Theme",
    language: "Language",
    fontSize: "Font Size",
    animations: "Animations",
    studyPreferences: "Study Preferences",
    pomodoroDuration: "Focus Duration (minutes)",
    breakDuration: "Short Break (minutes)",
    longBreakDuration: "Long Break (minutes)",
    studyGoal: "Daily Study Goal (hours)",
    autoStart: "Auto-start Next Session",
    notifications: "Notifications",
    studyReminders: "Study Reminders",
    breakNotifications: "Break Notifications",
    examReminders: "Exam Reminders",
    weeklyReport: "Weekly Report",
    soundEffects: "Sound Effects",
    desktopNotifications: "Desktop Notifications",
    saveSuccess: "Settings saved successfully!",
    saveError: "Error saving settings"
  },
  ar: {
    welcomeBack: "مرحباً بعودتك",
    settings: "الإعدادات",
    saveSettings: "حفظ الإعدادات",
    account: "الحساب",
    displayName: "الاسم",
    email: "البريد الإلكتروني",
    studyField: "مجال الدراسة",
    appearance: "المظهر",
    theme: "الثيم",
    language: "اللغة",
    fontSize: "حجم الخط",
    animations: "الحركات",
    studyPreferences: "تفضيلات الدراسة",
    pomodoroDuration: "مدة التركيز (دقائق)",
    breakDuration: "استراحة قصيرة (دقائق)",
    longBreakDuration: "استراحة طويلة (دقائق)",
    studyGoal: "هدف الدراسة اليومي (ساعات)",
    autoStart: "بدء الجلسة التالية تلقائياً",
    notifications: "الإشعارات",
    studyReminders: "تذكيرات الدراسة",
    breakNotifications: "إشعارات الاستراحة",
    examReminders: "تذكيرات الامتحانات",
    weeklyReport: "التقرير الأسبوعي",
    soundEffects: "المؤثرات الصوتية",
    desktopNotifications: "إشعارات سطح المكتب",
    saveSuccess: "تم حفظ الإعدادات بنجاح!",
    saveError: "خطأ في حفظ الإعدادات"
  },
  fr: {
    welcomeBack: "Bon retour",
    settings: "Paramètres",
    saveSettings: "Enregistrer",
    account: "Compte",
    displayName: "Nom d'affichage",
    email: "Email",
    studyField: "Domaine d'étude",
    appearance: "Apparence",
    theme: "Thème",
    language: "Langue",
    fontSize: "Taille de police",
    animations: "Animations",
    studyPreferences: "Préférences d'étude",
    pomodoroDuration: "Durée de focus (minutes)",
    breakDuration: "Pause courte (minutes)",
    longBreakDuration: "Pause longue (minutes)",
    studyGoal: "Objectif quotidien (heures)",
    autoStart: "Démarrage automatique",
    notifications: "Notifications",
    studyReminders: "Rappels d'étude",
    breakNotifications: "Notifications de pause",
    examReminders: "Rappels d'examen",
    weeklyReport: "Rapport hebdomadaire",
    soundEffects: "Effets sonores",
    desktopNotifications: "Notifications bureau",
    saveSuccess: "Paramètres sauvegardés!",
    saveError: "Erreur lors de la sauvegarde"
  }
};

// FIX: apply full language change — text + direction
function applyLanguageChange(lang) {
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;

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

  // Store language for all pages to use
  const settings = JSON.parse(localStorage.getItem('eduSyncSettings') || '{}');
  settings.language = lang;
  settings.translations = t;
  localStorage.setItem('eduSyncSettings', JSON.stringify(settings));
  localStorage.setItem('eduSyncLanguage', lang);
}

// ===== Save Settings =====
async function saveSettings() {
  const getValue  = id => document.getElementById(id)?.value;
  const getChecked = id => document.getElementById(id)?.checked;

  const displayName = getValue('displayName')?.trim();
  const studyField  = getValue('studyField');
  const language    = getValue('language');

  const settings = {
    displayName,
    email:            getValue('email'),
    studyField,
    academicLevel:    getValue('academicLevel'),
    theme:            getValue('theme'),
    language,
    fontSize:         getValue('fontSize'),
    animations:       getChecked('animations'),
    pomodoroDuration: getValue('pomodoroDuration'),
    breakDuration:    getValue('breakDuration'),
    longBreakDuration:getValue('longBreakDuration'),
    studyGoal:        getValue('studyGoal'),
    // FIX: autoStart saved and persists correctly
    autoStart:        getChecked('autoStart'),
    studyReminders:   getChecked('studyReminders'),
    breakNotifications: getChecked('breakNotifications'),
    examReminders:    getChecked('examReminders'),
    weeklyReport:     getChecked('weeklyReport'),
    soundEffects:     getChecked('soundEffects'),
    desktopNotifications: getChecked('desktopNotifications'),
    googleCalendar:   getChecked('googleCalendar'),
    autoAddSessions:  getChecked('autoAddSessions'),
    syncExams:        getChecked('syncExams'),
    analytics:        getChecked('analytics')
  };

  // Save to localStorage first
  localStorage.setItem('eduSyncSettings', JSON.stringify(settings));

  // FIX: update user object in localStorage so home.js reacts to study_field change
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  let userChanged = false;
  if (displayName && displayName !== user.name && displayName !== user.username) {
    user.name = displayName;
    user.username = displayName;
    userChanged = true;
  }
  if (studyField && studyField !== user.study_field) {
    user.study_field = studyField;
    userChanged = true;
  }
  if (userChanged) localStorage.setItem('user', JSON.stringify(user));

  // FIX: apply language change (text + direction)
  if (language) applyLanguageChange(language);

  // Apply other settings immediately
  if (window.EduSyncSettings) {
    window.EduSyncSettings.apply();
  } else {
    if (window.applyTheme)      window.applyTheme(settings.theme);
    if (window.applyFontSize)   window.applyFontSize(settings.fontSize);
    if (window.applyAnimations) window.applyAnimations(settings.animations);
  }

  // Sync to backend
  const token = localStorage.getItem('session_token') || localStorage.getItem('authToken');
  if (token) {
    try {
      // Update settings
      await fetch(`${API_BASE_URL}/api/user/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          theme:               settings.theme,
          language:            settings.language,
          font_size:           settings.fontSize,
          pomodoro_duration:   parseInt(settings.pomodoroDuration),
          short_break:         parseInt(settings.breakDuration),
          long_break:          parseInt(settings.longBreakDuration),
          notifications_enabled: settings.desktopNotifications,
          sound_enabled:       settings.soundEffects
        })
      });

      // Update profile (name + study_field)
      await fetch(`${API_BASE_URL}/api/user/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          name:        settings.displayName,
          study_field: settings.studyField
        })
      });
    } catch (e) {
      console.warn('Backend sync failed, saved locally:', e);
    }
  }

  showSuccessMessage();
  showToast(TRANSLATIONS[language]?.saveSuccess || 'Settings saved!', 'success');

  if (settings.desktopNotifications && window.requestNotificationPermission) {
    window.requestNotificationPermission();
  }
}

// ===== Load Settings =====
async function loadSettings() {
  try {
    const token = localStorage.getItem('session_token') || localStorage.getItem('authToken');
    let settings = null;

    if (token) {
      try {
        const res  = await fetch(`${API_BASE_URL}/api/user/profile`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (res.ok && data.success && data.user) {
          const u = data.user;
          settings = {
            // FIX: use name OR username correctly
            displayName:      u.name || u.username || '',
            email:            u.email || '',
            studyField:       u.study_field || '',
            theme:            u.settings?.theme || 'blue',
            language:         u.settings?.language || 'en',
            fontSize:         u.settings?.font_size || 'medium',
            pomodoroDuration: u.settings?.pomodoro_duration || 25,
            breakDuration:    u.settings?.short_break || 5,
            longBreakDuration:u.settings?.long_break || 30,
            desktopNotifications: u.settings?.notifications_enabled !== false,
            soundEffects:     u.settings?.sound_enabled !== false
          };
          // Update local user object too
          const localUser = JSON.parse(localStorage.getItem('user') || '{}');
          localStorage.setItem('user', JSON.stringify({ ...localUser, name: settings.displayName, username: settings.displayName, study_field: settings.studyField }));
        }
      } catch (e) { console.warn('Could not load from backend'); }
    }

    // Merge with localStorage
    const local = JSON.parse(localStorage.getItem('eduSyncSettings') || 'null');
    if (local) settings = { ...local, ...settings };
    if (!settings) return;

    // Apply to form
    const set = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined && val !== null) el.value = val; };
    const chk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };

    set('displayName', settings.displayName);
    set('email',       settings.email);
    set('studyField',  settings.studyField);
    set('academicLevel', settings.academicLevel);
    set('theme',       settings.theme);
    set('language',    settings.language);
    set('fontSize',    settings.fontSize);
    chk('animations',  settings.animations !== false);
    set('pomodoroDuration',  settings.pomodoroDuration);
    set('breakDuration',     settings.breakDuration);
    set('longBreakDuration', settings.longBreakDuration);
    set('studyGoal',   settings.studyGoal);
    // FIX: autoStart loaded correctly from saved settings
    chk('autoStart',   settings.autoStart);
    chk('studyReminders',     settings.studyReminders !== false);
    chk('breakNotifications', settings.breakNotifications !== false);
    chk('examReminders',      settings.examReminders !== false);
    chk('weeklyReport',       settings.weeklyReport !== false);
    chk('soundEffects',       settings.soundEffects !== false);
    chk('desktopNotifications', settings.desktopNotifications);
    chk('googleCalendar',     settings.googleCalendar);
    chk('autoAddSessions',    settings.autoAddSessions);
    chk('syncExams',          settings.syncExams);
    chk('analytics',          settings.analytics !== false);

    localStorage.setItem('eduSyncSettings', JSON.stringify(settings));

    // Apply language on load
    if (settings.language) applyLanguageChange(settings.language);

  } catch (e) { console.error('Error loading settings:', e); }
}

// ===== Reset Settings =====
async function resetSettings() {
  if (!confirm('Reset all settings to default?')) return;
  localStorage.removeItem('eduSyncSettings');
  const token = localStorage.getItem('session_token') || localStorage.getItem('authToken');
  if (token) {
    try {
      await fetch(`${API_BASE_URL}/api/user/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ theme:'blue', language:'en', font_size:'medium', pomodoro_duration:25, short_break:5, long_break:30, notifications_enabled:true, sound_enabled:true })
      });
    } catch (e) {}
  }
  window.location.reload();
}

// ===== Export Data =====
async function exportData() {
  const allData = {
    settings:      JSON.parse(localStorage.getItem('eduSyncSettings') || '{}'),
    notifications: JSON.parse(localStorage.getItem('pomodoro_notifications') || '[]'),
    pomodoroState: JSON.parse(localStorage.getItem('pomodoro_forest_state_v2') || '{}'),
    exportDate:    new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `edusync-data-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a); a.click();
  URL.revokeObjectURL(url); document.body.removeChild(a);
  showToast('Data exported!', 'success');
}

// ===== Delete Account =====
async function deleteAccount() {
  const confirmation = prompt('Type "DELETE" to permanently delete your account:');
  if (confirmation !== 'DELETE') { showToast('Cancelled', 'info'); return; }
  try {
    const token = localStorage.getItem('session_token') || localStorage.getItem('authToken');
    if (!token) { showToast('Please login first', 'error'); return; }
    const res = await fetch(`${API_BASE_URL}/api/account/delete`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) { localStorage.clear(); sessionStorage.clear(); window.location.href = '../index.html'; }
    else { const d = await res.json(); showToast('Failed: ' + (d.msg || 'Unknown error'), 'error'); }
  } catch (e) { showToast('Error: ' + e.message, 'error'); }
}

// ===== Success Message =====
function showSuccessMessage() {
  const msg = document.getElementById('successMessage');
  if (msg) { msg.style.display = 'block'; setTimeout(() => msg.style.display = 'none', 3000); }
}

// ===== Live Previews =====
document.getElementById('theme')?.addEventListener('change',    e => window.EduSyncSettings?.applyTheme(e.target.value)    || window.applyTheme?.(e.target.value));
document.getElementById('fontSize')?.addEventListener('change', e => window.EduSyncSettings?.applyFontSize(e.target.value) || window.applyFontSize?.(e.target.value));
document.getElementById('language')?.addEventListener('change', e => applyLanguageChange(e.target.value));
document.getElementById('animations')?.addEventListener('change', e => window.EduSyncSettings?.applyAnimations(e.target.checked) || window.applyAnimations?.(e.target.checked));

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();

  document.querySelector('.action-btn:not(.danger)')?.addEventListener('click', e => { e.preventDefault(); exportData(); });
  document.querySelector('.action-btn.danger')?.addEventListener('click', e => { e.preventDefault(); deleteAccount(); });
});

// ===== Auto-save =====
function enableAutoSave() {
  document.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('change', () => saveSettings());
  });
}
enableAutoSave();