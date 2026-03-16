import { useRouter } from 'next/router'

export default function OfflinePage() {
    const router = useRouter()

    return (
        <>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Plus Jakarta Sans', sans-serif; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
      `}</style>
            <div style={{
                minHeight: '100vh',
                background: 'linear-gradient(135deg,#F0F9FF,#E0F2FE,#BAE6FD)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Plus Jakarta Sans',sans-serif", padding: '20px',
            }}>
                <div style={{
                    background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(20px)',
                    borderRadius: '24px', padding: '40px 32px', maxWidth: '400px',
                    width: '100%', textAlign: 'center', boxShadow: '0 8px 40px rgba(14,165,233,0.12)',
                    border: '1.5px solid rgba(255,255,255,0.8)',
                }}>
                    <div style={{ fontSize: '64px', marginBottom: '16px' }}>📡</div>
                    <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#0C4A6E', marginBottom: '8px' }}>
                        ออฟไลน์
                    </h2>
                    <p style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.6', marginBottom: '20px' }}>
                        ไม่มีการเชื่อมต่ออินเทอร์เน็ต<br />
                        ข้อมูลทริปที่เคยเปิดจะยังดูได้จาก cache
                    </p>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button onClick={() => window.location.reload()}
                            style={{ padding: '10px 20px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg,#0EA5E9,#38BDF8)', color: 'white', fontSize: '14px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>
                            🔄 ลองใหม่
                        </button>
                        <button onClick={() => router.push('/trips')}
                            style={{ padding: '10px 20px', borderRadius: '12px', border: '1.5px solid #BAE6FD', background: 'white', color: '#0C4A6E', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
                            📋 My Trips
                        </button>
                    </div>
                    <div style={{ marginTop: '20px', animation: 'pulse 2s infinite', fontSize: '11px', color: '#94a3b8' }}>
                        จะเชื่อมต่อใหม่อัตโนมัติเมื่อมีสัญญาณ
                    </div>
                </div>
            </div>
        </>
    )
}
