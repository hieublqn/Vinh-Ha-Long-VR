# Vịnh Hạ Long VR – Du thuyền hoàng hôn

Trải nghiệm thực tế ảo chạy trên trình duyệt (WebXR), làm bằng **A-Frame 1.6.0** (dựa trên three.js).
Toàn bộ cảnh (trời, biển, đảo đá vôi...) được **sinh bằng code**: không dùng ảnh, mô hình 3D hay
âm thanh tải từ ngoài nên chạy offline được 100%.

> Đây là bản nháp README (đang ở Mốc 3). Mốc 6 sẽ viết đầy đủ phần kiến trúc và giải thích.

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
- Bảng điểm dừng chỉ hiện ở chế độ Du thuyền; khi đeo kính, bảng HTML không hiển thị
  (Mốc 4 sẽ có bảng thuyết minh 3D trong không gian).

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
    ├── dieu-khien.js   2 chế độ: đứng trên boong / bay tự do (WASD, chuột, va chạm, bay vào hang)
    └── giao-dien.js    HUD: hướng dẫn, chip chế độ, bảng điểm dừng, nút Ngày/Hoàng hôn/Đêm, FPS / draw call
```

## Tiến độ

- [x] **Mốc 1**: khung dự án, biển, bầu trời, vài đảo, điều khiển WASD/chuột
- [x] **Mốc 2**: đảo đá vôi procedural đầy đủ, thuyền buồm, du thuyền tự động theo lộ trình
- [x] **Mốc 3**: làng chài, hang động, sinh vật, chu kỳ ngày/đêm
- [ ] Mốc 4: hotspot thông tin, HUD, minimap, âm thanh, màn hình chờ, chụp ảnh
- [ ] Mốc 5: WebXR (tay cầm, teleport, snap turn), điện thoại, tối ưu, chế độ chất lượng
- [ ] Mốc 6: README đầy đủ + BAO_CAO.md
