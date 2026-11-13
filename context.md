## Title: Another Battle

## Mô tả chung
 - gameplay giống game battleship
 - xếp tàu/thuyền hoặc các căn cứ vào bản đồ, sau đó bắn theo lượt, mục tiêu là hạ toàn bộ đơn vị của đối phương

## Cơ chế

### Cơ chế chung
 - bản đồ 10x10
 - mỗi bên tổng là 22 ô đơn vị
 - bắn theo lượt, bên nào bắn trúng được bắn tiếp
 - bên nào mất hết đơn vị trước thì thua
 - Đơn vị:
   - 1 căn cứ chỉ huy: dấu +, 5 ô
   - 1 tàu sân bay: 5 ô dài
   - 1 thiết giáp hạm: 4 ô dài
   - 2 tàu tuần dương: 3 ô dài
   - 1 tàu do thám: 2 ô dài 

### Đạn pháo
 - đạn thường 1x1
 - đạn chùm 3x3, dùng 1 lần
 - đạn nảy, nảy bật ngẫu nhiên thêm 2 ô chưa bắn, dùng 1 lần

### Chỉ huy
 - mỗi chỉ huy có tên riêng, ngoại hình (model/portrait) và 1 kỹ năng riêng hỗ trợ giúp phe mình sắp xếp đơn vị, tấn công hay phòng thủ
 - Danh sách 5 Chỉ huy & Kỹ năng:
    - Kael Vance (Kiến Trúc Sư Hạm Đội) - Phân tách: chia một đơn vị lớn thành 2 đơn vị nhỏ hơn (đơn vị phải > 1 ô)
    - Vespera Noctis (Bóng Ma Biển Sâu) - Thuyền ma: thêm 1 thuyền 3 ô dài vào làm mồi nhử
    - Akira Sato (Bậc Thầy Cơ Động) - Di tản: di dời đơn vị chưa bị bắn hoặc chìm ra chỗ khác
    - Lyra Chen (Mắt Thần Sonar) - Đạn dò tìm: bắn 1 phát đạn dò đơn vị địch bán kính 3x3
    - Viktor Krane (Bóng Đêm Bắc Cực) - Sương mù: tạo 1 làn khói che bản đồ đối phương quan sát trong 2 lượt
