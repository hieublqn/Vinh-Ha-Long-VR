/* =========================================================================
 * dao-da-voi.js – SINH QUẦN ĐẢO ĐÁ VÔI (component "dao-da-voi")
 * -------------------------------------------------------------------------
 * Đảo Hạ Long có dáng rất riêng: vách đá vôi dựng đứng, đỉnh tròn phủ cây,
 * chân đảo bị sóng và nước biển hòa tan khoét lõm vào thành một "rãnh"
 * (gọi là ngấn sóng / wave-cut notch).
 *
 * Cách làm (procedural – tự sinh bằng code, không dùng mô hình 3D):
 *   1. Tạo vài KHUÔN ĐẢO (tháp cao, tháp vừa, gù tròn, hai đỉnh, đảo dẹt).
 *      Mỗi khuôn là một lưới hình trụ: bán kính thay đổi theo độ cao
 *      (thân dựng đứng → vai tròn → đỉnh), rồi "gồ ghề hóa" bằng noise 3D.
 *   2. Tô màu từng đỉnh (vertex color): đá xám be, vệt phong hóa sẫm,
 *      dải đen ở chân, cây xanh ở chỗ bề mặt hướng lên.
 *   3. Rải đảo bằng random CÓ SEED → mở lần nào đảo cũng ở đúng chỗ đó.
 *   4. Mỗi khuôn vẽ bằng 1 InstancedMesh: GPU vẽ HÀNG CHỤC đảo cùng khuôn
 *      chỉ bằng 1 lệnh vẽ (draw call), mỗi đảo có vị trí/xoay/tỉ lệ riêng
 *      nên nhìn không giống nhau.
 * ========================================================================= */
(function () {
  'use strict';

  var HALONG = window.HALONG;
  var smoothstep = HALONG.smoothstep;

  /* Các khuôn đảo (đơn vị: bán kính chân đảo = 1)
   *   cao       : chiều cao so với bán kính chân
   *   vomTu     : từ tỉ lệ độ cao này trở lên, thân bắt đầu bo tròn thành đỉnh
   *   thon      : thân nhỏ dần lên trên bao nhiêu
   *   nghieng   : đỉnh lệch sang một bên (đảo hơi "nghiêng")
   *   haiDinh   : đỉnh có 2 mỏm                                               */
  var KIEU_DAO = [
    { ten: 'thap-cao', cao: 3.3, vomTu: 0.80, thon: 0.10, nghieng: 0.14, trongSo: 34 },
    { ten: 'thap-vua', cao: 2.3, vomTu: 0.72, thon: 0.06, nghieng: 0.06, trongSo: 30 },
    { ten: 'gu-tron', cao: 1.35, vomTu: 0.45, thon: 0.03, nghieng: 0.0, trongSo: 14 },
    { ten: 'hai-dinh', cao: 2.0, vomTu: 0.58, thon: 0.05, nghieng: 0.0, haiDinh: true, trongSo: 12 },
    { ten: 'dao-det', cao: 0.95, vomTu: 0.50, thon: 0.02, nghieng: 0.0, trongSo: 10 }
  ];

  // Bán kính thân đảo tại độ cao y (chưa có noise)
  function banKinhTheoDoCao(y, kieu) {
    var u = Math.max(y, 0) / kieu.cao;          // 0 ở mặt nước → 1 ở đỉnh
    var r = 1 - kieu.thon * u;                   // thon dần lên trên
    // Vai tròn: từ 'vomTu' trở lên bán kính co về 0 theo đường siêu elip
    // (số mũ 2.6 > 2 → vai "vuông" hơn hình tròn, giống khối đá vôi)
    if (u > kieu.vomTu) {
      var v = (u - kieu.vomTu) / (1 - kieu.vomTu);
      r *= Math.pow(Math.max(1 - Math.pow(v, 2.6), 0), 1 / 2.6);
    }
    // Ngấn sóng: khoét lõm ~13% ở ngay trên mặt nước (phần vách phía trên nhô ra như mái hiên)
    var dNgan = (y - 0.05) / 0.06;
    r *= 1 - 0.13 * Math.exp(-dNgan * dNgan);
    return r;
  }

  // Tạo 1 khuôn đảo → BufferGeometry có vertex color
  function taoKhuonDao(kieu, rand, noise) {
    var SO_GOC = 56;                             // số đỉnh trên 1 vòng quanh đảo
    var lech = rand.khoang(0, 100);              // dịch noise → mỗi khuôn một dáng
    var huongNghieng = rand.khoang(0, Math.PI * 2);

    // Các tầng theo chiều cao: dày ở gần mặt nước (để vẽ rõ ngấn sóng), thưa ở trên
    var tang = [];
    var y;
    for (y = -0.3; y < 0.3; y += 0.03) tang.push(y);
    var SO_TANG_TREN = 40;
    for (var j = 0; j <= SO_TANG_TREN; j++) tang.push(0.3 + (kieu.cao - 0.3) * j / SO_TANG_TREN);

    var viTri = [], phu = [];                    // phu: dữ liệu phụ (độ cao gốc) để tô màu
    var i, k, goc;
    for (k = 0; k < tang.length; k++) {
      y = tang[k];
      var laDinh = k === tang.length - 1;
      for (i = 0; i < SO_GOC; i++) {
        goc = (i / SO_GOC) * Math.PI * 2;
        var cx = Math.cos(goc), cz = Math.sin(goc);
        var r = banKinhTheoDoCao(y, kieu);

        // Gồ ghề hóa: lấy noise 3D trên mặt trụ (cx, y, cz) → liền mạch quanh đảo
        var khoi = noise.fbm3(cx * 1.1 + lech, y * 0.45, cz * 1.1, 4);       // u lồi lớn
        // rãnh dọc: noise bị "kéo dãn" theo chiều cao (y nhân hệ số nhỏ) → vệt chạy dọc vách,
        // giống các rãnh do nước mưa hòa tan đá vôi (karren)
        var ranh = noise.fbm3(cx * 6.5 + lech, y * 0.18, cz * 6.5, 3);
        r *= 0.8 + 0.42 * khoi + 0.26 * (ranh - 0.5);

        var yy = y;
        var u = Math.max(y, 0) / kieu.cao;
        // Vùng đỉnh phủ cây: thêm u nhỏ lổn nhổn như tán cây
        if (u > kieu.vomTu * 0.75) {
          r *= 1 + 0.07 * (noise.n3(cx * 9 + lech, y * 6, cz * 9) - 0.5);
        }
        // Đỉnh đảo nhấp nhô + (tùy khuôn) chia 2 mỏm
        if (u > kieu.vomTu * 0.8) {
          var nDinh = noise.fbm3(cx * 1.6 + lech, 7.0, cz * 1.6, 3);
          yy += (nDinh - 0.5) * 0.35 * kieu.cao * (u - kieu.vomTu * 0.8);
          if (kieu.haiDinh) yy -= 0.22 * kieu.cao * (u - kieu.vomTu * 0.8) * (0.5 + 0.5 * Math.cos(2 * goc));
        }
        if (laDinh) r = 0;                       // khép kín đỉnh

        // Nghiêng: càng lên cao càng lệch
        var dichNghieng = kieu.nghieng * u * u;
        viTri.push(
          cx * r + Math.cos(huongNghieng) * dichNghieng,
          yy,
          cz * r + Math.sin(huongNghieng) * dichNghieng
        );
        phu.push(y);
      }
    }
    // Đỉnh tâm đáy (đậy đáy, nằm dưới nước)
    viTri.push(0, -0.3, 0); phu.push(-0.3);
    var tamDay = viTri.length / 3 - 1;

    // Nối các đỉnh thành tam giác: mỗi ô (2 tầng × 2 góc) = 2 tam giác
    var chiSo = [];
    for (k = 0; k < tang.length - 1; k++) {
      for (i = 0; i < SO_GOC; i++) {
        var a = k * SO_GOC + i;
        var b = k * SO_GOC + ((i + 1) % SO_GOC);   // % SO_GOC: vòng cuối nối về vòng đầu
        var c = a + SO_GOC, d = b + SO_GOC;
        chiSo.push(a, c, b, b, c, d);
      }
    }
    for (i = 0; i < SO_GOC; i++) chiSo.push(tamDay, i, (i + 1) % SO_GOC);

    var hinh = new THREE.BufferGeometry();
    hinh.setAttribute('position', new THREE.Float32BufferAttribute(viTri, 3));
    hinh.setIndex(chiSo);
    hinh.computeVertexNormals();

    // ---- Tô màu từng đỉnh ----
    var DA = new THREE.Color('#9a958a');        // đá vôi xám
    var DA_SANG = new THREE.Color('#b8b1a2');   // mảng đá mới lở, sáng màu
    var DA_SAM = new THREE.Color('#4e4a43');    // vệt phong hóa sẫm chảy dọc vách
    var CHAN = new THREE.Color('#3a372f');      // dải sẫm ở chân (rêu, nước triều)
    var CAY_1 = new THREE.Color('#263f1c');     // cây xanh đậm
    var CAY_2 = new THREE.Color('#46642a');     // cây xanh nhạt
    var mau = [], c1 = new THREE.Color(), cCay = new THREE.Color();
    var pos = hinh.attributes.position, nor = hinh.attributes.normal;
    for (i = 0; i < pos.count; i++) {
      var px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
      var y0 = phu[i];
      var ny = nor.getY(i);

      var vet = noise.fbm3(px * 4 + lech, py * 0.2, pz * 4, 3);          // vệt chảy dọc vách
      c1.copy(DA).lerp(DA_SANG, smoothstep(0.55, 0.7, noise.n3(px * 2, py * 1.2, pz * 2 + 30)));
      c1.lerp(DA_SAM, smoothstep(0.4, 0.66, vet));
      c1.lerp(CHAN, 1 - smoothstep(0.1, 0.3, y0));                        // dải tối ở chân

      // Cây mọc ở chỗ bề mặt hướng lên (ny lớn), phủ kín vùng đỉnh, và thành bụi bám trên vách
      var nCay = noise.fbm3(px * 2.2, py * 1.5, pz * 2.2 + 50, 3);
      var mucCay = smoothstep(0.05, 0.4, ny + (nCay - 0.5) * 1.0) * smoothstep(0.15, 0.4, y0);
      mucCay = Math.max(mucCay, smoothstep(kieu.vomTu * 0.7, kieu.vomTu * 0.9, y0 / kieu.cao));
      mucCay = Math.max(mucCay, smoothstep(0.54, 0.64, nCay) * smoothstep(0.3, 0.7, y0) * 0.95);
      cCay.copy(CAY_1).lerp(CAY_2, noise.n3(px * 5, py * 5, pz * 5));
      c1.lerp(cCay, mucCay);

      mau.push(c1.r, c1.g, c1.b);
    }
    hinh.setAttribute('color', new THREE.Float32BufferAttribute(mau, 3));

    // Bán kính lớn nhất ở vùng sát mặt nước → dùng làm vùng va chạm
    var rChan = 0;
    for (i = 0; i < pos.count; i++) {
      if (phu[i] >= -0.05 && phu[i] <= 0.6) {
        rChan = Math.max(rChan, Math.hypot(pos.getX(i), pos.getZ(i)));
      }
    }
    hinh.userData.banKinhChan = rChan;
    hinh.userData.caoDinh = kieu.cao * 1.1;
    return hinh;
  }

  AFRAME.registerComponent('dao-da-voi', {
    schema: {
      soDao: { default: 16 },
      // Seed = 1994: năm Vịnh Hạ Long được UNESCO ghi vào Danh sách Di sản Thế giới
      hatGiong: { default: 1994 },
      banKinhVung: { default: 480 },              // rải đảo trong vòng tròn bán kính này (m)
      diemXuatPhat: { type: 'vec3', default: { x: 0, y: 0, z: 60 } },
      chuaLoiMatTroi: { default: true }           // chừa "lối nhìn" ra mặt trời từ điểm xuất phát
    },

    init: function () {
      var d = this.data;
      var rand = HALONG.taoRandom(d.hatGiong);
      var noise = HALONG.taoNoise(d.hatGiong);

      // 1 vật liệu dùng chung cho mọi đảo. Lambert: chiếu sáng khuếch tán,
      // rẻ hơn Standard (PBR) – hợp với GPU tích hợp.
      var vatLieu = HALONG.apDungSuongMu(new THREE.MeshLambertMaterial({ vertexColors: true }));

      // 1) Tạo các khuôn
      var khuon = KIEU_DAO.map(function (kieu) { return taoKhuonDao(kieu, rand, noise); });

      // 2) Chọn vị trí từng đảo
      var dsDao = this.raiDao(rand, khuon);

      // 3) Gom các đảo cùng khuôn vào 1 InstancedMesh
      var nhom = new THREE.Group();
      var maTran = new THREE.Matrix4(), q = new THREE.Quaternion(), viTri = new THREE.Vector3(),
          tiLe = new THREE.Vector3(), trucY = new THREE.Vector3(0, 1, 0);
      khuon.forEach(function (hinh, kieuSo) {
        var cacDao = dsDao.filter(function (dao) { return dao.kieu === kieuSo; });
        if (!cacDao.length) return;
        var luoi = new THREE.InstancedMesh(hinh, vatLieu, cacDao.length);
        cacDao.forEach(function (dao, n) {
          viTri.set(dao.x, 0, dao.z);
          q.setFromAxisAngle(trucY, dao.xoay);
          tiLe.set(dao.s * dao.sx, dao.s * dao.sy, dao.s * dao.sz);
          maTran.compose(viTri, q, tiLe);
          luoi.setMatrixAt(n, maTran);
        });
        luoi.instanceMatrix.needsUpdate = true;
        luoi.computeBoundingSphere();               // để three.js bỏ qua khi nằm ngoài khung nhìn
        nhom.add(luoi);
      });
      this.el.setObject3D('mesh', nhom);

      // 4) Đăng ký vật cản cho bộ điều khiển (không đi xuyên đảo)
      HALONG.vatCan = HALONG.vatCan.concat(dsDao.map(function (dao) {
        return { x: dao.x, z: dao.z, r: dao.rChan, cao: dao.cao };
      }));
      HALONG.dsDao = dsDao;  // Mốc 4: minimap sẽ đọc danh sách này
    },

    // Rải đảo ngẫu nhiên có seed, tránh chồng lên nhau và tránh điểm xuất phát
    raiDao: function (rand, khuon) {
      var d = this.data;
      var trongSo = KIEU_DAO.map(function (k) { return k.trongSo; });
      var huongTroi = HALONG.tinhHuongMatTroi(HALONG.BANG_MAU.hoangHon);
      var hx = huongTroi.x, hz = huongTroi.z, dai = Math.hypot(hx, hz);
      hx /= dai; hz /= dai;
      var xp = d.diemXuatPhat;
      var ds = [], thu = 0;

      while (ds.length < d.soDao && thu < 20000) {
        thu++;
        // sqrt(rand) → đảo rải đều theo DIỆN TÍCH (không dồn vào tâm)
        var goc = rand() * Math.PI * 2, kc = Math.sqrt(rand()) * d.banKinhVung;
        var x = Math.cos(goc) * kc, z = Math.sin(goc) * kc;
        var kieu = rand.chonTheoTrongSo(trongSo);
        var s = rand.khoang(6, 19);                    // bán kính chân (m)
        var sx = rand.khoang(0.8, 1.25), sz = rand.khoang(0.8, 1.25), sy = rand.khoang(0.8, 1.3);
        var rChan = s * khuon[kieu].userData.banKinhChan * Math.max(sx, sz);

        // Không quá gần điểm xuất phát
        if (Math.hypot(x - xp.x, z - xp.z) < rChan + 40) continue;
        // Chừa lối nhìn ra mặt trời: đảo không nằm trên tia từ điểm xuất phát tới mặt trời
        if (d.chuaLoiMatTroi) {
          var dx = x - xp.x, dz = z - xp.z;
          var doc = dx * hx + dz * hz;                // khoảng cách dọc theo tia
          var ngang = Math.abs(dx * hz - dz * hx);    // khoảng cách vuông góc tới tia
          if (doc > 0 && ngang < rChan + 18) continue;
        }
        // Không chồng lên đảo khác
        var chong = ds.some(function (o) { return Math.hypot(o.x - x, o.z - z) < o.rChan + rChan + 10; });
        if (chong) continue;

        ds.push({
          x: x, z: z, kieu: kieu, s: s, sx: sx, sy: sy, sz: sz,
          xoay: rand() * Math.PI * 2, rChan: rChan,
          cao: s * sy * khuon[kieu].userData.caoDinh
        });
      }
      return ds;
    },

    remove: function () {
      this.el.removeObject3D('mesh');
    }
  });
})();
