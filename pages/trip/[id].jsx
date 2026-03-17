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
  const [editLocation, setEditLocation] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editIcon, setEditIcon] = useState('')

  // Day title edit
  const [editingDayTitle, setEditingDayTitle] = useState(false)
  const [dayTitleDraft, setDayTitleDraft] = useState('')

  // Search
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)

  // Tools menu
  const [showToolsMenu, setShowToolsMenu] = useState(false)

  // Drag & drop reorder
  const [dragIdx, setDragIdx] = useState(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)

  // Approval settings
  const requireApproval = plan?.settings?.requireApproval !== false // default true
  const canEdit = isOwner || (isMember && !requireApproval)

  // AI Suggestion
  const [suggestingKey, setSuggestingKey] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [suggestLoading, setSuggestLoading] = useState(false)

  // Proposals (Submit/Approve)
  const [proposals, setProposals] = useState([])
  const [showProposals, setShowProposals] = useState(false)
  const [proposalDesc, setProposalDesc] = useState('')
  const [proposalLoading, setProposalLoading] = useState(false)
  const [expenseType, setExpenseType] = useState('shared') // 'shared' | 'personal'
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

  // Budget tracker — multi-expense per event
  // Format: { 'dayIdx-eventIdx': [ { amount, currency, userEmail, userName, ts } ] }
  const [expenses, setExpenses] = useState({})
  const [addingExpense, setAddingExpense] = useState(null) // 'dayIdx-eventIdx'
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseCurrency, setExpenseCurrency] = useState('') // auto-set from foreignCurrency

  // Members
  const [members, setMembers] = useState([])
  const [memberLocations, setMemberLocations] = useState({})
  const [sharingLocation, setSharingLocation] = useState(false)
  const [showMembers, setShowMembers] = useState(false)

  // Flight & Hotel info
  const [travelInfo, setTravelInfo] = useState({ flights: [], hotels: [] })
  const [showTravelForm, setShowTravelForm] = useState(false)
  const [editingTravel, setEditingTravel] = useState(null)
  const [travelDraft, setTravelDraft] = useState({})

  // AI Chat
  const [showChat, setShowChat] = useState(false)
  const [chatMessages, setChatMessages] = useState(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem(`chatHistory-${id}`)) || [] } catch { return [] }
  })
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  // Documents
  const [showDocs, setShowDocs] = useState(false)
  const [tripDocs, setTripDocs] = useState([])
  const [docLabel, setDocLabel] = useState('')
  const [docValue, setDocValue] = useState('')

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
      // Load images from plan_json events (shared), fallback to localStorage (legacy)
      if (savedImages) {
        const parsed = JSON.parse(savedImages)
        if (Object.keys(parsed).length > 0) setNoteImages(parsed)
      }
      const savedBudget = localStorage.getItem(`budget-${id}`)
      if (savedBudget) try {
        const parsed = JSON.parse(savedBudget)
        if (parsed && typeof parsed === 'object') {
          const migrated = {}
          Object.entries(parsed).forEach(([k, v]) => {
            if (Array.isArray(v)) migrated[k] = v
            else if (typeof v === 'number') migrated[k] = [{ amount: v, currency: 'JPY', userEmail: '', userName: 'Owner', ts: Date.now() }]
          })
          setExpenses(migrated)
        }
      } catch (e) { }
    }
  }, [session, id])

  // Travel info load
  useEffect(() => {
    if (id) {
      const saved = localStorage.getItem(`travel-${id}`)
      if (saved) try { setTravelInfo(JSON.parse(saved)) } catch (e) { }
    }
  }, [id])

  const saveTravelInfo = (info) => { setTravelInfo(info); if (id) localStorage.setItem(`travel-${id}`, JSON.stringify(info)) }
  const addFlight = (f) => { const info = { ...travelInfo, flights: [...travelInfo.flights, f] }; saveTravelInfo(info); setShowTravelForm(false) }
  const addHotel = (h) => { const info = { ...travelInfo, hotels: [...travelInfo.hotels, h] }; saveTravelInfo(info); setShowTravelForm(false) }
  const removeFlight = (i) => { const info = { ...travelInfo, flights: travelInfo.flights.filter((_, j) => j !== i) }; saveTravelInfo(info) }
  const removeHotel = (i) => { const info = { ...travelInfo, hotels: travelInfo.hotels.filter((_, j) => j !== i) }; saveTravelInfo(info) }

  // Expense helpers
  const saveExpenses = (map) => { setExpenses(map); if (id) localStorage.setItem(`budget-${id}`, JSON.stringify(map)) }
  const addExpenseEntry = (dayIdx, eventIdx) => {
    const amt = parseFloat(expenseAmount)
    if (!amt || amt <= 0) return
    const key = `${dayIdx}-${eventIdx}`
    const entry = {
      amount: amt,
      currency: expenseCurrency || foreignCurrency,
      type: expenseType || 'shared',
      userEmail: session?.user?.email || '',
      userName: session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || 'You',
      ts: Date.now()
    }
    const map = { ...expenses }
    map[key] = [...(map[key] || []), entry]
    saveExpenses(map)
    setAddingExpense(null); setExpenseAmount('')
    logActivity('💰', 'เพิ่มค่าใช้จ่าย', `${amt} ${entry.currency} วัน${dayIdx + 1}`)
  }
  const removeExpenseEntry = (key, idx) => {
    const map = { ...expenses }
    map[key] = (map[key] || []).filter((_, i) => i !== idx)
    if (map[key].length === 0) delete map[key]
    saveExpenses(map)
    logActivity('❌', 'ลบค่าใช้จ่าย', `รายการที่ ${idx + 1}`)
  }
  const getDayTotal = (dayIdx) => {
    if (!plan?.days?.[dayIdx]) return {}
    const totals = {}
    plan.days[dayIdx].events.forEach((_, ei) => {
      (expenses[`${dayIdx}-${ei}`] || []).forEach(e => { totals[e.currency] = (totals[e.currency] || 0) + e.amount })
    })
    return totals
  }
  const getTotalByCurrency = () => {
    const totals = {}
    Object.values(expenses).flat().forEach(e => { totals[e.currency] = (totals[e.currency] || 0) + e.amount })
    return totals
  }

  // Activity log
  const logActivity = (icon, action, detail) => {
    if (!id) return
    const entry = {
      icon, action, detail,
      userName: session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || 'Guest',
      userEmail: session?.user?.email || '',
      ts: Date.now()
    }
    const saved = localStorage.getItem(`activityLog-${id}`)
    const log = saved ? JSON.parse(saved) : []
    log.push(entry)
    // Keep last 200 entries
    if (log.length > 200) log.splice(0, log.length - 200)
    localStorage.setItem(`activityLog-${id}`, JSON.stringify(log))
  }

  // Save plan to localStorage for spending report
  useEffect(() => {
    if (plan && id) localStorage.setItem(`plan-${id}`, JSON.stringify(plan))
  }, [plan, id])

  // 3. Realtime — skip self-triggered updates using timestamp debounce
  const lastSavedPlanRef = useRef(null)
  const lastSaveTimeRef = useRef(0)
  const planRef = useRef(plan)
  useEffect(() => { planRef.current = plan }, [plan])

  useEffect(() => {
    if (!trip?.id) return
    const channel = supabase
      .channel(`trip-${trip.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trips', filter: `id=eq.${trip.id}` }, (payload) => {
        const updated = payload.new
        if (updated.plan_json) {
          // Skip any updates within 3 seconds of our own save
          if (Date.now() - lastSaveTimeRef.current < 3000) return
          const incoming = JSON.stringify(updated.plan_json)
          if (incoming !== JSON.stringify(planRef.current)) {
            setPlan(updated.plan_json)
            // Also sync shared images from updated plan
            const sharedImgs = {}
            updated.plan_json.days?.forEach((d, di) => {
              (d.events || []).forEach((ev, ei) => {
                if (ev.images?.length > 0) sharedImgs[`${di}-${ei}`] = ev.images
              })
            })
            if (Object.keys(sharedImgs).length > 0) setNoteImages(prev => ({ ...prev, ...sharedImgs }))
            setEditNotif('✏️ มีการอัปเดต plan')
            setTimeout(() => setEditNotif(''), 4000)
          }
        }
      }).subscribe()
    return () => supabase.removeChannel(channel)
  }, [trip?.id])

  const loadTrip = async () => {
    const headers = {}
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
    const adminParam = router.query.adminView === 'true' ? '?adminView=true' : ''
    const res = await fetch(`/api/trips/${id}${adminParam}`, { headers })
    if (!res.ok) { router.replace('/trips'); return }
    const { trip: t, role, members: m } = await res.json()
    setTrip(t)
    setTripRole(role || 'viewer')
    const owner = role === 'owner'
    setIsOwner(owner)
    setIsMember(role === 'member')
    if (m) setMembers(m)
    setDest(t.destination || '')
    setDates(t.dates || '')
    setNotes(t.notes || '')
    if (t.plan_json) {
      setPlan(t.plan_json); setStep('plan'); setShowTimeline(true)
      setPlansByLang(prev => ({ ...prev, th: t.plan_json }))
      // Load shared images from plan_json events
      const sharedImgs = {}
      t.plan_json.days?.forEach((d, di) => {
        (d.events || []).forEach((ev, ei) => {
          if (ev.images?.length > 0) sharedImgs[`${di}-${ei}`] = ev.images
        })
      })
      if (Object.keys(sharedImgs).length > 0) {
        setNoteImages(prev => ({ ...sharedImgs, ...prev }))
      }
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

  const computeChanges = (oldPlan, newPlan) => {
    const changes = []
    if (!oldPlan?.days || !newPlan?.days) return ''
    const maxDays = Math.max(oldPlan.days.length, newPlan.days.length)
    for (let d = 0; d < maxDays; d++) {
      const oldDay = oldPlan.days[d]
      const newDay = newPlan.days[d]
      if (!oldDay && newDay) { changes.push(`➕ เพิ่มวันที่ ${d + 1}: ${newDay.title}`); continue }
      if (oldDay && !newDay) { changes.push(`❌ ลบวันที่ ${d + 1}: ${oldDay.title}`); continue }
      if (oldDay.title !== newDay.title) changes.push(`✏️ วัน ${d + 1}: เปลี่ยนชื่อ "${oldDay.title}" → "${newDay.title}"`)
      const oldEvts = oldDay.events || []
      const newEvts = newDay.events || []
      const oldTitles = new Set(oldEvts.map(e => e.title))
      const newTitles = new Set(newEvts.map(e => e.title))
      newEvts.forEach(e => { if (!oldTitles.has(e.title)) changes.push(`➕ วัน${d + 1}: เพิ่ม "${e.title}"`) })
      oldEvts.forEach(e => { if (!newTitles.has(e.title)) changes.push(`❌ วัน${d + 1}: ลบ "${e.title}"`) })
      oldEvts.forEach(oe => {
        const ne = newEvts.find(e => e.title === oe.title)
        if (ne) {
          if (oe.time !== ne.time) changes.push(`⏰ วัน${d + 1} "${oe.title}": เวลา ${oe.time || "-"} → ${ne.time || "-"}`)
          if (oe.detail !== ne.detail) changes.push(`✏️ วัน${d + 1} "${oe.title}": แก้รายละเอียด`)
        }
      })
    }
    return changes.length > 0 ? changes.join('\n') : 'ไม่พบการเปลี่ยนแปลง'
  }

  const submitProposal = async () => {
    if (!proposalLocalPlan) return
    setProposalLoading(true)
    const changesSummary = computeChanges(plan, proposalLocalPlan)
    const fullDesc = (proposalDesc || 'เสนอแก้ไข plan') + '\nการเปลี่ยนแปลง:\n' + changesSummary
    try {
      const res = await fetch('/api/proposals', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ trip_id: id, plan_json: proposalLocalPlan, description: fullDesc }),
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
  const saveNoteImages = async (key) => {
    const pending = pendingImages[key] || []
    if (pending.length === 0) return
    const existing = noteImages[key] || []
    const allImgs = [...existing, ...pending]
    const next = { ...noteImages, [key]: allImgs }
    setNoteImages(next)
    localStorage.setItem(`noteImages-${id}`, JSON.stringify(next))
    setPendingImages(prev => { const p = { ...prev }; delete p[key]; return p })
    // Also save to plan_json so all members can see
    const [dayIdx, evIdx] = key.split('-').map(Number)
    if (plan?.days?.[dayIdx]?.events?.[evIdx]) {
      const newPlan = JSON.parse(JSON.stringify(plan))
      const userName = session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || 'Unknown'
      newPlan.days[dayIdx].events[evIdx].images = allImgs
      newPlan.days[dayIdx].events[evIdx].imageUploadedBy = userName
      newPlan.days[dayIdx].events[evIdx].imageUploadedAt = new Date().toISOString()
      setPlan(newPlan)
      lastSaveTimeRef.current = Date.now()
      await fetch(`/api/trips/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_json: newPlan }),
      })
    }
  }
  const removeNoteImage = async (key, idx) => {
    const imgs = [...(noteImages[key] || [])]
    imgs.splice(idx, 1)
    const next = { ...noteImages, [key]: imgs.length ? imgs : undefined }
    if (!imgs.length) delete next[key]
    setNoteImages(next)
    localStorage.setItem(`noteImages-${id}`, JSON.stringify(next))
    // Also update plan_json
    const [dayIdx, evIdx] = key.split('-').map(Number)
    if (plan?.days?.[dayIdx]?.events?.[evIdx]) {
      const newPlan = JSON.parse(JSON.stringify(plan))
      newPlan.days[dayIdx].events[evIdx].images = imgs.length ? imgs : undefined
      setPlan(newPlan)
      lastSaveTimeRef.current = Date.now()
      await fetch(`/api/trips/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_json: newPlan }),
      })
    }
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

  // Parse time string like "09:00", "9.30", "10:00-12:00" -> minutes from midnight for sorting
  const parseTimeForSort = (timeStr) => {
    if (!timeStr) return 9999 // no time = end
    const match = timeStr.match(/(\d{1,2})[:.：]?(\d{2})?/)
    if (!match) return 9999
    return parseInt(match[1]) * 60 + parseInt(match[2] || '0')
  }

  // Sort events in a day by time + remap notes/images/checked keys
  const sortEventsByTime = (newPlan, dayIdx) => {
    const events = newPlan.days[dayIdx].events
    if (!events || events.length <= 1) return newPlan

    // Build old index → event mapping with associated data
    const oldData = events.map((ev, i) => {
      const oldKey = dayIdx + '-' + i
      return { event: ev, oldKey, note: noteMap[oldKey], images: noteImages[oldKey], checked: checked[oldKey] }
    })

    // Sort by time
    oldData.sort((a, b) => parseTimeForSort(a.event.time) - parseTimeForSort(b.event.time))

    // Rebuild events array + remap notes/checked/images
    const newNotes = { ...noteMap }
    const newImages = { ...noteImages }
    const newChecked = { ...checked }

    // Clear old keys for this day first
    events.forEach((_, i) => {
      const k = dayIdx + '-' + i
      delete newNotes[k]; delete newImages[k]; delete newChecked[k]
    })

    // Set new keys
    oldData.forEach((item, newIdx) => {
      const newKey = dayIdx + '-' + newIdx
      newPlan.days[dayIdx].events[newIdx] = item.event
      if (item.note) newNotes[newKey] = item.note
      if (item.images) newImages[newKey] = item.images
      if (item.checked) newChecked[newKey] = item.checked
    })

    // Update state
    setNoteMap(newNotes)
    setNoteImages(newImages)
    setChecked(newChecked)
    localStorage.setItem(`notes-${id}`, JSON.stringify(newNotes))
    localStorage.setItem(`noteImages-${id}`, JSON.stringify(newImages))
    localStorage.setItem(`checked-${id}`, JSON.stringify(newChecked))

    return newPlan
  }

  const sortDayByTime = async () => {
    let newPlan = JSON.parse(JSON.stringify(plan))
    newPlan = sortEventsByTime(newPlan, activeDay)
    setPlan(newPlan)
    lastSaveTimeRef.current = Date.now()
    await fetch(`/api/trips/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_json: newPlan }),
    })
  }

  const saveInlineEdit = async (dayIdx, evIdx) => {
    let newPlan = JSON.parse(JSON.stringify(plan))
    const userName = session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || 'Unknown'
    newPlan.days[dayIdx].events[evIdx] = {
      ...newPlan.days[dayIdx].events[evIdx],
      title: editTitle,
      time: editTime,
      detail: editDetail,
      location: editLocation || undefined,
      icon: editIcon || undefined,
      updatedBy: userName,
      updatedAt: new Date().toISOString(),
    }
    // Save note before sorting (so it's in noteMap for remapping)
    const key = dayIdx + '-' + evIdx
    if (editNote !== (noteMap[key] || '')) {
      const next = { ...noteMap, [key]: editNote }
      setNoteMap(next)
      localStorage.setItem(`notes-${id}`, JSON.stringify(next))
    }
    // Sort events by time
    newPlan = sortEventsByTime(newPlan, dayIdx)
    setPlan(newPlan)
    setEditingKey(null)
    lastSaveTimeRef.current = Date.now()
    await fetch(`/api/trips/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_json: newPlan }),
    })
  }

  const addNewEvent = async (dayIdx) => {
    const newPlan = JSON.parse(JSON.stringify(plan))
    const userName = session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || 'Unknown'
    const newEvent = { time: '', title: '', detail: '', type: 'กิจกรรม', icon: '📌', createdBy: userName, createdAt: new Date().toISOString() }
    newPlan.days[dayIdx].events.push(newEvent)
    setPlan(newPlan)
    const newIdx = newPlan.days[dayIdx].events.length - 1
    const key = dayIdx + '-' + newIdx
    setEditingKey(key)
    setEditTitle('')
    setEditTime('')
    setEditDetail('')
    setEditLocation('')
    setEditNote('')
    setEditIcon('📌')
    lastSaveTimeRef.current = Date.now()
    await fetch(`/api/trips/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_json: newPlan }),
    })
  }

  const duplicateEvent = async (dayIdx, evIdx) => {
    const newPlan = JSON.parse(JSON.stringify(plan))
    const original = newPlan.days[dayIdx].events[evIdx]
    const copy = { ...original, title: original.title + ' (copy)' }
    newPlan.days[dayIdx].events.splice(evIdx + 1, 0, copy)
    setPlan(newPlan)
    setEditingKey(null)
    lastSaveTimeRef.current = Date.now()
    await fetch(`/api/trips/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_json: newPlan }),
    })
  }

  const moveEvent = async (dayIdx, fromIdx, toIdx) => {
    if (toIdx < 0 || toIdx >= plan.days[dayIdx].events.length) return
    const newPlan = JSON.parse(JSON.stringify(plan))
    const events = newPlan.days[dayIdx].events
    const [moved] = events.splice(fromIdx, 1)
    events.splice(toIdx, 0, moved)
    // Remap notes, images, checked
    const newNoteMap = { ...noteMap }
    const newChecked = { ...checked }
    const dayEvents = events.length
    const remapKeys = (old, src, dst) => {
      const srcKey = `${dayIdx}-${src}`
      const dstKey = `${dayIdx}-${dst}`
      if (old[srcKey] !== undefined) { old[dstKey] = old[srcKey] } else { delete old[dstKey] }
    }
    // Clear and rebuild
    for (let i = 0; i < dayEvents; i++) {
      const oldKey = `${dayIdx}-${i}`
      delete newNoteMap[oldKey]
      delete newChecked[oldKey]
    }
    // Rebuild based on original indices that we know
    setPlan(newPlan)
    setEditingKey(null)
    lastSaveTimeRef.current = Date.now()
    await fetch(`/api/trips/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_json: newPlan }),
    })
  }

  // Share my location
  const shareMyLocation = async () => {
    if (!session) return alert('กรุณาเข้าสู่ระบบก่อน')
    if (!navigator.geolocation) return alert('เบราวเซอร์ไม่รองรับ GPS')
    setSharingLocation(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await fetch('/api/location', {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ tripId: id, lat: pos.coords.latitude, lng: pos.coords.longitude })
          })
          await fetchMemberLocations()
          setSharingLocation(false)
        } catch (e) { setSharingLocation(false) }
      },
      (err) => { alert('ไม่สามารถเข้าถึงตำแหน่ง: ' + err.message); setSharingLocation(false) },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const fetchMemberLocations = async () => {
    if (!session) return
    try {
      const res = await fetch(`/api/location?tripId=${id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      const data = await res.json()
      if (data.locations) setMemberLocations(data.locations)
    } catch (e) { }
  }

  const timeAgo = (dateStr) => {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
    if (diff < 60) return 'เมื่อกี้'
    if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`
    if (diff < 86400) return `${Math.floor(diff / 3600)} ชั่วโมงที่แล้ว`
    return `${Math.floor(diff / 86400)} วันที่แล้ว`
  }

  const exportDayToGoogleMaps = (dayIdx) => {
    const day = plan?.days?.[dayIdx]
    if (!day) return
    const locs = (day.events || []).filter(ev => ev.location).map(ev => ev.location)
    if (locs.length === 0) return alert('ยังไม่มีสถานที่ในวันนี้ กดแก้ไข ✏️ เพื่อใส่สถานที่ก่อน')
    const CHUNK = 10
    const chunks = []
    for (let i = 0; i < locs.length; i += CHUNK) chunks.push(locs.slice(i, i + CHUNK))
    chunks.forEach((chunk, ci) => {
      if (chunk.length === 1) {
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(chunk[0])}`, '_blank')
        return
      }
      const origin = encodeURIComponent(chunk[0])
      const dest = encodeURIComponent(chunk[chunk.length - 1])
      const waypoints = chunk.slice(1, -1).map(l => encodeURIComponent(l)).join('|')
      let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=driving`
      if (waypoints) url += `&waypoints=${waypoints}`
      setTimeout(() => window.open(url, '_blank'), ci * 300)
    })
    if (chunks.length > 1) alert(`มี ${locs.length} จุด แบ่งเป็น ${chunks.length} ช่วง เปิด Google Maps ${chunks.length} แท็บ`)
  }

  // AI Chat
  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatLoading) return
    const userMsg = { role: 'user', text: chatInput.trim() }
    setChatMessages(prev => { const next = [...prev, userMsg]; localStorage.setItem(`chatHistory-${id}`, JSON.stringify(next)); return next })
    setChatInput('')
    setChatLoading(true)
    try {
      const itinerarySummary = plan?.days?.map(d => `${d.title}: ${(d.events || []).map(e => e.title).join(', ')}`).join(' | ') || ''
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.text,
          history: chatMessages.slice(-10),
          tripContext: { destination: trip?.destination, dates: trip?.dates, notes: trip?.notes, itinerary: itinerarySummary }
        })
      })
      const data = await res.json()
      const assistantMsg = { role: 'assistant', text: data.reply || 'ขอโทษครับ เกิดข้อผิดพลาด' }
      setChatMessages(prev => { const next = [...prev, assistantMsg]; localStorage.setItem(`chatHistory-${id}`, JSON.stringify(next)); return next })
    } catch (e) {
      setChatMessages(prev => { const next = [...prev, { role: 'assistant', text: '❌ เกิดข้อผิดพลาด ลองใหม่อีกครั้ง' }]; localStorage.setItem(`chatHistory-${id}`, JSON.stringify(next)); return next })
    }
    setChatLoading(false)
  }

  // Documents
  // Encryption helpers for documents
  const getDocKey = async () => {
    const enc = new TextEncoder()
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(`trip-docs-${id}-salt-v1`), 'PBKDF2', false, ['deriveKey'])
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: enc.encode('trip-planner-docs'), iterations: 100000, hash: 'SHA-256' }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  }
  const encryptData = async (data) => {
    const key = await getDocKey()
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const enc = new TextEncoder()
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(data)))
    return JSON.stringify({ iv: Array.from(iv), data: Array.from(new Uint8Array(encrypted)) })
  }
  const decryptData = async (stored) => {
    const key = await getDocKey()
    const { iv, data } = JSON.parse(stored)
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(iv) }, key, new Uint8Array(data))
    return JSON.parse(new TextDecoder().decode(decrypted))
  }

  const loadDocs = async () => {
    const saved = localStorage.getItem(`docs-${id}`)
    if (!saved) return
    try {
      // Try encrypted format first
      const docs = await decryptData(saved)
      setTripDocs(docs)
    } catch (e) {
      // Fallback: old unencrypted format → migrate
      try {
        const docs = JSON.parse(saved)
        setTripDocs(docs)
        // Re-save encrypted
        const encrypted = await encryptData(docs)
        localStorage.setItem(`docs-${id}`, encrypted)
      } catch (e2) { }
    }
  }
  const saveDocs = async (docs) => {
    setTripDocs(docs)
    const encrypted = await encryptData(docs)
    localStorage.setItem(`docs-${id}`, encrypted)
  }
  const addDoc = () => {
    if (!docLabel.trim() || !docValue.trim()) return
    saveDocs([...tripDocs, { label: docLabel.trim(), value: docValue.trim() }])
    setDocLabel(''); setDocValue('')
  }
  const removeDoc = (idx) => saveDocs(tripDocs.filter((_, i) => i !== idx))

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
    logActivity(next[key] ? '✅' : '⬜', next[key] ? 'เสร็จกิจกรรม' : 'ยกเลิกเสร็จ', key)
  }

  const saveNote = (key, val) => {
    const next = { ...noteMap, [key]: val }
    setNoteMap(next)
    localStorage.setItem(`notes-${id}`, JSON.stringify(next))
    if (val) logActivity('📝', 'เพิ่ม/แก้ไข note', key)
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
    .modal-overlay { position:fixed; inset:0; background:rgba(12,74,110,0.4); backdrop-filter:blur(8px); z-index:999; display:flex; align-items:flex-end; justify-content:center; animation:fadeIn 0.2s ease; overflow-y:auto; -webkit-overflow-scrolling:touch; }
    .modal-sheet { background:rgba(255,255,255,0.97); backdrop-filter:blur(24px); border-radius:28px 28px 0 0; padding:24px 20px 40px; width:100%; max-width:540px; border:1px solid rgba(255,255,255,0.95); box-shadow:0 -8px 40px rgba(14,165,233,0.15); animation:slideUp 0.3s ease; max-height:85vh; overflow-y:auto; -webkit-overflow-scrolling:touch; }
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
                    <div style={{ fontSize: '12px', color: '#38BDF8', whiteSpace: 'pre-line' }}>{p.description}</div>
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

        <div className="container-main" style={{ padding: '20px 16px 60px' }}>
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

      {/* Role Banner */}
      {!isOwner && (
        isGuest ? (
          <div style={{ background: 'linear-gradient(135deg,#F97316,#FB923C)', color: 'white', padding: '10px 16px', textAlign: 'center', fontSize: '13px', fontWeight: '600' }}>
            👁️ คุณกำลังดูในฐานะ Guest ·
            <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => router.push(`/login?next=/trip/${id}`)}>
              สมัครสมาชิกเพื่อแก้ไขร่วมกัน →
            </span>
          </div>
        ) : isMember ? (
          <div style={{ background: 'linear-gradient(135deg,#10B981,#34D399)', color: 'white', padding: '8px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '600' }}>
            👥 คุณร่วมทริปนี้แล้ว · สามารถเพิ่ม note, ติ๊กกิจกรรม, ใส่งบประมาณได้
          </div>
        ) : null
      )}

      <div className="container-main" style={{ padding: '16px' }}>
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

        {/* Travel Info Modal */}
        {showTravelForm && (
          <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowTravelForm(false) }}>
            <div className="modal-sheet" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
              <div style={{ width: '40px', height: '4px', background: '#BAE6FD', borderRadius: '99px', margin: '0 auto 20px' }} />
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#0C4A6E', marginBottom: '16px' }}>✈️ เที่ยวบิน & ที่พัก & เอกสาร</div>

              {/* Existing Flights */}
              {travelInfo.flights.map((f, i) => (
                <div key={i} style={{ background: 'linear-gradient(135deg,#EFF6FF,#DBEAFE)', borderRadius: '14px', padding: '12px', marginBottom: '8px', position: 'relative' }}>
                  <button onClick={() => removeFlight(i)} style={{ position: 'absolute', top: '6px', right: '8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', opacity: 0.5 }}>✕</button>
                  <div style={{ fontWeight: '800', fontSize: '14px', color: '#1E40AF' }}>✈️ {f.airline} {f.flightNo}</div>
                  <div style={{ fontSize: '12px', color: '#3B82F6', marginTop: '4px' }}>
                    🛫 {f.departure || '-'} → 🛬 {f.arrival || '-'} {f.terminal ? `· Terminal ${f.terminal}` : ''}
                  </div>
                </div>
              ))}

              {/* Existing Hotels */}
              {travelInfo.hotels.map((h, i) => (
                <div key={i} style={{ background: 'linear-gradient(135deg,#FFF7ED,#FEF3C7)', borderRadius: '14px', padding: '12px', marginBottom: '8px', position: 'relative' }}>
                  <button onClick={() => removeHotel(i)} style={{ position: 'absolute', top: '6px', right: '8px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', opacity: 0.5 }}>✕</button>
                  <div style={{ fontWeight: '800', fontSize: '14px', color: '#92400E' }}>🏨 {h.name}</div>
                  <div style={{ fontSize: '12px', color: '#B45309', marginTop: '4px' }}>
                    📍 {h.address || '-'} {h.bookingRef ? `· Ref: ${h.bookingRef}` : ''}
                  </div>
                  <div style={{ fontSize: '11px', color: '#D97706', marginTop: '2px' }}>
                    Check-in {h.checkIn || '-'} → Check-out {h.checkOut || '-'}
                  </div>
                </div>
              ))}

              {/* Add Flight Form */}
              {editingTravel === 'flight' ? (
                <div style={{ background: '#F0F9FF', borderRadius: '12px', padding: '12px', marginTop: '8px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#0369A1', marginBottom: '8px' }}>✈️ เพิ่มเที่ยวบิน</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    <input placeholder="สายการบิน" value={travelDraft.airline || ''} onChange={e => setTravelDraft(d => ({ ...d, airline: e.target.value }))}
                      style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #BAE6FD', fontSize: '13px', fontFamily: 'inherit' }} />
                    <input placeholder="เลขเที่ยวบิน" value={travelDraft.flightNo || ''} onChange={e => setTravelDraft(d => ({ ...d, flightNo: e.target.value }))}
                      style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #BAE6FD', fontSize: '13px', fontFamily: 'inherit' }} />
                    <input placeholder="ออก (เช่น 09:00)" value={travelDraft.departure || ''} onChange={e => setTravelDraft(d => ({ ...d, departure: e.target.value }))}
                      style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #BAE6FD', fontSize: '13px', fontFamily: 'inherit' }} />
                    <input placeholder="ถึง (เช่น 14:30)" value={travelDraft.arrival || ''} onChange={e => setTravelDraft(d => ({ ...d, arrival: e.target.value }))}
                      style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #BAE6FD', fontSize: '13px', fontFamily: 'inherit' }} />
                    <input placeholder="Terminal" value={travelDraft.terminal || ''} onChange={e => setTravelDraft(d => ({ ...d, terminal: e.target.value }))}
                      style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #BAE6FD', fontSize: '13px', fontFamily: 'inherit' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                    <button onClick={() => setEditingTravel(null)} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #BAE6FD', background: 'white', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }}>ยกเลิก</button>
                    <button onClick={() => { if (travelDraft.airline) { addFlight(travelDraft); setTravelDraft({}); setEditingTravel(null) } }}
                      style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', background: '#0EA5E9', color: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'inherit' }}>บันทึก</button>
                  </div>
                </div>
              ) : editingTravel === 'hotel' ? (
                <div style={{ background: '#FFF7ED', borderRadius: '12px', padding: '12px', marginTop: '8px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#92400E', marginBottom: '8px' }}>🏨 เพิ่มที่พัก</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    <input placeholder="ชื่อที่พัก" value={travelDraft.name || ''} onChange={e => setTravelDraft(d => ({ ...d, name: e.target.value }))}
                      style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #FED7AA', fontSize: '13px', fontFamily: 'inherit', gridColumn: '1 / -1' }} />
                    <input placeholder="ที่อยู่" value={travelDraft.address || ''} onChange={e => setTravelDraft(d => ({ ...d, address: e.target.value }))}
                      style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #FED7AA', fontSize: '13px', fontFamily: 'inherit', gridColumn: '1 / -1' }} />
                    <input placeholder="Check-in (เช่น 15:00)" value={travelDraft.checkIn || ''} onChange={e => setTravelDraft(d => ({ ...d, checkIn: e.target.value }))}
                      style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #FED7AA', fontSize: '13px', fontFamily: 'inherit' }} />
                    <input placeholder="Check-out (เช่น 11:00)" value={travelDraft.checkOut || ''} onChange={e => setTravelDraft(d => ({ ...d, checkOut: e.target.value }))}
                      style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #FED7AA', fontSize: '13px', fontFamily: 'inherit' }} />
                    <input placeholder="Booking Ref" value={travelDraft.bookingRef || ''} onChange={e => setTravelDraft(d => ({ ...d, bookingRef: e.target.value }))}
                      style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #FED7AA', fontSize: '13px', fontFamily: 'inherit', gridColumn: '1 / -1' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                    <button onClick={() => setEditingTravel(null)} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #FED7AA', background: 'white', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }}>ยกเลิก</button>
                    <button onClick={() => { if (travelDraft.name) { addHotel(travelDraft); setTravelDraft({}); setEditingTravel(null) } }}
                      style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', background: '#F59E0B', color: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'inherit' }}>บันทึก</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button onClick={() => { setTravelDraft({}); setEditingTravel('flight') }}
                    style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '2px dashed #BAE6FD', background: 'rgba(14,165,233,0.05)', cursor: 'pointer', fontSize: '13px', fontWeight: '700', color: '#0369A1', fontFamily: 'inherit' }}>
                    ✈️ + เที่ยวบิน
                  </button>
                  <button onClick={() => { setTravelDraft({}); setEditingTravel('hotel') }}
                    style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '2px dashed #FED7AA', background: 'rgba(245,158,11,0.05)', cursor: 'pointer', fontSize: '13px', fontWeight: '700', color: '#92400E', fontFamily: 'inherit' }}>
                    🏨 + ที่พัก
                  </button>
                </div>
              )}

              <button onClick={() => setShowTravelForm(false)}
                className="btn-ghost" style={{ width: '100%', marginTop: '16px' }}>ปิด</button>

              {/* Documents Section */}
              <div style={{ borderTop: '2px solid rgba(14,165,233,0.1)', marginTop: '20px', paddingTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ fontSize: '16px', fontWeight: '800', color: '#0C4A6E' }}>📄 เอกสารสำคัญ</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#065F46', background: 'rgba(16,185,129,0.08)', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(16,185,129,0.15)' }}>
                    🔐 AES-256 Encrypted
                  </div>
                </div>

                {/* Add doc */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                  <input value={docLabel} onChange={e => setDocLabel(e.target.value)} placeholder="ชื่อ (เช่น Passport)"
                    style={{ flex: 1, padding: '7px 10px', borderRadius: '8px', border: '1.5px solid #BAE6FD', fontSize: '12px', fontFamily: 'inherit', outline: 'none' }} />
                  <input value={docValue} onChange={e => setDocValue(e.target.value)} placeholder="ค่า (เช่น AB1234567)"
                    onKeyDown={e => { if (e.key === 'Enter') addDoc() }}
                    style={{ flex: 1, padding: '7px 10px', borderRadius: '8px', border: '1.5px solid #BAE6FD', fontSize: '12px', fontFamily: 'inherit', outline: 'none' }} />
                  <button onClick={addDoc}
                    style={{ background: '#0EA5E9', color: 'white', border: 'none', borderRadius: '8px', padding: '7px 12px', cursor: 'pointer', fontSize: '14px', fontWeight: '700', fontFamily: 'inherit' }}>+</button>
                </div>

                {/* File upload */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', background: 'rgba(14,165,233,0.04)', border: '2px dashed rgba(14,165,233,0.15)', borderRadius: '10px', cursor: 'pointer', marginBottom: '10px' }}>
                  <span style={{ fontSize: '16px' }}>📎</span>
                  <span style={{ fontSize: '12px', color: '#0369A1', fontWeight: '600' }}>แนบไฟล์ (รูป, PDF, เอกสาร)</span>
                  <input type="file" accept="image/*,.pdf,.doc,.docx" multiple style={{ display: 'none' }}
                    onChange={e => {
                      Array.from(e.target.files).forEach(file => {
                        const reader = new FileReader()
                        reader.onload = ev => {
                          saveDocs([...tripDocs, { label: `📎 ${file.name}`, value: ev.target.result, isFile: true, fileType: file.type, fileName: file.name }])
                        }
                        reader.readAsDataURL(file)
                      })
                      e.target.value = ''
                    }} />
                </label>

                {/* Document list */}
                {tripDocs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '16px', color: '#94A3B8', fontSize: '12px' }}>
                    ยังไม่มีเอกสาร
                    <div style={{ marginTop: '6px', fontSize: '11px', color: '#CBD5E1' }}>
                      ตัวอย่าง: Booking Ref, Passport, ประกันภัย, WiFi Password, e-Ticket
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {tripDocs.map((doc, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: 'rgba(14,165,233,0.04)', borderRadius: '10px', border: '1px solid rgba(14,165,233,0.08)' }}>
                        {doc.isFile ? (
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>{doc.fileName}</div>
                            {doc.fileType?.startsWith('image/') ? (
                              <img src={doc.value} alt={doc.fileName} onClick={() => setPreviewImage(doc.value)}
                                style={{ width: '100%', maxHeight: '120px', objectFit: 'cover', borderRadius: '8px', marginTop: '4px', cursor: 'pointer' }} />
                            ) : (
                              <a href={doc.value} download={doc.fileName}
                                style={{ fontSize: '12px', color: '#0EA5E9', fontWeight: '600', marginTop: '4px', display: 'inline-block' }}>⬇️ ดาวน์โหลด</a>
                            )}
                          </div>
                        ) : (
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>{doc.label}</div>
                            <div style={{ fontSize: '14px', fontWeight: '700', color: '#0C4A6E', fontFamily: 'monospace', marginTop: '2px', wordBreak: 'break-all' }}>{doc.value}</div>
                          </div>
                        )}
                        {!doc.isFile && (
                          <button onClick={() => navigator.clipboard?.writeText(doc.value)}
                            style={{ background: 'rgba(14,165,233,0.1)', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px', flexShrink: 0 }}>📋</button>
                        )}
                        <button onClick={() => removeDoc(i)}
                          style={{ background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px', color: '#EF4444', flexShrink: 0 }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {/* Members Modal */}
        {showMembers && (
          <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowMembers(false) }}>
            <div className="modal-sheet">
              <div style={{ width: '40px', height: '4px', background: '#BAE6FD', borderRadius: '99px', margin: '0 auto 20px' }} />
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#0C4A6E', marginBottom: '16px' }}>👥 สมาชิกทริป</div>
              <button onClick={shareMyLocation} disabled={sharingLocation}
                style={{ width: '100%', padding: '10px', marginBottom: '12px', background: sharingLocation ? 'rgba(16,185,129,0.1)' : 'linear-gradient(135deg,#065F46,#10B981)', border: 'none', color: sharingLocation ? '#10B981' : 'white', borderRadius: '12px', cursor: 'pointer', fontSize: '14px', fontWeight: '700', fontFamily: 'inherit' }}>
                {sharingLocation ? '⏳ กำลังส่งตำแหน่ง...' : '📍 แชร์ตำแหน่งปัจจุบัน'}
              </button>
              {members.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#94A3B8', fontSize: '14px' }}>
                  ยังไม่มีสมาชิก · แชร์ลิงก์เพื่อเชิญเพื่อนร่วมทริป
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {members.map((m, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: 'rgba(14,165,233,0.04)', borderRadius: '12px', border: '1px solid rgba(14,165,233,0.08)' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg,#0EA5E9,#38BDF8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', color: 'white', fontWeight: '800', flexShrink: 0 }}>
                        {m.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: '#0C4A6E' }}>{m.name}</div>
                        <div style={{ fontSize: '11px', color: '#64748B', marginTop: '1px' }}>{m.email}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: '10px', fontWeight: '700', color: m.role === 'member' ? '#10B981' : '#94A3B8', textTransform: 'uppercase', background: m.role === 'member' ? 'rgba(16,185,129,0.1)' : 'rgba(148,163,184,0.1)', padding: '2px 8px', borderRadius: '6px' }}>{m.role}</div>
                        <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '4px' }}>{new Date(m.joinedAt).toLocaleDateString('th-TH')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button className="btn-ghost" style={{ width: '100%', marginTop: '16px' }} onClick={() => setShowMembers(false)}>ปิด</button>

              {/* Member Locations */}
              {Object.keys(memberLocations).length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: '#0C4A6E', marginBottom: '8px' }}>📍 ตำแหน่งล่าสุด</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {Object.values(memberLocations).map((loc, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'linear-gradient(135deg, rgba(16,185,129,0.05), rgba(16,185,129,0.02))', borderRadius: '12px', border: '1px solid rgba(16,185,129,0.12)' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'linear-gradient(135deg,#10B981,#34D399)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: 'white', fontWeight: '800', flexShrink: 0 }}>
                          {loc.name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: '#065F46' }}>{loc.name}</div>
                          <div style={{ fontSize: '10px', color: '#64748B', marginTop: '1px' }}>🕒 {timeAgo(loc.updatedAt)}</div>
                        </div>
                        <a href={`https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`} target="_blank" rel="noopener noreferrer"
                          style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.2)', color: '#10B981', borderRadius: '8px', padding: '4px 10px', fontSize: '11px', fontWeight: '700', textDecoration: 'none', flexShrink: 0 }}>
                          🗺️ Maps
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )
        }
        {
          previewImage && (
            <div onClick={() => setPreviewImage(null)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out', padding: '20px' }}>
              <img src={previewImage} alt="preview"
                style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: '12px', objectFit: 'contain', boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }} />
              <div style={{ position: 'absolute', top: '16px', right: '16px', color: 'white', fontSize: '28px', cursor: 'pointer', opacity: 0.8 }}>✕</div>
            </div>
          )
        }

        {/* Notifications */}
        {
          editNotif && (
            <div style={{ position: 'fixed', top: '16px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(12,74,110,0.9)', backdropFilter: 'blur(8px)', color: 'white', padding: '8px 18px', borderRadius: '99px', fontSize: '13px', zIndex: 1000, boxShadow: '0 4px 16px rgba(14,165,233,0.3)', border: '1px solid rgba(255,255,255,0.2)' }}>
              {editNotif}
            </div>
          )
        }
        {
          shareToast && (
            <div style={{ position: 'fixed', top: '16px', left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg,#10B981,#34D399)', color: 'white', padding: '8px 18px', borderRadius: '99px', fontSize: '13px', zIndex: 1000, boxShadow: '0 4px 16px rgba(16,185,129,0.35)' }}>
              ✅ คัดลอก link แล้ว!
            </div>
          )
        }
        {
          apiError && (
            <div style={{ position: 'fixed', top: '60px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(185,28,28,0.95)', backdropFilter: 'blur(8px)', color: 'white', padding: '8px 18px', borderRadius: '99px', fontSize: '13px', zIndex: 1000, boxShadow: '0 4px 16px rgba(185,28,28,0.3)', cursor: 'pointer', maxWidth: '90vw', textAlign: 'center' }}
              onClick={() => setApiError('')}>
              ⚠️ {apiError} · แตะเพื่อปิด
            </div>
          )
        }

        {/* Role Banner */}
        {
          !isOwner && (
            isGuest ? (
              <div style={{ background: 'linear-gradient(135deg,#F97316,#FB923C)', color: 'white', padding: '10px 16px', textAlign: 'center', fontSize: '13px', fontWeight: '600' }}>
                👁️ คุณกำลังดูในฐานะ Guest ·
                <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => router.push(`/login?next=/trip/${id}`)}>
                  สมัครสมาชิกเพื่อแก้ไขร่วมกัน →
                </span>
              </div>
            ) : isMember ? (
              <div style={{ background: 'linear-gradient(135deg,#10B981,#34D399)', color: 'white', padding: '8px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '600' }}>
                👥 คุณร่วมทริปนี้แล้ว · สามารถเพิ่ม note, ติ๊กกิจกรรม, ใส่งบประมาณได้
              </div>
            ) : null
          )
        }

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg,#0C4A6E,#0EA5E9)', color: 'white', padding: '16px', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: '200px', height: '100%', background: 'radial-gradient(at top right, rgba(56,189,248,0.3), transparent)', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
            <button onClick={() => router.push('/trips')}
              style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '8px', padding: '5px 10px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: 'inherit', backdropFilter: 'blur(4px)' }}>
              ← Trips
            </button>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button onClick={() => { setShowTravelForm(true); loadDocs() }}
                style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '10px', padding: '8px 14px', cursor: 'pointer', fontSize: '18px', fontWeight: '600', fontFamily: 'inherit' }}>
                ✈️
              </button>
              <button onClick={() => setShowChat(true)}
                style={{ background: 'linear-gradient(135deg,rgba(139,92,246,0.4),rgba(14,165,233,0.4))', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '10px', padding: '8px 14px', cursor: 'pointer', fontSize: '18px', fontWeight: '600', fontFamily: 'inherit' }}>
                💬
              </button>
              <button onClick={shareMyLocation} disabled={sharingLocation}
                style={{ background: sharingLocation ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '10px', padding: '8px 14px', cursor: 'pointer', fontSize: '18px', fontWeight: '600', fontFamily: 'inherit' }}>
                {sharingLocation ? '⏳' : '📍'}
              </button>
              <button onClick={copyShareLink}
                style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '10px', padding: '8px 14px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', fontFamily: 'inherit' }}>
                🔗 แชร์
              </button>
              <button onClick={() => setShowConverter(c => !c)}
                style={{ background: showConverter ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '10px', padding: '8px 14px', cursor: 'pointer', fontSize: '18px', fontWeight: '600', fontFamily: 'inherit' }}>
                💱
              </button>
              {isOwner && (
                <>
                  <button onClick={() => { loadProposals(trip.id); setShowProposals(true) }}
                    style={{ position: 'relative', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '10px', padding: '8px 14px', cursor: 'pointer', fontSize: '18px', fontWeight: '600', fontFamily: 'inherit' }}>
                    🔔
                    {proposals.filter(p => p.status === 'pending').length > 0 && (
                      <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#F97316', borderRadius: '99px', width: '16px', height: '16px', fontSize: '10px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {proposals.filter(p => p.status === 'pending').length}
                      </span>
                    )}
                  </button>
                  <button onClick={() => { setTempProvider(provider); setTempKey(apiKey); setShowSettings(true) }}
                    style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '10px', padding: '8px 14px', cursor: 'pointer', fontSize: '18px', fontFamily: 'inherit' }}>
                    ⚙️
                  </button>
                  <button onClick={() => { setShowMembers(true); fetchMemberLocations() }}
                    style={{ position: 'relative', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '10px', padding: '8px 14px', cursor: 'pointer', fontSize: '18px', fontWeight: '600', fontFamily: 'inherit' }}>
                    👥
                    {members.length > 0 && (
                      <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#10B981', borderRadius: '99px', width: '16px', height: '16px', fontSize: '10px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {members.length}
                      </span>
                    )}
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

        {/* Location Bar */}
        {Object.keys(memberLocations).length > 0 && (
          <div style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(16,185,129,0.02))', padding: '8px 16px', borderBottom: '1px solid rgba(16,185,129,0.1)', display: 'flex', gap: '8px', overflowX: 'auto', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#065F46', fontWeight: '700', flexShrink: 0 }}>📍</span>
            {Object.values(memberLocations).map((loc, i) => (
              <a key={i} href={`https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', background: 'white', borderRadius: '99px', border: '1px solid rgba(16,185,129,0.15)', textDecoration: 'none', flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '99px', background: 'linear-gradient(135deg,#10B981,#34D399)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: 'white', fontWeight: '800' }}>
                  {loc.name?.[0]?.toUpperCase() || '?'}
                </div>
                <span style={{ fontSize: '11px', fontWeight: '600', color: '#065F46' }}>{loc.name?.split(' ')[0]}</span>
                <span style={{ fontSize: '9px', color: '#94A3B8' }}>{timeAgo(loc.updatedAt)}</span>
              </a>
            ))}
          </div>
        )}

        {/* Currency Converter Panel */}
        {
          showConverter && (
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
          )
        }
        {/* Travel Info Cards */}
        {
          (travelInfo.flights.length > 0 || travelInfo.hotels.length > 0) && (
            <div style={{ padding: '8px 12px', display: 'flex', gap: '6px', overflowX: 'auto', background: 'rgba(255,255,255,0.3)' }}>
              {travelInfo.flights.map((f, i) => (
                <div key={`f${i}`} onClick={() => setShowTravelForm(true)} style={{ flexShrink: 0, background: 'linear-gradient(135deg,#EFF6FF,#DBEAFE)', borderRadius: '10px', padding: '8px 12px', cursor: 'pointer', minWidth: '140px', border: '1px solid rgba(59,130,246,0.15)' }}>
                  <div style={{ fontSize: '12px', fontWeight: '800', color: '#1E40AF' }}>✈️ {f.airline} {f.flightNo}</div>
                  <div style={{ fontSize: '10px', color: '#3B82F6', marginTop: '2px' }}>🛥 {f.departure || '-'} → 🛤 {f.arrival || '-'}</div>
                </div>
              ))}
              {travelInfo.hotels.map((h, i) => (
                <div key={`h${i}`} onClick={() => setShowTravelForm(true)} style={{ flexShrink: 0, background: 'linear-gradient(135deg,#FFF7ED,#FEF3C7)', borderRadius: '10px', padding: '8px 12px', cursor: 'pointer', minWidth: '140px', border: '1px solid rgba(245,158,11,0.15)' }}>
                  <div style={{ fontSize: '12px', fontWeight: '800', color: '#92400E' }}>🏨 {h.name}</div>
                  <div style={{ fontSize: '10px', color: '#D97706', marginTop: '2px' }}>In {h.checkIn || '-'} Out {h.checkOut || '-'}</div>
                </div>
              ))}
            </div>
          )
        }
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

        {/* Search bar */}
        {showSearch && (
          <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(14,165,233,0.1)' }}>
            <input className="trip-input" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="🔍 ค้นหากิจกรรม ร้านอาหาร สถานที่..."
              autoFocus style={{ padding: '8px 14px', fontSize: '13px' }} />
            {searchQuery.trim() && (
              <div style={{ maxHeight: '200px', overflowY: 'auto', marginTop: '6px' }}>
                {plan.days.flatMap((d, di) =>
                  (d.events || []).map((ev, ei) => ({ ev, di, ei, day: d }))
                ).filter(({ ev }) =>
                  (ev.title + ' ' + (ev.detail || '') + ' ' + (ev.location || '')).toLowerCase().includes(searchQuery.toLowerCase())
                ).map(({ ev, di, day }, idx) => (
                  <div key={idx} onClick={() => { setActiveDay(di); setShowSearch(false); setSearchQuery('') }}
                    style={{ padding: '6px 10px', fontSize: '12px', cursor: 'pointer', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', background: idx % 2 === 0 ? 'rgba(14,165,233,0.04)' : 'transparent' }}>
                    <span style={{ fontSize: '14px' }}>{ev.icon || '📍'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '700', color: '#0C4A6E' }}>{ev.title}</div>
                      <div style={{ fontSize: '10px', color: '#64748B' }}>วัน {day.day} {ev.time ? `· ${ev.time}` : ''}</div>
                    </div>
                  </div>
                ))}
                {plan.days.flatMap((d) => (d.events || []).filter(ev => (ev.title + ' ' + (ev.detail || '') + ' ' + (ev.location || '')).toLowerCase().includes(searchQuery.toLowerCase()))).length === 0 && (
                  <div style={{ textAlign: 'center', padding: '12px', color: '#94A3B8', fontSize: '12px' }}>ไม่พบผลลัพธ์</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Timeline */}
        <div className="container-main" style={{ padding: '12px' }}>
          <div style={{ borderRadius: '20px', overflow: 'hidden', border: `2px solid ${col}`, background: light, boxShadow: `0 4px 20px ${col}22` }}>
            <div style={{ background: `linear-gradient(135deg,${col},${col}CC)`, padding: '16px', color: 'white' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  {editingDayTitle && (isOwner || !isGuest) ? (
                    <input value={dayTitleDraft} onChange={e => setDayTitleDraft(e.target.value)}
                      autoFocus
                      onBlur={() => {
                        const newPlan = JSON.parse(JSON.stringify(plan)); newPlan.days[activeDay].title = dayTitleDraft; setPlan(newPlan); setEditingDayTitle(false);
                        lastSaveTimeRef.current = Date.now();
                        fetch(`/api/trips/${id}`, { method: 'PATCH', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ plan_json: newPlan }) })
                      }}
                      onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
                      style={{ fontSize: '18px', fontWeight: '800', background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '8px', color: 'white', padding: '4px 8px', width: '100%', fontFamily: 'inherit', outline: 'none' }}
                    />
                  ) : (
                    <div style={{ fontSize: '18px', fontWeight: '800', cursor: (isOwner || !isGuest) ? 'pointer' : 'default' }}
                      onClick={() => { if (isOwner || !isGuest) { setEditingDayTitle(true); setDayTitleDraft(day.title || '') } }}
                      title={(isOwner || !isGuest) ? 'กดเพื่อแก้ไขชื่อวัน' : ''}>
                      {day.emoji || '📍'} {day.title}
                    </div>
                  )}
                  {day.hotel && <div style={{ fontSize: '12px', opacity: .9, marginTop: '4px' }}>🏨 {day.hotel}</div>}
                </div>
                {/* Google Maps export */}
                {(day.events || []).some(ev => ev.location) && (
                  <button onClick={() => exportDayToGoogleMaps(activeDay)}
                    style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', borderRadius: '10px', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    🗺️ Maps
                  </button>
                )}
                {(isOwner || !isGuest) && (
                  <button onClick={sortDayByTime}
                    style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', borderRadius: '10px', padding: '6px 10px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', fontFamily: 'inherit', flexShrink: 0 }}
                    title="เรียงกิจกรรมตามเวลา">
                    🔄
                  </button>
                )}
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
                  <div key={ei} className="event-card"
                    draggable={!isEditing && (isOwner || !isGuest)}
                    onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; setDragIdx(ei) }}
                    onDragOver={e => { e.preventDefault(); setDragOverIdx(ei) }}
                    onDragEnd={() => { if (dragIdx !== null && dragOverIdx !== null && dragIdx !== dragOverIdx) moveEvent(activeDay, dragIdx, dragOverIdx); setDragIdx(null); setDragOverIdx(null) }}
                    style={{ opacity: isDone ? .55 : 1, borderTop: dragOverIdx === ei && dragIdx !== null && dragIdx > ei ? `3px solid ${col}` : 'none', borderBottom: dragOverIdx === ei && dragIdx !== null && dragIdx < ei ? `3px solid ${col}` : 'none', transition: 'border 0.15s' }}>
                    {isEditing && (isOwner || !isGuest) ? (
                      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input className="trip-input" value={editTime} onChange={e => setEditTime(e.target.value)} placeholder="เวลา" style={{ width: '80px', padding: '7px 10px', fontSize: '12px' }} />
                          <input className="trip-input" value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="ชื่อ activity" style={{ flex: 1, padding: '7px 10px', fontSize: '13px' }} />
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '4px', fontWeight: '600' }}>ไอคอน: {editIcon || '(ไม่มี)'}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {['🍽️', '☕', '🏛️', '🛕', '⛩️', '🏖️', '🎢', '🛒', '🚶', '🚗', '✈️', '🚃', '🏨', '📸', '🎭', '🎵', '💆', '🏊', '⛷️', '🥾', '🌅', '🌙', '📌', '⭐', '❤️', '🎯', '🔔', '🎪', '🎨', '🧘'].map(em => (
                              <span key={em} onClick={() => setEditIcon(em)}
                                style={{ fontSize: '18px', cursor: 'pointer', padding: '3px 4px', borderRadius: '6px', background: editIcon === em ? `${col}25` : 'transparent', border: editIcon === em ? `2px solid ${col}` : '2px solid transparent', transition: 'all 0.15s', lineHeight: 1 }}>{em}</span>
                            ))}
                          </div>
                        </div>
                        <input className="trip-input" value={editDetail} onChange={e => setEditDetail(e.target.value)} placeholder="รายละเอียด (optional)" style={{ padding: '7px 10px', fontSize: '12px' }} />
                        <input className="trip-input" value={editLocation} onChange={e => setEditLocation(e.target.value)} placeholder="📍 สถานที่ (ชื่อร้าน, ที่อยู่, หรือพิกัด)" style={{ padding: '7px 10px', fontSize: '12px' }} />
                        <textarea className="trip-input" value={editNote} onChange={e => setEditNote(e.target.value)} placeholder="📝 Note (เพิ่มเติม, เช่น ต้องจองล่วงหน้า)" rows={2} style={{ padding: '7px 10px', fontSize: '12px', resize: 'none' }} />
                        {/* Image attachments */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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
                        {/* Pending images */}
                        {pendingImages[key]?.length > 0 && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '6px' }}>
                            {pendingImages[key].map((img, idx) => (
                              <div key={idx} style={{ position: 'relative' }}>
                                <img src={img} alt="" style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '8px', border: `2px dashed ${col}55`, opacity: 0.7 }} onClick={() => setPreviewImage(img)} />
                                <span onClick={() => removePendingImage(key, idx)}
                                  style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#ef4444', color: 'white', borderRadius: '99px', width: '18px', height: '18px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: '800' }}>✕</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Saved images */}
                        {noteImages[key]?.length > 0 && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '6px' }}>
                            {(Array.isArray(noteImages[key]) ? noteImages[key] : [noteImages[key]]).map((img, idx) => (
                              <div key={idx} style={{ position: 'relative', cursor: 'pointer' }}>
                                <img src={img} alt="" onClick={() => setPreviewImage(img)}
                                  style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '8px', border: `1.5px solid ${col}33` }} />
                                <span onClick={() => removeNoteImage(key, idx)}
                                  style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#ef4444', color: 'white', borderRadius: '99px', width: '18px', height: '18px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: '800' }}>✕</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn-ghost" style={{ flex: 1, padding: '7px' }} onClick={() => setEditingKey(null)}>ยกเลิก</button>
                          {isOwner && (
                            <button style={{ padding: '7px 10px', background: 'rgba(139,92,246,0.1)', color: '#8B5CF6', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '10px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'inherit' }}
                              onClick={() => duplicateEvent(activeDay, ei)}>
                              📋 dup
                            </button>
                          )}
                          {isOwner && (
                            <button style={{ padding: '7px 10px', background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'inherit' }}
                              onClick={() => { if (confirm('ลบกิจกรรมนี้?')) { const newPlan = JSON.parse(JSON.stringify(plan)); newPlan.days[activeDay].events.splice(ei, 1); setPlan(newPlan); setEditingKey(null); lastSaveTimeRef.current = Date.now(); fetch(`/api/trips/${id}`, { method: 'PATCH', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ plan_json: newPlan }) }) } }}>
                              🗑️ ลบ
                            </button>
                          )}
                          <button className="btn-primary" style={{ flex: 2, padding: '7px', fontSize: '13px' }} onClick={() => saveInlineEdit(activeDay, ei)}>บันทึก</button>
                        </div>
                      </div>
                    ) : (
                      <div onClick={() => {
                        if (!isGuest && (isOwner || !isGuest)) {
                          setEditingKey(key); setEditTitle(ev.title || ''); setEditTime(ev.time || ''); setEditDetail(ev.detail || ''); setEditLocation(ev.location || ''); setEditNote(noteMap[key] || ''); setEditIcon(ev.icon || '')
                        }
                      }} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '11px', cursor: isGuest ? 'default' : 'pointer' }}>
                        {(isOwner || !isGuest) && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0, paddingTop: '2px', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                            {ei > 0 && <button className="icon-btn" onClick={() => moveEvent(activeDay, ei, ei - 1)} style={{ fontSize: '10px', padding: '2px 4px', opacity: 0.5, lineHeight: 1 }} title="ย้ายขึ้น">▲</button>}
                            <span
                              style={{ fontSize: '14px', cursor: 'grab', opacity: 0.3, textAlign: 'center', lineHeight: 1, userSelect: 'none', touchAction: 'none' }}
                              title="ลากเพื่อย้าย"
                              onTouchStart={e => {
                                e.stopPropagation()
                                const touch = e.touches[0]
                                e.currentTarget._dragStart = { y: touch.clientY, idx: ei }
                                e.currentTarget.style.opacity = '0.8'
                              }}
                              onTouchMove={e => {
                                e.stopPropagation(); e.preventDefault()
                                const el = e.currentTarget
                                const touch = e.touches[0]
                                if (!el._dragStart) return
                                const diff = touch.clientY - el._dragStart.y
                                const card = el.closest('.event-card')
                                const cardH = card?.offsetHeight || 60
                                if (Math.abs(diff) > cardH * 0.6) {
                                  const dir = diff > 0 ? 1 : -1
                                  const from = el._dragStart.idx
                                  const to = from + dir
                                  if (to >= 0 && to < (day.events || []).length) {
                                    moveEvent(activeDay, from, to)
                                    el._dragStart = { y: touch.clientY, idx: to }
                                  }
                                }
                              }}
                              onTouchEnd={e => {
                                e.currentTarget.style.opacity = '0.3'
                                e.currentTarget._dragStart = null
                              }}
                            >☰</span>
                            {ei < (day.events || []).length - 1 && <button className="icon-btn" onClick={() => moveEvent(activeDay, ei, ei + 1)} style={{ fontSize: '10px', padding: '2px 4px', opacity: 0.5, lineHeight: 1 }} title="ย้ายลง">▼</button>}
                          </div>
                        )}
                        <div style={{ fontSize: '11px', color: '#38BDF8', fontFamily: 'monospace', width: '36px', flexShrink: 0, paddingTop: '3px', fontWeight: '700' }}>{ev.time}</div>
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: light, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0, transition: 'all 0.2s' }}>
                          {ev.icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: '#0C4A6E' }}>{ev.title}</div>
                          {ev.detail && <div style={{ fontSize: '12px', color: ev.warning ? '#d97706' : '#38BDF8', marginTop: '2px' }}>{ev.detail}</div>}
                          {/* Attribution */}
                          {(ev.createdBy || ev.updatedBy || ev.imageUploadedBy) && (
                            <div style={{ fontSize: '9px', color: '#94A3B8', marginTop: '2px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              {ev.createdBy && <span>👤 {ev.createdBy}</span>}
                              {ev.updatedBy && <span>✏️ {ev.updatedBy} {ev.updatedAt ? new Date(ev.updatedAt).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</span>}
                              {ev.imageUploadedBy && <span>📷 {ev.imageUploadedBy}</span>}
                            </div>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                            <span style={{ display: 'inline-block', fontSize: '10px', padding: '2px 8px', borderRadius: '99px', background: light, color: col, fontWeight: '700', border: `1px solid ${col}33` }}>{ev.type}</span>
                            {ev.location && (
                              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.location)}`} target="_blank" rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: '10px', padding: '2px 8px', borderRadius: '99px', background: 'rgba(16,185,129,0.1)', color: '#10B981', fontWeight: '700', border: '1px solid rgba(16,185,129,0.2)', textDecoration: 'none' }}>
                                📍 Maps
                              </a>
                            )}
                            {/* Expense entries */}
                            {(expenses[key] || []).map((exp, xi) => (
                              <span key={xi} className="budget-tag" title={`${exp.userName} · ${new Date(exp.ts).toLocaleString('th-TH')}`}>
                                💰 {exp.amount.toLocaleString()} {exp.currency}
                                {exp.type === 'personal' && <span style={{ fontSize: '8px', background: '#FEE2E2', color: '#B91C1C', padding: '0 4px', borderRadius: '4px', marginLeft: '2px' }}>ส่วนตัว</span>}
                                <span style={{ fontSize: '9px', opacity: 0.6, marginLeft: '2px' }}>({exp.userName?.split(' ')[0] || '?'})</span>
                                {!isGuest && (
                                  <span onClick={e => { e.stopPropagation(); removeExpenseEntry(key, xi) }}
                                    style={{ cursor: 'pointer', marginLeft: '2px', opacity: 0.5, fontSize: '10px' }}>✕</span>
                                )}
                              </span>
                            ))}
                            {/* Add expense */}
                            {!isGuest && (
                              addingExpense === key ? (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }} onClick={e => e.stopPropagation()}>
                                  <input type="number" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') addExpenseEntry(activeDay, ei); if (e.key === 'Escape') setAddingExpense(null) }}
                                    placeholder="0" autoFocus inputMode="decimal"
                                    style={{ width: '65px', border: '1.5px solid #F59E0B', borderRadius: '6px', padding: '2px 6px', fontSize: '11px', outline: 'none', fontFamily: 'inherit', color: '#92400E' }} />
                                  <select value={expenseCurrency || foreignCurrency} onChange={e => setExpenseCurrency(e.target.value)}
                                    style={{ border: '1.5px solid #F59E0B', borderRadius: '6px', padding: '2px 3px', fontSize: '10px', color: '#92400E', background: 'white', fontFamily: 'inherit', cursor: 'pointer' }}>
                                    <option value="THB">THB</option>
                                    <option value={foreignCurrency}>{foreignCurrency}</option>
                                    {!['THB', foreignCurrency].includes('USD') && <option value="USD">USD</option>}
                                    {!['THB', foreignCurrency].includes('EUR') && <option value="EUR">EUR</option>}
                                  </select>
                                  <select value={expenseType} onChange={e => setExpenseType(e.target.value)}
                                    style={{ border: '1.5px solid #F59E0B', borderRadius: '6px', padding: '2px 3px', fontSize: '10px', color: '#92400E', background: 'white', fontFamily: 'inherit', cursor: 'pointer' }}>
                                    <option value="shared">ส่วนรวม</option>
                                    <option value="personal">ส่วนตัว</option>
                                  </select>
                                  <button onClick={() => addExpenseEntry(activeDay, ei)}
                                    style={{ background: '#F59E0B', color: 'white', border: 'none', borderRadius: '4px', padding: '1px 5px', fontSize: '10px', cursor: 'pointer', fontWeight: '700' }}>✓</button>
                                  <button onClick={() => setAddingExpense(null)}
                                    style={{ background: '#F1F5F9', color: '#64748b', border: 'none', borderRadius: '4px', padding: '1px 5px', fontSize: '10px', cursor: 'pointer' }}>✕</button>
                                </div>
                              ) : (
                                <span className="budget-tag" onClick={e => { e.stopPropagation(); setAddingExpense(key); setExpenseAmount(''); setExpenseCurrency(foreignCurrency) }}>
                                  + ค่าใช้จ่าย
                                </span>
                              )
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                          {(isOwner || !isGuest) && (
                            <button className="icon-btn" title="แก้ไข" onClick={() => { setEditingKey(key); setEditTitle(ev.title); setEditTime(ev.time || ''); setEditDetail(ev.detail || ''); setEditLocation(ev.location || ''); setEditNote(noteMap[key] || ''); setEditIcon(ev.icon || '') }}
                              style={{ fontSize: '15px', opacity: 0.7 }}>✏️</button>
                          )}
                        </div>
                      </div>
                    )}
                    {/* Show note text + images inline (read-only) when not editing */}
                    {(() => {
                      const imgs = noteImages[key] || ev.images || []
                      const hasContent = noteMap[key] || (Array.isArray(imgs) && imgs.length > 0)
                      if (isEditing || !hasContent) return null
                      return (
                        <div style={{ borderTop: `1px solid ${light}`, padding: '8px 12px 10px' }} onClick={e => e.stopPropagation()}>
                          {noteMap[key] && <div style={{ fontSize: '12px', color: '#64748B', lineHeight: 1.5 }}>📝 {noteMap[key]}</div>}
                          {Array.isArray(imgs) && imgs.length > 0 && (
                            <div>
                              <div style={{ fontSize: '10px', color: '#94A3B8', marginBottom: '4px', marginTop: '4px' }}>📷 {imgs.length} รูป · กดเพื่อดูขนาดเต็ม</div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '6px' }}>
                                {imgs.map((img, idx) => (
                                  <img key={idx} src={img} alt="" onClick={() => setPreviewImage(img)}
                                    style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '8px', border: `1.5px solid ${col}33`, cursor: 'pointer' }} />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )
              })}
              {/* Add New Event Button */}
              {(isOwner || !isGuest) && (
                <button onClick={() => addNewEvent(activeDay)}
                  style={{ width: '100%', padding: '12px', background: `${col}10`, border: `1.5px dashed ${col}44`, borderRadius: '12px', color: col, fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s', marginTop: '4px' }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${col}20`; e.currentTarget.style.borderColor = `${col}88` }}
                  onMouseLeave={e => { e.currentTarget.style.background = `${col}10`; e.currentTarget.style.borderColor = `${col}44` }}>
                  + เพิ่มกิจกรรม
                </button>
              )}
            </div>
          </div>

          {/* Day Expense Summary */}
          {Object.keys(getDayTotal(activeDay)).length > 0 && (
            <div style={{ background: 'linear-gradient(135deg,rgba(255,251,235,0.9),rgba(254,243,199,0.9))', backdropFilter: 'blur(12px)', borderRadius: '16px', padding: '14px 16px', marginTop: '10px', border: '1px solid rgba(245,158,11,0.15)', boxShadow: '0 4px 15px rgba(245,158,11,0.08)' }}>
              <div style={{ fontSize: '11px', color: '#92400E', fontWeight: '600', opacity: 0.7, marginBottom: '4px' }}>💰 ค่าใช้จ่ายวัน {plan.days[activeDay]?.day}</div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {Object.entries(getDayTotal(activeDay)).map(([cur, amt]) => (
                  <div key={cur} style={{ fontSize: '18px', fontWeight: '800', color: '#92400E' }}>
                    {amt.toLocaleString()} <span style={{ fontSize: '12px', fontWeight: '600' }}>{cur}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Total Trip Expenses */}
          {Object.keys(getTotalByCurrency()).length > 0 && (
            <div style={{ background: 'linear-gradient(135deg,rgba(16,185,129,0.1),rgba(52,211,153,0.08))', backdropFilter: 'blur(12px)', borderRadius: '16px', padding: '14px 16px', marginTop: '8px', border: '1px solid rgba(16,185,129,0.15)' }}>
              <div style={{ fontSize: '11px', color: '#065F46', fontWeight: '600', opacity: 0.7, marginBottom: '4px' }}>📊 ค่าใช้จ่ายรวมทั้งทริป</div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {Object.entries(getTotalByCurrency()).map(([cur, amt]) => (
                  <div key={cur}>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#065F46' }}>
                      {amt.toLocaleString()} <span style={{ fontSize: '13px', fontWeight: '600' }}>{cur}</span>
                    </div>
                    {exchangeRate && cur === foreignCurrency && (
                      <div style={{ fontSize: '11px', color: '#047857', opacity: 0.7 }}>≈ ฿{(amt * exchangeRate).toLocaleString('th-TH', { maximumFractionDigits: 0 })}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          {canEdit ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '14px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setStep('draft')}>{isOwner ? '← แก้ Notes' : '← ดู Notes'}</button>
                {isOwner && <button className="btn-primary" style={{ flex: 2 }} onClick={handleGenerate}>✨ Generate ใหม่</button>}
              </div>
              {/* Collapsible Tools Menu */}
              <button className="btn-ghost" style={{ width: '100%', fontSize: '13px' }} onClick={() => setShowToolsMenu(!showToolsMenu)}>
                🛠️ {showToolsMenu ? 'ซ่อนเครื่องมือ' : 'เครื่องมือเพิ่มเติม'} {showToolsMenu ? '▲' : '▼'}
              </button>
              {showToolsMenu && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', animation: 'fadeIn 0.2s ease' }}>
                  <div onClick={() => router.push(`/trip/packing?id=${id}`)}
                    style={{ background: 'linear-gradient(135deg,#F59E0B,#F97316)', borderRadius: '14px', padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 4px 15px rgba(249,115,22,0.3)' }}>
                    <div style={{ fontSize: '24px' }}>🧳</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: '800', color: 'white' }}>Packing List</div>
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.8)' }}>AI จัดกระเป๋าให้</div>
                    </div>
                    <div style={{ fontSize: '18px', color: 'rgba(255,255,255,0.7)' }}>→</div>
                  </div>
                  <button className="btn-ghost" style={{ fontSize: '13px', width: '100%' }}
                    onClick={generateGaps} disabled={gapsLoading}>
                    {gapsLoading ? '⏳ กำลังวิเคราะห์...' : '🔍 เติม Slot ว่าง (AI)'}
                  </button>
                  <button className="btn-ghost" style={{ fontSize: '13px', width: '100%' }}
                    onClick={() => { setShowSearch(!showSearch); setSearchQuery('') }}>
                    🔍 {showSearch ? 'ปิดค้นหา' : 'ค้นหากิจกรรม'}
                  </button>
                  <button className="btn-ghost" style={{ fontSize: '13px', width: '100%' }}
                    onClick={() => {
                      const text = plan.days.map(d => `\n📍 ${d.title}\n${(d.events || []).map(e => `  ${e.time || ''} ${e.icon || ''} ${e.title}${e.detail ? ' - ' + e.detail : ''}`).join('\n')}`).join('\n')
                      if (navigator.share) navigator.share({ title: trip?.title || 'Trip Plan', text }).catch(() => { })
                      else { navigator.clipboard.writeText(text); alert('คัดลอกแผนทริปแล้ว!') }
                    }}>
                    📤 แชร์/Export แผนทริป
                  </button>
                  {/* Owner: Approval toggle */}
                  {isOwner && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(139,92,246,0.06)', borderRadius: '12px', border: '1px solid rgba(139,92,246,0.12)' }}>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: '700', color: '#7C3AED' }}>🔒 ต้อง Approve ก่อนแก้ไข</div>
                        <div style={{ fontSize: '10px', color: '#A78BFA', marginTop: '1px' }}>{requireApproval ? 'Member ต้องส่ง Proposal' : 'Member แก้ไขได้เลย'}</div>
                      </div>
                      <div onClick={async () => {
                        const newPlan = JSON.parse(JSON.stringify(plan))
                        if (!newPlan.settings) newPlan.settings = {}
                        newPlan.settings.requireApproval = !requireApproval
                        setPlan(newPlan)
                        lastSaveTimeRef.current = Date.now()
                        await fetch(`/api/trips/${id}`, {
                          method: 'PATCH',
                          headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
                          body: JSON.stringify({ plan_json: newPlan }),
                        })
                      }}
                        style={{ width: '44px', height: '24px', borderRadius: '99px', background: requireApproval ? '#8B5CF6' : '#CBD5E1', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
                        <div style={{ width: '20px', height: '20px', borderRadius: '99px', background: 'white', position: 'absolute', top: '2px', left: requireApproval ? '22px' : '2px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '14px' }}>
              <button className="btn-ghost" style={{ width: '100%' }} onClick={() => setStep('draft')}>← ดู Notes</button>
              {!isGuest && requireApproval && (
                <button className="btn-primary" style={{ width: '100%' }}
                  onClick={() => { setProposalLocalPlan(JSON.parse(JSON.stringify(plan))); setShowProposalForm(true) }}>
                  📤 เสนอแก้ไข Plan นี้
                </button>
              )}
              {/* Tools for members too */}
              <button className="btn-ghost" style={{ width: '100%', fontSize: '13px' }} onClick={() => setShowToolsMenu(!showToolsMenu)}>
                🛠️ {showToolsMenu ? 'ซ่อนเครื่องมือ' : 'เครื่องมือเพิ่มเติม'} {showToolsMenu ? '▲' : '▼'}
              </button>
              {showToolsMenu && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div onClick={() => router.push(`/trip/packing?id=${id}`)}
                    style={{ background: 'linear-gradient(135deg,#F59E0B,#F97316)', borderRadius: '14px', padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 4px 15px rgba(249,115,22,0.3)' }}>
                    <div style={{ fontSize: '24px' }}>🧳</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: '800', color: 'white' }}>Packing List</div>
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.8)' }}>AI จัดกระเป๋าให้</div>
                    </div>
                    <div style={{ fontSize: '18px', color: 'rgba(255,255,255,0.7)' }}>→</div>
                  </div>
                  <button className="btn-ghost" style={{ fontSize: '13px', width: '100%' }}
                    onClick={() => { setShowSearch(!showSearch); setSearchQuery('') }}>
                    🔍 {showSearch ? 'ปิดค้นหา' : 'ค้นหากิจกรรม'}
                  </button>
                  <button className="btn-ghost" style={{ fontSize: '13px', width: '100%' }}
                    onClick={() => {
                      const text = plan.days.map(d => `\n📍 ${d.title}\n${(d.events || []).map(e => `  ${e.time || ''} ${e.icon || ''} ${e.title}${e.detail ? ' - ' + e.detail : ''}`).join('\n')}`).join('\n')
                      if (navigator.share) navigator.share({ title: trip?.title || 'Trip Plan', text }).catch(() => { })
                      else { navigator.clipboard.writeText(text); alert('คัดลอกแผนทริปแล้ว!') }
                    }}>
                    📤 แชร์/Export แผนทริป
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Spending Report - visible to owner + members */}
          {!isGuest && (
            <div onClick={() => router.push(`/trip/spending?id=${id}`)}
              style={{ background: 'linear-gradient(135deg,#0C4A6E,#0EA5E9)', borderRadius: '14px', padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 4px 15px rgba(14,165,233,0.3)', transition: 'transform 0.2s', marginTop: '10px' }}>
              <div style={{ fontSize: '28px' }}>📊</div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '800', color: 'white' }}>Spending Report & Split Bill</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)' }}>ดูสรุปค่าใช้จ่าย · หารบิล · กราฟ · Log</div>
              </div>
              <div style={{ marginLeft: 'auto', fontSize: '20px', color: 'rgba(255,255,255,0.7)' }}>→</div>
            </div>
          )}
          <div style={{ fontSize: '11px', color: '#38BDF8', textAlign: 'center', marginTop: '10px' }}>
            {isOwner ? 'แตะกิจกรรมเพื่อติ๊ก ✅ · กด ✏️ เพื่อแก้ไข · กด 🔗 เพื่อแชร์' : isGuest ? '👁️ ดูอย่างเดียว · สมัครสมาชิกเพื่อแก้ไข' : 'แตะกิจกรรมเพื่อติ๊ก ✅ · กด ✏️ เพื่อเพิ่ม note'}
          </div>

          {/* Language Toggle at bottom */}
          {plan && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
              <div style={{ display: 'flex', borderRadius: '10px', border: '1.5px solid rgba(14,165,233,0.15)', overflow: 'hidden', background: 'rgba(14,165,233,0.03)' }}>
                {['th', 'en', 'jp'].map(l => (
                  <button key={l} onClick={() => {
                    if (l === lang) return
                    setLang(l)
                    if (plansByLang[l]) { setPlan(plansByLang[l]); setActiveDay(0) }
                    else { setTimeout(() => doGenerate(l), 100) }
                  }}
                    style={{ background: lang === l ? '#0EA5E9' : 'transparent', color: lang === l ? 'white' : '#64748B', border: 'none', padding: '6px 14px', cursor: 'pointer', fontSize: '12px', fontWeight: lang === l ? '800' : '500', fontFamily: 'inherit', borderRight: l !== 'jp' ? '1px solid rgba(14,165,233,0.1)' : 'none' }}>
                    {l === 'th' ? '🇹🇭 ไทย' : l === 'en' ? '🇬🇧 EN' : '🇯🇵 日本語'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* AI Chat Modal */}
        {showChat && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', flexDirection: 'column' }}>
            <div className="container-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              {/* Chat Header */}
              <div style={{ padding: '16px', background: 'linear-gradient(135deg,#0C4A6E,#1E40AF)', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                <button onClick={() => setShowChat(false)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: '10px', padding: '6px 12px', cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit' }}>←</button>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '16px', fontWeight: '800', color: 'white' }}>🤖 AI Travel Assistant</div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>{trip?.destination || 'Trip'} · ถามอะไรก็ได้</div>
                </div>
                {chatMessages.length > 0 && (
                  <button onClick={() => { if (confirm('ล้างประวัติแชท?')) { setChatMessages([]); localStorage.removeItem(`chatHistory-${id}`) } }}
                    style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)', borderRadius: '8px', padding: '4px 10px', cursor: 'pointer', fontSize: '11px', fontFamily: 'inherit' }}>🗑️ ล้างแชท</button>
                )}
              </div>
              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '16px', background: '#0C1829', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0 }} ref={el => { if (el) el.scrollTop = el.scrollHeight }}>
                {chatMessages.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(255,255,255,0.3)' }}>
                    <div style={{ fontSize: '48px', marginBottom: '12px' }}>🌏</div>
                    <div style={{ fontSize: '14px', fontWeight: '600' }}>ถามอะไรก็ได้เกี่ยวกับทริปคุณ!</div>
                    <div style={{ fontSize: '12px', marginTop: '8px', lineHeight: 1.6 }}>🍜 ร้านอาหารแนะนำ? · 🚃 เดินทางยังไง? · 💰 งบพอไหม?</div>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '80%', padding: '10px 14px', borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      background: msg.role === 'user' ? 'linear-gradient(135deg,#0EA5E9,#3B82F6)' : 'rgba(255,255,255,0.08)',
                      color: 'white', fontSize: '13px', lineHeight: 1.6, whiteSpace: 'pre-wrap'
                    }}>{msg.text}</div>
                  </div>
                ))}
                {chatLoading && (
                  <div style={{ display: 'flex' }}>
                    <div style={{ padding: '10px 14px', borderRadius: '16px 16px 16px 4px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
                      ✨ กำลังคิด...
                    </div>
                  </div>
                )}
              </div>
              {/* Input */}
              <div style={{ padding: '12px', background: '#0F2744', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '8px', flexShrink: 0 }}>
                <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage() } }}
                  placeholder="ถามเกี่ยวกับทริป..."
                  style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '10px 14px', color: 'white', fontSize: '14px', outline: 'none', fontFamily: 'inherit' }} />
                <button onClick={sendChatMessage} disabled={chatLoading || !chatInput.trim()}
                  style={{ background: 'linear-gradient(135deg,#0EA5E9,#3B82F6)', border: 'none', color: 'white', borderRadius: '12px', padding: '10px 16px', cursor: 'pointer', fontSize: '16px', fontFamily: 'inherit', opacity: chatLoading || !chatInput.trim() ? 0.4 : 1 }}>
                  ➤
                </button>
              </div>
            </div>
          </div>
        )}


      </div>
    )
  }

  return null
}
