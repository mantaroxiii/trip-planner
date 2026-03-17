import { useEffect } from 'react'
import Head from 'next/head'

export default function App({ Component, pageProps }) {
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(() => { })
        }
        // Clear any leftover dark mode
        document.documentElement.removeAttribute('data-theme')
        localStorage.removeItem('darkMode')
    }, [])

    return (
        <>
            <Head>
                <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
                <meta name="theme-color" content="#0EA5E9" />
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
                    html { font-size: 115%; }
                }
                @media (min-width: 1200px) {
                    .container-main { max-width: 960px; }
                    html { font-size: 125%; }
                }
            `}</style>
            <Component {...pageProps} />
        </>
    )
}
