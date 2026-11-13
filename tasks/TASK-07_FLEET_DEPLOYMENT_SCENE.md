# TASK-07: MÀN HÌNH THIẾT KẾ ĐỘI HÌNH 10X10 (CHỌN CHỈ HUY -> THIẾT KẾ ĐỘI HÌNH)
### Module: Fleet Deployment Scene (`DeployScene.js`)

---

## 1. Thông tin tổng quan
* **Mã task:** `TASK-07`
* **Độ ưu tiên:** P0 (Critical - Cốt lõi)
* **Điều kiện tiên quyết:** `TASK-02`, `TASK-04`, `TASK-06`

---

## 2. Mục tiêu
Xây dựng màn hình **Thiết Kế Đội Hình (`DeployScene`)** nơi người chơi sắp xếp toàn bộ đơn vị lên bản đồ $10 \times 10$ và sử dụng kỹ năng dàn trận (nếu chọn Chỉ huy *Phân Tách* hoặc *Thuyền Ma*):
* Hỗ trợ thao tác chọn đơn vị, rê chuột xem bóng đặt tàu (preview xanh/đỏ), click để đặt hoặc nhấc tàu lên đặt lại.
* Xoay hướng tàu bằng phím `R` hoặc nút **🔄 Xoay Tàu**.
* Hỗ trợ nút **🎲 Xếp Ngẫu Nhiên (Auto Deploy)** và **🗑️ Đặt Lại (Reset)**.
* Tích hợp trực tiếp nút kỹ năng của Chỉ huy **Phân Tách** và **Thuyền Ma** ngay trên bảng thiết kế.

---

## 3. Phạm vi tệp tin liên quan
* `src/scenes/DeployScene.js`
* `src/utils/RadarRenderer.js`
* `src/shared/BoardEngine.js`

---

## 4. Đặc tả kỹ thuật chi tiết

### 4.1. Bố cục Giao diện Thiết kế Đội hình
1. **Lưới Bản Đồ Chiến Thuật $10 \times 10$ (Trung tâm):**
   * Hiển thị tọa độ cột `A - J` và hàng `1 - 10`.
   * Khi rê chuột: Hiển thị hình bóng (Ghost Preview) của đơn vị đang chọn:
     * Màu **Xanh ngọc (`#00F5D4`)**: Vị trí hợp lệ.
     * Màu **Đỏ (`#FF2A54`)**: Vị trí bị tràn biên hoặc đè lên đơn vị khác.
2. **Danh sách Khay Đơn Vị (Bên trái):**
   * Liệt kê 6 đơn vị chuẩn (22 ô): Căn cứ chỉ huy (`+`, 5 ô), Tàu sân bay (5 ô), Thiết giáp hạm (4 ô), 2 Tàu tuần dương (3 ô), Tàu do thám (2 ô).
   * Cho phép click vào đơn vị đã đặt trên bàn để nhấc lên đổi vị trí.
3. **Bảng Điều Khiển & Kỹ Năng Chỉ Huy (Bên phải):**
   * Hiển thị thông tin Chỉ huy đã chọn ở bước trước.
   * **Nếu Chỉ huy là `SPLITTER` (Phân Tách):**
     * Hiển thị nút **✂️ KÍCH HOẠT PHÂN TÁCH**: Người chơi chọn 1 đơn vị bất kỳ ($>1$ ô) để tách làm 2 đơn vị nhỏ hơn ngay trong khay/bản đồ.
   * **Nếu Chỉ huy là `PHANTOM` (Thuyền Ma):**
     * Hiển thị nút **👻 TRIỆU HỒI THUYỀN MA (+3 Ô)**: Thêm ngay 1 đơn vị Thuyền ma dài 3 ô vào đội hình để đặt lên bản đồ.
   * Nút **⚔️ SẴN SÀNG CHIẾN ĐẤU**: Chỉ sáng lên khi toàn bộ đơn vị trong khay đã được đặt hết lên bản đồ $10 \times 10$.

### 4.2. Xử lý Đồng Bộ Khi Bấm "Sẵn Sàng Chiến Đấu"
* **PvE AI:** AI tự động thiết kế đội hình (và tự động dùng kỹ năng Phân tách / Thuyền ma nếu AI cầm Chỉ huy đó) $\rightarrow$ Vào `BattleScene`.
* **Local PvP:** Người chơi 1 xếp xong $\rightarrow$ Màn hình che bảo mật chuyển giao cho Người chơi 2 thiết kế đội hình $\rightarrow$ Cả 2 hoàn tất thì vào `BattleScene`.
* **Online PvP:** Gửi đội hình đã thiết kế (`SUBMIT_FLEET`) lên Server. Hiển thị trạng thái *"Đang chờ đối phương thiết kế đội hình..."* $\rightarrow$ Khi cả 2 bên đã sẵn sàng, Server phát lệnh bắt đầu trận đấu (`BATTLE_START`).

---

## 5. Tiêu chí nghiệm thu (Definition of Done)
- [ ] Đặt được đầy đủ 6 đơn vị (22 ô), bao gồm Căn cứ chỉ huy hình chữ thập `+`.
- [ ] Xoay tàu ngang/dọc mượt mà, không cho phép đặt tàu tràn biên hoặc chồng lên nhau.
- [ ] Kỹ năng *Phân tách* và *Thuyền ma* sử dụng trực quan ngay trong màn hình Thiết kế đội hình.
- [ ] Không cho phép bấm "Sẵn Sàng" nếu còn đơn vị chưa đặt lên bản đồ.

