# TASK-09: MÁY CHỦ WEBSOCKET ONLINE PVP & ĐỒNG BỘ FOG-OF-WAR
### Module: WebSocket Room Server & Network Synchronization

---

## 1. Thông tin tổng quan
* **Mã task:** `TASK-09`
* **Độ ưu tiên:** P1 (High)
* **Điều kiện tiên quyết:** `TASK-05`, `TASK-08`

---

## 2. Mục tiêu
Xây dựng máy chủ WebSocket (`server/index.js`) và bộ quản lý kết nối (`src/network/NetworkManager.js`) phục vụ chế độ **Online PvP**:
* Quản lý vòng đời phòng chơi theo đúng luồng: `Tạo phòng / Vào phòng -> Vào Game -> Chọn Chỉ Huy -> Thiết kế đội hình -> Chiến đấu -> Kết thúc / Đấu lại`.
* Xác thực nước đi trên Server và che giấu thông tin tàu chưa chìm (Server-Authoritative Fog of War).

---

## 3. Phạm vi tệp tin liên quan
* `server/index.js`
* `src/network/NetworkManager.js`

---

## 4. Đặc tả kỹ thuật chi tiết

### 4.1. Giao thức Bản tin WebSocket (JSON Messages)
| Chiều gửi | Tên sự kiện (`type`) | Dữ liệu (`payload`) | Mô tả |
| :--- | :--- | :--- | :--- |
| Client $\rightarrow$ Server | `CREATE_ROOM` | `{ playerName }` | Tạo phòng mới, nhận về `roomCode` 4 ký tự |
| Client $\rightarrow$ Server | `JOIN_ROOM` | `{ roomCode, playerName }` | Tham gia phòng theo mã |
| Client $\rightarrow$ Server | `QUICK_MATCH` | `{ playerName }` | Tự động tìm phòng trống hoặc tạo mới |
| Client $\rightarrow$ Server | `START_MATCH` | `{ roomCode }` | Chủ phòng bấm **Vào Game** khi đủ 2 người |
| Server $\rightarrow$ Client | `MATCH_STARTED` | `{ roomCode, playerIndex }` | Chuyển cả 2 người chơi sang `CommanderScene` |
| Client $\rightarrow$ Server | `SELECT_COMMANDER` | `{ commanderId }` | Lưu Chỉ huy đã chọn |
| Client $\rightarrow$ Server | `SUBMIT_FLEET` | `{ units, commanderId }` | Gửi đội hình đã thiết kế lên Server |
| Server $\rightarrow$ Client | `BATTLE_START` | `{ firstTurnIndex, sanitizedState }` | Cả 2 đã xếp xong $\rightarrow$ Vào `BattleScene` |
| Client $\rightarrow$ Server | `USE_SKILL` | `{ skillType, params }` | Kích hoạt Di tản / Đạn dò tìm / Sương mù |
| Client $\rightarrow$ Server | `FIRE_SHOT` | `{ ammoType, x, y }` | Bắn đạn vào tọa độ $(x, y)$ |
| Server $\rightarrow$ Client | `TURN_UPDATE` | `{ actionResult, sanitizedState }` | Cập nhật kết quả phát bắn/kỹ năng & lượt tiếp theo |

### 4.2. Cơ chế Bảo mật Fog-of-War trên Server
* Server chỉ gửi danh sách tọa độ của một đơn vị đối phương cho Client khi đơn vị đó đã bị bắn chìm (`isSunk === true`).
* Khi Thuyền ma của đối phương mới bị bắn trúng 1 hoặc 2 ô, Server trả về kết quả `HIT` giống hệt tàu thật để Client không thể biết đó là mồi nhử cho đến khi ô thứ 3 của Thuyền ma bị bắn trúng (`DECOY_REVEALED`).

---

## 5. Tiêu chí nghiệm thu (Definition of Done)
- [ ] Mở 2 tab trình duyệt kết nối qua `LobbyScene`, bấm **Vào Game**, chọn Chỉ huy, xếp đội hình và bắn nhau thời gian thực không lỗi.
- [ ] Xử lý an toàn trường hợp 1 người chơi mất kết nối hoặc thoát giữa trận (thông báo thắng cuộc/quay về sảnh).
- [ ] Hỗ trợ nút **Tái Đấu (Rematch)** sau khi trận đấu kết thúc.

