import { getAuthUser } from '../../lib/supabaseServer'

const LANG_INSTRUCTION = {
  th: 'Write ALL titles, details, hotel names, and activity descriptions in Thai (ภาษาไทย). Keep place names in their original language but add Thai transliteration.',
  en: 'Write ALL titles, details, hotel names, and activity descriptions in English.',
  jp: 'Write ALL titles, details, hotel names, and activity descriptions in Japanese (日本語). Keep place names in their original language but add Japanese readings.',
}

const PROMPT = (destination, dates, notes, lang = 'th') => `You are an expert travel planner. Convert the user's rough notes into a detailed, realistic day-by-day itinerary.

Trip Details:
- Destination: ${destination}
- Dates: ${dates}

User's Notes:
${notes}

Return ONLY a valid JSON object — no markdown, no code blocks, no explanation. Use this exact structure:

{
  "tripTitle": "Trip Title Here",
  "days": [
    {
      "day": 1,
      "date": "1 Apr",
      "title": "City A to City B",
      "emoji": "🌸",
      "hotel": "Hotel name or null",
      "events": [
        {
          "time": "09:00",
          "icon": "🚗",
          "type": "transport",
          "title": "Activity title",
          "detail": "Extra detail or null",
          "lat": 35.6762,
          "lng": 139.6503,
          "warning": false
        }
      ]
    }
  ]
}

Rules:
- ${LANG_INSTRUCTION[lang] || LANG_INSTRUCTION.th}
- type must be one of: transport, drive, sight, food, hotel, shopping
- Add realistic travel times between locations
- Set warning: true for anything needing advance booking
- Include meal suggestions if not in the notes
- Group activities geographically each day
- A typical day should have 5–8 events
- CRITICAL: You MUST include accurate, real-world GPS coordinates (lat, lng as decimal numbers) for EVERY event. Look up the actual coordinates of each specific location/restaurant/attraction. For example, Tokyo Tower is lat: 35.6586, lng: 139.7454. Do NOT guess or approximate — use the real coordinates of the actual place.`

async function callClaude(apiKey, destination, dates, notes, lang) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: PROMPT(destination, dates, notes, lang) }],
    }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || 'Claude API error')
  }
  const data = await res.json()
  return data.content[0].text.trim()
}

async function callOpenAI(apiKey, destination, dates, notes, lang) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: PROMPT(destination, dates, notes, lang) }],
      max_tokens: 4096,
      response_format: { type: 'json_object' },
    }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || 'OpenAI API error')
  }
  const data = await res.json()
  return data.choices[0].message.content.trim()
}

async function callGemini(apiKey, destination, dates, notes, lang) {
  const key = apiKey || process.env.GEMINI_API_KEY
  if (!key) throw new Error('Gemini API key not configured. กรุณาติดต่อผู้ดูแลระบบ')

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: PROMPT(destination, dates, notes, lang) }] }],
      generationConfig: { responseMimeType: 'application/json' },
    }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || 'Gemini API error')
  }
  const data = await res.json()
  return data.candidates[0].content.parts[0].text.trim()
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อน' })

  const { apiKey, provider = 'gemini', destination, dates, notes, lang = 'th' } = req.body

  if (!destination || !notes) {
    return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ' })
  }

  if (provider !== 'gemini' && !apiKey) {
    return res.status(400).json({ error: `กรุณาใส่ API key สำหรับ ${provider}` })
  }

  try {
    let raw

    if (provider === 'openai') {
      raw = await callOpenAI(apiKey, destination, dates, notes, lang)
    } else if (provider === 'gemini') {
      raw = await callGemini(apiKey, destination, dates, notes, lang)
    } else {
      raw = await callClaude(apiKey, destination, dates, notes, lang)
    }

    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const plan = JSON.parse(cleaned)

    return res.status(200).json(plan)
  } catch (e) {
    console.error(`[${provider}] generate error:`, e.message)
    return res.status(500).json({ error: e.message || 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง' })
  }
}
