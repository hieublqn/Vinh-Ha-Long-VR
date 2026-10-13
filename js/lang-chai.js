/* =========================================================================
 * lang-chai.js – LÀNG CHÀI NỔI (component "lang-chai")
 * -------------------------------------------------------------------------
 * Dựng một làng chài trên mặt vịnh (minh họa theo kiểu làng chài Cửa Vạn):
 *   - 10 nhà bè sơn màu đặt trên sàn gỗ + phao nổi, mái tôn, mái hiên,
 *     2 đèn lồng trước hiên; 1 nhà lớn ở giữa.
 *   - Lối đi bằng ván nối các nhà, lồng bè nuôi cá phía sau làng.
 *   - Thuyền nan (thuyền nhỏ dài) và thuyền thúng (thuyền tròn) neo quanh nhà.
 *   - Lưới đánh cá phơi trên sào.
 *
 * Cách làm cho nhẹ máy:
 *   - Mọi bức tường, mái, sàn, thuyền... dùng CHUNG 1 texture "atlas" (1 ảnh
 *     canvas chia 4 vùng) + vertex color để tô màu riêng từng nhà
 *     → cả làng (hàng nghìn tam giác) GỘP thành 1 hình = 1 draw call.
 *   - Ban đêm cửa sổ sáng đèn bằng 1 "mặt nạ" phát sáng cùng bố cục atlas.
 *   - Đèn lồng, lưới, quầng sáng: mỗi loại thêm 1 draw call.
 * Vị trí làng lấy từ HALONG.LO_TRINH (điểm dừng "Làng chài Cửa Vạn").
 * ========================================================================= */
(function () {
  'use strict';

  var HALONG = window.HALONG;

  /* ---------- Atlas 512×512: 4 vùng, mỗi vùng 256×256 ----------
   *   A (trái-trên)  : tường ván có cửa ra vào + cửa sổ (mặt trước nhà)
   *   B (phải-trên)  : tường ván có cửa sổ (mặt bên, mặt sau)
   *   C (trái-dưới)  : mái tôn sóng
   *   D (phải-dưới)  : ván gỗ (sàn, lối đi, thuyền)
   * Toạ độ UV của three.js: v = 0 ở ĐÁY ảnh → vùng trên có v từ 0.5 đến 1. */
  var VUNG = {
    A: [0.0, 0.5, 0.5, 1.0],
    B: [0.5, 0.5, 1.0, 1.0],
    C: [0.0, 0.0, 0.5, 0.5],
    D: [0.5, 0.0, 1.0, 0.5]
  };
  var LE = 4 / 512;   // chừa lề 4 px để mipmap không "lem" màu vùng bên cạnh

  // Vẽ cửa sổ / cửa ra vào ở vùng (ox, oy). matNa = true: chỉ tô phần kính (để phát sáng)
  function veCuaSo(ctx, ox, oy, x, y, w, h, matNa) {
    if (matNa) {
      ctx.fillStyle = '#ffcf7a';
      ctx.fillRect(ox + x, oy + y, w, h);
      ctx.fillStyle = '#000';
      ctx.fillRect(ox + x + w / 2 - 2, oy + y, 4, h);
      return;
    }
    ctx.fillStyle = '#ffffff';                        // khung cửa
    ctx.fillRect(ox + x - 6, oy + y - 6, w + 12, h + 12);
    ctx.fillStyle = '#2d3946';                        // kính
    ctx.fillRect(ox + x, oy + y, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ox + x + w / 2 - 2, oy + y, 4, h);
  }

  function veAtlas(ctx, matNa) {
    var i;
    ctx.fillStyle = matNa ? '#000' : '#f2efe8';
    ctx.fillRect(0, 0, 512, 512);
    if (!matNa) {
      // Ván tường (vùng A, B): các đường kẻ ngang
      for (i = 0; i < 256; i += 18) {
        ctx.fillStyle = 'rgba(60,50,40,0.28)';
        ctx.fillRect(0, i, 512, 2);
      }
      // Mái tôn (vùng C): sọc dọc sáng – tối xen kẽ
      for (i = 0; i < 256; i += 16) {
        ctx.fillStyle = '#d6d6d4';
        ctx.fillRect(i, 256, 8, 256);
        ctx.fillStyle = '#a9a9a6';
        ctx.fillRect(i + 8, 256, 8, 256);
      }
      // Ván gỗ (vùng D): nền vàng nhạt, khe ván + vân gỗ
      ctx.fillStyle = '#e9dcc4';
      ctx.fillRect(256, 256, 256, 256);
      for (i = 256; i < 512; i += 32) {
        ctx.fillStyle = 'rgba(70,45,25,0.55)';
        ctx.fillRect(256, i, 256, 3);
        ctx.fillStyle = 'rgba(120,80,45,0.15)';
        ctx.fillRect(256, i + 12, 256, 2);
      }
    }
    // Vùng A: cửa ra vào (giữa) + 2 cửa sổ
    if (!matNa) {
      ctx.fillStyle = 'rgba(70,45,25,0.85)';
      ctx.fillRect(103, 96, 50, 160);                 // cánh cửa gỗ
    } else {
      ctx.fillStyle = '#c98a3a';
      ctx.fillRect(110, 104, 36, 60);                 // khe cửa hắt sáng
    }
    veCuaSo(ctx, 0, 0, 22, 92, 56, 62, matNa);
    veCuaSo(ctx, 0, 0, 178, 92, 56, 62, matNa);
    // Vùng B: 2 cửa sổ
    veCuaSo(ctx, 256, 0, 40, 92, 60, 64, matNa);
    veCuaSo(ctx, 256, 0, 156, 92, 60, 64, matNa);
  }

  function taoAtlas(matNa) {
    var tex = HALONG.taoTextureCanvas(512, 512, function (ctx) { veAtlas(ctx, matNa); });
    if (matNa) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // Ép UV của 1 hình (đang là 0..1) vào 1 vùng của atlas
  function datVung(hinh, vung, batDau, ketThuc) {
    var uv = hinh.attributes.uv;
    var u0 = vung[0] + LE, v0 = vung[1] + LE, u1 = vung[2] - LE, v1 = vung[3] - LE;
    for (var i = batDau || 0; i < (ketThuc === undefined ? uv.count : ketThuc); i++) {
      uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
    }
    return hinh;
  }

  // Đánh dấu hình HỞ (mái, đầu hồi, tấm hiên, vỏ thuyền) cần vẽ 2 mặt. Hình khối kín (tường,
  // sàn, phao, cột, ván) chỉ vẽ mặt trước → GPU không tô thừa mặt sau bị che (≈ +50% điểm ảnh khi ở gần)
  function haiMat(hinh) { hinh.userData.haiMat = true; return hinh; }

  // Hộp có UV theo atlas: mặt trước (+Z) dùng vùng 'truoc', các mặt khác dùng 'ben'.
  // Thứ tự mặt của BoxGeometry: +X, -X, +Y, -Y, +Z, -Z (mỗi mặt 4 đỉnh).
  function hopAtlas(w, h, d, truoc, ben, tren) {
    var hinh = new THREE.BoxGeometry(w, h, d);
    datVung(hinh, ben, 0, 8);
    datVung(hinh, tren || ben, 8, 16);
    datVung(hinh, truoc, 16, 20);
    datVung(hinh, ben, 20, 24);
    return hinh;
  }

  // Mái hai dốc: nóc chạy theo trục X, 2 mái dốc về trước (+Z) và sau (-Z)
  function taoMai(rong, sau, caoMai) {
    var x = rong / 2, z = sau / 2;
    var viTri = [
      // mái trước
      -x, 0, z, x, 0, z, x, caoMai, 0, -x, caoMai, 0,
      // mái sau
      x, 0, -z, -x, 0, -z, -x, caoMai, 0, x, caoMai, 0
    ];
    var uv = [0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1];
    var hinh = new THREE.BufferGeometry();
    hinh.setAttribute('position', new THREE.Float32BufferAttribute(viTri, 3));
    hinh.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    hinh.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
    hinh.computeVertexNormals();
    return haiMat(datVung(hinh, VUNG.C));
  }

  // Tam giác đầu hồi (bịt 2 đầu mái)
  function taoDauHoi(sau, caoMai) {
    var z = sau / 2;
    var hinh = new THREE.BufferGeometry();
    hinh.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, z, 0, 0, -z, 0, caoMai, 0], 3));
    hinh.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
    hinh.setIndex([0, 1, 2]);
    hinh.computeVertexNormals();
    return haiMat(datVung(hinh, VUNG.B));
  }

  // Bát (nửa quả cầu dưới) + đáy trong: dùng cho thuyền nan / thuyền thúng
  function taoThuyenNho(sx, sy, sz, mau) {
    var H = HALONG.hinh;
    var vo = new THREE.SphereGeometry(1, 14, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    vo.scale(sx, sy, sz);
    var day = new THREE.CircleGeometry(1, 14);
    day.rotateX(-Math.PI / 2);
    day.scale(sx * 0.82, 1, sz * 0.82);
    day.translate(0, -sy * 0.55, 0);
    return [haiMat(H.toMau(datVung(vo, VUNG.D), mau)), H.toMau(datVung(day, VUNG.D), '#2a1d12')];
  }

  /* ---------- 1 căn nhà bè (toạ độ riêng: mặt tiền hướng +Z) ---------- */
  function taoNha(rand, to, mauTuong, mauMai, mauPhao, ketQua) {
    var H = HALONG.hinh;
    var W = (rand.khoang(6.5, 8) * to), D = (rand.khoang(5.8, 6.8) * to);
    var w = W - 1.8, d = D - 2.6, caoTuong = 2.6, sanY = 0.5;
    var ds = ketQua.hinh;

    // Sàn gỗ + phao bên dưới (phao nhô lên khỏi mặt nước một chút)
    ds.push(H.toMau(hopAtlas(W, 0.4, D, VUNG.D, VUNG.D).translate(0, 0.3, 0), '#9a7552'));
    for (var i = -1; i <= 1; i++) {
      [-1, 1].forEach(function (ben) {
        var phao = new THREE.CylinderGeometry(0.36, 0.36, D * 0.9, 10).rotateX(Math.PI / 2);
        ds.push(H.toMau(datVung(phao, VUNG.D).translate(i * W * 0.38 + ben * 0.45, 0.02, 0), mauPhao));
      });
    }
    // Thân nhà (lùi về sau để chừa hiên phía trước)
    var zNha = -D / 2 + d / 2 + 0.3;
    ds.push(H.toMau(hopAtlas(w, caoTuong, d, VUNG.A, VUNG.B, VUNG.D).translate(0, sanY + caoTuong / 2, zNha), mauTuong));
    // Mái hai dốc + 2 đầu hồi
    var caoMai = 1.1 * to, yMai = sanY + caoTuong;
    ds.push(H.toMau(taoMai(w + 0.9, d + 1.0, caoMai).translate(0, yMai, zNha), mauMai));
    [-1, 1].forEach(function (ben) {
      var hoi = taoDauHoi(d, caoMai);
      if (ben < 0) hoi.rotateY(Math.PI);   // tam giác bên -X xoay nửa vòng để mặt quay ra ngoài
      ds.push(H.toMau(hoi.translate(ben * w / 2, yMai, zNha), mauTuong));
    });
    // Mái hiên trước: tấm tôn dốc từ đỉnh tường ra mép sàn + 2 cột
    var zHienTrong = zNha + d / 2, zHienNgoai = D / 2 - 0.15;
    var hien = new THREE.PlaneGeometry(w + 0.6, zHienNgoai - zHienTrong + 0.2);
    hien.rotateX(-Math.PI / 2 + 0.28);
    ds.push(haiMat(H.toMau(datVung(hien, VUNG.C).translate(0, yMai - 0.3, (zHienTrong + zHienNgoai) / 2), mauMai)));
    [-1, 1].forEach(function (ben) {
      ds.push(H.toMau(datVung(new THREE.BoxGeometry(0.12, 2.2, 0.12), VUNG.D)
        .translate(ben * (w / 2 + 0.1), sanY + 1.1, zHienNgoai - 0.1), '#6a4a30'));
    });
    // Đèn lồng treo 2 góc hiên
    [-1, 1].forEach(function (ben) {
      ketQua.denLong.push([ben * (w / 2 + 0.1), yMai - 0.85, zHienNgoai - 0.1]);
    });
    // Vài chậu cây / thùng xốp trên hiên
    if (rand() < 0.7) {
      ds.push(H.toMau(datVung(new THREE.BoxGeometry(0.6, 0.45, 0.45), VUNG.D)
        .translate(rand.khoang(-w / 3, w / 3), sanY + 0.22, zHienNgoai - 0.7), '#e8e8e6'));
    }
    return { rong: W, sau: D };
  }

  AFRAME.registerComponent('lang-chai', {
    schema: {
      hatGiong: { default: 2014 }
    },

    init: function () {
      var dd = HALONG.LO_TRINH.diemDung.filter(function (d) { return d.vatThe && d.vatThe.loai === 'lang-chai'; })[0];
      if (!dd) return;
      var C = dd.vatThe;
      var rand = HALONG.taoRandom(this.data.hatGiong);
      var H = HALONG.hinh;

      // Hệ trục của làng: G hướng về điểm dừng (mặt tiền các nhà quay về phía khách),
      // A vuông góc với G (dọc theo "phố" trên nước)
      var g = Math.atan2(dd.z - C.z, dd.x - C.x);
      var G = { x: Math.cos(g), z: Math.sin(g) }, A = { x: -Math.sin(g), z: Math.cos(g) };
      var gocNha = Math.atan2(G.x, G.z);   // xoay Y để mặt +Z của nhà quay về hướng G
      function diem(u, v) { return { x: C.x + u * A.x + v * G.x, z: C.z + u * A.z + v * G.z }; }

      var ketQua = { hinh: [], denLong: [] };
      var tatCa = [], denLongTG = [], vatCan = [];
      var MAU_TUONG = ['#3f7fbf', '#4f9c6d', '#e6d6b2', '#7db4d8', '#d99a8f', '#5fa8a0', '#f0e2a0'];
      var MAU_MAI = ['#9a4a2c', '#3d5a80', '#8a8d90', '#a0522d', '#2f6f6a'];
      var MAU_PHAO = ['#2b5d9a', '#e6e4dc'];
      var mt = new THREE.Matrix4(), q = new THREE.Quaternion(), truc = new THREE.Vector3(0, 1, 0);

      // Đặt 1 nhóm hình (toạ độ riêng) vào thế giới: xoay theo mặt tiền + dời tới (u, v)
      function datVaoLang(dsHinh, dsDen, u, v, lechGoc) {
        var p = diem(u, v);
        q.setFromAxisAngle(truc, gocNha + (lechGoc || 0));
        mt.compose(new THREE.Vector3(p.x, 0, p.z), q, new THREE.Vector3(1, 1, 1));
        dsHinh.forEach(function (h) { tatCa.push(h.applyMatrix4(mt)); });
        (dsDen || []).forEach(function (d) { denLongTG.push(new THREE.Vector3(d[0], d[1], d[2]).applyMatrix4(mt)); });
        return p;
      }

      // ---- 2 dãy nhà bè: dãy trước 5 nhà, dãy sau 4 nhà xen kẽ + 1 nhà lớn ----
      var nhaList = [];
      [-24, -12, 12, 24].forEach(function (u) { nhaList.push({ u: u, v: 12, to: 1 }); });
      nhaList.push({ u: 0, v: 12, to: 1.35 });                       // nhà lớn ở giữa
      [-18, -6, 6, 18].forEach(function (u) { nhaList.push({ u: u, v: -2, to: 1 }); });
      nhaList.push({ u: 30, v: -2, to: 0.9 });
      nhaList.forEach(function (n, i) {
        ketQua = { hinh: [], denLong: [] };
        var kt = taoNha(rand, n.to, MAU_TUONG[i % MAU_TUONG.length], MAU_MAI[i % MAU_MAI.length],
          MAU_PHAO[i % 2], ketQua);
        var lech = (rand() - 0.5) * 0.12;   // nhà bè không thẳng hàng tuyệt đối
        var p = datVaoLang(ketQua.hinh, ketQua.denLong, n.u, n.v, lech);
        // nhà nhỏ, sát nhau → lề va chạm riêng 0,6 m (đảo dùng 3 m) để còn bay được giữa các dãy nhà
        vatCan.push({ x: p.x, z: p.z, r: Math.max(kt.rong, kt.sau) / 2 + 0.5, cao: 5 * n.to, le: 0.6 });
      });

      // ---- Lối đi ván nối các nhà (dọc mỗi dãy) và nối 2 dãy ----
      // Dựng thẳng trong hệ thế giới: tấm ván dài theo trục Z, xoay về hướng 2 đầu mút
      function loiDi(u1, v1, u2, v2) {
        var a = diem(u1, v1), b = diem(u2, v2);
        var dai = Math.hypot(b.x - a.x, b.z - a.z);
        var van = H.toMau(datVung(new THREE.BoxGeometry(1.3, 0.14, dai), VUNG.D), '#8e6c4a');
        van.rotateY(Math.atan2(b.x - a.x, b.z - a.z));
        tatCa.push(van.translate((a.x + b.x) / 2, 0.42, (a.z + b.z) / 2));
      }
      loiDi(-24, 12, 24, 12);
      loiDi(-18, -2, 30, -2);
      loiDi(-18, -2, -18, 12);
      loiDi(18, -2, 18, 12);

      // ---- Lồng bè nuôi cá: khung gỗ vuông + phao góc + lưới chìm dưới nước ----
      for (var hang = 0; hang < 2; hang++) {
        for (var cot = 0; cot < 4; cot++) {
          var u = -15 + cot * 6.2, v = -13 - hang * 6.2, ds = [];
          [[0, 2.8, 5.6, 0.25], [0, -2.8, 5.6, 0.25], [2.8, 0, 0.25, 5.6], [-2.8, 0, 0.25, 5.6]].forEach(function (k) {
            ds.push(H.toMau(datVung(new THREE.BoxGeometry(k[2], 0.22, k[3]), VUNG.D).translate(k[0], 0.18, k[1]), '#7a5a3c'));
          });
          [[-2.8, -2.8], [2.8, -2.8], [-2.8, 2.8], [2.8, 2.8]].forEach(function (k) {
            ds.push(H.toMau(datVung(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 8), VUNG.D).translate(k[0], 0.05, k[1]), MAU_PHAO[(hang + cot) % 2]));
          });
          var luoiChim = new THREE.PlaneGeometry(5.4, 5.4).rotateX(-Math.PI / 2).translate(0, -0.6, 0);
          ds.push(H.toMau(datVung(luoiChim, VUNG.D), '#18282a'));
          datVaoLang(ds, null, u, v, 0);
        }
      }

      // ---- Thuyền nan (dài) và thuyền thúng (tròn) neo quanh làng ----
      [[-30, 17, 0.4], [-8, 18, -0.3], [17, 18.5, 0.2], [34, 4, 1.2]].forEach(function (b) {
        datVaoLang(taoThuyenNho(0.75, 0.45, 2.3, '#3e2c1d').map(function (h) { return h.translate(0, 0.32, 0); }), null, b[0], b[1], b[2]);
      });
      [[-14, 17.5], [2, 19], [26, 16.5], [-27, 3], [12, 4.5]].forEach(function (b) {
        datVaoLang(taoThuyenNho(0.95, 0.42, 0.95, '#5a4528').map(function (h) { return h.translate(0, 0.3, 0); }), null, b[0], b[1], 0);
      });

      // ---- Sào phơi lưới (cột trong hình chính, lưới là vật liệu riêng có lỗ) ----
      var luoi = [];
      [[-36, 6], [36, 10], [-2, -28]].forEach(function (s, i) {
        var cotSao = [];
        [-1.6, 1.6].forEach(function (x) {
          cotSao.push(H.toMau(datVung(new THREE.CylinderGeometry(0.06, 0.08, 3.4, 6), VUNG.D).translate(x, 1.5, 0), '#5b4330'));
        });
        datVaoLang(cotSao, null, s[0], s[1], i * 0.7);
        var tam = new THREE.PlaneGeometry(3.2, 2.2).translate(0, 1.9, 0);
        var p = diem(s[0], s[1]);
        q.setFromAxisAngle(truc, gocNha + i * 0.7);
        luoi.push(tam.applyMatrix4(mt.compose(new THREE.Vector3(p.x, 0, p.z), q, new THREE.Vector3(1, 1, 1))));
      });

      // ---- Vật liệu ----
      // 2 vật liệu cùng atlas: khối kín vẽ 1 mặt; mái / hiên / vỏ thuyền vẽ 2 mặt để nhìn từ
      // dưới lên vẫn thấy mặt dưới mái (không bị "thủng"). Thêm 1 draw call nhưng đỡ tô thừa nhiều.
      var atlas = taoAtlas(false), matNa = { value: taoAtlas(true) };
      function taoVlLang(ten, side) {
        return HALONG.vaShader(new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true, side: side }), {
          ten: ten,
          uniforms: { uMatNa: matNa },
          manhKhaiBao: 'uniform sampler2D uMatNa;\nuniform float uDem;',
          // ban đêm cửa sổ / khe cửa sáng đèn
          manhTruocSuong: 'gl_FragColor.rgb += texture2D(uMatNa, vMapUv).rgb * uDem * 1.8;'
        });
      }
      var texLuoi = HALONG.taoTextureCanvas(128, 128, function (ctx, w, h) {
        ctx.clearRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(60,70,50,1)';
        ctx.lineWidth = 2;
        for (var k = 0; k <= w; k += 10) {
          ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(k, h); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, k); ctx.lineTo(w, k); ctx.stroke();
        }
      });
      texLuoi.wrapS = texLuoi.wrapT = THREE.RepeatWrapping;
      texLuoi.repeat.set(2, 1.4);
      // alphaTest: điểm ảnh nào gần như trong suốt thì bỏ hẳn → lưới có lỗ thật, không cần sắp xếp trong suốt
      var vlLuoi = HALONG.apDungSuongMu(new THREE.MeshLambertMaterial({
        map: texLuoi, alphaTest: 0.5, side: THREE.DoubleSide, color: '#8a9a78'
      }));

      // Đèn lồng
      var hinhDen = [], diemQuang = [];
      denLongTG.forEach(function (p) {
        hinhDen = hinhDen.concat(HALONG.taoDenLong(p.x, p.y, p.z, 1));
        diemQuang.push(p.x, p.y, p.z);
      });

      var nhom = new THREE.Group();
      nhom.add(new THREE.Mesh(H.gop(tatCa.filter(function (h) { return !h.userData.haiMat; })), taoVlLang('lang-chai', THREE.FrontSide)));
      nhom.add(new THREE.Mesh(H.gop(tatCa.filter(function (h) { return h.userData.haiMat; })), taoVlLang('lang-chai-2mat', THREE.DoubleSide)));
      nhom.add(new THREE.Mesh(H.gop(luoi), vlLuoi));
      nhom.add(new THREE.Mesh(H.gop(hinhDen), HALONG.vatLieuDenLong()));
      nhom.add(HALONG.taoDiemSang({ viTri: diemQuang, mau: '#ffb04a', kichThuoc: 1.6, sangNgay: 0.1, hatGiong: 21 }));
      this.el.setObject3D('mesh', nhom);

      // Chia sẻ: vật cản (không bay xuyên nhà), đèn lồng tĩnh (vệt sáng trên mặt nước ban đêm)
      HALONG.vatCan = HALONG.vatCan.concat(vatCan);
      HALONG.denLongTinh = (HALONG.denLongTinh || []).concat(denLongTG);
      HALONG.langChai = { x: C.x, z: C.z, cacNha: vatCan };
    },

    remove: function () {
      this.el.removeObject3D('mesh');
    }
  });
})();
