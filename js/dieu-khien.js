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
 *
 * ĐẦU VÀO KHÁC (cộng chung với bàn phím, đều theo quy ước cần gạt: y < 0 = đi tới):
 *   HALONG.dieuKhienAo : cần ảo + nút bay trên màn cảm ứng (giao-dien.js)
 *   HALONG.dieuKhienVR : cần trái + nút grip của tay cầm VR (component tay-cam-vr bên dưới)
 *
 * COMPONENT "tay-cam-vr" (gắn vào 2 entity tay trong rig, cùng laser-controls):
 *   Cần trái     : đi lại (theo hướng đầu đang nhìn)
 *   Cần phải     : gạt ngang → xoay nhanh 30° (snap turn: xoay từng nấc, không xoay trơn →
 *                  đỡ say VR); gạt lên → hiện vòng cung ngắm, thả ra → dịch chuyển tức thời
 *   Grip trái / phải : hạ xuống / bay lên (chế độ Tự do)
 *   Cò (trigger)  : bấm biểu tượng "i", nút trên bảng thuyết minh (tia laser của laser-controls)
 *   X: đổi chế độ · Y: đổi thời điểm · A: đóng bảng / hành động (Vào hang...) · B: tắt / bật tiếng
 * ========================================================================= */
(function () {
  'use strict';

  var HALONG = window.HALONG;
  var TRUC_Y = new THREE.Vector3(0, 1, 0);
  var KHONG_DIEU_KHIEN = { x: 0, y: 0, len: 0 };

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
      this.gocQuayThem = 0;                    // góc đã xoay nhanh (snap turn) khi đứng trên thuyền
      this.tam2 = new THREE.Vector3();
      this.tamBoong = new THREE.Vector2();
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
      // Còn ở màn hình chờ: chưa cho đi lại / đổi chế độ (và để Space bấm được nút "Bắt đầu")
      if (HALONG.dangGoChu(e) || HALONG.daBatDau === false) return;
      this.phim[e.code] = true;
      if (e.code === 'KeyM' && !e.repeat && !HALONG.boQuaPhimTat(e)) this.doiCheDo();
      // Chặn hành vi mặc định: Space cuộn trang, mũi tên cuộn trang. Riêng Space khi đang focus
      // 1 NÚT (dùng phím Tab) thì để trình duyệt bấm nút đó; nút HUD tự blur() sau khi bấm chuột
      // nên bình thường Space vẫn là bay lên.
      var laNut = e.target && e.target.tagName === 'BUTTON';
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.code) >= 0 &&
          !(e.code === 'Space' && laNut)) {
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
      // Lên lại thuyền: đứng ở chỗ quen thuộc gần mũi, quay mặt về mũi thuyền
      if (this.data.cheDo === 'du-thuyen') { this.datLaiTrenBoong(); this.gocQuayThem = 0; }
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
      //    Cộng bàn phím + cần ảo (điện thoại) + tay cầm VR, rồi kẹp trong [-1, 1]
      var trenThuyen = this.data.cheDo === 'du-thuyen' && HALONG.thuyen;
      var ao = HALONG.dieuKhienAo || KHONG_DIEU_KHIEN, vr = HALONG.dieuKhienVR || KHONG_DIEU_KHIEN;
      var kep1 = THREE.MathUtils.clamp;
      var tien = kep1(this.giu('KeyW', 'ArrowUp') - this.giu('KeyS', 'ArrowDown') - ao.y - vr.y, -1, 1);
      var ngang = kep1(this.giu('KeyD', 'ArrowRight') - this.giu('KeyA', 'ArrowLeft') + ao.x + vr.x, -1, 1);
      var len = trenThuyen ? 0 : kep1(this.giu('Space') - this.giu('KeyC') + ao.len + vr.len, -1, 1);
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
      // Rig chỉ xoay theo HƯỚNG thuyền (+ góc người dùng đã xoay nhanh bằng tay cầm), không
      // chúi/lắc theo (đỡ say sóng khi đeo kính); nhấp nhô vẫn có vì sàn boong nâng hạ theo sóng.
      o.rotation.set(0, goc + this.gocQuayThem, 0);
    },

    /* ---------- Xoay nhanh (snap turn) quanh ĐẦU người dùng ----------
     * Xoay rig quanh tâm rig thì đầu (lệch khỏi tâm khi đeo kính, bước đi trong phòng thật)
     * sẽ văng theo một cung → xoay xong dời rig bù lại cho đầu đứng yên. */
    quayNhanh: function (goc) {
      var o = this.el.object3D, cam = this.el.sceneEl.camera, truoc = this.tam2;
      if (!cam) return;
      cam.getWorldPosition(truoc);
      var trenThuyen = this.data.cheDo === 'du-thuyen' && HALONG.thuyen;
      if (trenThuyen) { this.gocQuayThem += goc; o.rotation.y = HALONG.thuyen.goc + this.gocQuayThem; }
      else o.rotation.y += goc;
      o.updateMatrixWorld(true);
      cam.getWorldPosition(this.dau);
      var dx = truoc.x - this.dau.x, dz = truoc.z - this.dau.z;
      if (trenThuyen) {
        // độ dời (thế giới) → hệ toạ độ thuyền (xoay ngược 'goc' quanh trục Y)
        var c = Math.cos(HALONG.thuyen.goc), s = Math.sin(HALONG.thuyen.goc);
        this.viTriBoong.x += dx * c - dz * s;
        this.viTriBoong.y += dx * s + dz * c;
      } else {
        o.position.x += dx; o.position.z += dz;
      }
    },

    /* ---------- Dịch chuyển tức thời (teleport) ----------
     * kiemTraDiem(p): p (thế giới) có tới được không. Trả về:
     *   'boong'  – trên boong (đang ở chế độ Du thuyền)
     *   'hang'   – trên sàn hang (đang ở trong hang)
     *   'nuoc'   – mặt nước ngoài trời, không nằm trong đảo / nhà bè, trong vùng chơi
     *   null     – không hợp lệ */
    kiemTraDiem: function (p, loaiMat) {
      var tt = HALONG.thuyen, hang = HALONG.hangDong;
      if (loaiMat === 'boong') {
        if (this.data.cheDo !== 'du-thuyen' || !tt) return null;
        var c = Math.cos(tt.goc), s = Math.sin(tt.goc), dx = p.x - tt.viTri.x, dz = p.z - tt.viTri.z;
        var cb = this.tamBoong.set(dx * c - dz * s, dx * s + dz * c), x0 = cb.x, z0 = cb.y;
        tt.kepTrenBoong(cb);
        return Math.hypot(cb.x - x0, cb.y - z0) < 0.05 ? 'boong' : null;
      }
      if (loaiMat === 'hang') {
        return hang && hang.trong(this.tam2.set(p.x, p.y + 1.6, p.z)) ? 'hang' : null;
      }
      // Mặt nước: ngoài mọi elip va chạm (đảo, nhà bè) và trong vùng chơi
      var vatCan = HALONG.vatCan;
      for (var i = 0; i < vatCan.length; i++) {
        var o = vatCan[i], k = o.le != null ? o.le : this.data.khoangCachDao;
        var cs = Math.cos(o.xoay || 0), sn = Math.sin(o.xoay || 0), ox = p.x - o.x, oz = p.z - o.z;
        if (Math.hypot((ox * cs - oz * sn) / ((o.rX || o.r) + k), (ox * sn + oz * cs) / ((o.rZ || o.r) + k)) < 1) return null;
      }
      return Math.hypot(p.x, p.z) < this.data.banKinhGioiHan ? 'nuoc' : null;
    },

    // Điểm p có nằm TRONG thân 1 đảo / nhà bè không (elip đáy, cao tới đỉnh, không cộng lề).
    // Vòng cung ngắm gọi hàm này để dừng lại khi đâm vào vách đá, tránh "nhảy xuyên đảo".
    trongVatCan: function (p) {
      var vatCan = HALONG.vatCan;
      for (var i = 0; i < vatCan.length; i++) {
        var o = vatCan[i];
        if (p.y > o.cao) continue;
        var cs = Math.cos(o.xoay || 0), sn = Math.sin(o.xoay || 0), ox = p.x - o.x, oz = p.z - o.z;
        if (Math.hypot((ox * cs - oz * sn) / (o.rX || o.r), (ox * sn + oz * cs) / (o.rZ || o.r)) < 1) return true;
      }
      return false;
    },

    // Đưa người dùng tới điểm p (chân đứng tại p). loai: kết quả kiemTraDiem
    dichChuyenToi: function (p, loai) {
      var o = this.el.object3D, cam = this.el.sceneEl.camera;
      if (!cam) return;
      cam.getWorldPosition(this.dau);
      if (loai === 'boong') {
        // Đổi điểm đích về hệ thuyền; dời vị trí trên boong sao cho ĐẦU tới đúng chỗ đó
        var tt = HALONG.thuyen, c = Math.cos(tt.goc), s = Math.sin(tt.goc);
        var dx = p.x - this.dau.x, dz = p.z - this.dau.z;
        this.viTriBoong.x += dx * c - dz * s;
        this.viTriBoong.y += dx * s + dz * c;
        return;                                  // diTrenBoong khung sau kẹp lại trong vùng boong
      }
      o.position.x += p.x - this.dau.x;
      o.position.z += p.z - this.dau.z;
      o.position.y = p.y;                        // chân rig đặt lên mặt nước / sàn hang
      this.vanToc.set(0, 0, 0);
      if (loai === 'hang') this.trongHang = true;
      this.gioiHan();
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

  /* =========================================================================
   * COMPONENT "tay-cam-vr": nút + cần gạt của tay cầm VR (đọc sự kiện do laser-controls
   * tạo ra: oculus-touch-controls, valve-index-controls... đều phát cùng tên sự kiện)
   * ========================================================================= */
  var VUNG_CHET = 0.18;          // cần gạt lệch nhỏ hơn thế này coi như 0 (cần cũ hay "trôi")
  var GOC_QUAY = Math.PI / 6;    // xoay nhanh mỗi nấc 30°
  var SO_DIEM_CUNG = 48;         // số điểm của vòng cung ngắm dịch chuyển

  AFRAME.registerComponent('tay-cam-vr', {
    schema: { tay: { default: 'phai', oneOf: ['trai', 'phai'] } },

    init: function () {
      var self = this, el = this.el;
      HALONG.dieuKhienVR = HALONG.dieuKhienVR || { x: 0, y: 0, len: 0 };
      this.daQuay = false;       // cần phải đang gạt ngang (chờ thả về giữa mới cho xoay nấc tiếp)
      this.dangNgam = false;     // cần phải đang gạt lên: đang ngắm điểm dịch chuyển
      this.diemDich = new THREE.Vector3();
      this.loaiDich = null;
      this.p0 = new THREE.Vector3(); this.v0 = new THREE.Vector3(); this.p = new THREE.Vector3();
      this.q = new THREE.Quaternion();

      // Mô hình tay cầm đơn giản tự dựng (laser-controls đặt model: false → không tải mô hình
      // 3D từ mạng, chạy offline được). Chỉ hiện khi tay cầm thật đã kết nối.
      var nhom = new THREE.Group();
      var vlThan = new THREE.MeshLambertMaterial({ color: '#2b2433' });
      var than = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.13, 12), vlThan);
      than.rotation.x = -Math.PI / 2 + 0.5; than.position.set(0, -0.02, 0.04);
      var vong = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.007, 8, 24), new THREE.MeshBasicMaterial({ color: '#ffb26b' }));
      vong.rotation.x = 0.5; vong.position.set(0, 0.01, -0.02);
      nhom.add(than, vong);
      nhom.visible = false;
      el.setObject3D('mo-hinh', nhom);
      this.khiKetNoi = function () { nhom.visible = true; };
      this.khiNgat = function () { nhom.visible = false; self.datLai(); };
      el.addEventListener('controllerconnected', this.khiKetNoi);
      el.addEventListener('controllerdisconnected', this.khiNgat);

      this.khiCan = this.khiCanGat.bind(this);
      el.addEventListener('thumbstickmoved', this.khiCan);
      // Grip: tay trái hạ xuống, tay phải bay lên (chế độ Tự do)
      var huong = this.data.tay === 'trai' ? -1 : 1;
      this.khiGripXuong = function () { HALONG.dieuKhienVR.len = huong; };
      this.khiGripLen = function () { if (HALONG.dieuKhienVR.len === huong) HALONG.dieuKhienVR.len = 0; };
      el.addEventListener('gripdown', this.khiGripXuong);
      el.addEventListener('gripup', this.khiGripLen);
      // Nút mặt trên
      this.cacNut = {
        xbuttondown: this.doiCheDo.bind(this),
        ybuttondown: function () {
          if (!HALONG.thoiDiemKeTiep) return;
          HALONG.thoiDiemKeTiep();
          var ten = { ngay: 'Ngày', hoangHon: 'Hoàng hôn', dem: 'Đêm' }[HALONG.thoiDiem] || '';
          HALONG.thongBao('Thời điểm: ' + ten);
        },
        abuttondown: this.hanhDong.bind(this),
        bbuttondown: function () {
          if (!HALONG.amThanh) return;
          HALONG.thongBao(HALONG.amThanh.doiTatTieng() ? 'Đã tắt tiếng' : 'Đã bật tiếng');
        }
      };
      Object.keys(this.cacNut).forEach(function (ten) { el.addEventListener(ten, self.cacNut[ten]); });

      // Vòng cung ngắm + vòng tròn đánh dấu điểm đến (chỉ tay phải), đặt thẳng trong cảnh
      if (this.data.tay === 'phai') {
        var hinhCung = new THREE.BufferGeometry();
        hinhCung.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SO_DIEM_CUNG * 3), 3));
        this.vlCung = new THREE.LineBasicMaterial({ color: '#6ee7d8', transparent: true, opacity: 0.9, fog: false });
        this.cung = new THREE.Line(hinhCung, this.vlCung);
        this.cung.frustumCulled = false;
        this.cung.visible = false;
        this.dich = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 32).rotateX(-Math.PI / 2),
          new THREE.MeshBasicMaterial({ color: '#6ee7d8', transparent: true, opacity: 0.85, side: THREE.DoubleSide, fog: false }));
        this.dich.visible = false;
        el.sceneEl.object3D.add(this.cung, this.dich);
      }
    },

    remove: function () {
      var el = this.el, self = this;
      el.removeEventListener('controllerconnected', this.khiKetNoi);
      el.removeEventListener('controllerdisconnected', this.khiNgat);
      el.removeEventListener('thumbstickmoved', this.khiCan);
      el.removeEventListener('gripdown', this.khiGripXuong);
      el.removeEventListener('gripup', this.khiGripLen);
      Object.keys(this.cacNut).forEach(function (ten) { el.removeEventListener(ten, self.cacNut[ten]); });
      if (this.cung) { this.cung.parent.remove(this.cung); this.dich.parent.remove(this.dich); }
      el.removeObject3D('mo-hinh');
    },

    dieuKhien: function () {
      var rig = document.querySelector('[dieu-khien]');
      return rig && rig.components['dieu-khien'];
    },

    datLai: function () {
      if (this.data.tay === 'trai') { HALONG.dieuKhienVR.x = 0; HALONG.dieuKhienVR.y = 0; }
      HALONG.dieuKhienVR.len = 0;
      this.dangNgam = false;
      if (this.cung) { this.cung.visible = false; this.dich.visible = false; }
    },

    khiCanGat: function (e) {
      var x = e.detail.x, y = e.detail.y;
      if (Math.abs(x) < VUNG_CHET) x = 0;
      if (Math.abs(y) < VUNG_CHET) y = 0;
      if (this.data.tay === 'trai') {            // cần trái: đi lại
        HALONG.dieuKhienVR.x = x;
        HALONG.dieuKhienVR.y = y;
        return;
      }
      // Cần phải. Xoay nhanh: gạt ngang quá 0,7 → xoay 1 nấc; phải thả về gần giữa mới xoay tiếp
      if (!this.dangNgam) {
        if (!this.daQuay && Math.abs(x) > 0.7 && Math.abs(x) > Math.abs(y)) {
          this.daQuay = true;
          var dk = this.dieuKhien();
          if (dk) dk.quayNhanh(x > 0 ? -GOC_QUAY : GOC_QUAY);   // gạt phải = quay phải (góc âm quanh Y)
        } else if (Math.abs(x) < 0.3) {
          this.daQuay = false;
        }
      }
      // Dịch chuyển: gạt lên (y < -0.7) → ngắm; thả về (y > -0.3) → đi tới điểm đang ngắm
      if (!this.dangNgam && y < -0.7 && Math.abs(y) > Math.abs(x)) {
        this.dangNgam = true;
      } else if (this.dangNgam && y > -0.3) {
        this.dangNgam = false;
        this.cung.visible = false;
        this.dich.visible = false;
        this.thucHienDichChuyen();
      }
    },

    thucHienDichChuyen: function () {
      var dk = this.dieuKhien(), loai = this.loaiDich, diem = this.diemDich.clone();
      if (!dk || !loai) return;
      // "Chớp mắt" rất nhanh (0,1 s tối, 0,18 s sáng) → không thấy cảnh trượt, đỡ chóng mặt
      var lam = function () { dk.dichChuyenToi(diem, loai); };
      if (!HALONG.chuyenCanh || !HALONG.chuyenCanh(lam, 0.1, 0.18)) lam();
    },

    doiCheDo: function () {
      var dk = this.dieuKhien();
      if (!dk) return;
      dk.doiCheDo();
      HALONG.thongBao(dk.data.cheDo === 'tu-do' ? 'Chế độ: Tự do (bay khám phá)' : 'Chế độ: Du thuyền');
    },

    // Nút A: đang mở bảng thuyết minh → đóng; không thì làm hành động trên chip (Vào hang...)
    hanhDong: function () {
      var tt = document.querySelector('#diem-thong-tin');
      var c = tt && tt.components['diem-thong-tin'];
      if (c && c.bangDangMo) { c.dongBang(); return; }
      var gd = this.el.sceneEl.components['giao-dien'];
      if (gd && gd.hanhDongChip) gd.hanhDongChip();
    },

    // Vòng cung ngắm: ném "viên bi" ảo theo hướng tia của tay cầm (v₀ = 9 m/s, rơi tự do)
    // rồi tìm chỗ nó chạm boong / sàn hang / mặt nước
    tick: function () {
      if (!this.dangNgam || !this.cung) return;
      var dk = this.dieuKhien(), el = this.el, rc = el.components.raycaster;
      if (!dk) return;
      var o = el.object3D;
      o.updateMatrixWorld();
      var goc = rc ? rc.data.origin : null, huong = rc ? rc.data.direction : null;
      this.p0.set(goc ? goc.x : 0, goc ? goc.y : 0, goc ? goc.z : 0).applyMatrix4(o.matrixWorld);
      o.getWorldQuaternion(this.q);
      this.v0.set(huong ? huong.x : 0, huong ? huong.y : 0, huong ? huong.z : -1).normalize().applyQuaternion(this.q).multiplyScalar(9);

      var tt = HALONG.thuyen, hang = HALONG.hangDong;
      var trenThuyen = dk.data.cheDo === 'du-thuyen' && tt;
      var dauTrongHang = !trenThuyen && hang && dk.trongHang;
      var mang = this.cung.geometry.attributes.position.array, p = this.p, n = 0, loai = null;
      for (var i = 0; i < SO_DIEM_CUNG; i++) {
        var t = i * 0.045;
        p.copy(this.p0).addScaledVector(this.v0, t);
        p.y -= 4.9 * t * t;
        mang[n++] = p.x; mang[n++] = p.y; mang[n++] = p.z;
        if (i === 0) continue;
        // Mặt có thể đứng: boong (hệ thuyền), sàn hang, hoặc mặt nước (y = 0)
        var matY, loaiMat;
        if (trenThuyen) {
          var c = Math.cos(tt.goc), s = Math.sin(tt.goc), dx = p.x - tt.viTri.x, dz = p.z - tt.viTri.z;
          matY = tt.doCaoSanThe(dx * c - dz * s, dx * s + dz * c);
          loaiMat = 'boong';
          if (p.y <= 0) { loai = null; break; }                    // rơi qua mạn xuống nước: không hợp lệ
        } else if (dauTrongHang) {
          matY = hang.sanY; loaiMat = 'hang';
        } else {
          matY = 0; loaiMat = 'nuoc';
          if (dk.trongVatCan(p)) { loai = null; break; }           // đâm vào vách đảo: dừng cung, báo đỏ
        }
        if (p.y <= matY) {
          p.y = matY;
          mang[n - 2] = matY;
          loai = dk.kiemTraDiem(p, loaiMat);
          break;
        }
      }
      var soDiem = n / 3;
      this.cung.geometry.setDrawRange(0, soDiem);
      this.cung.geometry.attributes.position.needsUpdate = true;
      this.loaiDich = loai;
      this.diemDich.copy(p);
      var mau = loai ? '#6ee7d8' : '#ff6b6b';                       // xanh: tới được · đỏ: không
      this.vlCung.color.set(mau);
      this.cung.visible = true;
      this.dich.visible = !!loai;
      if (loai) { this.dich.position.copy(p); this.dich.position.y += 0.03; this.dich.material.color.set(mau); }
    }
  });
})();
