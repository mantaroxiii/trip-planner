import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

export default function Login() {
  const router = useRouter()
  const [tab, setTab] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/trips')
    })
  }, [])

  const handleEmail = async (e) => {
    e.preventDefault()
    setLoading(true); setError(''); setMsg('')
    try {
      if (tab === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.replace('/trips')
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
      options: { redirectTo: `${window.location.origin}/trips` },
    })
    if (error) setError(error.message)
  }

  const S = {
    app: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', minHeight: '100vh', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' },
    card: { background: 'white', borderRadius: '20px', padding: '32px 28px', maxWidth: '400px', width: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' },
    h1: { fontSize: '24px', fontWeight: '700', color: '#1e293b', marginBottom: '6px', textAlign: 'center' },
    sub: { fontSize: '14px', color: '#64748b', textAlign: 'center', marginBottom: '28px' },
    tabs: { display: 'flex', gap: '4px', background: '#f1f5f9', borderRadius: '10px', padding: '4px', marginBottom: '24px' },
    label: { fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px', display: 'block' },
    input: { width: '100%', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '10px 14px', fontSize: '14px', outline: 'none', marginBottom: '12px', boxSizing: 'border-box', fontFamily: 'inherit', color: '#1e293b' },
    btn: { width: '100%', background: '#1e293b', color: 'white', border: 'none', borderRadius: '12px', padding: '13px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' },
    divider: { display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 0', color: '#94a3b8', fontSize: '13px' },
    googleBtn: { width: '100%', background: 'white', border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '12px', fontSize: '14px', fontWeight: '600', color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
    error: { background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', marginBottom: '12px' },
    success: { background: '#f0fdf4', border: '1px solid #86efac', color: '#15803d', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', marginBottom: '12px' },
  }

  const tabStyle = (active) => ({
    flex: 1, padding: '8px', borderRadius: '8px', border: 'none',
    background: active ? 'white' : 'transparent',
    color: active ? '#1e293b' : '#64748b',
    fontSize: '14px', fontWeight: active ? '600' : '400', cursor: 'pointer',
    boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
  })

  return (
    <div style={S.app}>
      <div style={S.card}>
        <div style={{ fontSize: '40px', textAlign: 'center', marginBottom: '8px' }}>✈️</div>
        <div style={S.h1}>Trip Planner</div>
        <div style={S.sub}>AI จัด itinerary จาก notes ของคุณ</div>

        <div style={S.tabs}>
          <button style={tabStyle(tab === 'login')} onClick={() => { setTab('login'); setError(''); setMsg('') }}>เข้าสู่ระบบ</button>
          <button style={tabStyle(tab === 'signup')} onClick={() => { setTab('signup'); setError(''); setMsg('') }}>สมัครสมาชิก</button>
        </div>

        {error && <div style={S.error}>⚠️ {error}</div>}
        {msg && <div style={S.success}>✅ {msg}</div>}

        <form onSubmit={handleEmail}>
          <label style={S.label}>Email</label>
          <input style={S.input} type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
          <label style={S.label}>Password</label>
          <input style={S.input} type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
          <button type="submit" style={{ ...S.btn, opacity: loading ? 0.6 : 1 }} disabled={loading}>
            {loading ? '...' : tab === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
          </button>
        </form>

        <div style={S.divider}>
          <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
          <span>หรือ</span>
          <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
        </div>

        <button style={S.googleBtn} onClick={handleGoogle}>
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          เข้าสู่ระบบด้วย Google
        </button>
      </div>
    </div>
  )
}
