// Weather API using Open-Meteo (FREE, no API key needed)
// Geocodes the destination, then fetches forecast

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end()

    const { destination, planTitle } = req.body
    if (!destination && !planTitle) return res.status(400).json({ error: 'Missing destination' })

    try {
        // 1. Geocode destination — try multiple strategies
        let loc = null
        const queries = []
        if (destination) queries.push(destination)
        // Try first word of destination (e.g. "คิวชู ญี่ปุ่น" → "คิวชู")
        if (destination && destination.includes(' ')) queries.push(destination.split(' ')[0])
        // Try each word of destination separately
        if (destination) destination.split(/[\s,·]+/).forEach(w => { if (w.length > 1 && !queries.includes(w)) queries.push(w) })
        // Extract words from plan title (usually in English, e.g. "Kyushu Spring Adventure")
        if (planTitle) {
            // Try the full title first
            queries.push(planTitle.replace(/[:\-–—·]/g, ' ').trim())
            // Then individual words (4+ chars to skip "the", "and" etc.)
            planTitle.split(/[\s:,\-–—·&]+/).forEach(w => {
                const clean = w.trim()
                if (clean.length >= 4 && !queries.includes(clean) && !/^(spring|summer|autumn|winter|adventure|trip|tour|guide|part|day|days|cherry|scenic|blossoms|drives|night|week|plan|itinerary)$/i.test(clean)) {
                    queries.push(clean)
                }
            })
        }

        for (const q of queries) {
            const geoRes = await fetch(
                `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en`
            )
            const geoData = await geoRes.json()
            if (geoData.results?.[0]) { loc = geoData.results[0]; break }
        }
        if (!loc) return res.json({ weather: [], city: destination, error: 'Location not found' })

        const { latitude, longitude, name, country } = loc

        // 2. Fetch forecast (up to 16 days ahead)
        const weatherRes = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=16`
        )
        const weatherData = await weatherRes.json()
        const daily = weatherData.daily

        if (!daily) return res.json({ weather: [], city: name, country })

        // Map weather codes to emoji + description
        const weatherMap = {
            0: { icon: '☀️', desc: 'แดดจัด' },
            1: { icon: '🌤️', desc: 'มีเมฆบ้าง' },
            2: { icon: '⛅', desc: 'เมฆปานกลาง' },
            3: { icon: '☁️', desc: 'มีเมฆมาก' },
            45: { icon: '🌫️', desc: 'หมอก' },
            48: { icon: '🌫️', desc: 'หมอกแข็ง' },
            51: { icon: '🌦️', desc: 'ฝนปรอยๆ' },
            53: { icon: '🌦️', desc: 'ฝนปรอย' },
            55: { icon: '🌧️', desc: 'ฝนปรอยหนัก' },
            61: { icon: '🌧️', desc: 'ฝนเบา' },
            63: { icon: '🌧️', desc: 'ฝนปานกลาง' },
            65: { icon: '🌧️', desc: 'ฝนหนัก' },
            71: { icon: '🌨️', desc: 'หิมะเบา' },
            73: { icon: '🌨️', desc: 'หิมะปานกลาง' },
            75: { icon: '❄️', desc: 'หิมะหนัก' },
            80: { icon: '🌦️', desc: 'ฝนชุก' },
            81: { icon: '🌧️', desc: 'ฝนชุกปานกลาง' },
            82: { icon: '⛈️', desc: 'ฝนชุกหนัก' },
            95: { icon: '⛈️', desc: 'พายุฝนฟ้าคะนอง' },
            96: { icon: '⛈️', desc: 'พายุลูกเห็บเบา' },
            99: { icon: '⛈️', desc: 'พายุลูกเห็บหนัก' },
        }

        const weather = daily.time.map((date, i) => {
            const code = daily.weather_code[i]
            const w = weatherMap[code] || { icon: '🌡️', desc: `รหัส ${code}` }
            return {
                date,
                icon: w.icon,
                desc: w.desc,
                tempMax: Math.round(daily.temperature_2m_max[i]),
                tempMin: Math.round(daily.temperature_2m_min[i]),
                rainChance: daily.precipitation_probability_max[i],
            }
        })

        return res.json({ weather, city: name, country })
    } catch (e) {
        console.error('Weather error:', e)
        return res.status(500).json({ error: e.message })
    }
}
