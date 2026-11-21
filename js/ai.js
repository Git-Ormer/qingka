/* 轻卡 · AI 拍照识别（DeepSeek 视觉 API，直连，无服务器）
 *
 * Key 只保存在本机 localStorage 的独立键里，不进入 state、不会写进备份文件。
 * 照片在手机端压缩为 JPEG（同时去除 EXIF 定位信息）后直接发送到 api.deepseek.com。
 */
(function (root) {
  'use strict';

  var STORE_KEY = 'qingka.ai.v1';
  var API_URL = 'https://api.deepseek.com/chat/completions';
  var MODEL = 'deepseek-flash';
  var DEFAULT_LIMIT = 20;
  var MAX_ITEMS = 8;

  var PROMPT = [
    '请识别这张照片里的食物，并按实际可食部分估算份量。',
    '只输出 JSON，不要任何解释或 Markdown。',
    'JSON 格式：',
    '{"items":[{"name":"食物名","grams":150,"kcal":174,"carb":38.8,"protein":3.9,"fat":0.5}],"note":"不确定的地方"}',
    '规则：',
    '1. items 最多 8 项，只列出画面里真实存在的食物；',
    '2. grams 是这一份可食部分的估算重量（克）；',
    '3. kcal / carb / protein / fat 是这一份（不是每 100g）的营养，单位分别是千卡和克；',
    '4. 有包装或营养标签时优先按标签数值；',
    '5. 估不准时给保守值，并在 note 里说明；',
    '6. 不要输出 JSON 以外的任何文字。'
  ].join('\n');

  function pad2(n) { return String(n).padStart(2, '0'); }

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function defaults() {
    return { key: '', limit: DEFAULT_LIMIT, usage: { date: '', count: 0 } };
  }

  function read() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return defaults();
      var o = JSON.parse(raw);
      return {
        key: typeof o.key === 'string' ? o.key : '',
        limit: typeof o.limit === 'number' ? o.limit : DEFAULT_LIMIT,
        usage: o.usage && typeof o.usage === 'object' ? o.usage : { date: '', count: 0 }
      };
    } catch (e) {
      return defaults();
    }
  }

  function write(o) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(o));
      return true;
    } catch (e) {
      return false;
    }
  }

  function getState() {
    var o = read();
    return {
      key: o.key,
      limit: o.limit,
      usageToday: o.usage.date === today() ? o.usage.count : 0
    };
  }

  function hasKey() { return !!read().key; }
  function getKey() { return read().key; }

  function setKey(key) {
    var o = read();
    o.key = String(key || '').trim();
    write(o);
  }

  function clearKey() {
    var o = read();
    o.key = '';
    write(o);
  }

  function maskKey(key) {
    var k = String(key || '');
    if (!k) return '';
    if (k.length <= 8) return k.slice(0, 2) + '…';
    return k.slice(0, 4) + '…' + k.slice(-4);
  }

  function getLimit() { return read().limit; }

  function setLimit(n) {
    var o = read();
    var v = Number(n);
    o.limit = isFinite(v) && v >= 0 ? Math.floor(v) : DEFAULT_LIMIT;
    write(o);
  }

  function usageToday() {
    var o = read();
    return o.usage.date === today() ? o.usage.count : 0;
  }

  function bumpUsage() {
    var o = read();
    if (o.usage.date !== today()) o.usage = { date: today(), count: 0 };
    o.usage.count += 1;
    write(o);
  }

  function canUse() {
    var o = read();
    if (o.limit <= 0) return true;
    return usageToday() < o.limit;
  }

  function aiError(code, message) {
    var e = new Error(message || code);
    e.code = code;
    return e;
  }

  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var m = String(v == null ? '' : v).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
    return m ? Number(m[0]) : 0;
  }

  function round1(v) { return Math.round(num(v) * 10) / 10; }

  function parseContent(content) {
    if (!content) return null;
    var s = String(content).trim();
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

    var start = s.indexOf('{');
    var end = s.lastIndexOf('}');
    if (start >= 0 && end > start) {
      s = s.slice(start, end + 1);
    } else {
      var a = s.indexOf('[');
      var b = s.lastIndexOf(']');
      if (a < 0 || b <= a) return null;
      s = s.slice(a, b + 1);
    }
    try {
      var parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return { items: parsed };
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function normalize(parsed) {
    var raw = parsed && (parsed.items || parsed.foods || parsed.food || parsed.result);
    if (!raw && Array.isArray(parsed)) raw = parsed;
    if (!Array.isArray(raw)) return [];

    var out = [];
    raw.slice(0, MAX_ITEMS).forEach(function (it) {
      if (!it || typeof it !== 'object') return;
      var name = String(it.name || it.food || it.title || '').trim().slice(0, 30);
      if (!name) return;

      var grams = num(it.grams || it.weight || it.g);
      if (grams <= 0) grams = 100;
      grams = Math.min(3000, Math.max(1, Math.round(grams)));

      var kcal = num(it.kcal || it.calories || it.calorie);
      var carb = num(it.carb || it.carbs || it.carbohydrate);
      var protein = num(it.protein || it.proteins);
      var fat = num(it.fat || it.fats);
      if (!kcal && (carb || protein || fat)) kcal = carb * 4 + protein * 4 + fat * 9;

      out.push({
        name: name,
        grams: grams,
        per100: {
          kcal: Math.round((kcal / grams) * 100),
          carb: round1((carb / grams) * 100),
          protein: round1((protein / grams) * 100),
          fat: round1((fat / grams) * 100)
        }
      });
    });
    return out;
  }

  function mapHttpError(status, bodyText) {
    var apiMsg = '';
    try {
      var j = JSON.parse(bodyText);
      if (j && j.error && j.error.message) apiMsg = String(j.error.message).slice(0, 80);
    } catch (e) { /* ignore */ }

    if (status === 401) return aiError('auth', 'API Key 不正确或已失效');
    if (status === 402) return aiError('balance', 'DeepSeek 账户余额不足，请充值后重试');
    if (status === 429) return aiError('rate', '请求太频繁，请稍后再试');
    if (status === 400) return aiError('bad-request', apiMsg || '请求被拒绝，请重试');
    return aiError('http', '识别服务返回 ' + status + (apiMsg ? '：' + apiMsg : ''));
  }

  async function request(body, key) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = null;
    if (ctrl) {
      timer = setTimeout(function () { ctrl.abort(); }, 45000);
    }
    var res;
    try {
      res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + key
        },
        body: JSON.stringify(body),
        signal: ctrl ? ctrl.signal : undefined
      });
    } catch (err) {
      if (err && err.name === 'AbortError') throw aiError('timeout', '识别超时，请稍后重试');
      throw aiError('network', '网络连接失败，请检查网络后重试');
    } finally {
      if (timer) clearTimeout(timer);
    }

    if (!res.ok) {
      var text = '';
      try { text = await res.text(); } catch (e) { /* ignore */ }
      throw mapHttpError(res.status, text);
    }
    return res.json();
  }

  /**
   * 识别一张图片
   * @param {string} dataUrl 压缩后的 JPEG data URL
   * @returns {Promise<{items:Array, note:string}>}
   */
  async function recognize(dataUrl) {
    var o = read();
    if (!o.key) throw aiError('no-key', '请先填入 DeepSeek API Key');
    if (!canUse()) throw aiError('limit', '今天的识别次数已用完');
    if (!dataUrl) throw aiError('no-image', '请先拍照或选择照片');

    var body = {
      model: MODEL,
      messages: [
        { role: 'system', content: '你是营养师，擅长从食物照片估算份量和营养。你只输出 JSON。' },
        {
          role: 'user',
          content: [
            { type: 'text', text: PROMPT },
            { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } }
          ]
        }
      ],
      temperature: 0.2,
      max_tokens: 900,
      response_format: { type: 'json_object' },
      thinking: { type: 'disabled' },
      stream: false
    };

    var data;
    try {
      data = await request(body, o.key);
    } catch (err) {
      // 个别账号/模型版本可能不支持 JSON Output，去掉后重试一次
      if (err && err.code === 'bad-request' && body.response_format) {
        delete body.response_format;
        data = await request(body, o.key);
      } else {
        throw err;
      }
    }
    var content = data && data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : '';
    var parsed = parseContent(content);
    if (!parsed) throw aiError('parse', '没有看懂识别结果，请换一张照片重试');
    var items = normalize(parsed);
    if (!items.length) throw aiError('empty', '没有识别到食物，请换一张更清楚的照片');

    bumpUsage();
    return {
      items: items,
      note: parsed.note ? String(parsed.note).slice(0, 140) : ''
    };
  }

  /** 用一次极小的文本请求验证 Key 是否可用（不计入每日上限） */
  async function testKey(key) {
    var k = String(key || read().key || '').trim();
    if (!k) throw aiError('no-key', '请先填入 API Key');
    await request({
      model: MODEL,
      messages: [{ role: 'user', content: '只回复两个字：正常' }],
      max_tokens: 8,
      thinking: { type: 'disabled' },
      stream: false
    }, k);
    return true;
  }

  /** 把照片压缩成 JPEG data URL（canvas 同时会去掉 EXIF） */
  function compress(file, maxSide, quality) {
    maxSide = maxSide || 1024;
    quality = quality || 0.82;
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type || '')) {
        reject(aiError('not-image', '请选择图片文件'));
        return;
      }
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        try {
          var scale = Math.min(1, maxSide / Math.max(img.width, img.height));
          var w = Math.max(1, Math.round(img.width * scale));
          var h = Math.max(1, Math.round(img.height * scale));
          var canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch (e) {
          URL.revokeObjectURL(url);
          reject(aiError('compress', '图片处理失败，请换一张试试'));
        }
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(aiError('not-image', '无法读取这张图片'));
      };
      img.src = url;
    });
  }

  function errorMessage(err) {
    var code = err && err.code;
    var map = {
      'no-key': '请先填入 DeepSeek API Key',
      'no-image': '请先拍照或选择照片',
      'limit': '今天的识别次数已用完，可在设置里调整上限',
      'auth': 'API Key 不正确或已失效',
      'balance': 'DeepSeek 账户余额不足，请充值后重试',
      'rate': '请求太频繁，请稍后再试',
      'timeout': '识别超时，请检查网络后重试',
      'network': '网络连接失败，请检查网络后重试',
      'empty': '没有识别到食物，换一张更清楚的照片试试',
      'parse': '识别结果解析失败，请重试',
      'bad-request': '请求被拒绝，请重试',
      'not-image': '请选择图片文件',
      'compress': '图片处理失败，请换一张试试'
    };
    return map[code] || (err && err.message) || '识别失败，请重试';
  }

  root.AI = {
    MODEL: MODEL,
    getState: getState,
    hasKey: hasKey,
    getKey: getKey,
    setKey: setKey,
    clearKey: clearKey,
    maskKey: maskKey,
    getLimit: getLimit,
    setLimit: setLimit,
    usageToday: usageToday,
    canUse: canUse,
    compress: compress,
    recognize: recognize,
    testKey: testKey,
    errorMessage: errorMessage
  };
})(typeof self !== 'undefined' ? self : this);
