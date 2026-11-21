/* 端到端界面测试（jsdom + 本地静态服务器）
 * 运行：
 *   $env:NODE_PATH = "<workspace>\.tmp-test\node_modules"
 *   node tests/dom.test.js
 * 需要先在本目录启动：python -m http.server 8123
 */
'use strict';

const assert = require('assert');
const { JSDOM, VirtualConsole } = require('jsdom');

const URL = process.env.QK_URL || 'http://127.0.0.1:8123/?demo=1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let passed = 0;
function ok(name) {
  passed += 1;
  console.log('  ok  ' + name);
}

async function waitFor(fn, timeout = 10000, interval = 100) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const val = fn();
    if (val) return val;
    await sleep(interval);
  }
  throw new Error('等待超时');
}

function text(el) {
  return (el && el.textContent ? el.textContent : '').replace(/\s+/g, ' ').trim();
}

function num(el) {
  return Number(text(el).replace(/[^\d.-]/g, ''));
}

function submit(window, form) {
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
}

function input(window, el, value) {
  el.value = String(value);
  el.dispatchEvent(new window.Event('input', { bubbles: true }));
}

async function main() {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => {
    if (/Not implemented/.test(e.message)) return;
    if (/Could not parse CSS/.test(e.message)) return;
    errors.push('jsdomError: ' + e.message);
  });
  vc.on('error', (...args) => errors.push('console.error: ' + args.join(' ')));

  const dom = await JSDOM.fromURL(URL, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
      window.scrollTo = () => {};
      window.HTMLElement.prototype.scrollIntoView = () => {};
      window.fetch = (url, opts) => fetch(url, opts);
      if (typeof AbortController !== 'undefined') window.AbortController = AbortController;
    }
  });

  const { window } = dom;
  const doc = window.document;
  await new Promise((resolve) => {
    if (doc.readyState === 'complete') return resolve();
    window.addEventListener('load', resolve, { once: true });
  });
  await sleep(400);

  const N = window.Nutrition;
  const Store = window.Store;
  const state = window.QK.state();
  const today = Store.dateKey();
  const view = doc.getElementById('view');

  // ---------- 首页 ----------
  assert.ok(view.querySelector('.ring-num'), '首页应有热量环');
  assert.strictEqual(view.querySelectorAll('.macro').length, 3, '应有三大营养素');
  assert.ok(!doc.getElementById('tabbar').classList.contains('hidden'), '标签栏应显示');

  const cp = N.caloriePlan(state.profile);
  const totalsNow = N.totals(state.logs[today]);
  assert.strictEqual(num(view.querySelector('.ring-num')), Math.round(cp.target - totalsNow.kcal));
  assert.ok(text(view).includes('还可摄入'));
  ok('首页热量环与剩余热量计算正确');

  assert.ok(view.querySelectorAll('.entry-row').length >= 4, '首页应显示今天记录');
  ok('首页饮食列表渲染');

  // ---------- 记录页 ----------
  doc.querySelector('.tab-item[data-tab="record"]').click();
  await sleep(120);
  assert.strictEqual(view.querySelectorAll('.bar-wrap').length, 7, '近 7 天应有 7 根柱');
  assert.strictEqual(view.querySelectorAll('.meal').length, 4, '应有 4 个餐次分组');
  ok('记录页日期、图表、餐次分组');

  doc.querySelector('.date-label').click();
  await sleep(100);
  assert.ok(text(view.querySelector('.date-nav')).includes('今天'));

  // ---------- 搜索添加 ----------
  doc.querySelector('#view [data-act=open-add]').click();
  await sleep(150);
  assert.ok(doc.querySelector('#sheet .sheet-panel'), '应弹出添加食物面板');
  assert.ok(doc.querySelectorAll('#food-results .food-row').length > 20, '应列出食物库');
  ok('添加面板与食物列表');

  const search = doc.getElementById('food-search');
  input(window, search, '鸡胸');
  await sleep(60);
  const rows = Array.from(doc.querySelectorAll('#food-results .food-row'));
  assert.ok(rows.length >= 1 && rows.every((r) => text(r).includes('鸡胸')), '搜索应过滤结果');
  ok('食物搜索过滤');

  rows[0].click();
  await sleep(120);
  assert.ok(doc.querySelector('#sheet .portion-name'), '应进入份量页');
  assert.ok(text(doc.getElementById('live-calc')).includes('165'), '默认 100g 应显示 165 千卡');

  input(window, doc.getElementById('grams'), 150);
  await sleep(60);
  assert.ok(text(doc.getElementById('live-calc')).includes('248'), '150g 应为 248 千卡');
  doc.querySelector('#meal-seg [data-meal="dinner"]').click();
  await sleep(40);
  doc.querySelector('[data-act="confirm-portion"]').click();
  await sleep(150);

  let count = state.logs[today].length;
  assert.strictEqual(count, 7, '添加后应有 7 条记录');
  const added = state.logs[today][count - 1];
  assert.strictEqual(added.kcal, 248);
  assert.strictEqual(added.meal, 'dinner');
  ok('选择份量、餐次并添加记录');

  // ---------- 手动添加 ----------
  doc.querySelector('#view [data-act=open-add]').click();
  await sleep(120);
  doc.querySelector('.seg-tabs [data-tab="manual"]').click();
  await sleep(100);
  const manual = doc.getElementById('manual-form');
  manual.querySelector('[name="name"]').value = '测试饭团';
  manual.querySelector('[name="kcal"]').value = '200';
  manual.querySelector('[name="carb"]').value = '30';
  manual.querySelector('[name="protein"]').value = '5';
  manual.querySelector('[name="fat"]').value = '6';
  manual.querySelector('[name="grams"]').value = '120';
  manual.querySelector('[name="meal"]').value = 'lunch';
  submit(window, manual);
  await sleep(150);
  count = state.logs[today].length;
  assert.strictEqual(count, 8, '手动添加后应有 8 条记录');
  assert.strictEqual(state.logs[today][count - 1].kcal, 240);
  assert.strictEqual(state.customFoods.length, 1, '应保存到我的食物库');
  ok('手动填写营养并保存到食物库');

  // ---------- 扫码（无相机时应给出提示） ----------
  doc.querySelector('#view [data-act=open-add]').click();
  await sleep(120);
  doc.querySelector('.seg-tabs [data-tab="scan"]').click();
  await sleep(200);
  const mask = doc.getElementById('scan-mask');
  assert.ok(mask && mask.classList.contains('show'), '应显示相机状态');
  assert.ok(/相机|HTTPS/.test(text(mask)), '应提示相机不可用原因');
  assert.ok(doc.querySelector('[data-act="scan-photo"]'), '应提供拍照识别入口');
  assert.ok(doc.getElementById('scan-photo-input'), '应有照片选择输入');
  ok('扫码页在无相机环境下给出可操作提示');

  // ---------- 条码查询（真实请求 Open Food Facts） ----------
  const product = await window.OFF.lookup('3017620422003');
  assert.ok(product && /nutella/i.test(product.name), '应能查询到条码商品');
  assert.strictEqual(product.per100.kcal, 539);
  assert.ok(product.per100.carb > 0 && product.per100.fat > 0);
  ok('Open Food Facts 条码查询与营养换算');

  const barcodeForm = doc.querySelector('form[data-form="barcode"]');
  barcodeForm.querySelector('[name="code"]').value = '3017620422003';
  submit(window, barcodeForm);
  const portionName = await waitFor(() => doc.querySelector('#sheet .portion-name'), 12000);
  assert.ok(/nutella/i.test(text(portionName)), '扫码查询后应进入份量页');
  doc.querySelector('[data-act="confirm-portion"]').click();
  await sleep(150);
  assert.strictEqual(state.logs[today].length, 9, '条码查询添加后应有 9 条记录');
  ok('条码查询到添加记录的完整链路');

  // ---------- 我的 / 体重 ----------
  doc.querySelector('.tab-item[data-tab="me"]').click();
  await sleep(150);
  assert.strictEqual(view.querySelectorAll('.kpis > div').length, 3);
  assert.ok(text(view).includes('基础代谢'));
  const weightForm = view.querySelector('form[data-form="weight"]');
  weightForm.querySelector('[name="kg"]').value = '73.4';
  submit(window, weightForm);
  await sleep(150);
  assert.strictEqual(state.profile.weight, 73.4, '体重应更新到资料');
  assert.strictEqual(state.weights[0].kg, 73.4);
  ok('记录体重并同步热量目标');

  // ---------- 设置 ----------
  doc.querySelector('[data-act="go"][data-tab="settings"]').click();
  await sleep(200);
  const pform = view.querySelector('.profile-form');
  assert.ok(pform, '设置页应有资料表单');
  assert.ok(text(doc.getElementById('settings-preview')).includes('千卡'), '应有实时预览');
  const maintain = pform.querySelector('input[name="goal"][value="maintain"]');
  maintain.checked = true;
  maintain.dispatchEvent(new window.Event('change', { bubbles: true }));
  await sleep(80);
  assert.strictEqual(pform.querySelector('.only-goal').style.display, 'none', '维持体重时隐藏目标体重');
  submit(window, pform);
  await sleep(250);
  assert.strictEqual(state.profile.goal, 'maintain', '设置应保存');
  ok('设置页目标切换、实时预览与保存');

  // ---------- 删除记录 ----------
  doc.querySelector('.tab-item[data-tab="record"]').click();
  await sleep(150);
  const beforeDelete = state.logs[today].length;
  view.querySelector('.entry-row').click();
  await sleep(120);
  doc.querySelector('[data-act="delete-entry"]').click();
  await sleep(120);
  doc.querySelector('#sheet [data-confirm="1"]').click();
  await sleep(180);
  assert.strictEqual(state.logs[today].length, beforeDelete - 1, '删除后记录减少');
  ok('删除饮食记录');

  // ---------- AI 拍照识别 ----------
  doc.querySelector('#view [data-act=open-add]').click();
  await sleep(150);
  doc.querySelector('.seg-tabs [data-tab="ai"]').click();
  await sleep(120);
  assert.ok(doc.querySelector('.ai-setup'), '未填 Key 时应显示启用引导');
  assert.ok(doc.querySelector('[data-act="ai-settings"]'), '应有填入 Key 入口');

  doc.querySelector('[data-act="ai-settings"]').click();
  await sleep(150);
  const keyInput = doc.getElementById('ai-key-input');
  assert.ok(keyInput, '应打开 Key 设置');
  keyInput.value = 'sk-test-1234567890';
  doc.querySelector('[data-act="ai-save"]').click();
  await sleep(300);
  assert.ok(window.AI.hasKey(), 'Key 应保存');
  assert.ok(doc.querySelector('.ai-shot'), '保存后应回到拍照界面');
  assert.ok(doc.getElementById('ai-photo-input'), '应有照片输入');
  assert.ok(!JSON.stringify(window.QK.state()).includes('sk-test-1234567890'), 'Key 不应进入业务数据/备份');
  assert.ok(window.localStorage.getItem('qingka.ai.v1').includes('sk-test-1234567890'), 'Key 应存在独立本地键');
  ok('AI Key 本机保存且不进入备份数据');

  let badFile = null;
  try {
    await window.AI.compress(new window.File(['x'], 'a.txt', { type: 'text/plain' }));
  } catch (e) { badFile = e; }
  assert.strictEqual(badFile && badFile.code, 'not-image');
  ok('非图片文件被拒绝');

  const originalFetch = window.fetch;
  window.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{
        message: {
          content: JSON.stringify({
            items: [
              { name: '米饭', grams: 150, kcal: 174, carb: 38.8, protein: 3.9, fat: 0.5 },
              { name: '鸡胸肉', grams: 120, kcal: 198, carb: 0, protein: 37.2, fat: 4.3 }
            ],
            note: '按可见份量估算'
          })
        }
      }]
    })
  });

  const rec = await window.AI.recognize('data:image/jpeg;base64,AAAA');
  assert.strictEqual(rec.items.length, 2);
  assert.strictEqual(rec.items[0].per100.kcal, 116);
  assert.strictEqual(rec.items[1].per100.protein, 31);
  assert.ok(rec.note.includes('可见'));
  ok('解析 AI 返回并换算成每 100g');

  window.fetch = async () => ({
    ok: false,
    status: 401,
    text: async () => '{"error":{"message":"invalid key"}}'
  });
  let authErr = null;
  try { await window.AI.recognize('data:image/jpeg;base64,AAAA'); } catch (e) { authErr = e; }
  assert.strictEqual(authErr && authErr.code, 'auth');

  window.AI.setLimit(1);
  let limitErr = null;
  try { await window.AI.recognize('data:image/jpeg;base64,AAAA'); } catch (e) { limitErr = e; }
  assert.strictEqual(limitErr && limitErr.code, 'limit');
  window.AI.setLimit(20);
  window.fetch = originalFetch;
  ok('API 错误与每日上限提示');

  const beforeAIAdd = state.logs[today].length;
  window.QK.showAIReview([
    { name: '测试饭', grams: 200, per100: { kcal: 100, carb: 10, protein: 5, fat: 3 } },
    { name: '测试菜', grams: 100, per100: { kcal: 50, carb: 5, protein: 2, fat: 2 } }
  ], '测试');
  await sleep(100);
  assert.strictEqual(doc.querySelectorAll('.ai-item').length, 2, '应显示识别结果');
  assert.ok(text(doc.getElementById('ai-total')).includes('250'), '总热量应为 250');
  doc.querySelector('[data-act="ai-add"]').click();
  await sleep(200);
  assert.strictEqual(state.logs[today].length, beforeAIAdd + 2, '应一次添加两项');
  ok('复核识别结果并批量入账');

  // ---------- 首次使用：引导页 ----------
  const dom2 = await JSDOM.fromURL('http://127.0.0.1:8123/?nosw=1', {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
      window.scrollTo = () => {};
      window.HTMLElement.prototype.scrollIntoView = () => {};
    }
  });
  const w2 = dom2.window;
  const d2 = w2.document;
  await new Promise((resolve) => {
    if (d2.readyState === 'complete') return resolve();
    w2.addEventListener('load', resolve, { once: true });
  });
  await sleep(300);
  assert.ok(d2.querySelector('.onboard'), '新用户应看到引导页');
  const ob = d2.querySelector('.profile-form');
  ob.querySelector('[name="age"]').value = '30';
  ob.querySelector('[name="height"]').value = '180';
  ob.querySelector('[name="weight"]').value = '80';
  ob.querySelector('[name="targetWeight"]').value = '75';
  submit(w2, ob);
  await sleep(400);
  assert.ok(d2.querySelector('.ring-num'), '保存资料后应进入首页');
  assert.strictEqual(w2.QK.state().profile.weight, 80);
  assert.strictEqual(w2.QK.state().profile.startWeight, 80);
  const persisted = JSON.parse(w2.localStorage.getItem('qingka.state.v1'));
  assert.strictEqual(persisted.profile.age, 30, '资料应写入 localStorage');
  ok('首次引导、保存资料并持久化');

  // ---------- 错误汇总 ----------
  if (errors.length) {
    console.error('\n页面运行时错误：\n' + errors.join('\n'));
    throw new Error('页面存在运行时错误');
  }
  console.log('\n' + passed + ' 项界面测试全部通过');
  window.close();
}

main().catch((err) => {
  console.error('\nFAILED:', err && err.message);
  process.exitCode = 1;
});
