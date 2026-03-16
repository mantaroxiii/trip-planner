import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

export default function Trips() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [trips, setTrips] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!s) { router.replace('/login'); return }
      setUser(s.user)
      setSession(s)
      fetchTrips(s.access_token)
    })
  }, [])

  const fetchTrips = async (token) => {
    const res = await fetch('/api/trips', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    setTrips(data.trips || [])
    setLoading(false)
  }

  const createTrip = async () => {
    setCreating(true)
    const res = await fetch('/api/trips', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'Trip ใหม่' }),
    })
    const data = await res.json()
    if (data.trip) router.push(`/trip/${data.trip.id}`)
    else setCreating(false)
  }

  const deleteTrip = async (id) => {
    if (!confirm('ลบ trip นี้?')) return
    await fetch(`/api/trips/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    setTrips(trips.filter(t => t.id !== id))
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const formatDate = (iso) => {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
  }

  const S = {
    app: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', minHeight: '100vh', background: '#f1f5f9' },
    header: { background: 'white', borderBottom: '1px solid #e2e8f0', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    content: { maxWidth: '600px', margin: '0 auto', padding: '20px 16px' },
    createBtn: { width: '100%', background: '#1e293b', color: 'white', border: 'none', borderRadius: '14px', padding: '14px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', marginBottom: '16px', opacity: creating ? 0.6 : 1 },
    card: { background: 'white', borderRadius: '14px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' },
    deleteBtn: { background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '18px', padding: '4px 8px', flexShrink: 0 },
    signOutBtn: { background: 'none', border: '1.5px solid #e2e8f0', color: '#64748b', borderRadius: '8px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer' },
  }

  if (loading) return (
    <div style={{ ...S.app, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '12px', display: 'inline-block', animation: 'float 1.5s ease-in-out infinite' }}>✈️</div>
        <style>{`@keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }`}</style>
      </div>
    </div>
  )

  return (
    <div style={S.app}>
      <div style={S.header}>
        <div style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>✈️ My Trips</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '13px', color: '#94a3b8', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.email}
          </span>
          <button onClick={signOut} style={S.signOutBtn}>ออกจากระบบ</button>
        </div>
      </div>

      <div style={S.content}>
        <button style={S.createBtn} onClick={createTrip} disabled={creating}>
          {creating ? '...' : '+ สร้าง Trip ใหม่'}
        </button>

        {trips.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: '#94a3b8' }}>
            <div style={{ fontSize: '52px', marginBottom: '14px' }}>🗺️</div>
            <div style={{ fontSize: '16px', fontWeight: '600', color: '#64748b', marginBottom: '6px' }}>ยังไม่มี Trip</div>
            <div style={{ fontSize: '14px' }}>กด "+ สร้าง Trip ใหม่" เพื่อเริ่มต้นวางแผน</div>
          </div>
        ) : trips.map(trip => (
          <div key={trip.id} style={S.card} onClick={() => router.push(`/trip/${trip.id}`)}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '15px', fontWeight: '600', color: '#1e293b', marginBottom: '3px' }}>
                {trip.plan_json ? '🗓️' : '📝'} {trip.title}
              </div>
              {trip.destination && (
                <div style={{ fontSize: '13px', color: '#64748b' }}>📍 {trip.destination}</div>
              )}
              {trip.dates && (
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '1px' }}>📅 {trip.dates}</div>
              )}
              <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '4px' }}>
                แก้ไขล่าสุด {formatDate(trip.updated_at)}
              </div>
            </div>
            <button
              style={S.deleteBtn}
              onClick={e => { e.stopPropagation(); deleteTrip(trip.id) }}
              title="ลบ trip"
            >
              🗑️
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
