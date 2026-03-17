import dynamic from 'next/dynamic'

// Recharts crashes on SSR (accesses window/document) — load client-side only
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
    return <SpendingReport />
}
