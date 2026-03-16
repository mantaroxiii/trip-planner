import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'

export default function PackingPage() {
    const router = useRouter()
    const { id } = router.query
    const [session, setSession] = useState(null)
    const [trip, setTrip] = useState(null)
    const [loading, setLoading] = useState(true)

    // Travelers form
    const [travelers, setTravelers] = useState({ men: 1, women: 0, kids: 0, toddlers: 0 })
    const [showForm, setShowForm] = useState(true)

    // Packing data
    const [packingData, setPackingData] = useState(null)
    const [checked, setChecked] = useState({})
    const [generating, setGenerating] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session: s } }) => {
            if (!s) { router.replace('/login'); return }
            setSession(s)
        })
    }, [])

    useEffect(() => {
        if (!session || !id || !router.isReady) return
        loadTrip()
        // Load saved packing data
        const saved = localStorage.getItem(`packing-${id}`)
        if (saved) {
            try {
                const parsed = JSON.parse(saved)
                if (parsed.data?.categories?.length > 0) {
                    setPackingData(parsed.data)
                    setChecked(parsed.checked || {})
                    setTravelers(parsed.travelers || { men: 1, women: 0, kids: 0, toddlers: 0 })
                    setShowForm(false)
                }
            } catch (e) { }
        }
    }, [session, id, router.isReady])

    const loadTrip = async () => {
        const res = await fetch(`/api/trips/${id}`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) {
            const { trip: t } = await res.json()
            setTrip(t)
        }
        setLoading(false)
    }

    const generate = async () => {
        if (!trip?.plan_json) { setError('ยังไม่มีแพลนทริป'); return }
        setGenerating(true); setError('')
        try {
            const res = await fetch('/api/packing', {
                method: 'POST',
                headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    destination: trip.destination,
                    dates: trip.dates,
                    plan: trip.plan_json,
                    travelers,
                }),
            })
            const data = await res.json()
            if (data.error) throw new Error(data.error)
            setPackingData(data)
            setChecked({})
            setShowForm(false)
            // Save to localStorage
            localStorage.setItem(`packing-${id}`, JSON.stringify({ data, checked: {}, travelers }))
        } catch (e) {
            setError(e.message)
        } finally {
            setGenerating(false)
        }
    }

    const toggleCheck = (catIdx, itemIdx) => {
        const key = `${catIdx}-${itemIdx}`
        const newChecked = { ...checked, [key]: !checked[key] }
        setChecked(newChecked)
        // Auto-save
        if (packingData) {
            localStorage.setItem(`packing-${id}`, JSON.stringify({ data: packingData, checked: newChecked, travelers }))
        }
    }

    const totalItems = packingData?.categories?.reduce((sum, c) => sum + c.items.length, 0) || 0
    const checkedCount = Object.values(checked).filter(Boolean).length
    const progress = totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0

    const totalPeople = travelers.men + travelers.women + travelers.kids + travelers.toddlers

    const TravelerCounter = ({ label, icon, field }) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(14,165,233,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '24px' }}>{icon}</span>
                <span style={{ fontSize: '15px', fontWeight: '600', color: '#0C4A6E' }}>{label}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button onClick={() => setTravelers(p => ({ ...p, [field]: Math.max(0, p[field] - 1) }))}
                    style={{ width: '32px', height: '32px', borderRadius: '10px', border: '1.5px solid #BAE6FD', background: 'white', color: '#0C4A6E', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700' }}>−</button>
                <span style={{ fontSize: '18px', fontWeight: '800', color: '#0C4A6E', minWidth: '24px', textAlign: 'center' }}>{travelers[field]}</span>
                <button onClick={() => setTravelers(p => ({ ...p, [field]: p[field] + 1 }))}
                    style={{ width: '32px', height: '32px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#0EA5E9,#38BDF8)', color: 'white', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700' }}>+</button>
            </div>
        </div>
    )

    if (loading) return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#F0F9FF,#E0F2FE,#BAE6FD)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
            <div style={{ fontSize: '48px', animation: 'float 1.5s ease-in-out infinite' }}>🧳</div>
            <style>{`@keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }`}</style>
        </div>
    )

    return (
        <>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Plus Jakarta Sans', sans-serif; }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .pack-card { animation: fadeIn 0.3s ease-out; }
        .check-item { transition: all 0.2s; cursor: pointer; }
        .check-item:hover { background: rgba(14,165,233,0.06); }
      `}</style>

            <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#F0F9FF 0%,#E0F2FE 50%,#BAE6FD 100%)', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                {/* Header */}
                <div style={{ background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(14,165,233,0.1)', padding: '14px 16px', position: 'sticky', top: 0, zIndex: 10 }}>
                    <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <button onClick={() => router.push(`/trip/${id}`)}
                                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '4px' }}>←</button>
                            <div>
                                <div style={{ fontSize: '16px', fontWeight: '800', color: '#0C4A6E' }}>🧳 Packing List</div>
                                <div style={{ fontSize: '11px', color: '#38BDF8' }}>{trip?.destination || 'Trip'} · {totalPeople} คน</div>
                            </div>
                        </div>
                        {packingData && (
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '22px', fontWeight: '800', color: progress === 100 ? '#10B981' : '#0C4A6E' }}>{progress}%</div>
                                <div style={{ fontSize: '10px', color: '#64748b' }}>{checkedCount}/{totalItems}</div>
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px' }}>
                    {/* Progress bar */}
                    {packingData && (
                        <div style={{ background: 'rgba(255,255,255,0.6)', borderRadius: '12px', padding: '12px 14px', marginBottom: '14px', backdropFilter: 'blur(8px)' }}>
                            <div style={{ height: '8px', borderRadius: '99px', background: '#E0F2FE', overflow: 'hidden' }}>
                                <div style={{ height: '100%', borderRadius: '99px', background: progress === 100 ? 'linear-gradient(90deg,#10B981,#34D399)' : 'linear-gradient(90deg,#0EA5E9,#38BDF8)', width: `${progress}%`, transition: 'width 0.4s ease' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                                <span style={{ fontSize: '11px', color: '#64748b' }}>
                                    {progress === 100 ? '✅ จัดกระเป๋าครบแล้ว!' : `เหลืออีก ${totalItems - checkedCount} ชิ้น`}
                                </span>
                                <button onClick={() => { setShowForm(true); setPackingData(null) }}
                                    style={{ fontSize: '11px', color: '#0EA5E9', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600', fontFamily: 'inherit' }}>
                                    🔄 สร้างใหม่
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Travelers Form */}
                    {showForm && (
                        <div className="pack-card" style={{ background: 'rgba(255,255,255,0.9)', borderRadius: '20px', padding: '20px', marginBottom: '16px', boxShadow: '0 4px 20px rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.1)' }}>
                            <div style={{ fontSize: '17px', fontWeight: '800', color: '#0C4A6E', marginBottom: '4px' }}>👥 ผู้เดินทาง</div>
                            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '14px' }}>เลือกจำนวนผู้เดินทางเพื่อให้ AI แนะนำของแม่นยำขึ้น</div>

                            <TravelerCounter label="ผู้ชาย" icon="👨" field="men" />
                            <TravelerCounter label="ผู้หญิง" icon="👩" field="women" />
                            <TravelerCounter label="เด็กโต (7-15)" icon="🧒" field="kids" />
                            <TravelerCounter label="เด็กเล็ก (0-6)" icon="👶" field="toddlers" />

                            <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                                {packingData && (
                                    <button onClick={() => setShowForm(false)}
                                        style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1.5px solid #BAE6FD', background: 'white', color: '#0C4A6E', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
                                        ยกเลิก
                                    </button>
                                )}
                                <button onClick={generate} disabled={generating || totalPeople === 0}
                                    style={{ flex: 2, padding: '12px', borderRadius: '12px', border: 'none', background: totalPeople === 0 ? '#CBD5E1' : 'linear-gradient(135deg,#F59E0B,#F97316)', color: 'white', fontSize: '15px', fontWeight: '700', cursor: totalPeople === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: totalPeople > 0 ? '0 4px 15px rgba(249,115,22,0.3)' : 'none' }}>
                                    {generating ? '⏳ AI กำลังสร้าง...' : `🧳 สร้าง Packing List (${totalPeople} คน)`}
                                </button>
                            </div>

                            {error && (
                                <div style={{ marginTop: '10px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '8px 12px', fontSize: '12px', color: '#DC2626' }}>
                                    ⚠️ {error}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Generating animation */}
                    {generating && (
                        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                            <div style={{ fontSize: '52px', animation: 'float 1.5s ease-in-out infinite' }}>🧳</div>
                            <div style={{ fontSize: '15px', fontWeight: '700', color: '#0C4A6E', marginTop: '12px' }}>AI กำลังเตรียมรายการ...</div>
                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                                {travelers.women > 0 ? '💄 รวมของผู้หญิง · ' : ''}
                                {(travelers.kids > 0 || travelers.toddlers > 0) ? '🧸 รวมของเด็ก · ' : ''}
                                ตามกิจกรรมในทริป
                            </div>
                        </div>
                    )}

                    {/* Packing Checklist */}
                    {packingData && !showForm && packingData.categories?.map((cat, ci) => {
                        const catChecked = cat.items.filter((_, ii) => checked[`${ci}-${ii}`]).length
                        const catTotal = cat.items.length
                        const catDone = catChecked === catTotal
                        return (
                            <div key={ci} className="pack-card" style={{ background: 'rgba(255,255,255,0.9)', borderRadius: '16px', marginBottom: '10px', overflow: 'hidden', boxShadow: '0 2px 10px rgba(14,165,233,0.06)', border: catDone ? '1.5px solid #86EFAC' : '1px solid rgba(14,165,233,0.1)' }}>
                                <div style={{ padding: '12px 14px', background: catDone ? 'rgba(16,185,129,0.08)' : 'rgba(14,165,233,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '20px' }}>{cat.icon}</span>
                                        <span style={{ fontSize: '14px', fontWeight: '700', color: '#0C4A6E' }}>{cat.name}</span>
                                    </div>
                                    <span style={{ fontSize: '11px', fontWeight: '600', color: catDone ? '#10B981' : '#64748b', background: catDone ? '#D1FAE5' : '#F1F5F9', padding: '2px 8px', borderRadius: '99px' }}>
                                        {catDone ? '✅' : `${catChecked}/${catTotal}`}
                                    </span>
                                </div>
                                <div style={{ padding: '4px 0' }}>
                                    {cat.items.map((item, ii) => {
                                        const isChecked = checked[`${ci}-${ii}`]
                                        return (
                                            <div key={ii} className="check-item" onClick={() => toggleCheck(ci, ii)}
                                                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', opacity: isChecked ? 0.5 : 1 }}>
                                                <div style={{ width: '22px', height: '22px', borderRadius: '7px', border: isChecked ? 'none' : '2px solid #BAE6FD', background: isChecked ? 'linear-gradient(135deg,#10B981,#34D399)' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}>
                                                    {isChecked && <span style={{ color: 'white', fontSize: '12px', fontWeight: '800' }}>✓</span>}
                                                </div>
                                                <span style={{ fontSize: '14px', color: '#1E293B', textDecoration: isChecked ? 'line-through' : 'none', fontWeight: '500' }}>{item}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}

                    {/* Empty state */}
                    {!packingData && !generating && !showForm && (
                        <div style={{ textAlign: 'center', padding: '48px 20px' }}>
                            <div style={{ fontSize: '52px', marginBottom: '14px' }}>🧳</div>
                            <div style={{ fontSize: '16px', fontWeight: '600', color: '#64748b' }}>ยังไม่มี Packing List</div>
                            <button onClick={() => setShowForm(true)}
                                style={{ marginTop: '14px', padding: '10px 24px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg,#F59E0B,#F97316)', color: 'white', fontSize: '14px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>
                                + สร้างใหม่
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}
