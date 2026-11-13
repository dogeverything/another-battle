# TASK-04: HỆ THỐNG 5 CHỈ HUY & KỸ NĂNG ĐẶC BIỆT
### Module: Commander Roster & Active/Deployment Tactical Skills

---

## 1. Thông tin tổng quan
* **Mã task:** `TASK-04`
* **Độ ưu tiên:** P0 (Critical - Cốt lõi)
* **Điều kiện tiên quyết:** `TASK-02`, `TASK-03`

---

## 2. Mục tiêu
Triển khai đầy đủ 5 Chỉ huy với tên riêng, tạo hình model/portrait và 5 kỹ năng đặc trưng theo `context.md`:
1. **Kael Vance (`SPLITTER` - Phân tách):** Chia 1 đơn vị lớn ($>1$ ô) thành 2 đơn vị nhỏ hơn.
2. **Vespera Noctis (`PHANTOM` - Thuyền ma):** Thêm 1 thuyền 3 ô dài vào làm mồi nhử.
3. **Akira Sato (`EVACUATOR` - Di tản):** Di dời 1 đơn vị chưa bị bắn hoặc chìm sang vị trí khác.
4. **Lyra Chen (`SONAR` - Đạn dò tìm):** Bắn 1 phát đạn dò đơn vị địch trong bán kính $3\times 3$.
5. **Viktor Krane (`FOG` - Sương mù):** Tạo 1 làn khói che bản đồ đối phương quan sát trong 2 lượt.

---

## 3. Phạm vi tệp tin liên quan
* `src/shared/CommanderSkills.js`
* `src/shared/constants.js`
* `src/shared/BoardEngine.js`

---

## 4. Đặc tả kỹ thuật chi tiết

### 4.1. Nhóm Kỹ Năng Giai Đoạn Thiết Kế Đội Hình (Deployment Phase)
1. **Kỹ năng Phân Tách (`SPLITTER`):**
   * Điều kiện: Chọn 1 đơn vị của mình có `size > 1` (từ 2 ô trở lên) và kỹ năng chưa sử dụng.
   * Xử lý:
     * Tách đơn vị có độ dài $L$ thành 2 đơn vị độc lập có độ dài $L_1 = \lceil L / 2 \rceil$ và $L_2 = \lfloor L / 2 \rfloor$:
       * Đơn vị 5 ô (Tàu sân bay hoặc Căn cứ chỉ huy) $\rightarrow$ tách thành 1 tàu `3 ô` + 1 tàu `2 ô`.
       * Đơn vị 4 ô (Thiết giáp hạm) $\rightarrow$ tách thành 2 tàu `2 ô`.
       * Đơn vị 3 ô (Tàu tuần dương) $\rightarrow$ tách thành 1 tàu `2 ô` + 1 tàu `1 ô`.
       * Đơn vị 2 ô (Tàu do thám) $\rightarrow$ tách thành 2 tàu `1 ô`.
     * Tổng số ô máu của toàn đội hình vẫn bảo toàn là **22 ô**, nhưng đối phương sẽ khó săn trọn vẹn hơn.
2. **Kỹ năng Thuyền Ma (`PHANTOM`):**
   * Điều kiện: Kích hoạt trong giai đoạn Thiết kế đội hình (1 lần).
   * Xử lý:
     * Bổ sung đơn vị `phantom_ship` (dài 3 ô, `isDecoy: true`) vào danh sách đội hình để người chơi đặt lên bản đồ (tổng ô đặt trên bàn là $22 + 3 = 25$ ô).
     * **Cơ chế đánh lừa:** Khi đối phương bắn trúng ô thứ 1 hoặc thứ 2 của Thuyền ma, hệ thống vẫn báo **`HIT` (Trúng)** và cho đối phương bắn tiếp y hệt tàu thật. Chỉ khi đối phương bắn trúng đủ cả 3 ô của Thuyền ma, hệ thống mới thông báo *"PHÁT HIỆN THUYỀN MA MỒI NHỬ!"*. Các ô của Thuyền ma không tính vào 22 ô điều kiện thắng/thua.

### 4.2. Nhóm Kỹ Năng Chủ Động Trong Trận Đấu (Battle Phase - Hành động miễn phí trong lượt)
*Mỗi kỹ năng dùng 1 lần/trận và không làm mất lượt bắn chính thức của người chơi:*
3. **Kỹ năng Di Tản (`EVACUATOR`):**
   * Điều kiện: Chọn 1 đơn vị của phe mình **chưa bị bắn trúng bất kỳ ô nào** (`hits === 0`, `!isSunk`).
   * Xử lý: Cho phép nhấc đơn vị đó lên (có thể xoay hướng) và đặt sang vị trí mới trên bản đồ bản thân, miễn là các ô đích **chưa từng bị đối phương bắn vào** và không đè lên tàu khác.
4. **Kỹ năng Đạn Dò Tìm (`SONAR`):**
   * Điều kiện: Chọn tâm $(x, y)$ trên bản đồ đối phương.
   * Xử lý: Quét vùng $3\times 3$ quanh $(x, y)$. Các ô trong vùng này chưa bị bắn nếu có đơn vị địch sẽ được gắn cờ `sonarDetected = true` (hiển thị vòng phát sáng Sonar trên bản đồ tấn công), nếu trống sẽ đánh dấu `sonarClear = true`. Không gây sát thương nhưng giúp người chơi bắn bách phát bách trúng ngay trong lượt đó.
5. **Kỹ năng Sương Mù (`FOG`):**
   * Điều kiện: Kích hoạt trong lượt của mình.
   * Xử lý: Đặt hiệu ứng `fogTurnsRemaining = 2` lên đối phương. Trong **2 lượt kế tiếp của đối phương**, màn sương mù dày đặc sẽ che khuất toàn bộ dấu vết Trúng/Trượt cũ và trạng thái tàu trên bản đồ tấn công của đối phương, buộc đối phương phải bắn mù. Kết thúc mỗi lượt của đối phương, `fogTurnsRemaining` giảm đi 1.

---

## 5. Tiêu chí nghiệm thu (Definition of Done)
- [ ] Cả 5 kỹ năng hoạt động đúng mô tả trong `context.md`, mỗi kỹ năng chỉ dùng được 1 lần/trận.
- [ ] Kỹ năng Phân tách giữ nguyên tổng 22 ô máu; Kỹ năng Thuyền ma không làm sai lệch điều kiện thắng 22 ô thật.
- [ ] Kỹ năng Di tản, Đạn dò tìm, Sương mù dùng xong người chơi vẫn thực hiện được phát bắn của lượt đó.

