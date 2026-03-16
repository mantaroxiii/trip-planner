export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { apiKey, destination, dates, notes } = req.body;

  if (!apiKey || !destination || !notes) {
    return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ' });
  }

  const prompt = `You are an expert travel planner. The user has written rough notes about a trip they want to take. Your job is to turn these unstructured notes into a detailed, realistic day-by-day itinerary.

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
- Set warning true for anything needing advance booking
- Include meal suggestions if not in notes
- Group activities geographically each day
- A typical day should have 5-8 events`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(400).json({ error: err.error?.message || 'Claude API error' });
    }

    const data = await response.json();
    const raw  = data.content[0].text.trim();
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const plan = JSON.parse(cleaned);

    return res.status(200).json(plan);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง' });
  }
}
