import { getAuthUser } from '../../lib/supabaseServer'

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end()

    const user = await getAuthUser(req)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })

    const { destination, dates, plan, travelers } = req.body
    if (!plan) return res.status(400).json({ error: 'Missing plan' })

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not set' })

    // สรุป activities จาก plan
    const activities = plan.days.flatMap(d =>
        d.events.map(e => `${e.type}: ${e.title}`)
    ).slice(0, 30).join(', ')

    // Build travelers description
    let travelersDesc = ''
    if (travelers) {
        const parts = []
        if (travelers.men > 0) parts.push(`ผู้ชาย ${travelers.men} คน`)
        if (travelers.women > 0) parts.push(`ผู้หญิง ${travelers.women} คน`)
        if (travelers.kids > 0) parts.push(`เด็กโต ${travelers.kids} คน`)
        if (travelers.toddlers > 0) parts.push(`เด็กเล็ก ${travelers.toddlers} คน`)
        travelersDesc = parts.join(', ')
    }

    const prompt = `You are a travel packing expert.

Trip: ${destination || 'Unknown'}
Dates: ${dates || 'Unknown'}
Travelers: ${travelersDesc || '1 person'}
Activities: ${activities}

Generate a comprehensive packing list organized by categories.
Consider the travelers (gender, age), activities, destination, and weather.
${travelers?.women > 0 ? 'Include women-specific items (skincare, makeup, sanitary products etc.).' : ''}
${travelers?.kids > 0 || travelers?.toddlers > 0 ? 'Include kid-specific items (toys, snacks, diapers for toddlers, etc.).' : ''}
Each category should have 3-10 items. Keep item names SHORT (under 30 chars).
For items that need quantity, add quantity in parentheses like "เสื้อยืด (${(travelers?.men || 0) + (travelers?.women || 0) + (travelers?.kids || 0)} ตัว)".
Return ONLY valid JSON:
{"categories": [
  {"icon": "emoji", "name": "category name", "items": ["item1", "item2"]}
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
