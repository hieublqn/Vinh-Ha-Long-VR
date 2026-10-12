/* =========================================================================
 * bien.js – MẶT BIỂN CÓ SÓNG (component "bien")
 * -------------------------------------------------------------------------
 * Mặt biển là 1 tấm lưới phẳng rất lớn, được "uốn" bằng shader:
 *   - VERTEX SHADER (chạy cho từng đỉnh lưới): nâng/hạ đỉnh theo tổng các
 *     sóng sin → mặt nước nhấp nhô thật sự (sóng lừng dài).
 *   - FRAGMENT SHADER (chạy cho từng điểm ảnh): tính pháp tuyến (normal)
 *     gồm sóng + gợn nhỏ, rồi:
 *       + PHẢN CHIẾU màu trời (hiệu ứng Fresnel: nhìn càng xiên càng giống gương),
 *       + màu thân nước xanh ngọc (nắng xuyên qua đỉnh sóng),
 *       + vệt nắng lấp lánh hướng về mặt trời (specular),
 *       + sương mù xa và độ trong suốt nhẹ.
 * Gợn nhỏ lấy từ 1 "normal map" 256x256 SINH BẰNG CODE (noise), không dùng ảnh.
 * Tấm lưới luôn đi theo người dùng nên biển trông như vô tận.
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

  // Hàm GLSL cộng 1 con sóng sin vào độ cao h và độ dốc (đạo hàm) doc.
  //   huong   : hướng sóng chạy (sẽ được chuẩn hóa)
  //   buocSong: bước sóng (m) – khoảng cách giữa 2 đỉnh sóng
  //   bienDo  : biên độ (m) – độ cao đỉnh sóng
  // Tốc độ sóng theo công thức sóng nước sâu: ω = √(g·k)
  var GLSL_SONG = [
    'uniform float uThoiGian;',
    'void congSong(vec2 p, vec2 huong, float buocSong, float bienDo, inout float h, inout vec2 doc) {',
    '  vec2 D = normalize(huong);',
    '  float k = 6.28318 / buocSong;',
    '  float w = sqrt(9.8 * k);',
    '  float pha = k * dot(D, p) - w * uThoiGian;',
    '  h += bienDo * sin(pha);',
    '  doc += bienDo * k * cos(pha) * D;',
    '}'
  ].join('\n');

  var DINH_SHADER_BIEN = [
    GLSL_SONG,
    'varying vec3 vViTri;',
    'void main() {',
    '  vec4 viTri = modelMatrix * vec4(position, 1.0);',
    '  float h = 0.0; vec2 doc = vec2(0.0);',
    '  // Chỉ 2 sóng DÀI được dựng bằng hình học (lưới thưa không vẽ nổi sóng ngắn)',
    '  congSong(viTri.xz, vec2(1.0, 0.35), 41.0, 0.22, h, doc);',
    '  congSong(viTri.xz, vec2(-0.45, 1.0), 23.0, 0.11, h, doc);',
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
    'uniform sampler2D uBanDoGon;',
    'varying vec3 vViTri;',
    '',
    'vec3 layGon(vec2 uv) { return texture2D(uBanDoGon, uv).xyz * 2.0 - 1.0; }',
    '',
    'void main() {',
    '  vec3 toiMat = cameraPosition - vViTri;',
    '  float xa = length(toiMat);',
    '  vec3 V = toiMat / xa;                       // hướng từ mặt nước tới mắt',
    '',
    '  // 1) Độ dốc của TẤT CẢ sóng, tính cho từng điểm ảnh (kể cả sóng ngắn)',
    '  float h = 0.0; vec2 doc = vec2(0.0);',
    '  congSong(vViTri.xz, vec2(1.0, 0.35), 41.0, 0.22, h, doc);',
    '  congSong(vViTri.xz, vec2(-0.45, 1.0), 23.0, 0.11, h, doc);',
    '  congSong(vViTri.xz, vec2(0.7, -0.6), 13.0, 0.05, h, doc);',
    '  congSong(vViTri.xz, vec2(0.15, 1.0), 7.5, 0.025, h, doc);',
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
    '',
    '  // 4) Màu thân nước: tối ở chỗ sâu, xanh ngọc khi nắng xuyên qua sườn sóng',
    '  vec3 L = uHuongMatTroi;',
    '  float xuyenSang = pow(max(dot(-V, normalize(vec3(L.x, 0.0, L.z))), 0.0), 3.0);',
    '  vec3 thanNuoc = uMauNuocSau + uMauNuocNong * (0.18 + 0.35 * xuyenSang * clamp(h * 3.0 + 0.5, 0.0, 1.0));',
    '  thanNuoc *= 0.6 + 0.4 * uMauNang / max(max(uMauNang.r, uMauNang.g), max(uMauNang.b, 0.001));',
    '',
    '  // 5) Vệt nắng lấp lánh: tia phản xạ càng trùng hướng mặt trời càng sáng',
    '  float trung = max(dot(R, L), 0.0);',
    '  float lapLanh = pow(trung, 900.0) * 7.0 + pow(trung, 90.0) * 0.45;',
    '',
    '  vec3 mau = mix(thanNuoc, phanChieu, fresnel) + uMauNang * lapLanh;',
    '',
    '  // 6) Sương mù xa: hòa vào màu chân trời đúng hướng nhìn',
    '  float suong = heSoSuong(xa);',
    '  mau = mix(mau, mauSuong(-V), suong);',
    '',
    '  // 7) Độ trong: nhìn xuống gần thấy lờ mờ chân đảo dưới nước; xa thì đục hẳn',
    '  float doDuc = mix(0.78, 1.0, max(fresnel, suong));',
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

      // uniform riêng (normal map) + uniform chung (màu trời, mặt trời, thời gian...)
      var uniforms = Object.assign({ uBanDoGon: { value: taoBanDoGon(256) } }, HALONG.uniformChung);

      var vatLieu = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: DINH_SHADER_BIEN,
        fragmentShader: MANH_SHADER_BIEN,
        transparent: true                      // để dùng được độ trong (alpha)
      });

      this.mat = new THREE.Mesh(hinh, vatLieu);
      this.mat.frustumCulled = false;          // lưới luôn bao quanh người xem
      this.el.setObject3D('mesh', this.mat);
      this.viTriCam = new THREE.Vector3();
    },

    tick: function () {
      // Lưới đi theo người xem nhưng "nhảy" đúng 1 bước ô lưới,
      // nhờ vậy các đỉnh luôn rơi vào cùng chỗ → sóng không bị rung.
      HALONG.viTriCamera(this.el.sceneEl, this.viTriCam);
      var b = this.buocLuoi;
      this.mat.position.set(Math.round(this.viTriCam.x / b) * b, 0, Math.round(this.viTriCam.z / b) * b);
    },

    remove: function () {
      this.el.removeObject3D('mesh');
    }
  });
})();
