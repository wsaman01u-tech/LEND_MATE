// Service Worker for Background Notifications
self.addEventListener('install', (event) => {
  console.log('Reminder Service Worker installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Reminder Service Worker activated');
  event.waitUntil(clients.claim());
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  // Open the app when notification is clicked
  event.waitUntil(
    clients.openWindow('/')
  );
});

// Listen for messages from the main app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SCHEDULE_REMINDER') {
    const { borrowerName, borrowerPhone, reminderDate, reminderTime } = event.data;
    
    // Calculate time until reminder
    const reminderDateTime = new Date(`${reminderDate}T${reminderTime}`);
    const now = new Date();
    const timeUntilReminder = reminderDateTime - now;
    
    if (timeUntilReminder > 0) {
      setTimeout(() => {
        self.registration.showNotification('💰 Payment Reminder', {
          body: `${borrowerName} promised to pay today!\nPhone: ${borrowerPhone}`,
          icon: '/icons/icon-192.svg',
          badge: '/icons/icon-192.svg',
          vibrate: [200, 100, 200],
          requireInteraction: true,
          actions: [
            { action: 'call', title: 'Call Now' },
            { action: 'dismiss', title: 'Dismiss' }
          ]
        });
      }, timeUntilReminder);
    }
  }
});

// Handle notification action clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'call') {
    // Extract phone number from notification body
    const phone = event.notification.body.match(/Phone: ([\d]+)/)?.[1];
    if (phone) {
      event.waitUntil(
        clients.openWindow(`tel:${phone}`)
      );
    }
  } else {
    // Open the app
    event.waitUntil(
      clients.openWindow('/reminders')
    );
  }
});
