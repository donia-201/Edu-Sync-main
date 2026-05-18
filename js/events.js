// ===== EVENTS.JS =====

const eventsContainer = document.getElementById('eventsContainer');
const syncStatus      = document.getElementById('syncStatus');
const API_BASE        = 'https://edu-sync-back-end-production.up.railway.app';

// FIX: get token fresh every time — never at page load (was returning null)
function getToken() {
    return localStorage.getItem('session_token') || localStorage.getItem('authToken');
}

function updateSyncStatus(status, message) {
    if (!syncStatus) return;
    syncStatus.className = `sync-status ${status}`;
    const icons = { syncing:'fa-sync-alt fa-spin', synced:'fa-check-circle', error:'fa-exclamation-circle' };
    syncStatus.innerHTML = `<i class="fas ${icons[status] || 'fa-circle'}"></i> ${message}`;
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleString('en-US', {
        month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'
    });
}

// ===== Fetch Events =====
async function fetchEvents() {
    try {
        updateSyncStatus('syncing', 'Syncing...');
        const token = getToken();
        if (!token) {
            window.location.href = '../pages/login.html';
            return;
        }

        const response = await fetch(`${API_BASE}/api/events`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });

        // FIX: handle 401 without redirecting immediately — show message first
        if (response.status === 401) {
            eventsContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-lock"></i>
                    <h3>Session Expired</h3>
                    <p>Please login again</p>
                    <button onclick="window.location.href='../pages/login.html'"
                        style="margin-top:12px;padding:8px 20px;border:none;border-radius:20px;
                        background:var(--color-primary-dark);color:white;cursor:pointer;font-weight:600;">
                        Login
                    </button>
                </div>`;
            updateSyncStatus('error', 'Session expired');
            return;
        }

        if (!response.ok) throw new Error(`Server error: ${response.status}`);

        const data   = await response.json();
        let events   = data.success && data.events ? data.events : [];

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
                <button onclick="fetchEvents()"
                    style="margin-top:12px;padding:8px 20px;border:none;border-radius:20px;
                    background:var(--color-primary-dark);color:white;cursor:pointer;font-weight:600;">
                    Try Again
                </button>
            </div>`;
        updateSyncStatus('error', 'Loading failed');
    }
}

async function syncNewEventsToBackend(newEvents) {
    const token = getToken();
    const syncedIds = [];
    for (const ev of newEvents) {
        try {
            const res = await fetch(`${API_BASE}/api/events`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ title:ev.title, start:ev.start, end:ev.end, type:ev.type||'focus', description:ev.description||'' })
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
        card.style.backgroundColor = ev.color || '#ffffff';
        card.style.borderRadius = '18px';
        card.style.padding = '20px';
        card.style.boxShadow = '0 4px 20px rgba(171,196,255,0.3)';
        card.style.position = 'relative';
        card.style.transition = 'transform 0.3s ease, box-shadow 0.3s ease';

        // ===== Top row: color picker + delete =====
        const topRow = document.createElement('div');
        topRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;';

        const colorPicker = document.createElement('input');
        colorPicker.type  = 'color';
        colorPicker.value = ev.color || '#ffffff';
        colorPicker.title = 'Change card color';
        colorPicker.style.cssText = 'width:26px;height:26px;border:none;border-radius:50%;cursor:pointer;padding:0;background:none;';
        colorPicker.addEventListener('input', async (e) => {
            ev.color = e.target.value;
            card.style.backgroundColor = ev.color;
            // guard: only save if event has a real backend id
            if (ev.id && !ev.id.toString().startsWith('local_')) {
                await updateEvent(ev.id, { color: ev.color });
            }
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.title = 'Delete event';
        deleteBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:1rem;padding:4px;';
        deleteBtn.addEventListener('click', async () => {
            if (!confirm('Delete this event?')) return;
            if (ev.id && !ev.id.toString().startsWith('local_')) {
                await deleteEvent(ev.id);
            } else {
                // local-only event — just remove from localStorage
                let local = JSON.parse(localStorage.getItem('newEvents') || '[]');
                local = local.filter(e => e.id !== ev.id);
                localStorage.setItem('newEvents', JSON.stringify(local));
                fetchEvents();
            }
        });

        topRow.appendChild(colorPicker);
        topRow.appendChild(deleteBtn);
        card.appendChild(topRow);

        // ===== Title (editable) =====
        const titleEl = document.createElement('div');
        titleEl.contentEditable = 'true';
        titleEl.innerText = ev.title || 'Untitled Event';
        titleEl.style.cssText = `
            font-family:var(--font-heading);font-size:1.4rem;font-weight:bold;
            color:var(--color-heading);margin-bottom:10px;outline:none;
            border-bottom:1px dashed transparent;`;
        titleEl.addEventListener('focus', () => { titleEl.style.borderBottomColor = 'var(--color-primary-dark)'; });
        titleEl.addEventListener('blur', async () => {
            titleEl.style.borderBottomColor = 'transparent';
            const val = titleEl.innerText.trim();
            if (val && val !== ev.title) { ev.title = val; await updateEvent(ev.id, { title: val }); }
            else if (!val) titleEl.innerText = ev.title;
        });
        card.appendChild(titleEl);

        // ===== Details section =====
        const details = document.createElement('div');
        details.style.cssText = `
            background:rgba(255,255,255,0.5);border-radius:10px;
            padding:10px 12px;margin-bottom:10px;display:flex;flex-direction:column;gap:6px;`;

        details.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;color:var(--color-text-light);font-size:0.9rem;">
                <i class="fas fa-play-circle" style="color:var(--color-primary-dark);width:18px;"></i>
                <span>${formatDate(ev.start)}</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px;color:var(--color-text-light);font-size:0.9rem;">
                <i class="fas fa-stop-circle" style="color:#ff6b6b;width:18px;"></i>
                <span>${formatDate(ev.end)}</span>
            </div>
            ${ev.remindAt ? `
            <div style="display:flex;align-items:center;gap:8px;color:var(--color-text-light);font-size:0.9rem;">
                <i class="fas fa-bell" style="color:#ffd93d;width:18px;"></i>
                <span>Reminder: ${formatDate(ev.remindAt)}</span>
            </div>` : ''}`;
        card.appendChild(details);

        // ===== Description (editable) =====
        const descEl = document.createElement('div');
        descEl.contentEditable = 'true';
        descEl.innerText = ev.description || 'Add description...';
        descEl.style.cssText = `
            color:var(--color-text-light);font-size:0.9rem;line-height:1.6;
            margin-bottom:10px;outline:none;min-height:20px;
            font-style:${ev.description ? 'normal' : 'italic'};`;
        descEl.addEventListener('focus', () => {
            if (descEl.innerText === 'Add description...') { descEl.innerText = ''; descEl.style.fontStyle = 'normal'; }
        });
        descEl.addEventListener('blur', async () => {
            const val = descEl.innerText.trim();
            if (!val || val === 'Add description...') { descEl.innerText = 'Add description...'; descEl.style.fontStyle = 'italic'; return; }
            if (val !== ev.description) { ev.description = val; await updateEvent(ev.id, { description: val }); }
        });
        card.appendChild(descEl);

        // ===== Type badge =====
        if (ev.type) {
            const badge = document.createElement('span');
            badge.textContent = ev.type.charAt(0).toUpperCase() + ev.type.slice(1);
            badge.style.cssText = `
                display:inline-block;padding:3px 12px;border-radius:20px;
                font-size:0.78rem;font-weight:700;margin-top:4px;
                background:${ev.type==='exam'?'#ff6b6b':ev.type==='assignment'?'#ffd93d':'var(--color-primary-dark)'};
                color:${ev.type==='assignment'?'#333':'white'};`;
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
            headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (data.success) { fetchEvents(); }
        else throw new Error(data.msg || 'Failed to delete');
    } catch (err) {
        updateSyncStatus('error', 'Delete failed');
        console.error(err);
    }
}

// ===== Update Event =====
async function updateEvent(id, data) {
    try {
        const res = await fetch(`${API_BASE}/api/events/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) { updateSyncStatus('synced', 'Saved ✓'); }
        else throw new Error(result.msg || 'Update failed');
    } catch (err) {
        updateSyncStatus('error', 'Save failed');
        console.error(err);
    }
}

fetchEvents();

window.addEventListener('focus', () => {
    const newEvents = JSON.parse(localStorage.getItem('newEvents') || '[]');
    if (newEvents.length > 0) fetchEvents();
});