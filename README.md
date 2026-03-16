# ✈️ AI Trip Planner

พิมพ์ note คร่าวๆ แล้วให้ AI จัด plan ให้เป็นระเบียบ

---

## วิธี Deploy (ฟรีทั้งหมด)

### 1. อัปโหลดขึ้น GitHub

1. ไปที่ [github.com](https://github.com) → New repository
2. ตั้งชื่อ `trip-planner` → Public → Create
3. อัปโหลดไฟล์ทั้งหมดในโฟลเดอร์นี้

### 2. Deploy บน Vercel

1. ไปที่ [vercel.com](https://vercel.com) → Sign up (ใช้บัญชี GitHub)
2. กด **"Add New Project"** → Import repo `trip-planner`
3. กด **Deploy** — รอประมาณ 1 นาที
4. ได้ลิงก์ `https://trip-planner-xxx.vercel.app` ทันที

---

## โครงสร้างไฟล์

```
trip-planner/
├── pages/
│   ├── index.jsx        ← UI หลัก (3 screens)
│   └── api/
│       └── generate.js  ← รับ notes → เรียก Claude API → คืน plan
└── package.json
```

---

## การทำงาน

```
User พิมพ์ notes
      ↓
กด "ให้ AI จัด Plan"
      ↓
/api/generate รับ notes + API key → ส่งไป Claude
      ↓
Claude คืน JSON plan
      ↓
UI แสดงผลเป็น interactive timeline
```

---

## Next Steps (vibe code ต่อ)

- [ ] เพิ่ม Supabase เพื่อบันทึก plan ไว้ในบัญชี
- [ ] เพิ่ม Clerk สำหรับ login
- [ ] เพิ่มฟีเจอร์ share plan ให้เพื่อน (sync notes realtime)
- [ ] รับ input จาก URL / YouTube link / Google Maps link
- [ ] export เป็น PDF
