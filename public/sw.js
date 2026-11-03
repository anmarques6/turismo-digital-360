/* Angola 365º — service worker: mostra as notificações enviadas pelo servidor mesmo com o site fechado */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('push', e => {
  let m = {}; try { m = e.data ? e.data.json() : {}; } catch (er) { m = { titulo: 'Angola 365º', corpo: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(m.titulo || 'Angola 365º', { body: m.corpo || '', icon: '/img/sigaf.webp', badge: '/img/sigaf.webp', data: { url: m.url || '/' }, tag: m.tag || undefined }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close(); const url = new URL(e.notification.data?.url || '/', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(L => { const w = L.find(c => c.url.startsWith(self.location.origin)); if (w) { w.navigate(url); return w.focus(); } return self.clients.openWindow(url); }));
});
