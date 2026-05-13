const API_BASE_URL = 'https://edu-sync-back-end-production.up.railway.app';

        let notes = [];
        let searchTerm = '';
        let currentFilter = 'all';
        let noteToDelete = null;

        const notesContainer = document.getElementById('notes-container');
        const addNoteBtn = document.getElementById('add-note');
        const addTaskBtn = document.getElementById('add-task');
        const searchInput = document.getElementById('search-notes');
        const searchBtn = document.getElementById('search-btn');
        const filterButtons = document.querySelectorAll('.filter-btn');
        const deleteModal = document.getElementById('deleteModal');
        const confirmDeleteBtn = document.getElementById('confirmDelete');
        const cancelDeleteBtn = document.getElementById('cancelDelete');

        function uuid() {
            return crypto.randomUUID();
        }

        function showError(message) {
            notesContainer.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-circle"></i> ${message}</div>`;
        }

        function showLoading() {
            notesContainer.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading notes...</div>';
        }

        function getToken() {
            const urlParams = new URLSearchParams(window.location.search);
            const urlToken = urlParams.get('token');
            
            if (urlToken) {
                localStorage.setItem('session_token', urlToken);
                localStorage.setItem('authToken', urlToken);
                window.history.replaceState({}, document.title, window.location.pathname);
                return urlToken;
            }
            
            return localStorage.getItem('session_token') || localStorage.getItem('authToken');
        }

        function formatDate(dateString) {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        async function fetchNotes() {
            try {
                showLoading();
                
                const token = getToken();
                
                if (!token) {
                    showError(' Please login first. Redirecting...');
                    setTimeout(() => {
                        window.location.href = '../index.html';
                    }, 2000);
                    return;
                }
                
                const response = await fetch(`${API_BASE_URL}/api/notes`, {
                    method: 'GET',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (response.status === 401) {
                    showError(' Session expired. Please login again.');
                    localStorage.removeItem('session_token');
                    localStorage.removeItem('authToken');
                    setTimeout(() => {
                        window.location.href = '../index.html';
                    }, 2000);
                    return;
                }
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                const data = await response.json();
                notes = data.notes || [];
                renderNotes();
            } catch (error) {
                console.error('Error fetching notes:', error);
                showError(`Failed to load notes: ${error.message}`);
            }
        }

        async function saveNote(note) {
            try {
                const token = getToken();
                const response = await fetch(`${API_BASE_URL}/api/notes`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(note)
                });
                
                if (!response.ok) {
                    throw new Error('Failed to save note');
                }
                
                return await response.json();
            } catch (error) {
                console.error('Error saving note:', error);
                showError('Failed to save note. Please try again.');
            }
        }

        async function updateNote(note) {
            try {
                const token = getToken();
                const response = await fetch(`${API_BASE_URL}/api/notes/${note.id}`, {
                    method: 'PUT',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(note)
                });
                
                if (!response.ok) {
                    throw new Error('Failed to update note');
                }
                
                return await response.json();
            } catch (error) {
                console.error('Error updating note:', error);
            }
        }

        async function deleteNote(noteId) {
            try {
                const token = getToken();
                const response = await fetch(`${API_BASE_URL}/api/notes/${noteId}`, {
                    method: 'DELETE',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (!response.ok) {
                    throw new Error('Failed to delete note');
                }
                
                notes = notes.filter(n => n.id !== noteId);
                renderNotes();
                
                return await response.json();
            } catch (error) {
                console.error('Error deleting note:', error);
                showError('Failed to delete note. Please try again.');
            }
        }

        function filterNotes() {
            let filtered = notes;

            if (searchTerm) {
                filtered = filtered.filter(note => 
                    note.content.toLowerCase().includes(searchTerm.toLowerCase())
                );
            }

            if (currentFilter === 'note') {
                filtered = filtered.filter(n => n.type === 'note');
            } else if (currentFilter === 'task') {
                filtered = filtered.filter(n => n.type === 'task');
            } else if (currentFilter === 'completed') {
                filtered = filtered.filter(n => n.type === 'task' && n.checked);
            }

            return filtered;
        }

        function renderNotes() {
            const filteredNotes = filterNotes();
            
            if (filteredNotes.length === 0) {
                notesContainer.innerHTML = '<div class="loading"><i class="fas fa-sticky-note"></i><br>No notes found. Create your first note!</div>';
                return;
            }

            notesContainer.innerHTML = '';

            filteredNotes.forEach(note => {
                const card = document.createElement('div');
                card.className = 'note';
                card.dataset.id = note.id;
                card.style.backgroundColor = note.color || '#ffffff';

                const controls = document.createElement('div');
                controls.className = 'note-controls';

                const colorPicker = document.createElement('input');
                colorPicker.type = 'color';
                colorPicker.value = note.color || '#ffffff';
                colorPicker.addEventListener('input', async (e) => {
                    note.color = e.target.value;
                    card.style.backgroundColor = note.color;
                    await updateNote(note);
                });

                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'delete-btn';
                deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
                deleteBtn.addEventListener('click', () => {
                    noteToDelete = note.id;
                    deleteModal.classList.add('show');
                });

                controls.appendChild(colorPicker);
                controls.appendChild(deleteBtn);
                card.appendChild(controls);

                const content = document.createElement('div');
                content.className = 'note-content';

                if (note.type === 'task') {
                    const label = document.createElement('label');
                    label.className = 'task-label';

                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.checked = note.checked || false;
                    checkbox.addEventListener('change', async (e) => {
                        note.checked = e.target.checked;
                        await updateNote(note);
                    });

                    const taskContent = document.createElement('div');
                    taskContent.className = 'task-content';
                    taskContent.innerText = note.content;
                    taskContent.contentEditable = 'true';
                    taskContent.addEventListener('blur', async (e) => {
                        const newContent = e.target.innerText.trim();
                        if (newContent && newContent !== note.content) {
                            note.content = newContent;
                            await updateNote(note);
                        }
                    });

                    label.appendChild(checkbox);
                    label.appendChild(taskContent);
                    content.appendChild(label);
                } else {
                    content.contentEditable = 'true';
                    content.innerText = note.content;
                    content.addEventListener('blur', async (e) => {
                        const newContent = e.target.innerText.trim();
                        if (newContent && newContent !== note.content) {
                            note.content = newContent;
                            await updateNote(note);
                        } else if (!newContent) {
                            e.target.innerText = note.content;
                        }
                    });
                }

                card.appendChild(content);

                if (note.createdAt) {
                    const timestamp = document.createElement('div');
                    timestamp.className = 'note-timestamp';
                    timestamp.innerHTML = `<i class="far fa-clock"></i> ${formatDate(note.createdAt)}`;
                    card.appendChild(timestamp);
                }

                notesContainer.appendChild(card);
            });
        }

        // ✅ Auto-focus on new note/task
        addNoteBtn.addEventListener('click', async () => {
            const newNote = {
                id: uuid(),
                type: 'note',
                content: 'New note',
                color: '#ffffff',
                createdAt: new Date().toISOString()
            };
            
            const savedNote = await saveNote(newNote);
            if (savedNote) {
                notes.unshift(newNote);
                renderNotes();
                
                // ✅ Auto-focus the new note
                setTimeout(() => {
                    const firstNote = notesContainer.querySelector('.note-content');
                    if (firstNote) {
                        firstNote.focus();
                        // Select all text
                        const range = document.createRange();
                        range.selectNodeContents(firstNote);
                        const selection = window.getSelection();
                        selection.removeAllRanges();
                        selection.addRange(range);
                    }
                }, 100);
            }
        });

        addTaskBtn.addEventListener('click', async () => {
            const newTask = {
                id: uuid(),
                type: 'task',
                content: 'New task',
                checked: false,
                color: '#ffffff',
                createdAt: new Date().toISOString()
            };
            
            const savedTask = await saveNote(newTask);
            if (savedTask) {
                notes.unshift(newTask);
                renderNotes();
                
                // ✅ Auto-focus the new task
                setTimeout(() => {
                    const firstTask = notesContainer.querySelector('.task-content');
                    if (firstTask) {
                        firstTask.focus();
                        const range = document.createRange();
                        range.selectNodeContents(firstTask);
                        const selection = window.getSelection();
                        selection.removeAllRanges();
                        selection.addRange(range);
                    }
                }, 100);
            }
        });

        searchInput.addEventListener('input', (e) => {
            searchTerm = e.target.value;
            renderNotes();
        });

        searchBtn.addEventListener('click', () => {
            searchInput.focus();
        });

        filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                filterButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentFilter = btn.dataset.filter;
                renderNotes();
            });
        });

        confirmDeleteBtn.addEventListener('click', async () => {
            if (noteToDelete) {
                await deleteNote(noteToDelete);
                noteToDelete = null;
                deleteModal.classList.remove('show');
            }
        });

        cancelDeleteBtn.addEventListener('click', () => {
            noteToDelete = null;
            deleteModal.classList.remove('show');
        });

        deleteModal.addEventListener('click', (e) => {
            if (e.target === deleteModal) {
                noteToDelete = null;
                deleteModal.classList.remove('show');
            }
        });

        fetchNotes();