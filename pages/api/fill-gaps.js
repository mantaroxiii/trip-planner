import { getAuthUser } from '../../lib/supabaseServer'

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end()

    const user = await getAuthUser(req)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })

    const { destination, dates, dayTitle, dayDate, events } = req.body
    if (!events || events.length === 0) return res.status(400).json({ error: 'Missing events' })

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not set' })

    // Build timeline of existing activities
    const timeline = events
        .filter(e => e.time)
        .sort((a, b) => a.time.localeCompare(b.time))
        .map(e => `${e.time} — ${e.title}`)
        .join('\n')

    const prompt = `You are a travel expert. Analyze this trip day schedule and find FREE time gaps, then suggest activities to fill them.

Trip: ${destination || 'Unknown'}
Dates: ${dates || 'Unknown'}
Day: ${dayTitle} (${dayDate || ''})

Current schedule:
${timeline}

IMPORTANT: Only suggest activities for time slots NOT already occupied. Find gaps of 1+ hours between existing activities, or before the first activity (after 08:00), or after the last one (before 22:00).
Suggest at most 3 activities. Keep titles and details SHORT.

Return ONLY valid JSON:
{"gaps": [
  {
    "startTime": "HH:MM",
    "endTime": "HH:MM",
    "duration": "X hours",
    "suggestion": {"time": "HH:MM", "title": "short title", "detail": "short detail", "icon": "emoji", "type": "sight"}
  }
]}

If no gaps exist, return: {"gaps": []}`

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.7,
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
        if (!parsed.gaps || !Array.isArray(parsed.gaps)) {
            throw new Error('Invalid response structure')
        }
        return res.json(parsed)
    } catch (e) {
        console.error('Fill gaps error:', e.message)
        return res.status(500).json({ error: `Fill gaps: ${e.message}` })
    }
}
