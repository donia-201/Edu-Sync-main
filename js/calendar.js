
const calendarGrid      = document.getElementById('calendarGrid');
const weekdaysDiv       = document.getElementById('weekdays');
const modal             = document.getElementById('eventModal');
const closeModalBtn     = document.getElementById('closeModal');
const saveEventBtn      = document.getElementById('saveEventBtn');
const monthYearText     = document.getElementById('monthYearText');
const prevMonthBtn      = document.getElementById('prevMonth');
const nextMonthBtn      = document.getElementById('nextMonth');
const monthSelect       = document.getElementById('monthSelect');
const yearSelect        = document.getElementById('yearSelect');
const selectedDateDisplay = document.getElementById('selectedDateDisplay');

let currentDate        = new Date();
let selectedDate       = null;
let scheduledReminders = new Map();
let allEvents          = [];

function getToken() {
    return localStorage.getItem('session_token') || localStorage.getItem('authToken');
}

const API_BASE_URL = 'https://edu-sync-back-end-production.up.railway.app';

const months   = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function isMobile() { return window.innerWidth <= 768; }

function initializeSelectors() {
    months.forEach((month, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = month;
        monthSelect.appendChild(option);
    });
    const currentYear = new Date().getFullYear();
    for (let year = currentYear - 5; year <= currentYear + 10; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
    }
}

function renderWeekdays() {
    weekdaysDiv.innerHTML = '';
    weekdays.forEach(day => {
        const div = document.createElement('div');
        div.className = 'calendar-weekday';
        div.textContent = isMobile() ? day.substring(0, 3) : day;
        weekdaysDiv.appendChild(div);
    });
}

function renderCalendar() {
    const year  = currentDate.getFullYear();
    const month = currentDate.getMonth();
    monthYearText.textContent = `${months[month]} ${year}`;
    calendarGrid.innerHTML = '';
    renderWeekdays();

    const firstDay        = new Date(year, month, 1).getDay();
    const daysInMonth     = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const today           = new Date();

    for (let i = firstDay - 1; i >= 0; i--) {
        const day = document.createElement('div');
        day.classList.add('calendar-day', 'other-month');
        day.textContent = daysInPrevMonth - i;
        calendarGrid.appendChild(day);
    }

    for (let i = 1; i <= daysInMonth; i++) {
        const day = document.createElement('div');
        day.classList.add('calendar-day');
        day.textContent = i;
        if (today.getDate() === i && today.getMonth() === month && today.getFullYear() === year) {
            day.classList.add('today');
        }
        day.addEventListener('click', (e) => openModal(year, month, i, e));
        calendarGrid.appendChild(day);
    }

    const totalDays     = firstDay + daysInMonth;
    const remainingDays = totalDays % 7 === 0 ? 0 : 7 - (totalDays % 7);
    for (let i = 1; i <= remainingDays; i++) {
        const day = document.createElement('div');
        day.classList.add('calendar-day', 'other-month');
        day.textContent = i;
        calendarGrid.appendChild(day);
    }
}

function openModal(year, month, day, e) {
    selectedDate = new Date(year, month, day);
    document.querySelectorAll('.calendar-day').forEach(d => d.classList.remove('selected'));
    e.target.classList.add('selected');
    selectedDateDisplay.textContent = `Selected day: ${day} ${months[month]} ${year}`;

    const startDateTime = new Date(year, month, day, 9, 0);
    const endDateTime   = new Date(year, month, day, 10, 0);

    document.getElementById('eventTitle').value = '';
    document.getElementById('eventStart').value = formatDateTimeLocalInput(startDateTime);
    document.getElementById('eventEnd').value   = formatDateTimeLocalInput(endDateTime);
    document.getElementById('eventDesc').value  = '';
    document.getElementById('eventReminder').value = '';
    modal.classList.add('active');
}

function formatDateTimeLocalInput(date) {
    const year    = date.getFullYear();
    const month   = String(date.getMonth() + 1).padStart(2, '0');
    const day     = String(date.getDate()).padStart(2, '0');
    const hours   = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatToISO(dateTimeLocalString) {
    const date = new Date(dateTimeLocalString);
    if (isNaN(date.getTime())) {
        console.error('Invalid date:', dateTimeLocalString);
        return null;
    }
    return date.toISOString();
}

closeModalBtn.addEventListener('click', () => { modal.classList.remove('active'); });

function validateEventTimes(startStr, endStr) {
    const start = new Date(startStr);
    const end   = new Date(endStr);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return { valid: false, message: 'Invalid date format!' };
    }
    // FIX: removed "start < now" check — was blocking save for today's events
    if (end <= start) {
        return { valid: false, message: 'End time must be after start time!' };
    }
    return { valid: true };
}

function scheduleReminderNotification(eventData, remindAt) {
    const reminderTime      = new Date(remindAt);
    const now               = new Date();
    const timeUntilReminder = reminderTime - now;
    if (timeUntilReminder <= 0) return null;

    const timeoutId = setTimeout(() => {
        showReminderNotification(eventData);
        saveReminderNotification(eventData);
        scheduledReminders.delete(eventData.id);
    }, timeUntilReminder);
    return timeoutId;
}

function showReminderNotification(eventData) {
    if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification('📅 Event Reminder', {
            body: `Upcoming: ${eventData.title}\nStarts at: ${new Date(eventData.start).toLocaleString()}`,
            icon: '../imgs/education.png',
            badge: '../imgs/education.png',
            tag: `event-reminder-${eventData.id}`,
            requireInteraction: true,
            vibrate: [200, 100, 200, 100, 200]
        });
        notification.onclick = () => { window.focus(); notification.close(); };
        playNotificationSound();
    }
}

function playNotificationSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator   = audioContext.createOscillator();
        const gainNode     = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = 600;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.3;
        oscillator.start();
        setTimeout(() => oscillator.stop(), 300);
    } catch(e) { console.log('Audio not supported'); }
}

function saveReminderNotification(eventData) {
    try {
        const NOTIFICATIONS_KEY = "pomodoro_notifications";
        let notifications = JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || '[]');
        notifications.unshift({
            id: Date.now(), source: 'calendar', type: 'event',
            message: { ar: `تذكير: ${eventData.title}`, en: `Reminder: ${eventData.title}` },
            eventData: { title:eventData.title, start:eventData.start, end:eventData.end, description:eventData.description },
            timestamp: new Date().toISOString(),
            date: new Date().toLocaleString('en-US', { year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' })
        });
        if (notifications.length > 100) notifications = notifications.slice(0, 100);
        localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
    } catch (e) { console.error('Error saving reminder:', e); }
}

saveEventBtn.addEventListener('click', async () => {
    const title      = document.getElementById('eventTitle').value.trim();
    const startInput = document.getElementById('eventStart').value;
    const endInput   = document.getElementById('eventEnd').value;
    const desc       = document.getElementById('eventDesc').value.trim();
    const reminder   = document.getElementById('eventReminder').value;

    if (!title || !startInput || !endInput) {
        alert('Please fill required fields (Title, Start, End)');
        return;
    }

    const start = formatToISO(startInput);
    const end   = formatToISO(endInput);

    if (!start || !end) {
        alert('Invalid date/time format. Please check your inputs.');
        return;
    }

    const validation = validateEventTimes(start, end);
    if (!validation.valid) {
        alert(validation.message);
        return;
    }

    if (reminder && (isNaN(reminder) || parseInt(reminder) < 0)) {
        alert('Reminder must be a positive number of minutes');
        return;
    }

    let remindAt = null;
    if (reminder && parseInt(reminder) > 0) {
        const startTime = new Date(start);
        remindAt = new Date(startTime.getTime() - parseInt(reminder) * 60000);
        if (remindAt < new Date()) {
            const shouldContinue = confirm('Reminder time is in the past. Continue without reminder?');
            if (!shouldContinue) return;
            remindAt = null;
        }
    }

    const eventData = {
        title,
        start,
        end,
        description:   desc || '',
        reminder:      reminder ? { minutesBefore: parseInt(reminder) } : null,
        remindAt:      remindAt ? remindAt.toISOString() : null,
        // FIX: add reminder_sent so backend scheduler picks it up
        reminder_sent: false
    };

    saveEventBtn.disabled    = true;
    const originalText       = saveEventBtn.textContent;
    saveEventBtn.textContent = 'Saving...';

    try {
        const token    = getToken();
        const response = await fetch(`${API_BASE_URL}/api/calendar/events`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body:    JSON.stringify(eventData)
        });

        const data = await response.json();

        if (response.ok && data.success) {
            modal.classList.remove('active');
            alert('✅ Event saved successfully!');

            if (remindAt) {
                const eventId = data.event?.id || Date.now();
                eventData.id  = eventId;
                const timeoutId = scheduleReminderNotification(eventData, remindAt);
                if (timeoutId) scheduledReminders.set(eventId, timeoutId);
            }

            await loadEventsAndScheduleReminders();
            renderCalendar();
        } else {
            alert('Failed to save event: ' + (data.msg || 'Unknown error'));
        }
    } catch (err) {
        console.error('Network error:', err);
        alert('Server connection error. Please check your internet connection.');
    } finally {
        saveEventBtn.disabled    = false;
        saveEventBtn.textContent = originalText;
    }
});

async function loadEventsAndScheduleReminders() {
    try {
        const token    = getToken();
        const response = await fetch(`${API_BASE_URL}/api/calendar/events`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const data = await response.json();
            allEvents  = data.events || [];

            scheduledReminders.forEach(timeoutId => clearTimeout(timeoutId));
            scheduledReminders.clear();

            const now = new Date();
            allEvents.forEach(event => {
                if (event.remindAt) {
                    const remindAt = new Date(event.remindAt);
                    if (remindAt > now && !event.reminder_sent) {
                        const timeoutId = scheduleReminderNotification(event, event.remindAt);
                        if (timeoutId) scheduledReminders.set(event.id, timeoutId);
                    }
                }
            });
        } else {
            console.error('Failed to load events:', response.status);
        }
    } catch (err) {
        console.error('Error loading events:', err);
    }
}

prevMonthBtn.addEventListener('click', () => {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    renderCalendar();
});

nextMonthBtn.addEventListener('click', () => {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    renderCalendar();
});

window.addEventListener('resize', renderCalendar);

window.applyMonthYear = function() {
    const month = parseInt(monthSelect.value);
    const year  = parseInt(yearSelect.value);
    currentDate = new Date(year, month, 1);
    renderCalendar();
    const selector = document.getElementById('monthYearSelector');
    if (selector) selector.style.display = 'none';
};

window.toggleMonthYearSelector = function() {
    const selector = document.getElementById('monthYearSelector');
    if (!selector) return;
    const isVisible = selector.style.display === 'flex';
    selector.style.display = isVisible ? 'none' : 'flex';
    if (!isVisible) {
        monthSelect.value = currentDate.getMonth();
        yearSelect.value  = currentDate.getFullYear();
    }
};

async function requestNotificationPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
        await Notification.requestPermission();
    }
}

async function initialize() {
    const token = getToken();
    if (!token) {
        alert('⚠️ You need to login first!');
        window.location.href = '../index.html';
        return;
    }
    initializeSelectors();
    renderCalendar();
    await requestNotificationPermission();
    await loadEventsAndScheduleReminders();
}

initialize();

setInterval(() => { loadEventsAndScheduleReminders(); }, 60000);

window.addEventListener('beforeunload', () => {
    scheduledReminders.forEach(timeoutId => clearTimeout(timeoutId));
    scheduledReminders.clear();
});