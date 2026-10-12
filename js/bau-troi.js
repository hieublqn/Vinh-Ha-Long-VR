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
 * - Giữ BẢNG MÀU cho từng thời điểm. Mốc 1 có "Hoàng hôn";
 *   Mốc 3 sẽ thêm "Ngày", "Đêm" và chuyển mượt giữa chúng.
 * ========================================================================= */
(function () {
  'use strict';

  var HALONG = window.HALONG;

  /* Bảng màu: mã màu viết dạng #hex (sRGB) cho dễ chỉnh bằng mắt.
   * matTroi.cao       : góc cao mặt trời so với chân trời (độ)
   * matTroi.phuongVi  : góc phương vị (độ), 0 = phía trước điểm xuất phát (-Z),
   *                     số dương = lệch sang phải (+X)                          */
  HALONG.BANG_MAU = {
    hoangHon: {
      ten: 'Hoàng hôn',
      matTroi: { cao: 4.5, phuongVi: 14 },
      dinhTroi: '#232a5c',     // xanh tím thẫm trên đỉnh
      giuaTroi: '#8a5689',     // tím hồng lưng chừng
      chanTroi: '#e38a6c',     // cam hồng sát chân trời
      quangMatTroi: '#ffae57', // cam vàng quanh mặt trời
      mauNang: '#ffb27a', cuongDoNang: 1.8,
      anhTroi: '#7563a6', anhDat: '#1f3a48', cuongDoTroi: 0.7,
      nuocSau: '#0b2f3c', nuocNong: '#1f7a72',
      matDoSuong: 0.0042
    }
  };

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
    '  // Đĩa mặt trời: sáng hơn 1.0 (HDR) để tone mapping tạo cảm giác chói',
    '  float dia = smoothstep(0.99982, 0.99990, gan);',
    '  c += (uMauNang * 2.5 + vec3(1.2, 0.9, 0.6)) * dia;',
    '',
    '  // Mây sợi: chiếu hướng nhìn lên một "trần mây" phẳng, kéo dãn theo phương ngang',
    '  if (d.y > 0.0) {',
    '    vec2 uv = d.xz / (d.y + 0.06);',
    '    uv = uv * vec2(0.28, 1.5) + vec2(uThoiGian * 0.004, 0.0);',
    '    float n = fbm(uv * 1.3);',
    '    float may = smoothstep(0.5, 0.78, n);',
    '    // mây mỏng dần sát chân trời và ở đỉnh trời',
    '    may *= smoothstep(0.012, 0.09, d.y) * (1.0 - smoothstep(0.3, 0.65, d.y));',
    '    // phía mặt trời mây được rọi viền vàng cam, phía kia tím xám',
    '    vec3 mauMay = mix(uMauGiuaTroi * 0.6, uMauMatTroi * 1.35, pow(gan, 4.0));',
    '    c = mix(c, mauMay, may * 0.8);',
    '  }',
    '',
    '  // Phía dưới chân trời: chuyển dần sang màu nước sâu',
    '  // (mặt biển hơi trong nên nhìn xuyên xuống sẽ thấy màu này)',
    '  c = mix(c, uMauNuocSau, smoothstep(0.0, -0.1, d.y));',
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
      this.datBangMau(HALONG.BANG_MAU[this.data.cheDo] || HALONG.BANG_MAU.hoangHon);
    },

    // Đổ màu của một bảng màu vào uniform chung + đèn
    datBangMau: function (bm) {
      var u = HALONG.uniformChung;
      HALONG.tinhHuongMatTroi(bm, u.uHuongMatTroi.value);
      u.uMauDinhTroi.value.set(bm.dinhTroi);
      u.uMauGiuaTroi.value.set(bm.giuaTroi);
      u.uMauChanTroi.value.set(bm.chanTroi);
      u.uMauMatTroi.value.set(bm.quangMatTroi);
      u.uMauNang.value.set(bm.mauNang).multiplyScalar(bm.cuongDoNang);
      u.uMauNuocSau.value.set(bm.nuocSau);
      u.uMauNuocNong.value.set(bm.nuocNong);
      u.uMatDoSuong.value = bm.matDoSuong;

      // three.js (r155+) dùng đơn vị ánh sáng vật lý: muốn bề mặt trắng được chiếu
      // sáng "bằng 1" thì cường độ phải là π. Nhân π ở đây để bảng màu dễ đọc.
      this.nang.color.set(bm.mauNang);
      this.nang.intensity = bm.cuongDoNang * Math.PI;
      this.nang.position.copy(u.uHuongMatTroi.value).multiplyScalar(200);
      this.anhTroi.color.set(bm.anhTroi);
      this.anhTroi.groundColor.set(bm.anhDat);
      this.anhTroi.intensity = bm.cuongDoTroi * Math.PI;
    },

    tick: function (t) {
      HALONG.uniformChung.uThoiGian.value = t / 1000;
      // Quả cầu trời luôn đặt tâm tại mắt người xem → đi bao xa trời vẫn "ở vô cực"
      HALONG.viTriCamera(this.el.sceneEl, this.viTriCam);
      this.cauTroi.position.copy(this.viTriCam);
    }
  });
})();
