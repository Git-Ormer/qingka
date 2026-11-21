/* 营养计算单元测试：node tests/nutrition.test.js */
'use strict';

const assert = require('assert');
const N = require('../js/nutrition.js');

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('  ok  ' + name);
  } catch (err) {
    console.error('FAIL  ' + name);
    throw err;
  }
}

const male = { sex: 'male', age: 30, height: 175, weight: 70, activity: 1.375, goal: 'lose', targetWeight: 65, rate: 0.5, proteinPerKg: 1.6, fatPct: 0.25 };
const female = { sex: 'female', age: 30, height: 175, weight: 70, activity: 1.375, goal: 'maintain', targetWeight: 70, rate: 0.5 };

check('Mifflin-St Jeor 男性 BMR', () => {
  assert.strictEqual(Math.round(N.bmr(male)), 1649); // 10*70 + 6.25*175 - 5*30 + 5
});

check('Mifflin-St Jeor 女性 BMR', () => {
  assert.strictEqual(Math.round(N.bmr(female)), 1483); // 同上 -161
});

check('TDEE = BMR × 活动系数', () => {
  assert.strictEqual(Math.round(N.tdee(male)), Math.round(N.bmr(male) * 1.375));
});

check('每周减 0.5kg 对应 550 千卡缺口', () => {
  const cp = N.caloriePlan(male);
  assert.strictEqual(Math.round(cp.target), Math.round(N.tdee(male) - 550));
  assert.strictEqual(cp.weeklyChangeKg, -0.5);
});

check('安全下限：女性不低于 1200 千卡', () => {
  const tiny = { sex: 'female', age: 60, height: 150, weight: 45, activity: 1.2, goal: 'lose', targetWeight: 40, rate: 0.75 };
  const cp = N.caloriePlan(tiny);
  assert.strictEqual(Math.round(cp.target), 1200);
  assert.strictEqual(cp.floorHit, true);
});

check('缺口不超过 TDEE 的 30%', () => {
  const aggressive = { sex: 'male', age: 30, height: 175, weight: 70, activity: 1.2, goal: 'lose', targetWeight: 60, rate: 2 };
  const cp = N.caloriePlan(aggressive);
  assert.ok(Math.abs(cp.delta) <= cp.tdee * 0.3 + 0.01, 'delta=' + cp.delta);
});

check('三大营养素换算热量守恒', () => {
  const cp = N.caloriePlan(male);
  const m = N.macroTargets(male, cp.target);
  const kcal = m.carb * 4 + m.protein * 4 + m.fat * 9;
  assert.ok(Math.abs(kcal - cp.target) <= 8, '宏量热量 ' + kcal + ' vs 目标 ' + cp.target);
  assert.strictEqual(m.protein, Math.round(1.6 * 65)); // 减脂按目标体重
});

check('维持体重时蛋白质按当前体重', () => {
  const cp = N.caloriePlan(female);
  const m = N.macroTargets(female, cp.target);
  assert.strictEqual(m.protein, Math.round(1.6 * 70));
  assert.strictEqual(Math.round(cp.target), Math.round(N.tdee(female)));
});

check('份量换算', () => {
  const sc = N.scale({ kcal: 165, carb: 0, protein: 31, fat: 3.6 }, 150);
  assert.deepStrictEqual(sc, { kcal: 248, carb: 0, protein: 46.5, fat: 5.4 });
});

check('汇总当天记录', () => {
  const t = N.totals([
    { kcal: 200, carb: 20, protein: 10, fat: 5 },
    { kcal: 300, carb: 30, protein: 20, fat: 10 }
  ]);
  assert.deepStrictEqual(t, { kcal: 500, carb: 50, protein: 30, fat: 15 });
});

check('目标日期估算', () => {
  const from = new Date(2026, 0, 1);
  const proj = N.projection(male, from);
  // 70 → 65，每周 0.5kg，约 10 周 = 70 天
  assert.strictEqual(proj.weeks, 10);
  assert.strictEqual(proj.date.getTime(), new Date(2026, 2, 12).getTime());
});

check('已达成目标时返回 reached', () => {
  const p = Object.assign({}, male, { weight: 64 });
  const proj = N.projection(p, new Date());
  assert.strictEqual(proj.reached, true);
});

check('BMI 分类', () => {
  assert.strictEqual(N.bmi(70, 175), 22.9);
  assert.strictEqual(N.bmiLabel(22.9), '正常');
  assert.strictEqual(N.bmiLabel(17), '偏瘦');
});

check('空数据处理', () => {
  assert.deepStrictEqual(N.totals([]), { kcal: 0, carb: 0, protein: 0, fat: 0 });
  assert.strictEqual(N.macroTargets(null, 0).protein, 0);
  assert.strictEqual(N.caloriePlan(null), null);
});

console.log('\n' + passed + ' 项测试全部通过');
