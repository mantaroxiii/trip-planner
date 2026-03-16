import { getAuthUser } from '../../lib/supabaseServer'

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end()

    const user = await getAuthUser(req)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })

    const { destination, dates, plan } = req.body
    if (!plan) return res.status(400).json({ error: 'Missing plan' })

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not set' })

    // สรุป activities จาก plan (เอาแค่สั้นๆ เพื่อไม่ให้ prompt ยาวเกินไป)
    const activities = plan.days.flatMap(d =>
        d.events.map(e => `${e.type}: ${e.title}`)
    ).slice(0, 30).join(', ')

    const prompt = `You are a travel packing expert.

Trip: ${destination || 'Unknown'}
Dates: ${dates || 'Unknown'}
Activities: ${activities}

Generate a packing list organized by categories. Consider the activities and destination.
Each category should have 3-8 items. Keep item names SHORT (under 30 characters).
Return ONLY valid JSON:
{"categories": [
  {"icon": "👕", "name": "เสื้อผ้า", "items": ["item1", "item2"]},
  {"icon": "🧴", "name": "ของใช้ส่วนตัว", "items": ["item1", "item2"]},
  {"icon": "💊", "name": "ยาและสุขภาพ", "items": ["item1", "item2"]},
  {"icon": "📱", "name": "อุปกรณ์อิเล็กทรอนิกส์", "items": ["item1", "item2"]},
  {"icon": "📄", "name": "เอกสาร", "items": ["item1", "item2"]},
  {"icon": "🎒", "name": "อื่นๆ", "items": ["item1", "item2"]}
]}`

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.4,
                        maxOutputTokens: 4096,
                        responseMimeType: 'application/json',
                    },
                }),
            }
        )

        const data = await response.json()
        if (!response.ok) {
            console.error('Gemini API error:', JSON.stringify(data.error || data))
            throw new Error(data.error?.message || 'Gemini API error')
        }

        const candidate = data.candidates?.[0]
        if (!candidate?.content?.parts) {
            console.error('No candidate parts:', JSON.stringify(data))
            throw new Error('AI returned empty response')
        }

        // Concatenate all text parts
        let text = candidate.content.parts.map(p => p.text || '').join('')
        text = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()

        if (!text) throw new Error('AI returned empty text')

        const parsed = JSON.parse(text)
        if (!parsed.categories || !Array.isArray(parsed.categories)) {
            throw new Error('Invalid response structure')
        }
        return res.json(parsed)
    } catch (e) {
        console.error('Packing error:', e.message)
        return res.status(500).json({ error: `Packing list: ${e.message}` })
    }
}
