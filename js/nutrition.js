/* 轻卡 · 营养计算核心
 * 纯函数、无依赖，浏览器挂到 window.Nutrition，Node 里可 require 用于测试。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Nutrition = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var KCAL_PER_KG = 7700;      // 1 kg 脂肪约等于 7700 千卡
  var MIN_CALORIES_FEMALE = 1200;
  var MIN_CALORIES_MALE = 1500;
  var MAX_DEFICIT_RATIO = 0.3; // 每日缺口最多为 TDEE 的 30%

  var ACTIVITY = [
    { value: 1.2, label: '久坐', desc: '几乎不运动，办公室为主' },
    { value: 1.375, label: '轻度', desc: '每周运动 1–3 次' },
    { value: 1.55, label: '中度', desc: '每周运动 3–5 次' },
    { value: 1.725, label: '高强度', desc: '每周运动 6–7 次' },
    { value: 1.9, label: '极高', desc: '体力工作或每天两练' }
  ];

  function num(v, fallback) {
    var n = Number(v);
    return isFinite(n) ? n : (fallback || 0);
  }

  function round(v, digits) {
    var f = Math.pow(10, digits || 0);
    return Math.round((num(v) + Number.EPSILON) * f) / f;
  }

  /** Mifflin-St Jeor 基础代谢 */
  function bmr(p) {
    if (!p) return 0;
    var base = 10 * num(p.weight) + 6.25 * num(p.height) - 5 * num(p.age);
    return Math.max(0, base + (p.sex === 'female' ? -161 : 5));
  }

  /** 每日总消耗 = 基础代谢 × 活动系数 */
  function tdee(p) {
    if (!p) return 0;
    var act = num(p.activity, 1.2);
    if (act <= 0) act = 1.2;
    return bmr(p) * act;
  }

  /**
   * 每日热量计划
   * goal: lose | maintain | gain；rate 为每周目标变化公斤数
   */
  function caloriePlan(p) {
    if (!p) return null;
    var b = bmr(p);
    var t = tdee(p);
    var goal = p.goal || 'maintain';
    var rate = num(p.rate, 0.5);
    if (rate <= 0) rate = 0.5;

    var rawDelta = 0;
    if (goal === 'lose') rawDelta = -(rate * KCAL_PER_KG) / 7;
    if (goal === 'gain') rawDelta = (rate * KCAL_PER_KG) / 7;

    var cap = MAX_DEFICIT_RATIO * t;
    var capped = false;
    if (rawDelta < -cap) {
      rawDelta = -cap;
      capped = true;
    }

    var target = t + rawDelta;
    var floor = p.sex === 'female' ? MIN_CALORIES_FEMALE : MIN_CALORIES_MALE;
    var floorHit = false;
    if (target < floor) {
      target = floor;
      floorHit = true;
    }

    return {
      bmr: b,
      tdee: t,
      target: target,
      delta: target - t,
      weeklyChange: ((target - t) * 7) / KCAL_PER_KG,
      weeklyChangeKg: round(((target - t) * 7) / KCAL_PER_KG, 2),
      floor: floor,
      floorHit: floorHit,
      capped: capped,
      goal: goal
    };
  }

  /**
   * 三大营养素目标（克）
   * 蛋白质按体重（减脂时按目标体重）计算，脂肪按热量占比，碳水补足剩余。
   */
  function macroTargets(p, target) {
    if (!p || !target) return { carb: 0, protein: 0, fat: 0, carbLow: false };
    var refWeight = num(p.weight, 60);
    if (p.goal === 'lose' && num(p.targetWeight) > 0) refWeight = num(p.targetWeight);

    var proteinPerKg = num(p.proteinPerKg, 1.6);
    if (proteinPerKg <= 0) proteinPerKg = 1.6;
    var fatPct = num(p.fatPct, 0.25);
    if (fatPct <= 0) fatPct = 0.25;

    var protein = proteinPerKg * refWeight;
    var fat = (target * fatPct) / 9;
    var carbKcal = target - protein * 4 - fat * 9;
    var carbLow = false;
    if (carbKcal < 0) {
      carbLow = true;
      carbKcal = 0;
    }

    return {
      carb: round(carbKcal / 4, 0),
      protein: round(protein, 0),
      fat: round(fat, 0),
      carbLow: carbLow
    };
  }

  /** 汇总当天记录 */
  function totals(entries) {
    var t = { kcal: 0, carb: 0, protein: 0, fat: 0 };
    (entries || []).forEach(function (e) {
      t.kcal += num(e.kcal);
      t.carb += num(e.carb);
      t.protein += num(e.protein);
      t.fat += num(e.fat);
    });
    t.kcal = round(t.kcal, 0);
    t.carb = round(t.carb, 1);
    t.protein = round(t.protein, 1);
    t.fat = round(t.fat, 1);
    return t;
  }

  /** 按克数换算一份食物的营养 */
  function scale(per100, grams) {
    var g = Math.max(0, num(grams)) / 100;
    return {
      kcal: round(num(per100 && per100.kcal) * g, 0),
      carb: round(num(per100 && per100.carb) * g, 1),
      protein: round(num(per100 && per100.protein) * g, 1),
      fat: round(num(per100 && per100.fat) * g, 1)
    };
  }

  /** 预计到达目标体重的日期；维持体重时返回 null */
  function projection(p, from) {
    if (!p || p.goal === 'maintain') return null;
    var target = num(p.targetWeight);
    if (target <= 0) return null;
    var rate = num(p.rate, 0.5);
    if (rate <= 0) return null;
    var diff = num(p.weight) - target;
    if (p.goal === 'lose' && diff <= 0) return { reached: true, weeks: 0, date: from || new Date() };
    if (p.goal === 'gain' && diff >= 0) return { reached: true, weeks: 0, date: from || new Date() };
    var weeks = Math.abs(diff) / rate;
    var d = new Date((from || new Date()).getTime());
    d.setDate(d.getDate() + Math.ceil(weeks * 7));
    return { reached: false, weeks: Math.round(weeks * 10) / 10, date: d };
  }

  function bmi(weight, height) {
    var h = num(height) / 100;
    if (!h) return 0;
    return round(num(weight) / (h * h), 1);
  }

  function bmiLabel(v) {
    if (!v) return '';
    if (v < 18.5) return '偏瘦';
    if (v < 24) return '正常';
    if (v < 28) return '偏高';
    return '肥胖';
  }

  return {
    KCAL_PER_KG: KCAL_PER_KG,
    ACTIVITY: ACTIVITY,
    bmr: bmr,
    tdee: tdee,
    caloriePlan: caloriePlan,
    macroTargets: macroTargets,
    totals: totals,
    scale: scale,
    projection: projection,
    bmi: bmi,
    bmiLabel: bmiLabel,
    round: round
  };
});
