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
 * 2 CHẾ ĐỘ (phím M để đổi):
 *   "du-thuyen": người dùng ĐỨNG TRÊN BOONG thuyền. Mỗi khung hình, rig được
 *       đặt lại theo vị trí + hướng của thuyền (cộng vị trí đang đứng trên
 *       boong) → thuyền chạy thì người chạy theo, thuyền rẽ thì người xoay theo,
 *       sóng nâng hạ sàn thì người nâng hạ theo.
 *       W A S D đi lại trên boong; vị trí ĐẦU được giữ trong vùng boong
 *       (không thò ra ngoài mạn / xuyên cột buồm, kể cả khi đeo kính bước đi).
 *   "tu-do": rời thuyền, bay tự do trên mặt nước:
 *       W A S D / phím mũi tên : đi tới / lùi / sang ngang (theo hướng đang nhìn)
 *       Shift                  : đi nhanh
 *       Space / C              : bay lên / hạ xuống
 *       Không đi xuyên đảo     : va chạm đơn giản bằng khoảng cách tới tâm đảo
 *       Giới hạn vùng chơi     : không đi ra ngoài vòng tròn bán kính cho trước
 *   Cả 2 chế độ: giữ chuột trái + kéo để xoay góc nhìn (look-controls của A-Frame).
 * Mốc 5 sẽ thêm: tay cầm VR, teleport, snap turn, nút ảo trên điện thoại.
 * ========================================================================= */
(function () {
  'use strict';

  var HALONG = window.HALONG;
  var TRUC_Y = new THREE.Vector3(0, 1, 0);

  AFRAME.registerComponent('dieu-khien', {
    // A-Frame gọi tick() theo TỪNG LOẠI component, theo thứ tự đăng ký (không theo
    // thứ tự thẻ HTML). 'after' bắt A-Frame chạy component này SAU 'du-thuyen':
    // thuyền di chuyển xong rồi rig mới bám theo → người đứng trên boong không bị
    // trễ 1 khung hình (trễ sẽ thấy boong rung dưới chân).
    after: ['du-thuyen'],
    schema: {
      cheDo: { default: 'du-thuyen', oneOf: ['du-thuyen', 'tu-do'] },
      tocDoTrenBoong: { default: 1.6 }, // m/s – đi bộ trên boong
      tocDo: { default: 7 },            // m/s khi bay tự do
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
      this.q = new THREE.Quaternion();
      this.euler = new THREE.Euler();
      this.viTriBoong = new THREE.Vector2();   // (x, z) tâm rig trên boong (hệ tọa độ thuyền)
      this.viTriDau = new THREE.Vector2();     // (x, z) của ĐẦU trên boong (dùng khi kẹp)
      this.datLaiTrenBoong();

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
      if (HALONG.dangGoChu(e)) return;
      this.phim[e.code] = true;
      if (e.code === 'KeyM' && !e.repeat && !HALONG.boQuaPhimTat(e)) this.doiCheDo();
      // Chặn hành vi mặc định: Space cuộn trang / bấm nhầm nút đang focus, mũi tên cuộn trang
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.code) >= 0) {
        e.preventDefault();
      }
    },

    khiNhaPhim: function (e) { this.phim[e.code] = false; },
    xoaPhim: function () { this.phim = {}; },

    // Đổi qua lại 2 chế độ (giao diện / tay cầm VR cũng gọi hàm này)
    doiCheDo: function (cheDoMoi) {
      cheDoMoi = cheDoMoi || (this.data.cheDo === 'du-thuyen' ? 'tu-do' : 'du-thuyen');
      if (cheDoMoi === 'du-thuyen' && !HALONG.thuyen) return;
      this.el.setAttribute('dieu-khien', 'cheDo', cheDoMoi);
    },

    update: function (cu) {
      if (cu.cheDo === undefined || cu.cheDo === this.data.cheDo) return;
      this.vanToc.set(0, 0, 0);
      this.trongHang = false;
      // Lên lại thuyền: đứng ở chỗ quen thuộc gần mũi
      if (this.data.cheDo === 'du-thuyen') this.datLaiTrenBoong();
      this.el.sceneEl.emit('doi-che-do', { cheDo: this.data.cheDo });
    },

    datLaiTrenBoong: function () {
      if (HALONG.thuyen) this.viTriBoong.copy(HALONG.thuyen.viTriBatDauTrenBoong);
    },

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

      // 1) Hướng "phía trước" lấy từ góc QUAY NGANG (yaw) của camera.
      //    Không chiếu hướng nhìn xuống mặt phẳng ngang, vì khi nhìn thẳng xuống
      //    chân (hoặc lên trời) hình chiếu đó gần bằng 0 → W/S sẽ "đứng hình".
      //    Thứ tự 'YXZ': tách riêng góc quay ngang (Y) trước góc cúi/ngửa (X).
      camera.getWorldQuaternion(this.q);
      var yaw = this.euler.setFromQuaternion(this.q, 'YXZ').y;
      this.truoc.set(-Math.sin(yaw), 0, -Math.cos(yaw));
      this.phai.crossVectors(this.truoc, TRUC_Y);     // tích có hướng → vector bên phải

      // 2) Đọc phím
      var trenThuyen = this.data.cheDo === 'du-thuyen' && HALONG.thuyen;
      var tien = this.giu('KeyW', 'ArrowUp') - this.giu('KeyS', 'ArrowDown');
      var ngang = this.giu('KeyD', 'ArrowRight') - this.giu('KeyA', 'ArrowLeft');
      var len = trenThuyen ? 0 : this.giu('Space') - this.giu('KeyC');
      var nhanh = this.giu('ShiftLeft', 'ShiftRight') ? this.data.heSoNhanh : 1;

      this.mucTieu.set(0, 0, 0)
        .addScaledVector(this.truoc, tien)
        .addScaledVector(this.phai, ngang);
      if (this.mucTieu.lengthSq() > 1) this.mucTieu.normalize();   // đi chéo không nhanh hơn
      this.mucTieu.multiplyScalar(trenThuyen ? this.data.tocDoTrenBoong * Math.min(nhanh, 2) : this.data.tocDo * nhanh);
      this.mucTieu.y = len * this.data.tocDoBay * nhanh;

      // 3) Tăng/giảm tốc MƯỢT (không giật cục, đỡ chóng mặt khi đeo kính)
      this.vanToc.lerp(this.mucTieu, 1 - Math.exp(-giay * 6));

      if (trenThuyen) {
        this.diTrenBoong(giay);
        return;
      }
      if (this.vanToc.lengthSq() < 1e-6 && this.mucTieu.lengthSq() === 0) return;

      // 4) Dời rig rồi kiểm tra va chạm / giới hạn
      this.el.object3D.position.addScaledVector(this.vanToc, giay);
      this.gioiHan();
    },

    // Chế độ du thuyền: bước đi được đổi sang hệ tọa độ của thuyền, kẹp trong
    // vùng boong, rồi đặt rig = vị trí thuyền + (vị trí trên boong đã xoay theo thuyền)
    diTrenBoong: function (giay) {
      var tt = HALONG.thuyen, goc = tt.goc;
      var c = Math.cos(goc), s = Math.sin(goc);
      var o = this.el.object3D;

      // Độ lệch của ĐẦU so với tâm rig, đổi sang hệ thuyền. Trên máy tính = 0;
      // khi đeo kính, người dùng bước đi trong phòng thật nên đầu lệch khỏi tâm rig.
      this.el.sceneEl.camera.getWorldPosition(this.dau);
      var ox = this.dau.x - o.position.x, oz = this.dau.z - o.position.z;
      var lechX = ox * c - oz * s, lechZ = ox * s + oz * c;

      // Đổi bước đi (hệ thế giới) → hệ thuyền: xoay ngược 1 góc 'goc' quanh trục Y
      var dx = this.vanToc.x * giay, dz = this.vanToc.z * giay;
      this.viTriBoong.x += dx * c - dz * s;
      this.viTriBoong.y += dx * s + dz * c;

      // Kẹp vị trí ĐẦU (không phải tâm rig) trong vùng boong → không thò đầu ra ngoài mạn
      this.viTriDau.set(this.viTriBoong.x + lechX, this.viTriBoong.y + lechZ);
      tt.kepTrenBoong(this.viTriDau);
      this.viTriBoong.set(this.viTriDau.x - lechX, this.viTriDau.y - lechZ);

      // Đổi vị trí trên boong (hệ thuyền) → hệ thế giới: xoay 'goc' rồi cộng vị trí thuyền.
      // Độ cao = mặt sàn ĐÚNG chỗ đang đứng (có tính thuyền chúi/lắc) → chân không lơ lửng.
      var bx = this.viTriBoong.x, bz = this.viTriBoong.y;
      o.position.set(
        tt.viTri.x + bx * c + bz * s,
        tt.doCaoSanThe(this.viTriDau.x, this.viTriDau.y),
        tt.viTri.z - bx * s + bz * c
      );
      // Rig chỉ xoay theo HƯỚNG thuyền, không chúi/lắc theo (đỡ say sóng khi đeo kính);
      // phần nhấp nhô lên xuống vẫn có vì sàn boong nâng hạ theo sóng.
      o.rotation.set(0, goc, 0);
    },

    // Trong hang: đầu cao hơn sàn hang ≥ 1,5 m (ngoài phễu trên mặt nước thì hạ dần về 1,6 m)
    giuTrenSanHang: function (hang, p) {
      var sanToiThieu = hang.doCaoDauToiThieu(this.dau);
      if (this.dau.y < sanToiThieu) { p.y += sanToiThieu - this.dau.y; this.dau.y = sanToiThieu; }
    },

    // Đẩy người dùng ra nếu đi vào đảo / ra khỏi vùng chơi / xuống dưới nước
    gioiHan: function () {
      var d = this.data;
      var p = this.el.object3D.position;
      p.y = Math.min(Math.max(p.y, 0), d.doCaoToiDa);

      // Vị trí ĐẦU thật = rig + camera (khi đeo kính, đầu có thể lệch khỏi tâm rig)
      this.el.sceneEl.camera.getWorldPosition(this.dau);

      // Hang Sửng Sốt: đầu đang ở trong vùng hang (đường hầm / khoang) thì KHÔNG xét va
      // chạm với đảo (đảo Bồ Hòn bao quanh hang), mà giữ người dùng trong lòng hang.
      var hang = HALONG.hangDong;
      if (hang) {
        if (hang.trong(this.dau)) {
          this.trongHang = true;
          this.giuTrenSanHang(hang, p);
          return;
        }
        // (chỉ còn tính "đang trong hang" khi ở gần hang – tránh bị kéo về hang từ nơi khác)
        if (this.trongHang && this.dau.distanceTo(hang.Cc) < 45 + hang.daiPheu) {
          if (hang.raNgoaiCua(this.dau)) {
            this.trongHang = false;                          // đã ra khỏi hang qua cửa
          } else {
            var truocKep = this.dau.clone();                 // định đâm vào vách → kéo về trong hang
            hang.kep(this.dau);
            p.add(this.dau.sub(truocKep));
            // elip khoang hang thò xuống dưới sàn → kẹp xong vẫn phải giữ đầu trên sàn,
            // nếu không khung sau sẽ bị đẩy giật lên ~2 m
            this.el.sceneEl.camera.getWorldPosition(this.dau);
            this.giuTrenSanHang(hang, p);
            return;
          }
        }
        this.trongHang = false;
      }

      // Mỗi đảo là 1 hình ELIP (đảo bị kéo dài theo 1 trục và xoay 1 góc).
      // Cách xét: đổi vị trí đầu sang hệ tọa độ riêng của đảo (xoay ngược), chia cho
      // 2 bán trục → nếu nằm trong hình tròn đơn vị (q < 1) là đang ở trong đảo.
      var vatCan = HALONG.vatCan;
      for (var i = 0; i < vatCan.length; i++) {
        var o = vatCan[i];
        // Vật cản nhỏ (nhà bè ~5 m) khác đảo (hàng chục mét): vùng "đẩy lên nóc" và độ nâng
        // phải nhỏ theo, nếu không chạm nhà ở tầm mắt là bị hất thẳng lên 4–5 m
        var nho = o.cao < 10;
        var vuotDinh = nho ? 0.8 : 2;
        if (this.dau.y > o.cao + vuotDinh) continue;   // đang bay cao hơn đỉnh → cho qua
        var k = o.le != null ? o.le : d.khoangCachDao;
        var dx = this.dau.x - o.x, dz = this.dau.z - o.z;
        var cs = Math.cos(o.xoay || 0), sn = Math.sin(o.xoay || 0);
        var lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
        var ax = (o.rX || o.r) + k, az = (o.rZ || o.r) + k;
        var q = Math.hypot(lx / ax, lz / az);
        if (q >= 1) continue;
        // Hạ xuống từ phía trên, sát đỉnh → đẩy LÊN (đứng trên đỉnh),
        // thay vì văng ngang hàng chục mét trong 1 khung hình
        if (this.dau.y > o.cao - (nho ? 0.6 : 4) && o.cao + 0.4 <= d.doCaoToiDa) {
          var len = o.cao + vuotDinh - this.dau.y;
          p.y += len; this.dau.y += len;
          continue;
        }
        // Đi ngang vào vách → đẩy ra điểm trên mép elip cùng hướng ("trượt" dọc vách)
        if (q < 1e-4) { lx = ax; lz = 0; } else { lx /= q; lz /= q; }
        var mx = lx * cs + lz * sn, mz = -lx * sn + lz * cs;   // đổi ngược về hệ thế giới
        p.x += mx - dx; p.z += mz - dz;
        this.dau.x += mx - dx; this.dau.z += mz - dz;
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
