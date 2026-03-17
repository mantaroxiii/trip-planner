import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../lib/supabase'

const ADMIN_EMAILS = ['nathakorn.ted@gmail.com']

export default function AdminPage() {
    const router = useRouter()
    const [user, setUser] = useState(null)
    const [session, setSession] = useState(null)
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session: s } }) => {
            if (!s) { router.replace('/login'); return }
            const email = s.user?.email?.toLowerCase()
            if (!ADMIN_EMAILS.includes(email)) { router.replace('/trips'); return }
            setUser(s.user)
            setSession(s)
            fetchAdmin(s.access_token)
        })
    }, [])

    const fetchAdmin = async (token) => {
        try {
            const res = await fetch('/api/admin', {
                headers: { Authorization: `Bearer ${token}` },
            })
            if (!res.ok) { setError('ไม่มีสิทธิ์เข้าถึง'); setLoading(false); return }
            const d = await res.json()
            setData(d)
        } catch (e) { setError('โหลดข้อมูลไม่สำเร็จ') }
        setLoading(false)
    }

    const filteredTrips = (data?.trips || []).filter(t => {
        if (!search) return true
        const q = search.toLowerCase()
        return (t.title || '').toLowerCase().includes(q) ||
            (t.destination || '').toLowerCase().includes(q) ||
            (t.ownerEmail || '').toLowerCase().includes(q)
    })

    const formatDate = (iso) => {
        if (!iso) return '-'
        return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })
    }

    const timeAgo = (iso) => {
        if (!iso) return '-'
        const diff = Date.now() - new Date(iso).getTime()
        const mins = Math.floor(diff / 60000)
        if (mins < 60) return `${mins} นาทีก่อน`
        const hrs = Math.floor(mins / 60)
        if (hrs < 24) return `${hrs} ชม.ก่อน`
        const days = Math.floor(hrs / 24)
        return `${days} วันก่อน`
    }

    if (loading) return (
        <div style={{ minHeight: '100vh', background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontFamily: 'system-ui' }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px', animation: 'pulse 1.5s infinite' }}>🛡️</div>
                <div style={{ fontSize: '14px', opacity: 0.5 }}>กำลังโหลด Admin Panel...</div>
            </div>
            <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
        </div>
    )

    if (error) return (
        <div style={{ minHeight: '100vh', background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontFamily: 'system-ui' }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>🚫</div>
                <div style={{ fontSize: '16px', fontWeight: '700' }}>{error}</div>
                <button onClick={() => router.push('/trips')} style={{ marginTop: '16px', background: '#3B82F6', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 20px', cursor: 'pointer', fontWeight: '600' }}>
                    กลับหน้า Trips
                </button>
            </div>
        </div>
    )

    return (
        <>
            <Head><title>🛡️ Admin Panel | Trip Planner</title></Head>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: 'Inter', -apple-system, sans-serif; background: #0F172A; color: white; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
            <div style={{ minHeight: '100vh' }}>
                {/* Header */}
                <div style={{ background: 'rgba(0,0,0,0.4)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '14px 20px', position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(12px)' }}>
                    <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '20px' }}>🛡️</span>
                            <div>
                                <div style={{ fontSize: '15px', fontWeight: '800', letterSpacing: '-0.3px' }}>Admin Panel</div>
                                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>Beta Testing Dashboard</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>{user?.email}</span>
                            <button onClick={() => router.push('/trips')}
                                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', fontFamily: 'inherit' }}>
                                👤 User Mode
                            </button>
                        </div>
                    </div>
                </div>

                <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px 16px' }}>
                    {/* Stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px', animation: 'fadeIn 0.4s ease' }}>
                        <div style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(96,165,250,0.08))', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '16px', padding: '16px' }}>
                            <div style={{ fontSize: '10px', color: '#60A5FA', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Users</div>
                            <div style={{ fontSize: '28px', fontWeight: '800', marginTop: '4px' }}>{data?.stats?.totalUsers || 0}</div>
                        </div>
                        <div style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(52,211,153,0.08))', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '16px', padding: '16px' }}>
                            <div style={{ fontSize: '10px', color: '#34D399', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Trips</div>
                            <div style={{ fontSize: '28px', fontWeight: '800', marginTop: '4px' }}>{data?.stats?.totalTrips || 0}</div>
                        </div>
                        <div style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(167,139,250,0.08))', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '16px', padding: '16px' }}>
                            <div style={{ fontSize: '10px', color: '#A78BFA', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Has Plan</div>
                            <div style={{ fontSize: '28px', fontWeight: '800', marginTop: '4px' }}>{data?.stats?.tripsWithPlan || 0}</div>
                        </div>
                    </div>

                    {/* Search */}
                    <div style={{ marginBottom: '16px' }}>
                        <input
                            type="text" placeholder="🔍 ค้นหา trip, destination, user email..."
                            value={search} onChange={e => setSearch(e.target.value)}
                            style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '12px 16px', color: 'white', fontSize: '13px', fontFamily: 'inherit', outline: 'none' }}
                        />
                    </div>

                    {/* Trip List */}
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', marginBottom: '10px', fontWeight: '600' }}>
                        {filteredTrips.length} trips {search && `(ค้นหา "${search}")`}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {filteredTrips.map((trip, i) => (
                            <div key={trip.id}
                                onClick={() => router.push(`/trip/${trip.id}`)}
                                style={{
                                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px',
                                    padding: '14px 16px', cursor: 'pointer', transition: 'all 0.2s',
                                    animation: `fadeIn 0.3s ${i * 0.03}s ease both`,
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)' }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}
                            >
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '14px', fontWeight: '700' }}>
                                                {trip.hasPlan ? '🗓️' : '📝'} {trip.title || 'Untitled'}
                                            </span>
                                            {trip.hasPlan && (
                                                <span style={{ fontSize: '10px', background: 'rgba(16,185,129,0.15)', color: '#34D399', padding: '2px 8px', borderRadius: '99px', fontWeight: '700' }}>
                                                    {trip.planDays} วัน
                                                </span>
                                            )}
                                            {trip.memberCount > 0 && (
                                                <span style={{ fontSize: '10px', background: 'rgba(139,92,246,0.15)', color: '#A78BFA', padding: '2px 8px', borderRadius: '99px', fontWeight: '700' }}>
                                                    👥 +{trip.memberCount}
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>
                                            {trip.destination && <span>📍 {trip.destination}</span>}
                                            {trip.dates && <span>📅 {trip.dates}</span>}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '10px', color: 'rgba(255,255,255,0.2)', marginTop: '4px' }}>
                                            <span>👤 {trip.ownerEmail}</span>
                                            <span>🕐 {timeAgo(trip.updatedAt)}</span>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '16px', opacity: 0.3, flexShrink: 0 }}>→</div>
                                </div>
                            </div>
                        ))}

                        {filteredTrips.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)' }}>
                                <div style={{ fontSize: '36px', marginBottom: '8px' }}>🔍</div>
                                ไม่พบ trip
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    )
}
