/* =========================================================================
 * am-thanh.js – ÂM THANH TỰ TẠO BẰNG WEB AUDIO (component "am-thanh")
 * -------------------------------------------------------------------------
 * Không có file âm thanh nào: mọi tiếng đều được TỔNG HỢP bằng code từ 2
 * nguyên liệu:
 *   - NHIỄU (noise: tiếng "xè xè" ngẫu nhiên). Lọc bớt dải tần rồi tăng giảm
 *     âm lượng chậm → thành tiếng sóng, gió, nước vỗ, tiếng ù trong hang.
 *   - DAO ĐỘNG (oscillator: sóng sin / răng cưa). Uốn cao độ + bật tắt nhanh
 *     → thành tiếng hải âu, côn trùng, giọt nước.
 * Nhờ vậy chạy được cả khi mở thẳng file:// (không phải tải gì).
 *
 *   1. Nhớ lựa chọn tắt tiếng (localStorage).
 *   2. Bộ đệm tạo 1 lần: nhiễu hồng, nhiễu nâu, xung vang của hang, nhịp kêu
 *      côn trùng. Phát LẶP mãi → không phải sinh nhiễu mỗi khung hình.
 *   3. Tiện ích tạo node (bộ lọc, gain, panner 3D, "núm vặn" trượt mượt).
 *   4. Dựng đồ thị node (1 lần). Các lớp chạy liên tục:
 *        a) sóng biển + bọt sóng   b) nước vỗ mạn thuyền   c) gió
 *        d) côn trùng ban đêm (3 giọng)   e) hang: vang + tiếng ù trầm
 *      Sơ đồ nối dây:
 *        sóng, bọt sóng, nước vỗ, gió, côn trùng, hải âu
 *            → [lọc + âm lượng NGOÀI TRỜI] ──┐   (vào hang: nghe bị bóp nghẹt)
 *        giọt nước, vang, tiếng ù hang        │
 *            → [nhánh HANG] (chỉ nối khi gần) ┤
 *                                             └→ trộn → nén → âm lượng tổng → loa
 *   5. Hải âu: tiếng kêu ngắn, có hướng 3D (PannerNode) tại vị trí 1 con chim.
 *   6. Giọt nước trong hang: tiếng ngắn có hướng 3D + vang (ConvolverNode).
 *   7. Bờ đảo / làng chài gần nhất → chỗ đặt côn trùng.
 *   8. Tai người nghe: vị trí + hướng nhìn, cập nhật MỖI khung hình.
 *   9. Tham số chậm (âm lượng, bộ lọc, hẹn giờ tiếng ngắn): chỉ 10 lần/giây
 *      → máy yếu (Core i3) vẫn nhẹ.
 *  10. Tắt tiếng (nhỏ dần rồi cho bộ xử lý ngủ) + tạm dừng khi chuyển tab.
 *  11. Khởi động: trình duyệt CHẶN phát tiếng khi người dùng chưa bấm/chạm gì
 *      → chỉ tạo AudioContext trong HALONG.amThanh.batDau() (nút "Bắt đầu").
 *  12. Component "am-thanh": tick() gọi mục 8 và 9.
 * ========================================================================= */
(function () {
  'use strict';

  var HALONG = window.HALONG;
  var ss = HALONG.smoothstep;

  var KHOA_LUU = 'halong-tat-tieng';   // khoá localStorage nhớ lựa chọn tắt tiếng
  var MUC_TONG = 0.8;                  // âm lượng tổng (sau bộ nén)
  var TAU_TAT = 0.12;                  // setTargetAtTime: sau 3τ ≈ 0,36 s còn 5 % → "nhỏ dần ~0,4 s"
  var CHU_KY_CHAM = 100;               // ms – tham số chậm (âm lượng, bộ lọc...) cập nhật 10 lần/giây
  var R_GIOT = 45;                     // nghe giọt nước khi cách tâm khoang hang < 45 m
  // Nối / ngắt cả nhánh hang theo khoảng cách tới tâm khoang. Bộ vang (ConvolverNode) là phần
  // nặng nhất (~3 lần cả phần ngoài trời) → chỉ nối khi sắp nghe được giọt nước (R_GIOT).
  // 2 ngưỡng khác nhau → đứng ở mép không bị nối/ngắt liên tục.
  var R_NOI_HANG = 60, R_NGAT_HANG = 75;
  var KHOANG = { rx: 15, ry: 9, rz: 13 };    // 3 bán trục khoang hang (≈ 30 × 18 × 26 m, khớp hang-dong.js)

  var A = null;          // toàn bộ đồ thị âm thanh + trạng thái (null = chưa bắt đầu / không có âm thanh)
  var daHong = false;    // trình duyệt không hỗ trợ / lỗi khởi tạo → im lặng, KHÔNG làm hỏng khung cảnh
  var thanhPhan = null;  // component am-thanh (để lấy sceneEl, rig...)

  function ngauNhien(a, b) { return a + (b - a) * Math.random(); }
  function boQua() {}
  // resume()/suspend() trả về Promise: bị từ chối mà không bắt thì console hiện lỗi đỏ
  function goiAnToan(hua) { if (hua && hua.catch) hua.catch(boQua); }

  /* -----------------------------------------------------------------------
   * 1. NHỚ LỰA CHỌN TẮT TIẾNG
   *      localStorage có thể bị chặn (chế độ riêng tư, mở file:// trên vài
   *      trình duyệt) → luôn bọc try/catch, lỗi thì coi như "chưa lưu gì".
   * --------------------------------------------------------------------- */
  function docTatTieng() {
    try { return window.localStorage.getItem(KHOA_LUU) === '1'; } catch (e) { return false; }
  }
  function luuTatTieng(tat) {
    try { window.localStorage.setItem(KHOA_LUU, tat ? '1' : '0'); } catch (e) { /* không lưu được thì thôi */ }
  }

  /* -----------------------------------------------------------------------
   * 2. BỘ ĐỆM TẠO 1 LẦN
   * --------------------------------------------------------------------- */
  // Nhiễu stereo dài 'giay' giây, phát lặp được.
  //   'hong' (pink): năng lượng giảm dần về phía tần số cao → nghe êm như gió, nước chảy
  //                  (công thức lọc của Paul Kellet – vài phép nhân mỗi mẫu).
  //   'nau' (brown): nhiễu trắng cộng dồn có rò → trầm, ầm ì như sóng vỗ xa.
  // 2 kênh trái/phải là 2 dãy nhiễu KHÁC nhau → nghe rộng, bao quanh người nghe.
  // Nối vòng liền mạch: sinh dư F mẫu, rồi trộn dần (equal-power) đoạn dư đó vào
  // ĐẦU bộ đệm → mẫu cuối nối thẳng vào mẫu đầu, phát lặp không nghe tiếng "tách".
  function taoBoDemNhieu(ctx, giay, loai) {
    var sr = ctx.sampleRate, L = Math.floor(sr * giay), F = Math.floor(sr * 0.25);
    var bd = ctx.createBuffer(2, L, sr), tam = new Float32Array(L + F);
    for (var kenh = 0; kenh < 2; kenh++) {
      var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, i, w, max = 0;
      for (i = 0; i < L + F; i++) {
        w = Math.random() * 2 - 1;
        if (loai === 'nau') {
          b0 = (b0 + 0.02 * w) / 1.02;
          tam[i] = b0;
        } else {
          b0 = 0.99886 * b0 + w * 0.0555179;
          b1 = 0.99332 * b1 + w * 0.0750759;
          b2 = 0.969 * b2 + w * 0.153852;
          b3 = 0.8665 * b3 + w * 0.3104856;
          b4 = 0.55 * b4 + w * 0.5329522;
          b5 = -0.7616 * b5 - w * 0.016898;
          tam[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
          b6 = w * 0.115926;
        }
      }
      var ra = bd.getChannelData(kenh);
      for (i = 0; i < L; i++) ra[i] = tam[i];
      for (i = 0; i < F; i++) {
        var k = i / F * Math.PI / 2;
        ra[i] = tam[i] * Math.sin(k) + tam[L + i] * Math.cos(k);
      }
      // Chuẩn hoá đỉnh → mức các lớp không phụ thuộc may rủi của dãy ngẫu nhiên
      for (i = 0; i < L; i++) max = Math.max(max, Math.abs(ra[i]));
      for (i = 0; i < L; i++) ra[i] *= 0.9 / max;
    }
    return bd;
  }

  // "Xung vang" của hang: ConvolverNode trộn mỗi tiếng với bộ đệm này → nghe như
  // vang trong khoang đá. Thay vì thu âm hang thật, dùng nhiễu tắt dần theo hàm mũ
  // (-60 dB sau 'giay' giây) – đúng cách tiếng vang tự nhiên tắt dần.
  //   - Đuôi vang tối dần (lọc thông thấp mạnh dần): vách đá ẩm hút âm cao nhanh hơn âm trầm.
  //   - Vài xung rời rạc 12–90 ms đầu: tiếng dội sớm từ vách gần nhất.
  function taoXungVang(ctx, giay) {
    var sr = ctx.sampleRate, L = Math.floor(sr * giay);
    var bd = ctx.createBuffer(2, L, sr);
    for (var kenh = 0; kenh < 2; kenh++) {
      var ra = bd.getChannelData(kenh), lp = 0, i;
      for (i = 0; i < L; i++) {
        var t = i / sr, heSo = 0.85 - 0.75 * (t / giay);
        lp += heSo * ((Math.random() * 2 - 1) - lp);
        ra[i] = lp * Math.exp(-6.9 * t / giay) * Math.min(t / 0.02, 1);
      }
      for (var j = 0; j < 7; j++) {
        var vt = Math.floor(sr * ngauNhien(0.012, 0.09));
        ra[vt] += ngauNhien(-1, 1) * 0.8 * (1 - vt / (sr * 0.1));
      }
    }
    return bd;
  }

  // Nhịp kêu của côn trùng (dùng làm "đường bao" bật tắt âm lượng): 'soXung' xung
  // hình chuông cách nhau 1/nhip giây, rồi im lặng tới hết chu kỳ. Phát lặp bộ đệm này
  // vào gain.gain → tiếng "rích-rích-rích ... rích-rích-rích" mà không cần JS bật tắt.
  function taoBoDemNhip(ctx, chuKy, soXung, nhip) {
    var sr = ctx.sampleRate, L = Math.floor(sr * chuKy);
    var bd = ctx.createBuffer(1, L, sr), d = bd.getChannelData(0);
    var n = Math.floor(sr * 0.6 / nhip);          // mỗi xung chiếm 60 % khoảng cách giữa 2 xung
    for (var k = 0; k < soXung; k++) {
      var dau = Math.floor(sr * k / nhip), bienDo = ngauNhien(0.75, 1);
      for (var i = 0; i < n && dau + i < L; i++) {
        var s = Math.sin(Math.PI * i / n);
        d[dau + i] = bienDo * s * s;              // sin² → mở/đóng mềm, không lách tách
      }
    }
    return bd;
  }

  /* -----------------------------------------------------------------------
   * 3. TIỆN ÍCH TẠO NODE
   * --------------------------------------------------------------------- */
  function taoGain(ctx, giaTri) {
    var g = ctx.createGain();
    g.gain.value = giaTri;
    return g;
  }
  function taoLoc(ctx, loai, tanSo, q) {
    var f = ctx.createBiquadFilter();
    f.type = loai;
    f.frequency.value = tanSo;
    f.Q.value = q;
    return f;
  }
  // Nguồn nhiễu phát lặp. Nhiều lớp dùng CHUNG 1 bộ đệm nhưng bắt đầu ở chỗ khác nhau
  // và tốc độ hơi khác → không lớp nào "giống hệt" lớp nào, mà chỉ tốn 1 lần sinh nhiễu.
  function taoNguonLap(ctx, boDem, tocDo, batDauTu) {
    var n = ctx.createBufferSource();
    n.buffer = boDem;
    n.loop = true;
    n.playbackRate.value = tocDo;
    n.start(ctx.currentTime, batDauTu);
    return n;
  }
  // PannerNode: đặt tiếng ở 1 điểm 3D. distanceModel 'inverse': to/nhỏ theo khoảng cách
  // như ngoài đời (gấp đôi khoảng cách → nhỏ đi ~một nửa khi đã xa hơn refDistance).
  //   'HRTF'      : mô phỏng tai người (nghe được cả trên/dưới, trước/sau) nhưng tốn CPU
  //                 → chỉ dùng cho tiếng ngắn (hải âu, giọt nước).
  //   'equalpower': chỉ chia trái/phải, rất nhẹ → dùng cho tiếng kêu liên tục (côn trùng).
  function taoPanner(ctx, moHinh, refDistance) {
    var p = ctx.createPanner();
    p.panningModel = moHinh;
    p.distanceModel = 'inverse';
    p.refDistance = refDistance;
    p.rolloffFactor = 1;
    p.maxDistance = 10000;
    return p;
  }
  // Đặt vị trí panner: trình duyệt mới có positionX/Y/Z (AudioParam, hẹn giờ được);
  // Safari cũ chỉ có setPosition(). tau > 0 → trượt mượt tới vị trí mới.
  function datViTri(panner, x, y, z, t, tau) {
    if (panner.positionX) {
      if (tau) {
        panner.positionX.setTargetAtTime(x, t, tau);
        panner.positionY.setTargetAtTime(y, t, tau);
        panner.positionZ.setTargetAtTime(z, t, tau);
      } else {
        panner.positionX.setValueAtTime(x, t);
        panner.positionY.setValueAtTime(y, t);
        panner.positionZ.setValueAtTime(z, t);
      }
    } else {
      panner.setPosition(x, y, z);
    }
  }
  // "Núm vặn": bọc 1 AudioParam + giá trị đã gửi lần trước. 10 lần/giây ta tính lại mọi
  // mức, nhưng chỉ GỬI xuống luồng âm thanh khi đổi đáng kể (> nguong) → đỡ chất đống lịch
  // tự động hoá trong AudioParam. setTargetAtTime: trượt dần theo hàm mũ → không "bụp".
  function taoNum(param, nguong) { return { p: param, cu: NaN, nguong: nguong }; }
  function vanNum(num, giaTri, tau) {
    if (Math.abs(giaTri - num.cu) < num.nguong) return;
    num.cu = giaTri;
    num.p.setTargetAtTime(giaTri, A.ctx.currentTime, tau);
  }

  /* -----------------------------------------------------------------------
   * 4. DỰNG ĐỒ THỊ (chạy 1 lần trong batDau)
   * --------------------------------------------------------------------- */
  function dungDoThi(ctx) {
    var D = { ctx: ctx }, t0 = ctx.currentTime;
    var hong = taoBoDemNhieu(ctx, 4.1, 'hong');
    var nau = taoBoDemNhieu(ctx, 3.3, 'nau');
    // Tần số lọc không được vượt Nyquist (nửa tần số lấy mẫu) – vượt thì trình duyệt báo cảnh báo
    D.tanSoMax = Math.min(16000, ctx.sampleRate * 0.45);

    // --- Tầng cuối: trộn → nén → âm lượng tổng → loa.
    // Bộ nén (compressor) chặn các đỉnh bất chợt (hải âu kêu gần, nhiều lớp cùng lúc to lên)
    // → tổng luôn vừa tai, không vỡ tiếng.
    D.tron = taoGain(ctx, 1);
    D.nen = ctx.createDynamicsCompressor();
    D.nen.threshold.value = -20;
    D.nen.knee.value = 12;
    D.nen.ratio.value = 3;
    D.nen.attack.value = 0.01;
    D.nen.release.value = 0.3;
    D.tongRa = taoGain(ctx, 0);                 // bắt đầu từ 0 → batDau() mở dần lên
    D.tron.connect(D.nen);
    D.nen.connect(D.tongRa);
    D.tongRa.connect(ctx.destination);

    // --- Nhánh NGOÀI TRỜI: mọi tiếng ngoài trời đi qua 1 bộ lọc + 1 âm lượng chung.
    // Vào hang chỉ cần hạ 2 núm này: tiếng biển nghe nghẹt và nhỏ như vọng qua cửa hang.
    D.locNgoai = taoLoc(ctx, 'lowpass', D.tanSoMax, 0);
    D.busNgoai = taoGain(ctx, 1);
    D.locNgoai.connect(D.busNgoai);
    D.busNgoai.connect(D.tron);
    D.nLocNgoai = taoNum(D.locNgoai.frequency, 5);
    D.nNgoai = taoNum(D.busNgoai.gain, 0.003);

    // --- a) SÓNG BIỂN: nhiễu nâu → lọc thông thấp → "phồng xẹp" theo 2 LFO chậm.
    // 2 LFO tần số lệch nhau (0,13 Hz và 0,071 Hz – không chia hết cho nhau) → tổng của
    // chúng không bao giờ lặp đều đặn, mỗi con sóng to nhỏ khác nhau như sóng thật.
    var nguonNau = taoNguonLap(ctx, nau, 1, 0);
    D.locSong = taoLoc(ctx, 'lowpass', 700, 0);
    D.phongSong = taoGain(ctx, 0.55);           // 0,55 + 0,28·sin + 0,17·sin → 0,10 .. 1,00
    var lfo1 = ctx.createOscillator(), lfo2 = ctx.createOscillator();
    var sau1 = taoGain(ctx, 0.28), sau2 = taoGain(ctx, 0.17);
    lfo1.frequency.value = 0.13;
    lfo2.frequency.value = 0.071;
    lfo1.connect(sau1); sau1.connect(D.phongSong.gain);
    lfo2.connect(sau2); sau2.connect(D.phongSong.gain);
    lfo1.start(t0); lfo2.start(t0);
    D.t0Lfo = t0;                                // JS tính lại cùng pha LFO để lái bộ lọc + bọt sóng
    D.mucSong = taoGain(ctx, 0);
    nguonNau.connect(D.locSong);
    D.locSong.connect(D.phongSong);
    D.phongSong.connect(D.mucSong);
    D.mucSong.connect(D.locNgoai);
    // Bọt sóng: tiếng "xào" cao (nhiễu hồng quanh 2,4 kHz) chỉ nổi lên lúc con sóng dâng cao nhất
    var nguonBot = taoNguonLap(ctx, hong, 1, 0);
    D.locBot = taoLoc(ctx, 'bandpass', 2400, 0.7);
    D.mucBot = taoGain(ctx, 0);
    nguonBot.connect(D.locBot);
    D.locBot.connect(D.mucBot);
    D.mucBot.connect(D.mucSong);
    D.nLocSong = taoNum(D.locSong.frequency, 4);
    D.nBot = taoNum(D.mucBot.gain, 0.003);
    D.nSong = taoNum(D.mucSong.gain, 0.003);

    // --- b) NƯỚC VỖ MẠN THUYỀN: nhiễu hồng lọc dải 400–1000 Hz, âm lượng nhảy theo
    // từng "cú vỗ" ngẫu nhiên. KHÔNG dùng panner: đứng trên boong thì nước vỗ cả 2 mạn,
    // bao quanh người nghe – đặt ở 1 điểm (tâm thuyền) lại nghe như phát ra sau lưng.
    var nguonVo = taoNguonLap(ctx, hong, 0.97, 1.7);
    D.locVo = taoLoc(ctx, 'bandpass', 600, 0.9);
    D.mucVo = taoGain(ctx, 0);
    nguonVo.connect(D.locVo);
    D.locVo.connect(D.mucVo);
    D.mucVo.connect(D.locNgoai);
    D.nLocVo = taoNum(D.locVo.frequency, 5);
    D.nVo = taoNum(D.mucVo.gain, 0.002);

    // --- c) GIÓ: 1 nguồn nhiễu chia 2 bộ lọc dải:
    //   rít  : Q cao, tần số trung tâm lang thang 300–900 Hz → tiếng "hú" khi gió giật
    //   thổi : Q thấp quanh 350 Hz → tiếng ù rộng làm nền
    var nguonGio = taoNguonLap(ctx, hong, 1.03, 2.9);
    D.locRit = taoLoc(ctx, 'bandpass', 550, 4);
    D.locThoi = taoLoc(ctx, 'bandpass', 350, 0.6);
    var tangRit = taoGain(ctx, 2.2);             // dải hẹp lọt ít năng lượng → khuếch đại bù
    D.mucGio = taoGain(ctx, 0);
    nguonGio.connect(D.locRit); D.locRit.connect(tangRit); tangRit.connect(D.mucGio);
    nguonGio.connect(D.locThoi); D.locThoi.connect(D.mucGio);
    D.mucGio.connect(D.locNgoai);
    D.nTanSoGio = taoNum(D.locRit.frequency, 8);
    D.nQGio = taoNum(D.locRit.Q, 0.1);
    D.nGio = taoNum(D.mucGio.gain, 0.002);

    // --- d) CÔN TRÙNG: 3 giọng, mỗi giọng = dao động 3,8–5 kHz × nhịp kêu riêng
    // (chu kỳ, số xung, tốc độ phát khác nhau → không bao giờ kêu đồng loạt).
    // Cả nhánh chỉ được NỐI vào loa khi trời tối: ban ngày bộ xử lý không phải tính.
    D.busConTrung = taoGain(ctx, 0);
    D.nConTrung = taoNum(D.busConTrung.gain, 0.002);
    D.noiConTrung = false;
    D.conTrung = [
      { tanSo: 4600, loai: 'sine', chuKy: 0.55, soXung: 3, nhip: 30 },       // dế: "rích-rích-rích"
      { tanSo: 4150, loai: 'sine', chuKy: 0.83, soXung: 4, nhip: 27 },       // dế khác loài, chậm hơn
      { tanSo: 3850, loai: 'triangle', chuKy: 1.15, soXung: 2, nhip: 19 }    // ve đêm: 2 tiếng khàn hơn
    ].map(function (m, i) {
      var osc = ctx.createOscillator();
      osc.type = m.loai;
      osc.frequency.value = m.tanSo * ngauNhien(0.97, 1.03);
      var bao = taoGain(ctx, 0);                 // gain = 0 + đường bao nhịp kêu
      var nhip = ctx.createBufferSource();
      nhip.buffer = taoBoDemNhip(ctx, m.chuKy, m.soXung, m.nhip);
      nhip.loop = true;
      nhip.playbackRate.value = ngauNhien(0.92, 1.08);
      nhip.connect(bao.gain);
      var muc = taoGain(ctx, 1);                 // dùng để tắt-dời-bật khi chuyển sang bờ khác
      var pan = taoPanner(ctx, 'equalpower', 8);
      osc.connect(bao); bao.connect(muc); muc.connect(pan); pan.connect(D.busConTrung);
      osc.start(t0);
      nhip.start(t0 + i * 0.17);
      return { pan: pan, muc: muc, x: 0, z: 0, daDat: false };
    });

    // --- e) HANG ĐỘNG: nhánh riêng, chỉ nối vào loa khi ở gần hang (bộ vang tốn CPU).
    D.busHang = taoGain(ctx, 1);
    D.noiHang = false;
    D.vang = ctx.createConvolver();
    D.vang.buffer = taoXungVang(ctx, 2.5);
    D.guiVang = taoGain(ctx, 1);                // giọt nước gửi vào bộ vang
    D.mucVang = taoGain(ctx, 0.5);              // tiếng vang trả về
    D.guiVang.connect(D.vang);
    D.vang.connect(D.mucVang);
    D.mucVang.connect(D.busHang);
    // Tiếng biển ngoài cửa hang cũng dội vào vách → nghe "ầm ầm" vọng vào trong
    D.guiVangNgoai = taoGain(ctx, 0);
    D.busNgoai.connect(D.guiVangNgoai);
    D.guiVangNgoai.connect(D.vang);
    // Tiếng ù rất trầm trong lòng hang (nhiễu nâu dưới 120 Hz) – "không khí" của khoang đá kín
    D.locNenHang = taoLoc(ctx, 'lowpass', 120, 0);
    D.mucNenHang = taoGain(ctx, 0);
    nguonNau.connect(D.locNenHang);
    D.locNenHang.connect(D.mucNenHang);
    D.mucNenHang.connect(D.busHang);
    D.nNenHang = taoNum(D.mucNenHang.gain, 0.003);
    D.nGuiVangNgoai = taoNum(D.guiVangNgoai.gain, 0.003);
    D.nVang = taoNum(D.mucVang.gain, 0.003);

    // --- Trạng thái mô phỏng (cập nhật 10 lần/giây)
    D.viTri = new THREE.Vector3();               // vị trí tai người nghe (thế giới)
    D.viTriCu = new THREE.Vector3();
    D.daCoViTriCu = false;
    D.tai = [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN];   // tư thế tai đã gửi lần trước
    D.tocDoNghe = 0;                             // m/s – người nghe bay nhanh cỡ nào
    D.kHang = 0;                                 // 0 ngoài trời → 1 sâu trong hang
    D.trongHang = false;
    D.khoangCachBo = Infinity;
    D.bo = { x: 0, z: 0, nx: 1, nz: 0, co: false };
    D.lanTimBo = -Infinity;
    D.voTiep = 0; D.voManh = 1; D.voTau = 0.08;
    D.gioTiep = 0; D.gioDich = 0.8; D.gioHienTai = 0.8; D.tanSoGio = 550;
    D.hauTiep = t0 + ngauNhien(2, 5);
    D.giotTiep = 0;
    D.ctTiep = 0;
    D.dangPhat = false;                          // đang phát (không tắt tiếng, tab đang hiện)
    D.thongKe = { giotNuoc: 0, tiengHaiAu: 0, loi: 0 };
    return D;
  }

  /* -----------------------------------------------------------------------
   * 5. HẢI ÂU – 1 tiếng kêu = 2–4 nốt "kéo... kéo..."
   *    Dùng CHUNG 1 dao động cho mọi nốt trong 1 lần kêu (hẹn giờ cao độ + âm lượng
   *    từng nốt nối tiếp nhau) → mỗi lần kêu chỉ 4 node, kêu xong tự gỡ.
   *    Răng cưa có nhiều hoạ âm, qua lọc dải → giọng "the thé, khàn khàn" của hải âu.
   * --------------------------------------------------------------------- */
  function keuHaiAu(chim, doRo) {
    var ctx = A.ctx, t0 = ctx.currentTime + 0.05, t = t0;
    var osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    var loc = taoLoc(ctx, 'bandpass', ngauNhien(1600, 2000), 1.6);
    var bao = taoGain(ctx, 0);
    var pan = taoPanner(ctx, 'HRTF', 8);
    var soNot = 2 + Math.floor(Math.random() * 3);
    var fDau = ngauNhien(1600, 2600), fCuoi = ngauNhien(1000, 1500);
    var dinh = 0.5 * doRo * ngauNhien(0.7, 1);
    for (var i = 0; i < soNot; i++) {
      var dai = ngauNhien(0.17, 0.32) * (1 - i * 0.08);     // các nốt sau ngắn dần
      var f0 = fDau * ngauNhien(0.94, 1.06), f1 = Math.min(fCuoi * ngauNhien(0.95, 1.05), f0 * 0.8);
      // Cao độ: hơi vút lên đầu nốt rồi tụt xuống (kiểu "kí-ao") – dùng hàm mũ vì tai nghe
      // cao độ theo tỉ lệ, trượt mũ mới thấy đều
      osc.frequency.setValueAtTime(f0 * 0.82, t);
      osc.frequency.exponentialRampToValueAtTime(f0, t + 0.035);
      osc.frequency.exponentialRampToValueAtTime(f1, t + dai);
      bao.gain.setValueAtTime(0, t);
      bao.gain.linearRampToValueAtTime(dinh, t + 0.02);
      bao.gain.linearRampToValueAtTime(dinh * 0.75, t + dai * 0.65);
      bao.gain.linearRampToValueAtTime(0, t + dai);
      t += dai + ngauNhien(0.06, 0.18);
    }
    // Chim vẫn bay trong lúc kêu → cho tiếng trượt theo hướng bay
    var x1 = chim.p.x + chim.v.x * (t - t0), y1 = chim.p.y + chim.v.y * (t - t0), z1 = chim.p.z + chim.v.z * (t - t0);
    if (pan.positionX) {
      datViTri(pan, chim.p.x, chim.p.y, chim.p.z, t0, 0);
      pan.positionX.linearRampToValueAtTime(x1, t);
      pan.positionY.linearRampToValueAtTime(y1, t);
      pan.positionZ.linearRampToValueAtTime(z1, t);
    } else {
      pan.setPosition(chim.p.x, chim.p.y, chim.p.z);
    }
    osc.connect(bao); bao.connect(loc); loc.connect(pan); pan.connect(A.locNgoai);
    osc.onended = function () { osc.disconnect(); bao.disconnect(); loc.disconnect(); pan.disconnect(); };
    osc.start(t0);
    osc.stop(t + 0.05);
    A.thongKe.tiengHaiAu++;
  }

  // Chọn 1 con hải âu để kêu: con GẦN NHẤT trong 6 con bốc ngẫu nhiên → thường là con đang
  // lượn gần (nghe rõ) mà mỗi lần vẫn một hướng khác. Xa quá 160 m thì thôi: nghe chẳng
  // thấy gì, tạo node chỉ phí CPU.
  function chonHaiAu(ds, p) {
    var tot = null, kcTot = 160 * 160;
    for (var k = 0; k < 6 && ds.length; k++) {
      var g = ds[Math.floor(Math.random() * ds.length)], kc2 = g.p.distanceToSquared(p);
      if (kc2 < kcTot) { kcTot = kc2; tot = g; }
    }
    return tot;
  }

  /* -----------------------------------------------------------------------
   * 6. GIỌT NƯỚC – sin tụt cao độ rất nhanh (~1400 → ~500 Hz trong 30–60 ms) + tắt nhanh:
   *     chính kiểu "tách/bõm" ngắn ta nghe khi giọt nước rơi trong hang.
   *     Tiếng khô đặt 3D gần trần khoang (rơi từ đầu nhũ đá); 1 phần gửi vào bộ vang.
   * --------------------------------------------------------------------- */
  function roiGiot(t0, hang, muc) {
    var ctx = A.ctx, a, b;
    do { a = ngauNhien(-1, 1); b = ngauNhien(-1, 1); } while (a * a + b * b > 1);   // điểm ngẫu nhiên trong hình tròn
    a *= 0.75; b *= 0.75;
    var x = hang.Cc.x + hang.A.x * a * KHOANG.rx + hang.nVao.x * b * KHOANG.rz;
    var z = hang.Cc.z + hang.A.z * a * KHOANG.rx + hang.nVao.z * b * KHOANG.rz;
    var y = hang.Cc.y + KHOANG.ry * Math.sqrt(1 - a * a - b * b) * 0.85 - 0.5;      // sát trần (vòm elip)

    var osc = ctx.createOscillator();
    var tg = ngauNhien(0.03, 0.06);
    osc.frequency.setValueAtTime(ngauNhien(1250, 1600), t0);
    osc.frequency.exponentialRampToValueAtTime(ngauNhien(430, 600), t0 + tg);
    var bao = taoGain(ctx, 0);
    var dinh = muc * ngauNhien(0.5, 0.9);
    bao.gain.setValueAtTime(0, t0);
    bao.gain.linearRampToValueAtTime(dinh, t0 + 0.003);
    bao.gain.setTargetAtTime(0, t0 + 0.004, ngauNhien(0.025, 0.055));
    var pan = taoPanner(ctx, 'HRTF', 4);
    datViTri(pan, x, y, z, t0, 0);
    osc.connect(bao);
    bao.connect(pan); pan.connect(A.busHang);
    bao.connect(A.guiVang);
    osc.onended = function () { osc.disconnect(); bao.disconnect(); pan.disconnect(); };
    osc.start(t0);
    osc.stop(t0 + 0.4);
    A.thongKe.giotNuoc++;
  }

  /* -----------------------------------------------------------------------
   * 7. BỜ GẦN NHẤT (cho côn trùng + sóng vỗ bờ to hơn khi lại gần vách đảo)
   *     Đảo là elip xoay (cùng quy ước với dieu-khien.js): đổi vị trí sang hệ riêng
   *     của đảo, q = "khoảng cách elip" (< 1 là trong đảo). Điểm (dx, dz)/q nằm đúng
   *     trên mép elip, cùng phương với người nghe → điểm bờ gần đúng, không cần lặp.
   * --------------------------------------------------------------------- */
  function timBoGanNhat(p, bo) {
    var tot = Infinity, ds = HALONG.dsDao || [], i;
    bo.co = false;
    for (i = 0; i < ds.length; i++) {
      var d = ds[i], dx = p.x - d.x, dz = p.z - d.z, r = Math.hypot(dx, dz);
      var cs = Math.cos(d.xoay || 0), sn = Math.sin(d.xoay || 0);
      var lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
      var q = Math.hypot(lx / (d.rX || d.rChan), lz / (d.rZ || d.rChan));
      if (q < 1e-6 || r < 1e-6) continue;
      var kc = Math.max(r * (1 - 1 / q), 0);
      if (kc < tot) {
        tot = kc;
        bo.x = d.x + dx / q; bo.z = d.z + dz / q;
        bo.nx = dx / r; bo.nz = dz / r;          // hướng từ tâm đảo ra ngoài
        bo.co = true;
      }
    }
    // Làng chài nổi: côn trùng quanh nhà bè (chậu cây, mái lá) – lấy nhà gần nhất
    var lang = HALONG.langChai;
    if (lang && lang.cacNha) {
      for (i = 0; i < lang.cacNha.length; i++) {
        var nha = lang.cacNha[i], ndx = p.x - nha.x, ndz = p.z - nha.z, nr = Math.hypot(ndx, ndz);
        var nkc = Math.max(nr - (nha.r || 3), 0);
        if (nkc < tot && nr > 1e-6) {
          tot = nkc;
          bo.x = nha.x; bo.z = nha.z; bo.nx = ndx / nr; bo.nz = ndz / nr;
          bo.co = true;
        }
      }
    }
    return tot;
  }

  // Đặt 3 giọng côn trùng rải dọc bờ gần nhất (cách nhau ~11 m theo hướng tiếp tuyến)
  function datChoConTrung(c) {
    var bo = A.bo;
    if (!bo.co) return;
    var tx = -bo.nz, tz = bo.nx;
    for (var i = 0; i < A.conTrung.length; i++) {
      var v = A.conTrung[i], lech = (i - 1) * 11;
      var x = bo.x + tx * lech - bo.nx * 2, z = bo.z + tz * lech - bo.nz * 2, y = 1.2 + i * 0.7;
      var doi = Math.hypot(x - v.x, z - v.z);
      if (!v.daDat) {
        datViTri(v.pan, x, y, z, c, 0);
      } else if (doi > 25) {
        // Chuyển sang bờ khác (xa): nhỏ dần → dời chỗ lúc đang im → to dần.
        // Nếu trượt thẳng thì nghe như con dế "bay vèo" hàng chục mét.
        v.muc.gain.setTargetAtTime(0, c, 0.25);
        datViTri(v.pan, x, y, z, c + 1, 0);
        v.muc.gain.setTargetAtTime(1, c + 1.05, 0.4);
      } else if (doi > 0.5) {
        datViTri(v.pan, x, y, z, c, 0.8);
      }
      v.x = x; v.z = z; v.daDat = true;
    }
  }

  /* -----------------------------------------------------------------------
   * 8. TAI NGƯỜI NGHE – mỗi khung hình
   *      Đọc thẳng ma trận thế giới của camera (cột 1 = hướng lên, -cột 2 = hướng
   *      nhìn, cột 3 = vị trí): không tạo vector, không tính lại ma trận cha.
   *      Ma trận có thể trễ 1 khung (~16 ms) – tai người không nhận ra.
   * --------------------------------------------------------------------- */
  function capNhatTai(cam) {
    var m = cam.matrixWorld.elements, tai = A.tai;
    var px = m[12], py = m[13], pz = m[14];
    var fx = -m[8], fy = -m[9], fz = -m[10], ux = m[4], uy = m[5], uz = m[6];
    var lf = Math.sqrt(fx * fx + fy * fy + fz * fz) || 1, lu = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1;
    fx /= lf; fy /= lf; fz /= lf; ux /= lu; uy /= lu; uz /= lu;
    A.viTri.set(px, py, pz);
    // Đứng yên + không quay đầu → khỏi gửi gì xuống luồng âm thanh
    if (Math.abs(px - tai[0]) + Math.abs(py - tai[1]) + Math.abs(pz - tai[2]) < 1e-3 &&
        Math.abs(fx - tai[3]) + Math.abs(fy - tai[4]) + Math.abs(fz - tai[5]) +
        Math.abs(ux - tai[6]) + Math.abs(uy - tai[7]) + Math.abs(uz - tai[8]) < 1e-4) return;
    tai[0] = px; tai[1] = py; tai[2] = pz; tai[3] = fx; tai[4] = fy; tai[5] = fz; tai[6] = ux; tai[7] = uy; tai[8] = uz;
    var L = A.ctx.listener;
    if (L.positionX) {
      L.positionX.value = px; L.positionY.value = py; L.positionZ.value = pz;
      L.forwardX.value = fx; L.forwardY.value = fy; L.forwardZ.value = fz;
      L.upX.value = ux; L.upY.value = uy; L.upZ.value = uz;
    } else {
      L.setPosition(px, py, pz);
      L.setOrientation(fx, fy, fz, ux, uy, uz);
    }
  }

  /* -----------------------------------------------------------------------
   * 9. THAM SỐ CHẬM – 10 lần/giây
   * --------------------------------------------------------------------- */
  function capNhatCham(giay) {
    var c = A.ctx.currentTime, p = A.viTri;
    var dem = HALONG.uniformChung.uDem.value;
    var tt = HALONG.thuyen, hang = HALONG.hangDong;

    // a) Người nghe: tốc độ bay (cho gió). Nhảy > 25 m trong 0,1 s là dịch chuyển tức thời
    //    (nút "Vào hang", đổi chế độ) chứ không phải bay → bỏ qua, khỏi giật gió ào lên.
    var traiDai = A.daCoViTriCu ? p.distanceTo(A.viTriCu) : 0;
    var tocDo = traiDai > 25 ? A.tocDoNghe : traiDai / giay;
    A.tocDoNghe += (Math.min(tocDo, 40) - A.tocDoNghe) * 0.3;
    A.viTriCu.copy(p);
    A.daCoViTriCu = true;
    var dk = thanhPhan && thanhPhan.rig && thanhPhan.rig.getAttribute('dieu-khien');
    var tuDo = !dk || dk.cheDo === 'tu-do';
    var thapCao = ss(12, 45, Math.max(p.y, 0));  // 0 sát mặt nước → 1 bay cao

    // b) Trong hang tới đâu: đo độ sâu tính từ mặt vách cửa hang vào trong.
    //    (trong() đúng cả ở phễu trước cửa → độ sâu âm → kHang ≈ 0, ra vào không bị giật)
    var kHang = 0, dCc = Infinity;
    A.trongHang = false;
    if (hang) {
      dCc = p.distanceTo(hang.Cc);
      if (dCc < 120 && hang.trong(p)) {
        A.trongHang = true;
        kHang = ss(-4, 10, (p.x - hang.S.x) * hang.nVao.x + (p.z - hang.S.z) * hang.nVao.z);
      }
    }
    A.kHang = kHang;

    // c) Nhánh ngoài trời: vào sâu trong hang → nhỏ + nghẹt (lọc còn ~380 Hz).
    //    Nội suy tần số theo hàm mũ: tai nghe theo tỉ lệ, nội suy thẳng sẽ nghẹt quá sớm.
    vanNum(A.nNgoai, 1 - 0.88 * kHang, 0.5);
    vanNum(A.nLocNgoai, A.tanSoMax * Math.pow(380 / A.tanSoMax, kHang), 0.4);

    // Bờ gần nhất: 1 lần/giây là đủ (thuyền chạy 6 m/s)
    if (c - A.lanTimBo > 1) {
      A.lanTimBo = c;
      A.khoangCachBo = timBoGanNhat(p, A.bo);
    }

    // d) Sóng: tính lại giá trị 2 LFO (cùng pha với node dao động) để lái bộ lọc + bọt sóng.
    //    Sóng dâng → lọc mở rộng hơn (sáng tiếng hơn) như ngọn sóng vỡ; bay cao → xa mặt
    //    nước nên nhỏ và trầm hơn; sát vách đảo → sóng đập đá to hơn.
    var tg = c - A.t0Lfo;
    var s = 0.55 + 0.28 * Math.sin(2 * Math.PI * 0.13 * tg) + 0.17 * Math.sin(2 * Math.PI * 0.071 * tg);
    vanNum(A.nLocSong, (480 + 420 * s) * (1 - 0.35 * thapCao), 0.15);
    vanNum(A.nBot, 0.6 * Math.max(0, s - 0.62) / 0.38 * (1 - thapCao), 0.15);
    var ganBo = (1 - ss(8, 40, A.khoangCachBo)) * (1 - kHang);   // trong hang (lòng đảo) thì không tính
    vanNum(A.nSong, 0.5 * (1 - 0.7 * thapCao) * (1 + 0.4 * ganBo), 0.6);

    // e) Nước vỗ mạn: chỉ nghe khi cách thuyền < ~25 m; to theo tốc độ thuyền.
    //    Mỗi cú vỗ có độ mạnh + độ dài ngẫu nhiên → nghe "óc ách" chứ không đều như máy.
    var mucVo = 0;
    if (tt) {
      var vt = tt.tocDo || 0;
      mucVo = (1 - ss(8, 25, p.distanceTo(tt.viTri))) * (0.12 + 0.6 * ss(0.3, 5, vt));
      if (c >= A.voTiep) {
        A.voManh = ngauNhien(0.35, 1.25);
        A.voTau = ngauNhien(0.05, 0.12);
        A.voTiep = c + ngauNhien(0.18, 0.5) / (1 + vt * 0.25);     // chạy nhanh → vỗ dồn dập hơn
        vanNum(A.nLocVo, 470 + 70 * vt + ngauNhien(-60, 60), 0.1);
      }
    }
    vanNum(A.nVo, mucVo * A.voManh, A.voTau);

    // f) Gió: cơn giật (độ mạnh đích đổi mỗi 1,5–5 s, trượt dần tới) + tần số "hú" lang thang.
    //    Bay tự do: càng cao, càng nhanh càng lộng gió. Trên thuyền: gió do thuyền chạy.
    if (c >= A.gioTiep) {
      A.gioDich = ngauNhien(0.35, 1.2);
      A.tanSoGio = ngauNhien(300, 900);
      A.gioTiep = c + ngauNhien(1.5, 5);
    }
    A.gioHienTai += (A.gioDich - A.gioHienTai) * Math.min(giay * 0.8, 1);
    var mucGio = tuDo
      ? 0.06 + 0.4 * ss(8, 50, p.y) + 0.3 * ss(3, 22, A.tocDoNghe)
      : 0.06 + 0.16 * ss(1, 6, tt ? tt.tocDo : 0);
    vanNum(A.nGio, mucGio * A.gioHienTai * (1 - 0.95 * kHang), 0.3);
    vanNum(A.nTanSoGio, A.tanSoGio * (1 + 0.25 * thapCao), 1);
    vanNum(A.nQGio, 2.5 + 3 * A.gioHienTai, 0.5);

    // g) Hải âu: chỉ khi chim đang hiện (ngày / hoàng hôn) và người nghe ở ngoài trời
    if (c >= A.hauTiep) {
      A.hauTiep = c + 2;                         // chưa kêu được thì 2 s sau xét lại
      var haiAu = layHaiAu();
      if (haiAu && haiAu.chim && haiAu.hienRo > 0.35 && kHang < 0.3) {
        var chim = chonHaiAu(haiAu.chim, p);
        if (chim) {
          keuHaiAu(chim, haiAu.hienRo);
          A.hauTiep = c + ngauNhien(4, 12);
        }
      }
    }

    // h) Côn trùng: nối nhánh khi trời bắt đầu tối, ngắt khi sáng hẳn (2 ngưỡng 0,45 / 0,4
    //    để không bật tắt liên tục). Mức to theo uDem; trong hang thì im.
    if (!A.noiConTrung && dem > 0.45) {
      A.busConTrung.connect(A.locNgoai);
      A.noiConTrung = true;
      A.ctTiep = 0;
    } else if (A.noiConTrung && dem < 0.4) {
      A.busConTrung.disconnect();
      A.noiConTrung = false;
    }
    if (A.noiConTrung) {
      vanNum(A.nConTrung, 0.22 * ss(0.45, 0.85, dem) * (1 - kHang), 0.5);
      if (c >= A.ctTiep) {
        A.ctTiep = c + 3;
        datChoConTrung(c);
      }
    }

    // i) Hang: nhánh hang chỉ nối khi ở gần (bộ vang tính toán khá nặng)
    if (hang) {
      if (!A.noiHang && dCc < R_NOI_HANG) {
        A.busHang.connect(A.tron);
        A.noiHang = true;
      } else if (A.noiHang && dCc > R_NGAT_HANG) {
        A.busHang.disconnect();
        A.noiHang = false;
      }
      if (A.noiHang) {
        vanNum(A.nNenHang, 0.3 * kHang, 0.6);
        vanNum(A.nGuiVangNgoai, 0.6 * kHang, 0.6);
        // Đứng ngoài cửa hang: tiếng giọt nước khô gần như mất, chỉ còn tiếng vang vọng ra
        vanNum(A.nVang, 0.35 + 0.45 * kHang, 0.6);
        var ngheGiot = A.trongHang || dCc < R_GIOT;
        if (!ngheGiot) {
          A.giotTiep = c + ngauNhien(0.3, 1.5);
        } else if (c >= A.giotTiep - 0.15) {
          // Hẹn giờ trước tối đa 0,15 s theo đồng hồ âm thanh → giọt rơi đúng lúc,
          // không bị lệch theo nhịp 10 lần/giây của JS
          var tGiot = Math.max(A.giotTiep, c + 0.02);
          roiGiot(tGiot, hang, kHang > 0.3 ? 1 : 0.6);
          A.giotTiep = tGiot + ngauNhien(0.5, 2.5);
        }
      }
    }
  }

  function layHaiAu() {
    if (!A.haiAu) {
      var el = document.querySelector('#sinh-vat');
      A.haiAu = el && el.components && el.components['hai-au'] || null;
    }
    return A.haiAu;
  }

  /* -----------------------------------------------------------------------
   * 10. TẮT TIẾNG + CHUYỂN TAB
   * --------------------------------------------------------------------- */
  function layScene() {
    var el = thanhPhan ? thanhPhan.el.sceneEl : document.querySelector('a-scene');
    return el && typeof el.emit === 'function' ? el : null;
  }

  function capNhatDangPhat() {
    A.dangPhat = !api.dangTat && !document.hidden;
  }

  function apDungTatTieng() {
    var ctx = A.ctx, c = ctx.currentTime;
    clearTimeout(A.henNgu);
    capNhatDangPhat();
    if (api.dangTat) {
      A.tongRa.gain.setTargetAtTime(0, c, TAU_TAT);
      // Nhỏ dần xong thì cho bộ xử lý âm thanh "ngủ" hẳn → tắt tiếng là không tốn CPU nữa
      A.henNgu = setTimeout(function () {
        if (api.dangTat && ctx.state === 'running') goiAnToan(ctx.suspend());
      }, 600);
    } else {
      if (!document.hidden && ctx.state !== 'running') goiAnToan(ctx.resume());
      A.tongRa.gain.setTargetAtTime(MUC_TONG, c, TAU_TAT);
    }
  }

  // Tab ẩn (chuyển tab, thu nhỏ cửa sổ): dừng hẳn âm thanh – vừa lịch sự vừa đỡ CPU.
  // Quay lại thì chạy tiếp (trừ khi người dùng đang tắt tiếng).
  function khiDoiTab() {
    if (!A) return;
    capNhatDangPhat();
    if (document.hidden) {
      if (A.ctx.state === 'running') goiAnToan(A.ctx.suspend());
    } else if (!api.dangTat && A.ctx.state !== 'running') {
      goiAnToan(A.ctx.resume());
    }
  }

  /* -----------------------------------------------------------------------
   * 11. KHỞI ĐỘNG – gọi từ nút "Bắt đầu" (thao tác của người dùng)
   * --------------------------------------------------------------------- */
  function batDau() {
    if (A) {
      // Gọi lần 2 (vd. khi vào VR): chỉ cần đánh thức lại nếu đang ngủ
      if (!api.dangTat && !document.hidden && A.ctx.state !== 'running') goiAnToan(A.ctx.resume());
      return;
    }
    if (daHong) return;
    var ctx = null;
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) { daHong = true; return; }
      // 'playback': bộ đệm âm thanh lớn hơn → luồng âm thanh ít phải thức dậy hơn, ít bị
      // vấp khi CPU đang bận vẽ 3D. Âm thanh môi trường không cần độ trễ thấp.
      try { ctx = new Ctx({ latencyHint: 'playback' }); } catch (e) { ctx = new Ctx(); }
      A = dungDoThi(ctx);
      api.ctx = ctx;
      api.tongRa = A.tongRa;
      api.doThi = A;
      document.addEventListener('visibilitychange', khiDoiTab);
      capNhatDangPhat();
      if (api.dangTat) {
        goiAnToan(ctx.suspend());
      } else {
        if (ctx.state !== 'running') goiAnToan(ctx.resume());
        // Mở dần ~2,5 s: âm thanh "hiện ra" cùng khung cảnh thay vì ập tới
        A.tongRa.gain.setTargetAtTime(MUC_TONG, ctx.currentTime, 0.8);
      }
    } catch (e) {
      // Lỗi gì cũng chỉ mất tiếng, khung cảnh vẫn chạy bình thường
      daHong = true;
      A = null;
      document.removeEventListener('visibilitychange', khiDoiTab);
      try { if (ctx && ctx.close) goiAnToan(ctx.close()); } catch (e2) { /* bỏ qua */ }
      api.ctx = api.tongRa = api.doThi = null;
      console.warn('Âm thanh: không khởi tạo được Web Audio –', e);
    }
  }

  function datTatTieng(tat) {
    tat = !!tat;
    api.dangTat = tat;
    luuTatTieng(tat);
    if (A) apDungTatTieng();
    var sceneEl = layScene();
    if (sceneEl) sceneEl.emit('doi-am-thanh', { tat: tat });
  }

  var api = HALONG.amThanh = {
    batDau: batDau,
    datTatTieng: datTatTieng,
    // Không dùng 'this' → truyền thẳng làm hàm xử lý sự kiện cũng đúng
    doiTatTieng: function () {
      datTatTieng(!api.dangTat);
      return api.dangTat;
    },
    dangTat: docTatTieng(),
    // Chỉ để đo đạc / gỡ lỗi (null cho tới khi batDau chạy)
    ctx: null,       // AudioContext
    tongRa: null,    // GainNode âm lượng tổng (sau bộ nén)
    doThi: null      // toàn bộ node + trạng thái
  };

  /* -----------------------------------------------------------------------
   * 12. COMPONENT – gắn vào <a-entity am-thanh>; chưa batDau thì không làm gì
   * --------------------------------------------------------------------- */
  AFRAME.registerComponent('am-thanh', {
    init: function () {
      thanhPhan = this;
      this.rig = document.querySelector('#rig');
      this.thoiGianCham = CHU_KY_CHAM;          // lần tick đầu cập nhật ngay
    },

    remove: function () {
      if (thanhPhan === this) thanhPhan = null;
    },

    tick: function (t, dt) {
      if (!A || !A.dangPhat || A.hong) return;
      var cam = this.el.sceneEl.camera;
      if (!cam) return;
      // Bọc try/catch: lỗi trong tick() làm dừng cả vòng lặp vẽ của three.js → hỏng khung cảnh.
      // Lỗi âm thanh thì chỉ tắt phần cập nhật âm thanh.
      try {
        capNhatTai(cam);
        this.thoiGianCham += dt || 0;
        if (this.thoiGianCham >= CHU_KY_CHAM) {
          var giay = Math.min(this.thoiGianCham, 1000) / 1000;
          this.thoiGianCham = 0;
          capNhatCham(giay);
        }
      } catch (e) {
        A.hong = true;
        A.thongKe.loi++;
        console.warn('Âm thanh: ngừng cập nhật vì lỗi –', e);
      }
    }
  });
})();
