# LINE OA Finance Bot

บอทสำหรับ LINE Official Account ที่ใช้บันทึกรายรับ-รายจ่ายลง Google Sheets และสรุปยอดให้ทางแชท

## วิธีใช้งาน (ในแชท LINE)

```
จ่าย 150 อาหาร ก๋วยเตี๋ยว     -> บันทึกรายจ่าย 150 หมวด "อาหาร"
รับ 5000 เงินเดือน           -> บันทึกรายรับ 5000 หมวด "เงินเดือน"
-150 อาหาร                   -> แบบย่อ (รายจ่าย)
+5000 เงินเดือน              -> แบบย่อ (รายรับ)
สรุป                         -> สรุปยอดวันนี้
สรุปเดือน                    -> สรุปยอดเดือนนี้
สรุป 2026-06                 -> สรุปยอดเดือนที่ระบุ
help                         -> วิธีใช้งาน
```

## ขั้นตอนติดตั้ง

### 1. สร้าง LINE Messaging API channel

1. ไปที่ [LINE Developers Console](https://developers.line.biz/console/)
2. สร้าง Provider (ถ้ายังไม่มี) แล้วสร้าง Channel ประเภท **Messaging API**
3. ในแท็บ **Basic settings** คัดลอกค่า **Channel secret**
4. ในแท็บ **Messaging API** เลื่อนไปที่ Channel access token แล้วกด **Issue** เพื่อสร้าง long-lived token แล้วคัดลอกไว้
5. ปิด **Auto-reply messages** และ **Greeting messages** ในแท็บ Messaging API (กันไม่ให้ชนกับบอทเรา)

### 2. สร้าง Google Sheet + Service Account

1. ไปที่ [Google Cloud Console](https://console.cloud.google.com/) สร้างโปรเจกต์ใหม่ (หรือใช้โปรเจกต์เดิม)
2. เปิดใช้งาน **Google Sheets API** ในโปรเจกต์
3. ไปที่ **IAM & Admin > Service Accounts** สร้าง Service Account ใหม่
4. สร้างคีย์แบบ JSON แล้วดาวน์โหลดไฟล์ — จะได้ `client_email` และ `private_key`
5. สร้าง Google Sheet เปล่าๆ 1 ไฟล์ แล้วกด Share ให้กับ `client_email` ของ Service Account (สิทธิ์ Editor)
6. คัดลอก Sheet ID จาก URL: `https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit`

ไม่ต้องสร้างหัวตารางเอง โค้ดจะสร้างแท็บ `Transactions` พร้อมหัวคอลัมน์ให้อัตโนมัติในการรันครั้งแรก

### 3. ตั้งค่าโปรเจกต์

```bash
npm install
cp .env.example .env
```

แก้ไฟล์ `.env`:

```
LINE_CHANNEL_ACCESS_TOKEN=<จาก ขั้นตอน 1>
LINE_CHANNEL_SECRET=<จาก ขั้นตอน 1>
GOOGLE_SERVICE_ACCOUNT_EMAIL=<client_email จาก JSON>
GOOGLE_PRIVATE_KEY="<private_key จาก JSON ทั้งบรรทัด รวม \n>"
GOOGLE_SHEET_ID=<จาก ขั้นตอน 2>
```

> หมายเหตุ: ค่า `private_key` ใน JSON จะมี `\n` อยู่ในสตริง ให้ใส่ในเครื่องหมายคำพูดทั้งหมดตามที่เป็น โค้ดจะแปลงให้เป็น newline จริงเอง

### 4. รันทดสอบในเครื่อง

```bash
npm start
```

ใช้ [ngrok](https://ngrok.com/) หรือเครื่องมือ tunnel อื่นเพื่อให้ LINE เรียก webhook เข้ามาที่เครื่องคุณได้ระหว่างทดสอบ:

```bash
ngrok http 3000
```

นำ URL ที่ได้ (เช่น `https://xxxx.ngrok-free.app/webhook`) ไปตั้งใน LINE Developers Console > Messaging API > Webhook URL แล้วกด Verify

### 5. Deploy ขึ้นจริง (แนะนำ Render)

1. ไปที่ [Render](https://render.com/) สร้าง **Web Service** ใหม่ จากโค้ดนี้ (อัป repo ไป GitHub ก่อน หรือใช้ Render Blueprint)
2. Build command: `npm install`, Start command: `npm start`
3. ใส่ Environment Variables ทั้งหมดจาก `.env` ในหน้า Settings ของ Render
4. หลัง deploy เสร็จจะได้ URL เช่น `https://your-app.onrender.com`
5. นำ `https://your-app.onrender.com/webhook` ไปตั้งเป็น Webhook URL ใน LINE Developers Console แล้วกด Verify + เปิด **Use webhook**

หลังจากนี้เพิ่มเพื่อน LINE OA แล้วลองพิมพ์ `help` ในแชทเพื่อทดสอบได้เลย

## โครงสร้างไฟล์

```
src/index.js     - express server + webhook handler
src/parser.js    - แปลงข้อความแชทเป็นคำสั่ง
src/sheets.js    - เชื่อมต่อ Google Sheets (อ่าน/เขียน)
src/summary.js   - คำนวณสรุปยอดรายวัน/รายเดือน
```

## ข้อจำกัด / สิ่งที่ควรทำต่อ

- ยังไม่มีการแก้ไข/ลบรายการที่บันทึกผิด (ต้องไปลบในชีตเอง)
- ยังไม่รองรับหลายสกุลเงิน
- ทุกข้อความที่ไม่ตรงรูปแบบคำสั่งจะถูกเมิน (ไม่ตอบ) เพื่อไม่ให้บอทไปตอบแชทอื่นที่ไม่เกี่ยวข้อง
