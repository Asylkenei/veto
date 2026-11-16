/* VETO service worker: Web Push only (no offline caching, so deploys are never stale). */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = { title: 'VETO', body: '', url: '/notifications' }
  try { data = { ...data, ...event.data.json() } } catch (_) { /* plain text payload */ }
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    data: { url: data.url },
    tag: data.url,
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const client of list) {
      if (client.url.startsWith(self.location.origin) && 'focus' in client) { client.navigate(url); return client.focus() }
    }
    return self.clients.openWindow(url)
  }))
})
