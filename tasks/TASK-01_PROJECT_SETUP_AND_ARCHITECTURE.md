# TASK-01: KHỞI TẠO DỰ ÁN & KIẾN TRÚC CLIENT/SERVER
### Module: Project Setup, Vite + Phaser 3 & Shared Architecture

---

## 1. Thông tin tổng quan
* **Mã task:** `TASK-01`
* **Độ ưu tiên:** P0 (Critical - Cốt lõi)
* **Điều kiện tiên quyết:** Không có.

---

## 2. Mục tiêu
Thiết lập nền tảng kỹ thuật cho **Another Battle** gồm:
* Môi trường phát triển **Vite 6 + Phaser 3.88+** hỗ trợ giao diện Radar Hải quân chiến thuật độ phân giải $1280 \times 720\text{ px}$ (16:9).
* Cấu trúc thư mục phân tách rõ ràng giữa:
  * `src/shared/`: Logic cốt lõi dùng chung cho cả Client và WebSocket Server.
  * `src/scenes/`: Hệ thống màn hình theo đúng luồng `Menu -> Lobby -> Commander -> Deploy -> Battle -> Result`.
  * `server/`: Máy chủ phòng chơi Online PvP qua WebSocket (`ws`).
* Cấu hình Vite proxy tự động định tuyến `/ws` sang cổng WebSocket Server (`3001`) để chạy local/LAN thuận tiện.

---

## 3. Phạm vi tệp tin liên quan
* `package.json`
* `vite.config.js`
* `index.html`
* `src/main.js`
* `src/config/GameConfig.js`
* `src/utils/ThemeConfig.js`

---

## 4. Đặc tả kỹ thuật chi tiết

### 4.1. Cấu hình `package.json` & Scripts
* `npm run dev`: Khởi chạy song song Vite Dev Server (port `3000`) và WebSocket Server (port `3001`).
* `npm run build`: Đóng gói ứng dụng ra thư mục `dist/`.
* `npm test`: Chạy bộ kiểm thử tự động `node tests/game-logic.test.js`.

### 4.2. Bảng màu & Phong cách Tactical Naval Radar (`ThemeConfig.js`)
* Nền Radar sâu: `#06101E` / `#0A192F`.
* Đường lưới Phosphor Cyan: `#00F5D4` (độ mờ `0.25` - `0.85`).
* Tín hiệu Trúng đạn (Hit Alert): `#FF2A54` / `#FF6B35`.
* Tín hiệu Trượt (Water Miss): `#3A6EA5`.
* Tín hiệu Sonar Dò tìm: `#FFE66D`.
* Tín hiệu Thuyền ma (Decoy): `#B5179E` / `#C77DFF`.

---

## 5. Tiêu chí nghiệm thu (Definition of Done)
- [ ] Chạy `npm install` và `npm run build` hoàn tất không lỗi.
- [ ] Khung game Phaser khởi tạo đúng kích thước $1280 \times 720$, tự động co giãn (`Phaser.Scale.FIT`) và căn giữa màn hình.
- [ ] Đăng ký đầy đủ các Scene theo luồng: `BootScene`, `MenuScene`, `LobbyScene`, `CommanderScene`, `DeployScene`, `BattleScene`, `ResultScene`.

