# TASK-03: CƠ CHẾ BẮN THEO LƯỢT & KHO ĐẠN PHÁO CHIẾN THUẬT
### Module: Turn-Based Combat Rules & Ammo Arsenal (1x1, 3x3 Cluster, Ricochet)

---

## 1. Thông tin tổng quan
* **Mã task:** `TASK-03`
* **Độ ưu tiên:** P0 (Critical - Cốt lõi)
* **Điều kiện tiên quyết:** `TASK-02`

---

## 2. Mục tiêu
Cài đặt cơ chế chiến đấu theo lượt và hệ thống 3 loại đạn pháo theo `context.md`:
* **Luật bắn tiếp (Bonus Turn):** Bên nào bắn trúng ít nhất 1 ô đơn vị địch sẽ được bắn tiếp lượt sau.
* **3 loại đạn pháo:**
  1. **Đạn thường ($1\times 1$):** Không giới hạn số lần dùng.
  2. **Đạn chùm ($3\times 3$):** Bắn vùng 9 ô quanh tâm, dùng **1 lần duy nhất** mỗi trận.
  3. **Đạn nảy (Ricochet):** Bắn 1 ô mục tiêu + tự động nảy ngẫu nhiên sang thêm **2 ô chưa từng bị bắn** trên bản đồ, dùng **1 lần duy nhất** mỗi trận.

---

## 3. Phạm vi tệp tin liên quan
* `src/shared/AmmoSystem.js`
* `src/shared/BoardEngine.js`

---

## 4. Đặc tả kỹ thuật chi tiết

### 4.1. Chi tiết xử lý từng loại đạn (`resolveFireShot`)
1. **Đạn thường (`STANDARD` - $1\times 1$):**
   * Yêu cầu ô mục tiêu $(x, y)$ chưa từng bị bắn (`!cell.isShot`).
   * Tác động đúng 1 ô $(x, y)$.
2. **Đạn chùm (`CLUSTER` - $3\times 3$):**
   * Yêu cầu còn lượt dùng (`ammoInventory.CLUSTER > 0`).
   * Quét vùng $3\times 3$: $\Delta x \in [-1, 0, 1], \Delta y \in [-1, 0, 1]$ nằm trong biên $0..9$.
   * Lọc ra các ô trong vùng $3\times 3$ chưa từng bị bắn (phải có ít nhất 1 ô chưa bắn để tránh lãng phí đạn).
   * Áp dụng phát bắn lên tất cả các ô đó và giảm `ammoInventory.CLUSTER` về `0`.
3. **Đạn nảy (`RICOCHET` - $1 + 2$ ô ngẫu nhiên):**
   * Yêu cầu còn lượt dùng (`ammoInventory.RICOCHET > 0`) và ô mục tiêu đầu tiên $(x, y)$ chưa từng bị bắn.
   * Phát đầu tiên rơi trúng $(x, y)$.
   * Tìm toàn bộ các ô còn lại trên bản đồ $10\times 10$ chưa bị bắn (`unshotCells`), chọn ngẫu nhiên tối đa **2 ô** để đạn nảy tới: `bounce1`, `bounce2`.
   * Áp dụng sát thương lên cả 3 ô theo thứ tự `[primary, bounce1, bounce2]` và giảm `ammoInventory.RICOCHET` về `0`.

### 4.2. Luật Tính Trúng, Chìm Tàu & Điều Kiện Thắng
* Nếu trong các ô bị trúng đạn của phát bắn có **ít nhất 1 ô chứa đơn vị địch** (kể cả đơn vị thật hay Thuyền ma chưa lộ diện):
  * `anyHit = true` $\rightarrow$ Người bắn **giữ quyền bắn lượt tiếp theo** (`keepTurn = true`).
  * Ngược lại nếu toàn bộ các ô đều trượt (`MISS`) $\rightarrow$ Chuyển lượt sang đối phương (`keepTurn = false`).
* Khi toàn bộ các ô của một đơn vị thật bị bắn trúng $\rightarrow$ Đơn vị đó chuyển sang trạng thái **Chìm (`isSunk = true`)** và lộ diện hoàn toàn trên bản đồ đối phương.
* **Điều kiện kết thúc trận đấu:** Khi toàn bộ **22 ô đơn vị thật** (`!unit.isDecoy`) của một bên bị bắn hạ, bên kia giành chiến thắng ngay lập tức.

---

## 5. Tiêu chí nghiệm thu (Definition of Done)
- [ ] Đạn thường bắn trúng được bắn tiếp, bắn trượt đổi lượt.
- [ ] Đạn chùm $3\times 3$ tác động đúng tối đa 9 ô quanh tâm, trừ kho đạn về 0 sau 1 lần bắn.
- [ ] Đạn nảy bắn trúng ô chỉ định và nảy chính xác sang 2 ô chưa từng bị bắn khác trên bản đồ.
- [ ] Sau khi bắn Đạn chùm hoặc Đạn nảy, vũ khí mặc định tự động quay về Đạn thường $1\times 1$.

