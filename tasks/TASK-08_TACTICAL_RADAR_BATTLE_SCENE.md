# TASK-08: MÀN HÌNH CHIẾN ĐẤU RADAR ĐÔI, VŨ KHÍ & KỸ NĂNG
### Module: Tactical Dual-Radar Battle Scene (`BattleScene.js`)

---

## 1. Thông tin tổng quan
* **Mã task:** `TASK-08`
* **Độ ưu tiên:** P0 (Critical - Cốt lõi)
* **Điều kiện tiên quyết:** `TASK-03`, `TASK-04`, `TASK-07`

---

## 2. Mục tiêu
Xây dựng màn hình chiến đấu chính (`BattleScene`) với giao diện **Radar Đôi (Dual Radar Console)**:
* Hiển thị đồng thời **Bản đồ Hạm đội nhà (Trái)** và **Bản đồ Tấn công đối phương (Phải)**.
* Cho phép chuyển đổi linh hoạt giữa 3 loại đạn: **Đạn thường ($1\times 1$)**, **Đạn chùm ($3\times 3$)**, **Đạn nảy (Ricochet)**.
* Cho phép kích hoạt các kỹ năng Chỉ huy chủ động trong trận (**Di tản**, **Đạn dò tìm $3\times 3$**, **Sương mù 2 lượt**) mà không làm mất lượt bắn chính.
* Hỗ trợ màn hình khóa bảo mật chuyển lượt (Pass-and-Play Curtain) cho chế độ Local PvP.

---

## 3. Phạm vi tệp tin liên quan
* `src/scenes/BattleScene.js`
* `src/utils/RadarRenderer.js`

---

## 4. Đặc tả kỹ thuật chi tiết

### 4.1. Bố Cục Hai Bảng Radar $10 \times 10$
1. **Bảng Trái — HẠM ĐỘI ĐỒNG MINH (Allied Fleet Grid):**
   * Hiển thị rõ hình dáng các tàu & căn cứ của mình, vị trí Thuyền ma (nếu có).
   * Hiển thị các ô địch đã bắn trúng (lửa cháy đỏ `#FF2A54`) và bắn trượt (chấm xanh `#3A6EA5`).
   * Khi kích hoạt kỹ năng **Di tản (`EVACUATOR`)**: Cho phép click chọn 1 tàu nguyên vẹn trên Bảng Trái và đặt sang vị trí mới chưa bị bắn trên Bảng Trái.
2. **Bảng Phải — RADAR MỤC TIÊU ĐỊCH (Enemy Target Grid):**
   * Mặc định ẩn toàn bộ tàu địch chưa chìm (Fog of War).
   * **Khung ngắm thông minh (Targeting Reticle):**
     * Đạn thường ($1\times 1$) / Đạn nảy: Hiển thị tâm ngắm 1 ô.
     * Đạn chùm ($3\times 3$) / Kỹ năng Đạn dò tìm ($3\times 3$): Hiển thị khung vùng $3\times 3$ (9 ô) quanh vị trí con trỏ chuột.
   * **Hiển thị Tín hiệu Sonar (`SONAR`):** Các ô được Đạn dò tìm phát hiện có đơn vị địch sẽ nhấp nháy vòng tròn vàng `#FFE66D` báo hiệu mục tiêu.
   * **Hiển thị Màn Sương Mù (`FOG`):** Khi người chơi đang chịu hiệu ứng Sương mù của đối phương (`fogTurnsRemaining > 0`), một lớp khói mù chiến thuật phủ lên Bảng Phải, tạm ẩn các dấu vết Trúng/Trượt cũ và trạng thái tàu chìm trong đúng 2 lượt.

### 4.2. Thanh Vũ Khí & Kỹ Năng (Bottom Tactical Dock)
* **3 Nút Chọn Đạn Pháo:**
  1. `🎯 ĐẠN THƯỜNG (1x1) [∞]`
  2. `💥 ĐẠN CHÙM (3x3) [1/1]`
  3. `⚡ ĐẠN NẢY (+2 Ô) [1/1]`
* **Nút Kỹ Năng Chỉ Huy:**
  * Với `EVACUATOR`, `SONAR`, `FOG`: Hiển thị nút bấm `[ KÍCH HOẠT KỸ NĂNG (1/1) ]` khi tới lượt của mình.
  * Với `SPLITTER`, `PHANTOM`: Hiển thị trạng thái `[ ĐÃ KÍCH HOẠT KHI DÀN TRẬN ]`.
* **Thanh Trạng Thái Sức Khỏe Hạm Đội (HP Bar):**
  * Hiển thị số ô đơn vị còn lại của 2 bên (VD: `22/22 Ô`) và thông báo diễn biến trận đấu theo thời gian thực.

---

## 5. Tiêu chí nghiệm thu (Definition of Done)
- [ ] Khung ngắm trên Radar Phải thay đổi đúng kích thước $1\times 1$ hoặc $3\times 3$ tùy theo loại đạn/kỹ năng đang chọn.
- [ ] Hiệu ứng đường đạn bay, nổ trúng, trượt nước, đạn nảy 2 lần và quét Sonar hiển thị rõ ràng, mượt mà.
- [ ] Khi bắn trúng được bắn tiếp; khi bắn trượt chuyển lượt chính xác.
- [ ] Khi Thuyền ma bị bắn trúng 1-2 ô vẫn báo `TRÚNG!` như tàu thật; khi trúng đủ 3 ô hiện thông báo lộ diện Thuyền ma.

