const PROMPT = (destination, dates, notes) => `You are an expert travel planner. Convert the user's rough notes into a detailed, realistic day-by-day itinerary.

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
          "warning": false
        }
      ]
    }
  ]
}

Rules:
- type must be one of: transport, drive, sight, food, hotel, shopping
- Add realistic travel times between locations
- Set warning: true for anything needing advance booking
- Include meal suggestions if not in the notes
- Group activities geographically each day
- A typical day should have 5-8 events`;

async function callClaude(apiKey, destination, dates, notes) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 4096, messages: [{ role: 'user', content: PROMPT(destination, dates, notes) }] }),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || 'Claude API error'); }
  const data = await res.json();
  return data.content[0].text.trim();
}

async function callOpenAI(apiKey, destination, dates, notes) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: PROMPT(destination, dates, notes) }], max_tokens: 4096, response_format: { type: 'json_object' } }),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || 'OpenAI API error'); }
  const data = await res.json();
  return data.choices[0].message.content.trim();
}

async function callGemini(apiKey, destination, dates, notes) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: PROMPT(destination, dates, notes) }] }], generationConfig: { responseMimeType: 'application/json' } }),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || 'Gemini API error'); }
  const data = await res.json();
  return data.candidates[0].content.parts[0].text.trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { apiKey, provider = 'claude', destination, dates, notes } = req.body;
  if (!apiKey || !destination || !notes) return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ' });
  try {
    let raw;
    if (provider === 'openai')      raw = await callOpenAI(apiKey, destination, dates, notes);
    else if (provider === 'gemini') raw = await callGemini(apiKey, destination, dates, notes);
    else                            raw = await callClaude(apiKey, destination, dates, notes);
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const plan    = JSON.parse(cleaned);
    return res.status(200).json(plan);
  } catch (e) {
    console.error(`[${provider}] error:`, e.message);
    return res.status(500).json({ error: e.message || 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง' });
  }
}
