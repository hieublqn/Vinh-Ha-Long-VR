/* =========================================================================
 * sinh-vat.js – HẢI ÂU BAY ĐÀN + ĐOM ĐÓM BAN ĐÊM
 * -------------------------------------------------------------------------
 * Component "hai-au": đàn hải âu bay theo thuật toán BOIDS (Craig Reynolds,
 *   1986). Mỗi con chim chỉ theo 3 luật đơn giản với các con ở gần:
 *     1. Tách ra  (separation): đừng bay quá sát nhau.
 *     2. Đồng hướng (alignment): bay cùng hướng với các bạn xung quanh.
 *     3. Gắn kết (cohesion): bay về phía giữa nhóm.
 *   + luật riêng: lượn quanh trên thuyền (hải âu hay theo thuyền), giữ độ cao,
 *     tránh vách đảo. Cả đàn TỰ tạo thành hình bầy uốn lượn rất tự nhiên.
 *   Vẽ: 1 InstancedMesh (1 draw call). Cánh vỗ / lượn trong vertex shader.
 *   Ban đêm hải âu bay đi ngủ (ẩn dần).
 *
 * Component "dom-dom": vài trăm đom đóm quanh chân đảo có cây và quanh làng
 *   chài, chỉ sáng khi trời tối, nhấp nháy + bay lơ lửng (1 draw call).
 * ========================================================================= */
(function () {
  'use strict';

  var HALONG = window.HALONG;
  var LEN = new THREE.Vector3(0, 1, 0);

  /* ---------- Hình con hải âu (mũi hướng +Z, sải cánh theo trục X) ----------
   * Thuộc tính 'canh' = khoảng cách tới thân (0 ở thân → 1 ở đầu cánh):
   * vertex shader dùng nó để uốn cánh khi vỗ (đầu cánh vung nhiều nhất). */
  function taoHinhHaiAu() {
    var viTri = [], mau = [], canh = [];
    var TRANG = [0.93, 0.93, 0.9], XAM = [0.66, 0.68, 0.71], DEN = [0.12, 0.12, 0.12];
    function tamGiac(a, b, c, m, ka, kb, kc) {
      viTri.push.apply(viTri, a.concat(b, c));
      mau.push.apply(mau, m.concat(m, m));
      canh.push(ka, kb, kc);
    }
    // Thân: khối thoi dẹt (mũi z = 0.35, đuôi z = -0.4)
    var mui = [0, 0, 0.35], duoi = [0, 0.01, -0.4], tren = [0, 0.07, 0.02], duoiB = [0, -0.06, 0.04];
    var trai = [-0.07, 0, 0.05], phai = [0.07, 0, 0.05];
    [[mui, phai, tren], [mui, tren, trai], [mui, duoiB, phai], [mui, trai, duoiB],
     [duoi, tren, phai], [duoi, trai, tren], [duoi, phai, duoiB], [duoi, duoiB, trai]].forEach(function (t) {
      tamGiac(t[0], t[1], t[2], TRANG, 0, 0, 0);
    });
    // Đuôi xòe
    tamGiac([0, 0.01, -0.35], [-0.09, 0.01, -0.52], [0.09, 0.01, -0.52], TRANG, 0, 0, 0);
    // 2 cánh, mỗi cánh 2 đoạn: trong (xám) + ngoài (đầu cánh đen)
    [-1, 1].forEach(function (b) {
      var a0 = [b * 0.05, 0.02, 0.12], a1 = [b * 0.05, 0.02, -0.12];
      var g0 = [b * 0.4, 0.03, 0.1], g1 = [b * 0.4, 0.03, -0.12];
      var n0 = [b * 0.78, 0.02, -0.02], n1 = [b * 0.72, 0.02, -0.13];
      tamGiac(a0, g0, a1, XAM, 0, 0.5, 0); tamGiac(a1, g0, g1, XAM, 0, 0.5, 0.5);
      tamGiac(g0, n0, g1, XAM, 0.5, 1, 0.5); tamGiac(g1, n0, n1, DEN, 0.5, 1, 1);
    });
    var hinh = new THREE.BufferGeometry();
    hinh.setAttribute('position', new THREE.Float32BufferAttribute(viTri, 3));
    hinh.setAttribute('color', new THREE.Float32BufferAttribute(mau, 3));
    hinh.setAttribute('canh', new THREE.Float32BufferAttribute(canh, 1));
    hinh.computeVertexNormals();
    hinh.scale(1.5, 1.5, 1.5);   // to hơn thật một chút cho dễ nhìn từ xa
    return hinh;
  }

  AFRAME.registerComponent('hai-au', {
    schema: {
      soLuong: { default: 26 }
    },

    init: function () {
      var n = this.data.soLuong, rand = HALONG.taoRandom(808);
      var hinh = taoHinhHaiAu();
      // Mỗi con 1 cặp (pha vỗ cánh, mức vỗ 0..1) → cập nhật mỗi khung hình
      this.phaCanh = new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2);
      this.phaCanh.setUsage(THREE.DynamicDrawUsage);
      hinh.setAttribute('phaCanh', this.phaCanh);

      var vatLieu = HALONG.vaShader(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), {
        ten: 'hai-au',
        dinhKhaiBao: 'attribute float canh;\nattribute vec2 phaCanh;\nuniform float uThoiGian;',
        // Vỗ cánh: nâng/hạ đầu cánh theo sin; mức vỗ = 0 thì cánh dang thẳng (đang lượn)
        dinhBienDang: 'transformed.y += sin(uThoiGian * 9.0 + phaCanh.x) * 0.55 * canh * phaCanh.y + 0.08 * canh * (1.0 - phaCanh.y);'
      });
      this.luoi = new THREE.InstancedMesh(hinh, vatLieu, n);
      this.luoi.frustumCulled = false;
      this.el.setObject3D('mesh', this.luoi);

      // Trạng thái từng con: vị trí, vận tốc, mức vỗ cánh
      this.chim = [];
      for (var i = 0; i < n; i++) {
        var goc = rand() * Math.PI * 2;
        this.chim.push({
          p: new THREE.Vector3(Math.cos(goc) * 30, 18 + rand() * 10, 60 + Math.sin(goc) * 30),
          v: new THREE.Vector3(Math.cos(goc + 1.6), 0, Math.sin(goc + 1.6)).multiplyScalar(9),
          vo: 1, pha: rand() * 6.28, lech: rand() * 100
        });
        this.phaCanh.setXY(i, this.chim[i].pha, 1);
      }
      // Vector tạm dùng lại mỗi khung hình (không tạo mới → không rác bộ nhớ)
      this.tam = { lucDay: new THREE.Vector3(), tb: new THREE.Vector3(), huong: new THREE.Vector3(), tach: new THREE.Vector3(),
        dich: new THREE.Vector3(), d: new THREE.Vector3(), x: new THREE.Vector3(), y: new THREE.Vector3(), z: new THREE.Vector3(),
        m: new THREE.Matrix4(), q: new THREE.Quaternion(), qLac: new THREE.Quaternion(), s: new THREE.Vector3() };
      this.hienRo = 1;
    },

    tick: function (t, dt) {
      if (!dt) return;
      var giay = Math.min(dt, 50) / 1000, tg = t / 1000;
      var T = this.tam, ds = this.chim, n = ds.length, i, j;

      // Ban đêm: đàn chim bay đi ngủ (ẩn dần)
      var dem = HALONG.uniformChung.uDem.value;
      this.hienRo = 1 - HALONG.smoothstep(0.35, 0.8, dem);
      this.luoi.visible = this.hienRo > 0.01;
      if (!this.luoi.visible) return;

      // Điểm hẹn: lượn vòng phía trên thuyền (không có thuyền thì giữa vịnh)
      var tam = HALONG.thuyen ? HALONG.thuyen.viTri : T.dich.set(0, 0, 0);
      var vatCan = HALONG.vatCan;

      for (i = 0; i < n; i++) {
        var a = ds[i];
        T.lucDay.set(0, 0, 0); T.tb.set(0, 0, 0); T.huong.set(0, 0, 0); T.tach.set(0, 0, 0);
        var soGan = 0;
        for (j = 0; j < n; j++) {
          if (j === i) continue;
          var b = ds[j];
          T.d.subVectors(a.p, b.p);
          var kc2 = T.d.lengthSq();
          if (kc2 < 400) {                              // trong bán kính 20 m
            T.tb.add(b.p); T.huong.add(b.v); soGan++;
            if (kc2 < 9) T.tach.addScaledVector(T.d, 1 / Math.max(kc2, 0.2));   // quá sát (< 3 m) → đẩy ra
          }
        }
        if (soGan) {
          T.tb.multiplyScalar(1 / soGan).sub(a.p);      // 3. gắn kết: về phía giữa nhóm
          T.lucDay.addScaledVector(T.tb, 0.25);
          T.huong.multiplyScalar(1 / soGan).sub(a.v);   // 2. đồng hướng: chỉnh theo vận tốc trung bình
          T.lucDay.addScaledVector(T.huong, 0.6);
        }
        T.lucDay.addScaledVector(T.tach, 9);            // 1. tách ra

        // Lượn quanh điểm hẹn phía trên thuyền (mỗi con 1 quỹ đạo hơi khác)
        T.dich.set(tam.x + Math.sin(tg * 0.13 + a.lech) * 28, 20 + 7 * Math.sin(tg * 0.07 + a.lech), tam.z + Math.cos(tg * 0.11 + a.lech) * 28);
        T.d.subVectors(T.dich, a.p);
        var xa = T.d.length();
        T.lucDay.addScaledVector(T.d, (xa > 80 ? 2.2 : 0.7) / Math.max(xa, 1) * 4);

        // Giữ độ cao 8–45 m
        if (a.p.y < 8) T.lucDay.y += (8 - a.p.y) * 2;
        if (a.p.y > 45) T.lucDay.y -= (a.p.y - 45) * 2;

        // Tránh vách đảo: đang thấp hơn đỉnh và lại gần → đẩy ra + bốc lên
        for (j = 0; j < vatCan.length; j++) {
          var o = vatCan[j];
          if (a.p.y > o.cao + 6) continue;
          var dx = a.p.x - o.x, dz = a.p.z - o.z, kc = Math.hypot(dx, dz), vung = o.r + 14;
          if (kc < vung && kc > 0.01) {
            var manh = (vung - kc) / vung * 30;
            T.lucDay.x += dx / kc * manh; T.lucDay.z += dz / kc * manh; T.lucDay.y += manh * 0.4;
          }
        }

        // Cập nhật vận tốc (giới hạn gia tốc) và vị trí; tốc độ 7–13 m/s
        if (T.lucDay.lengthSq() > 900) T.lucDay.setLength(30);
        a.v.addScaledVector(T.lucDay, giay);
        var tocDo = a.v.length();
        if (tocDo > 13) a.v.multiplyScalar(13 / tocDo);
        else if (tocDo < 7) a.v.multiplyScalar(7 / Math.max(tocDo, 0.01));
        a.p.addScaledVector(a.v, giay);

        // Vỗ cánh khi đang lên cao / chậm, lượn khi đang bay xuôi (chuyển mượt)
        var canVo = a.v.y > 0.6 || tocDo < 8 || Math.sin(tg * 0.4 + a.lech) > 0.55 ? 1 : 0.1;
        a.vo += (canVo - a.vo) * Math.min(giay * 2, 1);
        this.phaCanh.setXY(i, a.pha, a.vo);

        // Hướng con chim: trục z = hướng bay, nghiêng cánh (lượn) theo lực rẽ ngang
        T.z.copy(a.v).normalize();
        T.x.crossVectors(LEN, T.z).normalize();
        T.y.crossVectors(T.z, T.x);
        T.m.makeBasis(T.x, T.y, T.z);
        T.q.setFromRotationMatrix(T.m);
        var lac = THREE.MathUtils.clamp(-T.lucDay.dot(T.x) * 0.03, -0.7, 0.7);
        T.q.multiply(T.qLac.setFromAxisAngle(T.z.set(0, 0, 1), lac));
        T.s.setScalar(this.hienRo);
        this.luoi.setMatrixAt(i, T.m.compose(a.p, T.q, T.s));
      }
      this.luoi.instanceMatrix.needsUpdate = true;
      this.phaCanh.needsUpdate = true;
    },

    remove: function () {
      this.el.removeObject3D('mesh');
    }
  });

  /* ---------- Đom đóm ---------- */
  AFRAME.registerComponent('dom-dom', {
    init: function () {
      var rand = HALONG.taoRandom(1212);
      var viTri = [], mau = [], c = new THREE.Color(), c1 = new THREE.Color('#c8ff6a'), c2 = new THREE.Color('#fff38a');
      function themQuanh(x, z, rTrong, rNgoai, soLuong, caoMax) {
        for (var i = 0; i < soLuong; i++) {
          var g = rand() * Math.PI * 2, r = rand.khoang(rTrong, rNgoai);
          viTri.push(x + Math.cos(g) * r, rand.khoang(0.6, caoMax), z + Math.sin(g) * r);
          c.copy(c1).lerp(c2, rand());
          mau.push(c.r, c.g, c.b);
        }
      }
      var self = this;
      function dung() {
        // Quanh chân các đảo nổi bật (có cây) và làng chài
        (HALONG.dsDao || []).slice(0, 4).forEach(function (d) { themQuanh(d.x, d.z, d.rChan + 1, d.rChan + 12, 45, 9); });
        if (HALONG.langChai) themQuanh(HALONG.langChai.x, HALONG.langChai.z, 5, 48, 90, 5);
        // Vài đảo nhỏ gần lộ trình
        (HALONG.dsDao || []).slice(4).filter(function (d) {
          return HALONG.LO_TRINH.khoangCachToi(d.x, d.z) - d.rChan < 50;
        }).slice(0, 6).forEach(function (d) { themQuanh(d.x, d.z, d.rChan + 1, d.rChan + 8, 14, 7); });
        self.el.setObject3D('mesh', HALONG.taoDiemSang({
          viTri: viTri, mau: mau, kichThuoc: 0.3, nhapNhay: 1, troi: 1.4, sangNgay: 0, hatGiong: 31
        }));
      }
      // Cần danh sách đảo + làng chài đã dựng xong
      if (HALONG.dsDao && HALONG.langChai) dung();
      else this.el.sceneEl.addEventListener('loaded', dung, { once: true });
    },

    remove: function () {
      this.el.removeObject3D('mesh');
    }
  });
})();
