/* =========================================================================
 * thuyen.js – THUYỀN BUỒM NÂU + DU THUYỀN TỰ ĐỘNG THEO LỘ TRÌNH
 * -------------------------------------------------------------------------
 * File gồm 3 phần:
 *   1. LỘ TRÌNH: các điểm mốc trên vịnh + 5 điểm dừng tham quan.
 *      Nối các điểm bằng đường cong CatmullRom khép kín (đường cong mượt đi
 *      QUA đúng các điểm mốc) → thuyền chạy vòng quanh không bị gấp khúc.
 *   2. MÔ HÌNH THUYỀN (component "thuyen-buom"): thân gỗ dựng bằng công
 *      thức toán, boong, lan can, cabin, 3 cột buồm, cánh buồm nâu có nếp
 *      gấp kiểu thuyền mành. Khoảng 56 chi tiết được GỘP thành 3 hình
 *      (gỗ / cabin / buồm) → chỉ 3 draw call.
 *   3. DU THUYỀN (component "du-thuyen"): cho thuyền chạy theo lộ trình,
 *      tăng/giảm tốc êm, dừng ở mỗi điểm tham quan, nhấp nhô theo sóng.
 *
 * Quy ước trục của thuyền: mũi thuyền hướng về -Z, mạn phải là +X,
 * gốc tọa độ ở giữa thân, ngang mặt nước.
 * ========================================================================= */
(function () {
  'use strict';

  var HALONG = window.HALONG;
  var smoothstep = HALONG.smoothstep;

  /* =======================================================================
   * 1. LỘ TRÌNH
   *    diem    : các điểm mốc [x, z] (m) theo thứ tự thuyền đi qua
   *    diemDung: điểm mốc nào là điểm dừng + thông tin hiển thị.
   *    vatThe  : vị trí "vật thể" của điểm tham quan (đảo, làng chài...) để
   *              dao-da-voi.js dựng đảo đặc biệt và chừa chỗ trống.
   * Lưu ý: bản đồ trong mô hình là MINH HỌA, không đúng tỉ lệ/vị trí thật.
   * ===================================================================== */
  var LO_TRINH = (HALONG.LO_TRINH = {
    diem: [
      [0, 80], [14, 15], [30, -60], [5, -140], [-90, -190],
      [-175, -150], [-210, -40], [-185, 60], [-120, 110], [-55, 120]
    ],
    diemDung: [
      {
        chiSo: 0, ten: 'Vịnh Hạ Long',
        moTa: 'Di sản Thiên nhiên Thế giới, được UNESCO ghi danh lần đầu năm 1994.'
      },
      {
        chiSo: 2, ten: 'Đảo Ti Tốp',
        // TODO cần kiểm tra: năm 1962 và chi tiết chuyến thăm của nhà du hành Gherman Titov
        moTa: 'Đảo mang tên nhà du hành vũ trụ Gherman Titov. Có bãi cát nhỏ và đỉnh ngắm toàn cảnh vịnh.',
        vatThe: { loai: 'ti-top', x: -30, z: -100, banKinh: 26 }
      },
      {
        chiSo: 4, ten: 'Hang Sửng Sốt',
        moTa: 'Hang động rộng và đẹp bậc nhất vịnh, nằm trên đảo Bồ Hòn.',
        vatThe: { loai: 'bo-hon', x: -168, z: -260, banKinh: 62 }
      },
      {
        chiSo: 6, ten: 'Làng chài Cửa Vạn',
        // TODO cần kiểm tra: năm tái định cư (2014) và số hộ còn ở lại trên vịnh
        moTa: 'Làng chài trên vịnh nổi tiếng nhất Hạ Long. Từ năm 2014 phần lớn ngư dân đã lên bờ ' +
          'tái định cư; một số nhà bè được giữ lại để bảo tồn văn hóa làng chài và đón khách.',
        vatThe: { loai: 'lang-chai', x: -268, z: -22, banKinh: 58 }
      },
      {
        chiSo: 8, ten: 'Hòn Gà Chọi',
        moTa: 'Hai hòn đá nhỏ đứng đối mặt nhau như đôi gà đang chọi, một biểu tượng của Hạ Long.',
        vatThe: { loai: 'ga-choi', x: -142, z: 147, banKinh: 14 }
      }
    ]
  });

  // Đường cong khép kín đi qua mọi điểm mốc. 'centripetal' = kiểu CatmullRom
  // không tạo vòng xoắn / gấp khúc khi các điểm mốc cách nhau không đều.
  var duongCong = new THREE.CatmullRomCurve3(
    LO_TRINH.diem.map(function (p) { return new THREE.Vector3(p[0], 0, p[1]); }),
    true, 'centripetal'
  );
  duongCong.arcLengthDivisions = 2000;          // chia mịn để đo độ dài chính xác
  LO_TRINH.duongCong = duongCong;
  LO_TRINH.doDai = duongCong.getLength();

  // Vị trí (theo mét tính dọc đường cong) của từng điểm dừng.
  // Với đường cong khép kín N điểm, điểm mốc i nằm ở tham số t = i / N;
  // getLengths() cho độ dài cộng dồn tại các mốc t chia đều → tra ra mét.
  (function () {
    var cacDoDai = duongCong.getLengths(2000);
    LO_TRINH.diemDung.forEach(function (dd) {
      dd.s = cacDoDai[Math.round(dd.chiSo / LO_TRINH.diem.length * 2000)];
      var p = LO_TRINH.diem[dd.chiSo];
      dd.x = p[0]; dd.z = p[1];
    });
  })();

  // Lấy mẫu dày dọc lộ trình để các file khác đo khoảng cách tới lộ trình
  LO_TRINH.mauDiem = duongCong.getSpacedPoints(400);
  LO_TRINH.khoangCachToi = function (x, z) {
    var nhoNhat = Infinity;
    for (var i = 0; i < LO_TRINH.mauDiem.length; i++) {
      var p = LO_TRINH.mauDiem[i];
      var d = (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z);
      if (d < nhoNhat) nhoNhat = d;
    }
    return Math.sqrt(nhoNhat);
  };

  /* =======================================================================
   * 2. HÌNH DẠNG THUYỀN – các hàm toán mô tả thân thuyền
   *    t = vị trí dọc thân: 0 ở mũi, 1 ở đuôi.
   * ===================================================================== */
  var DAI = 22, NUA_DAI = DAI / 2;               // thuyền dài 22 m
  function tTheoZ(z) { return (z + NUA_DAI) / DAI; }

  // Nửa bề rộng thân: nhọn ở mũi, rộng nhất ~2.8 m, hơi thu lại ở đuôi
  function nuaRong(t) {
    var w = 2.8 * Math.pow(Math.sin(Math.min(t / 0.35, 1) * Math.PI / 2), 0.75);
    return w * (1 - 0.12 * smoothstep(0.75, 1, t));
  }
  // Độ cao mép mạn so với mặt nước: cong vổng lên ở mũi và đuôi (dáng thuyền mành)
  function doCaoMan(t) {
    return 1.55 + 1.3 * Math.pow(1 - Math.min(t / 0.3, 1), 2) +
      1.1 * Math.pow(smoothstep(0.7, 1, t), 1.5);
  }
  // Độ sâu của sống đáy (số âm = dưới mặt nước)
  function doSauDay(t) {
    return -1.1 * smoothstep(0, 0.25, t) * (1 - 0.45 * smoothstep(0.75, 1, t));
  }
  // Mặt boong thấp hơn mép mạn 0.35 m (phần mạn nhô lên thành tường chắn)
  function doCaoBoong(t) { return doCaoMan(t) - 0.35; }

  // Vị trí cột buồm (z cục bộ)
  var COT_BUOM = [
    { z: -5.8, cao: 10, buom: { rongDuoi: 5.2, rongTren: 4.0, cao: 7.0, cachChan: 2.4 } },
    { z: 0.4, cao: 14, buom: { rongDuoi: 6.8, rongTren: 5.2, cao: 9.6, cachChan: 3.1 } },
    { z: 7.8, cao: 7.5, trenMai: true, buom: { rongDuoi: 4.0, rongTren: 3.2, cao: 5.0, cachChan: 0.6 } }
  ];
  var CABIN = { zDau: 2.7, zCuoi: 9.6, cao: 2.4 };
  var MAU_DEN_BOONG = new THREE.Color('#ffb060');      // ánh đèn vàng cam trên boong ban đêm

  /* Thông tin thuyền dùng chung cho các file khác (dieu-khien.js, bien.js...)
   * Phần trạng thái (viTri, goc, tocDo...) do component du-thuyen cập nhật. */
  HALONG.thuyen = {
    dai: DAI,
    viTri: new THREE.Vector3(),
    goc: 0,                  // góc hướng (radian, quay quanh trục Y)
    doc: 0,                  // góc chúi mũi (radian, > 0: mũi ngóc lên)
    nghieng: 0,              // góc lắc ngang (radian, > 0: mạn phải nâng lên)
    tocDo: 0,                // m/s
    trangThai: 'dung',
    diemTiep: 0,             // chỉ số điểm dừng sắp tới
    conLai: 0,               // còn bao nhiêu mét tới điểm dừng đó
    viTriBatDauTrenBoong: new THREE.Vector2(0, -8.2),   // (x, z) cục bộ: gần mũi thuyền

    // Độ cao mặt boong tại z cục bộ (thuyền nằm thẳng)
    doCaoBoong: function (z) { return doCaoBoong(tTheoZ(z)); },

    // Độ cao THẾ GIỚI của mặt boong tại điểm (x, z) cục bộ, có tính thuyền đang
    // chúi/lắc. Thứ tự xoay 'YXZ': lắc (Z) trước, rồi chúi (X), rồi hướng (Y – không
    // đổi độ cao). Nhờ vậy chân người luôn chạm đúng mặt sàn đang chòng chành.
    doCaoSanThe: function (x, z) {
      var yB = doCaoBoong(tTheoZ(z));
      return this.viTri.y + (x * Math.sin(this.nghieng) + yB * Math.cos(this.nghieng)) * Math.cos(this.doc) -
        z * Math.sin(this.doc);
    },

    // Giữ 1 điểm (x, z) cục bộ nằm trong vùng boong được phép đi
    // (từ gần mũi tới trước cửa cabin, cách mạn 0.45 m, tránh 2 cột buồm)
    kepTrenBoong: function (v) {
      v.y = Math.min(Math.max(v.y, -9.0), CABIN.zDau - 0.6);
      var gioiHanX = nuaRong(tTheoZ(v.y)) * 0.98 - 0.45;
      v.x = Math.min(Math.max(v.x, -gioiHanX), gioiHanX);
      for (var i = 0; i < 2; i++) {
        var dz = v.y - COT_BUOM[i].z, kc = Math.hypot(v.x, dz);
        if (kc < 0.5) {
          if (kc < 1e-4) { v.x = 0.5; continue; }
          v.x *= 0.5 / kc; v.y = COT_BUOM[i].z + dz * 0.5 / kc;
        }
      }
      return v;
    }
  };

  /* ---------- Texture gỗ & cabin vẽ bằng canvas ---------- */
  function taoTextureGo() {
    var rand = HALONG.taoRandom(31);
    var tex = HALONG.taoTextureCanvas(512, 512, function (ctx, w, h) {
      var SO_TAM = 8, cao = h / SO_TAM;
      for (var i = 0; i < SO_TAM; i++) {
        // mỗi tấm ván một sắc độ hơi khác
        var sang = 215 + Math.floor(rand() * 35);
        ctx.fillStyle = 'rgb(' + sang + ',' + (sang - 12) + ',' + (sang - 26) + ')';
        ctx.fillRect(0, i * cao, w, cao);
        // vân gỗ: các đường lượn sóng mảnh chạy dọc tấm ván
        for (var k = 0; k < 9; k++) {
          ctx.strokeStyle = 'rgba(90,60,35,' + (0.06 + rand() * 0.1) + ')';
          ctx.lineWidth = 1 + rand() * 1.5;
          ctx.beginPath();
          var y0 = i * cao + rand() * cao, pha = rand() * 6, bien = 1 + rand() * 3;
          for (var x = 0; x <= w; x += 16) ctx.lineTo(x, y0 + Math.sin(x / 60 + pha) * bien);
          ctx.stroke();
        }
        // khe giữa các tấm ván + mối nối ngang
        ctx.fillStyle = 'rgba(50,32,20,0.75)';
        ctx.fillRect(0, i * cao, w, 3);
        ctx.fillRect(Math.floor(rand() * w), i * cao, 3, cao);
      }
    });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  function taoTextureCabin() {
    return HALONG.taoTextureCanvas(512, 256, function (ctx, w, h) {
      // tường ván gỗ dựng đứng
      ctx.fillStyle = '#6b3f22';
      ctx.fillRect(0, 0, w, h);
      for (var x = 0; x < w; x += 24) {
        ctx.fillStyle = 'rgba(30,15,5,0.45)';
        ctx.fillRect(x, 0, 2, h);
      }
      // 3 ô cửa sổ: khung gỗ sáng + kính phản chiếu trời chiều
      for (var i = 0; i < 3; i++) {
        var x0 = 40 + i * 160, y0 = 60, ww = 110, hh = 100;
        ctx.fillStyle = '#e3c58e';
        ctx.fillRect(x0 - 8, y0 - 8, ww + 16, hh + 16);
        var g = ctx.createLinearGradient(0, y0, 0, y0 + hh);
        g.addColorStop(0, '#f2a76a');
        g.addColorStop(0.45, '#5b4a78');
        g.addColorStop(1, '#1d2238');
        ctx.fillStyle = g;
        ctx.fillRect(x0, y0, ww, hh);
        ctx.fillStyle = '#e3c58e';
        ctx.fillRect(x0 + ww / 2 - 3, y0, 6, hh);   // song cửa
      }
      // gờ trên và dưới
      ctx.fillStyle = '#3e2212';
      ctx.fillRect(0, 0, w, 14);
      ctx.fillRect(0, h - 18, w, 18);
    });
  }

  // "Mặt nạ" cửa sổ: cùng bố cục với texture cabin, chỉ ô kính tô màu vàng ấm,
  // còn lại đen → ban đêm cộng mặt nạ này vào màu cabin = cửa sổ sáng đèn.
  function taoMatNaCuaSo() {
    var tex = HALONG.taoTextureCanvas(512, 256, function (ctx, w, h) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 3; i++) {
        var x0 = 40 + i * 160, y0 = 60, ww = 110, hh = 100;
        var g = ctx.createLinearGradient(0, y0, 0, y0 + hh);
        g.addColorStop(0, '#ffd890');
        g.addColorStop(1, '#ff9a40');
        ctx.fillStyle = g;
        ctx.fillRect(x0, y0, ww, hh);
        ctx.fillStyle = '#000';
        ctx.fillRect(x0 + ww / 2 - 3, y0, 6, hh);   // song cửa không sáng
      }
    });
    return tex;
  }

  /* ---------- Thân thuyền (lưới dựng theo các hàm ở trên) ---------- */
  function taoThan() {
    var NL = 48, NS = 10;                     // 48 lát dọc thân, mỗi bên 10 đỉnh
    var viTri = [], uv = [], mau = [], chiSo = [];
    var c = new THREE.Color();
    var MAU_DAY = new THREE.Color('#24170e'), MAU_SOC = new THREE.Color('#b57d3c'),
        MAU_THAN = new THREE.Color('#4a2b17'), MAU_MEP = new THREE.Color('#8a5a2e');
    function toMauTheoDoCao(y, s) {
      if (y < 0.18) c.copy(MAU_DAY);                       // phần ngâm nước: sẫm
      else if (y < 0.34) c.copy(MAU_SOC);                  // sọc vàng nâu ngang thân
      else if (y > s - 0.28) c.copy(MAU_MEP);              // nẹp mép mạn
      else c.copy(MAU_THAN);
      mau.push(c.r, c.g, c.b);
    }
    var i, j;
    for (i = 0; i <= NL; i++) {
      var t = i / NL, z = -NUA_DAI + t * DAI;
      var w = nuaRong(t), k = doSauDay(t), s = doCaoMan(t);
      for (j = -NS; j <= NS; j++) {
        // phi: 0 = sống đáy, π/2 = mép mạn. sin^0.45 → đáy bầu, hông tròn
        var phi = Math.abs(j) / NS * Math.PI / 2;
        var x = Math.sign(j) * w * Math.pow(Math.sin(phi), 0.45) * (1 + 0.06 * (1 - Math.cos(phi)));
        var y = k + (s - k) * (1 - Math.cos(phi));
        viTri.push(x, y, z);
        uv.push(z / 4, y / 2.6);              // ván chạy dọc thân
        toMauTheoDoCao(y, s);
      }
    }
    var cot = 2 * NS + 1;
    for (i = 0; i < NL; i++) {
      for (j = 0; j < cot - 1; j++) {
        var a = i * cot + j, b = a + 1, cc = a + cot, d = cc + 1;
        chiSo.push(a, cc, b, b, cc, d);
      }
    }
    // Vách đuôi phẳng (transom): nối các đỉnh lát cuối về 1 điểm giữa
    var tam = viTri.length / 3, dau = NL * cot;
    viTri.push(0, (doSauDay(1) + doCaoMan(1)) / 2, NUA_DAI);
    uv.push(0, 0);
    c.copy(MAU_THAN); mau.push(c.r, c.g, c.b);
    for (j = 0; j < cot - 1; j++) chiSo.push(tam, dau + j, dau + j + 1);
    // Tam giác cuối nối mép mạn phải ↔ mép mạn trái → vách đuôi kín, không thủng
    chiSo.push(tam, dau + cot - 1, dau);
    var hinh = new THREE.BufferGeometry();
    hinh.setAttribute('position', new THREE.Float32BufferAttribute(viTri, 3));
    hinh.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    hinh.setAttribute('color', new THREE.Float32BufferAttribute(mau, 3));
    hinh.setIndex(chiSo);
    hinh.computeVertexNormals();
    return hinh;
  }

  /* ---------- Mặt boong ---------- */
  function taoBoong() {
    var NL = 40, NX = 6;
    var viTri = [], uv = [], chiSo = [];
    for (var i = 0; i <= NL; i++) {
      var t = 0.03 + 0.955 * i / NL, z = -NUA_DAI + t * DAI;
      var w = nuaRong(t) * 1.02;
      for (var j = 0; j <= NX; j++) {
        var u = j / NX * 2 - 1;               // -1 (mạn trái) → 1 (mạn phải)
        var y = doCaoBoong(t) + 0.04 * (1 - u * u);   // boong hơi gồ ở giữa cho thoát nước
        viTri.push(u * w, y, z);
        uv.push(z / 4, u * w / 1.3);
      }
    }
    for (i = 0; i < NL; i++) {
      for (j = 0; j < NX; j++) {
        var a = i * (NX + 1) + j, b = a + 1, c = a + NX + 1, d = c + 1;
        chiSo.push(a, c, b, b, c, d);
      }
    }
    var hinh = new THREE.BufferGeometry();
    hinh.setAttribute('position', new THREE.Float32BufferAttribute(viTri, 3));
    hinh.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    hinh.setIndex(chiSo);
    hinh.computeVertexNormals();
    return HALONG.hinh.toMau(hinh, '#c48d5a');
  }

  /* ---------- Cánh buồm kiểu thuyền mành ----------
   * Mặt buồm là lưới (u: từ cột buồm ra mép sau, v: từ dưới lên trên).
   * Buồm được chia thành nhiều "ô" bởi các thanh nẹp tre ngang; vải giữa 2
   * nẹp phồng ra theo gió → tạo nếp gấp đặc trưng. Mép sau cong như cánh quạt. */
  function hamBuom(b, u, v, ketQua) {
    var rong = b.rongDuoi + (b.rongTren - b.rongDuoi) * v;
    var SO_O = 6;
    var giuaO = Math.sin(Math.PI * ((v * SO_O) % 1));            // 0 ở nẹp, 1 giữa ô
    var z = -0.18 * rong + u * rong + 0.5 * u * Math.sin(Math.PI * v);   // mép sau cong
    var y = v * b.cao + u * v * 1.1;                            // góc trên phía sau vểnh lên
    var x = Math.sin(Math.PI * u) * (0.16 + 0.3 * giuaO);       // độ phồng của vải
    return ketQua.set(x, y, z);
  }

  function taoBuom(b) {
    var NU = 14, NV = 36;
    var viTri = [], uv = [], mau = [], chiSo = [];
    var p = new THREE.Vector3(), c = new THREE.Color();
    var NAU = new THREE.Color('#a8622f'), NAU_SAM = new THREE.Color('#874a22');
    for (var j = 0; j <= NV; j++) {
      var v = j / NV;
      for (var i = 0; i <= NU; i++) {
        var u = i / NU;
        hamBuom(b, u, v, p);
        viTri.push(p.x, p.y, p.z);
        uv.push(u, v);
        // ô chẵn / lẻ đậm nhạt khác nhau một chút, mép buồm sẫm hơn
        c.copy(Math.floor(v * 6 - 1e-6) % 2 ? NAU : NAU_SAM).lerp(NAU_SAM, 0.35 * Math.pow(Math.abs(u * 2 - 1), 4));
        mau.push(c.r, c.g, c.b);
      }
    }
    for (j = 0; j < NV; j++) {
      for (i = 0; i < NU; i++) {
        var a = j * (NU + 1) + i, bb = a + 1, cc = a + NU + 1, d = cc + 1;
        chiSo.push(a, bb, cc, bb, d, cc);
      }
    }
    var hinh = new THREE.BufferGeometry();
    hinh.setAttribute('position', new THREE.Float32BufferAttribute(viTri, 3));
    hinh.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    hinh.setAttribute('color', new THREE.Float32BufferAttribute(mau, 3));
    hinh.setIndex(chiSo);
    hinh.computeVertexNormals();
    return hinh;
  }

  // Các thanh nẹp tre ngang của buồm (7 thanh, kể cả mép dưới và mép trên)
  function taoNepBuom(b) {
    var ds = [], a = new THREE.Vector3(), diem = [];
    for (var k = 0; k <= 6; k++) {
      var v = k / 6;
      diem = [];
      for (var i = 0; i <= 8; i++) diem.push(hamBuom(b, i / 8, v, a).clone());
      var hinh = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(diem), 12, 0.05, 5, false);
      ds.push(HALONG.hinh.toMau(hinh, '#2a180c'));
    }
    return ds;
  }

  /* =======================================================================
   * Component "thuyen-buom": dựng mô hình thuyền
   * ===================================================================== */
  AFRAME.registerComponent('thuyen-buom', {
    init: function () {
      var H = HALONG.hinh;
      var go = [], buom = [];

      // --- Thân, boong ---
      go.push(taoThan(), taoBoong());

      // --- Tay vịn chạy dọc mép mạn + lan can phía trước cabin ---
      [-1, 1].forEach(function (ben) {
        var mep = [], lanCan = [];
        for (var i = 0; i <= 30; i++) {
          var t = 0.02 + 0.97 * i / 30, z = -NUA_DAI + t * DAI;
          mep.push(new THREE.Vector3(ben * nuaRong(t) * 1.06, doCaoMan(t) + 0.03, z));
        }
        go.push(H.toMau(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(mep), 60, 0.07, 6, false), '#c08a45'));
        // cột lan can mỗi ~1.5 m, từ gần mũi tới cabin
        for (var z = -9.5; z <= CABIN.zDau; z += 1.5) {
          var t2 = tTheoZ(z), x = ben * nuaRong(t2) * 1.04, y = doCaoMan(t2);
          go.push(H.toMau(H.dat(new THREE.BoxGeometry(0.07, 0.6, 0.07), x, y + 0.3, z), '#6b4226'));
          lanCan.push(new THREE.Vector3(x, y + 0.6, z));
        }
        go.push(H.toMau(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lanCan), 30, 0.035, 5, false), '#6b4226'));
      });

      // --- Cabin + mái ---
      var tCabin = tTheoZ(CABIN.zDau);
      var nenCabin = doCaoBoong(tCabin);
      var rongCabin = nuaRong(tCabin) * 1.56, daiCabin = CABIN.zCuoi - CABIN.zDau;
      var zGiuaCabin = (CABIN.zDau + CABIN.zCuoi) / 2;
      var hinhCabin = H.dat(new THREE.BoxGeometry(rongCabin, CABIN.cao, daiCabin), 0, nenCabin + CABIN.cao / 2, zGiuaCabin);
      var mai = nenCabin + CABIN.cao;
      go.push(H.toMau(H.dat(new THREE.BoxGeometry(rongCabin + 0.5, 0.18, daiCabin + 0.7), 0, mai + 0.09, zGiuaCabin), '#5c2a1a'));

      // --- Cột buồm + buồm ---
      var gocBuom = THREE.MathUtils.degToRad(22);   // buồm xoay lệch theo gió
      var mt = new THREE.Matrix4();
      COT_BUOM.forEach(function (cot) {
        var chan = cot.trenMai ? mai + 0.18 : doCaoBoong(tTheoZ(cot.z));
        go.push(H.toMau(H.dat(new THREE.CylinderGeometry(0.11, 0.16, cot.cao, 8), 0, chan + cot.cao / 2, cot.z), '#4a2f1c'));
        // Buồm dựng trong hệ tọa độ riêng rồi xoay quanh cột + dời tới đúng chỗ
        mt.makeRotationY(gocBuom).setPosition(0, chan + cot.buom.cachChan, cot.z);
        buom.push(taoBuom(cot.buom).applyMatrix4(mt));
        taoNepBuom(cot.buom).forEach(function (h) { go.push(h.applyMatrix4(mt)); });
      });

      // --- Cờ đỏ sao vàng trên đỉnh cột chính ---
      var cotChinh = COT_BUOM[1];
      var dinhCot = doCaoBoong(tTheoZ(cotChinh.z)) + cotChinh.cao;
      var co = H.dat(new THREE.PlaneGeometry(1.2, 0.8), 0, dinhCot - 0.5, cotChinh.z + 0.62, 0, Math.PI / 2, 0);
      buom.push(H.toMau(co, '#d42a2a'));
      var hinhSao = new THREE.Shape();
      for (var k = 0; k < 10; k++) {
        var r = k % 2 ? 0.08 : 0.2, g = Math.PI / 2 + k * Math.PI / 5;
        if (k === 0) hinhSao.moveTo(Math.cos(g) * r, Math.sin(g) * r);
        else hinhSao.lineTo(Math.cos(g) * r, Math.sin(g) * r);
      }
      [-1, 1].forEach(function (ben) {
        var sao = new THREE.ShapeGeometry(hinhSao);
        buom.push(H.toMau(H.dat(sao, ben * 0.012, dinhCot - 0.5, cotChinh.z + 0.62, 0, ben * Math.PI / 2, 0), '#ffd84a'));
      });

      // --- Vật liệu ---
      // Gỗ: texture vân gỗ (trắng ngà) × màu từng chi tiết (vertex color)
      var vlGo = HALONG.vaShader(new THREE.MeshLambertMaterial({
        map: taoTextureGo(), vertexColors: true, side: THREE.DoubleSide
      }), {
        ten: 'go-thuyen',
        manhKhaiBao: HALONG.glsl.denBoong,
        manhTruocSuong: 'gl_FragColor.rgb += anhDenBoong(diffuseColor.rgb, 0.0);'
      });
      // Cabin: ban đêm cửa sổ sáng đèn (cộng thêm "mặt nạ" cửa sổ × uDem)
      var vlCabin = HALONG.vaShader(new THREE.MeshLambertMaterial({ map: taoTextureCabin() }), {
        ten: 'cabin',
        uniforms: { uMatNa: { value: taoMatNaCuaSo() } },
        manhKhaiBao: 'uniform sampler2D uMatNa;\nuniform float uDem;\n' + HALONG.glsl.denBoong,
        manhTruocSuong: 'gl_FragColor.rgb += texture2D(uMatNa, vMapUv).rgb * uDem * 2.2 + anhDenBoong(diffuseColor.rgb, 0.0);'
      });
      // Buồm: khi nhìn ngược về phía mặt trời, nắng xuyên qua vải → buồm rực sáng
      var vlBuom = HALONG.vaShader(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), {
        ten: 'buom',
        manhKhaiBao: 'uniform vec3 uMauNang;\n' + HALONG.glsl.denBoong,
        manhTruocSuong: [
          'float nguocNang = max(dot(normalize(vViTriTheGioi - cameraPosition), uHuongMatTroi), 0.0);',
          'gl_FragColor.rgb += diffuseColor.rgb * uMauNang * 0.9 * pow(nguocNang, 4.0) + anhDenBoong(diffuseColor.rgb, 0.55);'
        ].join('\n')
      });

      // --- Đèn lồng: 4 góc mái cabin + 2 giữa mái hai bên ---
      var xMai = rongCabin / 2 + 0.05, yDen = mai - 0.45;
      var viTriDen = [
        [-xMai, CABIN.zDau - 0.1], [xMai, CABIN.zDau - 0.1],
        [-xMai, zGiuaCabin], [xMai, zGiuaCabin],
        [-xMai, CABIN.zCuoi - 0.2], [xMai, CABIN.zCuoi - 0.2]
      ];
      var denLong = [], diemQuang = [];
      HALONG.thuyen.denLongCucBo = [];
      viTriDen.forEach(function (v) {
        denLong = denLong.concat(HALONG.taoDenLong(v[0], yDen, v[1], 1.1));
        diemQuang.push(v[0], yDen, v[1]);
        HALONG.thuyen.denLongCucBo.push(new THREE.Vector3(v[0], yDen, v[1]));
      });

      // --- Gộp: mỗi nhóm vật liệu → 1 draw call ---
      var nhom = new THREE.Group();
      nhom.add(new THREE.Mesh(H.gop(go), vlGo));
      nhom.add(new THREE.Mesh(hinhCabin, vlCabin));
      nhom.add(new THREE.Mesh(H.gop(buom, true), vlBuom));
      nhom.add(new THREE.Mesh(H.gop(denLong), HALONG.vatLieuDenLong()));
      // Quầng sáng quanh đèn (mờ lúc hoàng hôn, rực khi tối)
      nhom.add(HALONG.taoDiemSang({ viTri: diemQuang, mau: '#ffb04a', kichThuoc: 1.8, sangNgay: 0.12, hatGiong: 5 }));

      // Đèn boong soi sáng boong khi trời tối: KHÔNG dùng PointLight thật (xem
      // HALONG.glsl.denBoong) – chỉ lưu vị trí trên thuyền, du-thuyen đổi sang toạ độ thế giới
      HALONG.thuyen.denBoongCucBo = new THREE.Vector3(0, doCaoBoong(tTheoZ(-3)) + 3.2, -3);

      this.el.setObject3D('mesh', nhom);
    },

    remove: function () {
      this.el.removeObject3D('mesh');
    }
  });

  /* =======================================================================
   * 3. Component "du-thuyen": cho thuyền chạy theo lộ trình
   *    Trạng thái:
   *      'dung' : đang neo ở điểm tham quan, đếm ngược thời gian chờ
   *      'chay' : đang chạy tới điểm dừng kế tiếp (tự giảm tốc khi gần tới)
   *    Phát sự kiện 'den-diem-dung' / 'roi-diem-dung' để giao diện hiện bảng.
   * ===================================================================== */
  AFRAME.registerComponent('du-thuyen', {
    schema: {
      tocDo: { default: 5 },             // m/s ≈ 10 hải lý/giờ
      giaToc: { default: 0.6 },          // m/s² – tăng/giảm tốc êm, không giật
      thoiGianDung: { default: 14 },     // giây neo ở mỗi điểm tham quan
      thoiGianDungDau: { default: 8 }    // giây chờ ở điểm xuất phát
    },

    init: function () {
      this.s = 0;                        // vị trí hiện tại dọc lộ trình (m)
      this.v = 0;                        // tốc độ hiện tại (m/s)
      this.trangThai = 'dung';
      this.cho = this.data.thoiGianDungDau;
      this.chiSoDung = 0;                // đang neo ở điểm dừng nào
      this.diemTiep = 1;
      this.p = new THREE.Vector3();
      this.tiepTuyen = new THREE.Vector3();
      this.capNhatTuThe(0);

      this.khiNhanPhim = function (e) {
        // N: rời điểm dừng ngay, không chờ hết giờ
        if (e.code === 'KeyN' && this.trangThai === 'dung' && !HALONG.boQuaPhimTat(e)) this.cho = 0;
      }.bind(this);
      window.addEventListener('keydown', this.khiNhanPhim);

      // báo cho giao diện biết đang ở điểm xuất phát (sau khi scene sẵn sàng)
      var self = this;
      this.el.sceneEl.addEventListener('loaded', function () {
        self.el.emit('den-diem-dung', { chiSo: 0, diem: LO_TRINH.diemDung[0] });
      });
    },

    remove: function () {
      window.removeEventListener('keydown', this.khiNhanPhim);
    },

    tick: function (t, dt) {
      if (!dt) return;
      var giay = Math.min(dt, 100) / 1000;
      var d = this.data, ds = LO_TRINH.diemDung, L = LO_TRINH.doDai;

      if (this.trangThai === 'dung') {
        this.cho -= giay;
        if (this.cho <= 0) {
          this.trangThai = 'chay';
          this.el.emit('roi-diem-dung', { chiSo: this.chiSoDung });
        }
      } else {
        // Quãng đường còn lại tới điểm dừng kế tiếp (lộ trình khép kín → quấn vòng)
        var conLai = ((ds[this.diemTiep].s - this.s) % L + L) % L;
        // Tốc độ mục tiêu: tối đa, nhưng đủ chậm để kịp phanh: v² = 2·a·quãng đường
        var vMucTieu = Math.min(d.tocDo, Math.sqrt(2 * d.giaToc * conLai) + 0.15);
        var thayDoi = THREE.MathUtils.clamp(vMucTieu - this.v, -2 * d.giaToc * giay, d.giaToc * giay);
        this.v = Math.max(this.v + thayDoi, 0);
        var buoc = this.v * giay;
        if (buoc >= conLai || conLai < 0.01) {
          // Tới nơi: neo lại (bước cuối chỉ vài mm → không giật)
          this.s = ds[this.diemTiep].s;
          this.v = 0;
          this.trangThai = 'dung';
          this.cho = d.thoiGianDung;
          this.chiSoDung = this.diemTiep;
          this.diemTiep = (this.diemTiep + 1) % ds.length;
          this.el.emit('den-diem-dung', { chiSo: this.chiSoDung, diem: ds[this.chiSoDung] });
        } else {
          this.s = (this.s + buoc) % L;
        }
      }
      this.capNhatTuThe(t / 1000);
    },

    // Đặt vị trí + hướng thuyền theo vị trí s trên lộ trình, cộng nhấp nhô theo sóng
    capNhatTuThe: function () {
      var L = LO_TRINH.doDai, u = this.s / L;
      LO_TRINH.duongCong.getPointAt(u, this.p);
      LO_TRINH.duongCong.getTangentAt(u, this.tiepTuyen);
      // Mũi thuyền hướng -Z: hướng tiến (-sinθ, -cosθ) = tiếp tuyến → θ = atan2(-tx, -tz)
      var goc = Math.atan2(-this.tiepTuyen.x, -this.tiepTuyen.z);

      // Nhấp nhô: đo độ cao sóng ở giữa, mũi, đuôi, 2 mạn
      var s = Math.sin(goc), c = Math.cos(goc), x = this.p.x, z = this.p.z;
      var h = HALONG.doCaoSong(x, z);
      var hMui = HALONG.doCaoSong(x - s * 9, z - c * 9), hDuoi = HALONG.doCaoSong(x + s * 9, z + c * 9);
      var hPhai = HALONG.doCaoSong(x + c * 2.5, z - s * 2.5), hTrai = HALONG.doCaoSong(x - c * 2.5, z + s * 2.5);

      // Chúi: nước phía mũi cao hơn → mũi ngóc lên (xoay X dương nâng mũi -Z).
      // Lắc: nước mạn phải cao hơn → mạn phải nâng lên (xoay Z dương nâng mạn +X).
      // Nhân 0.35: thuyền nặng, lắc ít hơn mặt sóng (và đỡ say sóng khi đeo kính).
      var doc = Math.atan2(hMui - hDuoi, 18) * 0.35;
      var nghieng = Math.atan2(hPhai - hTrai, 5) * 0.35;
      var o = this.el.object3D;
      o.position.set(x, h * 0.7, z);
      o.rotation.order = 'YXZ';
      o.rotation.set(doc, goc, nghieng);

      // Chia sẻ trạng thái cho các file khác
      var tt = HALONG.thuyen;
      tt.viTri.copy(o.position);
      tt.goc = goc;
      tt.doc = doc;
      tt.nghieng = nghieng;
      tt.tocDo = this.v;
      tt.trangThai = this.trangThai;
      tt.diemTiep = this.diemTiep;
      tt.conLai = ((LO_TRINH.diemDung[this.diemTiep].s - this.s) % L + L) % L;
      tt.cho = Math.max(this.cho, 0);
      HALONG.uniformChung.uThuyen.value.set(x, z, goc, this.v / this.data.tocDo);

      // Vị trí THẾ GIỚI của các đèn lồng (mặt biển dùng để vẽ vệt đèn phản chiếu ban đêm)
      var dem = HALONG.uniformChung.uDem.value;
      if (tt.denLongCucBo) {
        o.updateMatrixWorld();
        if (!tt.denLongTheGioi) tt.denLongTheGioi = tt.denLongCucBo.map(function () { return new THREE.Vector3(); });
        for (var i = 0; i < tt.denLongCucBo.length; i++) {
          tt.denLongTheGioi[i].copy(tt.denLongCucBo[i]).applyMatrix4(o.matrixWorld);
        }
      }
      // Đèn boong: vị trí thế giới + màu × cường độ (45 cd như PointLight cũ), 0 ban ngày
      if (tt.denBoongCucBo) {
        var uc = HALONG.uniformChung;
        uc.uDenBoongViTri.value.copy(tt.denBoongCucBo).applyMatrix4(o.matrixWorld);
        uc.uDenBoongMau.value.copy(MAU_DEN_BOONG).multiplyScalar(dem * 45);
      }
    }
  });
})();
