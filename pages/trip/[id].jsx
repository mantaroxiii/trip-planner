import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'

const COLORS = ['#0EA5E9', '#EC4899', '#8B5CF6', '#F59E0B', '#10B981', '#F43F5E', '#6366F1']
const LIGHT = ['#E0F2FE', '#EDE9FE', '#FFF7ED', '#D1FAE5', '#FCE7F3', '#FEF3C7', '#EEF2FF']

// Shared helper: parse trip date strings (Thai, English, ISO)
const parseTripDate = (dateStr) => {
  if (!dateStr) return null
  const now = new Date()
  const thaiMonths = { 'ม.ค.': 0, 'ก.พ.': 1, 'มี.ค.': 2, 'เม.ย.': 3, 'พ.ค.': 4, 'มิ.ย.': 5, 'ก.ค.': 6, 'ส.ค.': 7, 'ก.ย.': 8, 'ต.ค.': 9, 'พ.ย.': 10, 'ธ.ค.': 11 }
  const thaiMonthsFull = { 'มกราคม': 0, 'กุมภาพันธ์': 1, 'มีนาคม': 2, 'เมษายน': 3, 'พฤษภาคม': 4, 'มิถุนายน': 5, 'กรกฎาคม': 6, 'สิงหาคม': 7, 'กันยายน': 8, 'ตุลาคม': 9, 'พฤศจิกายน': 10, 'ธันวาคม': 11 }
  const enMonths = { 'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5, 'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11 }
  const iso = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return new Date(iso[1], iso[2] - 1, iso[3])
  for (const [th, mm] of Object.entries(thaiMonthsFull)) {
    if (dateStr.includes(th)) { const d = dateStr.match(/(\d{1,2})/); if (d) return new Date(now.getFullYear(), mm, parseInt(d[1])) }
  }
  for (const [th, mm] of Object.entries(thaiMonths)) {
    if (dateStr.includes(th)) { const d = dateStr.match(/(\d{1,2})/); if (d) return new Date(now.getFullYear(), mm, parseInt(d[1])) }
  }
  for (const [en, mm] of Object.entries(enMonths)) {
    if (dateStr.toLowerCase().includes(en)) { const d = dateStr.match(/(\d{1,2})/); if (d) return new Date(now.getFullYear(), mm, parseInt(d[1])) }
  }
  return null
}

// Shared helper: find weather for a specific day
const getWeatherForDay = (weatherData, dayDate) => {
  if (!weatherData?.weather || !dayDate) return null
  const d = parseTripDate(dayDate)
  if (!d) return null
  // Use local date to avoid UTC offset shifting the day
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const localDate = `${yyyy}-${mm}-${dd}`
  return weatherData.weather.find(w => w.date === localDate)
}

const PROVIDERS = [
  { id: 'gemini', name: 'Gemini 2.5 Flash', logo: '🔵', free: true, model: 'gemini-2.5-flash' },
  { id: 'claude', name: 'Claude', logo: '🟠', free: false, model: 'claude-sonnet-4-6', placeholder: 'sk-ant-api03-...', hintUrl: 'https://console.anthropic.com' },
  { id: 'openai', name: 'OpenAI', logo: '⚫', free: false, model: 'gpt-4o', placeholder: 'sk-proj-...', hintUrl: 'https://platform.openai.com/api-keys' },
]

export default function TripPage() {
  const router = useRouter()
  const { id } = router.query

  const [session, setSession] = useState(null)
  const [trip, setTrip] = useState(null)
  const [step, setStep] = useState('loading')
  const [lang, setLang] = useState('th')
  const [plansByLang, setPlansByLang] = useState({})
  const [isOwner, setIsOwner] = useState(false)
  const [isGuest, setIsGuest] = useState(false)
  const [isMember, setIsMember] = useState(false)
  const [tripRole, setTripRole] = useState('viewer')

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

  // Inline edit
  const [editingKey, setEditingKey] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [editTime, setEditTime] = useState('')
  const [editDetail, setEditDetail] = useState('')

  // AI Suggestion
  const [suggestingKey, setSuggestingKey] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [suggestLoading, setSuggestLoading] = useState(false)

  // Proposals (Submit/Approve)
  const [proposals, setProposals] = useState([])
  const [showProposals, setShowProposals] = useState(false)
  const [proposalDesc, setProposalDesc] = useState('')
  const [proposalLoading, setProposalLoading] = useState(false)
  const [showProposalForm, setShowProposalForm] = useState(false)
  const [proposalLocalPlan, setProposalLocalPlan] = useState(null)

  // Packing list
  const [packingList, setPackingList] = useState(null)
  const [packingLoading, setPackingLoading] = useState(false)
  const [showPacking, setShowPacking] = useState(false)
  const [showTimeline, setShowTimeline] = useState(false)

  // Fill Gaps
  const [gaps, setGaps] = useState([])
  const [showGaps, setShowGaps] = useState(false)
  const [gapsLoading, setGapsLoading] = useState(false)

  // Note images (stored per activity key in localStorage)
  const [noteImages, setNoteImages] = useState({})
  const [pendingImages, setPendingImages] = useState({})
  const [previewImage, setPreviewImage] = useState(null)
  const [planWeather, setPlanWeather] = useState(null)

  // UI state
  const [error, setError] = useState('')
  const [apiError, setApiError] = useState('')  // for suggest/packing errors
  const [shareToast, setShareToast] = useState(false)
  const [editNotif, setEditNotif] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [confirmGenerate, setConfirmGenerate] = useState(false)

  // AI provider
  const [provider, setProvider] = useState('gemini')
  const [apiKey, setApiKey] = useState('')
  const [tempProvider, setTempProvider] = useState('gemini')
  const [tempKey, setTempKey] = useState('')

  const saveTimer = useRef(null)
  const prov = PROVIDERS.find(p => p.id === provider) || PROVIDERS[0]

  // Exchange rate converter
  const [showConverter, setShowConverter] = useState(false)
  const [foreignCurrency, setForeignCurrency] = useState('JPY')
  const [exchangeRate, setExchangeRate] = useState(null)
  const [convertAmount, setConvertAmount] = useState('')
  const [convertDirection, setConvertDirection] = useState('foreign') // 'foreign' = foreign→THB, 'thb' = THB→foreign

  // Budget tracker
  const [budgetMap, setBudgetMap] = useState({}) // key: 'dayIdx-eventIdx', value: cost in foreign currency
  const [editingBudget, setEditingBudget] = useState(null) // 'dayIdx-eventIdx'
  const [budgetInput, setBudgetInput] = useState('')
  const [showBudgetSummary, setShowBudgetSummary] = useState(false)

  const CURRENCY_MAP = {
    'japan': 'JPY', 'ญี่ปุ่น': 'JPY', 'tokyo': 'JPY', 'osaka': 'JPY', 'kyoto': 'JPY', 'kyushu': 'JPY', 'hokkaido': 'JPY', 'คิวชู': 'JPY', 'โตเกียว': 'JPY', 'โอซาก้า': 'JPY',
    'korea': 'KRW', 'เกาหลี': 'KRW', 'seoul': 'KRW', 'busan': 'KRW', 'โซล': 'KRW',
    'china': 'CNY', 'จีน': 'CNY', 'beijing': 'CNY', 'shanghai': 'CNY',
    'taiwan': 'TWD', 'ไต้หวัน': 'TWD', 'taipei': 'TWD',
    'hong kong': 'HKD', 'ฮ่องกง': 'HKD',
    'singapore': 'SGD', 'สิงคโปร์': 'SGD',
    'malaysia': 'MYR', 'มาเลเซีย': 'MYR', 'kuala lumpur': 'MYR',
    'vietnam': 'VND', 'เวียดนาม': 'VND', 'hanoi': 'VND',
    'laos': 'LAK', 'ลาว': 'LAK', 'cambodia': 'KHR', 'กัมพูชา': 'KHR',
    'myanmar': 'MMK', 'พม่า': 'MMK',
    'indonesia': 'IDR', 'อินโดนีเซีย': 'IDR', 'bali': 'IDR',
    'philippines': 'PHP', 'ฟิลิปปินส์': 'PHP',
    'india': 'INR', 'อินเดีย': 'INR',
    'usa': 'USD', 'america': 'USD', 'อเมริกา': 'USD', 'new york': 'USD', 'hawaii': 'USD', 'ฮาวาย': 'USD',
    'uk': 'GBP', 'england': 'GBP', 'london': 'GBP', 'อังกฤษ': 'GBP',
    'europe': 'EUR', 'france': 'EUR', 'germany': 'EUR', 'italy': 'EUR', 'spain': 'EUR', 'ฝรั่งเศส': 'EUR', 'เยอรมัน': 'EUR', 'อิตาลี': 'EUR', 'paris': 'EUR',
    'switzerland': 'CHF', 'สวิส': 'CHF',
    'australia': 'AUD', 'ออสเตรเลีย': 'AUD', 'sydney': 'AUD',
    'new zealand': 'NZD', 'นิวซีแลนด์': 'NZD',
    'russia': 'RUB', 'รัสเซีย': 'RUB',
    'turkey': 'TRY', 'ตุรกี': 'TRY',
    'uae': 'AED', 'dubai': 'AED', 'ดูไบ': 'AED',
    'maldives': 'USD', 'มัลดีฟส์': 'USD',
  }
  const CURRENCY_NAMES = {
    JPY: '🇯🇵 เยน', KRW: '🇰🇷 วอน', CNY: '🇨🇳 หยวน', TWD: '🇹🇼 ดอลลาร์ไต้หวัน', HKD: '🇭🇰 HKD',
    SGD: '🇸🇬 SGD', MYR: '🇲🇾 ริงกิต', VND: '🇻🇳 ดอง', LAK: '🇱🇦 กีบ', KHR: '🇰🇭 เรียล', MMK: '🇲🇲 จ๊าด',
    IDR: '🇮🇩 รูเปียห์', PHP: '🇵🇭 เปโซ', INR: '🇮🇳 รูปี', USD: '🇺🇸 ดอลลาร์', GBP: '🇬🇧 ปอนด์',
    EUR: '🇪🇺 ยูโร', CHF: '🇨🇭 ฟรังก์', AUD: '🇦🇺 AUD', NZD: '🇳🇿 NZD', RUB: '🇷🇺 รูเบิล',
    TRY: '🇹🇷 ลีรา', AED: '🇦🇪 ดีร์แฮม',
  }

  // 1. Auth check — allow anonymous viewing
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s) {
        setSession(s)
        setIsGuest(s.user.is_anonymous === true)
        const p = localStorage.getItem('trip_provider') || 'gemini'
        const k = localStorage.getItem('trip_api_key') || ''
        setProvider(p); setTempProvider(p); setApiKey(k); setTempKey(k)
      }
      // Even without session, we continue (for anonymous viewing)
      setStep(prev => prev === 'loading' ? 'loading' : prev)
    })
  }, [])

  // Auto-detect currency from destination
  useEffect(() => {
    if (!destination && !plan?.tripTitle) return
    const text = `${destination || ''} ${plan?.tripTitle || ''}`.toLowerCase()
    for (const [keyword, currency] of Object.entries(CURRENCY_MAP)) {
      if (text.includes(keyword)) { setForeignCurrency(currency); break }
    }
  }, [destination, plan?.tripTitle])

  // Fetch exchange rate
  useEffect(() => {
    if (!foreignCurrency || foreignCurrency === 'THB') return
    setExchangeRate(null)
    fetch(`https://api.frankfurter.app/latest?from=${foreignCurrency}&to=THB`)
      .then(r => r.json())
      .then(d => { if (d.rates?.THB) setExchangeRate(d.rates.THB) })
      .catch(() => { })
  }, [foreignCurrency])

  // 2. Load trip
  useEffect(() => {
    if (!id) return
    // Load trip even without session (anonymous view)
    loadTrip()
    if (id) {
      const savedChecked = localStorage.getItem(`checked-${id}`)
      const savedNotes = localStorage.getItem(`notes-${id}`)
      const savedImages = localStorage.getItem(`noteImages-${id}`)
      if (savedChecked) setChecked(JSON.parse(savedChecked))
      if (savedNotes) setNoteMap(JSON.parse(savedNotes))
      if (savedImages) setNoteImages(JSON.parse(savedImages))
      const savedBudget = localStorage.getItem(`budget-${id}`)
      if (savedBudget) try { setBudgetMap(JSON.parse(savedBudget)) } catch (e) { }
    }
  }, [session, id])

  // Budget helpers
  const saveBudget = (map) => { setBudgetMap(map); if (id) localStorage.setItem(`budget-${id}`, JSON.stringify(map)) }
  const setBudgetForEvent = (dayIdx, eventIdx, cost) => {
    const key = `${dayIdx}-${eventIdx}`
    const map = { ...budgetMap }
    if (cost > 0) map[key] = cost; else delete map[key]
    saveBudget(map); setEditingBudget(null); setBudgetInput('')
  }
  const getDayBudget = (dayIdx) => {
    if (!plan?.days?.[dayIdx]) return 0
    return plan.days[dayIdx].events.reduce((sum, _, ei) => sum + (budgetMap[`${dayIdx}-${ei}`] || 0), 0)
  }
  const getTotalBudget = () => Object.values(budgetMap).reduce((sum, v) => sum + v, 0)

  // 3. Realtime
  useEffect(() => {
    if (!trip?.id) return
    const channel = supabase
      .channel(`trip-${trip.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trips', filter: `id=eq.${trip.id}` }, (payload) => {
        const updated = payload.new
        if (updated.plan_json && JSON.stringify(updated.plan_json) !== JSON.stringify(plan)) {
          setPlan(updated.plan_json)
          setActiveDay(0)
          setStep('plan')
          setEditNotif('✏️ มีการอัปเดต plan')
          setTimeout(() => setEditNotif(''), 4000)
        }
      }).subscribe()
    return () => supabase.removeChannel(channel)
  }, [trip?.id])

  const loadTrip = async () => {
    const headers = {}
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
    const res = await fetch(`/api/trips/${id}`, { headers })
    if (!res.ok) { router.replace('/trips'); return }
    const { trip: t, role } = await res.json()
    setTrip(t)
    setTripRole(role || 'viewer')
    const owner = role === 'owner'
    setIsOwner(owner)
    setIsMember(role === 'member')
    setDest(t.destination || '')
    setDates(t.dates || '')
    setNotes(t.notes || '')
    if (t.plan_json) {
      setPlan(t.plan_json); setStep('plan'); setShowTimeline(true)
      setPlansByLang(prev => ({ ...prev, th: t.plan_json }))
      if (t.destination || t.plan_json?.tripTitle) {
        fetch('/api/weather', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ destination: t.destination, planTitle: t.plan_json?.tripTitle }) })
          .then(r => r.json()).then(d => setPlanWeather(d)).catch(() => { })
      }
    }
    else { setStep('draft') }
    if (owner && session) loadProposals(t.id)
  }

  const loadProposals = async (tripId) => {
    const res = await fetch(`/api/proposals?tripId=${tripId}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (res.ok) { const d = await res.json(); setProposals(d.proposals || []) }
  }

  const submitProposal = async () => {
    if (!proposalLocalPlan) return
    setProposalLoading(true)
    try {
      const res = await fetch('/api/proposals', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ trip_id: id, plan_json: proposalLocalPlan, description: proposalDesc || 'เสนอแก้ไข plan' }),
      })
      if (res.ok) {
        setShowProposalForm(false)
        setProposalLocalPlan(null)
        setProposalDesc('')
        setEditNotif('✅ ส่ง proposal ให้เจ้าของแล้ว!')
        setTimeout(() => setEditNotif(''), 4000)
      }
    } catch (e) { /* ignore */ }
    setProposalLoading(false)
  }

  const handleApproveReject = async (proposalId, status) => {
    const res = await fetch(`/api/proposals/${proposalId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      setProposals(prev => prev.map(p => p.id === proposalId ? { ...p, status } : p))
      if (status === 'approved') {
        loadTrip()
        setEditNotif('✅ Approved! Plan อัปเดตแล้ว')
        setTimeout(() => setEditNotif(''), 4000)
        setShowProposals(false)
      }
    }
  }

  const generatePacking = async () => {
    if (!plan) return
    setPackingLoading(true)
    setApiError('')
    try {
      const res = await fetch('/api/packing', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination, dates, plan }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      if (data.categories) { setPackingList(data.categories); setShowPacking(true) }
      else throw new Error('No packing data returned')
    } catch (e) {
      setApiError(`Packing list: ${e.message}`)
    }
    setPackingLoading(false)
  }

  const generateGaps = async () => {
    if (!plan) return
    const day = plan.days[activeDay]
    setGapsLoading(true)
    setGaps([])
    setApiError('')
    try {
      const res = await fetch('/api/fill-gaps', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination, dates,
          dayTitle: day.title,
          dayDate: day.date,
          events: day.events,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      if (data.gaps) { setGaps(data.gaps); setShowGaps(true) }
    } catch (e) {
      setApiError(`Fill gaps: ${e.message}`)
    }
    setGapsLoading(false)
  }

  const addGapToDay = async (gap) => {
    const newPlan = JSON.parse(JSON.stringify(plan))
    newPlan.days[activeDay].events.push(gap.suggestion)
    newPlan.days[activeDay].events.sort((a, b) => (a.time || '').localeCompare(b.time || ''))
    setPlan(newPlan)
    setGaps(prev => prev.filter(g => g.startTime !== gap.startTime))
    await fetch(`/api/trips/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_json: newPlan }),
    })
  }

  const addPendingImage = (key, base64) => {
    setPendingImages(prev => ({ ...prev, [key]: [...(prev[key] || []), base64] }))
  }
  const saveNoteImages = (key) => {
    const pending = pendingImages[key] || []
    if (pending.length === 0) return
    const existing = noteImages[key] || []
    const next = { ...noteImages, [key]: [...existing, ...pending] }
    setNoteImages(next)
    localStorage.setItem(`noteImages-${id}`, JSON.stringify(next))
    setPendingImages(prev => { const p = { ...prev }; delete p[key]; return p })
  }
  const removeNoteImage = (key, idx) => {
    const imgs = [...(noteImages[key] || [])]
    imgs.splice(idx, 1)
    const next = { ...noteImages, [key]: imgs.length ? imgs : undefined }
    if (!imgs.length) delete next[key]
    setNoteImages(next)
    localStorage.setItem(`noteImages-${id}`, JSON.stringify(next))
  }
  const removePendingImage = (key, idx) => {
    const imgs = [...(pendingImages[key] || [])]
    imgs.splice(idx, 1)
    setPendingImages(prev => ({ ...prev, [key]: imgs }))
  }

  const autoSaveDraft = (dest, dt, n) => {
    if (!isOwner) return
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

  const doGenerate = async (langOverride) => {
    const useLang = langOverride || lang
    setConfirmGenerate(false)
    if (provider !== 'gemini' && !apiKey) { setShowSettings(true); return }
    setStep('generating'); setError('')
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: provider === 'gemini' ? null : apiKey, provider, destination, dates, notes, lang: useLang }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setPlan(data); setActiveDay(0); setChecked({}); setNoteMap({})
      setPlansByLang(prev => ({ ...prev, [useLang]: data }))
      localStorage.removeItem(`checked-${id}`)
      localStorage.removeItem(`notes-${id}`)
      await fetch(`/api/trips/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_json: data, title: data.tripTitle || destination }),
      })
      setStep('plan'); setShowTimeline(true)
      // Fetch weather for plan view
      if (destination || data.tripTitle) {
        fetch('/api/weather', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ destination, planTitle: data.tripTitle }) })
          .then(r => r.json()).then(d => setPlanWeather(d)).catch(() => { })
      }
    } catch (e) {
      setError(e.message); setStep('draft')
    }
  }

  const handleGenerate = () => {
    if (plan) { setConfirmGenerate(true) } else { doGenerate() }
  }

  // Inline edit save
  const saveInlineEdit = async (dayIdx, evIdx) => {
    const newPlan = JSON.parse(JSON.stringify(plan))
    newPlan.days[dayIdx].events[evIdx] = {
      ...newPlan.days[dayIdx].events[evIdx],
      title: editTitle,
      time: editTime,
      detail: editDetail,
    }
    setPlan(newPlan)
    setEditingKey(null)
    await fetch(`/api/trips/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_json: newPlan }),
    })
  }

  // AI Suggestion
  const fetchSuggestions = async (dayIdx, evIdx) => {
    const key = `${dayIdx}-${evIdx}`
    setSuggestingKey(key)
    setSuggestLoading(true)
    setSuggestions([])
    setApiError('')
    try {
      const day = plan.days[dayIdx]
      const ev = day.events[evIdx]
      const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination, dates,
          dayTitle: day.title,
          currentActivity: ev,
          otherActivities: day.events.filter((_, i) => i !== evIdx),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'AI suggestion failed')
      if (data.suggestions) setSuggestions(data.suggestions)
      else throw new Error('No suggestions returned')
    } catch (e) {
      setApiError(e.message)
      setSuggestingKey(null)
    }
    setSuggestLoading(false)
  }

  const applySuggestion = async (dayIdx, evIdx, sug) => {
    const newPlan = JSON.parse(JSON.stringify(plan))
    newPlan.days[dayIdx].events[evIdx] = {
      ...newPlan.days[dayIdx].events[evIdx],
      ...sug,
    }
    setPlan(newPlan)
    setSuggestingKey(null)
    setSuggestions([])
    await fetch(`/api/trips/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_json: newPlan }),
    })
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

  const globalStyle = `
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
    * { box-sizing: border-box; }
    body { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; }
    .trip-input { width:100%; border:1.5px solid rgba(14,165,233,0.15); border-radius:14px; padding:11px 16px; font-size:14px; outline:none; background:rgba(255,255,255,0.85); font-family:inherit; color:#0C4A6E; transition:all 0.3s; backdrop-filter:blur(8px); }
    .trip-input:focus { border-color:#0EA5E9; box-shadow:0 0 0 3px rgba(14,165,233,0.1); }
    .trip-input::placeholder { color:#BAE6FD; }
    .trip-textarea { width:100%; border:1.5px solid rgba(14,165,233,0.15); border-radius:14px; padding:12px 16px; font-size:14px; outline:none; resize:vertical; min-height:180px; font-family:inherit; color:#0C4A6E; background:rgba(255,255,255,0.85); backdrop-filter:blur(8px); transition:all 0.3s; }
    .trip-textarea:focus { border-color:#0EA5E9; box-shadow:0 0 0 3px rgba(14,165,233,0.1); }
    .btn-primary { background:linear-gradient(135deg,#0EA5E9,#38BDF8); color:white; border:none; border-radius:14px; padding:13px 20px; font-size:15px; font-weight:700; cursor:pointer; font-family:inherit; transition:all 0.3s; box-shadow:0 4px 15px rgba(14,165,233,0.25); }
    .btn-primary:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 8px 25px rgba(14,165,233,0.4); background:linear-gradient(135deg,#0284C7,#0EA5E9); }
    .btn-primary:active { transform:translateY(0); }
    .btn-primary:disabled { opacity:0.5; cursor:not-allowed; box-shadow:none; }
    .btn-ghost { background:rgba(255,255,255,0.7); border:1.5px solid rgba(14,165,233,0.15); color:#0C4A6E; border-radius:12px; padding:8px 14px; font-size:13px; font-weight:600; cursor:pointer; font-family:inherit; transition:all 0.3s; backdrop-filter:blur(8px); }
    .btn-ghost:hover { background:white; border-color:#0EA5E9; box-shadow:0 2px 10px rgba(14,165,233,0.12); }
    .event-card { background:rgba(255,255,255,0.85); border-radius:16px; overflow:hidden; box-shadow:0 2px 12px rgba(14,165,233,0.06); backdrop-filter:blur(12px); border:1px solid rgba(255,255,255,0.95); transition:all 0.3s cubic-bezier(0.4,0,0.2,1); }
    .event-card:hover { box-shadow:0 8px 30px rgba(14,165,233,0.12); transform:translateY(-2px); border-color:rgba(14,165,233,0.15); }
    .icon-btn { background:none; border:none; cursor:pointer; padding:4px; border-radius:8px; transition:all 0.2s; display:flex; align-items:center; justify-content:center; }
    .icon-btn:hover { background:rgba(14,165,233,0.08); transform:scale(1.1); }
    .day-tab { flex-shrink:0; padding:10px 15px; border-radius:14px; border:2px solid transparent; cursor:pointer; text-align:center; font-size:11px; font-weight:600; transition:all 0.3s; font-family:inherit; }
    .day-tab:hover { transform:translateY(-2px); }
    .modal-overlay { position:fixed; inset:0; background:rgba(12,74,110,0.4); backdrop-filter:blur(8px); z-index:999; display:flex; align-items:flex-end; justify-content:center; animation:fadeIn 0.2s ease; }
    .modal-sheet { background:rgba(255,255,255,0.97); backdrop-filter:blur(24px); border-radius:28px 28px 0 0; padding:24px 20px 40px; width:100%; max-width:540px; border:1px solid rgba(255,255,255,0.95); box-shadow:0 -8px 40px rgba(14,165,233,0.15); animation:slideUp 0.3s ease; }
    @keyframes fadeIn { from{opacity:0} to{opacity:1} }
    @keyframes slideUp { from{transform:translateY(100%);opacity:0} to{transform:translateY(0);opacity:1} }
    @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
    .budget-tag { display:inline-flex; align-items:center; gap:3px; font-size:11px; font-weight:700; padding:2px 6px; border-radius:6px; background:rgba(245,158,11,0.12); color:#D97706; cursor:pointer; transition:all 0.2s; }
    .budget-tag:hover { background:rgba(245,158,11,0.2); transform:scale(1.05); }
  `

  /* ─── LOADING ─── */
  if (step === 'loading') return (
    <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", minHeight: '100vh', background: 'linear-gradient(135deg,#F0F9FF,#E0F2FE,#BAE6FD)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{globalStyle}</style>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '52px', display: 'inline-block', animation: 'float 1.5s ease-in-out infinite' }}>✈️</div>
        <style>{`@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}`}</style>
      </div>
    </div>
  )

  /* ─── GENERATING ─── */
  if (step === 'generating') return (
    <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", minHeight: '100vh', background: 'linear-gradient(135deg,#F0F9FF,#E0F2FE,#BAE6FD)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{globalStyle}</style>
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <div style={{ fontSize: '56px', display: 'inline-block', animation: 'float 1.5s ease-in-out infinite' }}>✈️</div>
        <div style={{ fontSize: '20px', fontWeight: '800', color: '#0C4A6E', marginTop: '20px' }}>AI กำลังจัด plan ให้...</div>
        <div style={{ fontSize: '14px', color: '#38BDF8', marginTop: '8px' }}>ใช้เวลาประมาณ 15–20 วินาที</div>
        <div style={{ marginTop: '16px', display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(10px)', borderRadius: '99px', padding: '8px 18px', boxShadow: '0 2px 12px rgba(14,165,233,0.15)', border: '1px solid rgba(255,255,255,0.8)' }}>
          <span>{prov.logo}</span>
          <span style={{ fontSize: '12px', color: '#0C4A6E', fontWeight: '600' }}>{prov.name} · {prov.model}</span>
        </div>
      </div>
      <style>{`@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}`}</style>
    </div>
  )

  /* ─── CONFIRM MODAL ─── */
  const ConfirmModal = () => (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setConfirmGenerate(false) }}>
      <div className="modal-sheet">
        <div style={{ width: '40px', height: '4px', background: '#BAE6FD', borderRadius: '99px', margin: '0 auto 20px' }} />
        <div style={{ fontSize: '20px', fontWeight: '800', color: '#0C4A6E', marginBottom: '8px' }}>⚠️ Generate ใหม่?</div>
        <div style={{ fontSize: '14px', color: '#38BDF8', marginBottom: '24px', lineHeight: '1.6' }}>
          Trip นี้มี plan อยู่แล้ว ถ้า Generate ใหม่ plan เดิมจะถูกลบและแทนที่ด้วยเวอร์ชันใหม่
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmGenerate(false)}>ยกเลิก</button>
          <button className="btn-primary" style={{ flex: 2 }} onClick={doGenerate}>Generate ใหม่</button>
        </div>
      </div>
    </div>
  )

  /* ─── SETTINGS MODAL ─── */
  const SettingsModal = () => (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowSettings(false) }}>
      <div className="modal-sheet">
        <div style={{ width: '40px', height: '4px', background: '#BAE6FD', borderRadius: '99px', margin: '0 auto 20px' }} />
        <div style={{ fontSize: '18px', fontWeight: '800', color: '#0C4A6E', marginBottom: '5px' }}>⚙️ ตั้งค่า AI</div>
        <div style={{ fontSize: '13px', color: '#38BDF8', marginBottom: '18px' }}>Gemini Flash ใช้ได้ฟรี · Claude / OpenAI ต้องใส่ key เอง</div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {PROVIDERS.map(p => (
            <button key={p.id} onClick={() => { setTempProvider(p.id); setTempKey('') }}
              style={{ flex: 1, padding: '10px 8px', borderRadius: '12px', border: `2px solid ${tempProvider === p.id ? '#0EA5E9' : 'rgba(14,165,233,0.2)'}`, background: tempProvider === p.id ? 'linear-gradient(135deg,#0EA5E9,#38BDF8)' : 'rgba(255,255,255,0.7)', color: tempProvider === p.id ? 'white' : '#0C4A6E', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'inherit', transition: 'all 0.2s' }}>
              <div style={{ fontSize: '18px', marginBottom: '2px' }}>{p.logo}</div>
              {p.name}
              {p.free && <div style={{ fontSize: '10px', color: tempProvider === p.id ? '#86efac' : '#0EA5E9', marginTop: '2px' }}>ฟรี</div>}
            </button>
          ))}
        </div>
        {tempProvider !== 'gemini' && (() => {
          const tp = PROVIDERS.find(p => p.id === tempProvider)
          return (
            <>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#0C4A6E', display: 'block', marginBottom: '6px' }}>{tp.name} API Key</label>
              <input className="trip-input" type="password" placeholder={tp.placeholder}
                value={tempKey} onChange={e => setTempKey(e.target.value)} style={{ marginBottom: '8px' }} />
              <p style={{ fontSize: '12px', color: '#BAE6FD', marginBottom: '16px' }}>
                ขอ key ได้ที่ <a href={tp.hintUrl} target="_blank" rel="noreferrer" style={{ color: '#0EA5E9' }}>{tp.hintUrl.replace('https://', '')}</a>
              </p>
            </>
          )
        })()}
        <button className="btn-primary" style={{ width: '100%', opacity: (tempProvider === 'gemini' || tempKey) ? 1 : 0.4 }}
          disabled={tempProvider !== 'gemini' && !tempKey} onClick={saveSettings}>บันทึก</button>
      </div>
    </div>
  )

  /* ─── AI SUGGESTION SHEET ─── */
  const SuggestionSheet = ({ dayIdx, evIdx }) => (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setSuggestingKey(null) }}>
      <div className="modal-sheet">
        <div style={{ width: '40px', height: '4px', background: '#BAE6FD', borderRadius: '99px', margin: '0 auto 20px' }} />
        <div style={{ fontSize: '18px', fontWeight: '800', color: '#0C4A6E', marginBottom: '5px' }}>✨ AI Suggestion</div>
        <div style={{ fontSize: '13px', color: '#38BDF8', marginBottom: '18px' }}>
          แทน "{plan.days[dayIdx].events[evIdx].title}" ด้วย...
        </div>
        {suggestLoading ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: '#38BDF8', fontSize: '14px' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px', display: 'inline-block', animation: 'float 1.5s ease-in-out infinite' }}>✨</div>
            <div>AI กำลังคิด...</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {suggestions.map((sug, i) => (
              <button key={i} onClick={() => applySuggestion(dayIdx, evIdx, sug)}
                style={{ background: 'rgba(255,255,255,0.8)', border: '1.5px solid rgba(14,165,233,0.15)', borderRadius: '14px', padding: '14px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#0EA5E9'; e.currentTarget.style.background = 'white' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(14,165,233,0.15)'; e.currentTarget.style.background = 'rgba(255,255,255,0.8)' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '24px', flexShrink: 0 }}>{sug.icon}</span>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#0C4A6E' }}>{sug.time} · {sug.title}</div>
                    {sug.detail && <div style={{ fontSize: '12px', color: '#38BDF8', marginTop: '3px' }}>{sug.detail}</div>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
        <button className="btn-ghost" style={{ width: '100%', marginTop: '14px' }} onClick={() => setSuggestingKey(null)}>ปิด</button>
      </div>
    </div>
  )

  /* ─── PROPOSALS SHEET ─── */
  const ProposalsSheet = () => (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowProposals(false) }}>
      <div className="modal-sheet" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
        <div style={{ width: '40px', height: '4px', background: '#BAE6FD', borderRadius: '99px', margin: '0 auto 20px' }} />
        <div style={{ fontSize: '18px', fontWeight: '800', color: '#0C4A6E', marginBottom: '5px' }}>🔔 ข้อเสนอแก้ไข</div>
        <div style={{ fontSize: '13px', color: '#38BDF8', marginBottom: '18px' }}>{proposals.filter(p => p.status === 'pending').length} รายการรอพิจารณา</div>
        {proposals.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: '#BAE6FD', fontSize: '14px' }}>ยังไม่มีข้อเสนอแก้ไข</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {proposals.map(p => (
              <div key={p.id} style={{ background: 'rgba(255,255,255,0.8)', border: `1.5px solid ${p.status === 'pending' ? 'rgba(14,165,233,0.2)' : p.status === 'approved' ? '#86efac' : '#fca5a5'}`, borderRadius: '14px', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#0C4A6E' }}>{p.proposer_name}</div>
                    <div style={{ fontSize: '12px', color: '#38BDF8' }}>{p.description}</div>
                  </div>
                  <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '99px', fontWeight: '700', background: p.status === 'pending' ? '#E0F2FE' : p.status === 'approved' ? '#dcfce7' : '#fee2e2', color: p.status === 'pending' ? '#0284C7' : p.status === 'approved' ? '#15803d' : '#b91c1c' }}>
                    {p.status === 'pending' ? 'รอ' : p.status === 'approved' ? '✅' : '❌'}
                  </span>
                </div>
                {p.status === 'pending' && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                    <button className="btn-ghost" style={{ flex: 1, padding: '8px', fontSize: '13px', color: '#b91c1c', borderColor: '#fca5a5' }} onClick={() => handleApproveReject(p.id, 'rejected')}>❌ ปฏิเสธ</button>
                    <button className="btn-primary" style={{ flex: 2, padding: '8px', fontSize: '13px' }} onClick={() => handleApproveReject(p.id, 'approved')}>✅ Approve & Merge</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <button className="btn-ghost" style={{ width: '100%', marginTop: '14px' }} onClick={() => setShowProposals(false)}>ปิด</button>
      </div>
    </div>
  )

  /* ─── PACKING LIST SHEET ─── */
  const PackingSheet = () => (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowPacking(false) }}>
      <div className="modal-sheet" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ width: '40px', height: '4px', background: '#BAE6FD', borderRadius: '99px', margin: '0 auto 20px' }} />
        <div style={{ fontSize: '18px', fontWeight: '800', color: '#0C4A6E', marginBottom: '5px' }}>🧳 Packing List</div>
        <div style={{ fontSize: '13px', color: '#38BDF8', marginBottom: '18px' }}>AI แนะนำสิ่งของสำหรับ {destination}</div>
        {packingList && packingList.map((cat, ci) => (
          <div key={ci} style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: '800', color: '#0C4A6E', marginBottom: '8px' }}>{cat.icon} {cat.name}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {cat.items.map((item, ii) => (
                <span key={ii} style={{ background: 'rgba(14,165,233,0.08)', border: '1.5px solid rgba(14,165,233,0.15)', borderRadius: '99px', padding: '4px 12px', fontSize: '12px', color: '#0C4A6E', fontWeight: '500' }}>{item}</span>
              ))}
            </div>
          </div>
        ))}
        <button className="btn-ghost" style={{ width: '100%', marginTop: '8px' }} onClick={() => setShowPacking(false)}>ปิด</button>
      </div>
    </div>
  )

  /* ─── FILL GAPS SHEET ─── */
  const FillGapsSheet = () => (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowGaps(false) }}>
      <div className="modal-sheet" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ width: '40px', height: '4px', background: '#BAE6FD', borderRadius: '99px', margin: '0 auto 20px' }} />
        <div style={{ fontSize: '18px', fontWeight: '800', color: '#0C4A6E', marginBottom: '5px' }}>🔍 ช่วงเวลาว่างในวันนี้</div>
        <div style={{ fontSize: '13px', color: '#38BDF8', marginBottom: '18px' }}>AI วิเคราะห์ตารางเวลาและเสนอสิ่งที่ง่ายต่อไป</div>
        {gaps.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: '#BAE6FD', fontSize: '14px' }}>ไม่พบช่วงว่างในวันนี้ แผนเต็มมากแล้ว! 🎉</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {gaps.map((gap, gi) => (
              <div key={gi} style={{ background: 'rgba(255,255,255,0.8)', border: '1.5px solid rgba(14,165,233,0.15)', borderRadius: '14px', padding: '14px' }}>
                <div style={{ fontSize: '11px', color: '#38BDF8', fontWeight: '700', marginBottom: '8px' }}>
                  ⏰ {gap.startTime} – {gap.endTime} ({gap.duration})
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <span style={{ fontSize: '24px' }}>{gap.suggestion.icon}</span>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#0C4A6E' }}>{gap.suggestion.time} · {gap.suggestion.title}</div>
                    {gap.suggestion.detail && <div style={{ fontSize: '12px', color: '#38BDF8', marginTop: '3px' }}>{gap.suggestion.detail}</div>}
                  </div>
                </div>
                <button className="btn-primary" style={{ width: '100%', padding: '9px', fontSize: '13px' }} onClick={() => addGapToDay(gap)}>
                  + เพิ่มลง Plan
                </button>
              </div>
            ))}
          </div>
        )}
        <button className="btn-ghost" style={{ width: '100%', marginTop: '14px' }} onClick={() => setShowGaps(false)}>ปิด</button>
      </div>
    </div>
  )

  /* ─── TIMELINE PREVIEW ─── */
  const TimelinePreview = () => {
    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()

    const tripDates = plan?.days?.map(d => parseTripDate(d.date)) || []
    const tripStartDate = tripDates.find(d => d) || null
    const tripEndDate = tripDates.filter(d => d).pop() || null
    const daysUntil = tripStartDate ? Math.ceil((tripStartDate - now) / 86400000) : null
    const showCountdown = daysUntil && daysUntil > 0

    const getCurrentDayIdx = () => {
      for (let i = 0; i < tripDates.length; i++) {
        if (tripDates[i] && tripDates[i].toDateString() === now.toDateString()) return i
      }
      return -1
    }
    const currentDayIdx = getCurrentDayIdx()
    const isTripEnded = tripEndDate && now > new Date(tripEndDate.getTime() + 86400000)

    const parseTime = (t) => { if (!t) return null; const m = t.match(/(\d{1,2}):(\d{2})/); return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : null }

    return (
      <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(180deg,#0C4A6E,#0369A1,#0EA5E9)', zIndex: 1000, overflowY: 'auto', fontFamily: "'Plus Jakarta Sans',sans-serif" }}
        ref={el => { if (el) { const m = el.querySelector('[data-current="true"]'); if (m) setTimeout(() => m.scrollIntoView({ behavior: 'smooth', block: 'center' }), 400) } }}>

        <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(12,74,110,0.95)', backdropFilter: 'blur(16px)', padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '16px', fontWeight: '800', color: 'white' }}>🗺️ Timeline</div>
              <div style={{ fontSize: '11px', color: 'rgba(186,230,253,0.7)', marginTop: '2px' }}>{plan?.tripTitle} · {plan?.days?.length} วัน{planWeather?.city ? ` · 📍 ${planWeather.city}` : ''}</div>
            </div>
            <button onClick={() => setShowTimeline(false)} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '10px', padding: '6px 14px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: 'inherit' }}>✕</button>
          </div>
          {showCountdown && (
            <div style={{ marginTop: '10px', background: 'rgba(34,211,238,0.15)', border: '1px solid rgba(34,211,238,0.3)', borderRadius: '12px', padding: '12px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: '800', color: '#22d3ee' }}>⏳ {daysUntil}</div>
              <div style={{ fontSize: '12px', color: 'rgba(186,230,253,0.8)', marginTop: '2px' }}>วัน ก่อนเริ่มทริป!</div>
            </div>
          )}
          {currentDayIdx >= 0 && !isTripEnded && (
            <div style={{ marginTop: '10px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '12px', padding: '8px 14px', textAlign: 'center' }}>
              <span style={{ fontSize: '13px', color: '#34d399', fontWeight: '700' }}>🟢 กำลังเที่ยววัน {currentDayIdx + 1}</span>
            </div>
          )}
          {isTripEnded && (
            <div style={{ marginTop: '10px', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '12px', padding: '8px 14px', textAlign: 'center' }}>
              <span style={{ fontSize: '13px', color: '#a78bfa', fontWeight: '700' }}>✅ ทริปจบแล้ว · หวังว่าจะสนุก!</span>
            </div>
          )}
        </div>

        <div style={{ padding: '20px 16px 60px', maxWidth: '600px', margin: '0 auto' }}>
          {plan?.days?.map((day, di) => {
            const col = COLORS[di % COLORS.length]
            const isCurrentDay = di === currentDayIdx
            const isDoneDay = currentDayIdx >= 0 ? di < currentDayIdx : (tripDates[di] && now > new Date(tripDates[di].getTime() + 86400000))
            const w = getWeatherForDay(planWeather, day.date)
            return (
              <div key={di} style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', boxShadow: `0 4px 15px ${col}55` }}>{day.emoji || '📍'}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '15px', fontWeight: '800', color: 'white', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      วัน {day.day} · {day.title}
                      {isCurrentDay && <span style={{ fontSize: '10px', background: '#22d3ee', color: '#0C4A6E', padding: '2px 8px', borderRadius: '99px', fontWeight: '700' }}>วันนี้</span>}
                      {isDoneDay && <span style={{ fontSize: '10px', background: '#64748b', color: 'white', padding: '2px 8px', borderRadius: '99px', fontWeight: '700' }}>ผ่านแล้ว</span>}
                    </div>
                    <div style={{ fontSize: '11px', color: 'rgba(186,230,253,0.6)' }}>{day.date}{day.hotel ? ` · 🏨 ${day.hotel}` : ''}</div>
                  </div>
                  {w && (
                    <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '12px', padding: '6px 10px', textAlign: 'center', flexShrink: 0, border: '1px solid rgba(255,255,255,0.1)' }}>
                      <div style={{ fontSize: '20px' }}>{w.icon}</div>
                      <div style={{ fontSize: '10px', color: 'white', fontWeight: '700' }}>{w.tempMax}°C/{w.tempMin}°C</div>
                      {w.rainChance > 20 && <div style={{ fontSize: '9px', color: '#38BDF8' }}>💧{w.rainChance}%</div>}
                    </div>
                  )}
                  {!planWeather && <div style={{ fontSize: '11px', color: 'rgba(186,230,253,0.4)' }}>⏳</div>}
                </div>
                <div style={{ paddingLeft: '22px', borderLeft: `3px solid ${col}44`, marginLeft: '20px' }}>
                  {day.events.map((ev, ei) => {
                    const evMin = parseTime(ev.time)
                    const nextMin = day.events[ei + 1] ? parseTime(day.events[ei + 1].time) : null
                    const isCurrent = isCurrentDay && evMin !== null && currentMinutes >= evMin && (nextMin === null || currentMinutes < nextMin)
                    const isPast = isDoneDay || (isCurrentDay && evMin !== null && nextMin !== null && currentMinutes >= nextMin)
                    return (
                      <div key={ei} data-current={isCurrent ? 'true' : undefined} style={{ position: 'relative', paddingBottom: '16px', opacity: isPast ? 0.45 : 1 }}>
                        <div style={{ position: 'absolute', left: '-28px', top: '4px', width: isCurrent ? '16px' : '10px', height: isCurrent ? '16px' : '10px', borderRadius: '99px', background: isCurrent ? '#22d3ee' : isPast ? '#64748b' : col, border: isCurrent ? '3px solid white' : 'none', boxShadow: isCurrent ? '0 0 12px #22d3ee' : 'none' }} />
                        {isCurrent && <div style={{ position: 'absolute', left: '-38px', top: '-10px', fontSize: '9px', color: '#22d3ee', fontWeight: '800', writingMode: 'vertical-lr', letterSpacing: '1px' }}>NOW</div>}
                        <div style={{ marginLeft: '8px', background: isCurrent ? 'rgba(34,211,238,0.15)' : 'rgba(255,255,255,0.08)', border: isCurrent ? '1.5px solid rgba(34,211,238,0.4)' : '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '10px 12px', transform: isCurrent ? 'scale(1.02)' : 'scale(1)', transition: 'all 0.3s' }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ fontSize: '20px' }}>{isPast ? '✅' : ev.icon}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '13px', fontWeight: '700', color: 'white', textDecoration: isPast ? 'line-through' : 'none' }}>{ev.title}</span>
                                <span style={{ fontSize: '11px', color: isCurrent ? '#22d3ee' : 'rgba(186,230,253,0.5)', fontFamily: 'monospace', fontWeight: '700' }}>{ev.time}</span>
                              </div>
                              {ev.detail && <div style={{ fontSize: '11px', color: 'rgba(186,230,253,0.5)', marginTop: '3px' }}>{ev.detail}</div>}
                            </div>
                          </div>
                          <span style={{ display: 'inline-block', marginTop: '6px', fontSize: '9px', padding: '2px 8px', borderRadius: '99px', background: `${col}33`, color: col, fontWeight: '700' }}>{ev.type}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'rgba(186,230,253,0.5)', fontSize: '12px' }}>🕐 ตำแหน่งตามเวลาจริง · พยากรณ์จาก Open-Meteo</div>
        </div>
      </div>
    )
  }




  /* ─── PROPOSAL FORM SHEET (for non-owner) ─── */

  /* ─── PROPOSAL FORM SHEET (for non-owner) ─── */
  const ProposalFormSheet = () => (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowProposalForm(false) }}>
      <div className="modal-sheet">
        <div style={{ width: '40px', height: '4px', background: '#BAE6FD', borderRadius: '99px', margin: '0 auto 20px' }} />
        <div style={{ fontSize: '18px', fontWeight: '800', color: '#0C4A6E', marginBottom: '8px' }}>📤 เสนอแก้ไข Plan</div>
        <div style={{ fontSize: '13px', color: '#38BDF8', marginBottom: '18px', lineHeight: '1.6' }}>
          เจ้าของ trip จะได้รับการแจ้งเตือนและสามารถ Approve หรือ Reject ได้
        </div>
        <label style={{ fontSize: '13px', fontWeight: '700', color: '#0C4A6E', display: 'block', marginBottom: '6px' }}>บอกว่าแก้อะไร</label>
        <input className="trip-input" placeholder="เช่น เพิ่มร้านอาหารวันที่ 2 และปรับเวลา" value={proposalDesc}
          onChange={e => setProposalDesc(e.target.value)} style={{ marginBottom: '16px' }} />
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setShowProposalForm(false)}>ยกเลิก</button>
          <button className="btn-primary" style={{ flex: 2, opacity: proposalLoading ? 0.6 : 1 }}
            disabled={proposalLoading} onClick={submitProposal}>
            {proposalLoading ? 'กำลังส่ง...' : '📤 ส่ง Proposal'}
          </button>
        </div>
      </div>
    </div>
  )

  /* ─── DRAFT ─── */
  if (step === 'draft') return (
    <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", minHeight: '100vh', background: 'linear-gradient(135deg,#F0F9FF,#E0F2FE,#BAE6FD)' }}>
      <style>{globalStyle}</style>
      {showSettings && <SettingsModal />}
      {confirmGenerate && <ConfirmModal />}

      {/* Guest Banner */}
      {!isOwner && (
        <div style={{ background: 'linear-gradient(135deg,#F97316,#FB923C)', color: 'white', padding: '10px 16px', textAlign: 'center', fontSize: '13px', fontWeight: '600' }}>
          {isGuest ? '👁️ คุณกำลังดูในฐานะ Guest · ' : '👥 คุณเป็น Viewer · '}
          <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => router.push(`/login?next=/trip/${id}`)}>
            {isGuest ? 'สมัครสมาชิกเพื่อแก้ไขร่วมกัน →' : 'Login เพื่อแก้ไข →'}
          </span>
        </div>
      )}

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={() => router.push('/trips')} className="btn-ghost" style={{ padding: '6px 10px' }}>← Trips</button>
            <div style={{ fontSize: '17px', fontWeight: '800', color: '#0C4A6E' }}>✈️ Trip Planner</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {saving && <span style={{ fontSize: '11px', color: '#38BDF8' }}>กำลังบันทึก...</span>}
            {plan && <button className="btn-ghost" onClick={() => setStep('plan')}>ดู Plan</button>}
            {isOwner && (
              <button onClick={() => { setTempProvider(provider); setTempKey(apiKey); setShowSettings(true) }}
                style={{ background: provider === 'gemini' ? 'rgba(14,165,233,0.1)' : '#fff7ed', border: `1.5px solid ${provider === 'gemini' ? '#0EA5E9' : '#fed7aa'}`, color: provider === 'gemini' ? '#0284C7' : '#c2410c', borderRadius: '10px', padding: '7px 12px', fontSize: '13px', cursor: 'pointer', fontWeight: '600', fontFamily: 'inherit' }}>
                {prov.logo} {prov.name}
              </button>
            )}
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(16px)', border: '1.5px solid rgba(255,255,255,0.9)', borderRadius: '20px', padding: '22px', boxShadow: '0 4px 20px rgba(14,165,233,0.08)', marginBottom: '12px' }}>
          <label style={{ fontSize: '13px', fontWeight: '700', color: '#0C4A6E', display: 'block', marginBottom: '6px' }}>ปลายทาง</label>
          <input className="trip-input" placeholder="เช่น คิวชู ญี่ปุ่น" value={destination} disabled={!isOwner}
            onChange={e => { setDest(e.target.value); autoSaveDraft(e.target.value, dates, notes) }} style={{ marginBottom: '14px' }} />
          <label style={{ fontSize: '13px', fontWeight: '700', color: '#0C4A6E', display: 'block', marginBottom: '6px' }}>ช่วงเวลา</label>
          <input className="trip-input" placeholder="เช่น 1-7 เมษายน 2568 (7 วัน)" value={dates} disabled={!isOwner}
            onChange={e => { setDates(e.target.value); autoSaveDraft(destination, e.target.value, notes) }} style={{ marginBottom: '14px' }} />
          <label style={{ fontSize: '13px', fontWeight: '700', color: '#0C4A6E', display: 'block', marginBottom: '6px' }}>Note / ไอเดียทั้งหมด</label>
          <div style={{ fontSize: '12px', color: '#BAE6FD', marginBottom: '8px' }}>พิมพ์ทุกอย่างที่รู้ ไม่ต้องเป็นระเบียบ</div>
          <textarea className="trip-textarea" value={notes} disabled={!isOwner}
            placeholder={'ตัวอย่าง:\n- อยากไป Yufuin\n- ต้องลอง ramen ที่ Fukuoka'}
            onChange={e => { setNotes(e.target.value); autoSaveDraft(destination, dates, e.target.value) }} />
        </div>

        {error && <div style={{ background: 'rgba(254,226,226,0.9)', border: '1px solid #fca5a5', color: '#b91c1c', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', marginBottom: '10px' }}>⚠️ {error}</div>}

        {isOwner && (
          <>
            <button className="btn-primary" style={{ width: '100%', opacity: (destination && dates && notes) ? 1 : 0.5 }}
              disabled={!destination || !dates || !notes} onClick={handleGenerate}>
              ✨ ให้ AI จัด Plan ให้
            </button>
            <div style={{ fontSize: '12px', color: '#38BDF8', textAlign: 'center', marginTop: '8px' }}>
              {provider === 'gemini' ? '🔵 ใช้ Gemini Flash (ฟรี)' : `${prov.logo} ใช้ ${prov.name} API ของคุณ`}
            </div>
          </>
        )}
      </div>
    </div>
  )

  /* ─── PLAN ─── */
  if (step === 'plan' && plan) {
    const day = plan.days[activeDay]
    const col = COLORS[activeDay % COLORS.length]
    const light = LIGHT[activeDay % LIGHT.length]
    const total = plan.days.reduce((s, d) => s + d.events.length, 0)
    const done = Object.values(checked).filter(Boolean).length

    return (
      <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", minHeight: '100vh', background: 'linear-gradient(135deg,#F0F9FF,#E0F2FE)' }}>
        <style>{globalStyle}</style>
        {showSettings && <SettingsModal />}
        {confirmGenerate && <ConfirmModal />}
        {suggestingKey !== null && (() => {
          const [di, ei] = suggestingKey.split('-').map(Number)
          return <SuggestionSheet dayIdx={di} evIdx={ei} />
        })()}
        {showProposals && <ProposalsSheet />}
        {showPacking && packingList && <PackingSheet />}
        {showProposalForm && <ProposalFormSheet />}
        {showGaps && <FillGapsSheet />}
        {showTimeline && <TimelinePreview />}
        {previewImage && (
          <div onClick={() => setPreviewImage(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out', padding: '20px' }}>
            <img src={previewImage} alt="preview"
              style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: '12px', objectFit: 'contain', boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }} />
            <div style={{ position: 'absolute', top: '16px', right: '16px', color: 'white', fontSize: '28px', cursor: 'pointer', opacity: 0.8 }}>✕</div>
          </div>
        )}

        {/* Notifications */}
        {editNotif && (
          <div style={{ position: 'fixed', top: '16px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(12,74,110,0.9)', backdropFilter: 'blur(8px)', color: 'white', padding: '8px 18px', borderRadius: '99px', fontSize: '13px', zIndex: 1000, boxShadow: '0 4px 16px rgba(14,165,233,0.3)', border: '1px solid rgba(255,255,255,0.2)' }}>
            {editNotif}
          </div>
        )}
        {shareToast && (
          <div style={{ position: 'fixed', top: '16px', left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg,#10B981,#34D399)', color: 'white', padding: '8px 18px', borderRadius: '99px', fontSize: '13px', zIndex: 1000, boxShadow: '0 4px 16px rgba(16,185,129,0.35)' }}>
            ✅ คัดลอก link แล้ว!
          </div>
        )}
        {apiError && (
          <div style={{ position: 'fixed', top: '60px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(185,28,28,0.95)', backdropFilter: 'blur(8px)', color: 'white', padding: '8px 18px', borderRadius: '99px', fontSize: '13px', zIndex: 1000, boxShadow: '0 4px 16px rgba(185,28,28,0.3)', cursor: 'pointer', maxWidth: '90vw', textAlign: 'center' }}
            onClick={() => setApiError('')}>
            ⚠️ {apiError} · แตะเพื่อปิด
          </div>
        )}

        {/* Guest Banner */}
        {!isOwner && (
          <div style={{ background: 'linear-gradient(135deg,#F97316,#FB923C)', color: 'white', padding: '10px 16px', textAlign: 'center', fontSize: '13px', fontWeight: '600' }}>
            {isGuest ? '👁️ คุณกำลังดูในฐานะ Guest · ' : '👥 คุณเป็น Viewer · '}
            <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => router.push(`/login?next=/trip/${id}`)}>
              {isGuest ? 'สมัครสมาชิกเพื่อแก้ไขร่วมกัน →' : 'Login เพื่อแก้ไข →'}
            </span>
          </div>
        )}

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg,#0C4A6E,#0EA5E9)', color: 'white', padding: '16px', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: '200px', height: '100%', background: 'radial-gradient(at top right, rgba(56,189,248,0.3), transparent)', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
            <button onClick={() => router.push('/trips')}
              style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '8px', padding: '5px 10px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: 'inherit', backdropFilter: 'blur(4px)' }}>
              ← Trips
            </button>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowTimeline(true)}
                style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '8px', padding: '5px 12px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: 'inherit' }}>
                🗺️
              </button>
              <div style={{ display: 'flex', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', overflow: 'hidden' }}>
                {['th', 'en', 'jp'].map(l => (
                  <button key={l} onClick={() => {
                    if (l === lang) return
                    setLang(l)
                    if (plansByLang[l]) {
                      // ใช้ plan จาก cache
                      setPlan(plansByLang[l]); setActiveDay(0)
                    } else {
                      // ยังไม่เคย generate ภาษานี้ → generate ใหม่
                      setTimeout(() => doGenerate(l), 100)
                    }
                  }}
                    style={{ background: lang === l ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.08)', color: 'white', border: 'none', padding: '4px 8px', cursor: 'pointer', fontSize: '11px', fontWeight: lang === l ? '800' : '500', fontFamily: 'inherit', borderRight: l !== 'jp' ? '1px solid rgba(255,255,255,0.15)' : 'none' }}>
                    {l === 'th' ? '🇹🇭' : l === 'en' ? '🇬🇧' : '🇯🇵'}
                  </button>
                ))}
              </div>
              <button onClick={copyShareLink}
                style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '8px', padding: '5px 12px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: 'inherit' }}>
                🔗 แชร์
              </button>
              <button onClick={() => setShowConverter(c => !c)}
                style={{ background: showConverter ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '8px', padding: '5px 12px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: 'inherit' }}>
                💱
              </button>
              {isOwner && (
                <>
                  <button onClick={() => { loadProposals(trip.id); setShowProposals(true) }}
                    style={{ position: 'relative', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '8px', padding: '5px 10px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: 'inherit' }}>
                    🔔
                    {proposals.filter(p => p.status === 'pending').length > 0 && (
                      <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#F97316', borderRadius: '99px', width: '16px', height: '16px', fontSize: '10px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {proposals.filter(p => p.status === 'pending').length}
                      </span>
                    )}
                  </button>
                  <button onClick={() => { setTempProvider(provider); setTempKey(apiKey); setShowSettings(true) }}
                    style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '8px', padding: '5px 10px', cursor: 'pointer', fontSize: '15px', fontFamily: 'inherit' }}>
                    ⚙️
                  </button>
                </>
              )}
            </div>
          </div>
          <div style={{ textAlign: 'center', marginTop: '12px', position: 'relative' }}>
            <div style={{ fontSize: '20px', fontWeight: '800', letterSpacing: '-0.3px' }}>{plan.tripTitle}</div>
            <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px' }}>{done}/{total} กิจกรรม</div>
            <div style={{ margin: '10px auto 0', maxWidth: '200px', height: '5px', background: 'rgba(255,255,255,0.2)', borderRadius: '99px', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: '#38BDF8', width: (done / total * 100) + '%', transition: 'width .4s', borderRadius: '99px' }} />
            </div>
          </div>
        </div>

        {/* Currency Converter Panel */}
        {showConverter && (
          <div style={{ background: 'linear-gradient(135deg,#FFFBEB,#FEF3C7)', padding: '14px 16px', borderBottom: '1px solid rgba(245,158,11,0.2)' }}>
            <div style={{ maxWidth: '500px', margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#92400E' }}>💱 แปลงสกุลเงิน</div>
                <select value={foreignCurrency} onChange={e => setForeignCurrency(e.target.value)}
                  style={{ border: '1.5px solid #FCD34D', borderRadius: '8px', padding: '4px 8px', fontSize: '12px', fontWeight: '600', color: '#92400E', background: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {Object.entries(CURRENCY_NAMES).map(([code, name]) => (
                    <option key={code} value={code}>{name} ({code})</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '10px', fontWeight: '600', color: '#92400E', marginBottom: '4px', opacity: 0.7 }}>
                    {convertDirection === 'foreign' ? foreignCurrency : '🇹🇭 THB'}
                  </div>
                  <input type="number" value={convertAmount} onChange={e => setConvertAmount(e.target.value)}
                    placeholder="0" inputMode="decimal"
                    style={{ width: '100%', border: '1.5px solid #FCD34D', borderRadius: '10px', padding: '10px 12px', fontSize: '18px', fontWeight: '700', color: '#92400E', background: 'white', outline: 'none', fontFamily: 'inherit' }} />
                </div>
                <button onClick={() => setConvertDirection(d => d === 'foreign' ? 'thb' : 'foreign')}
                  style={{ background: '#F59E0B', border: 'none', borderRadius: '50%', width: '36px', height: '36px', color: 'white', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '14px' }}>⇄</button>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '10px', fontWeight: '600', color: '#92400E', marginBottom: '4px', opacity: 0.7 }}>
                    {convertDirection === 'foreign' ? '🇹🇭 THB' : foreignCurrency}
                  </div>
                  <div style={{ border: '1.5px solid #FCD34D', borderRadius: '10px', padding: '10px 12px', fontSize: '18px', fontWeight: '700', color: '#92400E', background: 'rgba(255,255,255,0.6)', minHeight: '44px', display: 'flex', alignItems: 'center' }}>
                    {exchangeRate && convertAmount ? (
                      convertDirection === 'foreign'
                        ? (parseFloat(convertAmount) * exchangeRate).toLocaleString('th-TH', { maximumFractionDigits: 2 })
                        : (parseFloat(convertAmount) / exchangeRate).toLocaleString('th-TH', { maximumFractionDigits: 2 })
                    ) : <span style={{ opacity: 0.3 }}>0</span>}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '11px', color: '#B45309', marginTop: '8px', textAlign: 'center', opacity: 0.8 }}>
                {exchangeRate ? `1 ${foreignCurrency} = ${exchangeRate.toLocaleString('th-TH', { maximumFractionDigits: 4 })} THB` : '⏳ กำลังโหลดอัตราแลกเปลี่ยน...'}
              </div>
            </div>
          </div>
        )}
        {/* Day tabs */}
        <div style={{ display: 'flex', gap: '8px', padding: '10px 12px', overflowX: 'auto', background: 'rgba(255,255,255,0.5)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(14,165,233,0.1)' }}>
          {plan.days.map((d, i) => (
            <button key={i} className="day-tab" onClick={() => setActiveDay(i)}
              style={{ background: i === activeDay ? COLORS[i % 7] : 'rgba(255,255,255,0.6)', color: i === activeDay ? 'white' : '#0C4A6E', borderColor: i === activeDay ? COLORS[i % 7] : 'rgba(14,165,233,0.1)' }}>
              <div style={{ fontSize: '18px' }}>{d.emoji || '📍'}</div>
              <div>วัน {d.day}</div>
              <div style={{ fontSize: '10px', opacity: .8 }}>{d.date}</div>
            </button>
          ))}
        </div>

        {/* Timeline */}
        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '12px' }}>
          <div style={{ borderRadius: '20px', overflow: 'hidden', border: `2px solid ${col}`, background: light, boxShadow: `0 4px 20px ${col}22` }}>
            <div style={{ background: `linear-gradient(135deg,${col},${col}CC)`, padding: '16px', color: 'white' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: '800' }}>{day.emoji || '📍'} {day.title}</div>
                  {day.hotel && <div style={{ fontSize: '12px', opacity: .9, marginTop: '4px' }}>🏨 {day.hotel}</div>}
                </div>
              </div>
              {/* ─── WEATHER BANNER ─── */}
              {(() => {
                const w = getWeatherForDay(planWeather, day.date); return w ? (
                  <div style={{ marginTop: '12px', background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(12px)', borderRadius: '14px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '14px', border: '1px solid rgba(255,255,255,0.25)' }}>
                    <div style={{ fontSize: '36px', lineHeight: 1, flexShrink: 0 }}>{w.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: '700', opacity: 0.9, marginBottom: '2px' }}>{w.desc}</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                        <span style={{ fontSize: '22px', fontWeight: '800' }}>{w.tempMax}°C</span>
                        <span style={{ fontSize: '14px', fontWeight: '600', opacity: 0.7 }}>/ {w.tempMin}°C</span>
                      </div>
                    </div>
                    {w.rainChance > 0 && (
                      <div style={{ textAlign: 'center', flexShrink: 0 }}>
                        <div style={{ fontSize: '16px' }}>💧</div>
                        <div style={{ fontSize: '13px', fontWeight: '700' }}>{w.rainChance}%</div>
                        <div style={{ fontSize: '9px', opacity: 0.7 }}>โอกาสฝน</div>
                      </div>
                    )}
                  </div>
                ) : !planWeather ? (
                  <div style={{ marginTop: '10px', fontSize: '12px', opacity: 0.5, textAlign: 'center' }}>⏳ กำลังโหลดพยากรณ์อากาศ...</div>
                ) : (
                  <div style={{ marginTop: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', padding: '8px 12px', textAlign: 'center' }}>
                    <span style={{ fontSize: '12px', opacity: 0.6 }}>🌤️ พยากรณ์ยังไม่ถึงวันนี้ (ข้อมูลล่วงหน้า 16 วัน)</span>
                  </div>
                )
              })()}
            </div>
            <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {day.events.map((ev, ei) => {
                const key = activeDay + '-' + ei
                const isDone = checked[key]
                const isEditing = editingKey === key
                return (
                  <div key={ei} className="event-card" style={{ opacity: isDone ? .55 : 1 }}>
                    {isEditing && isOwner ? (
                      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input className="trip-input" value={editTime} onChange={e => setEditTime(e.target.value)} placeholder="เวลา" style={{ width: '80px', padding: '7px 10px', fontSize: '12px' }} />
                          <input className="trip-input" value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="ชื่อ activity" style={{ flex: 1, padding: '7px 10px', fontSize: '13px' }} />
                        </div>
                        <input className="trip-input" value={editDetail} onChange={e => setEditDetail(e.target.value)} placeholder="รายละเอียด (optional)" style={{ padding: '7px 10px', fontSize: '12px' }} />
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn-ghost" style={{ flex: 1, padding: '7px' }} onClick={() => setEditingKey(null)}>ยกเลิก</button>
                          <button className="btn-primary" style={{ flex: 2, padding: '7px', fontSize: '13px' }} onClick={() => saveInlineEdit(activeDay, ei)}>บันทึก</button>
                        </div>
                      </div>
                    ) : (
                      <div onClick={() => { if (!isGuest) toggleCheck(key) }} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '11px', cursor: isGuest ? 'default' : 'pointer' }}>
                        <div style={{ fontSize: '11px', color: '#38BDF8', fontFamily: 'monospace', width: '36px', flexShrink: 0, paddingTop: '3px', fontWeight: '700' }}>{ev.time}</div>
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: isDone ? '#d1fae5' : light, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0, transition: 'all 0.2s' }}>
                          {isDone ? '✅' : ev.icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: '#0C4A6E', textDecoration: isDone ? 'line-through' : 'none' }}>{ev.title}</div>
                          {ev.detail && <div style={{ fontSize: '12px', color: ev.warning ? '#d97706' : '#38BDF8', marginTop: '2px' }}>{ev.detail}</div>}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                            <span style={{ display: 'inline-block', fontSize: '10px', padding: '2px 8px', borderRadius: '99px', background: light, color: col, fontWeight: '700', border: `1px solid ${col}33` }}>{ev.type}</span>
                            {/* Budget tag */}
                            {!isGuest && (
                              editingBudget === key ? (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }} onClick={e => e.stopPropagation()}>
                                  <input type="number" value={budgetInput} onChange={e => setBudgetInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') setBudgetForEvent(activeDay, ei, parseFloat(budgetInput) || 0); if (e.key === 'Escape') setEditingBudget(null) }}
                                    placeholder="0" autoFocus inputMode="decimal"
                                    style={{ width: '70px', border: '1.5px solid #F59E0B', borderRadius: '6px', padding: '2px 6px', fontSize: '11px', outline: 'none', fontFamily: 'inherit', color: '#92400E' }} />
                                  <span style={{ fontSize: '10px', color: '#92400E', fontWeight: '600' }}>{foreignCurrency}</span>
                                  <button onClick={() => setBudgetForEvent(activeDay, ei, parseFloat(budgetInput) || 0)}
                                    style={{ background: '#F59E0B', color: 'white', border: 'none', borderRadius: '4px', padding: '1px 5px', fontSize: '10px', cursor: 'pointer', fontWeight: '700' }}>✓</button>
                                </div>
                              ) : (
                                <span className="budget-tag" onClick={e => { e.stopPropagation(); setEditingBudget(key); setBudgetInput(budgetMap[key]?.toString() || '') }}>
                                  💰 {budgetMap[key] ? `${budgetMap[key].toLocaleString()} ${foreignCurrency}` : 'ใส่งบ'}
                                </span>
                              )
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                          {isOwner && (
                            <>
                              <button className="icon-btn" title="AI Suggestion" onClick={() => { setSuggestions([]); fetchSuggestions(activeDay, ei) }}
                                style={{ fontSize: '15px', opacity: 0.7 }}>✨</button>
                              <button className="icon-btn" title="แก้ไข" onClick={() => { setEditingKey(key); setEditTitle(ev.title); setEditTime(ev.time || ''); setEditDetail(ev.detail || '') }}
                                style={{ fontSize: '15px', opacity: 0.7 }}>✏️</button>
                            </>
                          )}
                          {!isGuest && (
                            <button className="icon-btn" onClick={e => { e.stopPropagation(); setShowNote(p => ({ ...p, [key]: !showNote[key] })) }}
                              style={{ fontSize: '15px', opacity: noteMap[key] ? 1 : 0.4 }} title="เพิ่ม note">📝</button>
                          )}
                        </div>
                      </div>
                    )}
                    {showNote[key] && !isEditing && (
                      <div style={{ borderTop: `1px solid ${light}`, padding: '8px 12px 10px' }}>
                        <div style={{ fontSize: '11px', color: col, fontWeight: '700', marginBottom: '5px' }}>📝 Note</div>
                        <textarea
                          style={{ width: '100%', border: `1.5px solid ${col}33`, borderRadius: '8px', padding: '7px 10px', fontSize: '13px', resize: 'none', fontFamily: 'inherit', outline: 'none', color: '#0C4A6E', background: 'rgba(255,255,255,0.7)' }}
                          rows={2} placeholder="เพิ่ม note ที่นี่..."
                          value={noteMap[key] || ''} onClick={e => e.stopPropagation()}
                          onChange={e => saveNote(key, e.target.value)} />
                        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                          <label style={{ fontSize: '11px', color: col, fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', background: `${col}15`, border: `1px solid ${col}33`, borderRadius: '8px', padding: '4px 10px' }}>
                            🖼️ แนบรูป
                            <input type="file" accept="image/*" multiple style={{ display: 'none' }}
                              onChange={e => {
                                Array.from(e.target.files).forEach(file => {
                                  const reader = new FileReader()
                                  reader.onload = ev => addPendingImage(key, ev.target.result)
                                  reader.readAsDataURL(file)
                                })
                                e.target.value = ''
                              }} />
                          </label>
                          {(pendingImages[key]?.length > 0) && (
                            <button onClick={() => saveNoteImages(key)}
                              style={{ fontSize: '11px', color: 'white', fontWeight: '700', cursor: 'pointer', background: '#10B981', border: 'none', borderRadius: '8px', padding: '4px 12px', fontFamily: 'inherit' }}>
                              💾 Save ({pendingImages[key].length} รูป)
                            </button>
                          )}
                        </div>
                        {/* Pending images (not saved yet) */}
                        {pendingImages[key]?.length > 0 && (
                          <div style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '6px' }} onClick={e => e.stopPropagation()}>
                            {pendingImages[key].map((img, idx) => (
                              <div key={idx} style={{ position: 'relative' }}>
                                <img src={img} alt="" style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '8px', border: `2px dashed ${col}55`, opacity: 0.7 }} onClick={() => setPreviewImage(img)} />
                                <span onClick={() => removePendingImage(key, idx)}
                                  style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#ef4444', color: 'white', borderRadius: '99px', width: '18px', height: '18px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: '800' }}>✕</span>
                                <div style={{ position: 'absolute', bottom: '2px', left: '2px', fontSize: '8px', background: '#f59e0b', color: 'white', padding: '1px 5px', borderRadius: '4px', fontWeight: '700' }}>ยังไม่ Save</div>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Saved images grid */}
                        {noteImages[key]?.length > 0 && (
                          <div style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '6px' }} onClick={e => e.stopPropagation()}>
                            {(Array.isArray(noteImages[key]) ? noteImages[key] : [noteImages[key]]).map((img, idx) => (
                              <div key={idx} style={{ position: 'relative', cursor: 'pointer' }}>
                                <img src={img} alt="" onClick={() => setPreviewImage(img)}
                                  style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '8px', border: `1.5px solid ${col}33` }} />
                                <span onClick={(e) => { e.stopPropagation(); removeNoteImage(key, idx) }}
                                  style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#ef4444', color: 'white', borderRadius: '99px', width: '18px', height: '18px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: '800' }}>✕</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Day Budget Summary */}
          {getDayBudget(activeDay) > 0 && (
            <div style={{ background: 'linear-gradient(135deg,rgba(255,251,235,0.9),rgba(254,243,199,0.9))', backdropFilter: 'blur(12px)', borderRadius: '16px', padding: '14px 16px', marginTop: '10px', border: '1px solid rgba(245,158,11,0.15)', boxShadow: '0 4px 15px rgba(245,158,11,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#92400E', fontWeight: '600', opacity: 0.7 }}>💰 งบวัน {plan.days[activeDay]?.day}</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: '#92400E', marginTop: '2px' }}>
                    {getDayBudget(activeDay).toLocaleString()} <span style={{ fontSize: '13px', fontWeight: '600' }}>{foreignCurrency}</span>
                  </div>
                </div>
                {exchangeRate && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', color: '#92400E', opacity: 0.5 }}>≈ THB</div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: '#B45309' }}>
                      ฿{(getDayBudget(activeDay) * exchangeRate).toLocaleString('th-TH', { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Total Trip Budget */}
          {getTotalBudget() > 0 && (
            <div style={{ background: 'linear-gradient(135deg,rgba(16,185,129,0.1),rgba(52,211,153,0.08))', backdropFilter: 'blur(12px)', borderRadius: '16px', padding: '14px 16px', marginTop: '8px', border: '1px solid rgba(16,185,129,0.15)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#065F46', fontWeight: '600', opacity: 0.7 }}>📊 งบรวมทั้งทริป</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: '#065F46', marginTop: '2px' }}>
                    {getTotalBudget().toLocaleString()} <span style={{ fontSize: '13px', fontWeight: '600' }}>{foreignCurrency}</span>
                  </div>
                </div>
                {exchangeRate && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', color: '#065F46', opacity: 0.5 }}>≈ THB</div>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#047857' }}>
                      ฿{(getTotalBudget() * exchangeRate).toLocaleString('th-TH', { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          {isOwner ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '14px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setStep('draft')}>← แก้ Notes</button>
                <button className="btn-primary" style={{ flex: 2 }} onClick={handleGenerate}>✨ Generate ใหม่</button>
              </div>
              {/* Packing List - navigate to dedicated page */}
              <div onClick={() => router.push(`/trip/packing?id=${id}`)}
                style={{ background: 'linear-gradient(135deg,#F59E0B,#F97316)', borderRadius: '14px', padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 4px 15px rgba(249,115,22,0.3)', transition: 'transform 0.2s' }}>
                <div style={{ fontSize: '28px' }}>🧳</div>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: 'white' }}>Packing List</div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)' }}>เลือกผู้เดินทาง → AI จัดกระเป๋าให้</div>
                </div>
                <div style={{ marginLeft: 'auto', fontSize: '20px', color: 'rgba(255,255,255,0.7)' }}>→</div>
              </div>
              <button className="btn-ghost" style={{ fontSize: '13px' }}
                onClick={generateGaps} disabled={gapsLoading}>
                {gapsLoading ? '⏳ กำลังวิเคราะห์...' : '🔍 เติม Slot ว่าง (AI)'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '14px' }}>
              <button className="btn-ghost" style={{ width: '100%' }} onClick={() => setStep('draft')}>← ดู Notes</button>
              {!isGuest && (
                <button className="btn-primary" style={{ width: '100%' }}
                  onClick={() => { setProposalLocalPlan(JSON.parse(JSON.stringify(plan))); setShowProposalForm(true) }}>
                  📤 เสนอแก้ไข Plan นี้
                </button>
              )}
            </div>
          )}
          <div style={{ fontSize: '11px', color: '#38BDF8', textAlign: 'center', marginTop: '10px' }}>
            {isOwner ? 'แตะกิจกรรมเพื่อติ๊ก ✅ · กด ✏️ เพื่อแก้ไข · กด ✨ เพื่อให้ AI Suggest · กด 🔗 เพื่อแชร์' : isGuest ? '👁️ ดูอย่างเดียว · สมัครสมาชิกเพื่อแก้ไข' : 'แตะกิจกรรมเพื่อติ๊ก ✅ · กด 📝 เพื่อเพิ่ม note'}
          </div>
        </div>
      </div>
    )
  }

  return null
}
