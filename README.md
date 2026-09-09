# Photo Booth — macOS (Canon EOS RP via USB-C)

แอปตู้ถ่ายรูปบน **Mac** (Electron / .dmg) ใช้ UI + สลิปใบเสร็จ + QR ดาวน์โหลดรูปชุดเดียวกับเวอร์ชัน APK
แต่ **ดึงภาพจากกล้อง Canon EOS RP ผ่าน USB-C** และ **พิมพ์ผ่านเครื่องพิมพ์ของระบบ macOS**

> โปรเจกต์นี้แยกต่างหากจากแอป Android (APK) — คนละ repo คนละ build

---

## 1) เชื่อมกล้อง Canon EOS RP (USB-C)

macOS มองไม่เห็น RP เป็นเว็บแคมโดยตรง ต้องลงไดรเวอร์ของ Canon ก่อน:

1. โหลด **Canon EOS Webcam Utility** (ฟรี) จากเว็บ Canon → ติดตั้ง → **รีสตาร์ต Mac**
2. ต่อกล้อง RP กับ Mac ด้วยสาย **USB-C** → เปิดกล้อง → ตั้งโหมด **M / Av / Tv** (อย่าให้กล้อง auto-off)
3. RP จะกลายเป็นกล้องชื่อ **"EOS Webcam Utility"** ให้แอปเลือกใช้

> ทางเลือกคุณภาพสูงกว่า (ภายหลัง): ใช้ `gphoto2` ยิงชัตเตอร์ถ่ายไฟล์เต็มความละเอียด — ต่อยอดได้

---

## 2) รันแอป

### ทางที่ 1: build .dmg อัตโนมัติ (แนะนำ ไม่ต้องลงอะไรบนเครื่อง dev)
1. push โค้ดขึ้น repo GitHub
2. แท็บ **Actions → Build macOS app → Run workflow**
3. โหลด artifact **photo-booth-mac-dmg** → เปิด `.dmg` → ลาก **Photo Booth** ลง Applications
4. เปิดครั้งแรก: คลิกขวาที่แอป → **Open** (เพราะเป็น build ที่ยังไม่เซ็น) → อนุญาต **กล้อง** เมื่อถูกถาม

### ทางที่ 2: รันบน Mac โดยตรง
```bash
npm install
npm start          # เปิดแอปทันที
npm run dist       # สร้าง .dmg ไว้ในโฟลเดอร์ release/
```

---

## 3) ตั้งค่าในแอป (ปุ่ม ⚙︎)
- **กล้อง**: เลือก **EOS Webcam Utility** (Canon EOS RP)
- **เครื่องปริ้นบลูทูธ 80mm**: จับคู่ใน **System Settings → Bluetooth** ก่อน แล้วเลือกในลิสต์ (เว้นว่าง = ใช้ช่องพิมพ์ระบบ)
- **GitHub (QR)**: Owner / Repository / Pages URL / Access Token — เหมือนเวอร์ชัน APK (repo `booth-photos`)
- **ชื่อร้าน**: หัวสลิป

### เครื่องปริ้นบลูทูธ (ESC/POS 80mm)
เครื่อง 80mm ส่วนใหญ่เป็น **Bluetooth Classic (SPP)** — พอจับคู่ใน macOS จะกลายเป็นพอร์ต `/dev/cu.<ชื่อ>`
แอปเขียนคำสั่ง ESC/POS (Floyd–Steinberg + raster GS v 0 + ตัดกระดาษ) ลงพอร์ตนั้นตรงๆ เหมือนเวอร์ชัน Android
> เลือกเครื่องบลูทูธไว้ → พิมพ์ผ่านบลูทูธ · เว้นว่าง → เปิดช่องพิมพ์ของ macOS

## การทำงาน
- เลือกเลย์เอาต์ (1–6 รูป) → แตะถ่าย 1 ครั้ง → นับถอยหลังถ่ายอัตโนมัติทีละรูปจนครบ
- กด **พิมพ์** → พิมพ์ผ่าน **เครื่องบลูทูธ 80mm** (ถ้าเลือกไว้) หรือ **ช่องพิมพ์ของ macOS**
- **บันทึกลงเครื่อง** → เซฟไฟล์ลง `~/Pictures/PhotoBooth`
- **QR** → อัปสลิปขึ้น `booth-photos` แล้วสแกนโหลดรูปได้จริง

## โครงสร้าง
| ไฟล์ | หน้าที่ |
|---|---|
| `main.js` | Electron main — หน้าต่าง, สิทธิ์กล้อง, IPC บันทึก/พิมพ์ |
| `preload.js` | สะพาน `window.desktop` (saveImage / printImage) |
| `renderer/index.html` | UI + สลิป + QR (ชุดเดียวกับ APK) |
| `renderer/desktop-bridge.js` | เลือกกล้อง Canon, override บันทึก/พิมพ์ให้เป็นแบบ desktop |
| `.github/workflows/build-mac.yml` | build .dmg อัตโนมัติบน macOS runner |
