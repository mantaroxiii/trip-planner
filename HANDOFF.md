# Trip Planner — Handoff Notes

## Live URL
https://trip-planner-omega-umber.vercel.app

## GitHub
https://github.com/mantaroxiii/trip-planner

## สิ่งที่ทำไปแล้ว (Phase 1 complete)

### Auth
- Login/Signup ด้วย email + password (Supabase Auth)
- Google OAuth ยังไม่ได้ตั้งค่า (ต้องการ Google Cloud Console)

### Database (Supabase)
- ตาราง `trips` พร้อม RLS
- Schema อยู่ที่ `supabase-schema.sql`
- Project: https://vtoctqrfkktmbzhhgubr.supabase.co

### Features ที่ทำงานได้แล้ว
1. Login / Signup (email)
2. สร้าง / ลบ / list trips (`/trips`)
3. Draft input + Generate plan ด้วย Gemini 2.5 Flash (shared key ฟรี)
4. Plan view — day tabs, timeline, check activity, note
5. Auto-save draft ไปที่ Supabase
6. Real-time sync — ถ้าคนอื่นแก้ plan จะ update ทันที (Supabase Realtime)
7. Share button — copy production URL

### Page Routes
| Route | หน้า |
|-------|------|
| `/` | redirect → `/trips` หรือ `/login` |
| `/login` | login/signup |
| `/trips` | รายการ trips ของฉัน |
| `/trip/[id]` | draft → generate → plan view |

### API Routes
| Endpoint | ทำอะไร |
|----------|--------|
| `GET /api/trips` | list trips ของ user |
| `POST /api/trips` | สร้าง trip ใหม่ |
| `GET /api/trips/[id]` | ดู trip |
| `PATCH /api/trips/[id]` | แก้ไข trip (destination, dates, notes, plan_json) |
| `DELETE /api/trips/[id]` | ลบ trip |
| `POST /api/generate` | generate plan ด้วย AI (require auth) |

## Stack
- Next.js 14 (Pages Router)
- React (inline styles, no Tailwind)
- Supabase (Auth + Database + Realtime)
- Vercel (hosting)
- Gemini 2.5 Flash (shared server key)

## Environment Variables (Vercel + .env.local)
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
GEMINI_API_KEY
NEXT_PUBLIC_APP_URL=https://trip-planner-omega-umber.vercel.app
```

## Key Files
```
lib/
  supabase.js          — browser Supabase client
  supabaseServer.js    — server client + getAuthUser()
pages/
  index.jsx            — redirect
  login.jsx            — login/signup
  trips.jsx            — trips list
  trip/[id].jsx        — trip detail (draft + plan + realtime)
  api/
    generate.js        — AI generate endpoint (auth required)
    trips/
      index.js         — GET list + POST create
      [id].js          — GET + PATCH + DELETE
supabase-schema.sql    — SQL สำหรับรันใน Supabase Dashboard
```

## สิ่งที่ยังไม่ได้ทำ (จาก Plan.md)
3. ✅ Real-time sync — ทำแล้ว (basic)
4. Share link — ทำแล้ว แต่ยังไม่มี public view (เพื่อนต้อง login ก่อน)
5. Edit plan — แก้ time/activity inline ยังไม่ได้ทำ
6. Multiple trips — ทำแล้ว
7. AI recommend — ยังไม่ได้ทำ
8. Packing list — ยังไม่ได้ทำ
9. Export PDF/รูป — ยังไม่ได้ทำ
10. No-AI mode — ยังไม่ได้ทำ

## 🚨 เร่งด่วนที่สุด — Share Link ใช้งานไม่ได้จริง

**ปัญหา:** เพื่อนกด share link → ต้อง login → หลัง login redirect ไปที่ `/trips` แทนที่จะกลับมาที่ trip ที่แชร์ และไม่มีสิทธิ์ดู trip ของคนอื่นอยู่ดี (API ล็อก owner เท่านั้น)

**สิ่งที่ต้องทำ (2 อย่าง):**

### 1. หลัง login ให้ redirect กลับมาที่ link เดิม
- แก้ `pages/login.jsx` — ก่อน redirect ไป `/trips` ให้เช็ค `?next=` query param
- แก้ `pages/trip/[id].jsx` — ถ้า session หมด ให้ redirect ไป `/login?next=/trip/[id]`

```js
// pages/login.jsx — เปลี่ยน router.replace('/trips') เป็น:
const next = router.query.next || '/trips'
router.replace(next)

// pages/trip/[id].jsx — เปลี่ยน router.replace('/login') เป็น:
router.replace(`/login?next=/trip/${router.query.id}`)
```

### 2. ให้เพื่อนดู trip ที่ถูกแชร์ได้หลัง login
- แก้ `pages/api/trips/[id].js` — นอกจาก owner ให้ดูได้ถ้ามี `share_code` ตรงกัน หรือเป็น member ใน `trip_members`
- วิธีง่ายที่สุด: เพิ่ม RLS policy ใน Supabase ให้ trip ที่มี `share_code` สามารถอ่านได้โดย user ที่ login แล้วทุกคน

```sql
-- เพิ่มใน Supabase SQL Editor
create policy "trips_shared_select" on trips
  for select
  using (share_code is not null and auth.uid() is not null);
```

แล้วแก้ API route ให้ bypass owner check เมื่อ user เป็น member หรือ trip มี share_code:

```js
// pages/api/trips/[id].js
if (trip.owner_id !== user.id) {
  // แทนที่จะ return 403 ทันที ให้เช็คว่า trip มี share_code ไหม
  if (!trip.share_code) return res.status(403).json({ error: 'Forbidden' })
  // ถ้ามี share_code = อนุญาตให้อ่านได้ (GET เท่านั้น)
  if (req.method !== 'GET') return res.status(403).json({ error: 'Forbidden' })
}
```

---

## Known Issues อื่นๆ
- Google OAuth ยังไม่ได้ตั้งค่า
- checked activities และ notes เก็บใน localStorage (ไม่ sync ข้าม device)
- Gemini 2.5 Flash เป็น preview model — RPD limit ต่ำ อาจต้องเปลี่ยน model ถ้า traffic เยอะ
