import { getAuthUser } from '../../lib/supabaseServer'

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end()

    const user = await getAuthUser(req)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })

    const { message, history, tripContext } = req.body
    if (!message) return res.status(400).json({ error: 'Missing message' })

    const systemPrompt = `คุณเป็น AI Travel Assistant ที่เชี่ยวชาญด้านการท่องเที่ยว ตอบเป็นภาษาไทย กระชับ ใช้ emoji ให้น่าอ่าน

ข้อมูลทริปของ user (ข้อมูลล่าสุด เชื่อถือได้เลย):
- จุดหมาย: ${tripContext?.destination || 'ไม่ระบุ'}
- วันที่: ${tripContext?.dates || 'ไม่ระบุ'}
- หมายเหตุ: ${tripContext?.notes || '-'}
- แผนการเดินทางล่าสุด: ${tripContext?.itinerary || 'ยังไม่มี'}

สำคัญ: ให้ยึดตาม"แผนการเดินทางล่าสุด" ข้างบนเท่านั้น ถ้าขัดกับข้อมูลในประวัติแชทเก่า ให้เชื่อข้อมูลล่าสุดเสมอ เพราะ user อาจแก้ไขแผนไปแล้ว
ตอบตาม context ของทริปนี้ ให้คำแนะนำที่เฉพาะเจาะจง ถ้ามีเรื่องเกี่ยวกับสถานที่ ให้แนะนำชื่อจริง ราคาประมาณ วิธีไป
ถ้าถามเรื่องฉุกเฉิน ให้ข้อมูลเบอร์ตำรวจ สถานทูต โรงพยาบาลของประเทศนั้น
ตอบให้ครบถ้วน ใช้ bullet points ให้อ่านง่าย`

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
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: systemPrompt }] },
                contents,
                generationConfig: {
                    temperature: 0.8,
                    maxOutputTokens: 16384,
                    thinkingConfig: { thinkingBudget: 1024 }
                }
            })
        })
        const data = await r.json()
        if (!r.ok) {
            console.error('Gemini API error:', JSON.stringify(data))
            return res.status(200).json({ reply: `❌ API error: ${data?.error?.message || 'unknown'}` })
        }
        // Extract only non-thinking text parts from response
        const parts = data?.candidates?.[0]?.content?.parts || []
        const reply = parts.filter(p => !p.thought && p.text).map(p => p.text).join('\n') || 'ขอโทษครับ ไม่สามารถตอบได้ในตอนนี้'
        const finishReason = data?.candidates?.[0]?.finishReason
        if (finishReason && finishReason !== 'STOP') {
            console.warn('Chat finish reason:', finishReason)
        }
        return res.status(200).json({ reply })
    } catch (e) {
        console.error('Chat error:', e)
        return res.status(500).json({ error: e.message })
    }
}
