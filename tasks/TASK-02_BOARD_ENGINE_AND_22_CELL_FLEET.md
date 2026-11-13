# TASK-02: HỆ THỐNG BẢN ĐỒ 10X10 & ĐỘI HÌNH 22 Ô ĐƠN VỊ
### Module: 10x10 Grid Engine & Multi-Shape Fleet Placement

---

## 1. Thông tin tổng quan
* **Mã task:** `TASK-02`
* **Độ ưu tiên:** P0 (Critical - Cốt lõi)
* **Điều kiện tiên quyết:** `TASK-01`

---

## 2. Mục tiêu
Xây dựng bộ máy quản lý lưới bản đồ $10 \times 10$ và hệ thống đơn vị chuẩn theo `context.md`:
* Mỗi bên sở hữu **6 đơn vị cơ bản** với tổng diện tích đúng **22 ô**.
* Hỗ trợ cả đơn vị hình chữ nhật thẳng ($1\times N$) và đơn vị hình đặc biệt (**Căn cứ chỉ huy hình dấu `+` 5 ô**).
* Xử lý xoay hướng đơn vị, kiểm tra biên bản đồ ($0..9$), kiểm tra chồng lấn và tự động xếp đội hình ngẫu nhiên hợp lệ.

---

## 3. Phạm vi tệp tin liên quan
* `src/shared/constants.js`
* `src/shared/BoardEngine.js`

---

## 4. Đặc tả kỹ thuật chi tiết

### 4.1. Danh sách Đơn vị Cơ bản (Tổng = 22 ô)
| Mã đơn vị | Tên hiển thị | Hình dáng gốc (Relative Offsets) | Số ô | Xoay được |
| :--- | :--- | :--- | :---: | :---: |
| `command_base` | **Căn Cứ Chỉ Huy** | Dấu `+`: `[0,0], [-1,0], [1,0], [0,-1], [0,1]` | **5 ô** | Không cần (Đối xứng) |
| `carrier` | **Tàu Sân Bay** | Thẳng $1\times 5$: `[0,0] .. [4,0]` | **5 ô** | Có (Ngang / Dọc) |
| `battleship` | **Thiết Giáp Hạm** | Thẳng $1\times 4$: `[0,0] .. [3,0]` | **4 ô** | Có (Ngang / Dọc) |
| `cruiser_1` | **Tàu Tuần Dương Alpha** | Thẳng $1\times 3$: `[0,0] .. [2,0]` | **3 ô** | Có (Ngang / Dọc) |
| `cruiser_2` | **Tàu Tuần Dương Bravo** | Thẳng $1\times 3$: `[0,0] .. [2,0]` | **3 ô** | Có (Ngang / Dọc) |
| `scout` | **Tàu Do Thám** | Thẳng $1\times 2$: `[0,0], [1,0]` | **2 ô** | Có (Ngang / Dọc) |

> **Tổng cộng:** $5 + 5 + 4 + 3 + 3 + 2 = 22\text{ ô}$.

### 4.2. Kiểm tra Hợp lệ & Đặt Đơn vị (`BoardEngine.js`)
* `getUnitCells(unit, anchorX, anchorY, orientation)`: Trả về mảng tọa độ tuyệt đối `[{x, y}, ...]` trên lưới $10 \times 10$.
* `canPlaceUnit(board, unit, anchorX, anchorY, orientation, ignoreUnitId)`:
  * Mọi ô $(x, y)$ phải thỏa mãn $0 \le x < 10$ và $0 \le y < 10$.
  * Không trùng với bất kỳ ô nào của đơn vị khác đã đặt trên bản đồ.
  * Nếu đặt lại trong giai đoạn Chiến đấu (kỹ năng *Di tản*), các ô đích không được nằm trên các ô đã từng bị đối phương bắn.
* `autoPlaceAllUnits(board, units)`: Thuật toán đặt ngẫu nhiên toàn bộ các đơn vị chưa đặt lên bản đồ $10 \times 10$ đảm bảo 100% thành công.

---

## 5. Tiêu chí nghiệm thu (Definition of Done)
- [ ] Tổng số ô của 6 đơn vị mặc định bằng đúng **22 ô**.
- [ ] Căn cứ chỉ huy hình dấu `+` không thể đặt tâm ở mép biên (`x=0`, `x=9`, `y=0`, `y=9`) vì cánh chữ thập sẽ tràn ra ngoài lưới.
- [ ] Xoay tàu ngang/dọc cập nhật đúng danh sách ô chiếm chỗ và kiểm tra va chạm chính xác.
- [ ] Hàm `autoPlaceAllUnits` xếp thành công toàn bộ đội hình (kể cả khi có thêm Thuyền ma hoặc sau khi Phân tách).

