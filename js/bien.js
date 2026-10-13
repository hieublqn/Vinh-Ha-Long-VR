/* =========================================================================
 * bien.js – MẶT BIỂN CÓ SÓNG (component "bien")
 * -------------------------------------------------------------------------
 * Mặt biển là 1 tấm lưới phẳng rất lớn, được "uốn" bằng shader:
 *   - VERTEX SHADER (chạy cho từng đỉnh lưới): nâng/hạ đỉnh theo tổng các
 *     sóng sin → mặt nước nhấp nhô thật sự (sóng lừng dài).
 *   - FRAGMENT SHADER (chạy cho từng điểm ảnh): tính pháp tuyến (normal)
 *     gồm sóng + gợn nhỏ, rồi:
 *       + PHẢN CHIẾU màu trời (hiệu ứng Fresnel: nhìn càng xiên càng giống gương),
 *       + PHẢN CHIẾU BÓNG ĐẢO: dò tia phản xạ xem có đâm vào đảo nào gần đó
 *         không (mỗi đảo coi gần đúng là 1 hình trụ đứng),
 *       + màu thân nước xanh ngọc (nắng xuyên qua đỉnh sóng),
 *       + vệt nắng lấp lánh hướng về mặt trời (specular),
 *       + VỆT SÓNG chữ V phía sau đuôi thuyền và bọt quanh mạn thuyền,
 *       + sương mù xa và độ trong suốt nhẹ.
 * Gợn nhỏ lấy từ 1 "normal map" 256x256 SINH BẰNG CODE (noise), không dùng ảnh.
 * Tấm lưới luôn đi theo người dùng nên biển trông như vô tận.
 *
 * Danh sách sóng (HALONG.SONG) dùng CHUNG cho shader và JavaScript:
 * HALONG.doCaoSong(x, z) tính đúng độ cao mặt nước tại 1 điểm → thuyền
 * nhấp nhô khớp với sóng đang vẽ trên màn hình.
 * ========================================================================= */
(function () {
  'use strict';

  var HALONG = window.HALONG;

  /* Tạo normal map gợn sóng nhỏ bằng noise lặp lại (tileable).
   * Mỗi điểm ảnh lưu 1 vector pháp tuyến (x, y, z) mã hóa thành màu (R, G, B). */
  function taoBanDoGon(kichThuoc) {
    // 4 lớp noise, mỗi lớp 1 seed riêng (tạo 1 lần, dùng cho mọi điểm ảnh)
    var cacLop = [11, 12, 13, 14].map(function (s) { return HALONG.taoNoise(s); });
    var cao = new Float32Array(kichThuoc * kichThuoc);
    var x, y;
    // 1) Bản đồ độ cao: 4 lớp noise, mỗi lớp chu kỳ gấp đôi → gợn to + gợn li ti
    for (y = 0; y < kichThuoc; y++) {
      for (x = 0; x < kichThuoc; x++) {
        var h = 0, bienDo = 0.5;
        for (var lop = 0; lop < 4; lop++) {
          var chuKy = 4 << lop;                     // 4, 8, 16, 32 ô trên toàn ảnh
          var tiLe = chuKy / kichThuoc;
          h += bienDo * cacLop[lop].n2Lap(x * tiLe, y * tiLe, chuKy);
          bienDo *= 0.5;
        }
        cao[y * kichThuoc + x] = h;
      }
    }
    // 2) Pháp tuyến = độ dốc của bản đồ độ cao (sai phân 2 bên, quấn vòng ở mép)
    var duLieu = new Uint8Array(kichThuoc * kichThuoc * 4);
    var doDoc = 6.0;
    function layCao(i, j) {
      i = (i + kichThuoc) % kichThuoc;
      j = (j + kichThuoc) % kichThuoc;
      return cao[j * kichThuoc + i];
    }
    for (y = 0; y < kichThuoc; y++) {
      for (x = 0; x < kichThuoc; x++) {
        var nx = (layCao(x - 1, y) - layCao(x + 1, y)) * doDoc;
        var ny = (layCao(x, y - 1) - layCao(x, y + 1)) * doDoc;
        var dai = Math.sqrt(nx * nx + ny * ny + 1);
        var k = (y * kichThuoc + x) * 4;
        duLieu[k] = (nx / dai * 0.5 + 0.5) * 255;
        duLieu[k + 1] = (ny / dai * 0.5 + 0.5) * 255;
        duLieu[k + 2] = (1 / dai * 0.5 + 0.5) * 255;
        duLieu[k + 3] = 255;
      }
    }
    var tex = new THREE.DataTexture(duLieu, kichThuoc, kichThuoc, THREE.RGBAFormat);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;       // lặp lại vô hạn
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;     // mipmap: ở xa tự mờ đi, đỡ nhấp nháy
    tex.generateMipmaps = true;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
  }

  /* -----------------------------------------------------------------------
   * DANH SÁCH SÓNG – 1 nguồn dữ liệu cho cả GLSL lẫn JavaScript
   *   huong   : hướng sóng chạy (x, z)
   *   buocSong: bước sóng (m) – khoảng cách giữa 2 đỉnh sóng
   *   bienDo  : biên độ (m) – độ cao đỉnh sóng
   *   hinhHoc : true = sóng dài, được dựng thật bằng đỉnh lưới (vertex shader);
   *             false = sóng ngắn, chỉ tính độ dốc cho từng điểm ảnh (lưới
   *             thưa 6 m không vẽ nổi sóng dài 7 m).
   * Tốc độ sóng theo công thức sóng nước sâu: ω = √(g·k), k = 2π / bước sóng.
   * --------------------------------------------------------------------- */
  HALONG.SONG = [
    { huong: [1.0, 0.35], buocSong: 41, bienDo: 0.22, hinhHoc: true },
    { huong: [-0.45, 1.0], buocSong: 23, bienDo: 0.11, hinhHoc: true },
    { huong: [0.7, -0.6], buocSong: 13, bienDo: 0.05, hinhHoc: false },
    { huong: [0.15, 1.0], buocSong: 7.5, bienDo: 0.025, hinhHoc: false }
  ];
  // Chuẩn hóa hướng sẵn 1 lần cho phần JavaScript
  HALONG.SONG.forEach(function (song) {
    var dai = Math.hypot(song.huong[0], song.huong[1]);
    song.dx = song.huong[0] / dai;
    song.dz = song.huong[1] / dai;
    song.k = 2 * Math.PI / song.buocSong;
    song.w = Math.sqrt(9.8 * song.k);
  });

  // Độ cao mặt nước tại (x, z) – CHỈ các sóng dài (đúng như lưới đang vẽ)
  HALONG.doCaoSong = function (x, z) {
    var t = HALONG.uniformChung.uThoiGian.value, h = 0;
    for (var i = 0; i < HALONG.SONG.length; i++) {
      var s = HALONG.SONG[i];
      if (!s.hinhHoc) continue;
      h += s.bienDo * Math.sin(s.k * (s.dx * x + s.dz * z) - s.w * t);
    }
    return h;
  };

  // Bán kính hình trụ dùng cho bóng phản chiếu của 1 đảo: bán kính "trung bình" của
  // hình elip chân đảo (không lấy bán trục lớn → đảo dẹt không bị bóng tràn ra mặt nước)
  HALONG.banKinhPhanChieu = function (dao) {
    return dao.rPhanChieu ? dao.rPhanChieu * 0.9 : dao.rChan * 0.85;
  };

  // Viết số kiểu GLSL (luôn có dấu chấm thập phân: 41 → "41.0")
  function soGLSL(x) {
    var chu = String(+x.toFixed(4));
    return chu.indexOf('.') < 0 ? chu + '.0' : chu;
  }
  // Sinh các dòng lệnh congSong(...) từ danh sách sóng
  function goiCacSong(bien, chiSongDai) {
    return HALONG.SONG.filter(function (s) { return !chiSongDai || s.hinhHoc; }).map(function (s) {
      return '  congSong(' + bien + ', vec2(' + soGLSL(s.huong[0]) + ', ' + soGLSL(s.huong[1]) + '), ' +
        soGLSL(s.buocSong) + ', ' + soGLSL(s.bienDo) + ', h, doc);';
    }).join('\n');
  }

  // Hàm GLSL cộng 1 con sóng sin vào độ cao h và độ dốc (đạo hàm) doc.
  var GLSL_SONG = [
    'uniform float uThoiGian;',
    'void congSong(vec2 p, vec2 huong, float buocSong, float bienDo, inout float h, inout vec2 doc) {',
    '  vec2 D = normalize(huong);',
    '  float k = 6.2831853 / buocSong;',
    '  float w = sqrt(9.8 * k);',
    '  float pha = k * dot(D, p) - w * uThoiGian;',
    '  h += bienDo * sin(pha);',
    '  doc += bienDo * k * cos(pha) * D;',
    '}'
  ].join('\n');

  var SO_DAO_PHAN_CHIEU = 12;   // tối đa 12 đảo (to nhất trong tầm nhìn) được tính bóng phản chiếu

  var DINH_SHADER_BIEN = [
    GLSL_SONG,
    'varying vec3 vViTri;',
    'void main() {',
    '  vec4 viTri = modelMatrix * vec4(position, 1.0);',
    '  float h = 0.0; vec2 doc = vec2(0.0);',
    '  // Chỉ các sóng DÀI được dựng bằng hình học',
    goiCacSong('viTri.xz', true),
    '  viTri.y += h;',
    '  vViTri = viTri.xyz;',
    '  gl_Position = projectionMatrix * viewMatrix * viTri;',
    '}'
  ].join('\n');

  var MANH_SHADER_BIEN = [
    GLSL_SONG,
    HALONG.glsl.bauTroi,
    'uniform vec3 uMauNang;',
    'uniform vec3 uMauNuocSau;',
    'uniform vec3 uMauNuocNong;',
    'uniform vec4 uThuyen;               // x, z, góc hướng, tốc độ (0..1)',
    'uniform sampler2D uBanDoGon;',
    'uniform vec4 uDaoGan[SO_DAO_PC];    // các đảo gần: x, z, bán kính, chiều cao',
    'uniform vec4 uDenLong[8];           // đèn lồng gần: x, y, z, độ sáng (0 = ô trống)',
    'uniform float uDem;',
    'varying vec3 vViTri;',
    '',
    'vec3 layGon(vec2 uv) { return texture2D(uBanDoGon, uv).xyz * 2.0 - 1.0; }',
    '',
    '// ---- Bóng đảo trong nước ----',
    '// Tia phản xạ đi từ điểm P trên mặt nước theo hướng R. Mỗi đảo coi gần đúng là',
    '// 1 hình trụ đứng. Giải phương trình bậc 2 để tìm điểm tia chạm thành trụ.',
    '// Trả về: rgb = màu đảo nhìn thấy trong nước, a = mức che (0 = không chạm)',
    'vec4 phanChieuDao(vec3 P, vec3 R, float xaMat) {',
    '  vec2 Rn = R.xz;',
    '  float a = dot(Rn, Rn);',
    '  vec4 ketQua = vec4(0.0);',
    '  if (a < 1e-6) return ketQua;            // tia dựng đứng: không chạm vách đảo',
    '  float tGanNhat = 1e6;',
    '  vec2 huongNangNgang = normalize(uHuongMatTroi.xz + vec2(1e-5));',
    '  for (int i = 0; i < SO_DAO_PC; i++) {',
    '    vec4 dao = uDaoGan[i];',
    '    if (dao.z <= 0.0) break;              // hết đảo (các ô có đảo luôn xếp ở đầu mảng)',
    '    vec2 oc = P.xz - dao.xy;',
    '    float b = dot(oc, Rn);',
    '    if (b >= 0.0) continue;               // đảo nằm phía sau tia',
    '    float c = dot(oc, oc) - dao.z * dao.z;',
    '    float delta = b * b - a * c;',
    '    if (delta <= 0.0) continue;           // tia đi trượt qua đảo',
    '    float t = (-b - sqrt(delta)) / a;     // quãng đường tới chỗ chạm (m)',
    '    if (t <= 0.0 || t >= tGanNhat) continue;',
    '    // Đỉnh đảo tròn: tia càng chạm gần mép trụ thì "đỉnh" càng thấp → bóng có vai tròn',
    '    float lech = sqrt(max(dot(oc, oc) - b * b / a, 0.0)) / dao.z;',
    '    float caoHieuDung = dao.w * (0.62 + 0.38 * sqrt(max(1.0 - lech * lech, 0.0)));',
    '    float yCham = P.y + R.y * t;',
    '    float che = 1.0 - smoothstep(caoHieuDung * 0.85, caoHieuDung, yCham);',
    '    if (che <= 0.0) continue;',
    '    tGanNhat = t;',
    '    // Màu tại chỗ chạm: đá sẫm phía dưới, cây phía trên; mặt hướng về mặt trời sáng hơn',
    '    vec2 phapTuyen = normalize(oc + Rn * t);',
    '    float nang = max(dot(phapTuyen, huongNangNgang), 0.0);',
    '    vec3 mauGoc = mix(vec3(0.075, 0.07, 0.06), vec3(0.03, 0.05, 0.022),',
    '                      smoothstep(0.35, 0.8, yCham / dao.w));',
    '    // (bóng trong nước luôn tối hơn vật thật một chút)',
    '    vec3 mau = mauGoc * (uMauGiuaTroi * 0.85 + uMauNang * nang * 0.4);',
    '    // sương mù theo cả quãng đường ánh sáng: mắt → mặt nước → đảo',
    '    mau = mix(mau, mauSuong(R), heSoSuong(xaMat + t));',
    '    ketQua = vec4(mau, che);',
    '  }',
    '  return ketQua;',
    '}',
    '',
    '// ---- Vệt sóng của thuyền ----',
    '// Đổi điểm nước sang hệ tọa độ của thuyền (dọc thân / ngang thân) rồi vẽ:',
    '//  - 2 cánh sóng chữ V (góc Kelvin ≈ 19.5°: góc này giống nhau với MỌI con thuyền)',
    '//  - vệt nước xáo trộn ngay sau đuôi, bọt dọc 2 mạn và sóng mũi',
    '// dpx, dpy: độ biến thiên của p giữa 2 điểm ảnh kề nhau (tính sẵn ở main) – cần cho',
    '// textureGrad vì sau các lệnh "return sớm" GPU không tự tính được giá trị này.',
    'float botThuyen(vec2 p, vec2 dpx, vec2 dpy) {',
    '  if (uThuyen.w < 0.01) return 0.0;      // thuyền đang neo: không có vệt sóng',
    '  vec2 rel = p - uThuyen.xy;',
    '  if (dot(rel, rel) > 140.0 * 140.0) return 0.0;   // xa thuyền quá 140 m: khỏi tính',
    '  float s = sin(uThuyen.z), c = cos(uThuyen.z);',
    '  vec2 truoc = vec2(-s, -c);             // hướng mũi thuyền',
    '  vec2 phai = vec2(c, -s);               // hướng mạn phải',
    '  float doc = dot(rel, truoc);           // > 0: phía trước tâm thuyền',
    '  float ngang = dot(rel, phai);',
    '  float bot = 0.0;',
    '  float sau = -doc - 9.0;                // khoảng cách phía sau đuôi (m)',
    '  if (sau > 0.0 && sau < 120.0) {',
    '    // 2 cánh chữ V: mảnh ở gần, loe rộng + nhạt dần ra xa, đứt quãng thành từng gợn xiên',
    '    float canh = abs(abs(ngang) - (2.2 + sau * 0.354));   // tan(19.5°) ≈ 0.354',
    '    float gonXien = 0.55 + 0.45 * sin(sau * 0.9 - abs(ngang) * 1.3);',
    '    bot += exp(-canh * canh / (0.4 + sau * 0.08)) * exp(-sau / 38.0) * 0.55 * gonXien;',
    '    // vệt nước xáo trộn ngay sau đuôi',
    '    float giua = ngang / (2.0 + sau * 0.06);',
    '    bot += exp(-giua * giua) * exp(-sau / 20.0) * 0.85;',
    '  }',
    '  // bọt dọc 2 mạn (nửa bề rộng thân ~2.8 m, tức thân rộng ~5.6 m, thon dần về mũi)',
    '  float nuaRong = 2.9 * sqrt(clamp((11.5 - doc) / 8.0, 0.0, 1.0));',
    '  float man = (abs(ngang) - nuaRong) / 0.7;',
    '  bot += exp(-man * man) * (1.0 - smoothstep(9.0, 12.0, abs(doc - 0.5))) * 0.55;',
    '  // sóng mũi',
    '  vec2 mui = vec2(ngang, doc - 11.0);',
    '  bot += exp(-dot(mui, mui) / 4.0) * 0.6;',
    '  if (bot < 0.004) return 0.0;           // gần như không có bọt: bỏ qua 2 lần đọc texture',
    '  // xé lẻ bọt bằng noise để không thành vệt trơn',
    '  float vun = textureGrad(uBanDoGon, p * 0.23 + vec2(0.0, uThoiGian * 0.02), dpx * 0.23, dpy * 0.23).r',
    '            * textureGrad(uBanDoGon, p * 0.071 - vec2(uThoiGian * 0.01, 0.0), dpx * 0.071, dpy * 0.071).g;',
    '  bot *= smoothstep(0.12, 0.42, vun + bot * 0.15);',
    '  return clamp(bot * uThuyen.w, 0.0, 1.0);',
    '}',
    '',
    'void main() {',
    '  vec3 toiMat = cameraPosition - vViTri;',
    '  float xa = length(toiMat);',
    '  vec3 V = toiMat / xa;                       // hướng từ mặt nước tới mắt',
    '',
    '  // 1) Độ dốc của TẤT CẢ sóng, tính cho từng điểm ảnh (kể cả sóng ngắn)',
    '  float h = 0.0; vec2 doc = vec2(0.0);',
    goiCacSong('vViTri.xz', false),
    '',
    '  // 2) Gợn nhỏ: đọc normal map 2 lần, trôi theo 2 hướng khác nhau rồi cộng lại',
    '  vec2 uv1 = vViTri.xz * 0.045 + vec2(0.012, 0.007) * uThoiGian;',
    '  vec2 uv2 = vViTri.xz * 0.13 + vec2(-0.010, 0.017) * uThoiGian;',
    '  vec3 g = layGon(uv1) + layGon(uv2);',
    '  // ở xa giảm gợn để không nhấp nháy (aliasing)',
    '  float doManhGon = mix(0.55, 0.18, smoothstep(20.0, 450.0, xa));',
    '  vec3 N = normalize(vec3(-doc.x, 1.0, -doc.y) + vec3(g.x, 0.0, g.y) * doManhGon);',
    '',
    '  // 3) Fresnel: nhìn thẳng xuống thấy nước (2%), nhìn xiên thấy trời phản chiếu',
    '  float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);',
    '  vec3 R = reflect(-V, N);',
    '  R.y = abs(R.y);                              // tia phản xạ không chui xuống nước',
    '  vec3 phanChieu = mauTroi(R);',
    '  vec4 dao = phanChieuDao(vViTri, R, xa);',
    '  phanChieu = mix(phanChieu, dao.rgb, dao.a);',
    '',
    '  // 4) Màu thân nước: tối ở chỗ sâu, xanh ngọc khi nắng xuyên qua sườn sóng',
    '  vec3 L = uHuongMatTroi;',
    '  float xuyenSang = pow(max(dot(-V, normalize(vec3(L.x, 0.0, L.z))), 0.0), 3.0);',
    '  vec3 thanNuoc = uMauNuocSau + uMauNuocNong * (0.18 + 0.35 * xuyenSang * clamp(h * 3.0 + 0.5, 0.0, 1.0));',
    '  thanNuoc *= 0.6 + 0.4 * uMauNang / max(max(uMauNang.r, uMauNang.g), max(uMauNang.b, 0.001));',
    '',
    '  // 5) Vệt nắng lấp lánh (bị đảo che thì tắt)',
    '  float trung = max(dot(R, L), 0.0);',
    '  float lapLanh = (pow(trung, 900.0) * 7.0 + pow(trung, 90.0) * 0.45) * (1.0 - dao.a);',
    '',
    '  vec3 mau = mix(thanNuoc, phanChieu, fresnel) + uMauNang * lapLanh;',
    '',
    '  // 5b) Ban đêm: ánh đèn lồng phản chiếu thành vệt lung linh trên mặt nước.',
    '  //     Giống vệt nắng: tia phản xạ R càng trùng hướng tới đèn càng sáng; sóng làm',
    '  //     R dao động nên vệt sáng bị kéo dài, lăn tăn. Ban ngày bỏ qua cả vòng lặp.',
    '  if (uDem > 0.01) {',
    '    float anhDen = 0.0;',
    '    for (int i = 0; i < 8; i++) {',
    '      vec4 den = uDenLong[i];',
    '      if (den.w <= 0.0) break;',
    '      vec3 toiDen = den.xyz - vViTri;',
    '      float kcDen = length(toiDen);',
    '      float trungDen = max(dot(R, toiDen / kcDen), 0.0);',
    '      anhDen += (pow(trungDen, 600.0) * 4.0 + pow(trungDen, 60.0) * 0.35) * den.w / (1.0 + kcDen * 0.03);',
    '    }',
    '    mau += vec3(1.0, 0.6, 0.25) * anhDen * uDem;',
    '  }',
    '',
    '  // 6) Bọt sóng của thuyền: trắng, nhận ánh sáng trời + nắng',
    '  float bot = botThuyen(vViTri.xz, dFdx(vViTri.xz), dFdy(vViTri.xz));',
    '  mau = mix(mau, uMauGiuaTroi * 0.9 + uMauNang * 0.35, bot * 0.85);',
    '',
    '  // 7) Sương mù xa: hòa vào màu chân trời đúng hướng nhìn',
    '  float suong = heSoSuong(xa);',
    '  mau = mix(mau, mauSuong(-V), suong);',
    '',
    '  // 8) Độ trong: nhìn xuống gần thấy lờ mờ chân đảo dưới nước; xa / có bọt thì đục',
    '  float doDuc = mix(0.78, 1.0, max(max(fresnel, suong), bot));',
    '  gl_FragColor = vec4(mau, doDuc);',
    '  #include <tonemapping_fragment>',
    '  #include <colorspace_fragment>',
    '}'
  ].join('\n');

  AFRAME.registerComponent('bien', {
    schema: {
      kichThuoc: { default: 1400 },  // cạnh tấm lưới (m)
      soO: { default: 220 }          // số ô mỗi cạnh (Mốc 5: máy yếu giảm xuống)
    },

    init: function () {
      var d = this.data;
      var hinh = new THREE.PlaneGeometry(d.kichThuoc, d.kichThuoc, d.soO, d.soO);
      hinh.rotateX(-Math.PI / 2);              // dựng tấm phẳng nằm ngang
      this.buocLuoi = d.kichThuoc / d.soO;

      // Danh sách đảo gần (cập nhật vài lần mỗi giây trong tick)
      this.daoGan = [];
      for (var i = 0; i < SO_DAO_PHAN_CHIEU; i++) this.daoGan.push(new THREE.Vector4());
      // 8 đèn lồng gần người xem nhất (ban đêm)
      this.denGan = [];
      for (i = 0; i < 8; i++) this.denGan.push(new THREE.Vector4());
      this.dsDenTam = [];
      var cam = this.viTriCam = new THREE.Vector3();
      this.soSanhDen = function (a, b) { return a.distanceToSquared(cam) - b.distanceToSquared(cam); };

      // uniform riêng + uniform chung (màu trời, mặt trời, thời gian, thuyền...)
      var uniforms = Object.assign({
        uBanDoGon: { value: taoBanDoGon(256) },
        uDaoGan: { value: this.daoGan },
        uDenLong: { value: this.denGan }
      }, HALONG.uniformChung);

      var vatLieu = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: DINH_SHADER_BIEN,
        fragmentShader: MANH_SHADER_BIEN,
        defines: { SO_DAO_PC: SO_DAO_PHAN_CHIEU },
        transparent: true                      // để dùng được độ trong (alpha)
      });

      this.mat = new THREE.Mesh(hinh, vatLieu);
      this.mat.frustumCulled = false;          // lưới luôn bao quanh người xem
      this.el.setObject3D('mesh', this.mat);
      this.demKhung = 0;
      this.sapXep = [];                        // mảng tạm để sắp xếp đảo (tái sử dụng, đỡ rác bộ nhớ)
      this.huongNhin = new THREE.Vector3();
    },

    tick: function () {
      // Lưới đi theo người xem nhưng "nhảy" đúng 1 bước ô lưới,
      // nhờ vậy các đỉnh luôn rơi vào cùng chỗ → sóng không bị rung.
      HALONG.viTriCamera(this.el.sceneEl, this.viTriCam);
      var b = this.buocLuoi;
      this.mat.position.set(Math.round(this.viTriCam.x / b) * b, 0, Math.round(this.viTriCam.z / b) * b);

      // Cứ 4 khung hình chọn lại các đảo để tính bóng phản chiếu (rất nhẹ, ~vài micro giây)
      if (this.demKhung++ % 4 === 0) this.chonDaoGan();
      // Đèn trên thuyền di chuyển liên tục → chọn đèn gần mỗi khung hình (chỉ khi trời tối)
      this.chonDenGan();
    },

    chonDenGan: function () {
      var den = this.denGan, i;
      if (HALONG.uniformChung.uDem.value < 0.01) {
        if (den[0].w !== 0) for (i = 0; i < den.length; i++) den[i].set(0, 0, 0, 0);
        return;
      }
      var ds = this.dsDenTam;
      ds.length = 0;
      var thuyen = HALONG.thuyen && HALONG.thuyen.denLongTheGioi;
      if (thuyen) for (i = 0; i < thuyen.length; i++) ds.push(thuyen[i]);
      var tinh = HALONG.denLongTinh || [];
      for (i = 0; i < tinh.length; i++) ds.push(tinh[i]);
      ds.sort(this.soSanhDen);
      for (i = 0; i < den.length; i++) {
        if (i < ds.length) den[i].set(ds[i].x, ds[i].y, ds[i].z, 1);
        else den[i].set(0, 0, 0, 0);
      }
    },

    // Chọn tối đa 12 đảo "to nhất trong mắt người xem": điểm = kích thước / khoảng cách.
    // (chọn theo gần nhất thì vài đảo nhỏ sát bên sẽ chiếm chỗ của đảo lớn ở xa hơn)
    // Đảo nằm lệch quá ~100° so với hướng nhìn thì bóng của nó không thể rơi vào phần
    // mặt nước đang thấy → bỏ, để GPU không phải dò tia vô ích cho mỗi điểm ảnh.
    chonDaoGan: function () {
      var ds = HALONG.dsDao || [];
      var cam = this.viTriCam, mang = this.sapXep, f = this.huongNhin;
      this.el.sceneEl.camera.getWorldDirection(f);
      f.y = 0;
      var coHuong = f.lengthSq() > 0.05;            // nhìn thẳng xuống/lên thì không lọc
      if (coHuong) f.normalize();
      for (var i = 0; i < ds.length; i++) {
        var dao = ds[i];
        var dx = dao.x - cam.x, dz = dao.z - cam.z, kc = Math.hypot(dx, dz);
        var r = HALONG.banKinhPhanChieu(dao);
        var diem = (dao.cao + r) / Math.max(kc - r, 1);
        if (coHuong && kc > r + 1) {
          var lech = Math.acos(Math.min(Math.max((dx * f.x + dz * f.z) / kc, -1), 1)) - Math.asin(r / kc);
          if (lech > 1.75) diem = 0;                  // 1.75 rad ≈ 100°
        }
        if (!mang[i]) mang[i] = { dao: null, diem: 0 };
        mang[i].dao = dao;
        mang[i].diem = diem;
      }
      mang.length = ds.length;
      mang.sort(function (a, b) { return b.diem - a.diem; });
      // Xếp các đảo được chọn vào ĐẦU mảng; ô còn lại = 0 → shader gặp ô 0 là dừng (break)
      for (i = 0; i < SO_DAO_PHAN_CHIEU; i++) {
        var o = mang[i];
        if (o && o.diem > 0) this.daoGan[i].set(o.dao.x, o.dao.z, HALONG.banKinhPhanChieu(o.dao), o.dao.cao * 0.92);
        else this.daoGan[i].set(0, 0, 0, 0);
      }
    },

    remove: function () {
      this.el.removeObject3D('mesh');
    }
  });
})();
