/* =========================================================================
 * giao-dien.js – GIAO DIỆN TRÊN MÀN HÌNH (HUD) (component "giao-dien")
 * -------------------------------------------------------------------------
 * HUD = các khung HTML nằm đè lên khung cảnh 3D (không nằm trong thế giới 3D).
 * Mốc 1 có:
 *   - Bảng hướng dẫn phím (phím H để ẩn/hiện).
 *   - Bảng thông số hiệu năng: FPS, số draw call, số tam giác
 *     → để tự đo xem máy có chạy mượt không.
 * Mốc 4–5 sẽ thêm: minimap, menu, nút Ngày/Hoàng hôn/Đêm, chọn chất lượng.
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
        '<li><kbd>Space</kbd> / <kbd>C</kbd> bay lên / xuống</li>',
        '<li><kbd>H</kbd> ẩn / hiện bảng này</li>',
        '</ul>'
      ].join('');
      document.body.appendChild(this.bangHuongDan);

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
      this.bangHuongDan.remove();
      this.bangThongSo.remove();
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

      this.soKhung = 0;
      this.thoiGianDem = 0;
    }
  });
})();
