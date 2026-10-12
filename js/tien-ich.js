/* =========================================================================
 * tien-ich.js – CÁC HÀM DÙNG CHUNG CHO TOÀN DỰ ÁN
 * -------------------------------------------------------------------------
 * File này được nạp ĐẦU TIÊN (ngay sau A-Frame). Nó chuẩn bị:
 *   1. Không gian tên window.HALONG: nơi các file khác chia sẻ dữ liệu
 *      (thay vì rải biến toàn cục khắp nơi).
 *   2. Random CÓ SEED: cùng một seed → cùng một dãy số → mỗi lần mở trang
 *      đảo vẫn nằm đúng chỗ cũ (Math.random() thì lần nào cũng khác).
 *   3. Noise (nhiễu mượt) để tạo hình dạng tự nhiên: vách đá, gợn sóng...
 *   4. Hàm tạo texture bằng <canvas> → không cần file ảnh bên ngoài.
 *   5. Đoạn mã GLSL dùng chung: màu bầu trời + sương mù theo hướng nhìn.
 *   6. Hàm "gắn sương mù theo hướng" vào vật liệu có sẵn của three.js.
 * ========================================================================= */
(function () {
  'use strict';

  var HALONG = (window.HALONG = window.HALONG || {});

  /* -----------------------------------------------------------------------
   * 1. RANDOM CÓ SEED – thuật toán mulberry32 (ngắn, nhanh, đủ tốt cho đồ họa)
   *    Cách dùng:  var rand = HALONG.taoRandom(1994);  rand() → số trong [0, 1)
   * --------------------------------------------------------------------- */
  HALONG.taoRandom = function (seed) {
    var a = seed >>> 0;
    function rand() {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    // Số thực ngẫu nhiên trong khoảng [min, max)
    rand.khoang = function (min, max) {
      return min + (max - min) * rand();
    };
    // Chọn ngẫu nhiên theo trọng số: chonTheoTrongSo([3, 1]) → 0 (75%) hoặc 1 (25%)
    rand.chonTheoTrongSo = function (trongSo) {
      var tong = 0, i;
      for (i = 0; i < trongSo.length; i++) tong += trongSo[i];
      var x = rand() * tong;
      for (i = 0; i < trongSo.length; i++) {
        x -= trongSo[i];
        if (x < 0) return i;
      }
      return trongSo.length - 1;
    };
    return rand;
  };

  /* -----------------------------------------------------------------------
   * 2. VALUE NOISE có seed
   *    Ý tưởng: đặt một số ngẫu nhiên ở mỗi điểm nguyên của lưới, rồi NỘI SUY
   *    MƯỢT giữa các điểm → được "địa hình" gợn lên xuống tự nhiên.
   *    fbm (fractal Brownian motion) = cộng nhiều lớp noise, lớp sau chi tiết
   *    gấp đôi nhưng yếu bằng nửa → vừa có khối lớn vừa có chi tiết nhỏ.
   * --------------------------------------------------------------------- */
  // Băm 3 số nguyên + seed → số thực [0, 1). Cùng đầu vào luôn ra cùng kết quả.
  function bam(x, y, z, seed) {
    var h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^
            Math.imul(z, 1440662683) ^ Math.imul(seed, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1103515245);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  // Đường cong làm mượt (smoothstep) để chỗ nối giữa các ô không bị gãy góc
  function lamMuot(t) { return t * t * (3 - 2 * t); }
  function noiSuy(a, b, t) { return a + (b - a) * t; }

  HALONG.taoNoise = function (seed) {
    seed = seed | 0;

    // Noise 3D: kết quả trong [0, 1]
    function n3(x, y, z) {
      var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
      var u = lamMuot(x - xi), v = lamMuot(y - yi), w = lamMuot(z - zi);
      var a = noiSuy(bam(xi, yi, zi, seed), bam(xi + 1, yi, zi, seed), u);
      var b = noiSuy(bam(xi, yi + 1, zi, seed), bam(xi + 1, yi + 1, zi, seed), u);
      var c = noiSuy(bam(xi, yi, zi + 1, seed), bam(xi + 1, yi, zi + 1, seed), u);
      var d = noiSuy(bam(xi, yi + 1, zi + 1, seed), bam(xi + 1, yi + 1, zi + 1, seed), u);
      return noiSuy(noiSuy(a, b, v), noiSuy(c, d, v), w);
    }

    // fbm 3D: cộng 'soTang' lớp noise, kết quả vẫn nằm trong [0, 1]
    function fbm3(x, y, z, soTang) {
      var tong = 0, bienDo = 0.5, chuan = 0;
      for (var i = 0; i < soTang; i++) {
        tong += bienDo * n3(x, y, z);
        chuan += bienDo;
        x = x * 2.03 + 17.1; y = y * 2.03 + 3.7; z = z * 2.03 + 9.3;
        bienDo *= 0.5;
      }
      return tong / chuan;
    }

    // Noise 2D LẶP LẠI với chu kỳ 'chuKy' ô (tileable): mép trái khớp mép phải,
    // mép trên khớp mép dưới → dán texture cạnh nhau không thấy đường nối.
    // chuKyY (không bắt buộc): chu kỳ theo trục y khác trục x → noise bị "kéo dãn"
    function n2Lap(x, y, chuKy, chuKyY) {
      var cx = chuKy, cy = chuKyY || chuKy;
      var xi = Math.floor(x), yi = Math.floor(y);
      var u = lamMuot(x - xi), v = lamMuot(y - yi);
      function g(i, j) {
        return bam(((i % cx) + cx) % cx, ((j % cy) + cy) % cy, cx * 1000 + cy, seed);
      }
      return noiSuy(noiSuy(g(xi, yi), g(xi + 1, yi), u),
                    noiSuy(g(xi, yi + 1), g(xi + 1, yi + 1), u), v);
    }

    return { n3: n3, fbm3: fbm3, n2Lap: n2Lap };
  };

  // Hàm smoothstep giống GLSL, dùng khi tô màu đỉnh (vertex color) trong JS
  HALONG.smoothstep = function (canDuoi, canTren, x) {
    var t = Math.min(Math.max((x - canDuoi) / (canTren - canDuoi), 0), 1);
    return t * t * (3 - 2 * t);
  };

  /* -----------------------------------------------------------------------
   * 3. TEXTURE TỪ CANVAS – vẽ bằng JavaScript rồi dùng như một tấm ảnh.
   *    Dùng cho bảng chữ tiếng Việt (font mặc định của A-Frame thiếu dấu),
   *    hoa văn gỗ, cánh buồm... ở các mốc sau.
   *    hamVe(ctx, rong, cao) là hàm bạn tự viết để vẽ lên canvas.
   * --------------------------------------------------------------------- */
  HALONG.taoTextureCanvas = function (rong, cao, hamVe) {
    var canvas = document.createElement('canvas');
    canvas.width = rong;
    canvas.height = cao;
    hamVe(canvas.getContext('2d'), rong, cao);
    var texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace; // ảnh màu → báo three.js đây là sRGB
    texture.anisotropy = 4;                    // nét hơn khi nhìn xiên
    return texture;
  };

  /* -----------------------------------------------------------------------
   * 4. UNIFORM DÙNG CHUNG cho mọi shader (trời, biển, đảo...)
   *    "Uniform" = biến JavaScript gửi xuống GPU. Vì các shader dùng CHUNG
   *    một đối tượng { value }, chỉ cần đổi 1 lần (vd: đổi màu trời khi chuyển
   *    sang đêm) là tất cả cùng cập nhật.
   *    Màu được bau-troi.js điền vào theo "bảng màu" của từng thời điểm.
   * --------------------------------------------------------------------- */
  HALONG.uniformChung = {
    uThoiGian:     { value: 0 },                          // giây, để tạo chuyển động
    uHuongMatTroi: { value: new THREE.Vector3(0, 0.1, -1).normalize() },
    uMauDinhTroi:  { value: new THREE.Color() },          // màu đỉnh trời
    uMauGiuaTroi:  { value: new THREE.Color() },          // màu lưng chừng trời
    uMauChanTroi:  { value: new THREE.Color() },          // màu sát chân trời
    uMauMatTroi:   { value: new THREE.Color() },          // quầng sáng quanh mặt trời
    uMauNang:      { value: new THREE.Color() },          // màu × cường độ ánh nắng
    uMauNuocSau:   { value: new THREE.Color() },          // màu nước sâu
    uMauNuocNong:  { value: new THREE.Color() },          // màu xanh ngọc khi nắng xuyên sóng
    uMatDoSuong:   { value: 0.004 },                      // độ dày sương mù
    uThuyen:       { value: new THREE.Vector4() }         // thuyền: x, z, góc hướng, tốc độ (0..1)
  };

  /* -----------------------------------------------------------------------
   * 5. ĐOẠN MÃ GLSL DÙNG CHUNG
   *    - mauTroi(d): màu bầu trời theo hướng d (không mây) → dùng cho chính bầu
   *      trời, cho PHẢN CHIẾU trên mặt nước và cho SƯƠNG MÙ.
   *    - Sương mù "theo hướng": vật ở xa hòa vào đúng màu chân trời phía sau nó
   *      (phía mặt trời thì cam, phía ngược lại thì hồng tím). Sương mù thường
   *      của three.js chỉ có 1 màu nên đảo xa sẽ bị "lệch tông" với nền trời.
   * --------------------------------------------------------------------- */
  HALONG.glsl = {};

  HALONG.glsl.bauTroi = [
    'uniform vec3 uHuongMatTroi;',
    'uniform vec3 uMauDinhTroi;',
    'uniform vec3 uMauGiuaTroi;',
    'uniform vec3 uMauChanTroi;',
    'uniform vec3 uMauMatTroi;',
    'uniform float uMatDoSuong;',
    '',
    '// Màu trời theo hướng nhìn d (đã chuẩn hóa)',
    'vec3 mauTroi(vec3 d) {',
    '  float cao = clamp(d.y, 0.0, 1.0);',
    '  // gradient dọc: chân trời → lưng chừng → đỉnh trời',
    '  vec3 c = mix(uMauChanTroi, uMauGiuaTroi, smoothstep(0.0, 0.22, cao));',
    '  c = mix(c, uMauDinhTroi, smoothstep(0.15, 0.8, cao));',
    '  // quầng sáng mặt trời: loang rộng theo phương ngang, đậm nhất sát chân trời',
    '  float gan = max(dot(d, uHuongMatTroi), 0.0);',
    '  float quangRong = pow(gan, 5.0) * (1.0 - smoothstep(0.0, 0.4, cao));',
    '  float quangHep = pow(gan, 60.0);',
    '  c = mix(c, uMauMatTroi, clamp(quangRong * 0.9 + quangHep * 0.7, 0.0, 1.0));',
    '  return c;',
    '}',
    '',
    '// Màu sương tại hướng d = màu chân trời ở cùng góc phương vị',
    'vec3 mauSuong(vec3 d) {',
    '  return mauTroi(normalize(vec3(d.x, 0.02, d.z)));',
    '}',
    '',
    '// Tỉ lệ sương (0 = trong, 1 = mất hẳn) theo khoảng cách – sương mũ bình phương',
    'float heSoSuong(float khoangCach) {',
    '  float k = uMatDoSuong * khoangCach;',
    '  return 1.0 - exp(-k * k);',
    '}'
  ].join('\n');

  // Noise trong shader (chạy trên GPU) – dùng cho mây, gợn sáng...
  HALONG.glsl.noise = [
    '// Băm 2D → [0,1) (không dùng sin nên ổn định trên mọi GPU)',
    'float bam12(vec2 p) {',
    '  vec3 p3 = fract(vec3(p.xyx) * 0.1031);',
    '  p3 += dot(p3, p3.yzx + 33.33);',
    '  return fract((p3.x + p3.y) * p3.z);',
    '}',
    'float noise2(vec2 p) {',
    '  vec2 i = floor(p), f = fract(p);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(bam12(i), bam12(i + vec2(1.0, 0.0)), u.x),',
    '             mix(bam12(i + vec2(0.0, 1.0)), bam12(i + vec2(1.0, 1.0)), u.x), u.y);',
    '}'
  ].join('\n');

  /* -----------------------------------------------------------------------
   * 6. "VÁ" SHADER CỦA VẬT LIỆU CÓ SẴN (MeshLambertMaterial...)
   *    three.js cho phép sửa mã shader ngay trước khi biên dịch, qua hàm
   *    onBeforeCompile. Ta dùng nó để:
   *      - luôn thêm SƯƠNG MÙ THEO HƯỚNG (trộn trước bước tone mapping để cùng
   *        "không gian màu" với shader bầu trời, nếu không sẽ lệch màu);
   *      - phần nằm DƯỚI mặt nước tối dần theo độ sâu (nước hấp thụ ánh sáng);
   *      - tính sẵn vị trí + pháp tuyến trong THẾ GIỚI (vViTriTheGioi,
   *        vPhapTuyenTG) cho các hiệu ứng riêng;
   *      - chèn thêm đoạn GLSL riêng của từng loại vật liệu:
   *          dinhKhaiBao / manhKhaiBao : khai báo thêm (uniform, hàm...)
   *          manhSauMau   : chạy ngay sau khi có màu gốc (diffuseColor)
   *          manhTruocSuong : chạy sau khi tính ánh sáng, trước sương mù
   *          uniforms     : uniform riêng
   *          ten          : tên duy nhất cho mỗi kiểu vá (bắt buộc khác nhau!)
   *    Vì sao cần "ten"? three.js dùng chung chương trình shader đã biên dịch
   *    cho các vật liệu có cùng "khóa". Mặc định khóa = mã nguồn hàm
   *    onBeforeCompile – mà mọi vật liệu đều dùng CHUNG hàm dưới đây, nên phải
   *    tự đặt khóa khác nhau, nếu không đảo sẽ bị dùng nhầm shader của buồm.
   * --------------------------------------------------------------------- */
  HALONG.vaShader = function (vatLieu, tuyChon) {
    tuyChon = tuyChon || {};
    vatLieu.onBeforeCompile = function (shader) {
      Object.assign(shader.uniforms, HALONG.uniformChung, tuyChon.uniforms || {});

      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', [
          '#include <common>',
          'varying vec3 vViTriTheGioi;',
          'varying vec3 vPhapTuyenTG;',
          tuyChon.dinhKhaiBao || ''
        ].join('\n'))
        .replace('#include <fog_vertex>', [
          '#include <fog_vertex>',
          'vec4 viTriTG = vec4(transformed, 1.0);',
          'vec3 phapTuyenTG = objectNormal;',
          '#ifdef USE_INSTANCING',
          '  viTriTG = instanceMatrix * viTriTG;          // vật vẽ bằng InstancedMesh',
          '  phapTuyenTG = mat3(instanceMatrix) * phapTuyenTG;',
          '#endif',
          'vViTriTheGioi = (modelMatrix * viTriTG).xyz;',
          'vPhapTuyenTG = mat3(modelMatrix) * phapTuyenTG;'
        ].join('\n'));

      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', [
          '#include <common>',
          'varying vec3 vViTriTheGioi;',
          'varying vec3 vPhapTuyenTG;',
          'uniform vec3 uMauNuocSau;',
          HALONG.glsl.bauTroi,
          tuyChon.manhKhaiBao || ''
        ].join('\n'))
        .replace('#include <color_fragment>', '#include <color_fragment>\n' + (tuyChon.manhSauMau || ''))
        .replace('#include <tonemapping_fragment>', [
          tuyChon.manhTruocSuong || '',
          '// Phần chìm dưới nước (chân đảo, đáy thuyền): nước hấp thụ ánh sáng',
          '// → càng sâu càng tối và ngả màu nước, không bị "sáng như trên cạn"',
          'float sauDuoiNuoc = clamp(-vViTriTheGioi.y / 2.5, 0.0, 1.0);',
          'gl_FragColor.rgb = mix(gl_FragColor.rgb, uMauNuocSau * 0.5, sauDuoiNuoc * 0.9);',
          'vec3 huongNhinSM = vViTriTheGioi - cameraPosition;',
          'float xaSM = length(huongNhinSM);',
          'gl_FragColor.rgb = mix(gl_FragColor.rgb, mauSuong(huongNhinSM / xaSM), heSoSuong(xaSM));',
          '#include <tonemapping_fragment>'
        ].join('\n'))
        .replace('#include <fog_fragment>', ''); // bỏ sương mù 1 màu mặc định
    };
    var khoa = 'halong:' + (tuyChon.ten || 'suong-mu');
    vatLieu.customProgramCacheKey = function () { return khoa; };
    return vatLieu;
  };

  // Trường hợp đơn giản nhất: chỉ gắn sương mù theo hướng
  HALONG.apDungSuongMu = function (vatLieu) {
    return HALONG.vaShader(vatLieu, { ten: 'suong-mu' });
  };

  /* -----------------------------------------------------------------------
   * 7. GHÉP HÌNH (merge geometry) – giảm số draw call
   *    Mỗi vật thể riêng = 1 lệnh vẽ. Thuyền có hàng trăm chi tiết (cột,
   *    lan can, nẹp buồm...) → gộp TẤT CẢ chi tiết cùng vật liệu thành 1 hình
   *    duy nhất = 1 lệnh vẽ. Màu riêng từng chi tiết giữ bằng vertex color.
   * --------------------------------------------------------------------- */
  HALONG.hinh = {
    // Tô 1 màu cho mọi đỉnh của hình
    toMau: function (hinh, mau) {
      var c = new THREE.Color(mau);
      var n = hinh.attributes.position.count;
      var mang = new Float32Array(n * 3);
      for (var i = 0; i < n; i++) { mang[i * 3] = c.r; mang[i * 3 + 1] = c.g; mang[i * 3 + 2] = c.b; }
      hinh.setAttribute('color', new THREE.BufferAttribute(mang, 3));
      return hinh;
    },
    // Dời hình tới (x, y, z) sau khi xoay (radian) – "nướng" luôn vào tọa độ đỉnh
    dat: function (hinh, x, y, z, xoayX, xoayY, xoayZ) {
      if (xoayX) hinh.rotateX(xoayX);
      if (xoayZ) hinh.rotateZ(xoayZ);
      if (xoayY) hinh.rotateY(xoayY);
      hinh.translate(x, y, z);
      return hinh;
    },
    // Ống tròn nối 2 điểm a → b (dùng cho cột, thanh lan can, nẹp buồm)
    ongNoi: function (a, b, banKinh, soCanh) {
      var huong = new THREE.Vector3().subVectors(b, a);
      var hinh = new THREE.CylinderGeometry(banKinh, banKinh, huong.length(), soCanh || 6, 1, true);
      hinh.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0), huong.clone().normalize()));
      hinh.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
      return hinh;
    },
    // Gộp danh sách hình thành 1. boUv = true: bỏ toạ độ texture (khi vật liệu không dùng ảnh)
    gop: function (ds, boUv) {
      // mergeGeometries đòi mọi hình có CÙNG bộ thuộc tính (position, normal, uv, color...)
      ds.forEach(function (h) {
        if (boUv && h.attributes.uv) h.deleteAttribute('uv');
      });
      var ketQua = THREE.BufferGeometryUtils.mergeGeometries(ds, false);
      ds.forEach(function (h) { h.dispose(); });
      return ketQua;
    }
  };

  // Lấy vị trí camera trong thế giới (dùng ở nhiều component)
  HALONG.viTriCamera = function (sceneEl, ketQua) {
    var cam = sceneEl.camera;
    if (cam) cam.getWorldPosition(ketQua);
    return ketQua;
  };

  // Danh sách vật cản (đảo...) để dieu-khien.js chặn không cho đi xuyên.
  // Mỗi phần tử: { x, z, r (bán kính chân), cao (độ cao đỉnh) }
  HALONG.vatCan = HALONG.vatCan || [];
})();
