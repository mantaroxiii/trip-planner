import { getAuthUser } from '../../lib/supabaseServer'

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end()

    const user = await getAuthUser(req)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })

    const { message, history, tripContext } = req.body
    if (!message) return res.status(400).json({ error: 'Missing message' })

    const systemPrompt = `คุณเป็น AI Travel Assistant ที่เชี่ยวชาญด้านการท่องเที่ยว ตอบเป็นภาษาไทย กระชับ ใช้ emoji ให้น่าอ่าน

ข้อมูลทริปของ user:
- จุดหมาย: ${tripContext?.destination || 'ไม่ระบุ'}
- วันที่: ${tripContext?.dates || 'ไม่ระบุ'}
- หมายเหตุ: ${tripContext?.notes || '-'}
- แผนการเดินทาง: ${tripContext?.itinerary || 'ยังไม่มี'}

ตอบตาม context ของทริปนี้ ให้คำแนะนำที่เฉพาะเจาะจง ถ้ามีเรื่องเกี่ยวกับสถานที่ ให้แนะนำชื่อจริง ราคาประมาณ วิธีไป
ถ้าถามเรื่องฉุกเฉิน ให้ข้อมูลเบอร์ตำรวจ สถานทูต โรงพยาบาลของประเทศนั้น
ตอบสั้นกระชับ ไม่เกิน 200 คำ`

    const contents = []
    // Add history
    if (history && history.length > 0) {
        history.forEach(h => {
            contents.push({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.text }] })
        })
    }
    // Add current message
    contents.push({ role: 'user', parts: [{ text: message }] })

    try {
        const apiKey = process.env.GEMINI_API_KEY
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: systemPrompt }] },
                contents,
                generationConfig: { temperature: 0.8, maxOutputTokens: 1024 }
            })
        })
        const data = await r.json()
        const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'ขอโทษครับ ไม่สามารถตอบได้ในตอนนี้'
        return res.status(200).json({ reply })
    } catch (e) {
        return res.status(500).json({ error: e.message })
    }
}
