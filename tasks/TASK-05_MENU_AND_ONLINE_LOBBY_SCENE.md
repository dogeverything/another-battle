# TASK-05: MÀN HÌNH MENU CHÍNH & PHÒNG CHỜ ONLINE PVP (TẠO PHÒNG -> VÀO GAME)
### Module: Main Menu & Online Room Lobby Scene

---

## 1. Thông tin tổng quan
* **Mã task:** `TASK-05`
* **Độ ưu tiên:** P1 (High)
* **Điều kiện tiên quyết:** `TASK-01`

---

## 2. Mục tiêu
Xây dựng 2 màn hình mở đầu trong luồng trải nghiệm:
1. **`MenuScene`:** Chọn chế độ chơi (Online PvP, Local PvP 2 người trên 1 máy, hoặc Đấu với AI).
2. **`LobbyScene`:** Quản lý quy trình **Tạo phòng / Vào phòng $\rightarrow$ Vào Game** trước khi bước vào màn hình Chọn Chỉ Huy.

---

## 3. Phạm vi tệp tin liên quan
* `src/scenes/MenuScene.js`
* `src/scenes/LobbyScene.js`
* `src/network/NetworkManager.js`

---

## 4. Đặc tả kỹ thuật chi tiết

### 4.1. Màn hình Menu Chính (`MenuScene.js`)
* Giao diện đài chỉ huy Radar với vòng quét xoay nền và tiêu đề **ANOTHER BATTLE**.
* 3 Nút chế độ chơi chính:
  1. **🌐 ĐẤU TRỰC TUYẾN (ONLINE PVP):** Chuyển sang `LobbyScene` (Tạo phòng / Nhập mã phòng).
  2. **⚔️ ĐẤU 2 NGƯỜI CÙNG MÁY (LOCAL PVP):** Chuyển sang `CommanderScene` (Chế độ `LOCAL_PVP`).
  3. **🤖 CHIẾN ĐẤU VỚI MÁY (PVE AI):** Chuyển sang `CommanderScene` (Chế độ `PVE_AI`).

### 4.2. Màn hình Phòng Chờ (`LobbyScene.js`) — Luồng `Tạo Phòng -> Vào Game`
1. **Khi chưa ở trong phòng:**
   * Nút **➕ TẠO PHÒNG MỚI**: Gửi sự kiện `CREATE_ROOM` lên WebSocket Server $\rightarrow$ Nhận mã phòng 4 ký tự (VD: `NV84`).
   * Khu vực **🔑 NHẬP MÃ PHÒNG**: Cho phép gõ bàn phím mã phòng 4 ký tự và bấm **VÀO PHÒNG** (`JOIN_ROOM`).
   * Nút **⚡ GHÉP NHANH (`QUICK_MATCH`)**: Tự động tìm phòng đang chờ hoặc tạo phòng mới.
2. **Khi đã ở trong Phòng chờ (Room Waiting View):**
   * Hiển thị **Mã Phòng** lớn ở trung tâm kèm nút **📋 Sao chép mã**.
   * Hiển thị 2 vị trí người chơi:
     * **Slot 1 (Chủ phòng - Host):** Đã kết nối.
     * **Slot 2 (Khách - Guest):** Đang chờ đối thủ... $\rightarrow$ Khi người thứ 2 vào phòng sẽ cập nhật trạng thái *"Đã kết nối"*.
   * Nút **🚀 VÀO GAME (START MATCH):**
     * Kích hoạt khi phòng đã đủ 2 người chơi.
     * Khi bấm **VÀO GAME**, Server phát sự kiện `MATCH_STARTED` đưa cả 2 người chơi chuyển sang màn hình **Chọn Chỉ Huy (`CommanderScene`)**.

---

## 5. Tiêu chí nghiệm thu (Definition of Done)
- [ ] Tạo phòng sinh mã 4 ký tự rõ ràng; người chơi thứ 2 nhập mã vào được ngay lập tức.
- [ ] Khi đủ 2 người trong phòng và bấm **VÀO GAME**, cả 2 trình duyệt đồng loạt chuyển sang màn hình **Chọn Chỉ Huy (`CommanderScene`)**.
- [ ] Hỗ trợ nút Quay lại Menu chính và xử lý thông báo nếu đối phương thoát phòng.

