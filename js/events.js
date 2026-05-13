const eventsContainer = document.getElementById('eventsContainer');
const syncStatus = document.getElementById('syncStatus');

const authToken = localStorage.getItem('authToken');

function updateSyncStatus(status, message) {
    syncStatus.className = `sync-status ${status}`;
    const icons = {
        syncing: 'fa-sync-alt fa-spin',
        synced: 'fa-check-circle',
        error: 'fa-exclamation-circle'
    };
    syncStatus.innerHTML = `<i class="fas ${icons[status]}"></i> ${message}`;
}

async function fetchEvents() {
    try {
        updateSyncStatus('syncing', 'Syncing...');

        if (!authToken) {
            throw new Error('Please login First !');
        }

        const response = await fetch(
            'https://edu-sync-back-end-production.up.railway.app/api/events',
            {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Please login First !');
            }
            throw new Error(`Error in server: ${response.status}`);
        }

        const data = await response.json();

        let events = [];
        if (data.success && data.events) {
            events = data.events;
        }

        const newEvents =
            JSON.parse(localStorage.getItem('newEvents') || '[]');

        if (newEvents.length > 0) {
            events = [...events, ...newEvents];
            await syncNewEventsToBackend(newEvents);
        }

        if (events.length === 0) {
            eventsContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📅</div>
                    <h3> No Event Exist</h3>
                    <p> start adding events from calendar page</p>
                </div>
            `;
            updateSyncStatus('synced', 'no events found');
        } else {
            renderEvents(events);
            updateSyncStatus('synced', `${events.length} events loaded`);
        }

    } catch (err) {
        eventsContainer.innerHTML = `
            <div class="error-state d-block">
                <div class="error-state-icon">⚠️</div>
                <h3> Error while connectint to server </h3>
                <p>${err.message}</p>
                <button class="refresh-btn" onclick="fetchEvents()">
                    <i class="fas fa-redo"></i> try again
                </button>
            </div>
        `;
        updateSyncStatus('error', ' loading failed');
    }
}

async function syncNewEventsToBackend(newEvents) {
    const syncedIds = [];

    for (const event of newEvents) {
        try {
            const response = await fetch(
                'https://edu-sync-back-end-production.up.railway.app/api/events',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({
                        title: event.title,
                        start: event.start,
                        end: event.end,
                        type: event.type || 'focus',
                        description: event.description || ''
                    })
                }
            );

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    syncedIds.push(event.id);
                }
            }
        } catch (err) {
            console.error('Failed to sync event:', event.title, err);
        }
    }

    if (syncedIds.length > 0) {
        const remainingEvents =
            newEvents.filter(e => !syncedIds.includes(e.id));
        localStorage.setItem(
            'newEvents',
            JSON.stringify(remainingEvents)
        );
    }
}

// Render events
function renderEvents(events) {
    eventsContainer.innerHTML = '';

    events.sort(
        (a, b) => new Date(a.start) - new Date(b.start)
    );

    events.forEach(ev => {
        const card = document.createElement('div');
        card.className =
            `notification-card ${ev.type === 'focus'
                ? 'focus-type'
                : 'break-type'}`;

        const startDate = new Date(ev.start);
        const endDate = new Date(ev.end);

        const startFormatted =
            startDate.toLocaleString('ar-EG', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            });

        const endFormatted =
            endDate.toLocaleString('ar-EG', {
                hour: '2-digit',
                minute: '2-digit'
            });

        card.innerHTML = `
            <div class="card-header">
                <div class="card-time">
                    ${startFormatted} - ${endFormatted}
                </div>
                <div class="card-actions">
                    <button class="edit-btn btn-action" data-id="${ev.id}">✏️</button>
                    <button class="delete-btn btn-action" data-id="${ev.id}">🗑️</button>
                </div>
            </div>
            <div class="card-body">
                <div class="event-title">${ev.title}</div>
                </span>
                ${ev.description
                    ? `<div class="event-description">${ev.description}</div>`
                    : ''}
            </div>
        `;

        eventsContainer.appendChild(card);
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            if (confirm('do  you want to remove this event?')) {
                await deleteEvent(id);
            }
        });
    });

    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            const ev = events.find(event => event.id == id);
            if (ev) {
                const newTitle =
                    prompt(' update event title :', ev.title);
                if (newTitle && newTitle.trim()) {
                    updateEvent(id, { title: newTitle.trim() });
                }
            }
        });
    });
}

// Delete event
async function deleteEvent(id) {
    try {
        updateSyncStatus('syncing', ' removing...');

        const response = await fetch(
            `https://edu-sync-back-end-production.up.railway.app/api/events/${id}`,
            {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const data = await response.json();

        if (data.success) {
            fetchEvents();
        } else {
            throw new Error(data.msg || ' failed to remove');
        }
    } catch (err) {
        updateSyncStatus('error', ' faileed to remove');
        alert(err.message);
    }
}

// Update event
async function updateEvent(id, data) {
    try {
        updateSyncStatus('syncing', ' Updating...');

        const response = await fetch(
            `https://edu-sync-back-end-production.up.railway.app/api/events/${id}`,
            {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify(data)
            }
        );

        const result = await response.json();

        if (result.success) {
            fetchEvents();
        } else {
            throw new Error(result.msg || 'error updating');
        }
    } catch (err) {
        updateSyncStatus('error', ' error updating');
        alert(err.message);
    }
}

// Initial load
fetchEvents();

window.addEventListener('focus', () => {
    const newEvents =
        JSON.parse(localStorage.getItem('newEvents') || '[]');
    if (newEvents.length > 0) {
        fetchEvents();
    }
});
