// ===== SETTINGS PAGE - Backend Integration =====

const API_BASE_URL = 'https://edu-sync-back-end-production.up.railway.app';

// ===== Map Frontend to Backend Field Names =====
const fieldMapping = {
    // Frontend -> Backend
    pomodoroDuration: 'pomodoro_duration',
    breakDuration: 'short_break',
    longBreakDuration: 'long_break',
    fontSize: 'font_size',
    soundEffects: 'sound_enabled',
    desktopNotifications: 'notifications_enabled'
};

// ===== Save Settings to Backend and LocalStorage =====
async function saveSettings() {
    const settings = {
        // Account
        displayName: document.getElementById('displayName').value,
        email: document.getElementById('email').value,
        studyField: document.getElementById('studyField').value,
        academicLevel: document.getElementById('academicLevel').value,
        
        // Appearance
        theme: document.getElementById('theme').value,
        language: document.getElementById('language').value,
        fontSize: document.getElementById('fontSize').value,
        animations: document.getElementById('animations').checked,
        
        // Study Preferences
        pomodoroDuration: document.getElementById('pomodoroDuration').value,
        breakDuration: document.getElementById('breakDuration').value,
        longBreakDuration: document.getElementById('longBreakDuration').value,
        studyGoal: document.getElementById('studyGoal').value,
        autoStart: document.getElementById('autoStart').checked,
        
        // Notifications
        studyReminders: document.getElementById('studyReminders').checked,
        breakNotifications: document.getElementById('breakNotifications').checked,
        examReminders: document.getElementById('examReminders').checked,
        weeklyReport: document.getElementById('weeklyReport').checked,
        soundEffects: document.getElementById('soundEffects').checked,
        desktopNotifications: document.getElementById('desktopNotifications').checked,
        
        // Calendar Integration
        googleCalendar: document.getElementById('googleCalendar').checked,
        autoAddSessions: document.getElementById('autoAddSessions').checked,
        syncExams: document.getElementById('syncExams').checked,
        
        // Privacy
        analytics: document.getElementById('analytics').checked
    };

    try {
        // Save to localStorage first (fallback)
        localStorage.setItem('eduSyncSettings', JSON.stringify(settings));
        
        const token = localStorage.getItem('session_token') || localStorage.getItem('authToken');
        
        if (token) {
            // Prepare backend data (map field names)
            const backendSettingsData = {
                theme: settings.theme,
                language: settings.language,
                font_size: settings.fontSize,
                pomodoro_duration: parseInt(settings.pomodoroDuration),
                short_break: parseInt(settings.breakDuration),
                long_break: parseInt(settings.longBreakDuration),
                notifications_enabled: settings.desktopNotifications,
                sound_enabled: settings.soundEffects
            };

            // Update settings in backend
            const settingsResponse = await fetch(`${API_BASE_URL}/api/user/settings`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(backendSettingsData)
            });

            const settingsData = await settingsResponse.json();

            if (settingsResponse.ok && settingsData.success) {
            } else {
                console.warn(' Backend settings save failed:', settingsData.msg);
            }

            // Update profile (name) if changed
            const profileData = {
                name: settings.displayName
            };

            const profileResponse = await fetch(`${API_BASE_URL}/api/user/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(profileData)
            });

            const profileResult = await profileResponse.json();
            
            if (profileResponse.ok && profileResult.success) {
            } else {
                console.warn('⚠️ Backend profile save failed:', profileResult.msg);
            }
        }
        
        // Apply settings immediately
        if (window.applyTheme) applyTheme(settings.theme);
        if (window.applyFontSize) applyFontSize(settings.fontSize);
        if (window.applyLanguage) applyLanguage(settings.language);
        if (window.applyAnimations) applyAnimations(settings.animations);
        
        // Show success message
        showSuccessMessage();
        
        // Request notification permission if enabled
        if (settings.desktopNotifications) {
            if (window.requestNotificationPermission) {
                requestNotificationPermission();
            }
        }
        
    } catch (error) {
        console.error(' Error saving settings:', error);
        alert(' Settings saved locally but could not sync with server');
    }
}

// ===== Load Settings from Backend and LocalStorage =====
async function loadSettings() {
    try {
        const token = localStorage.getItem('session_token') || localStorage.getItem('authToken');
        let settings = null;
        let userProfile = null;

        // Try to load from backend first
        if (token) {
            try {
                // Get full user profile
                const profileResponse = await fetch(`${API_BASE_URL}/api/user/profile`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                const profileData = await profileResponse.json();

                if (profileResponse.ok && profileData.success && profileData.user) {
                    userProfile = profileData.user;
                    
                    // Map backend settings to frontend format
                    settings = {
                        // From backend settings object
                        theme: userProfile.settings.theme || 'blue',
                        language: userProfile.settings.language || 'en',
                        fontSize: userProfile.settings.font_size || 'medium',
                        pomodoroDuration: userProfile.settings.pomodoro_duration || 25,
                        breakDuration: userProfile.settings.short_break || 5,
                        longBreakDuration: userProfile.settings.long_break || 30,
                        desktopNotifications: userProfile.settings.notifications_enabled !== false,
                        soundEffects: userProfile.settings.sound_enabled !== false,
                        
                        // From profile
                        displayName: userProfile.name || '',
                        email: userProfile.email || '',
                        
                        // Keep localStorage values for these (not in backend yet)
                        studyField: null,
                        academicLevel: null,
                        studyGoal: null,
                        autoStart: false,
                        animations: true,
                        studyReminders: true,
                        breakNotifications: true,
                        examReminders: true,
                        weeklyReport: true,
                        googleCalendar: false,
                        autoAddSessions: false,
                        syncExams: false,
                        analytics: true
                    };
                    
                }
            } catch (e) {
                console.warn('⚠️ Could not load from backend, using localStorage');
            }
        }

        // Merge with localStorage (for fields not in backend)
        const localSettings = localStorage.getItem('eduSyncSettings');
        if (localSettings) {
            const local = JSON.parse(localSettings);
            
            if (settings) {
                // Merge: keep backend values but add local-only fields
                settings = {
                    ...local,  // Local values as base
                    ...settings  // Override with backend values
                };
            } else {
                settings = local;
            }
            
        }

        // Apply settings to form
        if (settings) {
            // Account
            if (settings.displayName) document.getElementById('displayName').value = settings.displayName;
            if (settings.email) document.getElementById('email').value = settings.email;
            if (settings.studyField) document.getElementById('studyField').value = settings.studyField;
            if (settings.academicLevel) document.getElementById('academicLevel').value = settings.academicLevel;
            
            // Appearance
            if (settings.theme) document.getElementById('theme').value = settings.theme;
            if (settings.language) document.getElementById('language').value = settings.language;
            if (settings.fontSize) document.getElementById('fontSize').value = settings.fontSize;
            document.getElementById('animations').checked = settings.animations !== false;
            
            // Study Preferences
            if (settings.pomodoroDuration) document.getElementById('pomodoroDuration').value = settings.pomodoroDuration;
            if (settings.breakDuration) document.getElementById('breakDuration').value = settings.breakDuration;
            if (settings.longBreakDuration) document.getElementById('longBreakDuration').value = settings.longBreakDuration;
            if (settings.studyGoal) document.getElementById('studyGoal').value = settings.studyGoal;
            document.getElementById('autoStart').checked = settings.autoStart || false;
            
            // Notifications
            document.getElementById('studyReminders').checked = settings.studyReminders !== false;
            document.getElementById('breakNotifications').checked = settings.breakNotifications !== false;
            document.getElementById('examReminders').checked = settings.examReminders !== false;
            document.getElementById('weeklyReport').checked = settings.weeklyReport !== false;
            document.getElementById('soundEffects').checked = settings.soundEffects !== false;
            document.getElementById('desktopNotifications').checked = settings.desktopNotifications || false;
            
            // Calendar Integration
            document.getElementById('googleCalendar').checked = settings.googleCalendar || false;
            document.getElementById('autoAddSessions').checked = settings.autoAddSessions || false;
            document.getElementById('syncExams').checked = settings.syncExams || false;
            
            // Privacy
            document.getElementById('analytics').checked = settings.analytics !== false;
            
            // Save merged settings to localStorage
            localStorage.setItem('eduSyncSettings', JSON.stringify(settings));
            
        }
        
    } catch (error) {
        console.error(' Error loading settings:', error);
    }
}

// ===== Reset All Settings =====
async function resetSettings() {
    if (!confirm('Are you sure you want to reset all settings to default? This cannot be undone.')) {
        return;
    }

    try {
        // Remove from localStorage
        localStorage.removeItem('eduSyncSettings');
        
        const token = localStorage.getItem('session_token') || localStorage.getItem('authToken');
        
        // Reset on backend (set to default values)
        if (token) {
            const defaultSettings = {
                theme: 'blue',
                language: 'en',
                font_size: 'medium',
                pomodoro_duration: 25,
                short_break: 5,
                long_break: 30,
                notifications_enabled: true,
                sound_enabled: true
            };

            await fetch(`${API_BASE_URL}/api/user/settings`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(defaultSettings)
            });
        }
        
        // Reload page to show defaults
        window.location.reload();
        
    } catch (error) {
        console.error(' Error resetting settings:', error);
        localStorage.removeItem('eduSyncSettings');
        window.location.reload();
    }
}

// ===== Export Data =====
async function exportData() {
    try {
        const token = localStorage.getItem('session_token') || localStorage.getItem('authToken');
        
        if (!token) {
            return;
        }

        // For now, export localStorage data
        const allData = {
            settings: JSON.parse(localStorage.getItem('eduSyncSettings') || '{}'),
            notifications: JSON.parse(localStorage.getItem('pomodoro_notifications') || '[]'),
            pomodoroState: JSON.parse(localStorage.getItem('pomodoro_forest_state_v2') || '{}'),
            exportDate: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `edusync-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        alert(' Data exported successfully!');
        
    } catch (error) {
        console.error(' Error exporting data:', error);
        alert(' Error exporting data');
    }
}

// ===== Delete Account =====
async function deleteAccount() {
    const confirmation = prompt(' WARNING: This will permanently delete your account and all data.\n\nType "DELETE" to confirm:');
    
    if (confirmation !== 'DELETE') {
        alert(' Account deletion cancelled');
        return;
    }

    try {
        const token = localStorage.getItem('session_token') || localStorage.getItem('authToken');
        
        if (!token) {
            alert(' Please login to delete your account');
            return;
        }

        const response = await fetch(`${API_BASE_URL}/api/account/delete`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            // Clear all local data
            localStorage.clear();
            sessionStorage.clear();
            
            alert(' Account deleted successfully. You will now be redirected to the home page.');
            window.location.href = '../index.html';
        } else {
            const data = await response.json();
            alert(' Failed to delete account: ' + (data.msg || 'Unknown error'));
        }
        
    } catch (error) {
        console.error(' Error deleting account:', error);
        alert(' Error deleting account: ' + error.message);
    }
}

// ===== Show Success Message =====
function showSuccessMessage() {
    const message = document.getElementById('successMessage');
    if (message) {
        message.style.display = 'block';
        setTimeout(() => {
            message.style.display = 'none';
        }, 3000);
    }
}

// ===== Apply Theme Changes (Preview) =====
document.getElementById('theme')?.addEventListener('change', (e) => {
    if (window.applyTheme) {
        applyTheme(e.target.value);
    }
});

document.getElementById('fontSize')?.addEventListener('change', (e) => {
    if (window.applyFontSize) {
        applyFontSize(e.target.value);
    }
});

document.getElementById('language')?.addEventListener('change', (e) => {
    if (window.applyLanguage) {
        applyLanguage(e.target.value);
    }
});

document.getElementById('animations')?.addEventListener('change', (e) => {
    if (window.applyAnimations) {
        applyAnimations(e.target.checked);
    }
});

// ===== Event Listeners for Action Buttons =====
document.addEventListener('DOMContentLoaded', () => {
    // Load settings on page load
    loadSettings();
    
    // Export data button
    const exportBtn = document.querySelector('.action-btn:not(.danger)');
    if (exportBtn && exportBtn.textContent.includes('Export')) {
        exportBtn.onclick = (e) => {
            e.preventDefault();
            exportData();
        };
    }
    
    // Delete account button
    const deleteBtn = document.querySelector('.action-btn.danger');
    if (deleteBtn) {
        deleteBtn.onclick = (e) => {
            e.preventDefault();
            deleteAccount();
        };
    }
});

// ===== Auto-save on change (optional) =====
function enableAutoSave() {
    const inputs = document.querySelectorAll('input, select');
    inputs.forEach(input => {
        input.addEventListener('change', () => {
            saveSettings();
        });
    });
}

enableAutoSave();

