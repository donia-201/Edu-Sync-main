const API_BASE_URL = 'https://edu-sync-back-end-production.up.railway.app';
const POMODORO_NOTIFICATIONS_KEY = "pomodoro_notifications";
const LAST_NOTIFICATION_CHECK = "last_notification_check";

const notificationsList = document.getElementById('notificationsList');
const emptyState        = document.getElementById('emptyState');
const clearAllBtn       = document.getElementById('clearAllBtn');

let allNotifications = [];

// ===== Request Notification Permission =====
async function requestNotificationPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }
  return false;
}

// ===== Show Browser Notification =====
function showBrowserNotification(title, body, iconType = 'default', tag = 'eduSync') {
  if (Notification.permission !== "granted") return;
  try {
    const iconMap = {
      focus:   '../imgs/200w.webp',
      break:   '../imgs/200w-1.webp',
      default: '../imgs/education.png'
    };
    const notification = new Notification(title, {
      body,
      icon:  iconMap[iconType] || iconMap.default,
      badge: '../imgs/education.png',
      tag,
      requireInteraction: false,
      silent: false,
      vibrate: [200, 100, 200],
      timestamp: Date.now()
    });
    playNotificationSound();
    setTimeout(() => notification.close(), 5000);
    notification.onclick = (e) => {
      e.preventDefault();
      window.focus();
      notification.close();
      if (!window.location.href.includes('notification.html')) {
        window.location.href = '../pages/notification.html';
      }
    };
    return notification;
  } catch (error) {
    console.error('Error showing notification:', error);
  }
}

// ===== Play Notification Sound =====
function playNotificationSound() {
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

// ===== FIX: Fetch Backend Notifications — correct field mapping =====
async function fetchBackendNotifications() {
  const token = localStorage.getItem('session_token') || localStorage.getItem('authToken');
  if (!token) return [];
  try {
    const res = await fetch(`${API_BASE_URL}/api/notifications`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const data = await res.json();
    if (!data.success) return [];

    return data.notifications.map(n => ({
      id:        `backend_${n.id}`,
      source:    'backend',
      title:     n.title,
      message:   n.message,
      type:      n.type || 'event',       // pomodoro | event
      category:  n.category || '',        // focus | break
      is_read:   n.is_read,
      timestamp: n.created_at,
      date: new Date(n.created_at).toLocaleString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
      }),
      backendId: n.id
    }));
  } catch (error) {
    console.error('Error fetching backend notifications:', error);
    return [];
  }
}

// ===== Fetch Pomodoro Notifications from LocalStorage =====
function fetchPomodoroNotifications() {
  try {
    return JSON.parse(localStorage.getItem(POMODORO_NOTIFICATIONS_KEY) || '[]')
      .map(n => ({ ...n, source: 'pomodoro' }));
  } catch (e) {
    return [];
  }
}

// ===== Check for New Notifications (browser popups) =====
async function checkForNewNotifications() {
  const lastCheck = localStorage.getItem(LAST_NOTIFICATION_CHECK);
  const lastCheckTime = lastCheck ? new Date(lastCheck) : new Date(0);

  // Pomodoro notifications
  const pomodoroNotifs = fetchPomodoroNotifications();
  pomodoroNotifs.filter(n => new Date(n.timestamp) > lastCheckTime).forEach(notif => {
    const iconType = notif.type === 'focus' ? 'focus' : 'break';
    const title = notif.type === 'focus' ? '🎉 Focus Session Complete!' : '☕ Break Time!';
    const body  = (notif.message?.en) || notif.message || '';
    showBrowserNotification(title, body, iconType, `pomodoro-${notif.id}`);
  });

  // Backend notifications (event reminders + pomodoro saved to backend)
  const backendNotifs = await fetchBackendNotifications();
  backendNotifs
    .filter(n => !n.is_read && new Date(n.timestamp) > lastCheckTime)
    .forEach(notif => {
      const iconType = notif.type === 'pomodoro'
        ? (notif.category === 'focus' ? 'focus' : 'break')
        : 'default';
      showBrowserNotification(notif.title, notif.message, iconType, `backend-${notif.id}`);
    });

  localStorage.setItem(LAST_NOTIFICATION_CHECK, new Date().toISOString());
}

// ===== Load All Notifications =====
async function loadAllNotifications() {
  try {
    const [backendNotifs, pomodoroNotifs] = await Promise.all([
      fetchBackendNotifications(),
      Promise.resolve(fetchPomodoroNotifications())
    ]);

    allNotifications = [...backendNotifs, ...pomodoroNotifs];
    allNotifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    renderNotifications();
    await checkForNewNotifications();
  } catch (e) {
    console.error('Error loading notifications:', e);
  }
}

// ===== Render Notifications =====
function renderNotifications() {
  if (allNotifications.length === 0) {
    notificationsList.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';
    if (clearAllBtn) clearAllBtn.style.display = 'none';
    return;
  }

  notificationsList.style.display = 'block';
  if (emptyState) emptyState.style.display = 'none';
  if (clearAllBtn) clearAllBtn.style.display = 'block';

  notificationsList.innerHTML = allNotifications.map(notif => {
    if (notif.source === 'pomodoro') {
      const iconMap  = { focus: '🎉', break: '☕', event: '📅', focusStart: '🎯', breakStart: '☕' };
      const labelMap = { focus: '🎯 Focus Session', break: '☕ Break Time', event: '📅 Calendar Event', focusStart: '🎯 Session Started', breakStart: '☕ Break Started' };
      const msgAr = notif.message?.ar || '';
      const msgEn = notif.message?.en || notif.message || '';

      return `
        <div class="notification-card ${notif.type}-type" data-id="${notif.id}">
          <div class="notification-header">
            <div class="notification-icon">${iconMap[notif.type] || '🔔'}</div>
            <div class="notification-time"><i class="far fa-clock"></i> ${notif.date}</div>
          </div>
          <div class="notification-content">
            ${msgAr ? `<div class="notification-message-ar">${msgAr}</div>` : ''}
            <div class="notification-message-en">${msgEn}</div>
            <span class="notification-type-badge">${labelMap[notif.type] || '🔔 Notification'}</span>
          </div>
        </div>`;
    } else {
      // Backend notification (event reminder OR pomodoro saved to backend)
      const isPomo  = notif.type === 'pomodoro';
      const icon    = isPomo ? (notif.category === 'focus' ? '🎯' : '☕') : '📅';
      const badge   = isPomo ? (notif.category === 'focus' ? '🎯 Focus Session' : '☕ Break') : '📅 Calendar Event';

      return `
        <div class="notification-card event-type ${notif.is_read ? 'read' : 'unread'}"
             data-id="${notif.id}"
             data-backend-id="${notif.backendId}">
          <div class="notification-header">
            <div class="notification-icon">${icon}</div>
            <div class="notification-time"><i class="far fa-clock"></i> ${notif.date}</div>
          </div>
          <div class="notification-content">
            <h4 class="notification-title">${notif.title}</h4>
            <p class="notification-message">${notif.message}</p>
            <span class="notification-type-badge">${badge}</span>
          </div>
          ${!notif.is_read ? '<span class="unread-badge">New</span>' : ''}
        </div>`;
    }
  }).join('');

  // Mark as read on click
  document.querySelectorAll('.notification-card[data-backend-id]').forEach(card => {
    card.addEventListener('click', async () => {
      const backendId = card.dataset.backendId;
      if (backendId && !card.classList.contains('read')) {
        await markAsRead(backendId);
        card.classList.add('read');
        card.classList.remove('unread');
        const badge = card.querySelector('.unread-badge');
        if (badge) badge.remove();
      }
    });
  });

  // Animate cards
  document.querySelectorAll('.notification-card').forEach((card, index) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    setTimeout(() => {
      card.style.transition = 'all 0.4s ease';
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    }, index * 50);
  });
}

// ===== Mark Backend Notification as Read =====
async function markAsRead(backendId) {
  const token = localStorage.getItem('session_token') || localStorage.getItem('authToken');
  if (!token) return;
  try {
    await fetch(`${API_BASE_URL}/api/notifications/${backendId}/read`, {
      method: "PUT",
      headers: { "Authorization": `Bearer ${token}` }
    });
  } catch (error) {
    console.error('Error marking as read:', error);
  }
}

// FIX: DELETE backend notification
async function deleteBackendNotification(backendId) {
  const token = localStorage.getItem('session_token') || localStorage.getItem('authToken');
  if (!token) return;
  try {
    await fetch(`${API_BASE_URL}/api/notifications/${backendId}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` }
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
  }
}

// ===== FIX: Clear All — now uses DELETE endpoint for backend notifications =====
if (clearAllBtn) {
  clearAllBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all notifications?')) {
      // Clear local pomodoro notifications
      localStorage.removeItem(POMODORO_NOTIFICATIONS_KEY);

      // Delete backend notifications via DELETE endpoint
      const backendNotifs = allNotifications.filter(n => n.source === 'backend');
      await Promise.all(backendNotifs.map(n => deleteBackendNotification(n.backendId)));

      await loadAllNotifications();
    }
  });
}

// ===== Initialize =====
async function initialize() {
  const hasPermission = await requestNotificationPermission();
  if (!hasPermission && notificationsList) {
    const permissionBanner = document.createElement('div');
    permissionBanner.className = 'notification-card';
    permissionBanner.style.background = 'linear-gradient(135deg, #ffd93d, #f6a400)';
    permissionBanner.innerHTML = `
      <div class="notification-content" style="text-align: center;">
        <h4>🔔 Enable Notifications</h4>
        <p>Enable browser notifications to receive alerts even when you're away!</p>
        <button onclick="location.reload()" style="background: white; color: #f6a400; border: none; padding: 10px 20px; border-radius: 20px; cursor: pointer; margin-top: 10px;">
          Enable Now
        </button>
      </div>`;
    notificationsList.insertBefore(permissionBanner, notificationsList.firstChild);
  }
  await loadAllNotifications();
}

// ===== Auto-refresh every 10 seconds =====
setInterval(async () => {
  if (!document.hidden) await loadAllNotifications();
}, 10000);

document.addEventListener('visibilitychange', async () => {
  if (!document.hidden) await loadAllNotifications();
});

initialize();

// ===== Export for other pages =====
window.EduSyncNotifications = {
  show:              showBrowserNotification,
  requestPermission: requestNotificationPermission,
  check:             checkForNewNotifications
};