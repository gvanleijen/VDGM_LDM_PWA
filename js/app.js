// PWA App JavaScript

let deferredPrompt;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initServiceWorker();
    initInstallButton();
    initNotificationButton();
    initNotes();
    updateConnectionStatus();
    checkInstallStatus();
});

// Service Worker Registration
function initServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./service-worker.js')
            .then((registration) => {
                console.log('Service Worker registered:', registration);
                updateSWStatus('Active ✓');

                // Check for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New service worker available
                            if (confirm('New version available! Reload to update?')) {
                                newWorker.postMessage({ type: 'SKIP_WAITING' });
                                window.location.reload();
                            }
                        }
                    });
                });
            })
            .catch((error) => {
                console.error('Service Worker registration failed:', error);
                updateSWStatus('Failed ✗');
            });

        // Reload page when new service worker takes over
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            window.location.reload();
        });
    } else {
        updateSWStatus('Not Supported');
    }
}

function updateSWStatus(status) {
    const statusElement = document.getElementById('sw-status');
    if (statusElement) {
        statusElement.textContent = status;
    }
}

// Install Button
function initInstallButton() {
    const installButton = document.getElementById('install-button');

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        installButton.style.display = 'inline-block';
        updateInstallStatus('Ready to Install');
    });

    installButton.addEventListener('click', async () => {
        if (!deferredPrompt) {
            return;
        }

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        console.log(`User response to install prompt: ${outcome}`);

        if (outcome === 'accepted') {
            updateInstallStatus('Installing...');
        }

        deferredPrompt = null;
        installButton.style.display = 'none';
    });

    window.addEventListener('appinstalled', () => {
        console.log('PWA installed successfully');
        updateInstallStatus('Installed ✓');
        deferredPrompt = null;
    });
}

function checkInstallStatus() {
    // Check if running as installed PWA
    if (window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true) {
        updateInstallStatus('Installed ✓');
        const installButton = document.getElementById('install-button');
        if (installButton) {
            installButton.style.display = 'none';
        }
    }
}

function updateInstallStatus(status) {
    const statusElement = document.getElementById('install-status');
    if (statusElement) {
        statusElement.textContent = status;
    }
}

// Notifications
function initNotificationButton() {
    const notificationButton = document.getElementById('notification-button');

    if (!('Notification' in window)) {
        notificationButton.textContent = 'Notifications Not Supported';
        notificationButton.disabled = true;
        return;
    }

    updateNotificationButtonText();

    notificationButton.addEventListener('click', async () => {
        if (Notification.permission === 'granted') {
            showNotification('Notifications are already enabled!');
        } else if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                showNotification('Notifications enabled successfully!');
            }
            updateNotificationButtonText();
        }
    });
}

function updateNotificationButtonText() {
    const button = document.getElementById('notification-button');
    if (Notification.permission === 'granted') {
        button.textContent = 'Notifications Enabled ✓';
    } else if (Notification.permission === 'denied') {
        button.textContent = 'Notifications Blocked';
        button.disabled = true;
    } else {
        button.textContent = 'Enable Notifications';
    }
}

function showNotification(message) {
    if (Notification.permission === 'granted') {
        const notification = new Notification('My PWA', {
            body: message,
            icon: './assets/icons/icon-192x192.png',
            badge: './assets/icons/icon-72x72.png',
            vibrate: [200, 100, 200]
        });

        notification.onclick = () => {
            window.focus();
            notification.close();
        };
    }
}

// Connection Status
function updateConnectionStatus() {
    const updateStatus = () => {
        const statusElement = document.getElementById('connection-status');
        if (navigator.onLine) {
            statusElement.textContent = 'Online ✓';
            statusElement.classList.remove('offline');
        } else {
            statusElement.textContent = 'Offline';
            statusElement.classList.add('offline');
        }
    };

    updateStatus();
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
}

// Notes Feature (using localStorage)
function initNotes() {
    const notesInput = document.getElementById('notes-input');
    const saveButton = document.getElementById('save-notes');
    const savedNotesDiv = document.getElementById('saved-notes');

    // Load saved notes
    const savedNotes = localStorage.getItem('pwa-notes');
    if (savedNotes) {
        savedNotesDiv.textContent = savedNotes;
    }

    // Save notes
    saveButton.addEventListener('click', () => {
        const notes = notesInput.value.trim();
        if (notes) {
            localStorage.setItem('pwa-notes', notes);
            savedNotesDiv.textContent = notes;
            notesInput.value = '';

            // Show success feedback
            saveButton.textContent = 'Saved ✓';
            setTimeout(() => {
                saveButton.textContent = 'Save Notes';
            }, 2000);
        }
    });
}

// Handle visibility change
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        console.log('App is now visible');
        updateConnectionStatus();
    }
});

// Performance monitoring
if ('performance' in window) {
    window.addEventListener('load', () => {
        const perfData = performance.getEntriesByType('navigation')[0];
        console.log('Page load time:', perfData.loadEventEnd - perfData.fetchStart, 'ms');
    });
}

// Export for debugging
window.PWAApp = {
    showNotification,
    updateConnectionStatus
};
