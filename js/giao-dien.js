/* =========================================================================
 * giao-dien.js – GIAO DIỆN TRÊN MÀN HÌNH (HUD) (component "giao-dien")
 * -------------------------------------------------------------------------
 * HUD = các khung HTML nằm đè lên khung cảnh 3D (không nằm trong thế giới 3D).
 * Hiện có:
 *   - Bảng hướng dẫn phím (phím H để ẩn/hiện).
 *   - Chip chế độ (Du thuyền / Tự do) + điểm dừng kế tiếp và khoảng cách.
 *   - Bảng điểm dừng: hiện khi thuyền neo ở điểm tham quan.
 *   - 3 nút Ngày / Hoàng hôn / Đêm (phím 1 2 3): chuyển màu trời mượt.
 *   - Bảng thông số hiệu năng: FPS, số draw call, số tam giác
 *     → để tự đo xem máy có chạy mượt không.
 * Mốc 4–5 sẽ thêm: minimap, menu, chọn chất lượng,
 * bảng thuyết minh 3D trong không gian.
 * ========================================================================= */
(function () {
  'use strict';

  var HALONG = window.HALONG;

  AFRAME.registerComponent('giao-dien', {
    init: function () {
      // --- Bảng hướng dẫn ---
      this.bangHuongDan = document.createElement('div');
      this.bangHuongDan.id = 'bang-huong-dan';
      this.bangHuongDan.className = 'hud-khung';
      this.bangHuongDan.innerHTML = [
        '<h1>Vịnh Hạ Long VR</h1>',
        '<p class="phu-de">Du thuyền hoàng hôn</p>',
        '<ul>',
        '<li><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / mũi tên: đi lại</li>',
        '<li class="ghi-chu">W không chạy? Tắt bộ gõ tiếng Việt (Unikey)</li>',
        '<li><b>Giữ chuột + kéo</b> để xoay</li>',
        '<li><kbd>Shift</kbd> đi nhanh</li>',
        '<li><kbd>M</kbd> đổi chế độ Du thuyền / Tự do</li>',
        '<li><kbd>Space</kbd> / <kbd>C</kbd> bay lên / xuống (Tự do)</li>',
        '<li><kbd>N</kbd> rời điểm dừng ngay</li>',
        '<li><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> Ngày / Hoàng hôn / Đêm</li>',
        '<li><kbd>H</kbd> ẩn / hiện bảng này</li>',
        '</ul>'
      ].join('');
      document.body.appendChild(this.bangHuongDan);

      // --- Chip chế độ + điểm kế tiếp (giữa, phía trên) ---
      this.chipCheDo = document.createElement('div');
      this.chipCheDo.id = 'chip-che-do';
      this.chipCheDo.className = 'hud-khung';
      document.body.appendChild(this.chipCheDo);

      // --- Bảng điểm dừng (giữa, phía dưới chip) ---
      this.bangDiemDung = document.createElement('div');
      this.bangDiemDung.id = 'bang-diem-dung';
      this.bangDiemDung.className = 'hud-khung an';
      document.body.appendChild(this.bangDiemDung);

      var sceneEl = this.el;
      this.diemDungCuoi = null;   // điểm dừng đang neo (để hiện lại khi lên thuyền)
      this.khiDenDiemDung = this.hienDiemDung.bind(this);
      this.khiRoiDiemDung = function () {
        this.diemDungCuoi = null;
        this.bangDiemDung.classList.add('an');
      }.bind(this);
      this.khiDoiCheDo = this.khiDoiCheDoFn.bind(this);
      sceneEl.addEventListener('den-diem-dung', this.khiDenDiemDung);
      sceneEl.addEventListener('roi-diem-dung', this.khiRoiDiemDung);
      sceneEl.addEventListener('doi-che-do', this.khiDoiCheDo);

      // --- 3 nút chọn thời điểm (góc phải trên) – bấm được nên bật pointer-events ---
      this.nutThoiDiem = document.createElement('div');
      this.nutThoiDiem.id = 'nut-thoi-diem';
      this.nutThoiDiem.className = 'hud-khung';
      [['ngay', 'Ngày'], ['hoangHon', 'Hoàng hôn'], ['dem', 'Đêm']].forEach(function (td) {
        var nut = document.createElement('button');
        nut.type = 'button';
        nut.textContent = td[1];
        nut.dataset.ten = td[0];
        nut.addEventListener('click', function () {
          if (HALONG.datThoiDiem) HALONG.datThoiDiem(td[0]);
          nut.blur();          // bỏ focus để phím Space không "bấm" lại nút này
        });
        this.nutThoiDiem.appendChild(nut);
      }, this);
      document.body.appendChild(this.nutThoiDiem);
      this.khiDoiThoiDiem = this.danhDauThoiDiem.bind(this);
      sceneEl.addEventListener('doi-thoi-diem', this.khiDoiThoiDiem);
      this.danhDauThoiDiem({ detail: { ten: HALONG.thoiDiem || 'hoangHon' } });

      // --- Bảng thông số hiệu năng ---
      this.bangThongSo = document.createElement('div');
      this.bangThongSo.id = 'bang-thong-so';
      this.bangThongSo.className = 'hud-khung';
      document.body.appendChild(this.bangThongSo);

      this.soKhung = 0;      // số khung hình đã vẽ trong lượt đếm
      this.thoiGianDem = 0;  // ms đã trôi qua trong lượt đếm
      HALONG.thongKe = { fps: 0, drawCall: 0, tamGiac: 0 };

      this.khiNhanPhim = function (e) {
        if (HALONG.boQuaPhimTat(e)) return;
        // !e.repeat: giữ phím lâu thì trình duyệt tự lặp keydown → bảng sẽ nhấp nháy
        if (e.code === 'KeyH' && !e.repeat) this.bangHuongDan.classList.toggle('an');
        // Phím 1 2 3: Ngày / Hoàng hôn / Đêm
        var phimSo = { Digit1: 'ngay', Digit2: 'hoangHon', Digit3: 'dem' }[e.code];
        if (phimSo && !e.repeat && HALONG.datThoiDiem) HALONG.datThoiDiem(phimSo);
      }.bind(this);
      window.addEventListener('keydown', this.khiNhanPhim);

      // Điện thoại không có bàn phím: bảng phím chỉ che màn hình → ẩn sẵn
      // (Mốc 5 sẽ thêm nút ảo + hướng dẫn cảm ứng). Màn thấp (điện thoại / cửa sổ xoay ngang)
      // cũng ẩn sẵn: bảng cao ~300 px sẽ đè lên chip và bảng điểm dừng ở dưới. Phím H vẫn mở lại.
      if (AFRAME.utils.device.isMobile() || window.innerHeight < 520) this.bangHuongDan.classList.add('an');

      // Nút kính VR: máy không hỗ trợ WebXR "immersive-vr" (laptop không cắm kính) thì
      // bấm nút chỉ làm khung 3D toàn màn hình và che HUD → ẩn nút đi.
      function anNutVR() { sceneEl.setAttribute('xr-mode-ui', 'enabled', false); }
      if (!navigator.xr || !navigator.xr.isSessionSupported) anNutVR();
      else navigator.xr.isSessionSupported('immersive-vr').then(function (co) { if (!co) anNutVR(); }, anNutVR);

      // Biên dịch SẴN mọi shader ngay khi bắt đầu vẽ. Nếu không, vật nào lúc đầu nằm
      // sau lưng (cabin, buồm...) chỉ được biên dịch khi người dùng quay lại nhìn
      // → khựng hình một nhịp giữa chừng.
      this.khiBatDauVe = function () {
        if (sceneEl.renderer.compile && sceneEl.camera) sceneEl.renderer.compile(sceneEl.object3D, sceneEl.camera);
      };
      sceneEl.addEventListener('renderstart', this.khiBatDauVe);
    },

    remove: function () {
      window.removeEventListener('keydown', this.khiNhanPhim);
      this.el.removeEventListener('den-diem-dung', this.khiDenDiemDung);
      this.el.removeEventListener('roi-diem-dung', this.khiRoiDiemDung);
      this.el.removeEventListener('doi-che-do', this.khiDoiCheDo);
      this.el.removeEventListener('renderstart', this.khiBatDauVe);
      this.el.removeEventListener('doi-thoi-diem', this.khiDoiThoiDiem);
      [this.bangHuongDan, this.bangThongSo, this.chipCheDo, this.bangDiemDung, this.nutThoiDiem].forEach(function (el) { el.remove(); });
    },

    // Tô sáng nút của thời điểm đang chọn
    danhDauThoiDiem: function (e) {
      Array.prototype.forEach.call(this.nutThoiDiem.children, function (nut) {
        nut.classList.toggle('dang-chon', nut.dataset.ten === e.detail.ten);
      });
    },

    dangTrenThuyen: function () {
      var dk = document.querySelector('[dieu-khien]');
      return !!dk && dk.getAttribute('dieu-khien').cheDo === 'du-thuyen';
    },

    // Đổi chế độ: rời thuyền thì ẩn bảng điểm dừng; lên lại thuyền đúng lúc đang neo thì hiện lại
    khiDoiCheDoFn: function (e) {
      if (e.detail.cheDo === 'tu-do') this.bangDiemDung.classList.add('an');
      else if (this.diemDungCuoi) this.hienDiemDung({ detail: this.diemDungCuoi });
      this.capNhatChip();
    },

    // Bảng tên + mô tả ngắn của điểm dừng (Mốc 4 sẽ thay bằng bảng 3D đầy đủ)
    hienDiemDung: function (e) {
      this.diemDungCuoi = e.detail;
      if (!this.dangTrenThuyen()) return;           // đang bay tự do: không thuyết minh
      var dd = e.detail.diem, tong = HALONG.LO_TRINH.diemDung.length;
      this.bangDiemDung.innerHTML = '';
      var nhan = document.createElement('div');
      nhan.className = 'nhan';
      nhan.textContent = 'Điểm dừng ' + (e.detail.chiSo + 1) + '/' + tong;
      var ten = document.createElement('h2');
      ten.textContent = dd.ten;
      var moTa = document.createElement('p');
      moTa.textContent = dd.moTa;
      // Gợi ý quay đầu: thuyền neo theo hướng lộ trình nên cảnh được giới thiệu có thể nằm
      // ngoài khung nhìn (bên hông, sau lưng) → chỉ hướng cho người xem
      this.huongNhin = document.createElement('div');
      this.huongNhin.className = 'huong-nhin';
      this.huongNhin.hidden = true;
      this.chuHuongNhin = '';
      this.vatTheDiem = dd.vatThe || null;
      this.bangDiemDung.append(nhan, ten, moTa, this.huongNhin);
      this.bangDiemDung.classList.remove('an');
    },

    // Cảnh đang giới thiệu nằm bên trái / phải / sau lưng hướng nhìn? (chạy mỗi khung, rất nhẹ)
    capNhatHuongNhin: function () {
      if (!this.vatTheDiem || !this.huongNhin || this.bangDiemDung.classList.contains('an')) return;
      var cam = this.el.camera;
      if (!cam) return;
      var f = this.huongCam || (this.huongCam = new THREE.Vector3());
      var p = this.viTriCam || (this.viTriCam = new THREE.Vector3());
      cam.getWorldDirection(f);
      cam.getWorldPosition(p);
      var tx = this.vatTheDiem.x - p.x, tz = this.vatTheDiem.z - p.z;
      // góc có dấu từ hướng nhìn tới cảnh (nhìn từ trên xuống): > 0 bên trái, < 0 bên phải
      var goc = Math.atan2(f.z * tx - f.x * tz, f.x * tx + f.z * tz) * 180 / Math.PI;
      // nửa góc nhìn NGANG thật của màn hình (rộng ~56° trên laptop, ~22° trên điện thoại dọc):
      // ma trận chiếu [0] = 1 / tan(nửa góc ngang). Cảnh còn trong khung (chừa 8° mép) thì không nhắc.
      var nuaNgang = Math.atan(1 / cam.projectionMatrix.elements[0]) * 180 / Math.PI;
      var lech = Math.abs(goc), trai = goc > 0;
      var chu = lech < nuaNgang - 8 ? ''
        : lech > 100 ? (trai ? '◀ Ở phía sau, bên trái' : 'Ở phía sau, bên phải ▶')
        : (trai ? '◀ Nhìn sang trái' : 'Nhìn sang phải ▶');
      if (chu === this.chuHuongNhin) return;          // chỉ đụng DOM khi nội dung đổi
      this.chuHuongNhin = chu;
      this.huongNhin.textContent = chu;
      this.huongNhin.hidden = !chu;
    },

    // Nội dung chip: chế độ hiện tại + điểm kế tiếp / thời gian còn neo
    capNhatChip: function () {
      var tt = HALONG.thuyen, chu;
      if (this.dangTrenThuyen() && tt) {
        var tiep = HALONG.LO_TRINH.diemDung[tt.diemTiep];
        chu = tt.trangThai === 'dung'
          ? 'Đang neo · rời bến sau ' + Math.ceil(tt.cho) + ' giây'
          : 'Tiếp theo: ' + tiep.ten + ' · ' + Math.round(tt.conLai) + ' m';
        this.chipCheDo.innerHTML = '<b>Du thuyền</b> · ' + chu + ' <span class="goi-y">M: tự do</span>';
      } else {
        this.chipCheDo.innerHTML = '<b>Tự do</b> · bay khám phá vịnh <span class="goi-y">M: lên thuyền</span>';
      }
    },

    tick: function (t, dt) {
      if (!dt) return;
      this.capNhatHuongNhin();
      this.soKhung++;
      this.thoiGianDem += dt;
      if (this.thoiGianDem < 500) return;   // cập nhật 2 lần/giây cho dễ đọc

      // renderer.info: three.js tự đếm số lệnh vẽ và tam giác của khung hình vừa vẽ
      var info = this.el.renderer.info.render;
      var tk = HALONG.thongKe;
      tk.fps = Math.round(this.soKhung * 1000 / this.thoiGianDem);
      tk.drawCall = info.calls;
      tk.tamGiac = info.triangles;
      this.bangThongSo.textContent =
        'FPS ' + tk.fps + '  ·  Draw call ' + tk.drawCall +
        '  ·  Tam giác ' + Math.round(tk.tamGiac / 1000) + 'k';
      this.bangThongSo.classList.toggle('cham', tk.fps < 45);   // đỏ khi dưới mục tiêu 45 FPS
      this.capNhatChip();

      this.soKhung = 0;
      this.thoiGianDem = 0;
    }
  });
})();
