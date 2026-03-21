const CACHE_NAME = 'trip-planner-v4'
const STATIC_CACHE = 'trip-static-v4'
const DATA_CACHE = 'trip-data-v1'

// App shell files to pre-cache
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
            return Promise.allSettled(
                SHELL_FILES.map(url => cache.add(url).catch(() => { }))
            )
        })
    )
    self.skipWaiting()
})

// Activate: clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(k => ![CACHE_NAME, STATIC_CACHE, DATA_CACHE].includes(k))
                    .map(k => caches.delete(k))
            )
        })
    )
    self.clients.claim()
})

// Fetch handler with smart caching strategies
self.addEventListener('fetch', (event) => {
    const { request } = event
    const url = new URL(request.url)

    // Skip non-GET requests
    if (request.method !== 'GET') return

    // Skip external requests
    if (url.origin !== location.origin) return

    // Skip HMR / dev tools
    if (url.pathname.startsWith('/_next/webpack-hmr')) return

    // ── Strategy 1: Next.js static assets (JS/CSS bundles) ──
    // Cache-first: these have content hashes, so cached versions are always valid
    if (url.pathname.startsWith('/_next/static/')) {
        event.respondWith(
            caches.match(request).then((cached) => {
                if (cached) return cached
                return fetch(request).then((response) => {
                    if (response.ok) {
                        const clone = response.clone()
                        caches.open(STATIC_CACHE).then(c => c.put(request, clone))
                    }
                    return response
                }).catch(() => new Response('', { status: 503 }))
            })
        )
        return
    }

    // ── Strategy 2: API routes for trip data ──
    // Network-first with cache fallback for offline viewing
    if (url.pathname.startsWith('/api/trips')) {
        event.respondWith(
            fetch(request).then((response) => {
                if (response.ok) {
                    const clone = response.clone()
                    caches.open(DATA_CACHE).then(c => c.put(request, clone))
                }
                return response
            }).catch(() => {
                return caches.match(request).then(cached => {
                    return cached || new Response(JSON.stringify({ error: 'offline' }), {
                        headers: { 'Content-Type': 'application/json' }
                    })
                })
            })
        )
        return
    }

    // Skip other API routes (weather, generate, etc — no point caching)
    if (url.pathname.startsWith('/api/')) return

    // ── Strategy 3: Next.js page data (_next/data/) ──
    // Stale-while-revalidate: serve cache immediately, update in background
    if (url.pathname.startsWith('/_next/data/')) {
        event.respondWith(
            caches.match(request).then((cached) => {
                const fetchPromise = fetch(request).then((response) => {
                    if (response.ok) {
                        const clone = response.clone()
                        caches.open(CACHE_NAME).then(c => c.put(request, clone))
                    }
                    return response
                }).catch(() => cached || new Response('{}', { headers: { 'Content-Type': 'application/json' } }))
                return cached || fetchPromise
            })
        )
        return
    }

    // ── Strategy 4: Page navigations & other assets ──
    // Network-first with cache fallback
    event.respondWith(
        fetch(request).then((response) => {
            if (response.ok) {
                const clone = response.clone()
                caches.open(CACHE_NAME).then(c => c.put(request, clone))
            }
            return response
        }).catch(() => {
            return caches.match(request).then((cached) => {
                if (cached) return cached

                // Show offline page for HTML requests
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
