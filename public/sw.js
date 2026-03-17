const CACHE_NAME = 'trip-planner-v2'

// Files to cache for offline shell
const SHELL_FILES = [
    '/',
    '/trips',
    '/login',
    '/offline',
]

// Install: cache app shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(SHELL_FILES).catch(() => {
                // Some files might not exist yet, that's okay
                return Promise.allSettled(
                    SHELL_FILES.map(url => cache.add(url).catch(() => { }))
                )
            })
        })
    )
    self.skipWaiting()
})

// Activate: clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            )
        })
    )
    self.clients.claim()
})

// Fetch: network-first with cache fallback
self.addEventListener('fetch', (event) => {
    const { request } = event
    const url = new URL(request.url)

    // Skip non-GET requests (API calls etc)
    if (request.method !== 'GET') return

    // Skip external requests
    if (url.origin !== location.origin) return

    // Skip API routes
    if (url.pathname.startsWith('/api/')) return

    // Skip Next.js HMR / webpack
    if (url.pathname.startsWith('/_next/webpack-hmr')) return

    event.respondWith(
        // Try network first
        fetch(request)
            .then((response) => {
                // Cache successful responses
                if (response.ok) {
                    const responseToCache = response.clone()
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseToCache)
                    })
                }
                return response
            })
            .catch(() => {
                // Network failed, try cache
                return caches.match(request).then((cached) => {
                    if (cached) return cached

                    // If it's a page request, show offline page
                    if (request.headers.get('accept')?.includes('text/html')) {
                        return caches.match('/offline') || new Response(
                            '<html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#F0F9FF;text-align:center"><div><div style="font-size:64px">📡</div><h2 style="color:#0C4A6E">ออฟไลน์</h2><p style="color:#64748b">ไม่มีการเชื่อมต่ออินเทอร์เน็ต</p><p style="color:#94a3b8;font-size:14px">ข้อมูลทริปที่เคยเปิดจะยังดูได้</p></div></body></html>',
                            { headers: { 'Content-Type': 'text/html' } }
                        )
                    }

                    return new Response('', { status: 503 })
                })
            })
    )
})
