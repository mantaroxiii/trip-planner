import { useState, useEffect } from 'react';

const COLORS = ['#f472b6','#60a5fa','#fb923c','#f87171','#2dd4bf','#c084fc','#94a3b8'];
const LIGHT  = ['#fce7f3','#dbeafe','#ffedd5','#fee2e2','#ccfbf1','#f3e8ff','#f1f5f9'];

const PROVIDERS = [
  {
    id: 'claude',
    name: 'Claude',
    logo: '🟠',
    placeholder: 'sk-ant-api03-...',
    hint: 'console.anthropic.com',
    hintUrl: 'https://console.anthropic.com',
    model: 'claude-sonnet-4-6',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    logo: '⚫',
    placeholder: 'sk-proj-...',
    hint: 'platform.openai.com/api-keys',
    hintUrl: 'https://platform.openai.com/api-keys',
    model: 'gpt-4o',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    logo: '🔵',
    placeholder: 'AIzaSy...',
    hint: 'aistudio.google.com/apikey',
    hintUrl: 'https://aistudio.google.com/apikey',
    model: 'gemini-1.5-flash',
  },
];

export default function App() {
  const [step, setStep]           = useState('draft');
  const [provider, setProvider]   = useState('claude');
  const [apiKey, setApiKey]       = useState('');
  const [destination, setDest]    = useState('');
  const [dates, setDates]         = useState('');
  const [notes, setNotes]         = useState('');
  const [plan, setPlan]           = useState(null);
  const [error, setError]         = useState('');
  const [activeDay, setActiveDay] = useState(0);
  const [checked, setChecked]     = useState({});
  const [noteMap, setNoteMap]     = useState({});
  const [showNote, setShowNote]   = useState({});
  const [showSettings, setShowSettings] = useState(false);
  const [tempKey, setTempKey]     = useState('');
  const [tempProvider, setTempProvider] = useState('claude');

  const prov = PROVIDERS.find(p => p.id === provider);

  useEffect(() => {
    const k  = localStorage.getItem('trip_api_key');
    const pr = localStorage.getItem('trip_provider');
    if (k)  { setApiKey(k); setTempKey(k); }
    if (pr) { setProvider(pr); setTempProvider(pr); }
    const d  = localStorage.getItem('trip_draft');
    if (d)  { const p = JSON.parse(d); setDest(p.dest||''); setDates(p.dates||''); setNotes(p.notes||''); }
    const pl = localStorage.getItem('trip_plan');
    if (pl) { setPlan(JSON.parse(pl)); setStep('plan'); }
    const c  = localStorage.getItem('trip_checked');
    if (c)  setChecked(JSON.parse(c));
    const n  = localStorage.getItem('trip_notes');
    if (n)  setNoteMap(JSON.parse(n));
  }, []);

  const saveDraft = (d, dt, n) =>
    localStorage.setItem('trip_draft', JSON.stringify({ dest: d, dates: dt, notes: n }));

  const saveSettings = () => {
    setApiKey(tempKey);
    setProvider(tempProvider);
    localStorage.setItem('trip_api_key', tempKey);
    localStorage.setItem('trip_provider', tempProvider);
    setShowSettings(false);
  };

  const generate = async () => {
    if (!apiKey) { setShowSettings(true); return; }
    setStep('loading'); setError('');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, provider, destination, dates, notes }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPlan(data); setActiveDay(0); setChecked({}); setNoteMap({});
      localStorage.setItem('trip_plan', JSON.stringify(data));
      localStorage.removeItem('trip_checked');
      localStorage.removeItem('trip_notes');
      setStep('plan');
    } catch (e) { setError(e.message); setStep('draft'); }
  };

  const toggleCheck = (key) => {
    const next = { ...checked, [key]: !checked[key] };
    setChecked(next);
    localStorage.setItem('trip_checked', JSON.stringify(next));
  };

  const saveNote = (key, val) => {
    const next = { ...noteMap, [key]: val };
    setNoteMap(next);
    localStorage.setItem('trip_notes', JSON.stringify(next));
  };

  const S = {
    app:      { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', minHeight: '100vh', background: '#f1f5f9' },
    center:   { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px' },
    card:     { background: 'white', borderRadius: '20px', padding: '28px', maxWidth: '460px', width: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' },
    h1:       { fontSize: '22px', fontWeight: '700', color: '#1e293b', marginBottom: '6px' },
    muted:    { fontSize: '14px', color: '#64748b', lineHeight: '1.6', marginBottom: '20px' },
    label:    { fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px', display: 'block' },
    input:    { width: '100%', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '10px 14px', fontSize: '14px', outline: 'none', marginBottom: '14px', boxSizing: 'border-box', fontFamily: 'inherit', color: '#1e293b' },
    textarea: { width: '100%', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px', fontSize: '14px', outline: 'none', resize: 'vertical', minHeight: '180px', lineHeight: '1.7', fontFamily: 'inherit', boxSizing: 'border-box', color: '#1e293b' },
    btn:      { width: '100%', background: '#1e293b', color: 'white', border: 'none', borderRadius: '12px', padding: '14px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' },
    btnGhost: { background: 'none', border: '1.5px solid #e2e8f0', color: '#64748b', borderRadius: '10px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer' },
    error:    { background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', marginTop: '10px' },
  };

  /* ── SETTINGS MODAL ── */
  const SettingsModal = () => (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) setShowSettings(false); }}>
      <div style={{ background: 'white', borderRadius: '20px 20px 0 0', padding: '24px 20px 36px', width: '100%', maxWidth: '500px', boxShadow: '0 -4px 24px rgba(0,0,0,0.12)' }}>
        <div style={{ width: '40px', height: '4px', background: '#e2e8f0', borderRadius: '99px', margin: '0 auto 20px' }} />
        <div style={{ fontSize: '17px', fontWeight: '700', color: '#1e293b', marginBottom: '18px' }}>⚙️ ตั้งค่า API</div>
        <label style={S.label}>เลือก AI</label>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {PROVIDERS.map(p => (
            <button key={p.id} onClick={() => { setTempProvider(p.id); setTempKey(''); }}
              style={{ flex: 1, padding: '10px 8px', borderRadius: '10px', border: `2px solid ${tempProvider === p.id ? '#1e293b' : '#e2e8f0'}`, background: tempProvider === p.id ? '#1e293b' : 'white', color: tempProvider === p.id ? 'white' : '#64748b', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
              <div style={{ fontSize: '18px', marginBottom: '2px' }}>{p.logo}</div>
              {p.name}
            </button>
          ))}
        </div>
        {(() => {
          const tp = PROVIDERS.find(p => p.id === tempProvider);
          return (
            <>
              <label style={S.label}>{tp.name} API Key</label>
              <input style={S.input} type="password" placeholder={tp.placeholder}
                value={tempKey} onChange={e => setTempKey(e.target.value)} />
              <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '16px', marginTop: '-8px' }}>
                ขอ key ได้ที่{' '}
                <a href={tp.hintUrl} target="_blank" rel="noreferrer" style={{ color: '#3b82f6' }}>{tp.hint}</a>
              </p>
            </>
          );
        })()}
        <button style={{ ...S.btn, opacity: tempKey ? 1 : 0.5 }} disabled={!tempKey} onClick={saveSettings}>
          บันทึก
        </button>
      </div>
    </div>
  );

  /* ── LOADING ── */
  if (step === 'loading') return (
    <div style={S.app}>
      <div style={S.center}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '52px', marginBottom: '16px', display: 'inline-block', animation: 'float 1.5s ease-in-out infinite' }}>✈️</div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>AI กำลังจัด plan ให้...</div>
          <div style={{ fontSize: '14px', color: '#64748b', marginTop: '8px' }}>ใช้เวลาประมาณ 15–20 วินาที</div>
          <div style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'white', borderRadius: '99px', padding: '6px 14px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <span style={{ fontSize: '14px' }}>{prov.logo}</span>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>{prov.name} · {prov.model}</span>
          </div>
        </div>
      </div>
      <style>{`@keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }`}</style>
    </div>
  );

  /* ── DRAFT ── */
  if (step === 'draft') return (
    <div style={S.app}>
      {showSettings && <SettingsModal />}
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b' }}>✈️ Trip Planner</div>
            {apiKey && (
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>{prov.logo}</span> {prov.name}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {plan && <button style={S.btnGhost} onClick={() => setStep('plan')}>ดู Plan</button>}
            <button
              title="ตั้งค่า API"
              onClick={() => { setTempKey(apiKey); setTempProvider(provider); setShowSettings(true); }}
              style={{ background: apiKey ? '#f0fdf4' : '#fff7ed', border: `1.5px solid ${apiKey ? '#86efac' : '#fed7aa'}`, color: apiKey ? '#15803d' : '#c2410c', borderRadius: '10px', padding: '8px 12px', fontSize: '13px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px' }}>
              ⚙️ {apiKey ? 'API ✓' : 'ตั้งค่า API'}
            </button>
          </div>
        </div>
        <div style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '12px' }}>
          <label style={S.label}>ปลายทาง</label>
          <input style={S.input} placeholder="เช่น คิวชู ญี่ปุ่น" value={destination}
            onChange={e => { setDest(e.target.value); saveDraft(e.target.value, dates, notes); }} />
          <label style={S.label}>ช่วงเวลา</label>
          <input style={S.input} placeholder="เช่น 1-7 เมษายน 2568 (7 วัน)" value={dates}
            onChange={e => { setDates(e.target.value); saveDraft(destination, e.target.value, notes); }} />
          <label style={S.label}>Note / ไอเดียทั้งหมด</label>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>
            พิมพ์ทุกอย่างที่รู้ ไม่ต้องเป็นระเบียบ — ร้านอาหาร, สถานที่, YouTube link, คำแนะนำจากเพื่อน
          </div>
          <textarea style={S.textarea} value={notes}
            placeholder={"ตัวอย่าง:\n- อยากไป Yufuin\n- ต้องลอง ramen ที่ Fukuoka\n- Takachiho Gorge สวยมาก"}
            onChange={e => { setNotes(e.target.value); saveDraft(destination, dates, e.target.value); }} />
        </div>
        {error && <div style={S.error}>⚠️ {error}</div>}
        <button style={{ ...S.btn, opacity: (destination && dates && notes) ? 1 : 0.5, marginTop: '4px' }}
          disabled={!destination || !dates || !notes} onClick={generate}>
          ✨ ให้ AI จัด Plan ให้
        </button>
        <div style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', marginTop: '8px' }}>
          {apiKey ? `${prov.logo} ใช้ ${prov.name} API ของคุณ · ประมาณ $0.01 ต่อครั้ง` : '⚙️ กด "ตั้งค่า API" ก่อนเพื่อใส่ API key'}
        </div>
      </div>
    </div>
  );

  /* ── PLAN ── */
  if (step === 'plan' && plan) {
    const day   = plan.days[activeDay];
    const col   = COLORS[activeDay % COLORS.length];
    const light = LIGHT[activeDay % LIGHT.length];
    const total = plan.days.reduce((s, d) => s + d.events.length, 0);
    const done  = Object.values(checked).filter(Boolean).length;
    return (
      <div style={S.app}>
        {showSettings && <SettingsModal />}
        <div style={{ background: 'linear-gradient(135deg,#1e293b,#334155)', color: 'white', padding: '16px', textAlign: 'center', position: 'relative' }}>
          <button onClick={() => { setTempKey(apiKey); setTempProvider(provider); setShowSettings(true); }}
            style={{ position: 'absolute', right: '14px', top: '14px', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: '8px', padding: '5px 9px', cursor: 'pointer', fontSize: '15px' }}>
            ⚙️
          </button>
          <div style={{ fontSize: '19px', fontWeight: '700' }}>{plan.tripTitle}</div>
          <div style={{ fontSize: '12px', opacity: 0.65, marginTop: '4px' }}>{done}/{total} กิจกรรม</div>
          <div style={{ margin: '10px auto 0', maxWidth: '200px', height: '5px', background: 'rgba(255,255,255,0.2)', borderRadius: '99px', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: '#4ade80', width: (done/total*100)+'%', transition: 'width .4s', borderRadius: '99px' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', padding: '10px 12px', overflowX: 'auto', background: 'white', borderBottom: '1px solid #e2e8f0' }}>
          {plan.days.map((d, i) => (
            <button key={i} onClick={() => setActiveDay(i)}
              style={{ flexShrink: 0, padding: '7px 13px', borderRadius: '12px', border: '2px solid '+(i===activeDay ? COLORS[i%7] : 'transparent'), background: i===activeDay ? COLORS[i%7] : '#f8fafc', color: i===activeDay ? 'white' : '#64748b', cursor: 'pointer', textAlign: 'center', fontSize: '11px', fontWeight: '600', transition: 'all .2s' }}>
              <div style={{ fontSize: '17px' }}>{d.emoji || '📍'}</div>
              <div>วัน {d.day}</div>
              <div style={{ fontSize: '10px', opacity: .8 }}>{d.date}</div>
            </button>
          ))}
        </div>
        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '12px' }}>
          <div style={{ borderRadius: '16px', overflow: 'hidden', border: '2px solid '+col, background: light }}>
            <div style={{ background: col, padding: '14px 16px', color: 'white' }}>
              <div style={{ fontSize: '17px', fontWeight: '700' }}>{day.emoji || '📍'} {day.title}</div>
              {day.hotel && <div style={{ fontSize: '12px', opacity: .9, marginTop: '3px' }}>🏨 {day.hotel}</div>}
            </div>
            <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {day.events.map((ev, ei) => {
                const key = activeDay+'-'+ei;
                const isDone = checked[key];
                const noteOpen = showNote[key];
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
                      <button onClick={e => { e.stopPropagation(); setShowNote(p => ({ ...p, [key]: !noteOpen })); }}
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
                );
              })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button style={{ ...S.btnGhost, flex: 1 }} onClick={() => setStep('draft')}>← แก้ Notes</button>
            <button style={{ ...S.btn, flex: 2 }} onClick={() => { setStep('draft'); setPlan(null); localStorage.removeItem('trip_plan'); }}>
              ✨ Generate ใหม่
            </button>
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center', marginTop: '10px' }}>
            แตะกิจกรรมเพื่อติ๊ก ✅ · กด 📝 เพื่อเพิ่ม note
          </div>
        </div>
      </div>
    );
  }

  return null;
}
