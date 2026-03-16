ผมกำลัง build "AI Trip Planner" web app อยู่ครับ มี context ดังนี้:

## สิ่งที่ทำไปแล้ว
- Next.js 14 (Pages Router) app อยู่ที่ repo: github.com/mantaroxiii/trip-planner
- Deploy บน Vercel: trip-planner-omega-umber.vercel.app
- ตอนนี้ทำงานได้แล้ว: user ใส่ rough notes → AI จัด plan ให้เป็น day-by-day itinerary
- รองรับ 3 AI providers: Claude (claude-sonnet-4-6), OpenAI (gpt-4o), Gemini (gemini-1.5-flash)
- ตอนนี้ API key เก็บใน localStorage ของ user แต่ละคน

## Stack
- Next.js 14 Pages Router
- React (inline styles, no Tailwind)
- Vercel (hosting + serverless API routes)
- GitHub (source)
- localStorage (ตอนนี้)

## สิ่งที่อยากเพิ่มต่อ (งานหลัก)
อยากทำเป็น full SaaS app โดยมี features:
1. Login ด้วย Supabase Auth (email + Google)
2. Shared Gemini Flash API key เก็บใน Vercel env var (ไม่ให้ user ใส่ key เอง)
3. Real-time sync — เพื่อนเปิด plan เดียวกันได้ เวลาใครแก้ไขจะ update ทันทีพร้อมบอกว่าใครแก้
4. Share link — สร้าง link ให้เพื่อนเปิดดู/แก้ไข plan ร่วมกันได้
5. Edit plan — แก้ time/activity ได้โดยไม่ต้อง generate ใหม่
6. Multiple trips — จัดการหลาย trip ในหน้าเดียว
7. AI recommend — ตรวจจับช่วงเวลาว่างใน plan แล้วให้ AI แนะนำสถานที่ที่เหมาะสม เลือกได้ว่าจะเพิ่มลงทริปไหม
8. Packing list — ให้ AI generate จาก plan ที่มี
9. Export — export plan เป็นรูปหรือ PDF
10. No-AI mode — smart parser ที่ parse format ง่ายๆ โดยไม่ต้องใช้ AI

## Key decisions
- ใช้ Supabase (free tier) สำหรับ database + auth + real-time
- Gemini Flash free tier เป็น shared key (1,500 req/day ฟรี) ไม่ให้ user ใส่ key เอง
- Identity = Supabase Auth จริง (ไม่ใช่แค่ใส่ชื่อ)
- ทุก cost = $0 (Supabase free + Vercel free + Gemini free)

## โครงสร้าง pages ที่ควรเป็น
/login          → login/signup
/trips          → รายการ trip ของฉัน  
/trip/[id]      → ดู/แก้ไข trip (real-time)
/trip/[id]/share → เพื่อนเปิดจาก share link

## Database schema (Supabase) ที่ต้องการ
trips: id, title, plan_json, owner_id, share_code, created_at, updated_at
trip_edits: id, trip_id, user_id, user_name, change_description, timestamp
trip_members: id, trip_id, user_id, role (owner/editor/viewer)

## ไฟล์ปัจจุบันที่สำคัญ
pages/index.jsx       → main UI (draft input + plan view)
pages/api/generate.js → API route ที่ call Claude/OpenAI/Gemini

อยากให้ช่วย build ต่อจากนี้ครับ เริ่มจาก Supabase setup + auth ก่อนได้เลย