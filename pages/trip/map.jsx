import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import dynamic from 'next/dynamic'

const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false })
const Marker = dynamic(() => import('react-leaflet').then(m => m.Marker), { ssr: false })
const Popup = dynamic(() => import('react-leaflet').then(m => m.Popup), { ssr: false })
const Polyline = dynamic(() => import('react-leaflet').then(m => m.Polyline), { ssr: false })

// Component to fly to a location
const FlyTo = dynamic(() => Promise.resolve(({ center, zoom }) => {
    const { useMap } = require('react-leaflet')
    const map = useMap()
    useEffect(() => { if (center) map.flyTo(center, zoom || 15, { duration: 1 }) }, [center, zoom])
    return null
}), { ssr: false })

const DAY_COLORS = ['#0EA5E9', '#F59E0B', '#10B981', '#F97316', '#8B5CF6', '#EC4899', '#14B8A6']

export default function TripMap() {
    const router = useRouter()
    const { id } = router.query
    const [plan, setPlan] = useState(null)
    const [selectedDay, setSelectedDay] = useState(-1)
    const [mapReady, setMapReady] = useState(false)
    const [L, setL] = useState(null)
    const [flyTarget, setFlyTarget] = useState(null)

    useEffect(() => {
        if (!router.isReady || !id) return
        const saved = localStorage.getItem(`plan-${id}`)
        if (saved) try { setPlan(JSON.parse(saved)) } catch (e) { }
    }, [router.isReady, id])

    useEffect(() => {
        import('leaflet').then(leaflet => {
            setL(leaflet.default)
            delete leaflet.default.Icon.Default.prototype._getIconUrl
            leaflet.default.Icon.Default.mergeOptions({
                iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
                iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            })
            setMapReady(true)
        })
    }, [])

    const locations = useMemo(() => {
        if (!plan?.days) return []
        const locs = []
        plan.days.forEach((day, dayIdx) => {
            (day.events || []).forEach((ev, evIdx) => {
                if (ev.lat && ev.lng) {
                    locs.push({
                        dayIdx, evIdx,
                        lat: ev.lat, lng: ev.lng,
                        title: ev.title,
                        time: ev.time,
                        type: ev.type,
                        emoji: day.emoji || '📍',
                        dayNum: day.day || dayIdx + 1,
                        color: DAY_COLORS[dayIdx % DAY_COLORS.length]
                    })
                }
            })
        })
        return locs
    }, [plan])

    const filteredLocs = selectedDay === -1 ? locations : locations.filter(l => l.dayIdx === selectedDay)

    const routes = useMemo(() => {
        if (!plan?.days) return []
        return plan.days.map((day, dayIdx) => {
            const dayLocs = locations.filter(l => l.dayIdx === dayIdx)
            return { dayIdx, positions: dayLocs.map(l => [l.lat, l.lng]), color: DAY_COLORS[dayIdx % DAY_COLORS.length] }
        }).filter(r => r.positions.length >= 2)
    }, [plan, locations])

    const center = useMemo(() => {
        if (filteredLocs.length > 0) {
            const avgLat = filteredLocs.reduce((s, l) => s + l.lat, 0) / filteredLocs.length
            const avgLng = filteredLocs.reduce((s, l) => s + l.lng, 0) / filteredLocs.length
            return [avgLat, avgLng]
        }
        return [13.7563, 100.5018]
    }, [filteredLocs])

    const createCustomIcon = (dayIdx, index) => {
        if (!L) return undefined
        return L.divIcon({
            className: '',
            html: `<div style="background:${DAY_COLORS[dayIdx % DAY_COLORS.length]};color:white;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;box-shadow:0 2px 8px rgba(0,0,0,0.35);border:2.5px solid white">${index + 1}</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        })
    }

    // Export to Google Maps Directions
    const exportToGoogleMaps = (dayIdx) => {
        const dayLocs = locations.filter(l => l.dayIdx === dayIdx)
        if (dayLocs.length === 0) return
        // Google Maps directions: origin/destination/waypoints
        if (dayLocs.length === 1) {
            window.open(`https://www.google.com/maps/search/?api=1&query=${dayLocs[0].lat},${dayLocs[0].lng}`, '_blank')
            return
        }
        const origin = `${dayLocs[0].lat},${dayLocs[0].lng}`
        const destination = `${dayLocs[dayLocs.length - 1].lat},${dayLocs[dayLocs.length - 1].lng}`
        const waypoints = dayLocs.slice(1, -1).map(l => `${l.lat},${l.lng}`).join('|')
        let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`
        if (waypoints) url += `&waypoints=${waypoints}`
        window.open(url, '_blank')
    }

    const handleCardClick = (loc) => {
        setFlyTarget({ center: [loc.lat, loc.lng], zoom: 16, key: Date.now() })
    }

    if (!router.isReady) return null

    return (
        <>
            <Head><title>Map View</title></Head>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; }
        .leaflet-container { width: 100%; height: 100%; }
      `}</style>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
            <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0C1829' }}>
                {/* Header */}
                <div style={{ padding: '12px 16px', background: 'rgba(12,24,41,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                    <button onClick={() => router.push(`/trip/${id}`)}
                        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '10px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: 'inherit' }}>
                        ← กลับ
                    </button>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '16px', fontWeight: '800', color: 'white' }}>📍 Map View</div>
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{filteredLocs.length} locations</div>
                    </div>
                    {/* Export to Google Maps */}
                    {selectedDay >= 0 && (
                        <button onClick={() => exportToGoogleMaps(selectedDay)}
                            style={{ background: 'linear-gradient(135deg,#10B981,#34D399)', border: 'none', color: 'white', borderRadius: '10px', padding: '8px 14px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            🗺️ Google Maps
                        </button>
                    )}
                </div>

                {/* Day Filter */}
                {plan?.days && (
                    <div style={{ display: 'flex', gap: '6px', padding: '8px 12px', overflowX: 'auto', background: 'rgba(12,24,41,0.9)', flexShrink: 0, alignItems: 'center' }}>
                        <button onClick={() => setSelectedDay(-1)}
                            style={{
                                flexShrink: 0, padding: '6px 14px', borderRadius: '10px', border: '1.5px solid', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit',
                                background: selectedDay === -1 ? 'rgba(14,165,233,0.2)' : 'rgba(255,255,255,0.04)',
                                borderColor: selectedDay === -1 ? 'rgba(14,165,233,0.4)' : 'rgba(255,255,255,0.1)',
                                color: selectedDay === -1 ? '#38BDF8' : 'rgba(255,255,255,0.5)'
                            }}>
                            All
                        </button>
                        {plan.days.map((d, i) => {
                            const dayLocs = locations.filter(l => l.dayIdx === i)
                            return (
                                <button key={i} onClick={() => setSelectedDay(i)}
                                    style={{
                                        flexShrink: 0, padding: '6px 14px', borderRadius: '10px', border: '1.5px solid', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit',
                                        background: selectedDay === i ? `${DAY_COLORS[i % DAY_COLORS.length]}22` : 'rgba(255,255,255,0.04)',
                                        borderColor: selectedDay === i ? `${DAY_COLORS[i % DAY_COLORS.length]}66` : 'rgba(255,255,255,0.1)',
                                        color: selectedDay === i ? DAY_COLORS[i % DAY_COLORS.length] : 'rgba(255,255,255,0.5)',
                                        opacity: dayLocs.length === 0 ? 0.4 : 1
                                    }}>
                                    {d.emoji || '📍'} Day {d.day || i + 1}
                                    {dayLocs.length > 0 && <span style={{ marginLeft: '4px', opacity: 0.6 }}>({dayLocs.length})</span>}
                                </button>
                            )
                        })}
                    </div>
                )}

                {/* Map */}
                <div style={{ flex: 1, position: 'relative' }}>
                    {filteredLocs.length === 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.3)' }}>
                            <div style={{ fontSize: '56px', marginBottom: '16px' }}>🗺️</div>
                            <div style={{ fontSize: '16px', fontWeight: '700' }}>No location data</div>
                            <div style={{ fontSize: '13px', marginTop: '8px', textAlign: 'center', padding: '0 20px' }}>
                                กด Generate ใหม่เพื่อให้ AI เพิ่มพิกัดสถานที่
                            </div>
                        </div>
                    ) : mapReady ? (
                        <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }} key={`map-${selectedDay}`}>
                            <TileLayer
                                attribution='&copy; OpenStreetMap'
                                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                            />
                            {flyTarget && <FlyTo center={flyTarget.center} zoom={flyTarget.zoom} key={flyTarget.key} />}
                            {(selectedDay === -1 ? routes : routes.filter(r => r.dayIdx === selectedDay)).map((route, i) => (
                                <Polyline key={i} positions={route.positions} color={route.color} weight={3} opacity={0.6} dashArray="8,8" />
                            ))}
                            {filteredLocs.map((loc, i) => {
                                const dayLocs = filteredLocs.filter(l => l.dayIdx === loc.dayIdx)
                                const indexInDay = dayLocs.indexOf(loc)
                                return (
                                    <Marker key={`${loc.dayIdx}-${loc.evIdx}`} position={[loc.lat, loc.lng]} icon={createCustomIcon(loc.dayIdx, indexInDay)}>
                                        <Popup>
                                            <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                                                <div style={{ fontWeight: '800', fontSize: '14px', color: '#0C4A6E' }}>{loc.title}</div>
                                                <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                                                    {loc.emoji} Day {loc.dayNum} · {loc.time || ''}
                                                </div>
                                                {loc.type && <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>{loc.type}</div>}
                                                <a href={`https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`} target="_blank" rel="noopener noreferrer"
                                                    style={{ fontSize: '11px', color: '#0EA5E9', marginTop: '6px', display: 'inline-block' }}>
                                                    Open in Google Maps →
                                                </a>
                                            </div>
                                        </Popup>
                                    </Marker>
                                )
                            })}
                        </MapContainer>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.3)' }}>
                            Loading map...
                        </div>
                    )}

                    {/* Export all days button */}
                    {selectedDay === -1 && plan?.days && (
                        <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {plan.days.map((d, i) => {
                                const dayLocs = locations.filter(l => l.dayIdx === i)
                                if (dayLocs.length === 0) return null
                                return (
                                    <button key={i} onClick={() => exportToGoogleMaps(i)}
                                        style={{ background: 'rgba(12,24,41,0.85)', backdropFilter: 'blur(8px)', border: `1.5px solid ${DAY_COLORS[i % DAY_COLORS.length]}44`, color: 'white', borderRadius: '10px', padding: '6px 12px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                                        <span style={{ color: DAY_COLORS[i % DAY_COLORS.length] }}>Day {d.day || i + 1}</span> → Google Maps
                                    </button>
                                )
                            })}
                        </div>
                    )}

                    {/* Location list overlay */}
                    {filteredLocs.length > 0 && (
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(12,24,41,0.95))', padding: '40px 12px 12px', zIndex: 1000, pointerEvents: 'none' }}>
                            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', pointerEvents: 'auto' }}>
                                {filteredLocs.map((loc, i) => (
                                    <div key={`${loc.dayIdx}-${loc.evIdx}`}
                                        onClick={() => handleCardClick(loc)}
                                        style={{ flexShrink: 0, background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)', borderRadius: '10px', padding: '8px 12px', border: `1.5px solid ${loc.color}33`, minWidth: '140px', cursor: 'pointer', transition: 'all 0.2s' }}>
                                        <div style={{ fontSize: '11px', fontWeight: '800', color: loc.color }}>{loc.emoji} Day {loc.dayNum} #{filteredLocs.filter(l => l.dayIdx === loc.dayIdx).indexOf(loc) + 1}</div>
                                        <div style={{ fontSize: '12px', fontWeight: '700', color: 'white', marginTop: '2px' }}>{loc.title}</div>
                                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '1px' }}>{loc.time} · tap to focus</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}
