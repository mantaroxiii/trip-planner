import { useEffect, useState } from 'react'
import Head from 'next/head'

export default function App({ Component, pageProps }) {
    const [dark, setDark] = useState(false)

    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(() => { })
        }
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
                /* ═══ Responsive Container ═══ */
                .container-main {
                    max-width: 600px;
                    margin: 0 auto;
                    width: 100%;
                }
                @media (min-width: 768px) {
                    .container-main { max-width: 800px; }
                    html { font-size: 105%; }
                }
                @media (min-width: 1200px) {
                    .container-main { max-width: 960px; }
                    html { font-size: 112%; }
                }

                /* ═══ DARK MODE ═══ */
                [data-theme="dark"] body {
                    background: #0B1120 !important;
                    color: #E2E8F0 !important;
                }

                /* ── Page backgrounds ── */
                [data-theme="dark"] div[style*="background: #f1f5f9"],
                [data-theme="dark"] div[style*="background:#f1f5f9"] {
                    background: #0B1120 !important;
                }
                [data-theme="dark"] div[style*="background: linear-gradient(135deg,#F0F9FF"],
                [data-theme="dark"] div[style*="background: linear-gradient(135deg, #F0F9FF"] {
                    background: linear-gradient(135deg, #0B1120, #0F172A, #131C2E) !important;
                }

                /* ── White/light containers ── */
                [data-theme="dark"] div[style*="background: white"],
                [data-theme="dark"] div[style*="background:white"] {
                    background: #151D2E !important;
                    border-color: rgba(255,255,255,0.06) !important;
                }

                /* ── All text overrides ── */
                [data-theme="dark"] [style*="color: #1e293b"],
                [data-theme="dark"] [style*="color:#1e293b"] { color: #F1F5F9 !important; }
                [data-theme="dark"] [style*="color: #0C4A6E"],
                [data-theme="dark"] [style*="color:#0C4A6E"] { color: #E2E8F0 !important; }
                [data-theme="dark"] [style*="color: #64748b"],
                [data-theme="dark"] [style*="color:#64748b"] { color: #94A3B8 !important; }
                [data-theme="dark"] [style*="color: #94a3b8"],
                [data-theme="dark"] [style*="color:#94a3b8"] { color: #64748B !important; }
                [data-theme="dark"] [style*="color: #cbd5e1"] { color: #475569 !important; }

                /* ── Form elements ── */
                [data-theme="dark"] .trip-input,
                [data-theme="dark"] .trip-textarea {
                    background: #1A2332 !important;
                    color: #E2E8F0 !important;
                    border-color: rgba(56,189,248,0.15) !important;
                }
                [data-theme="dark"] .trip-input:focus,
                [data-theme="dark"] .trip-textarea:focus {
                    border-color: #0EA5E9 !important;
                    box-shadow: 0 0 0 3px rgba(14,165,233,0.15) !important;
                }
                [data-theme="dark"] .trip-input::placeholder,
                [data-theme="dark"] .trip-textarea::placeholder {
                    color: #4A5568 !important;
                }
                [data-theme="dark"] select {
                    background: #1A2332 !important;
                    color: #E2E8F0 !important;
                    border-color: rgba(56,189,248,0.15) !important;
                }

                /* ── Event cards ── */
                [data-theme="dark"] .event-card {
                    background: #151D2E !important;
                    border: 1px solid rgba(56,189,248,0.08) !important;
                    box-shadow: 0 2px 12px rgba(0,0,0,0.25) !important;
                }
                [data-theme="dark"] .event-card:hover {
                    box-shadow: 0 8px 30px rgba(0,0,0,0.35) !important;
                    border-color: rgba(56,189,248,0.2) !important;
                }

                /* ── Buttons ── */
                [data-theme="dark"] .btn-ghost {
                    background: #1A2332 !important;
                    border-color: rgba(56,189,248,0.12) !important;
                    color: #CBD5E1 !important;
                }
                [data-theme="dark"] .btn-ghost:hover {
                    background: #243044 !important;
                    border-color: #0EA5E9 !important;
                    color: white !important;
                }

                /* ── Modals ── */
                [data-theme="dark"] .modal-overlay {
                    background: rgba(0,0,0,0.7) !important;
                }
                [data-theme="dark"] .modal-sheet {
                    background: #0F172A !important;
                    border-color: rgba(56,189,248,0.1) !important;
                    color: #E2E8F0 !important;
                    box-shadow: 0 -8px 40px rgba(0,0,0,0.4) !important;
                }

                /* ── Day tabs ── */
                [data-theme="dark"] .day-tab {
                    color: #94A3B8 !important;
                }
                [data-theme="dark"] .day-tab[style*="background: rgba(255, 255, 255"] {
                    background: #1A2332 !important;
                    color: #94A3B8 !important;
                    border-color: rgba(56,189,248,0.08) !important;
                }

                /* ── Semi-transparent panels ── */
                [data-theme="dark"] div[style*="background: rgba(255,255,255,0.5)"],
                [data-theme="dark"] div[style*="background: rgba(255, 255, 255, 0.5)"],
                [data-theme="dark"] div[style*="background: rgba(255,255,255,0.6)"],
                [data-theme="dark"] div[style*="background: rgba(255, 255, 255, 0.6)"],
                [data-theme="dark"] div[style*="background: rgba(255,255,255,0.1)"] {
                    background: rgba(21,29,46,0.7) !important;
                    border-color: rgba(56,189,248,0.06) !important;
                }

                /* ── Budget panels ── */
                [data-theme="dark"] div[style*="background: linear-gradient(135deg,rgba(255,251,235"] {
                    background: linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.03)) !important;
                    border-color: rgba(245,158,11,0.15) !important;
                }
                [data-theme="dark"] [style*="color: #92400E"] { color: #FBBF24 !important; }

                [data-theme="dark"] div[style*="background: linear-gradient(135deg,rgba(16,185,129"] {
                    background: linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.03)) !important;
                    border-color: rgba(16,185,129,0.15) !important;
                }
                [data-theme="dark"] [style*="color: #065F46"] { color: #34D399 !important; }
                [data-theme="dark"] [style*="color: #047857"] { color: #6EE7B7 !important; }

                /* ── Trips page ── */
                [data-theme="dark"] div[style*="borderBottom: '1px solid #e2e8f0'"],
                [data-theme="dark"] div[style*="borderBottom: \"1px solid #e2e8f0\""] {
                    border-color: rgba(255,255,255,0.06) !important;
                }
                [data-theme="dark"] button[style*="background: #1e293b"],
                [data-theme="dark"] button[style*="background:#1e293b"] {
                    background: linear-gradient(135deg,#0EA5E9,#38BDF8) !important;
                }
                [data-theme="dark"] div[style*="boxShadow: '0 2px 8px rgba(0,0,0,0.06)'"],
                [data-theme="dark"] div[style*="box-shadow: 0 2px 8px rgba(0,0,0,0.06)"] {
                    background: #151D2E !important;
                    border: 1px solid rgba(56,189,248,0.08) !important;
                }

                /* ── Budget tag ── */
                [data-theme="dark"] .budget-tag {
                    background: rgba(245,158,11,0.15) !important;
                    color: #FBBF24 !important;
                }

                /* ── Note inline ── */
                [data-theme="dark"] [style*="color: #64748B"] { color: #94A3B8 !important; }
                [data-theme="dark"] [style*="borderTop:"] { border-color: rgba(255,255,255,0.06) !important; }

                /* ── Scrollbar ── */
                [data-theme="dark"] ::-webkit-scrollbar { width: 6px; height: 6px; }
                [data-theme="dark"] ::-webkit-scrollbar-track { background: transparent; }
                [data-theme="dark"] ::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }

                /* ═══ Dark Toggle Button ═══ */
                .dark-toggle {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    z-index: 9999;
                    width: 46px;
                    height: 46px;
                    border-radius: 50%;
                    border: none;
                    cursor: pointer;
                    font-size: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.3s;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
                    font-family: inherit;
                }
                .dark-toggle:hover {
                    transform: scale(1.15) rotate(15deg);
                    box-shadow: 0 8px 30px rgba(0,0,0,0.3);
                }
                [data-theme="dark"] .dark-toggle {
                    background: linear-gradient(135deg, #1E293B, #334155) !important;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.4), 0 0 15px rgba(250,204,21,0.15);
                }
            `}</style>
            <Component {...pageProps} />
            <button className="dark-toggle"
                onClick={toggleDark}
                title={dark ? 'Light Mode' : 'Dark Mode'}
                style={{ background: dark ? undefined : 'white' }}>
                {dark ? '☀️' : '🌙'}
            </button>
        </>
    )
}
