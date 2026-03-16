import { getAuthUser } from '../../lib/supabaseServer'

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end()

    const user = await getAuthUser(req)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })

    const { destination, dates, dayTitle, currentActivity, otherActivities = [] } = req.body
    if (!currentActivity) return res.status(400).json({ error: 'Missing currentActivity' })

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not set' })

    const otherList = otherActivities.map(a => `- ${a.time} ${a.title}`).join('\n')

    const prompt = `You are a travel expert helping someone improve their trip itinerary.

Trip: ${destination || 'Unknown destination'}
Dates: ${dates || 'Unknown dates'}
Day: ${dayTitle}

Current activity to replace:
- Time: ${currentActivity.time}
- Activity: ${currentActivity.title}
- Detail: ${currentActivity.detail || 'N/A'}
- Type: ${currentActivity.type || 'N/A'}

Other activities on the same day (for context):
${otherList || '(none)'}

Suggest 3 alternative activities for the same time slot. Each should be different in style/category from each other.
Return ONLY a valid JSON object in this exact format (no markdown, no extra text):
{"suggestions": [
  {"time": "${currentActivity.time}", "title": "...", "detail": "...", "icon": "...", "type": "..."},
  {"time": "${currentActivity.time}", "title": "...", "detail": "...", "icon": "...", "type": "..."},
  {"time": "${currentActivity.time}", "title": "...", "detail": "...", "icon": "...", "type": "..."}
]}`

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.8, maxOutputTokens: 512 },
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
        console.error('Suggest error:', e)
        return res.status(500).json({ error: e.message || 'AI suggestion failed' })
    }
}
