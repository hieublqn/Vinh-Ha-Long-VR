/* =========================================================================
 * giao-dien.js – GIAO DIỆN TRÊN MÀN HÌNH (HUD) (component "giao-dien")
 * -------------------------------------------------------------------------
 * HUD = các khung HTML nằm đè lên khung cảnh 3D (không nằm trong thế giới 3D).
 * Hiện có:
 *   - Bảng hướng dẫn phím (phím H để ẩn/hiện).
 *   - Chip chế độ (Du thuyền / Tự do) + điểm dừng kế tiếp và khoảng cách.
 *   - Bảng điểm dừng: hiện khi thuyền neo ở điểm tham quan.
 *   - Bảng thông số hiệu năng: FPS, số draw call, số tam giác
 *     → để tự đo xem máy có chạy mượt không.
 * Mốc 4–5 sẽ thêm: minimap, menu, nút Ngày/Hoàng hôn/Đêm, chọn chất lượng,
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
        '<li><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> đi lại</li>',
        '<li><b>Giữ chuột + kéo</b> để xoay</li>',
        '<li><kbd>Shift</kbd> đi nhanh</li>',
        '<li><kbd>M</kbd> đổi chế độ Du thuyền / Tự do</li>',
        '<li><kbd>Space</kbd> / <kbd>C</kbd> bay lên / xuống (Tự do)</li>',
        '<li><kbd>N</kbd> rời điểm dừng ngay</li>',
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
      this.khiDenDiemDung = this.hienDiemDung.bind(this);
      this.khiRoiDiemDung = function () { this.bangDiemDung.classList.add('an'); }.bind(this);
      this.khiDoiCheDo = this.capNhatChip.bind(this);
      sceneEl.addEventListener('den-diem-dung', this.khiDenDiemDung);
      sceneEl.addEventListener('roi-diem-dung', this.khiRoiDiemDung);
      sceneEl.addEventListener('doi-che-do', this.khiDoiCheDo);

      // --- Bảng thông số hiệu năng ---
      this.bangThongSo = document.createElement('div');
      this.bangThongSo.id = 'bang-thong-so';
      this.bangThongSo.className = 'hud-khung';
      document.body.appendChild(this.bangThongSo);

      this.soKhung = 0;      // số khung hình đã vẽ trong lượt đếm
      this.thoiGianDem = 0;  // ms đã trôi qua trong lượt đếm
      HALONG.thongKe = { fps: 0, drawCall: 0, tamGiac: 0 };

      this.khiNhanPhim = function (e) {
        if (e.code === 'KeyH') this.bangHuongDan.classList.toggle('an');
      }.bind(this);
      window.addEventListener('keydown', this.khiNhanPhim);
    },

    remove: function () {
      window.removeEventListener('keydown', this.khiNhanPhim);
      this.el.removeEventListener('den-diem-dung', this.khiDenDiemDung);
      this.el.removeEventListener('roi-diem-dung', this.khiRoiDiemDung);
      this.el.removeEventListener('doi-che-do', this.khiDoiCheDo);
      [this.bangHuongDan, this.bangThongSo, this.chipCheDo, this.bangDiemDung].forEach(function (el) { el.remove(); });
    },

    // Bảng tên + mô tả ngắn của điểm dừng (Mốc 4 sẽ thay bằng bảng 3D đầy đủ)
    hienDiemDung: function (e) {
      var dd = e.detail.diem, tong = HALONG.LO_TRINH.diemDung.length;
      this.bangDiemDung.innerHTML = '';
      var nhan = document.createElement('div');
      nhan.className = 'nhan';
      nhan.textContent = 'Điểm dừng ' + (e.detail.chiSo + 1) + '/' + tong;
      var ten = document.createElement('h2');
      ten.textContent = dd.ten;
      var moTa = document.createElement('p');
      moTa.textContent = dd.moTa;
      this.bangDiemDung.append(nhan, ten, moTa);
      this.bangDiemDung.classList.remove('an');
    },

    // Nội dung chip: chế độ hiện tại + điểm kế tiếp / thời gian còn neo
    capNhatChip: function () {
      var dk = document.querySelector('[dieu-khien]');
      var cheDo = dk ? dk.getAttribute('dieu-khien').cheDo : 'tu-do';
      var tt = HALONG.thuyen, chu;
      if (cheDo === 'du-thuyen' && tt) {
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
