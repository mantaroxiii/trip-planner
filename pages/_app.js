import { useEffect, useState } from 'react'
import Head from 'next/head'

export default function App({ Component, pageProps }) {
    const [dark, setDark] = useState(false)

    useEffect(() => {
        // Register service worker for offline support
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(() => { })
        }
        // Load dark mode preference
        const saved = localStorage.getItem('darkMode')
        if (saved === 'true') { setDark(true); document.documentElement.setAttribute('data-theme', 'dark') }
    }, [])

    const toggleDark = () => {
        const next = !dark
        setDark(next)
        localStorage.setItem('darkMode', String(next))
        if (next) document.documentElement.setAttribute('data-theme', 'dark')
        else document.documentElement.removeAttribute('data-theme')
    }

    return (
        <>
            <Head>
                <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
                <meta name="theme-color" content={dark ? '#0F172A' : '#0EA5E9'} />
                <link rel="manifest" href="/manifest.json" />
                <title>Trip Planner</title>
            </Head>
            <style>{`
                /* ─── Dark Mode Overrides ─── */
                [data-theme="dark"] body {
                    background: #0F172A !important;
                    color: #E2E8F0 !important;
                }

                /* Global backgrounds */
                [data-theme="dark"] div[style*="background: #f1f5f9"],
                [data-theme="dark"] div[style*="background:#f1f5f9"],
                [data-theme="dark"] div[style*="background: linear-gradient(135deg,#F0F9FF"],
                [data-theme="dark"] div[style*="background: linear-gradient(135deg, #F0F9FF"] {
                    background: #0F172A !important;
                }

                /* White & light backgrounds */
                [data-theme="dark"] div[style*="background: white"],
                [data-theme="dark"] div[style*="background:white"],
                [data-theme="dark"] div[style*="background: #FFFFFF"],
                [data-theme="dark"] div[style*="background: #fff"] {
                    background: #1E293B !important;
                }

                /* Text colors */
                [data-theme="dark"] div[style*="color: #1e293b"],
                [data-theme="dark"] div[style*="color:#1e293b"],
                [data-theme="dark"] span[style*="color: #1e293b"],
                [data-theme="dark"] div[style*="color: #0C4A6E"],
                [data-theme="dark"] div[style*="color:#0C4A6E"],
                [data-theme="dark"] span[style*="color: #0C4A6E"],
                [data-theme="dark"] span[style*="color:#0C4A6E"] {
                    color: #E2E8F0 !important;
                }

                [data-theme="dark"] div[style*="color: #64748b"],
                [data-theme="dark"] span[style*="color: #64748b"] {
                    color: #94A3B8 !important;
                }

                /* Trip page specific */
                [data-theme="dark"] .trip-input {
                    background: #1E293B !important;
                    color: #E2E8F0 !important;
                    border-color: rgba(148,163,184,0.2) !important;
                }
                [data-theme="dark"] .trip-input:focus {
                    border-color: #0EA5E9 !important;
                    box-shadow: 0 0 0 3px rgba(14,165,233,0.2) !important;
                }
                [data-theme="dark"] .trip-input::placeholder {
                    color: #475569 !important;
                }
                [data-theme="dark"] .trip-textarea {
                    background: #1E293B !important;
                    color: #E2E8F0 !important;
                    border-color: rgba(148,163,184,0.2) !important;
                }
                [data-theme="dark"] .trip-textarea:focus {
                    border-color: #0EA5E9 !important;
                }

                [data-theme="dark"] .event-card {
                    background: rgba(30,41,59,0.9) !important;
                    border-color: rgba(148,163,184,0.1) !important;
                    box-shadow: 0 2px 12px rgba(0,0,0,0.2) !important;
                }
                [data-theme="dark"] .event-card:hover {
                    box-shadow: 0 8px 30px rgba(0,0,0,0.3) !important;
                    border-color: rgba(14,165,233,0.3) !important;
                }

                [data-theme="dark"] .btn-ghost {
                    background: rgba(30,41,59,0.8) !important;
                    border-color: rgba(148,163,184,0.15) !important;
                    color: #CBD5E1 !important;
                }
                [data-theme="dark"] .btn-ghost:hover {
                    background: #334155 !important;
                    border-color: #0EA5E9 !important;
                }

                [data-theme="dark"] .modal-overlay {
                    background: rgba(0,0,0,0.6) !important;
                }
                [data-theme="dark"] .modal-sheet {
                    background: rgba(15,23,42,0.98) !important;
                    border-color: rgba(148,163,184,0.1) !important;
                    color: #E2E8F0 !important;
                }

                /* Day tabs background when not active */
                [data-theme="dark"] .day-tab[style*="background: rgba(255, 255, 255"] {
                    background: rgba(30,41,59,0.8) !important;
                    color: #94A3B8 !important;
                }

                /* Cards & panels - catch most white/light backgrounds */
                [data-theme="dark"] div[style*="background: rgba(255,255,255,0.5)"],
                [data-theme="dark"] div[style*="background: rgba(255, 255, 255, 0.5)"],
                [data-theme="dark"] div[style*="background: rgba(255,255,255,0.6)"],
                [data-theme="dark"] div[style*="background: rgba(255, 255, 255, 0.6)"] {
                    background: rgba(30,41,59,0.6) !important;
                }

                /* Budget & expense panels */
                [data-theme="dark"] div[style*="background: linear-gradient(135deg,rgba(255,251,235"] {
                    background: linear-gradient(135deg,rgba(146,64,14,0.15),rgba(146,64,14,0.08)) !important;
                    border-color: rgba(245,158,11,0.2) !important;
                }
                [data-theme="dark"] div[style*="color: #92400E"] {
                    color: #FCD34D !important;
                }

                /* Green expense total */
                [data-theme="dark"] div[style*="background: linear-gradient(135deg,rgba(16,185,129"] {
                    background: linear-gradient(135deg,rgba(6,95,70,0.2),rgba(16,185,129,0.08)) !important;
                }
                [data-theme="dark"] div[style*="color: #065F46"] {
                    color: #34D399 !important;
                }

                /* Trips page overrides */
                [data-theme="dark"] button[style*="background: #1e293b"] {
                    background: #0EA5E9 !important;
                }

                /* Scrollbar */
                [data-theme="dark"] ::-webkit-scrollbar { width: 6px; }
                [data-theme="dark"] ::-webkit-scrollbar-track { background: #0F172A; }
                [data-theme="dark"] ::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }

                /* Dark mode toggle button */
                .dark-toggle {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    z-index: 9999;
                    width: 44px;
                    height: 44px;
                    border-radius: 50%;
                    border: 2px solid rgba(148,163,184,0.2);
                    cursor: pointer;
                    font-size: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.3s;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.15);
                    font-family: inherit;
                }
                .dark-toggle:hover {
                    transform: scale(1.1);
                    box-shadow: 0 8px 25px rgba(0,0,0,0.25);
                }
            `}</style>
            <Component {...pageProps} />
            <button className="dark-toggle"
                onClick={toggleDark}
                title={dark ? 'Light Mode' : 'Dark Mode'}
                style={{ background: dark ? '#1E293B' : 'white', color: dark ? '#FCD34D' : '#475569' }}>
                {dark ? '☀️' : '🌙'}
            </button>
        </>
    )
}
