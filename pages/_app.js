import { useEffect, useState } from 'react'
import Head from 'next/head'

export default function App({ Component, pageProps }) {
    const [installPrompt, setInstallPrompt] = useState(null)
    const [showInstallBanner, setShowInstallBanner] = useState(false)

    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(() => { })
        }
        document.documentElement.removeAttribute('data-theme')
        localStorage.removeItem('darkMode')

        // Check if already installed or dismissed
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone
        const dismissed = localStorage.getItem('installDismissed')
        if (isStandalone || (dismissed && Date.now() - parseInt(dismissed) < 7 * 86400000)) return

        // Android / Chrome: capture beforeinstallprompt
        const handler = (e) => {
            e.preventDefault()
            setInstallPrompt(e)
            setShowInstallBanner(true)
        }
        window.addEventListener('beforeinstallprompt', handler)

        // iOS: show manual instruction after 3s
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
        if (isIOS && !isStandalone) {
            setTimeout(() => setShowInstallBanner(true), 3000)
        }

        return () => window.removeEventListener('beforeinstallprompt', handler)
    }, [])

    const handleInstall = async () => {
        if (installPrompt) {
            installPrompt.prompt()
            const result = await installPrompt.userChoice
            if (result.outcome === 'accepted') setShowInstallBanner(false)
        }
        setInstallPrompt(null)
    }

    const dismissBanner = () => {
        setShowInstallBanner(false)
        localStorage.setItem('installDismissed', Date.now().toString())
    }

    const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)

    return (
        <>
            <Head>
                <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
                <meta name="theme-color" content="#0EA5E9" />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
                <link rel="manifest" href="/manifest.json" />
                <link rel="apple-touch-icon" href="/icon-192.png" />
                <title>Trip Planner</title>
            </Head>
            <style>{`
                .container-main {
                    max-width: 600px;
                    margin: 0 auto;
                    width: 100%;
                }
                @media (min-width: 768px) {
                    .container-main { max-width: 800px; }
                    html { font-size: 115%; }
                }
                @media (min-width: 1200px) {
                    .container-main { max-width: 960px; }
                    html { font-size: 125%; }
                }
                @keyframes slideUp {
                    from { transform: translateY(100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
            <Component {...pageProps} />

            {/* Install Banner */}
            {showInstallBanner && (
                <div style={{
                    position: 'fixed', bottom: '16px', left: '50%', transform: 'translateX(-50%)',
                    width: 'calc(100% - 32px)', maxWidth: '400px',
                    background: 'linear-gradient(135deg, #0C4A6E, #0EA5E9)',
                    borderRadius: '16px', padding: '14px 16px',
                    display: 'flex', alignItems: 'center', gap: '12px',
                    boxShadow: '0 8px 30px rgba(14,165,233,0.4)',
                    zIndex: 9999, animation: 'slideUp 0.3s ease',
                    border: '1px solid rgba(255,255,255,0.15)'
                }}>
                    <div style={{ fontSize: '28px' }}>📲</div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: '800', color: 'white' }}>เพิ่มลงหน้าจอหลัก</div>
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.75)', marginTop: '1px' }}>
                            {isIOS
                                ? 'กด ⎋ Share → "Add to Home Screen"'
                                : 'เปิดเร็ว เหมือนแอปจริง!'}
                        </div>
                    </div>
                    {!isIOS && installPrompt && (
                        <button onClick={handleInstall}
                            style={{ background: 'white', color: '#0C4A6E', border: 'none', borderRadius: '10px', padding: '8px 14px', fontSize: '12px', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                            ติดตั้ง
                        </button>
                    )}
                    <span onClick={dismissBanner}
                        style={{ color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '4px' }}>✕</span>
                </div>
            )}
        </>
    )
}
