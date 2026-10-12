/* =========================================================================
 * dieu-khien.js – ĐIỀU KHIỂN DI CHUYỂN NGƯỜI DÙNG (component "dieu-khien")
 * -------------------------------------------------------------------------
 * Gắn vào "rig" – khung chứa camera. Cấu trúc theo khuyến nghị của A-Frame:
 *
 *     rig (đi lại, bay lên xuống)            ← component này di chuyển rig
 *      └── camera (xoay đầu nhìn quanh)      ← look-controls xoay camera
 *
 * Tách 2 tầng như vậy vì khi đeo kính VR, kính tự đặt vị trí/hướng cho
 * camera (theo đầu thật). Ta chỉ dời "rig" → vị trí đầu thật được CỘNG
 * thêm vào vị trí rig, hai bên không giành quyền điều khiển của nhau.
 *
 * Mốc 1 (máy tính):
 *   W A S D / phím mũi tên : đi tới / lùi / sang ngang (theo hướng đang nhìn)
 *   Giữ chuột trái + kéo   : xoay góc nhìn (do look-controls của A-Frame lo)
 *   Shift                  : đi nhanh
 *   Space / C              : bay lên / hạ xuống
 *   Không đi xuyên đảo     : va chạm đơn giản bằng khoảng cách tới tâm đảo
 *   Giới hạn vùng chơi     : không đi ra ngoài vòng tròn bán kính cho trước
 * Mốc 5 sẽ thêm: tay cầm VR, teleport, snap turn, nút ảo trên điện thoại.
 * ========================================================================= */
(function () {
  'use strict';

  var HALONG = window.HALONG;
  var TRUC_Y = new THREE.Vector3(0, 1, 0);

  AFRAME.registerComponent('dieu-khien', {
    schema: {
      tocDo: { default: 7 },            // m/s khi đi bình thường
      heSoNhanh: { default: 3.5 },      // giữ Shift → nhanh gấp mấy lần
      tocDoBay: { default: 5 },         // m/s khi bay lên / hạ xuống
      doCaoToiDa: { default: 60 },      // rig không bay cao quá (m)
      banKinhGioiHan: { default: 520 }, // vùng được phép đi (m, tính từ tâm vịnh)
      khoangCachDao: { default: 3 }     // luôn đứng cách vách đảo ít nhất (m)
    },

    init: function () {
      this.phim = {};                   // phím nào đang được giữ
      this.vanToc = new THREE.Vector3();
      this.mucTieu = new THREE.Vector3();
      this.truoc = new THREE.Vector3(0, 0, -1);
      this.phai = new THREE.Vector3(1, 0, 0);
      this.dau = new THREE.Vector3();

      this.khiNhanPhim = this.khiNhanPhim.bind(this);
      this.khiNhaPhim = this.khiNhaPhim.bind(this);
      this.xoaPhim = this.xoaPhim.bind(this);
      window.addEventListener('keydown', this.khiNhanPhim);
      window.addEventListener('keyup', this.khiNhaPhim);
      window.addEventListener('blur', this.xoaPhim);   // chuyển cửa sổ → thả hết phím
    },

    remove: function () {
      window.removeEventListener('keydown', this.khiNhanPhim);
      window.removeEventListener('keyup', this.khiNhaPhim);
      window.removeEventListener('blur', this.xoaPhim);
    },

    khiNhanPhim: function (e) {
      var tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      this.phim[e.code] = true;
      // Chặn hành vi mặc định: Space cuộn trang / bấm nhầm nút đang focus, mũi tên cuộn trang
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.code) >= 0) {
        e.preventDefault();
      }
    },

    khiNhaPhim: function (e) { this.phim[e.code] = false; },
    xoaPhim: function () { this.phim = {}; },

    // Giá trị 1 nếu một trong các phím đang giữ, ngược lại 0
    giu: function () {
      for (var i = 0; i < arguments.length; i++) if (this.phim[arguments[i]]) return 1;
      return 0;
    },

    tick: function (t, dt) {
      if (!dt) return;
      var giay = Math.min(dt, 100) / 1000;   // tab bị treo lâu → không "nhảy cóc" quá xa
      var camera = this.el.sceneEl.camera;
      if (!camera) return;

      // 1) Hướng "phía trước" = hướng camera đang nhìn, chiếu xuống mặt phẳng ngang
      camera.getWorldDirection(this.truoc);
      this.truoc.y = 0;
      if (this.truoc.lengthSq() > 1e-6) {
        this.truoc.normalize();
        this.phai.crossVectors(this.truoc, TRUC_Y);   // tích có hướng → vector bên phải
      }

      // 2) Đọc phím
      var tien = this.giu('KeyW', 'ArrowUp') - this.giu('KeyS', 'ArrowDown');
      var ngang = this.giu('KeyD', 'ArrowRight') - this.giu('KeyA', 'ArrowLeft');
      var len = this.giu('Space') - this.giu('KeyC');
      var nhanh = this.giu('ShiftLeft', 'ShiftRight') ? this.data.heSoNhanh : 1;

      this.mucTieu.set(0, 0, 0)
        .addScaledVector(this.truoc, tien)
        .addScaledVector(this.phai, ngang);
      if (this.mucTieu.lengthSq() > 1) this.mucTieu.normalize();   // đi chéo không nhanh hơn
      this.mucTieu.multiplyScalar(this.data.tocDo * nhanh);
      this.mucTieu.y = len * this.data.tocDoBay * nhanh;

      // 3) Tăng/giảm tốc MƯỢT (không giật cục, đỡ chóng mặt khi đeo kính)
      this.vanToc.lerp(this.mucTieu, 1 - Math.exp(-giay * 6));
      if (this.vanToc.lengthSq() < 1e-6 && this.mucTieu.lengthSq() === 0) return;

      // 4) Dời rig rồi kiểm tra va chạm / giới hạn
      this.el.object3D.position.addScaledVector(this.vanToc, giay);
      this.gioiHan();
    },

    // Đẩy người dùng ra nếu đi vào đảo / ra khỏi vùng chơi / xuống dưới nước
    gioiHan: function () {
      var d = this.data;
      var p = this.el.object3D.position;
      p.y = Math.min(Math.max(p.y, 0), d.doCaoToiDa);

      // Vị trí ĐẦU thật = rig + camera (khi đeo kính, đầu có thể lệch khỏi tâm rig)
      this.el.sceneEl.camera.getWorldPosition(this.dau);

      var vatCan = HALONG.vatCan;
      for (var i = 0; i < vatCan.length; i++) {
        var o = vatCan[i];
        if (this.dau.y > o.cao + 2) continue;          // đang bay cao hơn đỉnh đảo → cho qua
        var dx = this.dau.x - o.x, dz = this.dau.z - o.z;
        var kc = Math.hypot(dx, dz);
        var toiThieu = o.r + d.khoangCachDao;
        if (kc < toiThieu && kc > 1e-4) {
          // Đẩy ra theo hướng từ tâm đảo → người dùng "trượt" dọc theo vách
          var day = (toiThieu - kc) / kc;
          p.x += dx * day; p.z += dz * day;
          this.dau.x += dx * day; this.dau.z += dz * day;
        }
      }

      // Giới hạn vùng chơi hình tròn
      var r = Math.hypot(this.dau.x, this.dau.z);
      if (r > d.banKinhGioiHan) {
        var thu = (r - d.banKinhGioiHan) / r;
        p.x -= this.dau.x * thu; p.z -= this.dau.z * thu;
      }
    }
  });
})();
