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

IMPORTANT: Only suggest activities for time slots NOT already occupied. Find gaps of 1+ hours between existing activities, or before the first activity, or after the last one.

Return ONLY valid JSON, no markdown:
{"gaps": [
  {
    "startTime": "HH:MM",
    "endTime": "HH:MM",
    "duration": "X hours",
    "suggestion": {"time": "HH:MM", "title": "...", "detail": "...", "icon": "...", "type": "..."}
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
                    generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
                }),
            }
        )

        const data = await response.json()
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (!jsonMatch) throw new Error('Invalid AI response')

        const parsed = JSON.parse(jsonMatch[0])
        return res.json(parsed)
    } catch (e) {
        console.error('Fill gaps error:', e)
        return res.status(500).json({ error: e.message || 'Failed to analyze gaps' })
    }
}
