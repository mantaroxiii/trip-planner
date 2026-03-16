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

Generate a packing list organized BY PERSON TYPE. Do NOT create generic categories like "เสื้อผ้าทั่วไป".
Instead, create separate categories for each traveler type, plus shared items.

${travelers?.men > 0 ? `- "👨 ของผู้ชาย" — clothes, toiletries, accessories specific to ${travelers.men} men` : ''}
${travelers?.women > 0 ? `- "👩 ของผู้หญิง" — clothes, skincare, makeup, sanitary products, accessories for ${travelers.women} women` : ''}
${travelers?.kids > 0 ? `- "🧒 ของเด็กโต" — clothes, toys, snacks for ${travelers.kids} kids age 7-15` : ''}
${travelers?.toddlers > 0 ? `- "👶 ของเด็กเล็ก" — diapers, milk, baby food, toys for ${travelers.toddlers} toddlers age 0-6` : ''}
- "📄 เอกสาร & การเงิน" — passport, insurance, cards, cash
- "💊 ยา & สุขภาพ" — first aid, personal meds, sunscreen
- "🔌 อุปกรณ์ & Gadgets" — charger, adapter, camera
- "🧳 ของใช้ร่วม" — luggage items, umbrella, bags

Each category should have 4-8 items. Keep item names SHORT (under 25 chars).
For items needing quantity by person count, add quantity like "เสื้อยืด (${(travelers?.men || 0) + (travelers?.women || 0)} ตัว)".
Write item names in Thai.
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
                        maxOutputTokens: 8192,
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

        // Attempt to repair truncated JSON
        let parsed
        try {
            parsed = JSON.parse(text)
        } catch (parseErr) {
            console.warn('JSON parse failed, attempting repair:', parseErr.message)
            let repaired = text
            // Close unclosed strings
            const quoteCount = (repaired.match(/(?<!\\)"/g) || []).length
            if (quoteCount % 2 !== 0) repaired += '"'
            // Remove trailing comma
            repaired = repaired.replace(/,\s*$/, '')
            // Close open arrays and objects
            const opens = (repaired.match(/[\[{]/g) || []).length
            const closes = (repaired.match(/[\]}]/g) || []).length
            for (let i = 0; i < opens - closes; i++) {
                // Check what needs closing
                const lastOpen = Math.max(repaired.lastIndexOf('['), repaired.lastIndexOf('{'))
                const lastClose = Math.max(repaired.lastIndexOf(']'), repaired.lastIndexOf('}'))
                if (lastOpen > lastClose) {
                    repaired += repaired[lastOpen] === '[' ? ']' : '}'
                } else {
                    repaired += ']}'
                }
            }
            try {
                parsed = JSON.parse(repaired)
            } catch (e2) {
                throw new Error(`JSON repair failed: ${parseErr.message}`)
            }
        }

        if (!parsed.categories || !Array.isArray(parsed.categories)) {
            throw new Error('Invalid response structure')
        }
        return res.json(parsed)
    } catch (e) {
        console.error('Packing error:', e.message)
        return res.status(500).json({ error: `Packing list: ${e.message}` })
    }
}
