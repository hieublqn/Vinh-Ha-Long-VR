/* =========================================================================
 * bau-troi.js – BẦU TRỜI, MẶT TRỜI, MÂY, SƯƠNG MÙ VÀ ÁNH SÁNG
 * -------------------------------------------------------------------------
 * - Bầu trời là 1 quả cầu rất lớn bao quanh người xem, mặt trong được tô
 *   bằng shader (chương trình chạy trên GPU) → gradient cam–tím, mặt trời,
 *   quầng sáng và mây sợi. Không dùng ảnh nào.
 * - Đặt 2 nguồn sáng:
 *     + Nắng (DirectionalLight): tia song song từ mặt trời.
 *     + Ánh trời (HemisphereLight): ánh sáng tán xạ, phía trên màu trời,
 *       phía dưới màu nước → vùng khuất nắng không bị đen kịt.
 * - Giữ BẢNG MÀU cho 3 thời điểm: Ngày, Hoàng hôn, Đêm. Đổi thời điểm bằng
 *   HALONG.datThoiDiem('dem')... → mọi màu, hướng mặt trời, cường độ đèn được
 *   NỘI SUY (chuyển dần) trong vài giây, không đổi "phụt" một cái.
 * - Ban đêm: mặt trời thành mặt trăng (đĩa nhỏ, trắng xanh), trời có sao lấp
 *   lánh; biến uDem (0 → 1) báo cho đèn lồng, đom đóm, cửa sổ... biết trời tối.
 * ========================================================================= */
(function () {
  'use strict';

  var HALONG = window.HALONG;

  /* Bảng màu: mã màu viết dạng #hex (sRGB) cho dễ chỉnh bằng mắt.
   * matTroi.cao       : góc cao mặt trời so với chân trời (độ)
   * matTroi.phuongVi  : góc phương vị (độ), 0 = phía trước điểm xuất phát (-Z),
   *                     số dương = lệch sang phải (+X)                          */
  HALONG.BANG_MAU = {
    ngay: {
      ten: 'Ngày',
      matTroi: { cao: 52, phuongVi: -125 },
      dinhTroi: '#2c69bd', giuaTroi: '#76aadd', chanTroi: '#cbe0ee', quangMatTroi: '#fff2d2',
      may: '#f4f6fb', dia: '#fff6e0', doLonDia: 1.0,
      mauNang: '#fff2df', cuongDoNang: 2.3,
      anhTroi: '#a8cbed', anhDat: '#3f6d66', cuongDoTroi: 1.0,
      nuocSau: '#0b4855', nuocNong: '#27a094',
      matDoSuong: 0.0026, dem: 0
    },
    hoangHon: {
      ten: 'Hoàng hôn',
      matTroi: { cao: 4.5, phuongVi: 14 },
      dinhTroi: '#232a5c',     // xanh tím thẫm trên đỉnh
      giuaTroi: '#8a5689',     // tím hồng lưng chừng
      chanTroi: '#e38a6c',     // cam hồng sát chân trời
      quangMatTroi: '#ffae57', // cam vàng quanh mặt trời
      may: '#53344f', dia: '#ffe6b8', doLonDia: 1.0,
      mauNang: '#ffb27a', cuongDoNang: 1.8,
      anhTroi: '#7563a6', anhDat: '#1f3a48', cuongDoTroi: 0.7,
      nuocSau: '#0b2f3c', nuocNong: '#1f7a72',
      matDoSuong: 0.0042, dem: 0
    },
    dem: {
      ten: 'Đêm',
      // "mặt trời" ban đêm = mặt trăng: ánh sáng yếu, xanh lạnh
      matTroi: { cao: 30, phuongVi: -35 },
      dinhTroi: '#03060f', giuaTroi: '#0a1330', chanTroi: '#1b2a4d', quangMatTroi: '#3a4c80',
      may: '#121a30', dia: '#dfe8ff', doLonDia: 0.8,
      mauNang: '#9db3e6', cuongDoNang: 0.5,
      anhTroi: '#33477c', anhDat: '#050a13', cuongDoTroi: 0.45,
      nuocSau: '#020a14', nuocNong: '#082838',
      matDoSuong: 0.0032, dem: 1
    }
  };
  var THU_TU_THOI_DIEM = ['ngay', 'hoangHon', 'dem'];

  // Đổi (góc cao, phương vị) của mặt trời → vector đơn vị hướng tới mặt trời
  HALONG.tinhHuongMatTroi = function (bm, ketQua) {
    var cao = THREE.MathUtils.degToRad(bm.matTroi.cao);
    var pv = THREE.MathUtils.degToRad(bm.matTroi.phuongVi);
    return (ketQua || new THREE.Vector3()).set(
      Math.sin(pv) * Math.cos(cao),
      Math.sin(cao),
      -Math.cos(pv) * Math.cos(cao)
    );
  };

  var DINH_SHADER_TROI = [
    'varying vec3 vHuong;',
    'void main() {',
    '  vec4 viTri = modelMatrix * vec4(position, 1.0);',
    '  vHuong = viTri.xyz - cameraPosition;   // hướng từ mắt tới điểm trên bầu trời',
    '  gl_Position = projectionMatrix * viewMatrix * viTri;',
    '}'
  ].join('\n');

  var MANH_SHADER_TROI = [
    'uniform float uThoiGian;',
    'uniform vec3 uMauNang;',
    'uniform vec3 uMauNuocSau;',
    'uniform vec3 uMauMay;',
    'uniform vec3 uMauDia;',
    'uniform float uKichThuocDia;',
    'uniform float uDem;',
    'varying vec3 vHuong;',
    HALONG.glsl.bauTroi,
    HALONG.glsl.noise,
    '',
    'float fbm(vec2 p) {',
    '  float s = 0.0, a = 0.5;',
    '  for (int i = 0; i < SO_TANG_MAY; i++) {',
    '    s += a * noise2(p);',
    '    p = p * 2.03 + vec2(17.1, 9.2);',
    '    a *= 0.5;',
    '  }',
    '  return s;',
    '}',
    '',
    'void main() {',
    '  vec3 d = normalize(vHuong);',
    '  vec3 c = mauTroi(d);',
    '  float gan = max(dot(d, uHuongMatTroi), 0.0);',
    '',
    '  // Sao: chia bầu trời thành lưới ô nhỏ, mỗi ô có ~1.5% cơ hội chứa 1 ngôi sao,',
    '  // độ sáng nhấp nháy theo thời gian. Chỉ hiện khi trời tối (uDem).',
    '  if (uDem > 0.01 && d.y > 0.0) {',
    '    vec3 o = d * 260.0;',
    '    vec3 i = floor(o);',
    '    float h = fract(sin(dot(i, vec3(127.1, 311.7, 74.7))) * 43758.5453);',
    '    float r = length(fract(o) - 0.5);',
    '    float sao = step(0.985, h) * smoothstep(0.22, 0.0, r);',
    '    sao *= 0.55 + 0.45 * sin(uThoiGian * (1.0 + h * 3.0) + h * 60.0);',
    '    c += vec3(0.85, 0.9, 1.0) * sao * 1.6 * uDem * smoothstep(0.02, 0.25, d.y);',
    '  }',
    '',
    '  // Đĩa mặt trời / mặt trăng: sáng hơn 1.0 (HDR) để tone mapping tạo cảm giác chói',
    '  float dia = smoothstep(uKichThuocDia, uKichThuocDia + 0.00008, gan);',
    '  c += uMauDia * dia;',
    '',
    '  // Mây sợi: chiếu hướng nhìn lên một "trần mây" phẳng, kéo dãn theo phương ngang',
    '  if (d.y > 0.0) {',
    '    vec2 uv = d.xz / (d.y + 0.06);',
    '    uv = uv * vec2(0.28, 1.5) + vec2(uThoiGian * 0.004, 0.0);',
    '    float n = fbm(uv * 1.3);',
    '    float may = smoothstep(0.5, 0.78, n);',
    '    // mây mỏng dần sát chân trời và ở đỉnh trời',
    '    may *= smoothstep(0.012, 0.09, d.y) * (1.0 - smoothstep(0.3, 0.65, d.y));',
    '    // phía mặt trời mây được rọi viền sáng (vàng cam lúc hoàng hôn), phía kia mang màu nền',
    '    vec3 mauMay = mix(uMauMay, uMauMatTroi * 1.35, pow(gan, 4.0));',
    '    c = mix(c, mauMay, may * 0.8);',
    '  }',
    '',
    '  // Phía dưới chân trời: sát chân trời giữ màu sương (khớp với mặt biển ở xa,',
    '  // nhất là khi bay cao thấy được mép tấm lưới biển); nhìn dốc xuống mới chuyển',
    '  // sang màu nước sâu (mặt biển hơi trong nên nhìn xuyên xuống sẽ thấy màu này)',
    '  c = mix(c, uMauNuocSau, smoothstep(-0.08, -0.4, d.y));',
    '',
    '  gl_FragColor = vec4(c, 1.0);',
    '  #include <tonemapping_fragment>',
    '  #include <colorspace_fragment>',
    '  // Rắc nhiễu cực nhỏ để khử hiện tượng "sọc màu" (banding) trên gradient',
    '  gl_FragColor.rgb += (bam12(gl_FragCoord.xy) - 0.5) / 255.0;',
    '}'
  ].join('\n');

  AFRAME.registerComponent('bau-troi', {
    schema: {
      cheDo: { default: 'hoangHon' }
    },

    init: function () {
      var u = HALONG.uniformChung;

      // 1) Quả cầu trời. Bán kính 1500 m (camera "far" đặt 4000 m nên không bị cắt).
      var hinh = new THREE.SphereGeometry(1500, 48, 24);
      var vatLieu = new THREE.ShaderMaterial({
        uniforms: u,                      // dùng thẳng uniform chung
        vertexShader: DINH_SHADER_TROI,
        fragmentShader: MANH_SHADER_TROI,
        defines: { SO_TANG_MAY: 4 },      // số lớp noise của mây (Mốc 5: máy yếu giảm còn 3)
        side: THREE.BackSide,             // tô mặt TRONG của quả cầu
        depthWrite: false
      });
      this.cauTroi = new THREE.Mesh(hinh, vatLieu);
      this.cauTroi.frustumCulled = false;
      // Vẽ trời SAU các vật đặc: chỗ nào đã có đảo che thì GPU bỏ qua, đỡ tốn công.
      this.cauTroi.renderOrder = 1;
      this.el.setObject3D('mesh', this.cauTroi);

      // 2) Ánh sáng
      this.nang = new THREE.DirectionalLight();
      this.anhTroi = new THREE.HemisphereLight();
      this.el.object3D.add(this.nang, this.nang.target, this.anhTroi);

      this.viTriCam = new THREE.Vector3();

      // 3) Trạng thái chuyển thời điểm: 'tu' (bắt đầu) → 'den' (đích), tiến độ 0..1
      this.tu = this.chuyenSo(HALONG.BANG_MAU[this.data.cheDo] || HALONG.BANG_MAU.hoangHon);
      this.den = this.chuyenSo(HALONG.BANG_MAU[this.data.cheDo] || HALONG.BANG_MAU.hoangHon);
      this.hienTai = this.chuyenSo(HALONG.BANG_MAU.hoangHon);
      this.tienDo = 1;
      this.thoiGianChuyen = 4;              // giây
      HALONG.thoiDiem = this.data.cheDo;
      this.apDung(this.den);

      // API cho giao diện / phím tắt: HALONG.datThoiDiem('ngay' | 'hoangHon' | 'dem')
      var self = this;
      HALONG.datThoiDiem = function (ten) { self.chuyenToi(ten); };
      HALONG.thoiDiemKeTiep = function () {
        var i = THU_TU_THOI_DIEM.indexOf(HALONG.thoiDiem);
        self.chuyenToi(THU_TU_THOI_DIEM[(i + 1) % THU_TU_THOI_DIEM.length]);
      };
    },

    // Đổi bảng màu (dạng chữ #hex) sang dạng số để nội suy được
    chuyenSo: function (bm) {
      function mau(hex) { return new THREE.Color(hex); }
      return {
        huong: HALONG.tinhHuongMatTroi(bm),
        dinhTroi: mau(bm.dinhTroi), giuaTroi: mau(bm.giuaTroi), chanTroi: mau(bm.chanTroi),
        quangMatTroi: mau(bm.quangMatTroi), may: mau(bm.may),
        dia: mau(bm.dia).multiplyScalar(bm.dem > 0.5 ? 2.2 : 4.5),   // HDR: đĩa sáng chói
        doLonDia: bm.doLonDia,
        nang: mau(bm.mauNang).multiplyScalar(bm.cuongDoNang), mauNang: mau(bm.mauNang), cuongDoNang: bm.cuongDoNang,
        anhTroi: mau(bm.anhTroi), anhDat: mau(bm.anhDat), cuongDoTroi: bm.cuongDoTroi,
        nuocSau: mau(bm.nuocSau), nuocNong: mau(bm.nuocNong),
        matDoSuong: bm.matDoSuong, dem: bm.dem
      };
    },

    // Bắt đầu chuyển dần sang thời điểm mới (xuất phát từ màu ĐANG hiển thị)
    chuyenToi: function (ten) {
      var bm = HALONG.BANG_MAU[ten];
      if (!bm) return;
      this.saoChep(this.tu, this.hienTai);
      this.den = this.chuyenSo(bm);
      this.tienDo = 0;
      HALONG.thoiDiem = ten;
      this.el.sceneEl.emit('doi-thoi-diem', { ten: ten, tenHienThi: bm.ten });
    },

    saoChep: function (dich, nguon) {
      for (var k in nguon) {
        if (nguon[k] && nguon[k].isColor) (dich[k] || (dich[k] = new THREE.Color())).copy(nguon[k]);
        else if (nguon[k] && nguon[k].isVector3) (dich[k] || (dich[k] = new THREE.Vector3())).copy(nguon[k]);
        else dich[k] = nguon[k];
      }
    },

    // Nội suy giữa 'tu' và 'den' theo k (0..1), đổ kết quả vào 'hienTai'
    noiSuy: function (k) {
      var a = this.tu, b = this.den, h = this.hienTai;
      for (var key in b) {
        if (b[key].isColor) (h[key] || (h[key] = new THREE.Color())).lerpColors(a[key], b[key], k);
        else if (b[key].isVector3) (h[key] || (h[key] = new THREE.Vector3())).lerpVectors(a[key], b[key], k).normalize();
        else h[key] = a[key] + (b[key] - a[key]) * k;
      }
    },

    // Đổ 1 bộ màu (dạng số) vào uniform chung + đèn
    apDung: function (bm) {
      this.saoChep(this.hienTai, bm);
      var u = HALONG.uniformChung;
      u.uHuongMatTroi.value.copy(bm.huong);
      u.uMauDinhTroi.value.copy(bm.dinhTroi);
      u.uMauGiuaTroi.value.copy(bm.giuaTroi);
      u.uMauChanTroi.value.copy(bm.chanTroi);
      u.uMauMatTroi.value.copy(bm.quangMatTroi);
      u.uMauMay.value.copy(bm.may);
      u.uMauDia.value.copy(bm.dia);
      // đĩa trăng nhỏ hơn đĩa mặt trời: doLonDia < 1 → cos gần 1 hơn
      u.uKichThuocDia.value = 1 - 0.00014 * bm.doLonDia * bm.doLonDia;
      u.uMauNang.value.copy(bm.nang);
      u.uMauNuocSau.value.copy(bm.nuocSau);
      u.uMauNuocNong.value.copy(bm.nuocNong);
      u.uMatDoSuong.value = bm.matDoSuong;
      u.uDem.value = bm.dem;

      // index.html bật physicallyCorrectLights: true → đèn dùng đơn vị vật lý (A-Frame
      // mặc định vẫn dùng đèn kiểu cũ). Ở chế độ vật lý, muốn bề mặt trắng được chiếu
      // sáng "bằng 1" thì cường độ phải là π. Nhân π ở đây để bảng màu dễ đọc.
      this.nang.color.copy(bm.mauNang);
      this.nang.intensity = bm.cuongDoNang * Math.PI;
      this.nang.position.copy(bm.huong).multiplyScalar(200);
      this.anhTroi.color.copy(bm.anhTroi);
      this.anhTroi.groundColor.copy(bm.anhDat);
      this.anhTroi.intensity = bm.cuongDoTroi * Math.PI;
    },

    tick: function (t, dt) {
      HALONG.uniformChung.uThoiGian.value = t / 1000;
      // Đang chuyển thời điểm: tăng tiến độ, nội suy, đổ vào uniform
      if (this.tienDo < 1 && dt) {
        this.tienDo = Math.min(this.tienDo + dt / 1000 / this.thoiGianChuyen, 1);
        var k = this.tienDo * this.tienDo * (3 - 2 * this.tienDo);   // smoothstep: chậm–nhanh–chậm
        var hienTai = this.hienTai;
        this.noiSuy(k);
        this.apDung(hienTai);
      }
      // Quả cầu trời luôn đặt tâm tại mắt người xem → đi bao xa trời vẫn "ở vô cực"
      HALONG.viTriCamera(this.el.sceneEl, this.viTriCam);
      this.cauTroi.position.copy(this.viTriCam);
    }
  });
})();
