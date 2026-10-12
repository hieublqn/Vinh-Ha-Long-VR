# Vịnh Hạ Long VR – Du thuyền hoàng hôn

Trải nghiệm thực tế ảo chạy trên trình duyệt (WebXR), làm bằng **A-Frame 1.6.0** (dựa trên three.js).
Toàn bộ cảnh (trời, biển, đảo đá vôi...) được **sinh bằng code**: không dùng ảnh, mô hình 3D hay
âm thanh tải từ ngoài nên chạy offline được 100%.

> Đây là bản nháp README (Mốc 1). Mốc 6 sẽ viết đầy đủ phần kiến trúc và giải thích.

## Cách chạy

| Cách | Làm thế nào | Ghi chú |
|---|---|---|
| Nhấp đúp | Mở `index.html` bằng Chrome / Edge | Chạy qua `file://`, không cần cài gì |
| VS Code Live Server | Chuột phải `index.html` → *Open with Live Server* | Địa chỉ `http://127.0.0.1:5500` |
| Kính VR (Meta Quest) | Đưa thư mục lên GitHub Pages (https) rồi mở bằng trình duyệt của kính | WebXR chỉ chạy trên `https://` hoặc `localhost` |

Khi chạy qua `file://`, console của A-Frame có in một dòng chữ đỏ *"served via the file:// protocol"*.
Dòng đó chỉ cảnh báo chung về việc tải ảnh/mô hình. Dự án này không tải file nào nên **không ảnh hưởng**.

## Điều khiển (máy tính)

| Phím / chuột | Tác dụng |
|---|---|
| `W` `A` `S` `D` hoặc phím mũi tên | Đi tới / sang trái / lùi / sang phải theo hướng đang nhìn |
| Giữ chuột trái + kéo | Xoay góc nhìn |
| `Shift` | Đi nhanh |
| `Space` / `C` | Bay lên / hạ xuống |
| `H` | Ẩn / hiện bảng hướng dẫn |

Góc dưới bên trái là bảng **FPS · Draw call · Tam giác** để tự kiểm tra hiệu năng
(chữ chuyển đỏ khi FPS dưới 45).

## Cấu trúc thư mục

```
WebVR-HaLong/
├── index.html          khung cảnh chính, nạp các file js
├── lib/aframe.min.js   A-Frame 1.6.0 (bản local, thiếu thì tự tải từ CDN)
├── css/style.css       giao diện HUD
└── js/
    ├── tien-ich.js     random có seed, noise, texture canvas, GLSL dùng chung, sương mù theo hướng
    ├── bau-troi.js     bầu trời gradient, mặt trời, mây, ánh sáng, bảng màu
    ├── bien.js         mặt biển có sóng (shader), phản chiếu trời, vệt nắng
    ├── dao-da-voi.js   sinh đảo đá vôi bằng noise + InstancedMesh
    ├── dieu-khien.js   WASD, chuột, bay, va chạm với đảo, giới hạn vùng chơi
    └── giao-dien.js    HUD: bảng hướng dẫn, bảng FPS / draw call
```

## Tiến độ

- [x] **Mốc 1**: khung dự án, biển, bầu trời, vài đảo, điều khiển WASD/chuột
- [ ] Mốc 2: đảo đá vôi procedural đầy đủ, thuyền buồm, du thuyền tự động theo lộ trình
- [ ] Mốc 3: làng chài, hang động, sinh vật, chu kỳ ngày/đêm
- [ ] Mốc 4: hotspot thông tin, HUD, minimap, âm thanh, màn hình chờ, chụp ảnh
- [ ] Mốc 5: WebXR (tay cầm, teleport, snap turn), điện thoại, tối ưu, chế độ chất lượng
- [ ] Mốc 6: README đầy đủ + BAO_CAO.md
