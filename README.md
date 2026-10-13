# Vịnh Hạ Long VR – Du thuyền hoàng hôn

Trải nghiệm thực tế ảo chạy trên trình duyệt (WebXR), làm bằng **A-Frame 1.6.0** (dựa trên three.js).
Toàn bộ cảnh (trời, biển, đảo đá vôi...) được **sinh bằng code**: không dùng ảnh, mô hình 3D hay
âm thanh tải từ ngoài nên chạy offline được 100%.

## Cách chạy

| Cách | Làm thế nào | Ghi chú |
|---|---|---|
| Nhấp đúp | Mở `index.html` bằng Chrome / Edge | Chạy qua `file://`, không cần cài gì |
| VS Code Live Server | Chuột phải `index.html` → *Open with Live Server* | Địa chỉ `http://127.0.0.1:5500` |
| Kính VR (Meta Quest) | Bật GitHub Pages cho repo (Settings → Pages → nhánh `main`, thư mục `/ (root)`) rồi mở `https://hieublqn.github.io/Vinh-Ha-Long-VR/` bằng trình duyệt của kính | WebXR chỉ chạy trên `https://` hoặc `localhost` |

Cần trình duyệt có **WebGL2** (Chrome, Edge, Firefox bản mới). Máy không hỗ trợ (card đồ hoạ quá cũ,
driver lỗi, bị chặn) thì màn hình chờ sẽ báo lỗi rõ ràng thay vì đứng ở "Đang dựng…".

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
  Kéo chuột để nhìn quanh không làm đóng bảng. Bảng mở lúc đứng trên thuyền sẽ đi theo thuyền (đọc được
  cả khi thuyền đang chạy). Khi đeo kính VR, tới điểm dừng (hoặc vào kính lúc thuyền đang neo) là bảng
  thuyết minh 3D tự hiện.
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

| `Q` hoặc nút **⚙** | Đổi chất lượng đồ hoạ Cao / Thấp |

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

## Điều khiển trên kính VR (tay cầm Meta Quest)

Bấm nút kính VR ở góc phải dưới để vào chế độ VR. Mỗi tay cầm có một tia laser: chĩa vào biểu tượng
**i** rồi bóp cò để mở bảng thuyết minh (bóp cò vào bảng để đóng).

| Tay cầm | Tác dụng |
|---|---|
| Cần gạt **trái** | Đi tới / lùi / sang ngang theo hướng nhìn (trên boong: đi lại trên boong) |
| Cần gạt **phải** sang trái / phải | Xoay nhanh 30° mỗi lần gạt (snap turn, đỡ chóng mặt hơn xoay mượt) |
| Cần gạt **phải** đẩy lên → ngắm → thả | Dịch chuyển tức thời (teleport) tới chỗ vòng cung chạm. Cung **xanh** = tới được, **đỏ** = không (rơi vào đảo, nhà bè, ra khỏi boong, ra ngoài vùng chơi) |
| Nút **grip** trái / phải | Hạ xuống / bay lên (chế độ Tự do) |
| Nút **X** | Đổi chế độ Du thuyền / Tự do |
| Nút **Y** | Đổi thời điểm: Ngày → Hoàng hôn → Đêm |
| Nút **A** | Đóng bảng thuyết minh đang mở; nếu không có bảng: **Vào hang** (khi thuyền neo ở Hang Sửng Sốt hoặc bay gần cửa hang) / **Ra khỏi hang** |
| Nút **B** | Tắt / bật âm thanh |

Mỗi lần bấm nút có một dòng thông báo nhỏ hiện trước mắt khoảng 2 giây (vì bảng HTML không hiển thị
trong kính); khi nút A có việc để làm (Vào hang / Ra khỏi hang) cũng có thông báo nhắc. Mô hình tay cầm cũng được vẽ bằng code (thân trụ + vòng cam) nên không cần tải file.

## Điều khiển trên điện thoại / máy tính bảng

Màn hình cảm ứng được nhận ra tự động:
- **Vuốt** trên màn hình để xoay góc nhìn (ngang và lên / xuống; vừa giữ cần ảo vừa vuốt bằng ngón
  kia được); **nghiêng máy** để nhìn quanh (con quay hồi chuyển — trên iPhone
  trình duyệt sẽ hỏi quyền khi bấm *Bắt đầu*, chọn *Cho phép*).
- **Cần ảo** góc dưới trái: kéo núm để đi lại.
- Cột nút góc dưới phải: **🕊 Bay tự do / ⛵ Lên thuyền** đổi chế độ; ở chế độ Tự do có thêm **▲ / ▼**
  để bay lên / hạ xuống.
- Chạm vào biểu tượng **i** để mở bảng thuyết minh. Bảng hướng dẫn phím và bảng FPS được ẩn bớt cho
  đỡ chật màn hình.

## Chất lượng đồ hoạ Cao / Thấp

Nút **⚙ Cao / ⚙ Thấp** ở cụm nút thời điểm (hoặc phím `Q`):

| | Cao | Thấp |
|---|---|---|
| Độ phân giải vẽ | 100 % (tối đa 1,5× trên màn hình mật độ điểm ảnh cao) | 75 % |
| Bóng đảo phản chiếu trên nước | 12 đảo gần nhất | 4 đảo |
| Vệt đèn lồng phản chiếu (ban đêm) | 8 đèn | 4 đèn |
| Khoảng cách đảo dùng mô hình chi tiết | 150 m | 80 m |
| Độ phân giải trong kính VR | 100 % | 80 % |

- Lần đầu chạy: máy tính mặc định **Cao**, điện thoại / kính VR mặc định **Thấp**.
- Nếu 8 giây đầu sau khi bấm *Bắt đầu* đo được trung bình dưới 38 FPS, chương trình **tự chuyển sang
  Thấp** và báo một dòng. Lựa chọn bằng tay được ghi nhớ (localStorage) và không bị tự đổi nữa.
- Độ phân giải trong kính chỉ đổi được trước khi vào VR (giới hạn của WebXR); đổi khi đang ở trong kính
  sẽ có tác dụng ở lần vào VR sau.

## Cấu trúc thư mục

```
Vinh-Ha-Long-VR/
├── index.html          khung cảnh chính, nạp các file js
├── lib/aframe.min.js   A-Frame 1.6.0 (bản local, thiếu thì tự tải từ CDN)
├── css/style.css       giao diện HUD
└── js/
    ├── tien-ich.js     random có seed, noise, texture canvas, GLSL dùng chung, sương mù theo hướng,
    │                   cấu hình chất lượng Cao / Thấp
    ├── bau-troi.js     bầu trời gradient, mặt trời, mây, ánh sáng, bảng màu
    ├── bien.js         mặt biển có sóng (shader), phản chiếu trời + bóng đảo, vệt sóng sau thuyền
    ├── thuyen.js       lộ trình CatmullRom + 5 điểm dừng, mô hình thuyền buồm, du thuyền tự động
    ├── dao-da-voi.js   60 đảo procedural (InstancedMesh + 2 mức chi tiết) + đảo nổi bật
    ├── lang-chai.js    làng chài nổi: nhà bè, lối đi, lồng bè, lưới, thuyền nhỏ, đèn lồng (1 texture atlas)
    ├── hang-dong.js    hang Sửng Sốt: khoét cửa vòm vào đảo Bồ Hòn, đường hầm + khoang, nhũ đá, đèn màu
    ├── sinh-vat.js     đàn hải âu (boids, vỗ cánh trong shader) + đom đóm ban đêm
    ├── diem-thong-tin.js biểu tượng "i" bấm được + bảng thuyết minh 3D chữ vẽ bằng canvas
    ├── am-thanh.js     âm thanh procedural (Web Audio): sóng, gió, hải âu, dế, giọt nước + vang hang
    ├── dieu-khien.js   2 chế độ: đứng trên boong / bay tự do (WASD, chuột, va chạm, bay vào hang);
    │                   tay cầm VR: cần gạt, snap turn, teleport theo vòng cung, các nút
    └── giao-dien.js    HUD: màn hình chờ, hướng dẫn, chip + nút Vào hang, bảng điểm dừng,
                        nút thời điểm + loa + chất lượng, bản đồ nhỏ, chụp ảnh, FPS / draw call,
                        cần ảo + nút cảm ứng cho điện thoại, thông báo 3D trong kính
```

## Tiến độ

- [x] **Mốc 1**: khung dự án, biển, bầu trời, vài đảo, điều khiển WASD/chuột
- [x] **Mốc 2**: đảo đá vôi procedural đầy đủ, thuyền buồm, du thuyền tự động theo lộ trình
- [x] **Mốc 3**: làng chài, hang động, sinh vật, chu kỳ ngày/đêm
- [x] **Mốc 4**: hotspot thông tin, HUD, minimap, âm thanh, màn hình chờ, chụp ảnh
- [x] **Mốc 5**: WebXR (tay cầm, teleport, snap turn), điện thoại, tối ưu, chế độ chất lượng
