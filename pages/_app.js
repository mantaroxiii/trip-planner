import { useEffect } from 'react'
import Head from 'next/head'

export default function App({ Component, pageProps }) {
    useEffect(() => {
        // Register service worker for offline support
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(() => { })
        }
    }, [])

    return (
        <>
            <Head>
                <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
                <meta name="theme-color" content="#0EA5E9" />
                <link rel="manifest" href="/manifest.json" />
                <title>Trip Planner</title>
            </Head>
            <Component {...pageProps} />
        </>
    )
}
