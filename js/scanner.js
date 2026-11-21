/* 轻卡 · 条码扫描
 * 优先使用随包的 ZXing（iOS Safari / 安卓 Chrome 都可），
 * 失败时退回浏览器原生 BarcodeDetector。相机需要 HTTPS 或 localhost。
 */
(function (root) {
  'use strict';

  var reader = null;
  var controls = null;
  var stream = null;
  var rafId = null;
  var running = false;

  function hasCamera() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  function stop() {
    running = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    if (controls && typeof controls.stop === 'function') {
      try { controls.stop(); } catch (e) { /* ignore */ }
    }
    controls = null;
    if (stream) {
      stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) { /* ignore */ } });
      stream = null;
    }
    if (reader) {
      try { reader.reset(); } catch (e) { /* ignore */ }
      reader = null;
    }
    var v = document.getElementById('scan-video');
    if (v) { try { v.srcObject = null; } catch (e) { /* ignore */ } }
  }

  function normalize(text) {
    return String(text || '').replace(/[^0-9A-Za-z]/g, '').trim();
  }

  async function startWithZxing(video, onResult) {
    var Z = root.ZXing;
    if (!Z || !Z.BrowserMultiFormatReader) throw new Error('zxing-missing');
    video.setAttribute('playsinline', '');
    video.setAttribute('muted', '');
    video.muted = true;
    reader = new Z.BrowserMultiFormatReader();
    var finish = function (text) {
      if (!running) return;
      var code = normalize(text);
      if (!code) return;
      running = false;
      stop();
      onResult(code);
    };
    controls = await reader.decodeFromConstraints(
      { audio: false, video: { facingMode: { ideal: 'environment' } } },
      video,
      function (result) {
        if (!running) return;
        if (result) finish(result.getText());
      }
    );
  }

  async function startWithDetector(video, onResult) {
    if (!('BarcodeDetector' in root)) throw new Error('unsupported');
    var supported = await root.BarcodeDetector.getSupportedFormats();
    var wanted = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf'];
    var formats = wanted.filter(function (f) { return supported.indexOf(f) >= 0; });
    if (!formats.length) throw new Error('unsupported');
    var detector = new root.BarcodeDetector({ formats: formats });
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }
    });
    video.setAttribute('playsinline', '');
    video.muted = true;
    video.srcObject = stream;
    await video.play();
    var tick = async function () {
      if (!running) return;
      try {
        var found = await detector.detect(video);
        if (found && found.length) {
          var code = normalize(found[0].rawValue);
          if (code) {
            running = false;
            stop();
            onResult(code);
            return;
          }
        }
      } catch (e) { /* 单帧失败忽略 */ }
      if (running) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  }

  /**
   * 开始扫描
   * @param {HTMLVideoElement} video
   * @param {(code:string)=>void} onResult
   */
  async function start(video, onResult) {
    stop();
    if (!hasCamera()) throw new Error('no-camera');
    running = true;
    try {
      if (root.ZXing && root.ZXing.BrowserMultiFormatReader) {
        await startWithZxing(video, onResult);
      } else {
        await startWithDetector(video, onResult);
      }
    } catch (err) {
      running = false;
      stop();
      throw err;
    }
  }

  function errorMessage(err) {
    var name = err && (err.name || err.message);
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return '相机权限被拒绝。请在浏览器设置中允许相机，或用下方「拍照识别」';
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return '没有找到可用的摄像头，可用下方「拍照识别」';
    }
    if (name === 'NotReadableError') {
      return '摄像头被其他应用占用，请关闭后重试，或用「拍照识别」';
    }
    if (name === 'unsupported' || name === 'zxing-missing') {
      return '当前浏览器不支持实时扫码，请用「拍照识别」或手动输入';
    }
    if (name === 'no-camera') {
      return '当前环境无法调用相机（需要 HTTPS 或 localhost），可用「拍照识别」';
    }
    if (location.protocol === 'http:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      return '扫码需要 HTTPS 环境，当前是 HTTP，请用「拍照识别」或手动输入条码';
    }
    return '无法启动相机：' + (err && err.message ? err.message : '未知错误');
  }

  /**
   * 识别一张条码照片（iPhone 相机打不开时的兜底方案）
   * @param {File} file
   * @returns {Promise<string>}
   */
  function decodeImageFile(file) {
    return new Promise(function (resolve, reject) {
      var Z = root.ZXing;
      if (!Z || !Z.BrowserMultiFormatReader) {
        reject(new Error('zxing-missing'));
        return;
      }
      if (!file) {
        reject(new Error('no-file'));
        return;
      }
      var url = URL.createObjectURL(file);
      var r = new Z.BrowserMultiFormatReader();
      var done = function (fn, val) {
        try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ }
        try { r.reset(); } catch (e) { /* ignore */ }
        fn(val);
      };
      r.decodeFromImageUrl(url).then(function (result) {
        var code = normalize(result && result.getText());
        if (!code) { done(reject, new Error('empty')); return; }
        done(resolve, code);
      }).catch(function (err) {
        done(reject, err || new Error('decode-failed'));
      });
    });
  }

  root.Scanner = {
    supported: hasCamera,
    start: start,
    stop: stop,
    errorMessage: errorMessage,
    decodeImageFile: decodeImageFile
  };
})(typeof self !== 'undefined' ? self : this);
