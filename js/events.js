// ===== EVENTS.JS - Note-style cards with color picker =====

const eventsContainer = document.getElementById('eventsContainer');
const syncStatus      = document.getElementById('syncStatus');
const authToken       = localStorage.getItem('session_token') || localStorage.getItem('authToken');
const API_BASE        = 'https://edu-sync-back-end-production.up.railway.app';

// ===== Toast =====
function showToast(message, type = 'info') {
    let toast = document.getElementById('ev-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'ev-toast';
        toast.style.cssText = `
            position:fixed;bottom:30px;left:50%;transform:translateX(-50%);
            padding:12px 24px;border-radius:25px;font-size:14px;font-weight:600;
            z-index:9999;opacity:0;transition:opacity 0.3s ease;
            box-shadow:0 4px 15px rgba(0,0,0,0.2);max-width:90vw;text-align:center;color:#fff;
        `;
        document.body.appendChild(toast);
    }
    const colors = { success:'#4CAF50', error:'#f44336', warning:'#FF9800', info:'#2196F3' };
    toast.style.background = colors[type] || colors.info;
    toast.textContent = message;
    toast.style.opacity = '1';
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { toast.style.opacity = '0'; }, 3000);
}

function updateSyncStatus(status, message) {
    if (!syncStatus) return;
    syncStatus.className = `sync-status ${status}`;
    const icons = { syncing:'fa-sync-alt fa-spin', synced:'fa-check-circle', error:'fa-exclamation-circle' };
    syncStatus.innerHTML = `<i class="fas ${icons[status] || 'fa-circle'}"></i> ${message}`;
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleString('en-US', {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

// ===== Fetch Events =====
async function fetchEvents() {
    try {
        updateSyncStatus('syncing', 'Syncing...');
        if (!authToken) throw new Error('Please login first!');

        const res  = await fetch(`${API_BASE}/api/events`, {
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' }
        });

        if (res.status === 401) {
            showToast('Session expired. Please login again.', 'error');
            setTimeout(() => { window.location.href = '../pages/login.html'; }, 1500);
            return;
        }
        if (!res.ok) throw new Error(`Server error: ${res.status}`);

        const data   = await res.json();
        let events   = data.success && data.events ? data.events : [];

        // Sync any local pending events
        const newEvents = JSON.parse(localStorage.getItem('newEvents') || '[]');
        if (newEvents.length > 0) {
            events = [...events, ...newEvents];
            await syncNewEventsToBackend(newEvents);
        }

        if (events.length === 0) {
            eventsContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-plus"></i>
                    <h3>No Events Yet</h3>
                    <p>Start adding events from the calendar page</p>
                </div>`;
            updateSyncStatus('synced', 'No events found');
        } else {
            renderEvents(events);
            updateSyncStatus('synced', `${events.length} events loaded`);
        }
    } catch (err) {
        eventsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Connection Error</h3>
                <p>${err.message}</p>
                <button onclick="fetchEvents()" style="margin-top:12px;padding:8px 20px;border:none;border-radius:20px;background:var(--color-primary-dark);color:white;cursor:pointer;font-weight:600;">
                    <i class="fas fa-redo"></i> Try Again
                </button>
            </div>`;
        updateSyncStatus('error', 'Loading failed');
    }
}

// ===== Sync local events =====
async function syncNewEventsToBackend(newEvents) {
    const syncedIds = [];
    for (const ev of newEvents) {
        try {
            const res = await fetch(`${API_BASE}/api/events`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                body: JSON.stringify({ title: ev.title, start: ev.start, end: ev.end, type: ev.type || 'focus', description: ev.description || '' })
            });
            if (res.ok) { const d = await res.json(); if (d.success) syncedIds.push(ev.id); }
        } catch (e) { console.error('Sync failed:', ev.title, e); }
    }
    if (syncedIds.length > 0) {
        localStorage.setItem('newEvents', JSON.stringify(newEvents.filter(e => !syncedIds.includes(e.id))));
    }
}

// ===== Render Events — Note-style cards =====
function renderEvents(events) {
    eventsContainer.innerHTML = '';
    events.sort((a, b) => new Date(a.start) - new Date(b.start));

    events.forEach(ev => {
        const card = document.createElement('div');
        card.className = 'event-card';
        card.dataset.id = ev.id;
        // Apply saved color or default
        card.style.backgroundColor = ev.color || '#ffffff';

        // ===== Top Controls (like notes) =====
        const controls = document.createElement('div');
        controls.className = 'note-controls';
        controls.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;';

        // Color picker
        const colorPicker = document.createElement('input');
        colorPicker.type  = 'color';
        colorPicker.value = ev.color || '#ffffff';
        colorPicker.title = 'Change card color';
        colorPicker.style.cssText = 'width:28px;height:28px;border:none;border-radius:50%;cursor:pointer;padding:0;background:none;';
        colorPicker.addEventListener('input', async (e) => {
            ev.color = e.target.value;
            card.style.backgroundColor = ev.color;
            await updateEvent(ev.id, { color: ev.color });
        });

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.title = 'Delete event';
        deleteBtn.style.cssText = 'background:none;border:none;cursor:pointer;color:#ff6b6b;font-size:1rem;padding:4px;';
        deleteBtn.addEventListener('click', async () => {
            if (confirm('Delete this event?')) await deleteEvent(ev.id);
        });

        controls.appendChild(colorPicker);
        controls.appendChild(deleteBtn);
        card.appendChild(controls);

        // ===== Event Title (editable like notes) =====
        const titleEl = document.createElement('div');
        titleEl.className = 'event-title';
        titleEl.contentEditable = 'true';
        titleEl.innerText = ev.title || 'Untitled Event';
        titleEl.style.cssText = `
            font-family: var(--font-heading);
            font-size: 1.4rem;
            font-weight: bold;
            color: var(--color-heading);
            margin-bottom: 10px;
            outline: none;
            border-bottom: 1px dashed transparent;
        `;
        titleEl.addEventListener('focus', () => { titleEl.style.borderBottomColor = 'var(--color-primary-dark)'; });
        titleEl.addEventListener('blur', async () => {
            titleEl.style.borderBottomColor = 'transparent';
            const newTitle = titleEl.innerText.trim();
            if (newTitle && newTitle !== ev.title) {
                ev.title = newTitle;
                await updateEvent(ev.id, { title: newTitle });
            } else if (!newTitle) {
                titleEl.innerText = ev.title;
            }
        });
        card.appendChild(titleEl);

        // ===== Details Section =====
        const details = document.createElement('div');
        details.className = 'event-details';
        details.style.cssText = `
            background: rgba(255,255,255,0.5);
            border-radius: 10px;
            padding: 10px 12px;
            margin-bottom: 10px;
            display: flex;
            flex-direction: column;
            gap: 6px;
        `;

        // Start time
        const startRow = document.createElement('div');
        startRow.className = 'event-detail';
        startRow.innerHTML = `<i class="fas fa-play-circle" style="color:var(--color-primary-dark);width:18px;"></i>
            <span>${formatDate(ev.start)}</span>`;

        // End time
        const endRow = document.createElement('div');
        endRow.className = 'event-detail';
        endRow.innerHTML = `<i class="fas fa-stop-circle" style="color:#ff6b6b;width:18px;"></i>
            <span>${formatDate(ev.end)}</span>`;

        details.appendChild(startRow);
        details.appendChild(endRow);

        // Reminder
        if (ev.remindAt) {
            const remRow = document.createElement('div');
            remRow.className = 'event-detail';
            remRow.innerHTML = `<i class="fas fa-bell" style="color:#ffd93d;width:18px;"></i>
                <span>Reminder: ${formatDate(ev.remindAt)}</span>`;
            details.appendChild(remRow);
        }

        card.appendChild(details);

        // ===== Description (editable) =====
        const descEl = document.createElement('div');
        descEl.className = 'event-description';
        descEl.contentEditable = 'true';
        descEl.innerText = ev.description || 'Add description...';
        descEl.style.cssText = `
            color: var(--color-text-light);
            font-size: 0.9rem;
            line-height: 1.6;
            margin-bottom: 12px;
            outline: none;
            min-height: 20px;
            font-style: ${ev.description ? 'normal' : 'italic'};
        `;
        descEl.addEventListener('focus', () => {
            if (descEl.innerText === 'Add description...') {
                descEl.innerText = '';
                descEl.style.fontStyle = 'normal';
            }
        });
        descEl.addEventListener('blur', async () => {
            const newDesc = descEl.innerText.trim();
            if (!newDesc || newDesc === 'Add description...') {
                descEl.innerText = 'Add description...';
                descEl.style.fontStyle = 'italic';
                return;
            }
            if (newDesc !== ev.description) {
                ev.description = newDesc;
                await updateEvent(ev.id, { description: newDesc });
            }
        });
        card.appendChild(descEl);

        // ===== Timestamp =====
        if (ev.created_at || ev.createdAt) {
            const ts = document.createElement('div');
            ts.className = 'note-timestamp';
            ts.style.cssText = 'font-size:0.78rem;color:var(--color-text-light);margin-top:4px;';
            ts.innerHTML = `<i class="far fa-clock"></i> ${formatDate(ev.created_at || ev.createdAt)}`;
            card.appendChild(ts);
        }

        // ===== Type Badge =====
        if (ev.type) {
            const badge = document.createElement('span');
            badge.className = 'event-type-badge';
            badge.textContent = ev.type.charAt(0).toUpperCase() + ev.type.slice(1);
            badge.style.cssText = `
                display:inline-block;margin-top:8px;
                padding:3px 12px;border-radius:20px;font-size:0.78rem;font-weight:700;color:white;
                background: ${ev.type === 'exam' ? '#ff6b6b' : ev.type === 'assignment' ? '#ffd93d' : 'var(--color-primary-dark)'};
                color: ${ev.type === 'assignment' ? '#333' : 'white'};
            `;
            card.appendChild(badge);
        }

        eventsContainer.appendChild(card);
    });
}

// ===== Delete Event =====
async function deleteEvent(id) {
    try {
        updateSyncStatus('syncing', 'Removing...');
        const res  = await fetch(`${API_BASE}/api/events/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (data.success) {
            showToast('Event deleted', 'success');
            fetchEvents();
        } else {
            throw new Error(data.msg || 'Failed to delete');
        }
    } catch (err) {
        updateSyncStatus('error', 'Delete failed');
        showToast(err.message, 'error');
    }
}

// ===== Update Event =====
async function updateEvent(id, data) {
    try {
        const res    = await fetch(`${API_BASE}/api/events/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.msg || 'Update failed');
        updateSyncStatus('synced', 'Saved ✓');
    } catch (err) {
        updateSyncStatus('error', 'Save failed');
        showToast(err.message, 'error');
    }
}

// ===== Init =====
fetchEvents();

window.addEventListener('focus', () => {
    const newEvents = JSON.parse(localStorage.getItem('newEvents') || '[]');
    if (newEvents.length > 0) fetchEvents();
});