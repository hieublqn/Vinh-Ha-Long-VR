# Vịnh Hạ Long VR – Du thuyền hoàng hôn

Trải nghiệm thực tế ảo chạy trên trình duyệt (WebXR), làm bằng **A-Frame 1.6.0** (dựa trên three.js).
Toàn bộ cảnh (trời, biển, đảo đá vôi...) được **sinh bằng code**: không dùng ảnh, mô hình 3D hay
âm thanh tải từ ngoài nên chạy offline được 100%.

> Đây là bản nháp README (đang ở Mốc 4). Mốc 6 sẽ viết đầy đủ phần kiến trúc và giải thích.

## Cách chạy

| Cách | Làm thế nào | Ghi chú |
|---|---|---|
| Nhấp đúp | Mở `index.html` bằng Chrome / Edge | Chạy qua `file://`, không cần cài gì |
| VS Code Live Server | Chuột phải `index.html` → *Open with Live Server* | Địa chỉ `http://127.0.0.1:5500` |
| Kính VR (Meta Quest) | Đưa thư mục lên GitHub Pages (https) rồi mở bằng trình duyệt của kính | WebXR chỉ chạy trên `https://` hoặc `localhost` |

Khi chạy qua `file://`, console của A-Frame có in một dòng chữ đỏ *"served via the file:// protocol"*.
Dòng đó chỉ cảnh báo chung về việc tải ảnh/mô hình. Dự án này không tải file nào nên **không ảnh hưởng**.

## Hai chế độ di chuyển

- **Du thuyền** (mặc định): bạn đứng trên boong thuyền buồm. Thuyền tự chạy theo lộ trình khép kín
  (khoảng 0,9 km), dừng ở 5 điểm: Vịnh Hạ Long → Đảo Ti Tốp → Hang Sửng Sốt → Làng chài Cửa Vạn →
  Hòn Gà Chọi. Mỗi điểm dừng hiện bảng giới thiệu ngắn.
- **Tự do**: rời thuyền, bay trên mặt nước để khám phá; không đi xuyên đảo.
  Riêng đảo Bồ Hòn có **cửa hang Sửng Sốt** quay về phía điểm dừng: bay về phía giữa cửa vòm
  (từ ngoài biển có một "phễu" rộng ~10 m dẫn vào, càng gần vách càng thu hẹp về lòng hầm) để đi qua
  đường hầm vào khoang hang có nhũ đá và đèn màu. Muốn ra thì bay ngược ra cửa.
  Nhanh hơn: bấm nút **Vào hang ▸** trên chip (khi neo ở điểm Hang Sửng Sốt hoặc bay gần cửa hang)
  để dịch chuyển thẳng vào trong; trong hang có nút **Ra khỏi hang ▸** đưa về lại boong thuyền.

## Bắt đầu, thuyết minh, âm thanh

- **Màn hình chờ**: hiện trong lúc dựng khung cảnh. Nút **Bắt đầu** sáng lên khi đã sẵn sàng; bấm nút thì
  thuyền mới rời bến và âm thanh mới bật (trình duyệt chỉ cho phát tiếng sau một cú bấm của người dùng).
- **Biểu tượng "i"** nổi gần các cảnh (9 điểm: toàn cảnh vịnh, đảo đá vôi, Ti Tốp, Hang Sửng Sốt,
  thạch nhũ trong hang, làng chài Cửa Vạn, nhà bè nuôi cá, Hòn Gà Chọi, thuyền buồm nâu). Bấm chuột
  (hoặc chạm) vào biểu tượng → hiện **bảng thuyết minh 3D** trước mặt; bấm vào bảng (hoặc `Esc`) để đóng.
  Khi đeo kính VR, tới điểm dừng là bảng thuyết minh 3D tự hiện.
- **Âm thanh tạo bằng code** (Web Audio, không có file âm thanh): sóng biển, nước vỗ mạn thuyền, gió,
  tiếng hải âu (ban ngày), dế kêu (ban đêm), giọt nước rơi vang trong hang. Âm thanh có hướng: quay đầu
  là nghe tiếng chim đổi bên. Nút loa 🔊 cạnh nút thời điểm hoặc phím `T` để tắt / bật.
- **Bản đồ nhỏ** góc phải: đảo, lộ trình, 5 điểm dừng, làng chài, cửa hang, vị trí thuyền (tam giác
  trắng) và người xem (chấm xanh + hướng nhìn). Phím `B` ẩn / hiện.
- **Chụp ảnh**: phím `P` lưu khung hình hiện tại thành file PNG (không dính các bảng HUD).

## Thời điểm trong ngày

Ba nút **Ngày / Hoàng hôn / Đêm** ở góc trên (hoặc phím `1` `2` `3`). Bầu trời, mặt trời / mặt trăng,
mây, màu nước, sương mù và ánh sáng đổi dần trong 4 giây. Ban đêm có sao, trăng, đèn lồng trên thuyền và
ở làng chài (phản chiếu thành vệt sáng trên mặt nước), cửa sổ sáng đèn, đom đóm quanh chân đảo;
hải âu chỉ bay ban ngày và lúc hoàng hôn.

Bản đồ trong mô hình là **minh họa**: vị trí các điểm không đúng tỉ lệ thật.

## Điều khiển (máy tính)

| Phím / chuột | Tác dụng |
|---|---|
| `W` `A` `S` `D` hoặc phím mũi tên | Đi theo hướng đang nhìn (chế độ Du thuyền: đi lại trên boong) |
| Giữ chuột trái + kéo | Xoay góc nhìn |
| `Shift` | Đi nhanh |
| `M` | Đổi chế độ Du thuyền / Tự do |
| `Space` / `C` | Bay lên / hạ xuống (chế độ Tự do) |
| `N` | Thuyền rời điểm dừng ngay, không chờ hết giờ |
| `1` `2` `3` | Ngày / Hoàng hôn / Đêm |
| Bấm chuột vào biểu tượng **i** | Mở bảng thuyết minh (bấm vào bảng / `Esc` để đóng) |
| `P` | Chụp ảnh, lưu file PNG |
| `T` | Tắt / bật âm thanh |
| `B` | Ẩn / hiện bản đồ nhỏ |
| `H` | Ẩn / hiện bảng hướng dẫn |

Góc dưới bên trái là bảng **FPS · Draw call · Tam giác** để tự kiểm tra hiệu năng
(chữ chuyển đỏ khi FPS dưới 45).

Ghi chú:
- **Tắt bộ gõ tiếng Việt** (Unikey / EVKey: bấm `Ctrl+Shift` hoặc chuyển sang chế độ E) khi điều khiển:
  ở kiểu gõ Telex, phím `W` bị bộ gõ biến thành chữ "ư" nên trình duyệt không nhận được phím đi tới
  (dùng phím mũi tên `↑` thay thế cũng được).
- Đang neo ở điểm dừng mà cảnh được giới thiệu nằm ngoài khung nhìn thì bảng điểm dừng hiện gợi ý
  "◀ Nhìn sang trái" / "Nhìn sang phải ▶" (hoặc "Ở phía sau, bên trái / phải").
- Phím `F` (mặc định của A-Frame để vào VR) đã được tắt: trên máy không có kính, nó chỉ làm
  khung 3D toàn màn hình và che mất các bảng thông tin.
- Nút kính VR ở góc phải chỉ hiện khi trình duyệt hỗ trợ WebXR "immersive-vr" (có kính VR).
- Bảng điểm dừng chỉ hiện ở chế độ Du thuyền; khi đeo kính, bảng HTML không hiển thị nên
  dùng bảng thuyết minh 3D trong không gian thay thế.

## Cấu trúc thư mục

```
WebVR-HaLong/
├── index.html          khung cảnh chính, nạp các file js
├── lib/aframe.min.js   A-Frame 1.6.0 (bản local, thiếu thì tự tải từ CDN)
├── css/style.css       giao diện HUD
└── js/
    ├── tien-ich.js     random có seed, noise, texture canvas, GLSL dùng chung, sương mù theo hướng
    ├── bau-troi.js     bầu trời gradient, mặt trời, mây, ánh sáng, bảng màu
    ├── bien.js         mặt biển có sóng (shader), phản chiếu trời + bóng đảo, vệt sóng sau thuyền
    ├── thuyen.js       lộ trình CatmullRom + 5 điểm dừng, mô hình thuyền buồm, du thuyền tự động
    ├── dao-da-voi.js   60 đảo procedural (InstancedMesh + 2 mức chi tiết) + đảo nổi bật
    ├── lang-chai.js    làng chài nổi: nhà bè, lối đi, lồng bè, lưới, thuyền nhỏ, đèn lồng (1 texture atlas)
    ├── hang-dong.js    hang Sửng Sốt: khoét cửa vòm vào đảo Bồ Hòn, đường hầm + khoang, nhũ đá, đèn màu
    ├── sinh-vat.js     đàn hải âu (boids, vỗ cánh trong shader) + đom đóm ban đêm
    ├── diem-thong-tin.js biểu tượng "i" bấm được + bảng thuyết minh 3D chữ vẽ bằng canvas
    ├── am-thanh.js     âm thanh procedural (Web Audio): sóng, gió, hải âu, dế, giọt nước + vang hang
    ├── dieu-khien.js   2 chế độ: đứng trên boong / bay tự do (WASD, chuột, va chạm, bay vào hang)
    └── giao-dien.js    HUD: màn hình chờ, hướng dẫn, chip + nút Vào hang, bảng điểm dừng,
                        nút thời điểm + loa, bản đồ nhỏ, chụp ảnh, FPS / draw call
```

## Tiến độ

- [x] **Mốc 1**: khung dự án, biển, bầu trời, vài đảo, điều khiển WASD/chuột
- [x] **Mốc 2**: đảo đá vôi procedural đầy đủ, thuyền buồm, du thuyền tự động theo lộ trình
- [x] **Mốc 3**: làng chài, hang động, sinh vật, chu kỳ ngày/đêm
- [x] **Mốc 4**: hotspot thông tin, HUD, minimap, âm thanh, màn hình chờ, chụp ảnh
- [ ] Mốc 5: WebXR (tay cầm, teleport, snap turn), điện thoại, tối ưu, chế độ chất lượng
- [ ] Mốc 6: README đầy đủ + BAO_CAO.md
