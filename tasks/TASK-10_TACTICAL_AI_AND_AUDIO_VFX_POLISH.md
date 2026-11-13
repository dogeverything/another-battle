# TASK-10: TRÍ TUỆ NHÂN TẠO PVE, ÂM THANH WEBAUDIO, MÀN HÌNH KẾT QUẢ & KIỂM THỬ
### Module: Tactical AI, Procedural Audio, Result Scene & Automated Tests

---

## 1. Thông tin tổng quan
* **Mã task:** `TASK-10`
* **Độ ưu tiên:** P1 (High)
* **Điều kiện tiên quyết:** `TASK-08`, `TASK-09`

---

## 2. Mục tiêu
Hoàn thiện trải nghiệm trò chơi với:
1. **Trí tuệ nhân tạo (`TacticalAI.js`):** Đối thủ máy thông minh biết sử dụng cả 5 kỹ năng Chỉ huy và 3 loại đạn pháo.
2. **Hệ thống âm thanh tổng hợp (`SoundSynthesizer.js`):** Tạo hiệu ứng âm thanh chiến thuật hải quân bằng WebAudio API.
3. **Màn hình Kết quả (`ResultScene.js`):** Tổng kết trận đấu, hiển thị toàn bộ bản đồ 2 bên sau trận và tùy chọn Chơi lại / Về Menu.
4. **Bộ Kiểm thử Tự động (`tests/game-logic.test.js`):** Xác minh 100% logic game qua `npm test`.

---

## 3. Phạm vi tệp tin liên quan
* `src/shared/TacticalAI.js`
* `src/utils/SoundSynthesizer.js`
* `src/scenes/ResultScene.js`
* `tests/game-logic.test.js`

---

## 4. Đặc tả kỹ thuật chi tiết

### 4.1. Thuật toán AI Chiến Thuật (`TacticalAI.js`)
* **Giai đoạn Chọn Chỉ huy & Thiết kế đội hình:**
  * Tự chọn ngẫu nhiên 1 trong 5 Chỉ huy.
  * Nếu cầm `SPLITTER`, tự động tách 1 tàu lớn thành 2 tàu nhỏ; nếu cầm `PHANTOM`, tự động thêm Thuyền ma 3 ô vào đội hình.
* **Giai đoạn Chiến đấu (Hunt & Target):**
  * **Ưu tiên 1:** Bắn vào các ô đã được Sonar phát hiện (`sonarDetected`).
  * **Ưu tiên 2 (Target Mode):** Nếu có các ô từng bắn `HIT` mà tàu chưa chìm, ưu tiên bắn các ô kề cạnh (trên/dưới/trái/phải) hoặc dùng Đạn chùm $3\times 3$ để càn quét cụm đó.
  * **Ưu tiên 3 (Hunt Mode):** Sử dụng kỹ năng Chỉ huy (`SONAR`, `FOG`, `EVACUATOR`) vào thời điểm thích hợp và bắn thăm dò theo quy tắc bàn cờ (Parity Check) hoặc dùng Đạn nảy.

### 4.2. Bộ Kiểm Thử Tự Động (`tests/game-logic.test.js`)
Kiểm tra tự động các trường hợp biên:
1. Đội hình mặc định đúng 6 đơn vị và tổng đúng **22 ô** (bao gồm Căn cứ chỉ huy dấu `+` 5 ô).
2. Luật bắn trúng được bắn tiếp (`keepTurn: true`), bắn trượt mất lượt (`keepTurn: false`).
3. Đạn chùm $3\times 3$ và Đạn nảy (1 ô chính + 2 ô ngẫu nhiên chưa bắn) hoạt động chính xác và chỉ dùng được 1 lần.
4. Cả 5 kỹ năng Chỉ huy (*Phân tách*, *Thuyền ma*, *Di tản*, *Đạn dò tìm*, *Sương mù*) hoạt động đúng thiết kế.

---

## 5. Tiêu chí nghiệm thu (Definition of Done)
- [ ] Chạy `npm test` vượt qua toàn bộ các bài kiểm tra (0 lỗi).
- [ ] Chạy `npm run build` đóng gói thành công.
- [ ] Âm thanh Sonar, pháo kích, nổ trúng, trượt nước và cảnh báo tàu chìm hoạt động sống động, có nút Bật/Tắt âm thanh.

