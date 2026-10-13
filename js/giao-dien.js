/* =========================================================================
 * giao-dien.js – GIAO DIỆN TRÊN MÀN HÌNH (HUD) (component "giao-dien")
 * -------------------------------------------------------------------------
 * HUD = các khung HTML nằm đè lên khung cảnh 3D (không nằm trong thế giới 3D).
 *   1. Màn hình chờ (khung HTML có sẵn trong index.html): bật nút "Bắt đầu" khi
 *      khung cảnh đã dựng + biên dịch shader xong. Bấm nút → bắt đầu du thuyền,
 *      bật âm thanh (trình duyệt chỉ cho phát tiếng sau 1 thao tác của người dùng).
 *   2. Bảng hướng dẫn phím (H), chip chế độ (Du thuyền / Tự do) kèm NÚT HÀNH ĐỘNG
 *      theo ngữ cảnh ("Vào hang ▸" / "Ra khỏi hang ▸"), bảng điểm dừng (+ gợi ý hướng nhìn).
 *   3. Nút Ngày / Hoàng hôn / Đêm (1 2 3) + nút loa (T: tắt / bật tiếng).
 *   4. Bản đồ nhỏ (minimap, phím B): lớp nền (đảo, lộ trình, điểm dừng) vẽ 1 lần ra
 *      canvas phụ; mỗi 0,1 giây chỉ chép lại nền + vẽ thuyền, người xem → rất nhẹ.
 *   5. Chụp ảnh (P): vẽ lại khung hình rồi lưu PNG (có dòng chữ ký góc ảnh).
 *   6. Chuyển cảnh tối dần – sáng dần khi dịch chuyển vào / ra hang: quả cầu đen gắn
 *      vào camera (vật 3D nên thấy được cả khi đeo kính VR, khác khung HTML).
 *   7. Bảng thông số hiệu năng: FPS, số draw call, số tam giác.
 *   8. Chất lượng đồ hoạ Thấp / Cao (nút ⚙, phím Q): lúc đầu đo FPS, máy chạy chậm thì
 *      tự hạ xuống Thấp (nếu người dùng chưa tự chọn).
 *   9. Thông báo: khung HTML trên màn hình + khung 3D gắn trước mắt khi đeo kính VR
 *      (đổi chế độ, đổi thời điểm bằng nút tay cầm... cần có phản hồi nhìn thấy được).
 *  10. Màn cảm ứng (điện thoại, máy tính bảng): cần điều khiển ảo để đi lại, nút bay
 *      lên / xuống, nút đổi chế độ; vuốt màn hình để xoay; nghiêng máy để nhìn (con quay).
 * ========================================================================= */
(function () {
  'use strict';

  var HALONG = window.HALONG;

  AFRAME.registerComponent('giao-dien', {
    init: function () {
      var self = this, sceneEl = this.el;

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
        '<li><b>Bấm biểu tượng i</b> để đọc thuyết minh</li>',
        '<li><kbd>P</kbd> chụp ảnh · <kbd>T</kbd> tiếng · <kbd>B</kbd> bản đồ</li>',
        '<li><kbd>H</kbd> ẩn / hiện bảng này</li>',
        '</ul>'
      ].join('');
      document.body.appendChild(this.bangHuongDan);

      // --- Chip chế độ (giữa, phía trên): các phần tử dựng 1 lần, sau đó chỉ đổi chữ.
      //     (Nếu gán lại innerHTML mỗi nửa giây thì nút trong chip bị tạo lại liên tục →
      //     bấm hụt, mất trạng thái hover.)
      this.chipCheDo = document.createElement('div');
      this.chipCheDo.id = 'chip-che-do';
      this.chipCheDo.className = 'hud-khung';
      this.chipTen = document.createElement('b');
      this.chipChu = document.createElement('span');
      this.chipNut = document.createElement('button');
      this.chipNut.type = 'button';
      this.chipNut.className = 'nut-chip';
      this.chipNut.hidden = true;
      this.chipNut.addEventListener('click', function () {
        if (self.hanhDongChip) self.hanhDongChip();
        self.chipNut.blur();          // bỏ focus để phím Space không "bấm" lại nút
      });
      this.chipGoiY = document.createElement('span');
      this.chipGoiY.className = 'goi-y';
      this.chipCheDo.append(this.chipTen, document.createTextNode(' · '), this.chipChu, this.chipNut, this.chipGoiY);
      document.body.appendChild(this.chipCheDo);

      // --- Bảng điểm dừng (giữa, phía dưới chip) ---
      this.bangDiemDung = document.createElement('div');
      this.bangDiemDung.id = 'bang-diem-dung';
      this.bangDiemDung.className = 'hud-khung an';
      document.body.appendChild(this.bangDiemDung);

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

      // --- Nút thời điểm + nút loa (góc phải trên) – bấm được nên bật pointer-events ---
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
          nut.blur();
        });
        this.nutThoiDiem.appendChild(nut);
      }, this);
      this.nutLoa = document.createElement('button');
      this.nutLoa.type = 'button';
      this.nutLoa.className = 'nut-loa';
      this.nutLoa.addEventListener('click', function () {
        if (HALONG.amThanh) HALONG.amThanh.doiTatTieng();
        self.nutLoa.blur();
      });
      this.nutThoiDiem.appendChild(this.nutLoa);
      this.nutChatLuong = document.createElement('button');
      this.nutChatLuong.type = 'button';
      this.nutChatLuong.className = 'nut-chat-luong';
      this.nutChatLuong.addEventListener('click', function () {
        self.doiChatLuong();
        self.nutChatLuong.blur();
      });
      this.nutThoiDiem.appendChild(this.nutChatLuong);
      document.body.appendChild(this.nutThoiDiem);
      this.khiDoiThoiDiem = this.danhDauThoiDiem.bind(this);
      sceneEl.addEventListener('doi-thoi-diem', this.khiDoiThoiDiem);
      this.danhDauThoiDiem({ detail: { ten: HALONG.thoiDiem || 'hoangHon' } });
      this.khiDoiAmThanh = this.capNhatNutLoa.bind(this);
      sceneEl.addEventListener('doi-am-thanh', this.khiDoiAmThanh);
      this.capNhatNutLoa();

      // --- Bản đồ nhỏ ---
      this.banDo = document.createElement('canvas');
      this.banDo.id = 'ban-do';
      this.banDo.className = 'hud-khung';
      this.banDo.setAttribute('aria-label', 'Bản đồ nhỏ');
      document.body.appendChild(this.banDo);
      this.demBanDo = 0;

      // --- Thông báo ngắn (chụp ảnh xong...) ---
      this.thongBao = document.createElement('div');
      this.thongBao.id = 'thong-bao';
      this.thongBao.className = 'hud-khung an';
      this.thongBao.setAttribute('role', 'status');
      document.body.appendChild(this.thongBao);

      // --- Bảng thông số hiệu năng ---
      this.bangThongSo = document.createElement('div');
      this.bangThongSo.id = 'bang-thong-so';
      this.bangThongSo.className = 'hud-khung';
      document.body.appendChild(this.bangThongSo);

      this.soKhung = 0;      // số khung hình đã vẽ trong lượt đếm
      this.thoiGianDem = 0;  // ms đã trôi qua trong lượt đếm
      HALONG.thongKe = { fps: 0, drawCall: 0, tamGiac: 0 };

      this.khiNhanPhim = function (e) {
        if (HALONG.boQuaPhimTat(e) || e.repeat) return;   // giữ phím lâu: trình duyệt lặp keydown
        // Còn ở màn hình chờ (khung cảnh bị che, đang ẩn): chỉ cho chọn trước tắt / bật tiếng
        if (HALONG.daBatDau === false && e.code !== 'KeyT') return;
        switch (e.code) {
          case 'KeyH': this.bangHuongDan.classList.toggle('an'); break;
          case 'KeyB': this.banDo.classList.toggle('an'); break;
          case 'KeyP': this.chupAnh(); break;
          case 'KeyT': if (HALONG.amThanh) HALONG.amThanh.doiTatTieng(); break;
          case 'KeyQ': this.doiChatLuong(); break;
          default: {
            // Phím 1 2 3: Ngày / Hoàng hôn / Đêm
            var phimSo = { Digit1: 'ngay', Digit2: 'hoangHon', Digit3: 'dem' }[e.code];
            if (phimSo && HALONG.datThoiDiem) HALONG.datThoiDiem(phimSo);
          }
        }
      }.bind(this);
      window.addEventListener('keydown', this.khiNhanPhim);

      // Điện thoại không có bàn phím: bảng phím chỉ che màn hình → ẩn sẵn
      // (Mốc 5 sẽ thêm nút ảo + hướng dẫn cảm ứng). Màn thấp (điện thoại / cửa sổ xoay ngang)
      // cũng ẩn sẵn: bảng cao ~350 px sẽ đè lên chip và bảng điểm dừng ở dưới. Phím H vẫn mở lại.
      if (AFRAME.utils.device.isMobile() || window.innerHeight < 520) this.bangHuongDan.classList.add('an');
      // Màn hẹp (điện thoại dọc): không đủ chỗ cho bản đồ cạnh bảng hướng dẫn → ẩn sẵn (phím B)
      if (window.innerWidth <= 600) this.banDo.classList.add('an');

      // Nút kính VR: máy không hỗ trợ WebXR "immersive-vr" (laptop không cắm kính) thì
      // bấm nút chỉ làm khung 3D toàn màn hình và che HUD → ẩn nút đi.
      function anNutVR() { sceneEl.setAttribute('xr-mode-ui', 'enabled', false); }
      if (!navigator.xr || !navigator.xr.isSessionSupported) anNutVR();
      else navigator.xr.isSessionSupported('immersive-vr').then(function (co) { if (!co) anNutVR(); }, anNutVR);

      this.taoManHinhCho();
      this.taoQuaCauChuyenCanh();
      this.taoThongBao3D();
      this.taoDieuKhienCamUng();
      HALONG.vaoHang = this.vaoHang.bind(this);
      HALONG.raKhoiHang = this.raKhoiHang.bind(this);
      HALONG.chuyenCanh = this.chuyenCanh.bind(this);
      // Thông báo ngắn: khung HTML; đang đeo kính thì thêm khung 3D trước mắt (HTML không thấy trong kính)
      HALONG.thongBao = function (chu) {
        self.hienThongBao(chu);
        if (sceneEl.is('vr-mode')) self.hienThongBao3D(chu);
      };

      // --- Chất lượng đồ hoạ ---
      HALONG.chatLuong.datMuc(HALONG.chatLuong.ten);
      this.khiDoiChatLuong = this.capNhatNutChatLuong.bind(this);
      sceneEl.addEventListener('doi-chat-luong', this.khiDoiChatLuong);
      this.capNhatNutChatLuong();
      // Thoát kính: A-Frame đặt lại tỉ lệ điểm ảnh theo màn hình → áp lại mức đang chọn
      this.khiThoatVR = function () { HALONG.chatLuong.datMuc(HALONG.chatLuong.ten); };
      sceneEl.addEventListener('exit-vr', this.khiThoatVR);
      this.doFps = { mau: [], xong: false };   // đo FPS vài giây đầu để tự hạ chất lượng
    },

    remove: function () {
      var el = this.el;
      window.removeEventListener('keydown', this.khiNhanPhim);
      el.removeEventListener('den-diem-dung', this.khiDenDiemDung);
      el.removeEventListener('roi-diem-dung', this.khiRoiDiemDung);
      el.removeEventListener('doi-che-do', this.khiDoiCheDo);
      el.removeEventListener('renderstart', this.khiBatDauVe);
      el.removeEventListener('doi-thoi-diem', this.khiDoiThoiDiem);
      el.removeEventListener('doi-am-thanh', this.khiDoiAmThanh);
      el.removeEventListener('doi-chat-luong', this.khiDoiChatLuong);
      el.removeEventListener('exit-vr', this.khiThoatVR);
      if (this.khungCamUng) this.khungCamUng.remove();
      if (this.thongBao3D) this.thongBao3D.parent.remove(this.thongBao3D);
      el.removeEventListener('enter-vr', HALONG.batDau);
      clearTimeout(this.henGioCham);
      clearTimeout(this.henGioThongBao);
      if (this.quaCauToi) this.quaCauToi.parent.remove(this.quaCauToi);
      [this.bangHuongDan, this.bangThongSo, this.chipCheDo, this.bangDiemDung, this.nutThoiDiem,
        this.banDo, this.thongBao].forEach(function (e) { e.remove(); });
    },

    /* ---------------- 1. Màn hình chờ ---------------- */
    taoManHinhCho: function () {
      var self = this, sceneEl = this.el;
      var man = this.manHinhCho = document.getElementById('man-hinh-cho');
      var nut = document.getElementById('nut-bat-dau');
      var trangThai = document.getElementById('mhc-trang-thai');
      // Không có màn hình chờ (trang thử riêng lẻ) → chạy luôn
      HALONG.daBatDau = !man;

      HALONG.batDau = function () {
        if (HALONG.daBatDau) return;
        HALONG.daBatDau = true;
        sceneEl.object3D.visible = true;                // hiện lại khung cảnh đã ẩn lúc chờ
        if (HALONG.amThanh) HALONG.amThanh.batDau();     // ngay trong thao tác bấm → được phép phát tiếng
        // iPhone / iPad (iOS 13+): phải xin quyền con quay hồi chuyển trong 1 thao tác bấm
        // thì "nghiêng máy để nhìn" mới chạy (look-controls dùng sự kiện deviceorientation)
        var DOE = window.DeviceOrientationEvent;
        if (DOE && typeof DOE.requestPermission === 'function') {
          try { DOE.requestPermission().catch(function () {}); } catch (e) { /* trình duyệt từ chối */ }
        }
        if (man) {
          if (nut) nut.blur();                           // không giữ focus trên nút đã ẩn
          man.classList.add('an-di');
          setTimeout(function () { man.hidden = true; }, 800);
        }
        sceneEl.emit('bat-dau');
      };
      if (!man) return;
      nut.addEventListener('click', HALONG.batDau);
      // Bấm nút kính VR khi còn ở màn hình chờ (khung HTML không hiện trong kính) → bắt đầu luôn
      sceneEl.addEventListener('enter-vr', HALONG.batDau);

      // Máy yếu dựng lâu: báo cho người dùng yên tâm chờ
      this.henGioCham = setTimeout(function () {
        if (!nut.disabled) return;
        trangThai.textContent = 'Máy hơi chậm, sắp xong rồi…';
      }, 15000);

      // Biên dịch SẴN mọi shader ngay khi bắt đầu vẽ. Nếu không, vật nào lúc đầu nằm
      // sau lưng (cabin, buồm...) chỉ được biên dịch khi người dùng quay lại nhìn
      // → khựng hình một nhịp giữa chừng. Biên dịch xong + vẽ 2 khung → mới cho bấm.
      this.khiBatDauVe = function () {
        trangThai.textContent = 'Đang chuẩn bị đồ hoạ…';
        requestAnimationFrame(function () {
          if (sceneEl.renderer.compile && sceneEl.camera) sceneEl.renderer.compile(sceneEl.object3D, sceneEl.camera);
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              clearTimeout(self.henGioCham);
              trangThai.textContent = 'Sẵn sàng! Bấm để lên thuyền.';
              man.classList.add('san-sang');
              nut.disabled = false;
              nut.focus();                         // Enter / Space là bắt đầu luôn
              // Màn hình chờ che kín khung 3D, shader đã biên dịch xong → ẩn cả khung cảnh tới khi
              // bấm Bắt đầu: renderer chỉ xoá màn hình, GPU (và pin laptop) được nghỉ
              if (!HALONG.daBatDau) sceneEl.object3D.visible = false;
            });
          });
        });
      };
      sceneEl.addEventListener('renderstart', this.khiBatDauVe);
    },

    /* ---------------- 2. Chip, bảng điểm dừng ---------------- */
    // Tô sáng nút của thời điểm đang chọn
    danhDauThoiDiem: function (e) {
      Array.prototype.forEach.call(this.nutThoiDiem.querySelectorAll('button[data-ten]'), function (nut) {
        nut.classList.toggle('dang-chon', nut.dataset.ten === e.detail.ten);
      });
    },

    capNhatNutLoa: function () {
      var tat = !!(HALONG.amThanh && HALONG.amThanh.dangTat);
      this.nutLoa.textContent = tat ? '🔇' : '🔊';
      this.nutLoa.title = tat ? 'Bật tiếng (T)' : 'Tắt tiếng (T)';
      this.nutLoa.setAttribute('aria-label', this.nutLoa.title);
      this.nutLoa.classList.toggle('dang-tat', tat);
    },

    cheDoHienTai: function () {
      var dk = document.querySelector('[dieu-khien]');
      return dk ? dk.getAttribute('dieu-khien').cheDo : 'du-thuyen';
    },

    dangTrenThuyen: function () { return this.cheDoHienTai() === 'du-thuyen'; },

    // Đổi chế độ: rời thuyền thì ẩn bảng điểm dừng; lên lại thuyền đúng lúc đang neo thì hiện lại
    khiDoiCheDoFn: function (e) {
      this.capNhatNutCamUng();
      if (e.detail.cheDo === 'tu-do') this.bangDiemDung.classList.add('an');
      else if (this.diemDungCuoi) this.hienDiemDung({ detail: this.diemDungCuoi });
      this.capNhatChip();
    },

    // Bảng tên + mô tả ngắn của điểm dừng (khi đeo kính VR: diem-thong-tin.js hiện bảng 3D)
    hienDiemDung: function (e) {
      this.diemDungCuoi = e.detail;
      this.capNhatChip();
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

    // Đầu người xem đang ở trong vùng hang (hầm / khoang / phễu cửa)?
    dangTrongHang: function () {
      var h = HALONG.hangDong, cam = this.el.camera;
      if (!h || !cam) return false;
      var p = this.viTriCam || (this.viTriCam = new THREE.Vector3());
      cam.getWorldPosition(p);
      return h.trong(p) && (p.x - h.S.x) * h.n.x + (p.z - h.S.z) * h.n.z < 0;   // đã qua vách
    },

    // Nội dung chip + nút hành động theo ngữ cảnh. Chỉ ghi vào DOM khi nội dung đổi.
    capNhatChip: function () {
      var tt = HALONG.thuyen, ten, chu, goiY, nhan = '', hanhDong = null;
      var h = HALONG.hangDong, trongHang = this.dangTrongHang();
      if (this.dangTrenThuyen() && tt) {
        var tiep = HALONG.LO_TRINH.diemDung[tt.diemTiep];
        ten = 'Du thuyền';
        chu = tt.trangThai === 'dung'
          ? 'Đang neo · rời bến sau ' + Math.ceil(tt.cho) + ' giây'
          : 'Tiếp theo: ' + tiep.ten + ' · ' + Math.round(tt.conLai) + ' m';
        goiY = 'M: tự do';
        // Đang neo ở điểm Hang Sửng Sốt → mời vào hang
        var dd = this.diemDungCuoi && this.diemDungCuoi.diem;
        if (h && tt.trangThai === 'dung' && dd && dd.vatThe && dd.vatThe.loai === 'bo-hon') {
          nhan = 'Vào hang ▸'; hanhDong = HALONG.vaoHang;
        }
      } else if (trongHang) {
        ten = 'Trong hang';
        chu = 'Hang Sửng Sốt · đảo Bồ Hòn';
        goiY = 'M: lên thuyền';
        nhan = 'Ra khỏi hang ▸'; hanhDong = HALONG.raKhoiHang;
      } else {
        ten = 'Tự do';
        chu = 'bay khám phá vịnh';
        goiY = 'M: lên thuyền';
        // Bay gần cửa hang → nút dịch chuyển vào hang
        if (h && this.viTriCam && this.viTriCam.distanceTo(h.S) < 160) { nhan = 'Vào hang ▸'; hanhDong = HALONG.vaoHang; }
      }
      this.hanhDongChip = hanhDong;
      if (this.chipTen.textContent !== ten) this.chipTen.textContent = ten;
      if (this.chipChu.textContent !== chu) this.chipChu.textContent = chu;
      if (this.chipGoiY.textContent !== goiY) this.chipGoiY.textContent = goiY;
      if (this.chipNut.textContent !== nhan) {
        this.chipNut.textContent = nhan;
        // Trong kính không thấy chip HTML → báo bằng thông báo 3D rằng nút A đang làm được gì
        if (nhan && this.el.is('vr-mode')) HALONG.thongBao('Nút A trên tay cầm: ' + nhan.replace(' ▸', ''));
      }
      this.chipNut.hidden = !nhan;
    },

    /* ---------------- 3. Dịch chuyển vào / ra hang (có chuyển cảnh tối dần) ---------------- */
    taoQuaCauChuyenCanh: function () {
      // BackSide: camera nằm TRONG quả cầu nhỏ → thấy mặt trong; depthTest tắt + renderOrder
      // rất lớn → luôn vẽ sau cùng, đè lên mọi thứ (kể cả khi đeo kính VR)
      var vl = new THREE.MeshBasicMaterial({
        color: 0x000000, transparent: true, opacity: 0, side: THREE.BackSide,
        depthTest: false, depthWrite: false, fog: false
      });
      this.quaCauToi = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 10), vl);
      this.quaCauToi.renderOrder = 9999;
      this.quaCauToi.frustumCulled = false;
      this.quaCauToi.visible = false;
      var camEl = this.el.querySelector('[camera]');
      if (camEl) camEl.object3D.add(this.quaCauToi);
      this.chuyen = null;
    },

    // Tối dần (mặc định 0,35 s) → làm việc 'hamGiua' lúc màn đen → sáng dần (0,5 s).
    // Dịch chuyển tức thời (teleport) bằng tay cầm dùng bản nhanh (0,1 s / 0,18 s): chớp mắt.
    chuyenCanh: function (hamGiua, tToi, tSang) {
      if (this.chuyen || !this.quaCauToi) return false;
      this.chuyen = { pha: 'toi', t: 0, hamGiua: hamGiua, tToi: tToi || 0.35, tSang: tSang || 0.5 };
      this.quaCauToi.visible = true;
      return true;
    },

    capNhatChuyenCanh: function (giay) {
      var c = this.chuyen;
      if (!c) return;
      c.t += giay;
      var vl = this.quaCauToi.material;
      if (c.pha === 'toi') {
        vl.opacity = Math.min(c.t / c.tToi, 1);
        if (c.t >= c.tToi) { c.hamGiua(); c.pha = 'sang'; c.t = 0; }
      } else {
        vl.opacity = 1 - Math.min(c.t / c.tSang, 1);
        if (c.t >= c.tSang) { this.quaCauToi.visible = false; this.chuyen = null; }
      }
    },

    // Đặt người xem: ĐẦU tới 'dauMoi', mặt hướng về 'diemNhin'. Xoay cả rig một góc bằng
    // hiệu số hướng → đúng cho cả chuột (look-controls) lẫn kính VR (hướng đầu do kính quyết định).
    datNguoiXem: function (dauMoi, diemNhin) {
      var rig = document.querySelector('[dieu-khien]'), cam = this.el.camera;
      if (!rig || !cam) return;
      var o = rig.object3D, p = new THREE.Vector3(), q = new THREE.Quaternion();
      o.updateMatrixWorld(true);
      cam.getWorldQuaternion(q);
      var yawHienTai = new THREE.Euler().setFromQuaternion(q, 'YXZ').y;
      var yawMucTieu = Math.atan2(-(diemNhin.x - dauMoi.x), -(diemNhin.z - dauMoi.z));
      o.rotation.y += yawMucTieu - yawHienTai;
      o.updateMatrixWorld(true);
      cam.getWorldPosition(p);
      o.position.add(p.subVectors(dauMoi, p));
    },

    vaoHang: function () {
      var self = this;
      this.chuyenCanh(function () {
        var h = HALONG.hangDong, rig = document.querySelector('[dieu-khien]');
        if (!h || !rig) return;
        if (self.cheDoHienTai() !== 'tu-do') rig.setAttribute('dieu-khien', 'cheDo', 'tu-do');
        rig.components['dieu-khien'].trongHang = true;
        // Đứng giữa lối vào khoang, nhìn về phía cuối khoang (nơi nhiều nhũ đá nhất)
        var dau = h.viTriTrong.clone().setY(h.sanY + 1.6);
        self.datNguoiXem(dau, h.Cc.clone().addScaledVector(h.nVao, 6).setY(h.Cc.y));
        self.capNhatChip();
      });
    },

    raKhoiHang: function () {
      var self = this;
      this.chuyenCanh(function () {
        var rig = document.querySelector('[dieu-khien]');
        if (rig) rig.setAttribute('dieu-khien', 'cheDo', 'du-thuyen');   // về lại boong thuyền
        self.capNhatChip();
      });
    },

    /* ---------------- 4. Bản đồ nhỏ ---------------- */
    // Khung bản đồ (thế giới → điểm ảnh): hình vuông bao lộ trình + các cảnh tham quan
    tinhKhungBanDo: function () {
      var LT = HALONG.LO_TRINH, xs = [], zs = [];
      LT.duongCong.getSpacedPoints(80).forEach(function (p) { xs.push(p.x); zs.push(p.z); });
      LT.diemDung.forEach(function (d) { if (d.vatThe) { xs.push(d.vatThe.x); zs.push(d.vatThe.z); } });
      var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
      var z0 = Math.min.apply(null, zs), z1 = Math.max.apply(null, zs);
      this.khung = { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, co: Math.max(x1 - x0, z1 - z0) + 120 };
    },

    raBanDo: function (x, z, kq) {
      var k = this.khung, w = this.banDo.width;
      kq.x = (x - k.cx) / k.co * w + w / 2;
      kq.y = (z - k.cz) / k.co * w + w / 2;          // trên bản đồ: phía trên = hướng -Z
      return kq;
    },

    // Lớp nền: vẽ 1 lần (và khi đổi cỡ) ra canvas phụ
    veNenBanDo: function () {
      var w = this.banDo.width, s = w / this.khung.co;
      var nen = this.nenBanDo || (this.nenBanDo = document.createElement('canvas'));
      nen.width = nen.height = w;
      var ctx = nen.getContext('2d'), p = { x: 0, y: 0 }, self = this;
      var nuoc = ctx.createLinearGradient(0, 0, 0, w);
      nuoc.addColorStop(0, '#123c4f');
      nuoc.addColorStop(1, '#0b2a3a');
      ctx.fillStyle = nuoc;
      ctx.fillRect(0, 0, w, w);
      // Đảo: elip đúng bán trục + góc xoay như elip va chạm. Trên canvas trục y hướng +Z,
      // nên trục riêng của đảo (cos, -sin) ứng với góc quay -xoay
      ctx.fillStyle = '#7f9468';
      ctx.strokeStyle = 'rgba(20, 35, 25, 0.6)';
      ctx.lineWidth = Math.max(1, w / 220);
      (HALONG.dsDao || []).forEach(function (d) {
        self.raBanDo(d.x, d.z, p);
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, Math.max((d.rX || d.rChan) * s, 1.2), Math.max((d.rZ || d.rChan) * s, 1.2), -(d.xoay || 0), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
      // Làng chài: các ô nhà nhỏ
      ctx.fillStyle = '#e8b37c';
      (HALONG.langChai ? HALONG.langChai.cacNha : []).forEach(function (n) {
        self.raBanDo(n.x, n.z, p);
        var c = Math.max(n.r * s * 1.3, 2);
        ctx.fillRect(p.x - c / 2, p.y - c / 2, c, c);
      });
      // Lộ trình: đường nét đứt
      ctx.strokeStyle = 'rgba(255, 178, 107, 0.75)';
      ctx.lineWidth = Math.max(1.5, w / 130);
      ctx.setLineDash([w / 40, w / 60]);
      ctx.beginPath();
      HALONG.LO_TRINH.duongCong.getSpacedPoints(160).forEach(function (q, i) {
        self.raBanDo(q.x, q.z, p);
        if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
      });
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
      // Cửa hang: vòm tím
      var h = HALONG.hangDong;
      if (h) {
        this.raBanDo(h.S.x, h.S.z, p);
        ctx.strokeStyle = '#c79bff';
        ctx.lineWidth = Math.max(2, w / 90);
        ctx.beginPath();
        ctx.arc(p.x, p.y, w / 45, Math.PI, 0);
        ctx.stroke();
      }
      // Điểm dừng: chấm cam có số thứ tự
      var r = Math.max(5, w / 26);
      ctx.font = '700 ' + Math.round(r * 1.25) + 'px "Segoe UI", Roboto, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      HALONG.LO_TRINH.diemDung.forEach(function (d, i) {
        var q = HALONG.LO_TRINH.duongCong.getPointAt(d.s / HALONG.LO_TRINH.doDai);
        self.raBanDo(q.x, q.z, p);
        ctx.fillStyle = '#ffb26b';
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2a1d3d';
        ctx.fillText(String(i + 1), p.x, p.y + r * 0.06);
      });
      // Chữ "B" (hướng Bắc quy ước = phía trên bản đồ)
      ctx.fillStyle = 'rgba(253, 243, 231, 0.85)';
      ctx.fillText('B ▲', w - r * 2.2, r * 1.6);
    },

    veBanDo: function () {
      var c = this.banDo;
      if (c.classList.contains('an') || !HALONG.LO_TRINH || !HALONG.thuyen) return;
      // Cỡ canvas theo cỡ VÙNG NỘI DUNG thật (CSS đổi theo màn hình) × mật độ điểm ảnh.
      // clientWidth không tính viền 1px của .hud-khung (getBoundingClientRect thì có → canvas
      // to hơn 2px rồi bị co lại khi hiển thị → nét mờ)
      var rong = c.clientWidth;
      if (!rong) return;
      var w = Math.round(rong * Math.min(window.devicePixelRatio || 1, 2));
      if (!this.khung) this.tinhKhungBanDo();
      if (c.width !== w) { c.width = c.height = w; this.veNenBanDo(); }
      var ctx = c.getContext('2d'), p = { x: 0, y: 0 }, tt = HALONG.thuyen;
      ctx.drawImage(this.nenBanDo, 0, 0);

      // Thuyền: tam giác trắng, mũi theo hướng chạy (hướng tiến = (-sin goc, -cos goc))
      this.raBanDo(tt.viTri.x, tt.viTri.z, p);
      var l = w / 22, fx = -Math.sin(tt.goc), fz = -Math.cos(tt.goc);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#2a1d3d';
      ctx.lineWidth = Math.max(1, w / 200);
      ctx.beginPath();
      ctx.moveTo(p.x + fx * l, p.y + fz * l);
      ctx.lineTo(p.x - fx * l * 0.7 - fz * l * 0.5, p.y - fz * l * 0.7 + fx * l * 0.5);
      ctx.lineTo(p.x - fx * l * 0.7 + fz * l * 0.5, p.y - fz * l * 0.7 - fx * l * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Người xem: chấm xanh + hình quạt hướng nhìn (ra ngoài bản đồ thì ghim ở mép)
      var cam = this.el.camera;
      if (!cam) return;
      var vt = this.viTriCam || (this.viTriCam = new THREE.Vector3());
      var f = this.huongCam || (this.huongCam = new THREE.Vector3());
      cam.getWorldPosition(vt);
      cam.getWorldDirection(f);
      this.raBanDo(vt.x, vt.z, p);
      var le = w * 0.04, ngoai = p.x < le || p.y < le || p.x > w - le || p.y > w - le;
      p.x = Math.min(Math.max(p.x, le), w - le);
      p.y = Math.min(Math.max(p.y, le), w - le);
      var goc = Math.atan2(f.z, f.x), r = w / 7;
      var quat = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      quat.addColorStop(0, 'rgba(110, 200, 255, 0.55)');
      quat.addColorStop(1, 'rgba(110, 200, 255, 0)');
      ctx.fillStyle = quat;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.arc(p.x, p.y, r, goc - 0.55, goc + 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = ngoai ? '#ffe08a' : '#6ec8ff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(3, w / 45), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0b2a3a';
      ctx.stroke();
    },

    /* ---------------- 5. Chụp ảnh ---------------- */
    chupAnh: function () {
      var sc = this.el, r = sc.renderer;
      if (!r || !sc.camera) return;
      if (r.xr && r.xr.isPresenting) return;          // đang đeo kính: không chụp kiểu này được
      if (HALONG.daBatDau === false) return;           // còn ở màn hình chờ: khung cảnh đang ẩn
      // Canvas WebGL không giữ ảnh sau khi hiển thị (preserveDrawingBuffer: false – để nhanh hơn)
      // → vẽ lại 1 khung rồi chép NGAY sang canvas 2D trong cùng lượt chạy
      r.render(sc.object3D, sc.camera);
      var nguon = sc.canvas, anh = document.createElement('canvas');
      anh.width = nguon.width;
      anh.height = nguon.height;
      var ctx = anh.getContext('2d');
      ctx.drawImage(nguon, 0, 0);
      // Chữ ký góc dưới phải
      var co = Math.max(14, Math.round(anh.height / 42));
      ctx.font = '600 ' + co + 'px "Segoe UI", Roboto, Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = co / 3;
      ctx.fillStyle = 'rgba(255, 240, 225, 0.92)';
      ctx.fillText('Vịnh Hạ Long VR', anh.width - co, anh.height - co * 0.8);

      var d = new Date(), hai = function (n) { return (n < 10 ? '0' : '') + n; };
      var tenFile = 'vinh-ha-long-' + d.getFullYear() + hai(d.getMonth() + 1) + hai(d.getDate()) +
        '-' + hai(d.getHours()) + hai(d.getMinutes()) + hai(d.getSeconds()) + '.png';
      var self = this;
      anh.toBlob(function (blob) {
        if (!blob) { self.hienThongBao('Không chụp được ảnh'); return; }
        var url = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = url;
        a.download = tenFile;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
        self.hienThongBao('📷 Đã lưu ảnh ' + tenFile);
      }, 'image/png');
      // Nháy trắng nhẹ như máy ảnh
      document.body.classList.add('nhay-chup');
      setTimeout(function () { document.body.classList.remove('nhay-chup'); }, 180);
    },

    hienThongBao: function (chu) {
      var tb = this.thongBao;
      tb.textContent = chu;
      tb.classList.remove('an');
      clearTimeout(this.henGioThongBao);
      this.henGioThongBao = setTimeout(function () { tb.classList.add('an'); }, 2600);
    },

    /* ---------------- 8. Chất lượng đồ hoạ ---------------- */
    doiChatLuong: function () {
      var moi = HALONG.chatLuong.ten === 'cao' ? 'thap' : 'cao';
      HALONG.chatLuong.datMuc(moi, true);
      HALONG.thongBao(moi === 'cao' ? 'Đồ hoạ: Cao (đẹp nhất)' : 'Đồ hoạ: Thấp (mượt hơn trên máy yếu)');
    },

    capNhatNutChatLuong: function () {
      var cao = HALONG.chatLuong.ten === 'cao';
      this.nutChatLuong.textContent = cao ? '⚙ Cao' : '⚙ Thấp';
      this.nutChatLuong.title = 'Chất lượng đồ hoạ: ' + (cao ? 'Cao' : 'Thấp') + ' (Q để đổi)';
      this.nutChatLuong.setAttribute('aria-label', this.nutChatLuong.title);
    },

    // Vài giây đầu sau khi bấm Bắt đầu: FPS trung bình < 38 → tự hạ xuống Thấp (1 lần).
    // Bỏ 2 giây đầu (đang nạp texture, biên dịch nốt); không đo khi đeo kính (kính tự giữ nhịp
    // khung hình) hoặc khi người dùng đã tự chọn mức.
    doFpsDauTien: function (fps) {
      var d = this.doFps;
      if (d.xong || !HALONG.daBatDau || this.el.is('vr-mode') || document.hidden) return;
      if (HALONG.chatLuong.daChonTay || HALONG.chatLuong.ten !== 'cao') { d.xong = true; return; }
      d.mau.push(fps);
      if (d.mau.length < 16) return;                       // 16 lần × 0,5 s = 8 giây
      d.xong = true;
      var tb = d.mau.slice(4).reduce(function (a, b) { return a + b; }, 0) / (d.mau.length - 4);
      if (tb < 38) {
        HALONG.chatLuong.datMuc('thap');
        HALONG.thongBao('Máy chạy chưa mượt (' + Math.round(tb) + ' FPS) → đã chuyển đồ hoạ sang Thấp. Bấm ⚙ hoặc Q để đổi lại.');
      }
    },

    /* ---------------- 9. Thông báo 3D (trong kính VR) ---------------- */
    taoThongBao3D: function () {
      var c = this.canvasTB = document.createElement('canvas');
      c.width = 1024; c.height = 160;
      var tex = this.texTB = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      // Gắn vào camera: luôn ở trước mắt, hơi thấp; depthTest tắt → không bị vật gì che
      var vl = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, fog: false, toneMapped: false });
      this.thongBao3D = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.15), vl);
      this.thongBao3D.position.set(0, -0.3, -1.3);
      this.thongBao3D.renderOrder = 9500;
      this.thongBao3D.visible = false;
      this.thongBao3D.frustumCulled = false;
      var camEl = this.el.querySelector('[camera]');
      if (camEl) camEl.object3D.add(this.thongBao3D);
      this.conLaiTB3D = 0;
    },

    hienThongBao3D: function (chu) {
      var c = this.canvasTB, ctx = c.getContext('2d');
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.fillStyle = 'rgba(22, 16, 42, 0.9)';
      ctx.beginPath();
      ctx.moveTo(80, 10); ctx.arcTo(1014, 10, 1014, 150, 70); ctx.arcTo(1014, 150, 10, 150, 70);
      ctx.arcTo(10, 150, 10, 10, 70); ctx.arcTo(10, 10, 1014, 10, 70); ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(255, 178, 107, 0.8)';
      ctx.stroke();
      ctx.fillStyle = '#fdf3e7';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (var co = 46; co > 24; co -= 2) {          // thu nhỏ chữ cho vừa 1 dòng
        ctx.font = '600 ' + co + 'px "Segoe UI", Roboto, "Noto Sans", Arial, sans-serif';
        if (ctx.measureText(chu).width < 940) break;
      }
      ctx.fillText(chu, 512, 82);
      this.texTB.needsUpdate = true;
      this.thongBao3D.visible = true;
      this.conLaiTB3D = 2.2;                           // giây
    },

    /* ---------------- 10. Điều khiển cảm ứng ---------------- */
    taoDieuKhienCamUng: function () {
      var self = this;
      // Giá trị điều khiển ảo dieu-khien.js đọc mỗi khung: x, y ∈ [-1, 1] như cần gạt tay cầm
      // (y < 0 = đi tới), len: +1 bay lên / -1 hạ xuống
      HALONG.dieuKhienAo = { x: 0, y: 0, len: 0 };
      var camUng = AFRAME.utils.device.isMobile() ||
        (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
      if (!camUng) return;
      document.body.classList.add('cam-ung');
      // Bảng hướng dẫn toàn phím tắt bàn phím, lại đè lên chip (chip lên trên trong bố cục cảm ứng)
      this.bangHuongDan.classList.add('an');
      var khung = this.khungCamUng = document.createElement('div');
      khung.id = 'dieu-khien-cam-ung';
      khung.innerHTML = [
        '<div id="can-ao" aria-label="Cần điều khiển: kéo để đi lại"><div id="num-can-ao"></div></div>',
        '<div id="nut-cam-ung">',
        '<button type="button" id="nut-bay-len" aria-label="Bay lên">▲</button>',
        '<button type="button" id="nut-bay-xuong" aria-label="Hạ xuống">▼</button>',
        '<button type="button" id="nut-doi-che-do"></button>',
        '</div>'
      ].join('');
      document.body.appendChild(khung);

      // Cần ảo: dùng Pointer Events (chạy cho cả ngón tay lẫn chuột) + giữ con trỏ
      // (setPointerCapture) → kéo ra ngoài vòng tròn vẫn điều khiển được
      var can = khung.querySelector('#can-ao'), num = khung.querySelector('#num-can-ao');
      var ao = HALONG.dieuKhienAo, idGiu = null, tam = { x: 0, y: 0 }, R = 44;
      function capNhat(e) {
        var dx = e.clientX - tam.x, dy = e.clientY - tam.y, l = Math.hypot(dx, dy);
        if (l > R) { dx *= R / l; dy *= R / l; }
        ao.x = dx / R; ao.y = dy / R;
        num.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      }
      can.addEventListener('pointerdown', function (e) {
        var hop = can.getBoundingClientRect();
        tam.x = hop.left + hop.width / 2; tam.y = hop.top + hop.height / 2;
        idGiu = e.pointerId;
        can.setPointerCapture(e.pointerId);
        capNhat(e);
        e.preventDefault();
      });
      can.addEventListener('pointermove', function (e) { if (e.pointerId === idGiu) capNhat(e); });
      function tha(e) {
        if (e.pointerId !== idGiu) return;
        idGiu = null; ao.x = 0; ao.y = 0;
        num.style.transform = '';
      }
      can.addEventListener('pointerup', tha);
      can.addEventListener('pointercancel', tha);

      // Nút bay lên / xuống: giữ để bay (chỉ hiện ở chế độ Tự do)
      [['#nut-bay-len', 1], ['#nut-bay-xuong', -1]].forEach(function (cap) {
        var nut = khung.querySelector(cap[0]);
        nut.addEventListener('pointerdown', function (e) { ao.len = cap[1]; nut.setPointerCapture(e.pointerId); e.preventDefault(); });
        ['pointerup', 'pointercancel'].forEach(function (ten) { nut.addEventListener(ten, function () { ao.len = 0; }); });
      });
      this.nutDoiCheDo = khung.querySelector('#nut-doi-che-do');
      this.nutDoiCheDo.addEventListener('click', function () {
        var rig = document.querySelector('[dieu-khien]');
        if (rig && HALONG.daBatDau) rig.components['dieu-khien'].doiCheDo();
      });
      this.capNhatNutCamUng();
    },

    // Nhãn nút đổi chế độ + ẩn / hiện nút bay theo chế độ hiện tại
    capNhatNutCamUng: function () {
      if (!this.nutDoiCheDo) return;
      var tuDo = this.cheDoHienTai() === 'tu-do';
      this.nutDoiCheDo.textContent = tuDo ? '⛵ Lên thuyền' : '🕊 Bay tự do';
      document.body.classList.toggle('che-do-tu-do', tuDo);
    },

    /* ---------------- 6. Mỗi khung hình ---------------- */
    tick: function (t, dt) {
      if (!dt) return;
      this.capNhatChuyenCanh(Math.min(dt, 100) / 1000);
      if (this.conLaiTB3D > 0) {
        this.conLaiTB3D -= dt / 1000;
        if (this.conLaiTB3D <= 0 || !this.el.is('vr-mode')) { this.conLaiTB3D = 0; this.thongBao3D.visible = false; }
      }
      this.capNhatHuongNhin();
      // Bản đồ: 10 lần/giây là đủ mượt cho chấm di chuyển chậm
      this.demBanDo += dt;
      if (this.demBanDo >= 100) { this.demBanDo = 0; this.veBanDo(); }

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
      this.doFpsDauTien(tk.fps);
      this.capNhatChip();

      this.soKhung = 0;
      this.thoiGianDem = 0;
    }
  });
})();
