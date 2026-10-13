/* =========================================================================
 * diem-thong-tin.js – ĐIỂM THÔNG TIN + BẢNG THUYẾT MINH 3D (component "diem-thong-tin")
 * -------------------------------------------------------------------------
 * 1. BIỂU TƯỢNG "i": vòng tròn phát sáng lơ lửng gần mỗi cảnh (đảo, hang, làng
 *    chài...). Là tấm phẳng tự quay mặt về camera (billboard) với texture vẽ bằng
 *    canvas. Không dùng THREE.Sprite vì raycaster của A-Frame không gắn camera cho
 *    tia → Sprite.raycast báo lỗi. Cỡ biểu tượng tăng theo khoảng cách để ở xa vẫn
 *    bấm được, ở gần không quá to.
 * 2. BẤM: index.html bật cursor="rayOrigin: mouse" + raycaster chỉ xét class
 *    .diem-tt → A-Frame bắn tia từ chuột / ngón tay (Mốc 5: tia tay cầm VR) và phát
 *    sự kiện 'click' lên entity bị trúng.
 * 3. BẢNG THUYẾT MINH 3D: 1 tấm phẳng dùng chung, chữ tiếng Việt vẽ lên canvas
 *    (font hệ thống có sẵn dấu tiếng Việt) rồi làm texture. Bảng hiện trước mặt
 *    người xem, nằm cố định trong không gian (không dính theo đầu → đỡ chóng mặt
 *    khi đeo kính). Đọc được cả trong kính VR (khung HTML thì không).
 *    Bấm vào bảng để đóng; bảng của hang có nút "Vào hang ▸" / "Ra khỏi hang ▸"
 *    (nhận biết vùng nút bằng toạ độ UV của điểm bị tia chạm).
 * 4. ĐEO KÍNH VR: tới điểm dừng → tự hiện bảng thuyết minh 3D của điểm dừng
 *    (thay cho bảng HTML không nhìn thấy trong kính).
 * Nội dung: đã được tra cứu và đối chiếu nhiều nguồn; ý nào chưa chắc chắn thì
 * viết chung chung và đánh dấu "TODO cần kiểm tra" ở chú thích bên cạnh.
 * ========================================================================= */
(function () {
  'use strict';

  var HALONG = window.HALONG;
  var FONT = '"Segoe UI", Roboto, "Noto Sans", "Helvetica Neue", Arial, sans-serif';

  /* ---------- Nội dung thuyết minh ---------- */
  var THUYET_MINH = {
    // Nguồn: Ban quản lý vịnh Hạ Long (halongbay.com.vn), UNESCO whc.unesco.org/en/list/672,
    // Tuổi Trẻ (30 năm di sản), Bộ VHTTDL (mở rộng 2023).
    // TODO cần kiểm tra: 1.553 km² / 1.969 đảo là số của Ban quản lý cho toàn vịnh; UNESCO ghi
    // "hơn 1.600 đảo" cho vùng di sản. Muốn an toàn tuyệt đối thì đổi thành "gần 2.000 hòn đảo".
    'vinh-ha-long': {
      tieuDe: 'Vịnh Hạ Long',
      noiDung: 'Vịnh Hạ Long thuộc Quảng Ninh, nằm trong vịnh Bắc Bộ, rộng 1.553 km² với 1.969 hòn đảo. ' +
        'Hạ Long nghĩa là rồng đáp xuống: truyền thuyết kể rồng mẹ cùng đàn con xuống giúp người Việt đánh giặc, nhả ngọc hóa thành đảo đá. ' +
        'UNESCO công nhận vịnh là Di sản thiên nhiên thế giới năm 1994 về giá trị thẩm mỹ, năm 2000 về địa chất, địa mạo. ' +
        'Năm 2023, di sản mở rộng thành Vịnh Hạ Long – Quần đảo Cát Bà.'
    },
    // Nguồn: hồ sơ UNESCO (whc.unesco.org/document/154005), NASA Earth Observatory, Ban quản lý
    // vịnh Hạ Long, báo Nhân Dân. TODO cần kiểm tra: tuổi chính xác của đá vôi (Carbon – Permi,
    // NASA ghi 390–260 triệu năm) và độ cao mực nước biển dâng → panel chỉ nói chung.
    'da-voi': {
      tieuDe: 'Đảo đá vôi và địa hình karst',
      noiDung: 'Vùng vịnh có lịch sử địa chất hơn 500 triệu năm, với những tầng đá vôi rất dày. ' +
        'Suốt khoảng 20 triệu năm, trong khí hậu nóng ẩm, nước mưa hòa tan đá vôi, tạo nên các cụm đỉnh hình nón (fengcong) và tháp đá riêng lẻ (fenglin). ' +
        'Sau thời kỳ băng hà cuối, nước biển dâng nhấn chìm vùng karst, chỉ còn các đỉnh núi nhô lên thành đảo. ' +
        'Sóng biển khoét vào chân đảo, tạo nên những ngấn biển hình hàm ếch.'
    },
    // Nguồn: Báo Quảng Ninh (60 năm Bác Hồ và Ghéc-man Ti-tốp thăm vịnh), quangninh.gov.vn,
    // halongbay.com.vn. Ngày 22/1/1962 theo các nguồn chính thức của Quảng Ninh.
    // TODO cần kiểm tra: tên cũ Cát Nàng (gần như chỉ Báo Quảng Ninh nêu); số bậc lên đỉnh
    // không thống nhất (400–450) → chỉ ghi "hàng trăm bậc".
    'ti-top': {
      tieuDe: 'Đảo Ti Tốp',
      noiDung: 'Đảo Ti Tốp từng có tên là Cát Nàng. Ngày 22/1/1962, Chủ tịch Hồ Chí Minh cùng nhà du hành vũ trụ Liên Xô Gherman Titov thăm vịnh Hạ Long và lên đảo. ' +
        'Bác đề nghị lấy tên Titov đặt cho đảo để ghi nhớ chuyến thăm. Đảo có bãi tắm hình vầng trăng khuyết ôm lấy chân núi. ' +
        'Leo hàng trăm bậc thang lên đỉnh, du khách được ngắm toàn cảnh vịnh từ đài vọng cảnh.'
    },
    // Nguồn: Ban quản lý vịnh Hạ Long (halongbay.com.vn/places/28-hang-sung-sot), Vietnam News,
    // Thanh Niên ("nhà hát opera" trong hang), Tuổi Trẻ / Báo Quảng Ninh (ngựa, gươm Thánh Gióng).
    // TODO cần kiểm tra: năm 1901 và người đặt tên (có nguồn ghi "thế kỷ 19"); tên Pháp viết
    // 2 kiểu (Grotte des Surprises / de la surprise); số ngăn hang (2, 3 hay 4) → không đưa vào.
    'hang-sung-sot': {
      tieuDe: 'Hang Sửng Sốt',
      noiDung: 'Hang Sửng Sốt nằm trên đảo Bồ Hòn, giữa vịnh Hạ Long. Theo nhiều tài liệu, người Pháp đến đây năm 1901 và gọi hang là “Grotte des Surprises”, tức hang của sự ngạc nhiên. ' +
        'Hang rộng hơn 10.000 mét vuông, ngăn đầu được ví như một nhà hát lớn. ' +
        'Nhũ đá tạo nhiều hình thù, như con ngựa và thanh gươm gắn với truyền thuyết Thánh Gióng. ' +
        'Lối đi lát đá cùng hệ thống đèn nhiều màu giúp du khách ngắm hang dễ dàng.',
      hanhDong: { nhan: 'Vào hang ▸', ham: 'vaoHang' }
    },
    // Nguồn: US National Park Service (nps.gov – speleothems), Wikipedia "Stalactite", EBSCO.
    // TODO cần kiểm tra: 0,1 mm/năm chỉ là giá trị điển hình toàn cầu (0,1–0,25 mm/năm, nơi nhanh
    // nhất ~3 mm/năm); chưa có số đo riêng cho hang ở vịnh Hạ Long.
    'nhu-da': {
      tieuDe: 'Thạch nhũ và măng đá',
      noiDung: 'Nước mưa thấm qua đất, hấp thụ thêm CO2 nên có tính axit yếu và hòa tan canxi cacbonat (CaCO3) trong đá vôi. ' +
        'Khi nước rỉ ra ở trần hang, CO2 thoát vào không khí khiến CaCO3 kết tủa thành từng lớp mỏng. ' +
        'Thạch nhũ treo rủ từ trần xuống, măng đá mọc từ nền lên; khi hai khối nối liền sẽ thành cột đá. ' +
        'Chúng lớn rất chậm, thường chỉ khoảng 0,1 mm mỗi năm, nên một khối lớn cần hàng nghìn năm.',
      hanhDong: { nhan: 'Ra khỏi hang ▸', ham: 'raKhoiHang' }
    },
    // Nguồn: Ban quản lý vịnh Hạ Long (Trung tâm văn hoá nổi Cửa Vạn), Tuổi Trẻ, Thanh Tra (2012),
    // Báo Quảng Ninh (176 hộ), VOV5, Tạp chí ĐH Hải Phòng (quyết định di dời 6/2014).
    // TODO cần kiểm tra: số hộ không thống nhất (167–176, có nơi > 200) → "gần 200 hộ"; trung tâm
    // văn hoá nổi tạm dừng đón khách từ 25/4/2024 (bão Yagi 9/2024) → viết thì quá khứ "ra đời".
    'cua-van': {
      tieuDe: 'Làng chài Cửa Vạn',
      noiDung: 'Cửa Vạn là làng chài nổi giữa vịnh Hạ Long, cách cảng tàu du lịch khoảng 20 km. ' +
        'Năm 2012, trang Journeyetc.com đưa Cửa Vạn vào danh sách 16 làng cổ đẹp nhất thế giới. ' +
        'Làng từng có gần 200 hộ ngư dân; từ năm 2014, phần lớn chuyển lên bờ để bảo vệ di sản. ' +
        'Năm 2006, Trung tâm văn hóa nổi Cửa Vạn ra đời để giới thiệu đời sống ngư dân. Du khách thường ngồi đò hoặc chèo kayak thăm làng.'
    },
    // Nguồn: World Monuments Fund (4 làng chài cổ), VietnamNet, Vietnam News, Thanh Tra, VOV,
    // Dân Trí (lớp học nổi). Bỏ "câu mực đêm", "thúng chai" vì chỉ có trang du lịch nêu.
    'nuoi-ca': {
      tieuDe: 'Đời sống trên nhà bè',
      noiDung: 'Nhiều ngư dân vịnh Hạ Long từng sống trên nhà bè, hợp thành các làng chài nổi như Cửa Vạn, Ba Hang. ' +
        'Họ thả lưới, buông câu và nuôi cá trong lồng bè cạnh nhà. Thuyền nan chèo tay là phương tiện đi lại quen thuộc giữa các nhà bè. ' +
        'Làng Cửa Vạn từng có lớp học nổi cho trẻ em. ' +
        'Từ năm 2014, phần lớn hộ dân được đưa lên bờ, một số nhà bè được giữ lại phục vụ du lịch.'
    },
    // Nguồn: vietnam.travel, Nhân Dân ("Những kỳ quan trên vịnh Hạ Long"), Báo Văn Hoá (khảo sát của
    // Viện Khoa học Địa chất và Khoáng sản), Pháp Luật, Người Quan Sát (8/2023).
    // TODO cần kiểm tra: chiều cao (10 / 12 / 13,9 m) → "hơn 10 mét"; quy định giảm tốc còn hiệu lực?
    // Lưu ý: tờ 200.000 đồng in hòn Đỉnh Hương, KHÔNG phải hòn Gà Chọi.
    'ga-choi': {
      tieuDe: 'Hòn Gà Chọi (Trống Mái)',
      noiDung: 'Hòn Gà Chọi, còn gọi là hòn Trống Mái, gồm hai khối đá vôi đứng đối diện nhau như một đôi gà trống mái. ' +
        'Cụm đá cao hơn 10 mét, chân hẹp hơn thân nên trông rất chênh vênh. Hình ảnh đôi gà đá được dùng trên logo vịnh Hạ Long. ' +
        'Do sóng và thủy triều bào mòn chân đá, Quảng Ninh đã nghiên cứu giải pháp bảo tồn và yêu cầu tàu thuyền giảm tốc, giữ khoảng cách khi đi qua.'
    },
    // Nguồn: Báo Văn Hoá, VTC News, Vietnam News ("Red Hạ Long sails revive forgotten craft"),
    // VnExpress, Thanh Niên, VOV (vỏ cây đâng), Dân Trí / VietnamPlus (phục dựng 2026).
    // TODO cần kiểm tra: chi tiết nan tre trên buồm (chủ yếu theo Vietnam News); thuyền phục dựng
    // còn chạy ở thời điểm xem không. Mô hình trong cảnh là thuyền du lịch dáng buồm cánh dơi nâu.
    'thuyen-buom': {
      tieuDe: 'Thuyền buồm nâu',
      noiDung: 'Thuyền ba vách là thuyền buồm truyền thống từng quen thuộc trên vịnh Hạ Long, thân ghép từ ba tấm ván. ' +
        'Thuyền có hai cánh buồm hình cánh dơi căng trên các nan tre, có thể chạy ngược gió. ' +
        'Ngày xưa, buồm được nhuộm bằng củ nâu và vỏ cây đâng ở rừng ngập mặn để bền trước nắng gió, nước mặn và có sắc nâu đặc trưng. ' +
        'Năm 2026, loại thuyền này được phục dựng để chở du khách, nhưng dùng buồm đỏ.'
    }
  };

  /* ---------- Vẽ chữ lên canvas: tự xuống dòng theo bề rộng ---------- */
  function chiaDong(ctx, chu, rong) {
    var dong = [], cau = chu.split('\n');
    cau.forEach(function (doan) {
      var tu = doan.split(' '), hienTai = '';
      tu.forEach(function (t) {
        var thu = hienTai ? hienTai + ' ' + t : t;
        if (ctx.measureText(thu).width > rong && hienTai) { dong.push(hienTai); hienTai = t; }
        else hienTai = thu;
      });
      dong.push(hienTai);
    });
    return dong;
  }

  function hinhChuNhatBo(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ---------- Texture biểu tượng "i" (dùng chung cho mọi điểm) ---------- */
  function taoTextureBieuTuong() {
    var c = document.createElement('canvas');
    c.width = c.height = 128;
    var ctx = c.getContext('2d');
    var quang = ctx.createRadialGradient(64, 64, 20, 64, 64, 64);   // quầng sáng mờ quanh vòng
    quang.addColorStop(0, 'rgba(255, 178, 107, 0.55)');
    quang.addColorStop(1, 'rgba(255, 178, 107, 0)');
    ctx.fillStyle = quang;
    ctx.fillRect(0, 0, 128, 128);
    ctx.beginPath();
    ctx.arc(64, 64, 38, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(30, 20, 48, 0.92)';
    ctx.fill();
    ctx.lineWidth = 7;
    ctx.strokeStyle = '#ffb26b';
    ctx.stroke();
    ctx.fillStyle = '#ffe6c8';
    ctx.font = '700 52px Georgia, "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('i', 64, 67);
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  AFRAME.registerComponent('diem-thong-tin', {
    init: function () {
      this.dsDiem = [];
      this.viTriCam = new THREE.Vector3();
      this.qCam = new THREE.Quaternion();
      this.tam = new THREE.Vector3();
      HALONG.THUYET_MINH = THUYET_MINH;
      HALONG.diemThongTin = { mo: this.moBang.bind(this), dong: this.dongBang.bind(this) };

      this.khiPhim = function (e) {
        if (e.code === 'Escape' && this.bangDangMo) this.dongBang();
      }.bind(this);
      window.addEventListener('keydown', this.khiPhim);
      var sceneEl = this.el.sceneEl;
      this.khiDenDiem = this.khiDenDiemDung.bind(this);
      this.khiRoiDiem = function () { if (this.bangDiemDung) this.dongBang(); }.bind(this);
      sceneEl.addEventListener('den-diem-dung', this.khiDenDiem);
      sceneEl.addEventListener('roi-diem-dung', this.khiRoiDiem);

      // Vị trí các điểm cần dữ liệu của đảo, làng, hang → dựng khi cảnh đã nạp xong
      if (sceneEl.hasLoaded) this.dung();
      else sceneEl.addEventListener('loaded', this.dung.bind(this), { once: true });
    },

    remove: function () {
      var sceneEl = this.el.sceneEl;
      window.removeEventListener('keydown', this.khiPhim);
      sceneEl.removeEventListener('den-diem-dung', this.khiDenDiem);
      sceneEl.removeEventListener('roi-diem-dung', this.khiRoiDiem);
      while (this.el.firstChild) this.el.removeChild(this.el.firstChild);
    },

    /* ---------- Vị trí từng điểm (toạ độ thế giới), tính từ dữ liệu khung cảnh ---------- */
    tinhViTri: function () {
      var LT = HALONG.LO_TRINH, ds = [], dd = LT.diemDung;
      function vatThe(loai) { for (var i = 0; i < dd.length; i++) if (dd[i].vatThe && dd[i].vatThe.loai === loai) return dd[i]; return null; }
      function dao(x, z) {             // đảo (trong danh sách va chạm) gần (x, z) nhất
        var tot = null, kc = Infinity;
        (HALONG.dsDao || []).forEach(function (d) { var k = Math.hypot(d.x - x, d.z - z); if (k < kc) { kc = k; tot = d; } });
        return tot;
      }
      // Điểm cạnh 1 vật thể, lệch về phía điểm dừng (để từ thuyền nhìn thấy, không bị khuất)
      function veoPhiaDiemDung(vt, diem, khoang, y) {
        var dx = diem.x - vt.x, dz = diem.z - vt.z, l = Math.hypot(dx, dz) || 1;
        return new THREE.Vector3(vt.x + dx / l * khoang, y, vt.z + dz / l * khoang);
      }
      // 1) Toàn cảnh vịnh: lơ lửng trên mặt nước, chếch trái phía trước điểm xuất phát
      var p0 = LT.duongCong.getPointAt(0);
      ds.push({ id: 'vinh-ha-long', viTri: new THREE.Vector3(p0.x - 16, 9, p0.z - 26) });
      // 2) Đá vôi: đảo thường gần lộ trình nhất giữa điểm 1 và 2
      var giua = LT.duongCong.getPointAt((dd[0].s + dd[1].s) / 2 / LT.doDai);
      var dv = dao(giua.x, giua.z);
      if (dv) ds.push({ id: 'da-voi', viTri: veoPhiaDiemDung(dv, giua, (dv.rChan || 10) + 3, 8) });
      // 3) Ti Tốp: phía bãi cát (quay về điểm dừng)
      var tt = vatThe('ti-top'), daoTT = tt && dao(tt.vatThe.x, tt.vatThe.z);
      if (daoTT) ds.push({ id: 'ti-top', viTri: veoPhiaDiemDung(daoTT, tt, daoTT.rChan + 4, 9) });
      // 4) Hang Sửng Sốt: phía trên cửa hang; 5) trong khoang hang
      var h = HALONG.hangDong;
      if (h) {
        ds.push({ id: 'hang-sung-sot', viTri: h.S.clone().addScaledVector(h.n, 8).setY(14) });
        ds.push({ id: 'nhu-da', viTri: h.Cc.clone().addScaledVector(h.nVao, 2).setY(h.sanY + 3.4), trongHang: true });
      }
      // 6) Làng chài; 7) lồng bè nuôi cá
      var L = HALONG.langChai;
      if (L) {
        ds.push({ id: 'cua-van', viTri: new THREE.Vector3(L.x, 10, L.z) });
        if (L.diem) { var lb = L.diem(-6, -16); ds.push({ id: 'nuoi-ca', viTri: new THREE.Vector3(lb.x, 4.2, lb.z) }); }
      }
      // 8) Hòn Gà Chọi: trên đỉnh 2 hòn đá
      var gc = vatThe('ga-choi');
      if (gc) {
        var cao = 0;
        (HALONG.vatCan || []).forEach(function (o) { if (Math.hypot(o.x - gc.vatThe.x, o.z - gc.vatThe.z) < 12) cao = Math.max(cao, o.cao); });
        ds.push({ id: 'ga-choi', viTri: new THREE.Vector3(gc.vatThe.x, cao + 4, gc.vatThe.z) });
      }
      // 9) Thuyền buồm: gắn trên thuyền, phía trước mái cabin (toạ độ CỤC BỘ của thuyền)
      if (HALONG.thuyen) {
        ds.push({ id: 'thuyen-buom', cucBoThuyen: new THREE.Vector3(0, HALONG.thuyen.doCaoBoong(2.7) + 3.6, 2.2), viTri: new THREE.Vector3() });
      }
      return ds;
    },

    dung: function () {
      var self = this;
      var hinh = new THREE.PlaneGeometry(1, 1);
      // depthTest: biểu tượng sau vách đảo thì bị che như vật thật; fog/toneMapped tắt
      // để màu cam luôn rõ dù ở xa trong sương. 1 vật liệu dùng chung cho mọi biểu tượng.
      var vl = new THREE.MeshBasicMaterial({ map: taoTextureBieuTuong(), transparent: true, depthWrite: false, fog: false, toneMapped: false });
      this.tinhViTri().forEach(function (d, i) {
        if (!THUYET_MINH[d.id]) return;
        var el = document.createElement('a-entity');
        el.classList.add('diem-tt');
        el.setAttribute('data-diem', d.id);
        self.el.appendChild(el);
        var luoi = new THREE.Mesh(hinh, vl);
        luoi.renderOrder = 5;
        el.setObject3D('mesh', luoi);
        el.addEventListener('mouseenter', function () { d.tro = true; });
        el.addEventListener('mouseleave', function () { d.tro = false; });
        el.addEventListener('click', function () { if (luoi.visible) self.moBang(d.id); });
        d.el = el; d.luoi = luoi; d.pha = i * 1.7; d.tro = false; d.phong = 1;
        self.dsDiem.push(d);
      });
      this.taoBang();
    },

    /* ---------- Bảng thuyết minh 3D (1 tấm dùng chung) ---------- */
    taoBang: function () {
      var self = this;
      this.canvasBang = document.createElement('canvas');
      this.canvasBang.width = 1024;
      this.canvasBang.height = 640;
      this.texBang = new THREE.CanvasTexture(this.canvasBang);
      this.texBang.colorSpace = THREE.SRGBColorSpace;
      this.texBang.anisotropy = 4;               // chữ nghiêng góc vẫn nét (đọc chéo trong kính)
      // depthTest tắt + vẽ sau cùng: bảng là giao diện, không để lan can / cột buồm che mất chữ
      var vl = new THREE.MeshBasicMaterial({ map: this.texBang, transparent: true, fog: false, toneMapped: false, depthWrite: false, depthTest: false });
      // 2.2 m × 1.375 m, cách mắt ~2.1 m → chữ thân ~1,5° góc nhìn: đọc rõ trong kính VR
      this.luoiBang = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.375), vl);
      this.luoiBang.renderOrder = 9000;           // dưới quả cầu chuyển cảnh (9999) của giao-dien
      this.luoiBang.visible = false;
      var el = this.elBang = document.createElement('a-entity');
      el.classList.add('diem-tt');
      this.el.appendChild(el);
      el.setObject3D('mesh', this.luoiBang);
      el.addEventListener('click', function (e) {
        if (!self.bangDangMo) return;
        var giao = e.detail && e.detail.intersection;
        var hd = self.hanhDongBang;
        // Nút hành động ở góc phải dưới của bảng (uv: 0..1, gốc ở góc trái dưới)
        if (hd && giao && giao.uv && giao.uv.x > 0.62 && giao.uv.y < 0.2) {
          self.dongBang();
          if (HALONG[hd.ham]) HALONG[hd.ham]();
          return;
        }
        self.dongBang();
      });
      this.bangDangMo = false;
    },

    veBang: function (tieuDe, noiDung, nhan, hanhDong) {
      var c = this.canvasBang, ctx = c.getContext('2d'), W = c.width, H = c.height;
      ctx.clearRect(0, 0, W, H);
      hinhChuNhatBo(ctx, 8, 8, W - 16, H - 16, 36);
      ctx.fillStyle = 'rgba(22, 16, 42, 0.94)';
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(255, 178, 107, 0.75)';
      ctx.stroke();
      var le = 56;
      // Nhãn nhỏ phía trên ("Thuyết minh", "Điểm dừng 3/5"...)
      ctx.fillStyle = '#f3c9a0';
      ctx.font = '600 26px ' + FONT;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      ctx.fillText(nhan.toUpperCase(), le, 40);
      // Tiêu đề
      ctx.fillStyle = '#ffb26b';
      ctx.font = '700 56px ' + FONT;
      ctx.fillText(tieuDe, le, 76);
      // Nội dung: thử cỡ chữ lớn trước, nhỏ dần cho tới khi vừa khung
      var dinh = 160, day = H - 118, co, dong;
      for (co = 36; co >= 26; co -= 2) {
        ctx.font = '400 ' + co + 'px ' + FONT;
        dong = chiaDong(ctx, noiDung, W - le * 2);
        if (dong.length * co * 1.42 <= day - dinh) break;
      }
      ctx.fillStyle = '#fdf3e7';
      dong.forEach(function (d, i) { ctx.fillText(d, le, dinh + i * co * 1.42); });
      // ghi lại để tự kiểm tra: cỡ chữ đã chọn, số dòng, có bị tràn khung không
      this.thongTinVe = { co: co, soDong: dong.length, tran: dong.length * co * 1.42 > day - dinh };
      // Chân bảng: gợi ý đóng + nút hành động
      ctx.fillStyle = 'rgba(243, 201, 160, 0.85)';
      ctx.font = '400 24px ' + FONT;
      ctx.textBaseline = 'middle';
      ctx.fillText('Bấm vào bảng để đóng', le, H - 62);
      if (hanhDong) {
        var nw = 300, nh = 70, nx = W - le - nw, ny = H - 62 - nh / 2;
        hinhChuNhatBo(ctx, nx, ny, nw, nh, 35);
        ctx.fillStyle = '#ffb26b';
        ctx.fill();
        ctx.fillStyle = '#2a1d3d';
        ctx.font = '700 32px ' + FONT;
        ctx.textAlign = 'center';
        ctx.fillText(hanhDong.nhan, nx + nw / 2, ny + nh / 2 + 1);
      }
      this.texBang.needsUpdate = true;
    },

    // Mở bảng của 1 điểm (id trong THUYET_MINH) hoặc nội dung tuỳ ý {tieuDe, noiDung, nhan}
    moBang: function (id, noiDungRieng) {
      var tm = noiDungRieng || THUYET_MINH[id];
      if (!tm || !this.luoiBang) return;
      this.veBang(tm.tieuDe, tm.noiDung, tm.nhan || 'Thuyết minh', tm.hanhDong || null);
      this.hanhDongBang = tm.hanhDong || null;
      this.bangDiemDung = !!noiDungRieng;
      // Đặt bảng trước mặt người xem 2,1 m, thấp hơn tầm mắt một chút, quay mặt về người xem
      var cam = this.el.sceneEl.camera, p = this.viTriCam, f = this.tam;
      cam.getWorldPosition(p);
      cam.getWorldDirection(f);
      f.y = 0;
      if (f.lengthSq() < 1e-4) f.set(0, 0, -1);
      f.normalize();
      var o = this.elBang.object3D;
      o.position.copy(p).addScaledVector(f, 2.1);
      o.position.y = p.y - 0.15;
      o.lookAt(p.x, o.position.y, p.z);
      this.luoiBang.visible = true;
      this.bangDangMo = true;
      this.tamBang = o.position.clone();
      this.el.sceneEl.emit('mo-thuyet-minh', { id: id || null });
    },

    dongBang: function () {
      if (!this.luoiBang) return;
      this.luoiBang.visible = false;
      this.bangDangMo = false;
      this.bangDiemDung = false;
    },

    // Đeo kính VR + đang trên thuyền: tới điểm dừng thì tự hiện bảng thuyết minh 3D
    khiDenDiemDung: function (e) {
      var sceneEl = this.el.sceneEl;
      if (!sceneEl.is('vr-mode') || !HALONG.daBatDau) return;
      var rig = document.querySelector('[dieu-khien]');
      if (rig && rig.getAttribute('dieu-khien').cheDo !== 'du-thuyen') return;
      var dd = e.detail.diem, tong = HALONG.LO_TRINH.diemDung.length;
      this.moBang(null, {
        tieuDe: dd.ten,
        noiDung: dd.moTa,
        nhan: 'Điểm dừng ' + (e.detail.chiSo + 1) + '/' + tong,
        hanhDong: dd.vatThe && dd.vatThe.loai === 'bo-hon' ? THUYET_MINH['hang-sung-sot'].hanhDong : null
      });
    },

    tick: function (t) {
      if (!this.dsDiem.length) return;
      var cam = this.el.sceneEl.camera;
      if (!cam) return;
      var p = this.viTriCam, q = this.qCam, giay = t / 1000;
      cam.getWorldPosition(p);
      cam.getWorldQuaternion(q);
      var h = HALONG.hangDong;
      var trongHang = !!(h && h.trong(p) && (p.x - h.S.x) * h.n.x + (p.z - h.S.z) * h.n.z < 0);
      var thuyenObj = HALONG.thuyen && document.getElementById('thuyen');
      for (var i = 0; i < this.dsDiem.length; i++) {
        var d = this.dsDiem[i], o = d.el.object3D;
        if (d.cucBoThuyen && thuyenObj) d.viTri.copy(d.cucBoThuyen).applyMatrix4(thuyenObj.object3D.matrixWorld);
        var kc = p.distanceTo(d.viTri);
        // Ở trong hang chỉ thấy điểm trong hang và ngược lại (tia chuột không bị vách đá chặn,
        // nên phải ẩn hẳn để không bấm trúng biểu tượng nằm sau vách); quá xa cũng ẩn
        var hien = (!!d.trongHang === trongHang) && kc < 420;
        d.luoi.visible = hien;
        if (!hien) continue;
        // Lơ lửng nhẹ + phồng lên khi rê chuột vào
        d.phong += ((d.tro ? 1.25 : 1) - d.phong) * 0.2;
        o.position.copy(d.viTri);
        o.position.y += Math.sin(giay * 1.6 + d.pha) * 0.25;
        // cỡ ≈ 0,07 × khoảng cách → luôn chiếm ~4° góc nhìn (~30 px trên laptop) dù xa hay gần
        var co = THREE.MathUtils.clamp(kc * 0.07, 1.2, 28) * d.phong;
        o.scale.set(co, co, co);
        o.quaternion.copy(q);                   // luôn quay mặt về camera
      }
      // Bảng thuyết minh: đi xa quá 15 m (thuyền chạy, bay đi) thì tự đóng
      if (this.bangDangMo && !this.bangDiemDung && p.distanceTo(this.tamBang) > 15) this.dongBang();
    }
  });
})();
