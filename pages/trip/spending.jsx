import dynamic from 'next/dynamic'
import Head from 'next/head'
import { Component } from 'react'

// Error Boundary to catch recharts crashes
class ErrorBoundary extends Component {
    constructor(props) { super(props); this.state = { hasError: false, error: null } }
    static getDerivedStateFromError(error) { return { hasError: true, error } }
    render() {
        if (this.state.hasError) {
            return (
                <div style={{ minHeight: '100vh', background: '#0C1829', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontFamily: 'system-ui', padding: '20px' }}>
                    <div style={{ textAlign: 'center', maxWidth: '400px' }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
                        <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '8px' }}>Spending Report โหลดไม่สำเร็จ</div>
                        <div style={{ fontSize: '13px', opacity: 0.5, marginBottom: '20px' }}>กรุณาลองรีเฟรชหน้าใหม่</div>
                        <button onClick={() => window.location.reload()}
                            style={{ background: '#0EA5E9', color: 'white', border: 'none', borderRadius: '12px', padding: '12px 24px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
                            🔄 รีเฟรช
                        </button>
                        <div style={{ marginTop: '16px', fontSize: '10px', opacity: 0.3, wordBreak: 'break-all' }}>
                            {String(this.state.error?.message || '')}
                        </div>
                    </div>
                </div>
            )
        }
        return this.props.children
    }
}

// Dynamic import recharts-heavy component — client-side only
const SpendingReport = dynamic(() => import('../../components/SpendingReport'), {
    ssr: false,
    loading: () => (
        <div style={{ minHeight: '100vh', background: '#0C1829', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontFamily: 'system-ui' }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px', animation: 'pulse 1.5s infinite' }}>📊</div>
                <div style={{ fontSize: '14px', opacity: 0.5 }}>กำลังโหลด Spending Report...</div>
            </div>
            <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
        </div>
    )
})

export default function SpendingPage() {
    return (
        <>
            <Head>
                <title>Spending Report | Trip Planner</title>
                <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
            </Head>
            <ErrorBoundary>
                <SpendingReport />
            </ErrorBoundary>
        </>
    )
}
