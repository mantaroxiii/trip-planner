import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

export default function Login() {
  const router = useRouter()
  const [tab, setTab] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [guestLoading, setGuestLoading] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  const next = router.query.next || '/trips'
  const isSharedLink = router.query.next?.startsWith('/trip/')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace(next)
    })
  }, [])

  const handleEmail = async (e) => {
    e.preventDefault()
    setLoading(true); setError(''); setMsg('')
    try {
      if (tab === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.replace(next)
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMsg('ส่ง confirmation email แล้ว! เช็ค inbox ของคุณ')
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${next}` },
    })
    if (error) setError(error.message)
  }

  const handleGuest = async () => {
    setGuestLoading(true); setError('')
    try {
      const { error } = await supabase.auth.signInAnonymously()
      if (error) throw error
      router.replace(next)
    } catch (e) {
      setError(e.message)
    } finally {
      setGuestLoading(false)
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; }
        .login-input {
          width: 100%; border: 1.5px solid rgba(14,165,233,0.2); border-radius: 12px;
          padding: 11px 14px; font-size: 14px; outline: none; background: rgba(255,255,255,0.7);
          font-family: inherit; color: #0C4A6E; transition: border-color 0.2s;
          backdrop-filter: blur(4px);
        }
        .login-input:focus { border-color: #0EA5E9; }
        .login-input::placeholder { color: #93c5fd; }
        .tab-btn { flex: 1; padding: 9px; border-radius: 10px; border: none; cursor: pointer; font-size: 14px; font-family: inherit; font-weight: 500; transition: all 0.2s; }
        .tab-active { background: white; color: #0C4A6E; font-weight: 700; box-shadow: 0 1px 4px rgba(14,165,233,0.15); }
        .tab-inactive { background: transparent; color: #7dd3fc; }
        .btn-primary { width: 100%; background: linear-gradient(135deg, #0EA5E9, #38BDF8); color: white; border: none; border-radius: 12px; padding: 13px; font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit; transition: all 0.2s; }
        .btn-primary:hover:not(:disabled) { background: linear-gradient(135deg, #0284C7, #0EA5E9); transform: translateY(-1px); box-shadow: 0 4px 16px rgba(14,165,233,0.35); }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .btn-google { width: 100%; background: rgba(255,255,255,0.9); border: 1.5px solid rgba(14,165,233,0.2); border-radius: 12px; padding: 12px; font-size: 14px; font-weight: 600; color: #0C4A6E; cursor: pointer; font-family: inherit; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s; }
        .btn-google:hover { background: white; border-color: #0EA5E9; box-shadow: 0 2px 8px rgba(14,165,233,0.15); }
        .btn-guest { width: 100%; background: linear-gradient(135deg, #F97316, #FB923C); color: white; border: none; border-radius: 12px; padding: 13px; font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .btn-guest:hover:not(:disabled) { background: linear-gradient(135deg, #EA580C, #F97316); transform: translateY(-1px); box-shadow: 0 4px 16px rgba(249,115,22,0.35); }
        .btn-guest:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .divider { display: flex; align-items: center; gap: 12px; margin: 14px 0; color: #7dd3fc; font-size: 13px; }
        .divider-line { flex: 1; height: 1px; background: rgba(14,165,233,0.15); }
        .error-box { background: rgba(254,226,226,0.9); border: 1px solid #fca5a5; color: #b91c1c; padding: 10px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 12px; }
        .success-box { background: rgba(240,253,244,0.9); border: 1px solid #86efac; color: #15803d; padding: 10px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 12px; }
        .guest-hint { font-size: 12px; color: #7dd3fc; text-align: center; margin-top: 10px; line-height: 1.5; }
      `}</style>

      <div style={{
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #F0F9FF 0%, #E0F2FE 50%, #BAE6FD 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Background blobs */}
        <div style={{ position: 'absolute', top: '-80px', right: '-60px', width: '300px', height: '300px', borderRadius: '50%', background: 'rgba(14,165,233,0.15)', filter: 'blur(60px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-60px', left: '-40px', width: '250px', height: '250px', borderRadius: '50%', background: 'rgba(249,115,22,0.1)', filter: 'blur(60px)', pointerEvents: 'none' }} />

        <div style={{
          background: 'rgba(255,255,255,0.6)',
          backdropFilter: 'blur(20px)',
          border: '1.5px solid rgba(255,255,255,0.8)',
          borderRadius: '24px', padding: '36px 32px',
          maxWidth: '420px', width: '100%',
          boxShadow: '0 8px 40px rgba(14,165,233,0.12)',
        }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{ fontSize: '44px', marginBottom: '10px' }}>✈️</div>
            <div style={{ fontSize: '26px', fontWeight: '800', color: '#0C4A6E', letterSpacing: '-0.5px' }}>Trip Planner</div>
            <div style={{ fontSize: '14px', color: '#38BDF8', marginTop: '5px', fontWeight: '500' }}>
              {isSharedLink ? 'มีคนแชร์ Trip ให้คุณ 🎉' : 'AI จัด itinerary จาก notes ของคุณ'}
            </div>
          </div>

          {/* Guest mode banner (shown only when coming from share link) */}
          {isSharedLink && (
            <>
              <button className="btn-guest" onClick={handleGuest} disabled={guestLoading}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                {guestLoading ? 'กำลังเข้าสู่ระบบ...' : 'ดูเฉพาะ (ไม่ต้องสมัคร)'}
              </button>
              <div className="guest-hint">เข้าดูได้เลย ไม่ต้องมี account · แก้ไขไม่ได้</div>
              <div className="divider">
                <div className="divider-line" />
                <span>หรือ login เพื่อแก้ไขร่วมกัน</span>
                <div className="divider-line" />
              </div>
            </>
          )}

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '4px', background: 'rgba(14,165,233,0.08)', borderRadius: '12px', padding: '4px', marginBottom: '20px' }}>
            <button className={`tab-btn ${tab === 'login' ? 'tab-active' : 'tab-inactive'}`} onClick={() => { setTab('login'); setError(''); setMsg('') }}>เข้าสู่ระบบ</button>
            <button className={`tab-btn ${tab === 'signup' ? 'tab-active' : 'tab-inactive'}`} onClick={() => { setTab('signup'); setError(''); setMsg('') }}>สมัครสมาชิก</button>
          </div>

          {error && <div className="error-box">⚠️ {error}</div>}
          {msg && <div className="success-box">✅ {msg}</div>}

          <form onSubmit={handleEmail} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#0C4A6E', display: 'block', marginBottom: '6px' }}>Email</label>
              <input className="login-input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#0C4A6E', display: 'block', marginBottom: '6px' }}>Password</label>
              <input className="login-input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '4px' }}>
              {loading ? '...' : tab === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
            </button>
          </form>

          <div className="divider">
            <div className="divider-line" />
            <span>หรือ</span>
            <div className="divider-line" />
          </div>
          <button className="btn-google" onClick={handleGoogle}>
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            เข้าสู่ระบบด้วย Google
          </button>
        </div>
      </div>
    </>
  )
}
