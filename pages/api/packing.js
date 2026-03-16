import { getAuthUser } from '../../lib/supabaseServer'

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end()

    const user = await getAuthUser(req)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })

    const { destination, dates, plan } = req.body
    if (!plan) return res.status(400).json({ error: 'Missing plan' })

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not set' })

    // สรุป activities จาก plan
    const activities = plan.days.flatMap(d =>
        d.events.map(e => `${e.type}: ${e.title}`)
    ).join(', ')

    const prompt = `You are a travel packing expert.

Trip: ${destination || 'Unknown'}
Dates: ${dates || 'Unknown'}
Activities: ${activities}

Generate a packing list organized by categories. Consider the activities and destination.
Return ONLY valid JSON in this exact format (no markdown, no extra text):
{"categories": [
  {"icon": "👕", "name": "เสื้อผ้า", "items": ["...", "..."]},
  {"icon": "🧴", "name": "ของใช้ส่วนตัว", "items": ["...", "..."]},
  {"icon": "💊", "name": "ยาและสุขภาพ", "items": ["...", "..."]},
  {"icon": "📱", "name": "อุปกรณ์อิเล็กทรอนิกส์", "items": ["...", "..."]},
  {"icon": "📄", "name": "เอกสาร", "items": ["...", "..."]}
]}`

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.5, maxOutputTokens: 800 },
                }),
            }
        )

        const data = await response.json()
        let text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

        // Strip markdown code blocks (Gemini 2.5 may wrap in ```json)
        text = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '')

        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (!jsonMatch) throw new Error('Invalid AI response')

        const parsed = JSON.parse(jsonMatch[0])
        return res.json(parsed)
    } catch (e) {
        console.error('Packing error:', e)
        return res.status(500).json({ error: e.message || 'Failed to generate packing list' })
    }
}
