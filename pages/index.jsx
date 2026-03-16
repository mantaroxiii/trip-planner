import { useState, useEffect } from 'react';

const COLORS    = ['#f472b6','#60a5fa','#fb923c','#f87171','#2dd4bf','#c084fc','#94a3b8'];
const LIGHT     = ['#fce7f3','#dbeafe','#ffedd5','#fee2e2','#ccfbf1','#f3e8ff','#f1f5f9'];

export default function App() {
  const [step, setStep]           = useState('key');
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

  useEffect(() => {
    const k = localStorage.getItem('trip_api_key');
    if (k) { setApiKey(k); setStep('draft'); }
    const d = localStorage.getItem('trip_draft');
    if (d) { const p = JSON.parse(d); setDest(p.dest||''); setDates(p.dates||''); setNotes(p.notes||''); }
    const pl = localStorage.getItem('trip_plan');
    if (pl) { setPlan(JSON.parse(pl)); setStep('plan'); }
    const c = localStorage.getItem('trip_checked');
    if (c) setChecked(JSON.parse(c));
    const n = localStorage.getItem('trip_notes');
    if (n) setNoteMap(JSON.parse(n));
  }, []);

  const saveDraft = (d, dt, n) =>
    localStorage.setItem('trip_draft', JSON.stringify({ dest: d, dates: dt, notes: n }));

  const generate = async () => {
    setStep('loading'); setError('');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, destination, dates, notes }),
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
    hint:     { background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '12px 14px', fontSize: '13px', color: '#166534', marginBottom: '16px', lineHeight: '1.6' },
    error:    { background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', marginTop: '10px' },
  };

  if (step === 'key') return (
    <div style={S.app}><div style={S.center}><div style={S.card}>
      <div style={{ fontSize: '44px', marginBottom: '14px' }}>✈️</div>
      <div style={S.h1}>AI Trip Planner</div>
      <p style={S.muted}>dump note คร่าวๆ แล้วให้ AI จัด plan ให้เป็นระเบียบ</p>
      <div style={S.hint}>🔑 ใส่ Claude API Key ของคุณเพื่อเริ่มใช้งาน<br/>Key จะถูกเก็บไว้ใน browser ของคุณเท่านั้น</div>
      <label style={S.label}>Claude API Key</label>
      <input style={S.input} type="password" placeholder="sk-ant-api03-..."
        value={apiKey} onChange={e => setApiKey(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && apiKey && (localStorage.setItem('trip_api_key', apiKey), setStep('draft'))}/>
      <button style={{ ...S.btn, opacity: apiKey ? 1 : 0.5 }} disabled={!apiKey}
        onClick={() => { localStorage.setItem('trip_api_key', apiKey); setStep('draft'); }}>เริ่มใช้งาน →</button>
      <p style={{ textAlign: 'center', fontSize: '12px', color: '#94a3b8', marginTop: '14px' }}>
        ขอ key ได้ที่ <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" style={{ color: '#3b82f6' }}>console.anthropic.com</a>
      </p>
    </div></div></div>
  );

  if (step === 'loading') return (
    <div style={S.app}><div style={S.center}><div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '52px', marginBottom: '16px', display: 'inline-block', animation: 'float 1.5s ease-in-out infinite' }}>✈️</div>
      <div style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>AI กำลังจัด plan ให้...</div>
      <div style={{ fontSize: '14px', color: '#64748b', marginTop: '8px' }}>ใช้เวลาประมาณ 15-20 วินาที</div>
    </div></div>
    <style>{`@keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }`}</style>
    </div>
  );

  if (step === 'draft') return (
    <div style={S.app}><div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b' }}>✈️ Trip Planner</div>
          <div style={{ fontSize: '13px', color: '#64748b' }}>dump ทุกอย่างที่รู้เกี่ยวกับ trip ไว้ได้เลย</div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {plan && <button style={S.btnGhost} onClick={() => setStep('plan')}>ดู Plan</button>}
          <button style={S.btnGhost} onClick={() => { localStorage.removeItem('trip_api_key'); setStep('key'); }}>🔑 เปลี่ยน Key</button>
        </div>
      </div>
      <div style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '12px' }}>
        <label style={S.label}>ปลายทาง</label>
        <input style={S.input} placeholder="เช่น คิวชู ญี่ปุ่น" value={destination}
          onChange={e => { setDest(e.target.value); saveDraft(e.target.value, dates, notes); }}/>
        <label style={S.label}>ช่วงเวลา</label>
        <input style={S.input} placeholder="เช่น 1-7 เมษายน 2568 (7 วัน)" value={dates}
          onChange={e => { setDates(e.target.value); saveDraft(destination, e.target.value, notes); }}/>
        <label style={S.label}>Note / ไอเดียทั้งหมด</label>
        <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>พิมพ์ทุกอย่างที่รู้ ไม่ต้องเป็นระเบียบ — ร้านอาหาร, สถานที่, YouTube link, คำแนะนำจากเพื่อน</div>
        <textarea style={S.textarea} value={notes}
          placeholder={"ตัวอย่าง:\n- อยากไป Yufuin\n- ต้องลอง ramen ที่ Fukuoka\n- Takachiho Gorge สวยมาก"}
          onChange={e => { setNotes(e.target.value); saveDraft(destination, dates, e.target.value); }}/>
      </div>
      {error && <div style={S.error}>⚠️ {error}</div>}
      <button style={{ ...S.btn, opacity: (destination && dates && notes) ? 1 : 0.5, marginTop: '4px' }}
        disabled={!destination || !dates || !notes} onClick={generate}>✨ ให้ AI จัด Plan ให้</button>
      <div style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', marginTop: '8px' }}>ใช้ Claude API ของคุณ ประมาณ $0.01 ต่อการ generate 1 ครั้ง</div>
    </div></div>
  );

  if (step === 'plan' && plan) {
    const day   = plan.days[activeDay];
    const col   = COLORS[activeDay % COLORS.length];
    const light = LIGHT[activeDay % LIGHT.length];
    const total = plan.days.reduce((s, d) => s + d.events.length, 0);
    const done  = Object.values(checked).filter(Boolean).length;
    return (
      <div style={S.app}>
        <div style={{ background: 'linear-gradient(135deg,#1e293b,#334155)', color: 'white', padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '19px', fontWeight: '700' }}>{plan.tripTitle}</div>
          <div style={{ fontSize: '12px', opacity: 0.65, marginTop: '4px' }}>{done}/{total} กิจกรรม</div>
          <div style={{ margin: '10px auto 0', maxWidth: '200px', height: '5px', background: 'rgba(255,255,255,0.2)', borderRadius: '99px', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: '#4ade80', width: (done/total*100)+'%', transition: 'width .4s', borderRadius: '99px' }}/>
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
                    <div onClick={() => toggleCheck(key)} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '11px', cursor: 'pointer' }}>
                      <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace', width: '34px', flexShrink: 0, paddingTop: '3px' }}>{ev.time}</div>
                      <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: isDone ? '#dcfce7' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', flexShrink: 0 }}>{isDone ? '✅' : ev.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b', textDecoration: isDone ? 'line-through' : 'none' }}>{ev.title}</div>
                        {ev.detail && <div style={{ fontSize: '12px', color: ev.warning ? '#d97706' : '#64748b', marginTop: '2px' }}>{ev.detail}</div>}
                        <span style={{ display: 'inline-block', marginTop: '4px', fontSize: '10px', padding: '2px 8px', borderRadius: '99px', background: light, color: col, fontWeight: '600' }}>{ev.type}</span>
                      </div>
                      <button onClick={e => { e.stopPropagation(); setShowNote(p => ({ ...p, [key]: !noteOpen })); }}
                        style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', opacity: noteMap[key] ? 1 : 0.4, flexShrink: 0 }}>📝</button>
                    </div>
                    {noteOpen && (
                      <div style={{ borderTop: '1px solid #f1f5f9', padding: '8px 12px 10px' }}>
                        <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600', marginBottom: '5px' }}>📝 Note</div>
                        <textarea style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: '8px', padding: '7px 10px', fontSize: '13px', resize: 'none', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', color: '#1e293b' }}
                          rows={2} placeholder="เพิ่ม note ที่นี่..." value={noteMap[key] || ''}
                          onClick={e => e.stopPropagation()} onChange={e => saveNote(key, e.target.value)}/>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button style={{ ...S.btnGhost, flex: 1 }} onClick={() => setStep('draft')}>← แก้ Notes</button>
            <button style={{ ...S.btn, flex: 2 }} onClick={() => { setStep('draft'); setPlan(null); localStorage.removeItem('trip_plan'); }}>✨ Generate ใหม่</button>
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center', marginTop: '10px' }}>แตะกิจกรรมเพื่อติ๊ก ✅ · กด 📝 เพื่อเพิ่ม note</div>
        </div>
      </div>
    );
  }
  return null;
}
