# TASK-06: MÀN HÌNH CHỌN CHỈ HUY (VÀO GAME -> CHỌN CHỈ HUY)
### Module: Commander Selection Scene (`CommanderScene.js`)

---

## 1. Thông tin tổng quan
* **Mã task:** `TASK-06`
* **Độ ưu tiên:** P1 (High)
* **Điều kiện tiên quyết:** `TASK-04`, `TASK-05`

---

## 2. Mục tiêu
Xây dựng màn hình **Chọn Chỉ Huy (`CommanderScene`)** nằm ngay sau bước **Vào Game** và trước bước **Thiết Kế Đội Hình (`DeployScene`)**:
* Cho phép người chơi lựa chọn 1 trong 5 Chỉ huy chiến thuật trước khi bước vào bàn sắp xếp đội hình.
* Hiển thị trực quan vai trò, giai đoạn kích hoạt kỹ năng (*Giai đoạn Thiết kế đội hình* hay *Giai đoạn Chiến đấu*) và mô tả chi tiết của từng Chỉ huy.

---

## 3. Phạm vi tệp tin liên quan
* `src/scenes/CommanderScene.js`
* `src/shared/CommanderSkills.js`

---

## 4. Đặc tả kỹ thuật chi tiết

### 4.1. Danh sách 5 Thẻ Chỉ Huy & Tạo Hình Model (Commander Cards)
1. **Kael Vance — *"Kiến Trúc Sư Hạm Đội"* (`SPLITTER` - Kỹ năng: Phân Tách):**
   * *Loại kỹ năng:* Dàn trận (Deployment).
   * *Tạo hình Model:* Sĩ quan công binh hải quân khoác quân phục xanh thép (`#00B4D8`), đeo kính nhắm cơ khí một bên mắt, điều khiển bản vẽ hologram chia tách tàu chiến.
   * *Mô tả:* Tách 1 đơn vị lớn ($>1$ ô) thành 2 đơn vị nhỏ độc lập khi thiết kế đội hình.
2. **Vespera Noctis — *"Bóng Ma Biển Sâu"* (`PHANTOM` - Kỹ năng: Thuyền Ma):**
   * *Loại kỹ năng:* Dàn trận (Deployment).
   * *Tạo hình Model:* Nữ thuyền trưởng tác chiến điện tử mặc áo khoác hải quân đen viền tím neon (`#C77DFF`), mũ sĩ quan kéo thấp, hiệu ứng ảnh ảo hologram lập lòe.
   * *Mô tả:* Triệu hồi thêm 1 Thuyền ma dài 3 ô làm mồi nhử đánh lừa radar đối phương.
3. **Akira Sato — *"Bậc Thầy Cơ Động"* (`EVACUATOR` - Kỹ năng: Di Tản):**
   * *Loại kỹ năng:* Chiến đấu chủ động (Battle Active).
   * *Tạo hình Model:* Tư lệnh lực lượng phản ứng nhanh mặc giáp chiến thuật hải quân xanh lục bảo (`#00F5D4`), đeo bộ đàm liên lạc tốc độ cao.
   * *Mô tả:* Di dời 1 đơn vị chưa bị bắn trúng sang vị trí an toàn khác ngay trong trận.
4. **Lyra Chen — *"Mắt Thần Sonar"* (`SONAR` - Kỹ năng: Đạn Dò Tìm):**
   * *Loại kỹ năng:* Chiến đấu chủ động (Battle Active).
   * *Tạo hình Model:* Nữ sĩ quan trinh sát radar đeo kính Visor phát sáng sóng âm vàng kim (`#FFE66D`), vai gắn thiết bị thu phát tín hiệu sonar tầm xa.
   * *Mô tả:* Bắn đạn dò tìm phát hiện đơn vị địch trong vùng $3\times 3$ mà không tốn lượt bắn.
5. **Viktor Krane — *"Bóng Đêm Bắc Cực"* (`FOG` - Kỹ năng: Sương Mù):**
   * *Loại kỹ năng:* Chiến đấu chủ động (Battle Active).
   * *Tạo hình Model:* Lão đô đốc vùng biển băng có bộ râu bạc và vết sẹo trên mặt, khoác đại lễ phục xám khói (`#94A3B8`) tỏa làn sương mù chiến thuật dày đặc.
   * *Mô tả:* Phủ sương mù che kín bản đồ quan sát của đối phương trong 2 lượt.

### 4.2. Luồng Chuyển Tiếp Sang `DeployScene`
* **Chế độ PvE (Đấu với AI):** Người chơi bấm **XÁC NHẬN CHỈ HUY** $\rightarrow$ AI tự động chọn ngẫu nhiên 1 Chỉ huy $\rightarrow$ Chuyển ngay sang `DeployScene`.
* **Chế độ Local PvP (2 người trên 1 máy):**
  * Người chơi 1 chọn Chỉ huy & bấm Xác nhận $\rightarrow$ Màn hình chuyển sang lượt Người chơi 2 chọn Chỉ huy $\rightarrow$ Chuyển sang `DeployScene`.
* **Chế độ Online PvP:**
  * Người chơi chọn Chỉ huy & bấm Xác nhận $\rightarrow$ Gửi `SELECT_COMMANDER` lên Server và chuyển thẳng vào `DeployScene` để bắt đầu thiết kế đội hình.

---

## 5. Tiêu chí nghiệm thu (Definition of Done)
- [ ] Giao diện hiển thị rõ ràng 5 thẻ Chỉ huy kèm icon, tên kỹ năng và giai đoạn sử dụng.
- [ ] Chọn xong Chỉ huy chuyển mượt mà sang màn hình **Thiết Kế Đội Hình (`DeployScene`)** và truyền đúng dữ liệu Chỉ huy đã chọn.

