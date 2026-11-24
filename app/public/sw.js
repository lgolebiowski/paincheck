/* Pain check service worker: shows push notifications and handles their actions. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* ignore malformed payload */ }
  const title = data.title || 'Pain check';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'pain-check-reminder',
      renotify: true,
      requireInteraction: true,
      data: { url: data.url || '/' },
      // Action buttons are not shown on iOS; tapping the notification still opens the app.
      actions: [{ action: 'snooze', title: data.snoozeLabel || 'In 10 min' }],
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'snooze') {
    event.waitUntil(fetch('/api/reminders/snooze', { method: 'POST' }).catch(() => {}));
    return;
  }
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) { c.navigate(url).catch(() => {}); return c.focus(); }
      }
      return self.clients.openWindow(url);
    }),
  );
});
