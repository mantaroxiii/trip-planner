import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'

const COLORS = ['#f472b6', '#60a5fa', '#fb923c', '#f87171', '#2dd4bf', '#c084fc', '#94a3b8']
const LIGHT  = ['#fce7f3', '#dbeafe', '#ffedd5', '#fee2e2', '#ccfbf1', '#f3e8ff', '#f1f5f9']

const PROVIDERS = [
  { id: 'gemini', name: 'Gemini Flash', logo: '🔵', free: true, model: 'gemini-1.5-flash' },
  { id: 'claude', name: 'Claude', logo: '🟠', free: false, model: 'claude-sonnet-4-6', placeholder: 'sk-ant-api03-...', hintUrl: 'https://console.anthropic.com' },
  { id: 'openai', name: 'OpenAI', logo: '⚫', free: false, model: 'gpt-4o', placeholder: 'sk-proj-...', hintUrl: 'https://platform.openai.com/api-keys' },
]

export default function TripPage() {
  const router = useRouter()
  const { id } = router.query

  const [session, setSession] = useState(null)
  const [trip, setTrip] = useState(null)
  const [step, setStep] = useState('loading') // loading | draft | generating | plan

  // Draft fields
  const [destination, setDest] = useState('')
  const [dates, setDates] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // Plan state
  const [plan, setPlan] = useState(null)
  const [activeDay, setActiveDay] = useState(0)
  const [checked, setChecked] = useState({})
  const [noteMap, setNoteMap] = useState({})
  const [showNote, setShowNote] = useState({})

  // UI state
  const [error, setError] = useState('')
  const [shareToast, setShareToast] = useState(false)
  const [editNotif, setEditNotif] = useState('')
  const [showSettings, setShowSettings] = useState(false)

  // AI provider settings
  const [provider, setProvider] = useState('gemini')
  const [apiKey, setApiKey] = useState('')
  const [tempProvider, setTempProvider] = useState('gemini')
  const [tempKey, setTempKey] = useState('')

  const saveTimer = useRef(null)
  const prov = PROVIDERS.find(p => p.id === provider) || PROVIDERS[0]

  // 1. Auth check on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!s) { router.replace('/login'); return }
      setSession(s)
      const p = localStorage.getItem('trip_provider') || 'gemini'
      const k = localStorage.getItem('trip_api_key') || ''
      setProvider(p); setTempProvider(p); setApiKey(k); setTempKey(k)
    })
  }, [])

  // 2. Load trip when session + id ready
  useEffect(() => {
    if (!session || !id) return
    loadTrip()
    const savedChecked = localStorage.getItem(`checked-${id}`)
    const savedNotes = localStorage.getItem(`notes-${id}`)
    if (savedChecked) setChecked(JSON.parse(savedChecked))
    if (savedNotes) setNoteMap(JSON.parse(savedNotes))
  }, [session, id])

  // 3. Real-time subscription
  useEffect(() => {
    if (!trip?.id) return
    const channel = supabase
      .channel(`trip-${trip.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'trips',
        filter: `id=eq.${trip.id}`,
      }, (payload) => {
        const updated = payload.new
        if (updated.plan_json && JSON.stringify(updated.plan_json) !== JSON.stringify(plan)) {
          setPlan(updated.plan_json)
          setActiveDay(0)
          setStep('plan')
          setEditNotif('✏️ มีการอัปเดต plan')
          setTimeout(() => setEditNotif(''), 4000)
        }
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [trip?.id])

  const loadTrip = async () => {
    const res = await fetch(`/api/trips/${id}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (!res.ok) { router.replace('/trips'); return }
    const { trip: t } = await res.json()
    setTrip(t)
    setDest(t.destination || '')
    setDates(t.dates || '')
    setNotes(t.notes || '')
    if (t.plan_json) {
      setPlan(t.plan_json)
      setStep('plan')
    } else {
      setStep('draft')
    }
  }

  const autoSaveDraft = (dest, dt, n) => {
    clearTimeout(saveTimer.current)
    setSaving(true)
    saveTimer.current = setTimeout(async () => {
      await fetch(`/api/trips/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination: dest, dates: dt, notes: n, title: dest || 'Trip ใหม่' }),
      })
      setSaving(false)
    }, 1000)
  }

  const generate = async () => {
    if (provider !== 'gemini' && !apiKey) { setShowSettings(true); return }
    setStep('generating'); setError('')
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: provider === 'gemini' ? null : apiKey,
          provider, destination, dates, notes,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      setPlan(data); setActiveDay(0); setChecked({}); setNoteMap({})
      localStorage.removeItem(`checked-${id}`)
      localStorage.removeItem(`notes-${id}`)

      await fetch(`/api/trips/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_json: data, title: data.tripTitle || destination }),
      })
      setStep('plan')
    } catch (e) {
      setError(e.message)
      setStep('draft')
    }
  }

  const copyShareLink = () => {
    const base = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
    navigator.clipboard.writeText(`${base}/trip/${id}`)
    setShareToast(true)
    setTimeout(() => setShareToast(false), 2000)
  }

  const saveSettings = () => {
    setProvider(tempProvider); setApiKey(tempKey)
    localStorage.setItem('trip_provider', tempProvider)
    localStorage.setItem('trip_api_key', tempKey)
    setShowSettings(false)
  }

  const toggleCheck = (key) => {
    const next = { ...checked, [key]: !checked[key] }
    setChecked(next)
    localStorage.setItem(`checked-${id}`, JSON.stringify(next))
  }

  const saveNote = (key, val) => {
    const next = { ...noteMap, [key]: val }
    setNoteMap(next)
    localStorage.setItem(`notes-${id}`, JSON.stringify(next))
  }

  const S = {
    app:      { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', minHeight: '100vh', background: '#f1f5f9' },
    center:   { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px' },
    label:    { fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px', display: 'block' },
    input:    { width: '100%', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '10px 14px', fontSize: '14px', outline: 'none', marginBottom: '14px', boxSizing: 'border-box', fontFamily: 'inherit', color: '#1e293b' },
    textarea: { width: '100%', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px', fontSize: '14px', outline: 'none', resize: 'vertical', minHeight: '180px', lineHeight: '1.7', fontFamily: 'inherit', boxSizing: 'border-box', color: '#1e293b' },
    btn:      { width: '100%', background: '#1e293b', color: 'white', border: 'none', borderRadius: '12px', padding: '14px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' },
    btnGhost: { background: 'none', border: '1.5px solid #e2e8f0', color: '#64748b', borderRadius: '10px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer' },
    error:    { background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', marginTop: '10px' },
  }

  /* ── SETTINGS MODAL ── */
  const SettingsModal = () => (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) setShowSettings(false) }}
    >
      <div style={{ background: 'white', borderRadius: '20px 20px 0 0', padding: '24px 20px 36px', width: '100%', maxWidth: '500px' }}>
        <div style={{ width: '40px', height: '4px', background: '#e2e8f0', borderRadius: '99px', margin: '0 auto 20px' }} />
        <div style={{ fontSize: '17px', fontWeight: '700', color: '#1e293b', marginBottom: '6px' }}>⚙️ ตั้งค่า AI</div>
        <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '18px' }}>
          Gemini Flash ใช้ได้ฟรี (shared key) · Claude / OpenAI ต้องใส่ key เอง
        </div>

        <label style={S.label}>เลือก AI</label>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {PROVIDERS.map(p => (
            <button key={p.id} onClick={() => { setTempProvider(p.id); setTempKey('') }}
              style={{ flex: 1, padding: '10px 8px', borderRadius: '10px', border: `2px solid ${tempProvider === p.id ? '#1e293b' : '#e2e8f0'}`, background: tempProvider === p.id ? '#1e293b' : 'white', color: tempProvider === p.id ? 'white' : '#64748b', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
              <div style={{ fontSize: '18px', marginBottom: '2px' }}>{p.logo}</div>
              {p.name}
              {p.free && <div style={{ fontSize: '10px', color: tempProvider === p.id ? '#86efac' : '#16a34a', marginTop: '2px' }}>ฟรี</div>}
            </button>
          ))}
        </div>

        {tempProvider !== 'gemini' && (() => {
          const tp = PROVIDERS.find(p => p.id === tempProvider)
          return (
            <>
              <label style={S.label}>{tp.name} API Key</label>
              <input style={S.input} type="password" placeholder={tp.placeholder}
                value={tempKey} onChange={e => setTempKey(e.target.value)} />
              <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '16px', marginTop: '-8px' }}>
                ขอ key ได้ที่{' '}
                <a href={tp.hintUrl} target="_blank" rel="noreferrer" style={{ color: '#3b82f6' }}>{tp.hintUrl.replace('https://', '')}</a>
              </p>
            </>
          )
        })()}

        <button
          style={{ ...S.btn, opacity: (tempProvider === 'gemini' || tempKey) ? 1 : 0.4 }}
          disabled={tempProvider !== 'gemini' && !tempKey}
          onClick={saveSettings}
        >
          บันทึก
        </button>
      </div>
    </div>
  )

  /* ── LOADING ── */
  if (step === 'loading') return (
    <div style={S.app}>
      <div style={S.center}>
        <div style={{ fontSize: '48px', display: 'inline-block', animation: 'float 1.5s ease-in-out infinite' }}>✈️</div>
        <style>{`@keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }`}</style>
      </div>
    </div>
  )

  /* ── GENERATING ── */
  if (step === 'generating') return (
    <div style={S.app}>
      <div style={S.center}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '52px', marginBottom: '16px', display: 'inline-block', animation: 'float 1.5s ease-in-out infinite' }}>✈️</div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>AI กำลังจัด plan ให้...</div>
          <div style={{ fontSize: '14px', color: '#64748b', marginTop: '8px' }}>ใช้เวลาประมาณ 15–20 วินาที</div>
          <div style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'white', borderRadius: '99px', padding: '6px 14px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <span>{prov.logo}</span>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>{prov.name} · {prov.model}</span>
          </div>
        </div>
      </div>
      <style>{`@keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }`}</style>
    </div>
  )

  /* ── DRAFT ── */
  if (step === 'draft') return (
    <div style={S.app}>
      {showSettings && <SettingsModal />}
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={() => router.push('/trips')} style={{ ...S.btnGhost, padding: '6px 10px' }}>← Trips</button>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>✈️ Trip Planner</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {saving && <span style={{ fontSize: '11px', color: '#94a3b8' }}>กำลังบันทึก...</span>}
            {plan && <button style={S.btnGhost} onClick={() => setStep('plan')}>ดู Plan</button>}
            <button
              onClick={() => { setTempProvider(provider); setTempKey(apiKey); setShowSettings(true) }}
              style={{ background: provider === 'gemini' ? '#f0fdf4' : '#fff7ed', border: `1.5px solid ${provider === 'gemini' ? '#86efac' : '#fed7aa'}`, color: provider === 'gemini' ? '#15803d' : '#c2410c', borderRadius: '10px', padding: '7px 12px', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}
            >
              {prov.logo} {prov.name} {provider !== 'gemini' && (apiKey ? '✓' : '!')}
            </button>
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '12px' }}>
          <label style={S.label}>ปลายทาง</label>
          <input style={S.input} placeholder="เช่น คิวชู ญี่ปุ่น" value={destination}
            onChange={e => { setDest(e.target.value); autoSaveDraft(e.target.value, dates, notes) }} />

          <label style={S.label}>ช่วงเวลา</label>
          <input style={S.input} placeholder="เช่น 1-7 เมษายน 2568 (7 วัน)" value={dates}
            onChange={e => { setDates(e.target.value); autoSaveDraft(destination, e.target.value, notes) }} />

          <label style={S.label}>Note / ไอเดียทั้งหมด</label>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>
            พิมพ์ทุกอย่างที่รู้ ไม่ต้องเป็นระเบียบ — ร้านอาหาร, สถานที่, YouTube link, คำแนะนำจากเพื่อน
          </div>
          <textarea style={S.textarea} value={notes}
            placeholder={'ตัวอย่าง:\n- อยากไป Yufuin\n- ต้องลอง ramen ที่ Fukuoka\n- Takachiho Gorge สวยมาก'}
            onChange={e => { setNotes(e.target.value); autoSaveDraft(destination, dates, e.target.value) }} />
        </div>

        {error && <div style={S.error}>⚠️ {error}</div>}

        <button
          style={{ ...S.btn, opacity: (destination && dates && notes) ? 1 : 0.5, marginTop: '4px' }}
          disabled={!destination || !dates || !notes}
          onClick={generate}
        >
          ✨ ให้ AI จัด Plan ให้
        </button>
        <div style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', marginTop: '8px' }}>
          {provider === 'gemini' ? '🔵 ใช้ Gemini Flash (ฟรี)' : `${prov.logo} ใช้ ${prov.name} API ของคุณ`}
        </div>
      </div>
    </div>
  )

  /* ── PLAN ── */
  if (step === 'plan' && plan) {
    const day   = plan.days[activeDay]
    const col   = COLORS[activeDay % COLORS.length]
    const light = LIGHT[activeDay % LIGHT.length]
    const total = plan.days.reduce((s, d) => s + d.events.length, 0)
    const done  = Object.values(checked).filter(Boolean).length

    return (
      <div style={S.app}>
        {showSettings && <SettingsModal />}

        {/* Edit notification */}
        {editNotif && (
          <div style={{ position: 'fixed', top: '16px', left: '50%', transform: 'translateX(-50%)', background: '#1e293b', color: 'white', padding: '8px 18px', borderRadius: '99px', fontSize: '13px', zIndex: 1000, boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
            {editNotif}
          </div>
        )}

        {/* Share toast */}
        {shareToast && (
          <div style={{ position: 'fixed', top: '16px', left: '50%', transform: 'translateX(-50%)', background: '#16a34a', color: 'white', padding: '8px 18px', borderRadius: '99px', fontSize: '13px', zIndex: 1000 }}>
            ✅ คัดลอก link แล้ว!
          </div>
        )}

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg,#1e293b,#334155)', color: 'white', padding: '16px', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <button onClick={() => router.push('/trips')}
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: '8px', padding: '5px 10px', cursor: 'pointer', fontSize: '13px' }}>
              ← Trips
            </button>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={copyShareLink}
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: '8px', padding: '5px 10px', cursor: 'pointer', fontSize: '13px' }}>
                🔗 แชร์
              </button>
              <button onClick={() => { setTempProvider(provider); setTempKey(apiKey); setShowSettings(true) }}
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: '8px', padding: '5px 9px', cursor: 'pointer', fontSize: '15px' }}>
                ⚙️
              </button>
            </div>
          </div>
          <div style={{ textAlign: 'center', marginTop: '10px' }}>
            <div style={{ fontSize: '19px', fontWeight: '700' }}>{plan.tripTitle}</div>
            <div style={{ fontSize: '12px', opacity: 0.65, marginTop: '4px' }}>{done}/{total} กิจกรรม</div>
            <div style={{ margin: '10px auto 0', maxWidth: '200px', height: '5px', background: 'rgba(255,255,255,0.2)', borderRadius: '99px', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: '#4ade80', width: (done / total * 100) + '%', transition: 'width .4s', borderRadius: '99px' }} />
            </div>
          </div>
        </div>

        {/* Day Tabs */}
        <div style={{ display: 'flex', gap: '8px', padding: '10px 12px', overflowX: 'auto', background: 'white', borderBottom: '1px solid #e2e8f0' }}>
          {plan.days.map((d, i) => (
            <button key={i} onClick={() => setActiveDay(i)}
              style={{ flexShrink: 0, padding: '7px 13px', borderRadius: '12px', border: '2px solid ' + (i === activeDay ? COLORS[i % 7] : 'transparent'), background: i === activeDay ? COLORS[i % 7] : '#f8fafc', color: i === activeDay ? 'white' : '#64748b', cursor: 'pointer', textAlign: 'center', fontSize: '11px', fontWeight: '600', transition: 'all .2s' }}>
              <div style={{ fontSize: '17px' }}>{d.emoji || '📍'}</div>
              <div>วัน {d.day}</div>
              <div style={{ fontSize: '10px', opacity: .8 }}>{d.date}</div>
            </button>
          ))}
        </div>

        {/* Timeline */}
        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '12px' }}>
          <div style={{ borderRadius: '16px', overflow: 'hidden', border: '2px solid ' + col, background: light }}>
            <div style={{ background: col, padding: '14px 16px', color: 'white' }}>
              <div style={{ fontSize: '17px', fontWeight: '700' }}>{day.emoji || '📍'} {day.title}</div>
              {day.hotel && <div style={{ fontSize: '12px', opacity: .9, marginTop: '3px' }}>🏨 {day.hotel}</div>}
            </div>
            <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {day.events.map((ev, ei) => {
                const key = activeDay + '-' + ei
                const isDone = checked[key]
                const noteOpen = showNote[key]
                return (
                  <div key={ei} style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', opacity: isDone ? .5 : 1 }}>
                    <div onClick={() => toggleCheck(key)}
                      style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '11px', cursor: 'pointer' }}>
                      <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace', width: '34px', flexShrink: 0, paddingTop: '3px' }}>{ev.time}</div>
                      <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: isDone ? '#dcfce7' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', flexShrink: 0 }}>
                        {isDone ? '✅' : ev.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b', textDecoration: isDone ? 'line-through' : 'none' }}>{ev.title}</div>
                        {ev.detail && <div style={{ fontSize: '12px', color: ev.warning ? '#d97706' : '#64748b', marginTop: '2px' }}>{ev.detail}</div>}
                        <span style={{ display: 'inline-block', marginTop: '4px', fontSize: '10px', padding: '2px 8px', borderRadius: '99px', background: light, color: col, fontWeight: '600' }}>{ev.type}</span>
                      </div>
                      <button onClick={e => { e.stopPropagation(); setShowNote(p => ({ ...p, [key]: !noteOpen })) }}
                        style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', opacity: noteMap[key] ? 1 : 0.4, flexShrink: 0 }}
                        title="เพิ่ม note">📝</button>
                    </div>
                    {noteOpen && (
                      <div style={{ borderTop: '1px solid #f1f5f9', padding: '8px 12px 10px' }}>
                        <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600', marginBottom: '5px' }}>📝 Note</div>
                        <textarea
                          style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: '8px', padding: '7px 10px', fontSize: '13px', resize: 'none', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', color: '#1e293b' }}
                          rows={2} placeholder="เพิ่ม note ที่นี่..."
                          value={noteMap[key] || ''}
                          onClick={e => e.stopPropagation()}
                          onChange={e => saveNote(key, e.target.value)} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button style={{ ...S.btnGhost, flex: 1 }} onClick={() => setStep('draft')}>← แก้ Notes</button>
            <button style={{ ...S.btn, flex: 2 }} onClick={() => { setStep('draft'); setPlan(null); fetch(`/api/trips/${id}`, { method: 'PATCH', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ plan_json: null }) }) }}>
              ✨ Generate ใหม่
            </button>
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center', marginTop: '10px' }}>
            แตะกิจกรรมเพื่อติ๊ก ✅ · กด 📝 เพื่อเพิ่ม note · กด 🔗 เพื่อแชร์
          </div>
        </div>
      </div>
    )
  }

  return null
}
