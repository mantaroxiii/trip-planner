import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'

const COLORS = ['#0EA5E9', '#F59E0B', '#10B981', '#F97316', '#8B5CF6', '#EC4899', '#14B8A6', '#EF4444', '#6366F1', '#84CC16']
const CURRENCY_SYMBOLS = { THB: '฿', JPY: '¥', USD: '$', EUR: '€', KRW: '₩', CNY: '¥', GBP: '£', SGD: 'S$', MYR: 'RM', VND: '₫' }

// Pure CSS Donut Chart (no SVG, no recharts — guaranteed mobile compatible)
const CSSDonut = ({ data, colorOffset = 0 }) => {
    const total = data.reduce((s, d) => s + d.value, 0)
    if (total === 0) return null
    let cumPercent = 0
    const segments = data.map((d, i) => {
        const start = cumPercent
        cumPercent += (d.value / total) * 100
        return `${COLORS[(i + colorOffset) % COLORS.length]} ${start}% ${cumPercent}%`
    })
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
                width: '120px', height: '120px', borderRadius: '50%', flexShrink: 0,
                background: `conic-gradient(${segments.join(', ')})`,
                WebkitMask: 'radial-gradient(farthest-side, transparent 55%, #000 56%)',
                mask: 'radial-gradient(farthest-side, transparent 55%, #000 56%)',
            }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: 0 }}>
                {data.map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: COLORS[(i + colorOffset) % COLORS.length], flexShrink: 0 }} />
                        <span style={{ color: 'rgba(255,255,255,0.5)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                        <span style={{ fontWeight: '700', color: 'rgba(255,255,255,0.8)', flexShrink: 0 }}>{Math.round((d.value / total) * 100)}%</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

// Pure CSS Horizontal Bar Chart
const CSSBarChart = ({ data, colorOffset = 0 }) => {
    const max = Math.max(...data.map(d => d.value), 1)
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data.map((d, i) => (
                <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
                        <span style={{ color: 'rgba(255,255,255,0.5)' }}>{d.name}</span>
                        <span style={{ fontWeight: '700', color: 'rgba(255,255,255,0.7)' }}>{d.value.toLocaleString()}</span>
                    </div>
                    <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{
                            height: '100%', borderRadius: '4px',
                            background: `linear-gradient(90deg, ${COLORS[(i + colorOffset) % COLORS.length]}, ${COLORS[(i + colorOffset + 1) % COLORS.length]})`,
                            width: `${(d.value / max) * 100}%`,
                            transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)'
                        }} />
                    </div>
                </div>
            ))}
        </div>
    )
}

export default function SpendingReport() {
    const router = useRouter()
    const { id } = router.query
    const [expenses, setExpenses] = useState({})
    const [plan, setPlan] = useState(null)
    const [activityLog, setActivityLog] = useState([])
    const [selectedPersons, setSelectedPersons] = useState([])
    const [selectedCategories, setSelectedCategories] = useState([])
    const [activeTab, setActiveTab] = useState('overview')
    const [revealStep, setRevealStep] = useState(0)
    const [displayCurrency, setDisplayCurrency] = useState('THB')
    const [exchangeRates, setExchangeRates] = useState({ THB: 1, JPY: 3.85 })

    useEffect(() => {
        if (!router.isReady || !id) return
        const savedBudget = localStorage.getItem(`budget-${id}`)
        if (savedBudget) try { setExpenses(JSON.parse(savedBudget)) } catch (e) { }
        const savedPlan = localStorage.getItem(`plan-${id}`)
        if (savedPlan) try { setPlan(JSON.parse(savedPlan)) } catch (e) { }
        const savedLog = localStorage.getItem(`activityLog-${id}`)
        if (savedLog) try { setActivityLog(JSON.parse(savedLog)) } catch (e) { }
        fetch('https://api.exchangerate-api.com/v4/latest/THB')
            .then(r => r.json())
            .then(data => { if (data?.rates) setExchangeRates(data.rates) })
            .catch(() => { })
        let step = 0
        const timer = setInterval(() => { step++; setRevealStep(step); if (step >= 8) clearInterval(timer) }, 150)
        return () => clearInterval(timer)
    }, [router.isReady, id])

    const convertAmount = (amount, fromCurrency) => {
        if (fromCurrency === displayCurrency) return amount
        const toTHB = fromCurrency === 'THB' ? amount : amount / (exchangeRates[fromCurrency] || 1)
        if (displayCurrency === 'THB') return toTHB
        return toTHB * (exchangeRates[displayCurrency] || 1)
    }

    const allEntries = useMemo(() => {
        const entries = []
        Object.entries(expenses).forEach(([key, arr]) => {
            if (!Array.isArray(arr)) return
            const [dayIdx, eventIdx] = key.split('-').map(Number)
            const event = plan?.days?.[dayIdx]?.events?.[eventIdx]
            const eventType = event?.type || 'อื่นๆ'
            const eventTitle = event?.title || `Activity ${eventIdx + 1}`
            arr.forEach(e => entries.push({ ...e, dayIdx, eventIdx, key, eventType, eventTitle }))
        })
        return entries
    }, [expenses, plan])

    const filteredEntries = useMemo(() => {
        return allEntries.filter(e => {
            const personOk = selectedPersons.length === 0 || selectedPersons.includes(e.userEmail || e.userName)
            const catOk = selectedCategories.length === 0 || selectedCategories.includes(e.eventType)
            return personOk && catOk
        })
    }, [allEntries, selectedPersons, selectedCategories])

    const categories = useMemo(() => {
        const map = {}
        allEntries.forEach(e => {
            if (!map[e.eventType]) map[e.eventType] = { name: e.eventType, total: 0, count: 0 }
            map[e.eventType].total += e.amount
            map[e.eventType].count++
        })
        return Object.values(map).sort((a, b) => b.total - a.total)
    }, [allEntries])

    const byCategoryData = useMemo(() => {
        const map = {}
        filteredEntries.forEach(e => { map[e.eventType] = (map[e.eventType] || 0) + convertAmount(e.amount, e.currency) })
        return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value: Math.round(value) }))
    }, [filteredEntries, displayCurrency, exchangeRates])

    const persons = useMemo(() => {
        const map = {}
        allEntries.forEach(e => {
            const pid = e.userEmail || e.userName
            if (!map[pid]) map[pid] = { id: pid, name: e.userName, email: e.userEmail, total: 0, count: 0 }
            map[pid].total += e.amount
            map[pid].count++
        })
        return Object.values(map).sort((a, b) => b.total - a.total)
    }, [allEntries])

    const byPersonData = useMemo(() => {
        const map = {}
        filteredEntries.forEach(e => {
            const name = e.userName?.split(' ')[0] || '?'
            map[name] = (map[name] || 0) + convertAmount(e.amount, e.currency)
        })
        return Object.entries(map).map(([name, value]) => ({ name, value: Math.round(value) }))
    }, [filteredEntries, displayCurrency, exchangeRates])

    const byDayData = useMemo(() => {
        const map = {}
        filteredEntries.forEach(e => {
            const day = `วัน ${e.dayIdx + 1}`
            map[day] = (map[day] || 0) + convertAmount(e.amount, e.currency)
        })
        return Object.entries(map).sort((a, b) => parseInt(a[0].replace('วัน ', '')) - parseInt(b[0].replace('วัน ', ''))).map(([name, value]) => ({ name, value: Math.round(value) }))
    }, [filteredEntries, displayCurrency, exchangeRates])

    const byCurrency = useMemo(() => {
        const map = {}
        filteredEntries.forEach(e => { map[e.currency] = (map[e.currency] || 0) + e.amount })
        return map
    }, [filteredEntries])

    const totalAmount = filteredEntries.reduce((s, e) => s + convertAmount(e.amount, e.currency), 0)

    const settlements = useMemo(() => {
        if (persons.length <= 1) return []
        const fairShare = totalAmount / persons.length
        const balances = persons.map(p => ({
            name: p.name?.split(' ')[0] || '?', email: p.email,
            paid: allEntries.filter(e => (e.userEmail || e.userName) === p.id).reduce((s, e) => s + e.amount, 0), balance: 0
        }))
        balances.forEach(b => { b.balance = b.paid - fairShare })
        const debtors = balances.filter(b => b.balance < -0.5).map(b => ({ ...b })).sort((a, b) => a.balance - b.balance)
        const creditors = balances.filter(b => b.balance > 0.5).map(b => ({ ...b })).sort((a, b) => b.balance - a.balance)
        const transfers = []
        let i = 0, j = 0
        while (i < debtors.length && j < creditors.length) {
            const amount = Math.min(-debtors[i].balance, creditors[j].balance)
            if (amount > 0.5) transfers.push({ from: debtors[i].name, to: creditors[j].name, amount: Math.round(amount) })
            debtors[i].balance += amount; creditors[j].balance -= amount
            if (Math.abs(debtors[i].balance) < 0.5) i++
            if (Math.abs(creditors[j].balance) < 0.5) j++
        }
        return { fairShare: Math.round(fairShare), balances, transfers }
    }, [persons, allEntries, totalAmount])

    const togglePerson = (pid) => setSelectedPersons(prev => prev.includes(pid) ? prev.filter(p => p !== pid) : [...prev, pid])
    const toggleCategory = (cat) => setSelectedCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])

    const globalStyle = `
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; background: #0C1829; color: white; }
    @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes slideInLeft { from { opacity: 0; transform: translateX(-30px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
    .reveal { animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
    .tab-btn { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); color: rgba(255,255,255,0.5); border-radius: 10px; padding: 8px 14px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.3s; }
    .tab-btn.active { background: rgba(14,165,233,0.2); border-color: rgba(14,165,233,0.3); color: #38BDF8; }
    .tab-btn:hover { background: rgba(255,255,255,0.1); color: white; }
    .person-chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 10px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; border: 1.5px solid; font-family: inherit; }
    .glass-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; }
    .stat-card { padding: 16px; border-radius: 16px; }
    `

    if (!router.isReady) return null

    return (
        <>
            <Head><title>Spending Report</title></Head>
            <style>{globalStyle}</style>
            <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #0C1829 0%, #0F2744 50%, #0C1829 100%)' }}>
                {/* Header */}
                <div style={{ padding: '16px', background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.05)', position: 'sticky', top: 0, zIndex: 100 }}>
                    <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button onClick={() => router.push(`/trip/${id}`)}
                            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '10px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: 'inherit' }}>
                            ← กลับ
                        </button>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '16px', fontWeight: '800' }}>📊 Spending Report</div>
                            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{allEntries.length} รายการ · {persons.length} คน</div>
                        </div>
                        <div style={{ display: 'flex', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                            {['THB', 'JPY'].map(c => (
                                <button key={c} onClick={() => setDisplayCurrency(c)}
                                    style={{
                                        padding: '5px 12px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', border: 'none',
                                        background: displayCurrency === c ? 'rgba(14,165,233,0.3)' : 'rgba(255,255,255,0.04)',
                                        color: displayCurrency === c ? '#38BDF8' : 'rgba(255,255,255,0.4)'
                                    }}>
                                    {CURRENCY_SYMBOLS[c]}{c}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px' }}>
                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', overflowX: 'auto', ...(revealStep >= 1 ? { animation: 'fadeInUp 0.6s forwards' } : { opacity: 0 }) }}>
                        {[
                            { id: 'overview', icon: '📊', label: 'Overview' },
                            { id: 'category', icon: '🏷️', label: 'ประเภท' },
                            { id: 'people', icon: '👥', label: 'รายคน' },
                            { id: 'daily', icon: '📅', label: 'รายวัน' },
                            { id: 'split', icon: '🧾', label: 'Split' },
                            { id: 'log', icon: '📋', label: 'Log' },
                        ].map(t => (
                            <button key={t.id} className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}
                                onClick={() => setActiveTab(t.id)}>
                                {t.icon} {t.label}
                            </button>
                        ))}
                    </div>

                    {allEntries.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                            <div style={{ fontSize: '56px', marginBottom: '16px' }}>💸</div>
                            <div style={{ fontSize: '18px', fontWeight: '700', color: 'rgba(255,255,255,0.5)' }}>ยังไม่มีค่าใช้จ่าย</div>
                            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.3)', marginTop: '8px' }}>กลับไปหน้าทริปแล้วเพิ่ม "+ ค่าใช้จ่าย" ที่แต่ละกิจกรรม</div>
                        </div>
                    ) : (
                        <>
                            {/* Overview Tab */}
                            {activeTab === 'overview' && (
                                <>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }} className={revealStep >= 2 ? 'reveal' : ''}>
                                        <div className="stat-card" style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.15), rgba(56,189,248,0.08))', border: '1px solid rgba(14,165,233,0.2)' }}>
                                            <div style={{ fontSize: '11px', color: '#38BDF8', fontWeight: '600', opacity: 0.7 }}>💰 ค่าใช้จ่ายรวม</div>
                                            <div style={{ fontSize: '24px', fontWeight: '800', marginTop: '4px' }}>{Math.round(totalAmount).toLocaleString()}</div>
                                            <div style={{ fontSize: '11px', color: '#38BDF8', opacity: 0.6 }}>{displayCurrency}</div>
                                        </div>
                                        <div className="stat-card" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(251,191,36,0.08))', border: '1px solid rgba(245,158,11,0.2)' }}>
                                            <div style={{ fontSize: '11px', color: '#FBBF24', fontWeight: '600', opacity: 0.7 }}>📋 จำนวนรายการ</div>
                                            <div style={{ fontSize: '24px', fontWeight: '800', marginTop: '4px' }}>{filteredEntries.length}</div>
                                            <div style={{ fontSize: '11px', color: '#FBBF24', opacity: 0.6 }}>{persons.length} คน</div>
                                        </div>
                                        <div className="stat-card" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(52,211,153,0.08))', border: '1px solid rgba(16,185,129,0.2)' }}>
                                            <div style={{ fontSize: '11px', color: '#34D399', fontWeight: '600', opacity: 0.7 }}>📅 วันที่มีค่าใช้จ่าย</div>
                                            <div style={{ fontSize: '24px', fontWeight: '800', marginTop: '4px' }}>{byDayData.length}</div>
                                            <div style={{ fontSize: '11px', color: '#34D399', opacity: 0.6 }}>วัน</div>
                                        </div>
                                        <div className="stat-card" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(167,139,250,0.08))', border: '1px solid rgba(139,92,246,0.2)' }}>
                                            <div style={{ fontSize: '11px', color: '#A78BFA', fontWeight: '600', opacity: 0.7 }}>💳 เฉลี่ย/คน</div>
                                            <div style={{ fontSize: '24px', fontWeight: '800', marginTop: '4px' }}>{persons.length > 0 ? Math.round(totalAmount / persons.length).toLocaleString() : 0}</div>
                                            <div style={{ fontSize: '11px', color: '#A78BFA', opacity: 0.6 }}>{displayCurrency}</div>
                                        </div>
                                    </div>

                                    {Object.keys(byCurrency).length > 1 && (
                                        <div className="glass-card" style={{ padding: '14px', marginBottom: '16px' }}>
                                            <div style={{ fontSize: '12px', fontWeight: '700', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>💱 แยกตามสกุลเงิน</div>
                                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                                {Object.entries(byCurrency).map(([cur, amt]) => (
                                                    <div key={cur} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '10px', padding: '8px 14px' }}>
                                                        <div style={{ fontSize: '16px', fontWeight: '800' }}>{CURRENCY_SYMBOLS[cur] || ''}{Math.round(amt).toLocaleString()}</div>
                                                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{cur}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {byPersonData.length > 0 && (
                                        <div className="glass-card" style={{ padding: '16px', marginBottom: '16px' }}>
                                            <div style={{ fontSize: '13px', fontWeight: '700', color: 'rgba(255,255,255,0.6)', marginBottom: '12px' }}>👥 สัดส่วนค่าใช้จ่ายแต่ละคน</div>
                                            <CSSDonut data={byPersonData} />
                                        </div>
                                    )}

                                    {byDayData.length > 0 && (
                                        <div className="glass-card" style={{ padding: '16px', marginBottom: '16px' }}>
                                            <div style={{ fontSize: '13px', fontWeight: '700', color: 'rgba(255,255,255,0.6)', marginBottom: '12px' }}>📅 ค่าใช้จ่ายแต่ละวัน</div>
                                            <CSSBarChart data={byDayData} />
                                        </div>
                                    )}

                                    {byCategoryData.length > 0 && (
                                        <div className="glass-card" style={{ padding: '16px' }}>
                                            <div style={{ fontSize: '13px', fontWeight: '700', color: 'rgba(255,255,255,0.6)', marginBottom: '12px' }}>🏷️ ค่าใช้จ่ายตามประเภท</div>
                                            <CSSDonut data={byCategoryData} colorOffset={3} />
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Category Tab */}
                            {activeTab === 'category' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
                                        <button className="person-chip" onClick={() => setSelectedCategories([])}
                                            style={{ background: selectedCategories.length === 0 ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.04)', borderColor: selectedCategories.length === 0 ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.1)', color: selectedCategories.length === 0 ? '#A78BFA' : 'rgba(255,255,255,0.5)' }}>
                                            ทุกประเภท
                                        </button>
                                        {categories.map((c, i) => (
                                            <button key={c.name} className="person-chip" onClick={() => toggleCategory(c.name)}
                                                style={{ background: selectedCategories.includes(c.name) ? `${COLORS[(i + 3) % COLORS.length]}22` : 'rgba(255,255,255,0.04)', borderColor: selectedCategories.includes(c.name) ? `${COLORS[(i + 3) % COLORS.length]}66` : 'rgba(255,255,255,0.1)', color: selectedCategories.includes(c.name) ? COLORS[(i + 3) % COLORS.length] : 'rgba(255,255,255,0.5)' }}>
                                                {c.name}
                                            </button>
                                        ))}
                                    </div>

                                    {byCategoryData.length > 0 && (
                                        <div className="glass-card" style={{ padding: '16px', marginBottom: '10px' }}>
                                            <CSSDonut data={byCategoryData} colorOffset={3} />
                                        </div>
                                    )}

                                    {categories.filter(c => selectedCategories.length === 0 || selectedCategories.includes(c.name)).map((c, i) => {
                                        const catEntries = filteredEntries.filter(e => e.eventType === c.name)
                                        const catByCurrency = {}
                                        catEntries.forEach(e => { catByCurrency[e.currency] = (catByCurrency[e.currency] || 0) + e.amount })
                                        return (
                                            <div key={c.name} className="glass-card" style={{ padding: '14px', animation: `slideInLeft 0.4s ${i * 0.1}s forwards`, opacity: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                                                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `linear-gradient(135deg, ${COLORS[(i + 3) % COLORS.length]}, ${COLORS[(i + 4) % COLORS.length]})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>🏷️</div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontSize: '13px', fontWeight: '700' }}>{c.name}</div>
                                                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>{catEntries.length} รายการ</div>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '6px' }}>
                                                        {Object.entries(catByCurrency).map(([cur, amt]) => (
                                                            <div key={cur} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '8px', padding: '5px 10px', textAlign: 'right' }}>
                                                                <div style={{ fontSize: '13px', fontWeight: '800' }}>{Math.round(amt).toLocaleString()}</div>
                                                                <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>{cur}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                    {catEntries.map((e, j) => (
                                                        <div key={j} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgba(255,255,255,0.4)', padding: '3px 6px', borderRadius: '6px', background: 'rgba(255,255,255,0.02)' }}>
                                                            <div><span style={{ opacity: 0.5 }}>{e.userName?.split(' ')[0]}</span> · วัน{e.dayIdx + 1} · {e.eventTitle}</div>
                                                            <span style={{ fontWeight: '700', color: 'rgba(255,255,255,0.6)' }}>{e.amount.toLocaleString()} {e.currency}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}

                            {/* People Tab */}
                            {activeTab === 'people' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
                                        <button className="person-chip" onClick={() => setSelectedPersons([])}
                                            style={{ background: selectedPersons.length === 0 ? 'rgba(14,165,233,0.2)' : 'rgba(255,255,255,0.04)', borderColor: selectedPersons.length === 0 ? 'rgba(14,165,233,0.4)' : 'rgba(255,255,255,0.1)', color: selectedPersons.length === 0 ? '#38BDF8' : 'rgba(255,255,255,0.5)' }}>
                                            ทุกคน
                                        </button>
                                        {persons.map((p, i) => (
                                            <button key={p.id} className="person-chip" onClick={() => togglePerson(p.id)}
                                                style={{ background: selectedPersons.includes(p.id) ? `${COLORS[i % COLORS.length]}22` : 'rgba(255,255,255,0.04)', borderColor: selectedPersons.includes(p.id) ? `${COLORS[i % COLORS.length]}66` : 'rgba(255,255,255,0.1)', color: selectedPersons.includes(p.id) ? COLORS[i % COLORS.length] : 'rgba(255,255,255,0.5)' }}>
                                                {p.name?.split(' ')[0]}
                                            </button>
                                        ))}
                                    </div>

                                    {persons.filter(p => selectedPersons.length === 0 || selectedPersons.includes(p.id)).map((p, i) => {
                                        const personEntries = allEntries.filter(e => (e.userEmail || e.userName) === p.id)
                                        const personByCurrency = {}
                                        personEntries.forEach(e => { personByCurrency[e.currency] = (personByCurrency[e.currency] || 0) + e.amount })
                                        return (
                                            <div key={p.id} className="glass-card" style={{ padding: '14px', animation: `slideInLeft 0.4s ${i * 0.1}s forwards`, opacity: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                                                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `linear-gradient(135deg, ${COLORS[i % COLORS.length]}, ${COLORS[(i + 1) % COLORS.length]})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '800', flexShrink: 0 }}>
                                                        {p.name?.[0]?.toUpperCase() || '?'}
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontSize: '13px', fontWeight: '700' }}>{p.name}</div>
                                                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>{p.email || 'No email'} · {p.count} รายการ</div>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                                                    {Object.entries(personByCurrency).map(([cur, amt]) => (
                                                        <div key={cur} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '8px', padding: '6px 10px' }}>
                                                            <div style={{ fontSize: '14px', fontWeight: '800' }}>{Math.round(amt).toLocaleString()} <span style={{ fontSize: '11px', opacity: 0.5 }}>{cur}</span></div>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                    {personEntries.map((e, j) => (
                                                        <div key={j} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgba(255,255,255,0.4)', padding: '3px 6px', borderRadius: '6px', background: 'rgba(255,255,255,0.02)' }}>
                                                            <span>วัน{e.dayIdx + 1} · {plan?.days?.[e.dayIdx]?.events?.[e.eventIdx]?.title || 'Activity'}</span>
                                                            <span style={{ fontWeight: '700', color: 'rgba(255,255,255,0.6)' }}>{e.amount.toLocaleString()} {e.currency}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}

                            {/* Daily Tab */}
                            {activeTab === 'daily' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {byDayData.length > 0 && (
                                        <div className="glass-card" style={{ padding: '16px', marginBottom: '6px' }}>
                                            <CSSBarChart data={byDayData} />
                                        </div>
                                    )}
                                    {byDayData.map((d, i) => {
                                        const dayIdx = parseInt(d.name.replace('วัน ', '')) - 1
                                        const dayEntries = filteredEntries.filter(e => e.dayIdx === dayIdx)
                                        const dayByCurrency = {}
                                        dayEntries.forEach(e => { dayByCurrency[e.currency] = (dayByCurrency[e.currency] || 0) + e.amount })
                                        return (
                                            <div key={i} className="glass-card" style={{ padding: '14px', animation: `slideInLeft 0.4s ${i * 0.1}s forwards`, opacity: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                                    <div>
                                                        <div style={{ fontSize: '14px', fontWeight: '800', color: COLORS[i % COLORS.length] }}>{plan?.days?.[dayIdx]?.emoji || '📍'} {d.name}</div>
                                                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>{plan?.days?.[dayIdx]?.title || ''} · {dayEntries.length} รายการ</div>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '6px' }}>
                                                        {Object.entries(dayByCurrency).map(([cur, amt]) => (
                                                            <div key={cur} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '8px', padding: '5px 10px', textAlign: 'right' }}>
                                                                <div style={{ fontSize: '13px', fontWeight: '800' }}>{Math.round(amt).toLocaleString()}</div>
                                                                <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>{cur}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                    {dayEntries.map((e, j) => (
                                                        <div key={j} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgba(255,255,255,0.4)', padding: '3px 6px', borderRadius: '6px', background: 'rgba(255,255,255,0.02)' }}>
                                                            <div><span style={{ opacity: 0.5 }}>{e.userName?.split(' ')[0]}</span> · {plan?.days?.[e.dayIdx]?.events?.[e.eventIdx]?.title || 'Activity'}</div>
                                                            <span style={{ fontWeight: '700', color: 'rgba(255,255,255,0.6)' }}>{e.amount.toLocaleString()} {e.currency}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}

                            {/* Split Bill Tab */}
                            {activeTab === 'split' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {persons.length <= 1 ? (
                                        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(255,255,255,0.3)' }}>
                                            <div style={{ fontSize: '36px', marginBottom: '12px' }}>🧾</div>
                                            ต้องมีอย่างน้อย 2 คนถึงจะหารบิลได้
                                        </div>
                                    ) : (
                                        <>
                                            <div className="glass-card" style={{ padding: '16px', textAlign: 'center', animation: 'fadeInUp 0.5s forwards', opacity: 0 }}>
                                                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: '600' }}>💰 ค่าใช้จ่ายรวม ÷ {persons.length} คน</div>
                                                <div style={{ fontSize: '32px', fontWeight: '800', color: '#38BDF8', marginTop: '6px' }}>
                                                    {CURRENCY_SYMBOLS[displayCurrency] || ''}{settlements.fairShare?.toLocaleString()}
                                                </div>
                                                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>ต่อคน ({displayCurrency})</div>
                                            </div>

                                            <div style={{ fontSize: '12px', fontWeight: '700', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>📊 สรุปแต่ละคน</div>
                                            {settlements.balances?.map((b, i) => (
                                                <div key={i} className="glass-card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px', animation: `slideInLeft 0.4s ${i * 0.08}s forwards`, opacity: 0 }}>
                                                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `linear-gradient(135deg, ${COLORS[i % COLORS.length]}, ${COLORS[(i + 1) % COLORS.length]})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '800', flexShrink: 0 }}>
                                                        {b.name[0]?.toUpperCase()}
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontSize: '13px', fontWeight: '700' }}>{b.name}</div>
                                                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>จ่ายไป {Math.round(b.paid).toLocaleString()} {displayCurrency}</div>
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ fontSize: '14px', fontWeight: '800', color: b.balance > 0.5 ? '#34D399' : b.balance < -0.5 ? '#FB7185' : 'rgba(255,255,255,0.4)' }}>
                                                            {b.balance > 0.5 ? '+' : ''}{Math.round(b.balance).toLocaleString()}
                                                        </div>
                                                        <div style={{ fontSize: '10px', color: b.balance > 0.5 ? '#34D399' : b.balance < -0.5 ? '#FB7185' : 'rgba(255,255,255,0.3)' }}>
                                                            {b.balance > 0.5 ? 'ได้คืน' : b.balance < -0.5 ? 'ต้องจ่าย' : 'เท่ากัน'}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}

                                            {settlements.transfers?.length > 0 && (
                                                <>
                                                    <div style={{ fontSize: '12px', fontWeight: '700', color: 'rgba(255,255,255,0.5)', marginTop: '8px' }}>💸 รายการโอน</div>
                                                    {settlements.transfers.map((t, i) => (
                                                        <div key={i} style={{ background: 'linear-gradient(135deg, rgba(251,113,133,0.1), rgba(52,211,153,0.1))', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', padding: '14px', display: 'flex', alignItems: 'center', gap: '10px', animation: `fadeInUp 0.5s ${0.3 + i * 0.1}s forwards`, opacity: 0 }}>
                                                            <div style={{ background: 'rgba(251,113,133,0.2)', borderRadius: '10px', padding: '8px 10px', fontSize: '12px', fontWeight: '800', color: '#FB7185' }}>{t.from}</div>
                                                            <div style={{ flex: 1, textAlign: 'center' }}>
                                                                <div style={{ fontSize: '18px', fontWeight: '800', color: '#38BDF8' }}>{CURRENCY_SYMBOLS[displayCurrency] || ''}{t.amount.toLocaleString()}</div>
                                                                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>→ โอนให้ →</div>
                                                            </div>
                                                            <div style={{ background: 'rgba(52,211,153,0.2)', borderRadius: '10px', padding: '8px 10px', fontSize: '12px', fontWeight: '800', color: '#34D399' }}>{t.to}</div>
                                                        </div>
                                                    ))}
                                                </>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Activity Log Tab */}
                            {activeTab === 'log' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {activityLog.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(255,255,255,0.3)' }}>
                                            <div style={{ fontSize: '36px', marginBottom: '12px' }}>📋</div>
                                            ยังไม่มี activity log
                                        </div>
                                    ) : (
                                        activityLog.slice().reverse().map((log, i) => (
                                            <div key={i} style={{ display: 'flex', gap: '10px', padding: '10px 12px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)', animation: `fadeInUp 0.3s ${i * 0.05}s forwards`, opacity: 0 }}>
                                                <div style={{ fontSize: '18px', flexShrink: 0 }}>{log.icon || '📝'}</div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: '12px', fontWeight: '600' }}>
                                                        <span style={{ color: '#38BDF8' }}>{log.userName || 'Unknown'}</span>
                                                        <span style={{ color: 'rgba(255,255,255,0.4)' }}> {log.action}</span>
                                                    </div>
                                                    {log.detail && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>{log.detail}</div>}
                                                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', marginTop: '3px' }}>{new Date(log.ts).toLocaleString('th-TH')}</div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </>
    )
}
