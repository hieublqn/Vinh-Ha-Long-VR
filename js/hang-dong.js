/* =========================================================================
 * hang-dong.js – HANG SỬNG SỐT TRONG ĐẢO BỒ HÒN (component "hang-dong")
 * -------------------------------------------------------------------------
 * 1. KHOÉT CỬA HANG: dao-da-voi.js dựng đảo Bồ Hòn rồi gọi
 *    HALONG.HangDong.khoet(): tìm điểm trên vách quay về phía điểm dừng,
 *    xóa các tam giác của đảo nằm trong một ô hình vòm → vách có lỗ thật.
 *    (Đảo Bồ Hòn được vẽ 2 mặt, mặt trong tô gần đen → nhìn qua khe hở chỉ
 *    thấy đá tối, không thấy "xuyên" ra trời.)
 * 2. LÒNG HANG: đường hầm (TubeGeometry) dẫn từ cửa vào một khoang rộng hình
 *    elip méo (quả cầu bị bóp + noise cho vách sần sùi, sàn phẳng).
 *    Vẽ CẢ 2 MẶT: chỗ hầm nối khoang chồng lên nhau một chút thay vì hở khe,
 *    nên nhìn từ góc nào cũng thấy đá, không lọt ra mặt biển / ruột đảo.
 * 3. NHŨ ĐÁ: ~170 chiếc (thạch nhũ rủ từ trần + măng đá mọc từ sàn) vẽ bằng
 *    InstancedMesh = 1 draw call. Đầu nhũ phát quang xanh / tím.
 * 4. ÁNH SÁNG: hang tối, không dùng nắng/ánh trời của bầu trời. Shader tự
 *    tính 4 "đèn màu" (như đèn chiếu trong hang thật) + ánh sáng ban ngày hắt
 *    vào từ cửa → không tốn đèn thật của three.js. Thêm đốm sáng lơ lửng.
 * 5. VÙNG BAY ĐƯỢC: HALONG.hangDong.trong(p) / kep(p) để dieu-khien.js cho
 *    phép bay qua cửa vào hang (bỏ va chạm của đảo) nhưng không xuyên vách.
 * ========================================================================= */
(function () {
  'use strict';

  var HALONG = window.HALONG;

  var CUA = { rong: 11, cao: 9, day: 1.6 };            // ô cửa hình vòm (m)
  var HAM = { rx: 15, ry: 9, rz: 13, sau: 29 };         // khoang hang: 3 bán trục + độ sâu tâm tính từ cửa
  var SAN_Y = 2.4;                                       // độ cao sàn hang (trên mặt nước)
  var BAN_KINH_HAM = 4.6;                                // bán kính đường hầm

  HALONG.HangDong = {
    /* Khoét cửa hang vào hình đảo (toạ độ thế giới).
     * tt = { x, z: tâm đảo, goc: hướng (radian, atan2(dz, dx)) từ tâm đảo ra điểm dừng,
     *        elip: { x, z, rX, rZ, xoay } elip va chạm của đảo (để nối vùng bay hang ra ngoài elip) } */
    khoet: function (hinh, tt) {
      var pos = hinh.attributes.position;
      var nx = Math.cos(tt.goc), nz = Math.sin(tt.goc);
      var i;

      // 1) Điểm mặt vách S: trong các đỉnh cao 4–8 m nằm đúng hướng goc, lấy đỉnh xa tâm nhất
      var rMax = 0;
      for (i = 0; i < pos.count; i++) {
        var y = pos.getY(i);
        if (y < 4 || y > 8) continue;
        var dx = pos.getX(i) - tt.x, dz = pos.getZ(i) - tt.z;
        var lech = Math.atan2(dz, dx) - tt.goc;
        lech = Math.atan2(Math.sin(lech), Math.cos(lech));          // đưa về [-π, π]
        if (Math.abs(lech) < 0.06) rMax = Math.max(rMax, Math.hypot(dx, dz));
      }
      var S = new THREE.Vector3(tt.x + nx * rMax, 6, tt.z + nz * rMax);
      var n = new THREE.Vector3(nx, 0, nz);                        // hướng ra ngoài vách
      var A = new THREE.Vector3(-nz, 0, nx);                       // hướng ngang dọc vách

      // 2) Đỉnh nằm trong ô cửa hình vòm (chỉ ở lớp vách gần S, không đụng mặt bên kia đảo):
      //    lưới đảo thưa (~4 m một cột đỉnh) nên nếu chỉ xoá tam giác thì lỗ ra hình chữ nhật.
      //    Thay vào đó kéo từng đỉnh ra MÉP vòm gần nhất (cung elip hoặc đường đáy cửa)
      //    → mép lỗ bám theo hình vòm, rồi mới bỏ các tam giác nằm gọn trong lỗ.
      var nuaRong = CUA.rong / 2;
      var trongCua = new Uint8Array(pos.count);
      for (i = 0; i < pos.count; i++) {
        var rx = pos.getX(i) - S.x, rz = pos.getZ(i) - S.z, yy = pos.getY(i);
        var ngang = rx * A.x + rz * A.z, sau = rx * n.x + rz * n.z;
        if (sau < -14 || sau > 6 || yy <= CUA.day) continue;
        var u = ngang / nuaRong, w = (yy - CUA.day) / CUA.cao;      // toạ độ chuẩn hoá: vòm = nửa đường tròn đơn vị
        var r = Math.hypot(u, w);
        if (r >= 1) continue;
        trongCua[i] = 1;
        var ngangMoi, yMoi;
        if (yy - CUA.day < (1 - r) * Math.min(nuaRong, CUA.cao)) {
          ngangMoi = ngang; yMoi = CUA.day;                           // gần đáy cửa hơn → hạ xuống đáy
        } else {
          ngangMoi = (u / r) * nuaRong; yMoi = CUA.day + (w / r) * CUA.cao;   // đẩy ra cung vòm
        }
        pos.setXYZ(i, pos.getX(i) + A.x * (ngangMoi - ngang), yMoi, pos.getZ(i) + A.z * (ngangMoi - ngang));
      }

      // 3) Bỏ tam giác có cả 3 đỉnh nằm trong ô cửa (tam giác còn 1–2 đỉnh ngoài thì giữ:
      //    chúng bị kéo căng tới mép vòm và chính là viền cửa hang)
      var cu = hinh.index.array, moi = [];
      for (i = 0; i < cu.length; i += 3) {
        if (trongCua[cu[i]] && trongCua[cu[i + 1]] && trongCua[cu[i + 2]]) continue;
        moi.push(cu[i], cu[i + 1], cu[i + 2]);
      }
      hinh.setIndex(moi);
      pos.needsUpdate = true;
      hinh.computeVertexNormals();

      // 4) Lưu thông số để component dựng lòng hang
      var nVao = n.clone().negate();                               // hướng đi sâu vào trong
      var Cc = S.clone().addScaledVector(nVao, HAM.sau);
      Cc.y = 7;
      HALONG.hangDong = taoThongTinHang(S, n, A, Cc, tt.elip);
      return HALONG.hangDong;
    }
  };

  /* ---------- Vùng bay được trong hang: PHỄU trước cửa + đường hầm + khoang (elip) ----------
   * Đảo Bồ Hòn có elip va chạm (cộng lề 3 m) nhô ra ~8 m trước vách. Nếu vùng hầm chỉ thò ra
   * ngoài vài mét thì: (1) gặp "tường vô hình" 8 m trước cửa hang, (2) lúc bay ra, vừa rời
   * vùng hầm là bị elip của đảo đẩy văng ra mép elip trong 1 khung hình.
   * → Vùng bay kéo dài thành cái PHỄU vượt ra NGOÀI elip va chạm: miệng phễu rộng ở ngoài
   *   biển, thu dần về bán kính hầm ở chân vách. Chỉ coi là "đã ra khỏi hang" khi đã ra
   *   ngoài elip va chạm → không bao giờ bị đẩy giật. */
  var LE_RA = 3.5;              // > lề va chạm đảo (3 m) của dieu-khien → ra khỏi phễu là ngoài elip
  var R_MIENG_PHEU = 5;         // bán kính miệng phễu ngoài biển (m)

  function taoThongTinHang(S, n, A, Cc, elip) {
    var nVao = n.clone().negate();
    // Elip va chạm của đảo (cùng quy ước xoay với dieu-khien.js), nới thêm LE_RA
    var cs = 0, sn = 0, ax = 0, az = 0;
    if (elip) {
      cs = Math.cos(elip.xoay || 0); sn = Math.sin(elip.xoay || 0);
      ax = elip.rX + LE_RA; az = elip.rZ + LE_RA;
    }
    function heElip(x, z) {                      // toạ độ chuẩn hoá: < 1 là còn trong elip
      var dx = x - elip.x, dz = z - elip.z;
      return Math.hypot((dx * cs - dz * sn) / ax, (dx * sn + dz * cs) / az);
    }
    // Từ S đi ra theo n bao xa thì ra khỏi elip: giải phương trình bậc 2 theo t
    var dai = 10;
    if (elip) {
      var lx0 = (S.x - elip.x) * cs - (S.z - elip.z) * sn, lz0 = (S.x - elip.x) * sn + (S.z - elip.z) * cs;
      var ux = n.x * cs - n.z * sn, uz = n.x * sn + n.z * cs;
      var qa = ux * ux / (ax * ax) + uz * uz / (az * az);
      var qb = 2 * (lx0 * ux / (ax * ax) + lz0 * uz / (az * az));
      var qc = lx0 * lx0 / (ax * ax) + lz0 * lz0 / (az * az) - 1;
      var delta = qb * qb - 4 * qa * qc;
      if (delta > 0) dai = Math.max((-qb + Math.sqrt(delta)) / (2 * qa), 0) + 3;   // thò thêm 3 m ra ngoài elip
    }
    var dauNgoai = S.clone().addScaledVector(n, dai);   // miệng phễu (ngoài biển)
    dauNgoai.y = 4.6;
    var dauTrong = Cc.clone(); dauTrong.y = 5;
    var rHam = BAN_KINH_HAM - 1.2;                     // chừa lề để đầu không chạm vách hầm
    var e = { rx: HAM.rx - 1.6, ry: HAM.ry - 1.6, rz: HAM.rz - 1.6 };
    var tam = new THREE.Vector3(), d = new THREE.Vector3();

    function truocVach(p) { return (p.x - S.x) * n.x + (p.z - S.z) * n.z; }   // > 0: ở ngoài vách
    // Điểm gần nhất trên đoạn thẳng trục hầm
    function chieuLenTruc(p, ketQua) {
      d.subVectors(dauTrong, dauNgoai);
      var t = THREE.MathUtils.clamp(tam.subVectors(p, dauNgoai).dot(d) / d.lengthSq(), 0, 1);
      return ketQua.copy(dauNgoai).addScaledVector(d, t);
    }
    // Bán kính vùng bay tại 1 điểm trên trục: trong vách = bán kính hầm, ngoài vách nở dần ra miệng phễu
    function banKinhTai(diemTruc) {
      var ra = truocVach(diemTruc);
      return ra <= 0 ? rHam : rHam + (R_MIENG_PHEU - rHam) * Math.min(ra / dai, 1);
    }
    // Toạ độ của p trong hệ trục khoang (đơn vị: bán trục) → |q| < 1 là ở trong khoang
    function heKhoang(p) {
      var rx = p.x - Cc.x, ry = p.y - Cc.y, rz = p.z - Cc.z;
      return { a: (rx * A.x + rz * A.z) / e.rx, b: ry / e.ry, c: (rx * nVao.x + rz * nVao.z) / e.rz };
    }
    var truc = new THREE.Vector3();

    return {
      S: S, n: n, A: A, nVao: nVao, Cc: Cc, sanY: SAN_Y,
      daiPheu: dai,
      // chỗ đứng khi "vào hang" (Mốc 4 dùng cho nút dịch chuyển vào hang)
      viTriTrong: Cc.clone().addScaledVector(n, 6).setY(SAN_Y),
      trong: function (p) {
        if (p.distanceTo(chieuLenTruc(p, truc)) < banKinhTai(truc)) return true;
        var k = heKhoang(p);
        return k.a * k.a + k.b * k.b + k.c * k.c < 1;
      },
      // Đã ra khỏi hang qua cửa? = đã ra ngoài elip va chạm của đảo (nên không bị đảo đẩy giật)
      raNgoaiCua: function (p) {
        return elip ? heElip(p.x, p.z) >= 1 : truocVach(p) > 1;
      },
      // Đầu thấp nhất được phép: trong hầm/khoang cao hơn sàn hang 1,5 m; ngoài phễu (trên
      // mặt nước) hạ dần về 1,6 m trong 6 m → không bị nhấc giật lên khi vừa vào phễu
      doCaoDauToiThieu: function (p) {
        var k = THREE.MathUtils.clamp(truocVach(p) / 6, 0, 1);
        return SAN_Y + 1.5 + (1.6 - SAN_Y - 1.5) * k;
      },
      // Kéo p về điểm gần nhất còn nằm trong hang (hầm hoặc khoang)
      kep: function (p) {
        chieuLenTruc(p, truc);
        var rCho = banKinhTai(truc) * 0.98;            // lùi vào trong một chút → bước sau vẫn tính là "trong"
        var ungVien1 = p.clone().sub(truc);
        var cachTruc = ungVien1.length();
        ungVien1 = cachTruc > rCho ? truc.clone().addScaledVector(ungVien1, rCho / cachTruc) : p.clone();
        var k = heKhoang(p), q = Math.sqrt(k.a * k.a + k.b * k.b + k.c * k.c);
        var ungVien2 = p.clone();
        if (q > 1) {
          var s = 0.995 / q;                           // lùi vào trong một chút, tránh rung ở mép
          ungVien2.copy(Cc)
            .addScaledVector(A, k.a * s * e.rx)
            .addScaledVector(nVao, k.c * s * e.rz);
          ungVien2.y = Cc.y + k.b * s * e.ry;
        }
        p.copy(p.distanceToSquared(ungVien1) < p.distanceToSquared(ungVien2) ? ungVien1 : ungVien2);
        return p;
      }
    };
  }

  /* ---------- Vật liệu hang: tự tính ánh sáng, không dùng nắng của bầu trời ---------- */
  function taoVatLieuHang(ten, side, uniforms) {
    // Vách hang vẽ 2 mặt: mặt TRONG (back face, pháp tuyến hướng ra ngoài) là lòng hang;
    // mặt NGOÀI chỉ lộ ra ở mép miệng hầm khi đứng ngoài nhìn vào → tô tối như ruột đá,
    // giống cách đảo Bồ Hòn tô tối mặt trong (không thì thành "khung cửa" sáng lạ mắt)
    var toiMatNgoai = side === THREE.DoubleSide ? 'if (gl_FrontFacing) sangHang *= 0.1;' : '';
    return HALONG.vaShader(new THREE.MeshLambertMaterial({ vertexColors: true, side: side }), {
      ten: ten,
      uniforms: uniforms,
      dinhKhaiBao: [
        'attribute float dauNhu;             // 0 ở gốc nhũ đá → 1 ở đầu nhọn (vách hang = 0)',
        'varying float vDauNhu;',
        'varying vec3 vMauPQ;'
      ].join('\n'),
      dinhBienDang: [
        'vDauNhu = dauNhu;',
        '// màu phát quang riêng từng nhũ: xanh lam ↔ tím, lấy theo số thứ tự (gl_InstanceID)',
        'float hNhu = fract(sin(float(gl_InstanceID) * 12.9898) * 43758.5453);',
        'vMauPQ = mix(vec3(0.25, 0.75, 1.0), vec3(0.75, 0.35, 1.0), hNhu);'
      ].join('\n'),
      manhKhaiBao: [
        'uniform vec4 uDenHang[4];          // xyz vị trí, w tầm chiếu (m)',
        'uniform vec3 uMauDenHang[4];',
        'uniform vec3 uCuaHang;',
        HALONG.glsl.noise,
        'uniform vec3 uMauNang;',
        'uniform float uThoiGian;',
        'varying float vDauNhu;',
        'varying vec3 vMauPQ;'
      ].join('\n'),
      // Bỏ hẳn kết quả chiếu sáng thường, tính lại bằng đèn hang
      manhTruocSuong: [
        'vec3 nH = normalize(vPhapTuyenTG) * (gl_FrontFacing ? 1.0 : -1.0);',
        'vec3 sangHang = vec3(0.02, 0.018, 0.03);               // ánh sáng nền rất yếu: hang tối nhưng vẫn thấy hình khối',
        'for (int i = 0; i < 4; i++) {',
        '  vec3 L = uDenHang[i].xyz - vViTriTheGioi;',
        '  float d2 = max(dot(L, L), 0.01);',
        '  float suyGiam = 1.0 / (1.0 + d2 / (uDenHang[i].w * uDenHang[i].w));',
        '  sangHang += uMauDenHang[i] * suyGiam * (0.12 + 0.88 * max(dot(nH, L * inversesqrt(d2)), 0.0));',
        '}',
        '// ánh sáng bầu trời hắt vào từ cửa hang, yếu dần khi vào sâu',
        'float kcCua = length(vViTriTheGioi - uCuaHang);',
        'sangHang += (uMauGiuaTroi * 0.9 + uMauNang * 0.25) * exp(-kcCua / 6.0);',
        '// chỉ phần chóp nhũ đá phát quang (pow 5 → thân nhũ vẫn là đá), "thở" chậm',
        toiMatNgoai,
        'vec3 phatQuang = vMauPQ * pow(vDauNhu, 5.0) * 0.9 * (0.8 + 0.3 * sin(uThoiGian * 1.3 + vViTriTheGioi.x * 0.7));',
        '// vân đá vôi: loang lổ + vệt nước chảy dọc (2 lớp noise rẻ, chiếu xiên để vách đứng không bị kéo dãn)',
        'vec3 pR = vViTriTheGioi * 0.9;',
        'float van = noise2(pR.xz + pR.y * vec2(0.71, -0.53)) * 0.6 + noise2(pR.zy * 2.7 + pR.x * 0.37) * 0.4;',
        'float vet = noise2(vec2((pR.x + pR.z) * 2.3, pR.y * 0.25));',
        'vec3 mauDa = diffuseColor.rgb * (0.6 + 0.65 * van) * (0.8 + 0.3 * vet);',
        'gl_FragColor.rgb = mauDa * sangHang + phatQuang;'
      ].join('\n')
    });
  }

  // Thêm thuộc tính dauNhu = 0 cho hình không phải nhũ đá (vách hang)
  function themDauNhu(hinh, giaTri) {
    var n = hinh.attributes.position.count, a = new Float32Array(n);
    if (giaTri) a.fill(giaTri);
    hinh.setAttribute('dauNhu', new THREE.BufferAttribute(a, 1));
    return hinh;
  }

  /* ---------- Hình nhũ đá: dáng giọt nước nhọn dần, gốc ở y = 0, rủ xuống y = -1 ---------- */
  function taoHinhNhu() {
    var diem = [];
    for (var i = 0; i <= 10; i++) {
      var t = i / 10;
      // mũ 0.85 < 1: thân hơi phình như củ cà rốt → nhìn ra khối nón, không dẹt như mảnh kính
      diem.push(new THREE.Vector2(Math.max(0.5 * Math.pow(1 - t, 0.85), 0.004), -t));
    }
    // LatheGeometry chỉ cho mặt + pháp tuyến hướng RA NGOÀI khi đường viền đi theo y TĂNG dần;
    // viền trên đi từ gốc (y = 0) xuống ngọn (y = -1) nên phải đảo lại, nếu không nhũ đá bị
    // "lộn trong ra ngoài": nửa gần bị bỏ (FrontSide), thấy mặt trong nửa xa, ánh sáng ngược phía
    diem.reverse();
    var hinh = new THREE.LatheGeometry(diem, 8);
    var pos = hinh.attributes.position, mau = [], dau = [];
    var GOC = new THREE.Color('#8a7d66'), NGON = new THREE.Color('#cbbfa4'), c = new THREE.Color();
    for (i = 0; i < pos.count; i++) {
      var k = -pos.getY(i);                               // 0 gốc → 1 ngọn
      c.copy(GOC).lerp(NGON, k);
      mau.push(c.r, c.g, c.b);
      dau.push(k);
    }
    hinh.setAttribute('color', new THREE.Float32BufferAttribute(mau, 3));
    hinh.setAttribute('dauNhu', new THREE.Float32BufferAttribute(dau, 1));
    return hinh;
  }

  AFRAME.registerComponent('hang-dong', {
    init: function () {
      if (HALONG.hangDong) this.dung();
      else {
        // đảo chưa dựng xong → chờ dao-da-voi báo
        this.khiDaoXong = this.dung.bind(this);
        this.el.sceneEl.addEventListener('dao-da-xong', this.khiDaoXong, { once: true });
      }
    },

    dung: function () {
      var h = HALONG.hangDong;
      if (!h || this.nhom) return;
      var noise = HALONG.taoNoise(1995), rand = HALONG.taoRandom(1995);
      var S = h.S, n = h.n, A = h.A, nVao = h.nVao, Cc = h.Cc;
      var LEN = new THREE.Vector3(0, 1, 0);
      var i;

      // ---- Uniform đèn hang (dùng chung cho vách + nhũ) ----
      var viTriDen = [
        new THREE.Vector4().copy(Cc.clone().addScaledVector(A, 8).setY(Cc.y + 2)).setW(8),
        new THREE.Vector4().copy(Cc.clone().addScaledVector(A, -8).setY(Cc.y + 1)).setW(8),
        new THREE.Vector4().copy(Cc.clone().addScaledVector(nVao, 7).setY(Cc.y + 3)).setW(9),
        new THREE.Vector4().copy(S.clone().addScaledVector(nVao, 12).setY(SAN_Y + 2.5)).setW(6)
      ];
      // Tầm chiếu ngắn + màu đèn > 1: sáng rực gần đèn, tối dần ra xa → thành từng "vũng" màu
      // như đèn chiếu trong hang thật, thay vì cả khoang sáng đều một màu nhạt
      var mauDen = [
        new THREE.Color('#9b5cff').multiplyScalar(3.0),   // tím
        new THREE.Color('#3fd0ff').multiplyScalar(2.8),   // xanh ngọc
        new THREE.Color('#4a6cff').multiplyScalar(2.6),   // xanh lam
        new THREE.Color('#ffb070').multiplyScalar(1.8)    // vàng ấm (đèn lối đi gần cửa)
      ];
      this.cuongDoGoc = mauDen.map(function (c) { return c.clone(); });
      this.uniforms = {
        uDenHang: { value: viTriDen },
        uMauDenHang: { value: mauDen },
        uCuaHang: { value: S.clone() }
      };
      var vlVach = taoVatLieuHang('hang-vach', THREE.DoubleSide, this.uniforms);
      var vlNhu = taoVatLieuHang('hang-nhu', THREE.FrontSide, this.uniforms);

      // Ma trận đặt khoang: trục x → A, y → lên, z → đi sâu vào trong; gốc ở tâm khoang
      var datKhoang = new THREE.Matrix4().makeBasis(A, LEN, nVao).setPosition(Cc);

      // ---- Khoang hang: quả cầu bóp thành elip + noise, sàn phẳng ----
      // 96×48 ô: mịn vừa đủ để mép lỗ nối với hầm tròn trịa (≈9k tam giác, 1 draw call)
      var khoang = new THREE.SphereGeometry(1, 96, 48);
      var p = khoang.attributes.position, mauKhoang = [], c = new THREE.Color();
      var DA = new THREE.Color('#8f8574'), DA_UOT = new THREE.Color('#4a453c');
      for (i = 0; i < p.count; i++) {
        var x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        var gg = 1 + 0.3 * (noise.fbm3(x * 2.2, y * 2.2, z * 2.2, 3) - 0.5) + 0.12 * (noise.n3(x * 7, y * 7, z * 7) - 0.5);
        var px = x * HAM.rx * gg, py = y * HAM.ry * gg, pz = z * HAM.rz * gg;
        var sanCucBo = SAN_Y - Cc.y;
        if (py < sanCucBo) py = sanCucBo + 0.25 * (noise.n3(x * 9, 1.5, z * 9) - 0.5);
        p.setXYZ(i, px, py, pz);
        c.copy(DA).lerp(DA_UOT, noise.n3(x * 4 + 3, y * 4, z * 4));
        mauKhoang.push(c.r, c.g, c.b);
      }
      khoang.setAttribute('color', new THREE.Float32BufferAttribute(mauKhoang, 3));
      khoang.applyMatrix4(datKhoang);
      khoang.computeVertexNormals();
      // ---- Nối hầm với khoang cho kín (vách khoang lồi lõm theo noise nên phải đo thật) ----
      // Hệ toạ độ cục bộ tính từ cửa S: a = ngang (theo A), y = độ cao thế giới, sau = độ sâu (theo nVao)
      var TRUC_Y = 6.3;                                      // độ cao trục hầm ở đoạn cuối
      var pp = khoang.attributes.position, v = new THREE.Vector3();
      var vachTruoc = [];                                    // đỉnh vách trước của khoang (không tính sàn)
      var sauToiDa = 0;
      for (i = 0; i < pp.count; i++) {
        v.fromBufferAttribute(pp, i);
        var y0 = v.y;
        v.sub(S);
        var doSau = v.dot(nVao), ngang = v.dot(A);
        if (doSau > HAM.sau || y0 < SAN_Y + 0.3) continue;
        if (Math.hypot(ngang, y0 - TRUC_Y) > BAN_KINH_HAM + 2) continue;
        vachTruoc.push(ngang, y0, doSau);
        sauToiDa = Math.max(sauToiDa, doSau);
      }
      // Độ sâu vách trước tại (ngang, y): nội suy theo khoảng cách từ các đỉnh lân cận.
      // Chỉ lấy các đỉnh gần mặt trước nhất (tia đi vào gặp vách trước, không phải trần phía sau).
      function sauVachTai(ngang, y) {
        var k, da, dy, nhoNhat = Infinity;
        for (k = 0; k < vachTruoc.length; k += 3) {
          da = vachTruoc[k] - ngang; dy = vachTruoc[k + 1] - y;
          if (da * da + dy * dy < 2.5) nhoNhat = Math.min(nhoNhat, vachTruoc[k + 2]);
        }
        if (nhoNhat === Infinity) return sauToiDa;
        var tong = 0, trongSo = 0;
        for (k = 0; k < vachTruoc.length; k += 3) {
          da = vachTruoc[k] - ngang; dy = vachTruoc[k + 1] - y;
          var d2 = da * da + dy * dy;
          if (d2 > 2.5 || vachTruoc[k + 2] > nhoNhat + 1.5) continue;
          var w = 1 / (d2 + 0.05);
          tong += vachTruoc[k + 2] * w; trongSo += w;
        }
        return tong / trongSo;
      }

      // Khoét lỗ tròn trên vách trước: lưới quả cầu là ô kinh–vĩ tuyến nên xoá tam giác sẽ ra lỗ
      // hình bậc thang. Thay vào đó: kéo mọi đỉnh vách nằm trong lòng hầm ra đúng một vòng tròn
      // (nhỏ hơn hầm 0,35 m → mép lỗ luôn bị ống hầm che), rồi bỏ tam giác có cả 3 đỉnh bị kéo.
      var R_LO = BAN_KINH_HAM - 0.35;
      var keo = new Uint8Array(pp.count);
      for (i = 0; i < pp.count; i++) {
        v.fromBufferAttribute(pp, i);
        var yv = v.y, tuS = v.clone().sub(S);
        var ngangV = tuS.dot(A), lechY = yv - TRUC_Y, r = Math.hypot(ngangV, lechY);
        if (yv < SAN_Y + 0.3 || tuS.dot(nVao) > HAM.sau || r >= R_LO) continue;
        keo[i] = 1;
        // ra vòng tròn theo đúng hướng cũ, rồi đặt lên mặt vách đo được tại đó (không gấp khúc)
        var k = R_LO / Math.max(r, 1e-3);
        var aMoi = ngangV * k, yMoi = Math.max(TRUC_Y + lechY * k, SAN_Y + 0.1);
        v.copy(S).addScaledVector(A, aMoi).addScaledVector(nVao, sauVachTai(aMoi, Math.max(yMoi, SAN_Y + 0.6)));
        pp.setXYZ(i, v.x, yMoi, v.z);
      }
      var idx = khoang.index.array, moi = [];
      for (i = 0; i < idx.length; i += 3) {
        if (keo[idx[i]] && keo[idx[i + 1]] && keo[idx[i + 2]]) continue;
        moi.push(idx[i], idx[i + 1], idx[i + 2]);
      }
      khoang.setIndex(moi);
      khoang.computeVertexNormals();
      themDauNhu(khoang);
      khoang.deleteAttribute('uv');

      // ---- Đường hầm: ống cong từ cửa vào tới khoang, vách sần, sàn phẳng ----
      // Đầu ngoài lùi 1 m vào trong vách (không thò ra thành "bục" nổi trên nước); đầu trong dài
      // quá vách trước rồi "ép" từng đỉnh về đúng mặt vách (đo được) → mép hầm áp khít vào khoang.
      // Không cho thò thêm: phần thò vào khoang là mặt ngoài ống (tô tối) → thành vệt đen.
      var duong = new THREE.CatmullRomCurve3([
        S.clone().addScaledVector(nVao, 1).setY(5.3),
        S.clone().addScaledVector(nVao, 7).setY(5.8),
        S.clone().addScaledVector(nVao, sauToiDa + 0.5).setY(TRUC_Y)
      ]);
      var ham = new THREE.TubeGeometry(duong, 24, BAN_KINH_HAM, 16, false);
      var ph = ham.attributes.position, mauHam = [];
      for (i = 0; i < ph.count; i++) {
        v.fromBufferAttribute(ph, i);
        var nn = noise.n3(v.x * 0.35, v.y * 0.35, v.z * 0.35);
        // đẩy ra/vào theo phương ngang tính từ trục → vách sần (TubeGeometry xếp đỉnh theo từng vòng 17 đỉnh)
        var tamTruc = duong.getPointAt(Math.floor(i / 17) / 24);
        v.add(v.clone().sub(tamTruc).multiplyScalar(0.12 * (nn - 0.5)));
        if (v.y < SAN_Y) v.y = SAN_Y + 0.1 * (nn - 0.5);
        // phần thò quá vách trước của khoang → kéo lùi về mặt vách
        var tuS = v.clone().sub(S), sauDinh = tuS.dot(nVao);
        if (sauDinh > HAM.sau - HAM.rz - 4) {
          var gioiHan = sauVachTai(tuS.dot(A), Math.max(v.y, SAN_Y + 0.6)) + 0.05;
          if (sauDinh > gioiHan) v.addScaledVector(nVao, gioiHan - sauDinh);
        }
        ph.setXYZ(i, v.x, v.y, v.z);
        c.copy(DA).lerp(DA_UOT, nn);
        mauHam.push(c.r, c.g, c.b);
      }
      ham.setAttribute('color', new THREE.Float32BufferAttribute(mauHam, 3));
      ham.computeVertexNormals();
      themDauNhu(ham);
      ham.deleteAttribute('uv');

      // ---- Sàn lót dưới chỗ nối hầm–khoang (nằm khuất trong lòng đảo, thấp hơn sàn 0,2 m):
      // nếu còn khe nhỏ thì nhìn xuống chỉ thấy đá, không lọt xuống mặt biển ----
      // xoay để MẶT SAU hướng lên: nhìn từ trên xuống nó được tô như sàn trong hang (mặt trước bị tô tối)
      var sanLot = new THREE.PlaneGeometry(16, 18).rotateX(Math.PI / 2);
      sanLot.applyMatrix4(new THREE.Matrix4().makeBasis(A, LEN, nVao)
        .setPosition(S.clone().addScaledVector(nVao, HAM.sau - HAM.rz).setY(SAN_Y - 0.2)));
      sanLot.deleteAttribute('uv');
      var mauLot = [];
      for (i = 0; i < sanLot.attributes.position.count; i++) mauLot.push(DA_UOT.r, DA_UOT.g, DA_UOT.b);
      sanLot.setAttribute('color', new THREE.Float32BufferAttribute(mauLot, 3));
      themDauNhu(sanLot);
      // gộp hầm + sàn lót vào 1 hình → vẫn chỉ 1 draw call
      var hamVaLot = HALONG.hinh.gop([ham, sanLot]);

      // ---- Nhũ đá (rủ từ trần) + măng đá (mọc từ sàn): 1 InstancedMesh ----
      var SO_NHU = 110, SO_MANG = 45, SO_NHU_HAM = 14;
      var tong = SO_NHU + SO_MANG + SO_NHU_HAM;
      var nhu = new THREE.InstancedMesh(taoHinhNhu(), vlNhu, tong);
      var m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), viTri = new THREE.Vector3();
      var lat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
      var dem = 0, thu = 0;
      // Thạch nhũ trên trần khoang: chọn hướng ngẫu nhiên ở nửa trên, lấy điểm trên vách
      while (dem < SO_NHU && thu++ < 5000) {
        // chỉ lấy vòm trên (cy ≥ 0.45): vách dốc đứng mà treo nhũ thẳng đứng thì gốc nhũ thò ra ngoài vách
        var phi = rand() * Math.PI * 2, cy = rand.khoang(0.45, 0.98), r = Math.sqrt(1 - cy * cy);
        var dx = Math.cos(phi) * r, dz = Math.sin(phi) * r;
        var g2 = 1 + 0.3 * (noise.fbm3(dx * 2.2, cy * 2.2, dz * 2.2, 3) - 0.5) + 0.12 * (noise.n3(dx * 7, cy * 7, dz * 7) - 0.5);
        // ×1.06: gốc nhũ cắm hẳn vào trong đá trần → không thấy khe hở giữa nhũ và trần (nhũ "lơ lửng")
        viTri.set(dx * HAM.rx * g2 * 1.06, cy * HAM.ry * g2 * 1.06, dz * HAM.rz * g2 * 1.06).applyMatrix4(datKhoang);
        if (viTri.clone().sub(S).dot(nVao) < HAM.sau - HAM.rz * 0.6) continue;   // không che lối vào
        var dai = rand.khoang(1.0, 1.6) + 2.6 * cy * rand();       // dài thêm phần cắm trong đá
        s.set(rand.khoang(0.45, 0.8) * Math.pow(dai, 0.55), dai, rand.khoang(0.45, 0.8) * Math.pow(dai, 0.55));
        q.setFromAxisAngle(LEN, rand() * 6.28);
        nhu.setMatrixAt(dem++, m.compose(viTri, q, s));
      }
      // Măng đá trên sàn
      thu = 0;
      while (dem < SO_NHU + SO_MANG && thu++ < 5000) {
        var a = rand.khoang(-0.85, 0.85), b = rand.khoang(-0.85, 0.85);
        if (a * a + b * b > 0.72) continue;
        viTri.set(a * HAM.rx, SAN_Y - Cc.y, b * HAM.rz).applyMatrix4(datKhoang);
        viTri.y = SAN_Y - 0.05;
        if (Math.abs(viTri.clone().sub(Cc).dot(A)) < 2.5 && b < -0.2) continue;  // chừa lối đi giữa
        var cao = rand.khoang(0.4, 2.3);
        s.set(rand.khoang(0.5, 0.9) * Math.pow(cao, 0.6), cao, rand.khoang(0.5, 0.9) * Math.pow(cao, 0.6));
        q.setFromAxisAngle(LEN, rand() * 6.28).multiply(lat);       // lật ngược: mũi nhọn chĩa lên
        nhu.setMatrixAt(dem++, m.compose(viTri, q, s));
      }
      // Vài nhũ đá nhỏ trên trần đường hầm (chỉ nửa trong: gần cửa ánh trời hắt vào làm chúng sáng chói)
      for (i = 0; i < SO_NHU_HAM; i++) {
        var tt = rand.khoang(0.45, 0.95), diemTruc = duong.getPointAt(tt);
        viTri.copy(diemTruc).addScaledVector(A, rand.khoang(-2.2, 2.2));
        viTri.y = diemTruc.y + BAN_KINH_HAM * 0.85;
        var d2 = rand.khoang(0.3, 1.0);
        s.set(0.35 * d2, d2, 0.35 * d2);
        q.setFromAxisAngle(LEN, rand() * 6.28);
        nhu.setMatrixAt(dem++, m.compose(viTri, q, s));
      }
      nhu.count = dem;
      nhu.instanceMatrix.needsUpdate = true;
      nhu.computeBoundingSphere();

      // ---- Đốm sáng lơ lửng (huyền ảo) ----
      var diem = [], mauDiem = [], c1 = new THREE.Color('#5fd8ff'), c2 = new THREE.Color('#b77bff');
      for (i = 0; i < 70; i++) {
        var aa = rand.khoang(-0.8, 0.8), bb = rand.khoang(-0.45, 0.7), cc = rand.khoang(-0.8, 0.8);
        if (aa * aa + bb * bb + cc * cc > 0.75) { i--; continue; }
        viTri.set(aa * HAM.rx, bb * HAM.ry, cc * HAM.rz).applyMatrix4(datKhoang);
        diem.push(viTri.x, viTri.y, viTri.z);
        c.copy(c1).lerp(c2, rand());
        mauDiem.push(c.r, c.g, c.b);
      }

      this.nhom = new THREE.Group();
      this.nhom.add(new THREE.Mesh(khoang, vlVach));
      this.nhom.add(new THREE.Mesh(hamVaLot, vlVach));
      this.nhom.add(nhu);
      this.nhom.add(HALONG.taoDiemSang({ viTri: diem, mau: mauDiem, kichThuoc: 0.22, nhapNhay: 0.5, troi: 0.8, sangNgay: 1, hatGiong: 77 }));
      this.el.setObject3D('mesh', this.nhom);
      this.viTriCam = new THREE.Vector3();
    },

    tick: function (t) {
      if (!this.nhom) return;
      // Ở xa thì ẩn cả hang (đằng nào cũng bị vách đảo che) → đỡ tốn GPU
      HALONG.viTriCamera(this.el.sceneEl, this.viTriCam);
      this.nhom.visible = this.viTriCam.distanceTo(HALONG.hangDong.Cc) < 230;
      if (!this.nhom.visible) return;
      // Đèn hang "thở" nhẹ
      var mau = this.uniforms.uMauDenHang.value;
      for (var i = 0; i < mau.length; i++) {
        mau[i].copy(this.cuongDoGoc[i]).multiplyScalar(0.85 + 0.15 * Math.sin(t / 1000 * (0.7 + i * 0.23) + i));
      }
    },

    remove: function () {
      if (this.khiDaoXong) this.el.sceneEl.removeEventListener('dao-da-xong', this.khiDaoXong);
      this.el.removeObject3D('mesh');
    }
  });
})();
