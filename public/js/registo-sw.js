// Regista o service worker (app instalável, página sem ligação e notificações)
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
