/* 用 Chrome DevTools Protocol 在精确手机视口下截图（仅开发验收用）
 * 先启动：chrome --headless=new --remote-debugging-port=9333 ...
 * 再运行：node tools/shoot.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 9333;
const BASE = 'http://127.0.0.1:8123/';
const V = '?nosw=1&demo=1';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(ROOT, '..', 'preview-shots');
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function newPage() {
  const res = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' });
  if (!res.ok) throw new Error('无法创建页面: ' + res.status);
  return res.json();
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const pending = new Map();
    let seq = 0;
    ws.onopen = () => resolve({
      send(method, params = {}) {
        return new Promise((res, rej) => {
          const id = ++seq;
          pending.set(id, { res, rej });
          ws.send(JSON.stringify({ id, method, params }));
        });
      },
      close() { try { ws.close(); } catch {} }
    });
    ws.onerror = () => reject(new Error('WebSocket 连接失败'));
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) p.rej(new Error(msg.error.message));
        else p.res(msg.result);
      }
    };
  });
}

const page = await newPage();
const cdp = await connect(page.webSocketDebuggerUrl);
await cdp.send('Page.enable');
await cdp.send('Runtime.enable');
await cdp.send('Network.enable');
await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
await cdp.send('Emulation.setDeviceMetricsOverride', {
  width: 390, height: 844, deviceScaleFactor: 2, mobile: true,
  screenWidth: 390, screenHeight: 844
});

async function nav(url, wait = 1000) {
  await cdp.send('Page.navigate', { url });
  await sleep(wait);
}

async function shot(name) {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(data, 'base64'));
  console.log('shot', name);
}

async function evaluate(expression) {
  const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result && r.result.value;
}

// 1. 首页（示例数据）
await nav(BASE + V, 1600);
await shot('p1-home');

// 1b. 首页下半部分
await evaluate('window.scrollTo(0, 700)');
await sleep(500);
await shot('p1b-home-scroll');
await evaluate('window.scrollTo(0, 0)');

// 2. 记录页
await nav(BASE + V + '#/record', 1200);
await shot('p2-record');

// 2b. 编辑一条记录
await evaluate("document.querySelector('.entry-row').click()");
await sleep(600);
await shot('p2b-edit');

// 3. 我的
await nav(BASE + V + '#/me', 1200);
await shot('p3-me');

// 4. 设置
await nav(BASE + V + '#/settings', 1200);
await shot('p4-settings');

// 5. 添加食物弹层（搜索）
await nav(BASE + V, 1400);
await evaluate("document.querySelector('#view [data-act=open-add]').click()");
await sleep(700);
await shot('p5-add');

// 6. 份量页
await evaluate("document.querySelector('#food-results .food-row').click()");
await sleep(600);
await shot('p6-portion');

// 7. 手动填写
await nav(BASE + V, 1400);
await evaluate("document.querySelector('#view [data-act=open-add]').click()");
await sleep(400);
await evaluate("document.querySelector('.seg-tabs [data-tab=\"manual\"]').click()");
await sleep(400);
await shot('p7-manual');

// 8. 扫码页（无相机提示）
await evaluate("document.querySelector('.seg-tabs [data-tab=\"scan\"]').click()");
await sleep(800);
await shot('p8-scan');

// 9. 新用户引导
await nav(BASE + '?nosw=1', 1200);
await evaluate('localStorage.clear()');
await cdp.send('Page.reload');
await sleep(1400);
await shot('p9-onboarding');

// 10. 360px 小屏检查
await cdp.send('Emulation.setDeviceMetricsOverride', {
  width: 360, height: 780, deviceScaleFactor: 2, mobile: true,
  screenWidth: 360, screenHeight: 780
});
await nav(BASE + V, 1400);
await shot('p10-home-360');

cdp.close();
console.log('done ->', OUT);
