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
 *   4. Mỗi khuôn vẽ bằng InstancedMesh: GPU vẽ NHIỀU đảo cùng khuôn chỉ bằng
 *      1 lệnh vẽ (draw call), mỗi đảo có vị trí/xoay/tỉ lệ riêng nên nhìn không
 *      giống nhau. (5 khuôn × 2 mức chi tiết = tối đa 10 lệnh vẽ cho 60 đảo.)
 *   5. LOD (Level of Detail – mức chi tiết): mỗi khuôn có 2 bản, bản "gần"
 *      nhiều tam giác và bản "xa" ít tam giác. Đảo ở xa (đã mờ trong sương)
 *      dùng bản xa → GPU đỡ việc mà mắt không nhận ra khác biệt.
 *   6. Vân đá khi nhìn gần: texture noise chiếu theo 3 trục (triplanar) trong
 *      shader → vách đá có rãnh dọc, tán cây lổn nhổn, không cần UV.
 *   7. ĐẢO NỔI BẬT dựng riêng theo lộ trình: Ti Tốp (có bãi cát + chòi ngắm
 *      cảnh trên đỉnh), Bồ Hòn (nơi có Hang Sửng Sốt), Hòn Gà Chọi.
 * ========================================================================= */
(function () {
  'use strict';

  var HALONG = window.HALONG;
  var smoothstep = HALONG.smoothstep;

  /* Các khuôn đảo ngẫu nhiên (đơn vị: bán kính chân đảo = 1)
   *   cao     : chiều cao so với bán kính chân
   *   vomTu   : từ tỉ lệ độ cao này trở lên, thân bắt đầu bo tròn thành đỉnh
   *   thon    : thân nhỏ dần lên trên bao nhiêu (số âm: phình to ở trên)
   *   nghieng : đỉnh lệch sang một bên (đảo hơi "nghiêng")
   *   ngan    : độ sâu ngấn sóng ở chân đảo (mặc định 0.13 = khoét 13%)
   *   dayNgan : độ dày (chiều cao) ngấn sóng (mặc định 0.06)
   *   goGhe   : độ gồ ghề (mặc định 1)
   *   haiDinh : đỉnh có 2 mỏm
   *   trongSo : khuôn này xuất hiện nhiều hay ít                              */
  var KIEU_DAO = [
    { ten: 'thap-cao', cao: 3.3, vomTu: 0.80, thon: 0.10, nghieng: 0.14, trongSo: 34 },
    { ten: 'thap-vua', cao: 2.3, vomTu: 0.72, thon: 0.06, nghieng: 0.06, trongSo: 30 },
    { ten: 'gu-tron', cao: 1.35, vomTu: 0.45, thon: 0.03, nghieng: 0.0, trongSo: 14 },
    { ten: 'hai-dinh', cao: 2.0, vomTu: 0.58, thon: 0.05, nghieng: 0.0, haiDinh: true, trongSo: 12 },
    { ten: 'dao-det', cao: 0.95, vomTu: 0.50, thon: 0.02, nghieng: 0.0, trongSo: 10 }
  ];

  // Khuôn riêng của các đảo nổi bật
  var KIEU_NOI_BAT = {
    'ti-top': { cao: 2.5, vomTu: 0.62, thon: 0.08, nghieng: 0.06, ngan: 0.1 },
    // Bồ Hòn: khối núi lớn, dài, 2 đỉnh. Đảo to → ngấn sóng mỏng/nông lại (ngấn thật chỉ sâu 1–2 m)
    'bo-hon': { cao: 1.6, vomTu: 0.5, thon: 0.04, nghieng: 0.05, haiDinh: true, ngan: 0.04, dayNgan: 0.025, goGhe: 1.5 },
    // Gà Chọi: thân thắt lại ở chân (ngấn sóng rất sâu), phình ra ở trên, nghiêng vào nhau
    'ga-choi': { cao: 4.4, vomTu: 0.86, thon: -0.25, nghieng: 0.55, ngan: 0.3 }
  };

  // Số đỉnh của từng mức chi tiết
  var CHI_TIET = {
    gan: { soGoc: 56, soTangTren: 40, buocDuoi: 0.03 },
    xa: { soGoc: 22, soTangTren: 14, buocDuoi: 0.1 },
    noiBat: { soGoc: 72, soTangTren: 56, buocDuoi: 0.025 }
  };
  var NGUONG_LOD = 150;        // cách mép đảo hơn 150 m → dùng bản ít chi tiết

  // Bán kính thân đảo tại độ cao y (chưa có noise)
  function banKinhTheoDoCao(y, kieu, hat) {
    var u = Math.max(y, 0) / kieu.cao;          // 0 ở mặt nước → 1 ở đỉnh
    var r = 1 - kieu.thon * u;                   // thon dần lên trên
    // Gờ đá (bậc thềm): phía trên gờ thân lùi vào 5% → tạo mặt bằng nhỏ cho cây mọc
    for (var i = 0; i < hat.bac.length; i++) {
      r *= 1 - 0.05 * smoothstep(hat.bac[i] - 0.012, hat.bac[i] + 0.012, u);
    }
    // Vai tròn: từ 'vomTu' trở lên bán kính co về 0 theo đường siêu elip
    // (số mũ 2.6 > 2 → vai "vuông" hơn hình tròn, giống khối đá vôi)
    if (u > kieu.vomTu) {
      var v = (u - kieu.vomTu) / (1 - kieu.vomTu);
      r *= Math.pow(Math.max(1 - Math.pow(v, 2.6), 0), 1 / 2.6);
    }
    // Ngấn sóng: khoét lõm ngay trên mặt nước (phần vách phía trên nhô ra như mái hiên)
    var day = kieu.dayNgan || 0.06;
    var dNgan = (y - day * 0.8) / day;
    r *= 1 - (kieu.ngan === undefined ? 0.13 : kieu.ngan) * Math.exp(-dNgan * dNgan);
    return r;
  }

  // "Hạt" = các thông số ngẫu nhiên RIÊNG của 1 khuôn. Bản gần và bản xa của
  // cùng 1 khuôn dùng chung hạt → hai bản có cùng dáng, chỉ khác độ mịn.
  function taoHat(rand) {
    var bac = [];
    if (rand() < 0.6) bac.push(rand.khoang(0.3, 0.45));
    if (rand() < 0.4) bac.push(rand.khoang(0.5, 0.68));
    return { lech: rand.khoang(0, 100), huongNghieng: rand.khoang(0, Math.PI * 2), bac: bac };
  }

  // Tạo 1 khuôn đảo → BufferGeometry có vertex color
  function taoKhuonDao(kieu, hat, noise, ct) {
    var SO_GOC = ct.soGoc;                       // số đỉnh trên 1 vòng quanh đảo
    var lech = hat.lech;

    // Các tầng theo chiều cao: dày ở gần mặt nước (để vẽ rõ ngấn sóng), thưa ở trên
    var tang = [];
    var y;
    for (y = -0.3; y < 0.3 - 1e-6; y += ct.buocDuoi) tang.push(y);
    for (var j = 0; j <= ct.soTangTren; j++) tang.push(0.3 + (kieu.cao - 0.3) * j / ct.soTangTren);

    var viTri = [], phu = [];                    // phu: độ cao gốc của từng đỉnh (để tô màu)
    var i, k, goc;
    for (k = 0; k < tang.length; k++) {
      y = tang[k];
      var laDinh = k === tang.length - 1;
      for (i = 0; i < SO_GOC; i++) {
        goc = (i / SO_GOC) * Math.PI * 2;
        var cx = Math.cos(goc), cz = Math.sin(goc);
        var r = banKinhTheoDoCao(y, kieu, hat);

        // Gồ ghề hóa: lấy noise 3D trên mặt trụ (cx, y, cz) → liền mạch quanh đảo
        var khoi = noise.fbm3(cx * 1.1 + lech, y * 0.45, cz * 1.1, 4);       // u lồi lớn
        // rãnh dọc: noise bị "kéo dãn" theo chiều cao (y nhân hệ số nhỏ) → vệt chạy dọc vách,
        // giống các rãnh do nước mưa hòa tan đá vôi (karren)
        var ranh = noise.fbm3(cx * 6.5 + lech, y * 0.18, cz * 6.5, 3);
        // hốc đá nhỏ: tần số cao, cho vách bớt "trơn" khi đảo to
        var hoc = noise.n3(cx * 15 + lech, y * 1.4, cz * 15);
        var gg = kieu.goGhe || 1;
        r *= 1 + gg * (0.42 * (khoi - 0.5) + 0.26 * (ranh - 0.5) + 0.07 * (hoc - 0.5));

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
          cx * r + Math.cos(hat.huongNghieng) * dichNghieng,
          yy,
          cz * r + Math.sin(hat.huongNghieng) * dichNghieng
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
    var rChan = 0, caoNhat = 0;
    for (i = 0; i < pos.count; i++) {
      if (phu[i] >= -0.05 && phu[i] <= 0.6) rChan = Math.max(rChan, Math.hypot(pos.getX(i), pos.getZ(i)));
      caoNhat = Math.max(caoNhat, pos.getY(i));
    }
    hinh.userData.banKinhChan = rChan;
    hinh.userData.caoDinh = caoNhat;
    return hinh;
  }

  /* Texture chi tiết 256×256 (dữ liệu số, không phải ảnh màu):
   *   kênh R = vân đá: noise kéo dãn theo chiều dọc → các rãnh chảy dọc vách
   *   kênh G = vân tán lá: các cụm tròn lổn nhổn như ngọn cây nhìn từ xa     */
  function taoTextureChiTiet() {
    var N = 256, du = new Uint8Array(N * N * 4);
    var n1 = HALONG.taoNoise(101), n2 = HALONG.taoNoise(102), n3 = HALONG.taoNoise(103);
    for (var y = 0; y < N; y++) {
      for (var x = 0; x < N; x++) {
        var u = x / N, v = y / N;
        var da = 0.55 * n1.n2Lap(u * 32, v * 4, 32, 4) + 0.3 * n2.n2Lap(u * 64, v * 32, 64, 32) +
                 0.15 * n3.n2Lap(u * 128, v * 128, 128);
        var la = 0.5 * n1.n2Lap(u * 16, v * 16, 16) + 0.3 * n2.n2Lap(u * 40, v * 40, 40) +
                 0.2 * n3.n2Lap(u * 96, v * 96, 96);
        var k = (y * N + x) * 4;
        du[k] = smoothstep(0.2, 0.8, da) * 255;
        du[k + 1] = smoothstep(0.25, 0.75, la) * 255;
        du[k + 2] = 128;
        du[k + 3] = 255;
      }
    }
    var tex = new THREE.DataTexture(du, N, N, THREE.RGBAFormat);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
  }

  // Vật liệu chung cho mọi đảo: Lambert (rẻ hơn PBR, hợp GPU tích hợp) + vân triplanar.
  // haiMat = true: vẽ cả mặt trong (dùng cho đảo Bồ Hòn có cửa hang khoét lỗ): mặt trong
  // tô gần đen, nhìn qua cửa hang chỉ thấy đá tối chứ không thấy "xuyên" ra trời.
  function taoVatLieuDao(texChiTiet, haiMat) {
    return HALONG.vaShader(new THREE.MeshLambertMaterial({ vertexColors: true, side: haiMat ? THREE.DoubleSide : THREE.FrontSide }), {
      ten: haiMat ? 'dao-2mat' : 'dao',
      uniforms: { uChiTiet: { value: texChiTiet } },
      manhKhaiBao: 'uniform sampler2D uChiTiet;',
      manhSauMau: [
        '// Triplanar: chiếu texture theo 3 trục X, Y, Z rồi trộn theo hướng bề mặt',
        '// → không cần toạ độ UV, vách dựng đứng hay mặt bằng đều không bị kéo giãn.',
        'vec3 nTG = normalize(vPhapTuyenTG);',
        'vec3 trongSo = pow(abs(nTG), vec3(4.0));',
        'trongSo /= (trongSo.x + trongSo.y + trongSo.z);',
        'vec3 pTG = vViTriTheGioi * 0.09;',
        'vec4 van = texture2D(uChiTiet, pTG.zy) * trongSo.x',
        '         + texture2D(uChiTiet, pTG.xz) * trongSo.y',
        '         + texture2D(uChiTiet, pTG.xy) * trongSo.z;',
        '// màu gốc là cây xanh (G > R) → dùng vân tán lá, còn lại dùng vân đá',
        'float laCay = smoothstep(0.0, 0.03, diffuseColor.g - diffuseColor.r);',
        'diffuseColor.rgb *= mix(0.62 + 0.76 * van.r, 0.55 + 0.9 * van.g, laCay);',
        haiMat ? 'if (!gl_FrontFacing) diffuseColor.rgb *= 0.06;   // mặt trong đảo: tối như hang' : ''
      ].join('\n')
    });
  }

  /* ---------- Đảo nổi bật ---------- */
  // Bãi cát hình lưỡi liềm ở chân đảo, quay về hướng 'gocHuong'.
  // rDao = bán kính chân đảo lớn nhất → bãi bắt đầu hơi lấn vào chân vách và trải ra biển.
  function taoBaiCat(cx, cz, rDao, gocHuong) {
    var NA = 18, NR = 8, viTri = [], mau = [], chiSo = [], c = new THREE.Color();
    var KHO = new THREE.Color('#ead9b0'), UOT = new THREE.Color('#b9a37d'), NGAP = new THREE.Color('#7f8a73');
    for (var i = 0; i <= NA; i++) {
      var a = (i / NA) * 2 - 1;                  // -1 → 1 dọc theo bờ
      var g = gocHuong + a * 0.75;
      for (var j = 0; j <= NR; j++) {
        var f = j / NR;                          // 0 = sát vách đá, 1 = ra tới nước
        var r = rDao * 0.8 + 24 * f;
        // dốc thoải ra biển (phần trên mặt nước rộng ~12 m), 2 đầu lưỡi liềm chìm xuống
        var y = 1.5 - 2.6 * Math.pow(f, 1.3) - 1.8 * a * a;
        viTri.push(cx + Math.cos(g) * r, y, cz + Math.sin(g) * r);
        c.copy(y > 0.25 ? KHO : y > -0.1 ? UOT : NGAP);
        mau.push(c.r, c.g, c.b);
      }
    }
    for (i = 0; i < NA; i++) {
      for (j = 0; j < NR; j++) {
        var p = i * (NR + 1) + j, q = p + NR + 1;
        // Thứ tự đỉnh NGƯỢC chiều kim đồng hồ khi nhìn từ trên xuống → mặt trước
        // hướng lên trời (three.js mặc định bỏ không vẽ mặt sau)
        chiSo.push(p, q, p + 1, q, q + 1, p + 1);
      }
    }
    var hinh = new THREE.BufferGeometry();
    hinh.setAttribute('position', new THREE.Float32BufferAttribute(viTri, 3));
    hinh.setAttribute('color', new THREE.Float32BufferAttribute(mau, 3));
    hinh.setIndex(chiSo);
    hinh.computeVertexNormals();
    return hinh;
  }

  // Chòi ngắm cảnh mái ngói 4 cột trên đỉnh đảo
  function taoChoi(x, y, z) {
    var H = HALONG.hinh, ds = [];
    ds.push(H.toMau(H.dat(new THREE.BoxGeometry(3.4, 0.4, 3.4), x, y, z), '#9a8f80'));
    [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(function (g) {
      ds.push(H.toMau(H.dat(new THREE.BoxGeometry(0.24, 2.6, 0.24), x + g[0] * 1.35, y + 1.5, z + g[1] * 1.35), '#7b2f1d'));
    });
    ds.push(H.toMau(H.dat(new THREE.ConeGeometry(2.7, 1.7, 4), x, y + 3.65, z, 0, Math.PI / 4, 0), '#8d3a22'));
    return ds;
  }

  // Dựng 1 đảo nổi bật đã đặt đúng chỗ trong thế giới (không dùng instancing)
  function dungDao(kieu, hat, noise, x, z, s, sx, sy, sz, xoay) {
    var hinh = taoKhuonDao(kieu, hat, noise, CHI_TIET.noiBat);
    var mt = new THREE.Matrix4().compose(
      new THREE.Vector3(x, 0, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), xoay),
      new THREE.Vector3(s * sx, s * sy, s * sz));
    var bk = s * hinh.userData.banKinhChan;
    var rChan = bk * Math.max(sx, sz);           // bán kính lớn nhất (để chừa chỗ, chừa luồng)
    var cao = s * sy * hinh.userData.caoDinh;
    hinh.applyMatrix4(mt);
    return {
      hinh: hinh, x: x, z: z, rChan: rChan, cao: cao,
      rX: bk * sx, rZ: bk * sz, xoay: xoay,      // 2 bán trục elip + góc xoay (để xét va chạm)
      rPhanChieu: bk * Math.sqrt(sx * sz)        // bán kính "trung bình" cho bóng phản chiếu
    };
  }

  function taoDaoNoiBat(noise) {
    var hinhGop = [], hinhHaiMat = [], dsDao = [];
    HALONG.daoNoiBat = {};
    HALONG.LO_TRINH.diemDung.forEach(function (dd, so) {
      var vt = dd.vatThe;
      if (!vt) return;
      var rand = HALONG.taoRandom(7000 + so);
      var hat = taoHat(rand);
      var gocToiDiemDung = Math.atan2(dd.z - vt.z, dd.x - vt.x);   // hướng từ vật thể nhìn ra điểm dừng
      var dao;
      if (vt.loai === 'ti-top') {
        dao = dungDao(KIEU_NOI_BAT['ti-top'], hat, noise, vt.x, vt.z, 18, 1, 1.25, 1, 0.4);
        hinhGop.push(dao.hinh, taoBaiCat(vt.x, vt.z, dao.rChan, gocToiDiemDung));
        // tìm đỉnh cao nhất để đặt chòi
        var pos = dao.hinh.attributes.position, iDinh = 0;
        for (var i = 1; i < pos.count; i++) if (pos.getY(i) > pos.getY(iDinh)) iDinh = i;
        taoChoi(pos.getX(iDinh), pos.getY(iDinh) - 0.9, pos.getZ(iDinh)).forEach(function (h) {
          h.deleteAttribute('uv');
          hinhGop.push(h);
        });
        dsDao.push(dao);
      } else if (vt.loai === 'bo-hon') {
        dao = dungDao(KIEU_NOI_BAT['bo-hon'], hat, noise, vt.x, vt.z, 38, 1.4, 1.05, 0.85, gocToiDiemDung + 1.2);
        // Khoét cửa Hang Sửng Sốt vào vách quay về phía điểm dừng (hang-dong.js)
        if (HALONG.HangDong) {
          HALONG.HangDong.khoet(dao.hinh, { x: vt.x, z: vt.z, goc: gocToiDiemDung });
          hinhHaiMat.push(dao.hinh);
        } else {
          hinhGop.push(dao.hinh);
        }
        dsDao.push(dao);
      } else if (vt.loai === 'ga-choi') {
        // 2 hòn đá đứng 2 bên, trục nối 2 hòn vuông góc với hướng nhìn từ điểm dừng
        var trucX = -Math.sin(gocToiDiemDung), trucZ = Math.cos(gocToiDiemDung);
        [[-1, 2.6], [1, 2.3]].forEach(function (ben) {
          var x = vt.x + trucX * ben[0] * 4.5, z = vt.z + trucZ * ben[0] * 4.5;
          var hatRieng = taoHat(rand);
          hatRieng.huongNghieng = Math.atan2(-trucZ * ben[0], -trucX * ben[0]);   // nghiêng về phía hòn kia
          hatRieng.bac = [];
          dao = dungDao(KIEU_NOI_BAT['ga-choi'], hatRieng, noise, x, z, ben[1], 1, 1, 1, 0);
          hinhGop.push(dao.hinh);
          dsDao.push(dao);
        });
      } else {
        return;                                   // làng chài: Mốc 3 dựng nhà bè
      }
      HALONG.daoNoiBat[vt.loai] = { x: vt.x, z: vt.z, gocToiDiemDung: gocToiDiemDung };
    });
    return {
      hinh: hinhGop.length ? HALONG.hinh.gop(hinhGop) : null,
      hinhHaiMat: hinhHaiMat.length ? HALONG.hinh.gop(hinhHaiMat) : null,
      dsDao: dsDao
    };
  }

  AFRAME.registerComponent('dao-da-voi', {
    schema: {
      soDao: { default: 60 },
      // Seed = 1994: năm Vịnh Hạ Long được UNESCO ghi vào Danh sách Di sản Thế giới
      hatGiong: { default: 1994 },
      banKinhVung: { default: 480 },              // rải đảo trong vòng tròn bán kính này (m)
      soCum: { default: 9 },                      // số cụm đảo
      chuaLoiMatTroi: { default: true }           // chừa "lối nhìn" ra mặt trời từ điểm xuất phát
    },

    init: function () {
      var d = this.data;
      var rand = HALONG.taoRandom(d.hatGiong);
      var noise = HALONG.taoNoise(d.hatGiong);
      var texChiTiet = taoTextureChiTiet();
      var vatLieu = taoVatLieuDao(texChiTiet, false);
      var nhom = new THREE.Group();

      // 1) Các khuôn: mỗi khuôn 1 hạt, 2 mức chi tiết
      var khuon = KIEU_DAO.map(function (kieu) {
        var hat = taoHat(rand);
        return {
          gan: taoKhuonDao(kieu, hat, noise, CHI_TIET.gan),
          xa: taoKhuonDao(kieu, hat, noise, CHI_TIET.xa)
        };
      });

      // 2) Đảo nổi bật (gộp thành 1 hình, luôn vẽ chi tiết cao)
      var noiBat = taoDaoNoiBat(noise);
      if (noiBat.hinh) nhom.add(new THREE.Mesh(noiBat.hinh, vatLieu));
      if (noiBat.hinhHaiMat) nhom.add(new THREE.Mesh(noiBat.hinhHaiMat, taoVatLieuDao(texChiTiet, true)));

      // 3) Rải đảo ngẫu nhiên
      var dsDao = this.raiDao(rand, khuon, noiBat.dsDao);

      // 4) Mỗi khuôn: 2 InstancedMesh (gần / xa). Đảo nào dùng bản nào sẽ
      //    được chia lại trong tick() theo khoảng cách tới người xem.
      var maTran = new THREE.Matrix4(), q = new THREE.Quaternion(), viTri = new THREE.Vector3(),
          tiLe = new THREE.Vector3(), trucY = new THREE.Vector3(0, 1, 0);
      this.cacNhom = khuon.map(function (k, kieuSo) {
        var cacDao = dsDao.filter(function (dao) { return dao.kieu === kieuSo; });
        cacDao.forEach(function (dao) {
          viTri.set(dao.x, 0, dao.z);
          q.setFromAxisAngle(trucY, dao.xoay);
          tiLe.set(dao.s * dao.sx, dao.s * dao.sy, dao.s * dao.sz);
          dao.maTran = maTran.compose(viTri, q, tiLe).clone();
          dao.dangGan = null;
        });
        var soLuong = Math.max(cacDao.length, 1);
        var gan = new THREE.InstancedMesh(k.gan, vatLieu, soLuong);
        var xa = new THREE.InstancedMesh(k.xa, vatLieu, soLuong);
        // Đảo rải khắp xung quanh người xem → tắt kiểm tra "ngoài khung nhìn" cho cả nhóm
        gan.frustumCulled = xa.frustumCulled = false;
        gan.count = xa.count = 0;
        nhom.add(gan, xa);
        return { dao: cacDao, gan: gan, xa: xa };
      });
      this.el.setObject3D('mesh', nhom);

      // 5) Chia sẻ dữ liệu: vật cản cho dieu-khien.js, danh sách đảo cho bien.js / minimap
      var tatCa = noiBat.dsDao.concat(dsDao);
      HALONG.dsDao = tatCa;
      HALONG.vatCan = HALONG.vatCan.concat(tatCa.map(function (dao) {
        return { x: dao.x, z: dao.z, r: dao.rChan, rX: dao.rX, rZ: dao.rZ, xoay: dao.xoay, cao: dao.cao };
      }));

      this.viTriCam = new THREE.Vector3();
      this.lanCapNhat = -Infinity;
      this.chiaMucChiTiet();
      // Báo cho các component phụ thuộc đảo (hang động...) biết đảo đã dựng xong
      this.el.sceneEl.emit('dao-da-xong');
    },

    tick: function (t) {
      if (t - this.lanCapNhat < 250) return;     // 4 lần/giây là đủ
      this.lanCapNhat = t;
      this.chiaMucChiTiet();
    },

    // Chia đảo vào bản "gần" / "xa" theo khoảng cách. Chỉ gửi lại dữ liệu
    // xuống GPU khi có đảo đổi nhóm.
    chiaMucChiTiet: function () {
      var cam = HALONG.viTriCamera(this.el.sceneEl, this.viTriCam);
      this.cacNhom.forEach(function (nh) {
        var doi = false;
        nh.dao.forEach(function (dao) {
          var gan = Math.hypot(dao.x - cam.x, dao.z - cam.z) - dao.rChan < NGUONG_LOD;
          if (gan !== dao.dangGan) { dao.dangGan = gan; doi = true; }
        });
        if (!doi) return;
        var nGan = 0, nXa = 0;
        nh.dao.forEach(function (dao) {
          if (dao.dangGan) nh.gan.setMatrixAt(nGan++, dao.maTran);
          else nh.xa.setMatrixAt(nXa++, dao.maTran);
        });
        nh.gan.count = nGan; nh.xa.count = nXa;
        // count = 0 thì three.js không vẽ, nhưng vẫn duyệt và chuẩn bị shader cho vật thể → ẩn hẳn cho gọn
        nh.gan.visible = nGan > 0; nh.xa.visible = nXa > 0;
        nh.gan.instanceMatrix.needsUpdate = true;
        nh.xa.instanceMatrix.needsUpdate = true;
      });
    },

    // Rải đảo ngẫu nhiên có seed: phần lớn tụ thành cụm (giống thực tế),
    // chừa luồng cho thuyền, chừa chỗ cho đảo nổi bật / làng chài.
    raiDao: function (rand, khuon, daoNoiBat) {
      var d = this.data;
      var LT = HALONG.LO_TRINH;
      var trongSo = KIEU_DAO.map(function (k) { return k.trongSo; });
      var xp = { x: LT.diem[0][0], z: LT.diem[0][1] };
      var huongTroi = HALONG.tinhHuongMatTroi(HALONG.BANG_MAU.hoangHon);
      var hx = huongTroi.x, hz = huongTroi.z, dai = Math.hypot(hx, hz);
      hx /= dai; hz /= dai;
      var vungCam = LT.diemDung.filter(function (dd) { return dd.vatThe; }).map(function (dd) {
        return { x: dd.vatThe.x, z: dd.vatThe.z, r: dd.vatThe.banKinh + 15 };
      });

      // Số ngẫu nhiên phân phối chuẩn (Box–Muller) → đảo dày ở tâm cụm, thưa dần ra ngoài
      function gauss() {
        var u1 = Math.max(rand(), 1e-9), u2 = rand(), r = Math.sqrt(-2 * Math.log(u1));
        return [r * Math.cos(2 * Math.PI * u2), r * Math.sin(2 * Math.PI * u2)];
      }

      var cum = [], thu = 0, goc, kc;
      while (cum.length < d.soCum && thu++ < 1000) {
        goc = rand() * Math.PI * 2; kc = rand.khoang(110, d.banKinhVung - 50);
        var cx = Math.cos(goc) * kc, cz = Math.sin(goc) * kc;
        if (LT.khoangCachToi(cx, cz) > 45) cum.push({ x: cx, z: cz });
      }

      var ds = [];
      thu = 0;
      while (ds.length < d.soDao && thu++ < 40000) {
        var x, z;
        if (cum.length && rand() < 0.7) {
          var c = cum[Math.floor(rand() * cum.length)], g = gauss();
          x = c.x + g[0] * 55; z = c.z + g[1] * 55;
        } else {
          goc = rand() * Math.PI * 2; kc = Math.sqrt(rand()) * d.banKinhVung;   // sqrt → đều theo diện tích
          x = Math.cos(goc) * kc; z = Math.sin(goc) * kc;
        }
        var tuTam = Math.hypot(x, z);
        if (tuTam > d.banKinhVung) continue;
        var kieu = rand.chonTheoTrongSo(trongSo);
        // đảo ở rìa vịnh to hơn một chút → làm "phông nền" núi xa
        var s = rand.khoang(6, 19) * (1 + 0.5 * smoothstep(260, 480, tuTam));
        var sx = rand.khoang(0.8, 1.25), sz = rand.khoang(0.8, 1.25), sy = rand.khoang(0.8, 1.3);
        var xoay = rand() * Math.PI * 2;
        var rChan = s * khuon[kieu].gan.userData.banKinhChan * Math.max(sx, sz);

        // Không quá gần điểm xuất phát
        if (Math.hypot(x - xp.x, z - xp.z) < rChan + 45) continue;
        // Chừa luồng cho thuyền: mép đảo cách lộ trình ít nhất 24 m
        if (LT.khoangCachToi(x, z) < rChan + 24) continue;
        // Chừa lối nhìn ra mặt trời từ điểm xuất phát
        if (d.chuaLoiMatTroi) {
          var dx = x - xp.x, dz = z - xp.z;
          var doc = dx * hx + dz * hz;                // khoảng cách dọc theo tia
          var ngang = Math.abs(dx * hz - dz * hx);    // khoảng cách vuông góc tới tia
          if (doc > 0 && doc < 420 && ngang < rChan + 16) continue;
        }
        // Không lấn chỗ của đảo nổi bật / làng chài
        var lan = vungCam.some(function (v) { return Math.hypot(v.x - x, v.z - z) < v.r + rChan; });
        if (lan) continue;
        // Không chồng lên đảo khác
        var chong = ds.concat(daoNoiBat).some(function (o) {
          return Math.hypot(o.x - x, o.z - z) < o.rChan + rChan + 8;
        });
        if (chong) continue;

        ds.push({
          x: x, z: z, kieu: kieu, s: s, sx: sx, sy: sy, sz: sz, xoay: xoay, rChan: rChan,
          rX: rChan / Math.max(sx, sz) * sx, rZ: rChan / Math.max(sx, sz) * sz,
          rPhanChieu: rChan / Math.max(sx, sz) * Math.sqrt(sx * sz),
          cao: s * sy * khuon[kieu].gan.userData.caoDinh
        });
      }
      if (ds.length < d.soDao) console.warn('dao-da-voi: chỉ đặt được ' + ds.length + '/' + d.soDao + ' đảo');
      return ds;
    },

    remove: function () {
      this.el.removeObject3D('mesh');
    }
  });
})();
