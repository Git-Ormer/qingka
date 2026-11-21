/* 轻卡 · 应用主逻辑（原生 JS，无构建步骤） */
(function () {
  'use strict';

  var N = window.Nutrition;
  var U = window.UI;
  var Store = window.Store;
  var AI = window.AI;

  var MEALS = [
    { id: 'breakfast', label: '早餐' },
    { id: 'lunch', label: '午餐' },
    { id: 'dinner', label: '晚餐' },
    { id: 'snack', label: '加餐' }
  ];

  var state = Store.load();

  var App = {
    tab: 'home',
    date: Store.dateKey(),
    addTab: 'search',
    addMeal: 'lunch',
    search: { q: '', cat: '全部' },
    portion: null,
    recent: [],
    demo: false,
    manualBarcode: '',
    ai: { image: '', items: [], note: '', meal: '', busy: false },
    aiSettingsReturn: false
  };

  /* ---------------- 基础工具 ---------------- */

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function persist() {
    if (!App.demo) Store.save(state);
  }

  function shiftDate(key, days) {
    var d = Store.parseKey(key);
    d.setDate(d.getDate() + days);
    return Store.dateKey(d);
  }

  function isToday(key) { return key === Store.dateKey(); }

  function weekday(key) {
    var d = Store.parseKey(key);
    return '周' + '日一二三四五六'.charAt(d.getDay());
  }

  function relLabel(key) {
    if (isToday(key)) return '今天';
    if (key === shiftDate(Store.dateKey(), -1)) return '昨天';
    var d = Store.parseKey(key);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  function fullLabel(key) {
    var d = Store.parseKey(key);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + weekday(key);
  }

  function longDate(d) {
    return d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日';
  }

  function mealLabel(id) {
    var m = MEALS.filter(function (x) { return x.id === id; })[0];
    return m ? m.label : '加餐';
  }

  function mealForNow() {
    var h = new Date().getHours();
    if (h < 10) return 'breakfast';
    if (h < 15) return 'lunch';
    if (h < 17) return 'snack';
    if (h < 21) return 'dinner';
    return 'snack';
  }

  function entriesFor(key) { return state.logs[key] || []; }

  function findEntry(key, id) {
    return entriesFor(key).filter(function (e) { return e.id === id; })[0] || null;
  }

  function plan() {
    var p = state.profile;
    if (!p) return null;
    var cp = N.caloriePlan(p);
    var macros = N.macroTargets(p, cp.target);
    return { profile: p, cp: cp, macros: macros };
  }

  function unitOf(food) { return food.unit === 'ml' ? 'ml' : 'g'; }

  /* ---------------- 内置条码包（新西兰等） ---------------- */

  var PACK_INDEX = null;

  function packIndex() {
    if (PACK_INDEX) return PACK_INDEX;
    PACK_INDEX = {};
    var pack = window.NZ_PACK;
    if (pack && Array.isArray(pack.items)) {
      pack.items.forEach(function (it) {
        if (it && it[0]) PACK_INDEX[it[0]] = it;
      });
    }
    return PACK_INDEX;
  }

  function packFood(item) {
    return {
      name: item[1],
      brand: item[2] || '',
      per100: { kcal: item[3], carb: item[4], protein: item[5], fat: item[6] },
      unit: item[7] === 'ml' ? 'ml' : 'g',
      barcode: item[0],
      source: 'nz-pack'
    };
  }

  function packByCode(code) {
    return packIndex()[code] || null;
  }

  function toFood(c) {
    return {
      name: c.name,
      brand: c.brand || '',
      per100: c.per100,
      portion: c.portion || null,
      unit: c.unit || 'g',
      barcode: c.barcode || '',
      source: 'custom'
    };
  }

  function matches(text, q) {
    if (!q) return true;
    return String(text || '').toLowerCase().indexOf(q.toLowerCase()) >= 0;
  }

  /* ---------------- 路由与渲染 ---------------- */

  function currentTabFromHash() {
    var m = (location.hash || '').match(/^#\/([a-z]+)/);
    return m ? m[1] : 'home';
  }

  function go(tab) {
    if (!state.profile) return;
    if (currentTabFromHash() === tab) {
      App.tab = tab;
      render();
      return;
    }
    location.hash = '#/' + tab;
  }

  function render() {
    if (!state.profile) { renderOnboarding(); return; }
    var view = document.getElementById('view');
    if (App.tab === 'settings') {
      view.innerHTML = settingsView();
      var form = view.querySelector('.profile-form');
      if (form) {
        syncGoalFields(form);
        updatePreview(form);
      }
    } else if (App.tab === 'record') view.innerHTML = recordView();
    else if (App.tab === 'me') view.innerHTML = meView();
    else view.innerHTML = homeView();
    updateChrome();
  }

  function updateChrome() {
    var tabbar = document.getElementById('tabbar');
    var hasProfile = !!state.profile;
    var mainTabs = App.tab === 'home' || App.tab === 'record' || App.tab === 'me';
    tabbar.classList.toggle('hidden', !hasProfile || !mainTabs);
    U.$$('.tab-item').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-tab') === App.tab);
    });
  }

  /* ---------------- 首页 ---------------- */

  function homeView() {
    var t = N.totals(entriesFor(App.date));
    var pl = plan();
    var target = pl ? Math.round(pl.cp.target) : 0;
    var remaining = target - t.kcal;
    var over = remaining < 0;
    var pct = target > 0 ? Math.min(1, t.kcal / target) : 0;
    var C = 653.45;
    var offset = C * (1 - pct);
    var entries = entriesFor(App.date);
    var macros = pl ? pl.macros : { carb: 0, protein: 0, fat: 0 };

    var macroRows = [
      { key: 'carb', label: '碳水', color: 'var(--carb)', target: macros.carb, value: t.carb },
      { key: 'protein', label: '蛋白质', color: 'var(--protein)', target: macros.protein, value: t.protein },
      { key: 'fat', label: '脂肪', color: 'var(--fat)', target: macros.fat, value: t.fat }
    ].map(function (m) {
      var p = m.target > 0 ? Math.min(100, (m.value / m.target) * 100) : 0;
      return '<div class="macro">' +
        '<div class="macro-head"><span class="dot" style="background:' + m.color + '"></span>' +
        '<span class="macro-name">' + m.label + '</span>' +
        '<span class="macro-val"><b>' + U.fmt(m.value) + '</b> / ' + U.fmt(m.target) + ' g</span></div>' +
        '<div class="bar"><i style="width:' + p.toFixed(1) + '%;background:' + m.color + '"></i></div>' +
        '</div>';
    }).join('');

    var latest = entries.slice(-4).reverse();

    return '' +
      '<div class="topbar">' +
        '<div><div class="brand">轻卡</div><div class="sub">' + fullLabel(App.date) + '</div></div>' +
        '<button class="icon-btn" type="button" data-act="open-add" aria-label="添加食物">' + U.ICONS.plus + '</button>' +
      '</div>' +

      '<section class="card hero">' +
        '<div class="ring-wrap">' +
          '<svg class="ring" viewBox="0 0 240 240" aria-hidden="true">' +
            '<defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">' +
              '<stop offset="0" stop-color="#5FCB95"/><stop offset="1" stop-color="#2E9E63"/>' +
            '</linearGradient></defs>' +
            '<circle class="ring-track" cx="120" cy="120" r="104"/>' +
            '<circle class="ring-fill" cx="120" cy="120" r="104" transform="rotate(-90 120 120)" ' +
              'stroke="' + (over ? '#E2583B' : 'url(#ringGrad)') + '" ' +
              'stroke-dasharray="' + C + '" stroke-dashoffset="' + offset.toFixed(2) + '"/>' +
          '</svg>' +
          '<div class="ring-center">' +
            '<div class="ring-label">' + (over ? '已超出' : '还可摄入') + '</div>' +
            '<div class="ring-num' + (over ? ' over' : '') + '">' + U.fmt(Math.abs(remaining)) + '</div>' +
            '<div class="ring-unit">千卡</div>' +
          '</div>' +
        '</div>' +
        '<div class="hero-stats">' +
          '<div><b>' + U.fmt(t.kcal) + '</b><span>已摄入</span></div>' +
          '<div><b>' + U.fmt(target) + '</b><span>每日目标</span></div>' +
          '<div><b>' + Math.round(pct * 100) + '%</b><span>完成度</span></div>' +
        '</div>' +
      '</section>' +

      '<section class="card">' +
        '<div class="card-head"><h3>营养目标</h3><span class="muted small">克 / 天</span></div>' +
        macroRows +
      '</section>' +

      '<section class="card tip">' +
        '<div class="tip-icon">' + U.ICONS.spark + '</div>' +
        '<div><div class="tip-title">今日建议</div><div class="tip-text">' + U.esc(buildTip(t, t.kcal > 0 ? macros : null, pl)) + '</div></div>' +
      '</section>' +

      '<section class="card">' +
        '<div class="card-head"><h3>今日饮食 <span class="muted small">' + entries.length + ' 项</span></h3>' +
          '<button class="link" type="button" data-act="go" data-tab="record">全部 ' + U.ICONS.chevron + '</button></div>' +
        (latest.length
          ? latest.map(function (e) { return entryRowHTML(e, true); }).join('')
          : '<div class="empty-inline"><p>今天还没有记录</p>' +
            '<div class="quick-meals">' + MEALS.map(function (m) {
              return '<button type="button" class="chip" data-act="open-add" data-meal="' + m.id + '">+ ' + m.label + '</button>';
            }).join('') + '</div></div>') +
      '</section>' +

      '<p class="foot-note">基础代谢 ' + (pl ? U.fmt(pl.cp.bmr) : '-') + ' · 日常消耗 ' + (pl ? U.fmt(pl.cp.tdee) : '-') + ' 千卡 / 天</p>';
  }

  function buildTip(t, macros, pl) {
    if (!pl) return '完善个人资料后，这里会给出每天的热量建议。';
    if (t.kcal === 0) return '今天还没有记录，先从第一餐开始吧。';
    var remaining = Math.round(pl.cp.target - t.kcal);
    if (remaining < 0) {
      return '今天已超出目标 ' + U.fmt(-remaining) + ' 千卡。散步 40 分钟约消耗 150 千卡，明天继续就好。';
    }
    if (!macros) return '今天已摄入 ' + U.fmt(t.kcal) + ' 千卡，还可以吃 ' + U.fmt(remaining) + ' 千卡。';
    var gaps = [
      { key: 'protein', label: '蛋白质', gap: macros.protein - t.protein, food: 'f022' },
      { key: 'carb', label: '碳水', gap: macros.carb - t.carb, food: 'f001' },
      { key: 'fat', label: '脂肪', gap: macros.fat - t.fat, food: 'f070' }
    ];
    gaps.sort(function (a, b) {
      var ra = macros[a.key] > 0 ? a.gap / macros[a.key] : 0;
      var rb = macros[b.key] > 0 ? b.gap / macros[b.key] : 0;
      return rb - ra;
    });
    var g = gaps[0];
    if (!g || g.gap <= 3) return '三大营养素都很接近目标，保持这个节奏。';
    var item = window.FOODS.filter(function (f) { return f.id === g.food; })[0];
    var per = item ? item[g.key] : 0;
    if (per > 0) {
      var grams = Math.round((g.gap / per) * 100 / 5) * 5;
      if (grams >= 10 && grams <= 500) {
        return g.label + '还差 ' + Math.round(g.gap) + ' g，约等于 ' + grams + ' g ' + item.name + '。';
      }
    }
    return g.label + '还差 ' + Math.round(g.gap) + ' g，可以再补充一点。';
  }

  function entryRowHTML(e, compact) {
    var unit = e.unit === 'ml' ? 'ml' : 'g';
    return '<button type="button" class="entry-row" data-act="edit-entry" data-id="' + e.id + '">' +
      '<div class="entry-main">' +
        '<div class="entry-name">' + U.esc(e.name) + (compact ? '' : ' <span class="meal-tag">' + mealLabel(e.meal) + '</span>') + '</div>' +
        '<div class="entry-sub">' + U.fmt(e.grams) + unit + ' · 碳 ' + U.fmt(e.carb, 1) + ' · 蛋 ' + U.fmt(e.protein, 1) + ' · 脂 ' + U.fmt(e.fat, 1) + '</div>' +
      '</div>' +
      '<div class="entry-kcal">' + U.fmt(e.kcal) + '<span>kcal</span></div>' +
    '</button>';
  }

  /* ---------------- 记录页 ---------------- */

  function recordView() {
    var pl = plan();
    var target = pl ? Math.round(pl.cp.target) : 0;
    var t = N.totals(entriesFor(App.date));
    var remaining = target - t.kcal;
    var mealsHTML = MEALS.map(function (m) {
      var list = entriesFor(App.date).filter(function (e) { return e.meal === m.id; });
      var sum = N.totals(list).kcal;
      return '<section class="card meal">' +
        '<div class="meal-head">' +
          '<div><b>' + m.label + '</b><span class="muted small">' + U.fmt(sum) + ' 千卡</span></div>' +
          '<button type="button" class="mini" data-act="open-add" data-meal="' + m.id + '">' + U.ICONS.plus + '添加</button>' +
        '</div>' +
        (list.length ? list.map(function (e) { return entryRowHTML(e, true); }).join('') : '<div class="meal-empty">还没有记录</div>') +
      '</section>';
    }).join('');

    return '' +
      '<div class="topbar"><div><div class="brand">记录</div><div class="sub">' + fullLabel(App.date) + '</div></div>' +
        '<button type="button" class="icon-btn" data-act="open-add" aria-label="添加">' + U.ICONS.plus + '</button></div>' +

      '<div class="date-nav">' +
        '<button type="button" class="nav-btn" data-act="day-prev" aria-label="前一天">' + U.ICONS.back + '</button>' +
        '<button type="button" class="date-label" data-act="day-today"><b>' + relLabel(App.date) + '</b><span>' + fullLabel(App.date) + '</span></button>' +
        '<button type="button" class="nav-btn next" data-act="day-next"' + (isToday(App.date) ? ' disabled' : '') + ' aria-label="后一天">' + U.ICONS.back + '</button>' +
      '</div>' +

      '<section class="card day-sum">' +
        '<div><b>' + U.fmt(t.kcal) + '</b><span>已摄入</span></div>' +
        '<div><b>' + U.fmt(target) + '</b><span>目标</span></div>' +
        '<div><b class="' + (remaining < 0 ? 'over' : '') + '">' + U.fmt(Math.abs(remaining)) + '</b><span>' + (remaining < 0 ? '超出' : '剩余') + '</span></div>' +
      '</section>' +

      '<section class="card">' +
        '<div class="card-head"><h3>近 7 天</h3><span class="muted small">千卡</span></div>' +
        chartHTML(App.date, target) +
      '</section>' +

      mealsHTML +
      '<div class="spacer"></div>';
  }

  function chartHTML(selected, target) {
    var days = [];
    for (var i = 6; i >= 0; i--) days.push(shiftDate(selected, -i));
    var vals = days.map(function (k) { return N.totals(entriesFor(k)).kcal; });
    var max = Math.max.apply(null, vals.concat([target || 0, 100])) * 1.1;
    var bars = days.map(function (k, idx) {
      var v = vals[idx];
      var h = Math.max(v > 0 ? 3 : 1.5, (v / max) * 100);
      var over = target > 0 && v > target;
      return '<div class="bar-wrap" data-act="day-pick" data-date="' + k + '" title="' + fullLabel(k) + ' ' + U.fmt(v) + ' 千卡">' +
        '<i class="bar' + (over ? ' over' : '') + (k === selected ? ' sel' : '') + '" style="height:' + h.toFixed(1) + '%"></i></div>';
    }).join('');
    var labels = days.map(function (k) {
      var d = Store.parseKey(k);
      return '<span class="' + (isToday(k) ? 'today' : '') + '">' + (d.getMonth() + 1) + '/' + d.getDate() + '</span>';
    }).join('');
    var line = target > 0
      ? '<div class="chart-line" style="bottom:' + ((target / max) * 100).toFixed(1) + '%"><em>' + U.fmt(target) + '</em></div>'
      : '';
    return '<div class="chart-plot">' + line + bars + '</div><div class="chart-labels">' + labels + '</div>';
  }

  /* ---------------- 我的 ---------------- */

  function meView() {
    var p = state.profile;
    var pl = plan();
    var goalText = p.goal === 'lose' ? '减脂' : (p.goal === 'gain' ? '增重' : '维持体重');
    var rateText = p.goal === 'maintain' ? '维持' : '每周 ' + p.rate + ' kg';
    var start = Number(p.startWeight) || Number(p.weight);
    var pct = 0;
    if (p.goal !== 'maintain' && start !== Number(p.targetWeight)) {
      pct = (start - Number(p.weight)) / (start - Number(p.targetWeight));
    } else {
      pct = 1;
    }
    pct = U.clamp(pct * 100, 0, 100);

    var proj = N.projection(p);
    var projText;
    if (p.goal === 'maintain') {
      projText = '维持现在的生活方式，每天约 ' + U.fmt(pl.cp.target) + ' 千卡。';
    } else if (proj && proj.reached) {
      projText = '已经达到目标体重，接下来以维持为主。';
    } else if (proj) {
      projText = '按每天 ' + U.fmt(pl.cp.target) + ' 千卡，约 ' + proj.weeks + ' 周后（' + longDate(proj.date) + '）接近目标。';
    } else {
      projText = '填写目标体重后可预估达成日期。';
    }

    var weightList = state.weights.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 5);
    var weightsHTML = weightList.length
      ? weightList.map(function (w, i) {
          var prev = weightList[i + 1];
          var delta = prev ? (w.kg - prev.kg) : 0;
          var deltaHTML = prev
            ? '<span class="delta ' + (delta > 0 ? 'up' : (delta < 0 ? 'down' : '')) + '">' + (delta > 0 ? '+' : '') + delta.toFixed(1) + ' kg</span>'
            : '<span class="delta"></span>';
          return '<div class="weight-row"><span class="weight-date">' + relLabel(w.date) + '</span><b>' + Number(w.kg).toFixed(1) + ' kg</b>' + deltaHTML +
            '<button type="button" class="icon-btn tiny" data-act="del-weight" data-date="' + w.date + '" aria-label="删除">' + U.ICONS.close + '</button></div>';
        }).join('')
      : '<div class="meal-empty">还没有体重记录</div>';

    return '' +
      '<div class="topbar"><div class="brand">我的</div>' +
        '<button type="button" class="icon-btn" data-act="go" data-tab="settings" aria-label="设置">' + U.ICONS.edit + '</button></div>' +

      '<section class="card profile-card">' +
        '<div class="profile-row">' +
          '<div class="avatar">' + (p.sex === 'female' ? '女' : '男') + '</div>' +
          '<div class="profile-main">' +
            '<div class="profile-name">' + (p.sex === 'female' ? '女性' : '男性') + ' · ' + p.age + ' 岁</div>' +
            '<div class="muted small">' + p.height + ' cm · ' + p.weight + ' kg · ' +
              (N.ACTIVITY.filter(function (a) { return a.value === Number(p.activity); })[0] || { label: '轻度' }).label + '</div>' +
          '</div>' +
          '<button type="button" class="btn small ghost" data-act="go" data-tab="settings">编辑</button>' +
        '</div>' +
        '<div class="kpis">' +
          '<div><b>' + U.fmt(pl.cp.bmr) + '</b><span>基础代谢</span></div>' +
          '<div><b>' + U.fmt(pl.cp.tdee) + '</b><span>日常消耗</span></div>' +
          '<div><b>' + p.weight + '</b><span>体重 kg</span></div>' +
        '</div>' +
      '</section>' +

      '<section class="card">' +
        '<div class="card-head"><h3>' + goalText + '</h3><span class="pill">' + rateText + '</span></div>' +
        '<div class="goal-bar"><i style="width:' + pct.toFixed(1) + '%"></i></div>' +
        '<div class="goal-line"><span>起点 ' + start + ' kg</span><span>目标 ' + (p.goal === 'maintain' ? p.weight : p.targetWeight) + ' kg</span></div>' +
        '<p class="goal-note">' + projText + '</p>' +
      '</section>' +

      '<section class="card">' +
        '<div class="card-head"><h3>体重记录</h3><span class="muted small">用于修正热量目标</span></div>' +
        '<form class="inline-form" data-form="weight" novalidate>' +
          '<input name="kg" type="number" inputmode="decimal" step="0.1" min="30" max="300" placeholder="今天的体重 kg" required>' +
          '<button type="submit" class="btn small">记录</button>' +
        '</form>' +
        weightsHTML +
      '</section>' +

      '<section class="card">' +
        '<div class="card-head"><h3>我的食物库</h3><span class="muted small">' + state.customFoods.length + ' 个</span></div>' +
        '<button type="button" class="row-link" data-act="manage-foods">管理自定义食物' + U.ICONS.chevron + '</button>' +
      '</section>' +

      '<section class="card">' +
        '<div class="card-head"><h3>AI 拍照识别</h3><span class="pill">' + (AI && AI.hasKey() ? '已启用' : '未启用') + '</span></div>' +
        '<button type="button" class="row-link" data-act="ai-settings">' +
          (AI && AI.hasKey() ? '今日已用 ' + AI.usageToday() + ' 次 · 管理 API Key' : '填入 DeepSeek API Key，拍照自动识别') +
          U.ICONS.chevron +
        '</button>' +
      '</section>' +

      '<section class="card">' +
        '<div class="card-head"><h3>数据</h3><span class="muted small">只保存在本机</span></div>' +
        '<div class="btn-row">' +
          '<button type="button" class="btn ghost" data-act="export">导出备份</button>' +
          '<button type="button" class="btn ghost" data-act="import">导入备份</button>' +
        '</div>' +
        '<button type="button" class="row-link danger-text" data-act="reset">清空全部数据</button>' +
        '<input type="file" id="import-file" accept="application/json,.json" hidden>' +
      '</section>' +

      '<p class="foot-note">在手机浏览器菜单中选择「添加到主屏幕」，即可像 App 一样打开。<br>食物与条码数据仅供参考，不构成医疗建议。</p>' +
      '<div class="spacer"></div>';
  }

  /* ---------------- 设置 / 引导 ---------------- */

  function renderOnboarding() {
    var view = document.getElementById('view');
    var p = {
      sex: 'male', age: 28, height: 175, weight: 70, activity: 1.375,
      goal: 'lose', targetWeight: 65, rate: 0.5, proteinPerKg: 1.6, fatPct: 0.25
    };
    view.innerHTML = '' +
      '<div class="onboard">' +
        '<div class="onboard-hero">' +
          '<div class="logo">轻卡</div>' +
          '<h1>先了解一下你</h1>' +
          '<p>用来计算基础代谢和每日热量目标。所有数据只保存在这台手机里，不需要注册。</p>' +
        '</div>' +
        profileFormHTML(p, 'onboard') +
      '</div>';
    updateChrome();
    updatePreview(view.querySelector('.profile-form'));
    window.scrollTo(0, 0);
  }

  function settingsView() {
    var p = state.profile;
    return '' +
      '<div class="topbar">' +
        '<button type="button" class="icon-btn" data-act="go" data-tab="me" aria-label="返回">' + U.ICONS.back + '</button>' +
        '<div class="brand">编辑资料</div><div style="width:40px"></div>' +
      '</div>' +
      profileFormHTML(p, 'settings') +
      '<div class="spacer"></div>';
  }

  function profileFormHTML(p, mode) {
    var activityOpts = N.ACTIVITY.map(function (a) {
      return '<option value="' + a.value + '"' + (Number(p.activity) === a.value ? ' selected' : '') + '>' +
        a.label + ' · ' + a.desc + '</option>';
    }).join('');
    var rate = Number(p.rate) || 0.5;
    var protein = Number(p.proteinPerKg) || 1.6;
    var fatPct = Number(p.fatPct) || 0.25;

    function radio(name, value, label, checked) {
      return '<label><input type="radio" name="' + name + '" value="' + value + '"' + (checked ? ' checked' : '') + '><span>' + label + '</span></label>';
    }
    function opts(values, current, suffix) {
      return values.map(function (v) {
        return '<option value="' + v + '"' + (Number(current) === v ? ' selected' : '') + '>' + v + suffix + '</option>';
      }).join('');
    }

    return '' +
      '<form class="profile-form" data-form="' + (mode === 'onboard' ? 'onboard' : 'settings') + '" novalidate>' +
        '<section class="card">' +
          '<div class="field"><label>性别</label>' +
            '<div class="seg">' +
              radio('sex', 'male', '男', p.sex !== 'female') +
              radio('sex', 'female', '女', p.sex === 'female') +
            '</div>' +
          '</div>' +
          '<div class="grid-3">' +
            '<div class="field"><label>年龄</label><input name="age" type="number" inputmode="numeric" min="10" max="100" value="' + p.age + '"></div>' +
            '<div class="field"><label>身高 cm</label><input name="height" type="number" inputmode="numeric" min="120" max="230" value="' + p.height + '"></div>' +
            '<div class="field"><label>体重 kg</label><input name="weight" type="number" inputmode="decimal" step="0.1" min="30" max="300" value="' + p.weight + '"></div>' +
          '</div>' +
          '<div class="field"><label>日常活动量</label><select name="activity">' + activityOpts + '</select></div>' +
        '</section>' +

        '<section class="card">' +
          '<div class="field"><label>目标</label>' +
            '<div class="seg">' +
              radio('goal', 'lose', '减脂', p.goal === 'lose') +
              radio('goal', 'maintain', '维持', p.goal === 'maintain') +
              radio('goal', 'gain', '增重', p.goal === 'gain') +
            '</div>' +
          '</div>' +
          '<div class="grid-2 only-goal">' +
            '<div class="field"><label>目标体重 kg</label><input name="targetWeight" type="number" inputmode="decimal" step="0.1" min="30" max="300" value="' + (p.targetWeight || '') + '"></div>' +
            '<div class="field"><label>每周变化</label><select name="rate">' + opts([0.25, 0.5, 0.75], rate, ' kg') + '</select></div>' +
          '</div>' +
          '<div class="grid-2">' +
            '<div class="field"><label>蛋白质</label><select name="proteinPerKg">' + opts([1.2, 1.6, 2.0], protein, ' g/kg') + '</select></div>' +
            '<div class="field"><label>脂肪占比</label><select name="fatPct">' +
              [20, 25, 30, 35].map(function (v) {
                return '<option value="' + (v / 100) + '"' + (Math.round(fatPct * 100) === v ? ' selected' : '') + '>' + v + '%</option>';
              }).join('') +
            '</select></div>' +
          '</div>' +
          '<p class="fine">脂肪占比按每日热量的百分比计算，碳水由剩余热量自动得出。蛋白质按体重（减脂时按目标体重）计算。</p>' +
        '</section>' +

        '<section class="card preview-card">' +
          '<div class="preview" id="settings-preview"></div>' +
        '</section>' +

        '<div class="form-actions">' +
          '<button type="submit" class="btn primary block">' + (mode === 'onboard' ? '开始使用' : '保存') + '</button>' +
          (mode === 'onboard' ? '' : '<button type="button" class="btn ghost block" data-act="go" data-tab="me">取消</button>') +
        '</div>' +
      '</form>';
  }

  function readProfileForm(form) {
    var fd = new FormData(form);
    return {
      sex: fd.get('sex') === 'female' ? 'female' : 'male',
      age: Number(fd.get('age')),
      height: Number(fd.get('height')),
      weight: Number(fd.get('weight')),
      activity: Number(fd.get('activity')) || 1.2,
      goal: String(fd.get('goal') || 'maintain'),
      targetWeight: Number(fd.get('targetWeight')) || 0,
      rate: Number(fd.get('rate')) || 0.5,
      proteinPerKg: Number(fd.get('proteinPerKg')) || 1.6,
      fatPct: Number(fd.get('fatPct')) || 0.25
    };
  }

  function updatePreview(form) {
    if (!form) return;
    var box = form.querySelector('#settings-preview');
    if (!box) return;
    var p = readProfileForm(form);
    if (!p.age || !p.height || !p.weight) {
      box.innerHTML = '<div class="preview-note">填写年龄、身高、体重后，这里会显示每日目标。</div>';
      return;
    }
    if (p.goal !== 'maintain' && !p.targetWeight) p.targetWeight = p.weight;
    var cp = N.caloriePlan(p);
    var m = N.macroTargets(p, cp.target);
    box.innerHTML =
      '<div class="preview-label">每日热量目标</div>' +
      '<div class="preview-main"><b>' + U.fmt(cp.target) + '</b><i>千卡</i></div>' +
      '<div class="preview-macros">' +
        '<span><em class="dot carb"></em>碳水 <b>' + U.fmt(m.carb) + '</b> g</span>' +
        '<span><em class="dot protein"></em>蛋白 <b>' + U.fmt(m.protein) + '</b> g</span>' +
        '<span><em class="dot fat"></em>脂肪 <b>' + U.fmt(m.fat) + '</b> g</span>' +
      '</div>' +
      '<div class="preview-note">基础代谢 ' + U.fmt(cp.bmr) + ' · 日常消耗 ' + U.fmt(cp.tdee) + ' 千卡/天' +
        (cp.floorHit ? ' · 已按安全下限调整' : '') +
        (p.goal !== 'maintain' ? ' · 每周约 ' + (cp.weeklyChangeKg > 0 ? '+' : '') + cp.weeklyChangeKg + ' kg' : '') +
      '</div>';
  }

  function validateProfile(p) {
    if (!p.age || p.age < 10 || p.age > 100) return '请输入 10–100 之间的年龄';
    if (!p.height || p.height < 120 || p.height > 230) return '请输入 120–230 cm 之间的身高';
    if (!p.weight || p.weight < 30 || p.weight > 300) return '请输入 30–300 kg 之间的体重';
    if (p.goal !== 'maintain') {
      if (!p.targetWeight || p.targetWeight < 30 || p.targetWeight > 300) return '请输入合理的目标体重';
      if (p.goal === 'lose' && p.targetWeight >= p.weight) return '减脂的目标体重应低于当前体重';
      if (p.goal === 'gain' && p.targetWeight <= p.weight) return '增重的目标体重应高于当前体重';
    } else {
      p.targetWeight = p.weight;
    }
    return null;
  }

  function saveProfile(form, mode) {
    var p = readProfileForm(form);
    var err = validateProfile(p);
    if (err) { U.toast(err); return; }
    var prev = state.profile || {};
    p.startWeight = prev.startWeight || p.weight;
    state.profile = Object.assign({}, prev, p);
    if (p.goal === 'maintain') state.profile.targetWeight = p.weight;
    persist();
    U.toast(mode === 'onboard' ? '目标已生成' : '已保存');
    App.tab = 'home';
    if (location.hash !== '#/home') {
      location.hash = '#/home';
    } else {
      render();
    }
    window.scrollTo(0, 0);
  }

  /* ---------------- 添加食物 ---------------- */

  function openAdd(meal, keepState) {
    if (meal) App.addMeal = meal;
    if (!keepState) {
      App.addTab = 'search';
      App.search = { q: '', cat: '全部' };
      App.ai = { image: '', items: [], note: '', meal: '', busy: false };
    }
    App.manualBarcode = '';
    buildRecent();
    U.openSheet(addSheetHTML(), 'sheet-tall');
  }

  function addSheetHTML() {
    return '' +
      '<div class="sheet-head">' +
        '<span class="sheet-spacer"></span>' +
        '<div class="sheet-title">添加食物</div>' +
        '<button type="button" class="icon-btn" data-act="close-sheet" aria-label="关闭">' + U.ICONS.close + '</button>' +
      '</div>' +
      '<div class="seg-tabs" role="tablist">' +
        '<button type="button" data-act="add-tab" data-tab="search" class="' + (App.addTab === 'search' ? 'on' : '') + '">搜索</button>' +
        '<button type="button" data-act="add-tab" data-tab="scan" class="' + (App.addTab === 'scan' ? 'on' : '') + '">扫码</button>' +
        '<button type="button" data-act="add-tab" data-tab="ai" class="' + (App.addTab === 'ai' ? 'on' : '') + '">拍照</button>' +
        '<button type="button" data-act="add-tab" data-tab="manual" class="' + (App.addTab === 'manual' ? 'on' : '') + '">手动</button>' +
      '</div>' +
      '<div id="add-body">' + addBodyHTML() + '</div>';
  }

  function addBodyHTML() {
    if (App.addTab === 'scan') return scanBodyHTML();
    if (App.addTab === 'ai') return aiBodyHTML();
    if (App.addTab === 'manual') return manualBodyHTML();
    return searchBodyHTML();
  }

  function switchAddTab(tab) {
    App.addTab = tab;
    if (tab === 'ai' && !App.ai.meal) App.ai.meal = App.addMeal || mealForNow();
    U.$$('.seg-tabs [data-act="add-tab"]').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-tab') === tab);
    });
    var body = document.getElementById('add-body');
    if (body) body.innerHTML = addBodyHTML();
    if (tab === 'scan') {
      startScan();
    } else {
      window.Scanner.stop();
    }
  }

  /* ----- 搜索 ----- */

  function searchBodyHTML() {
    var cats = window.FOOD_CATS.concat(['我的']);
    var chips = cats.map(function (c) {
      return '<button type="button" class="chip' + (App.search.cat === c ? ' on' : '') + '" data-act="cat" data-cat="' + c + '">' + c + '</button>';
    }).join('');
    return '' +
      '<div class="search-box">' + U.ICONS.search +
        '<input id="food-search" type="search" autocomplete="off" placeholder="搜索食物，如 米饭 / 鸡胸肉" value="' + U.esc(App.search.q) + '">' +
      '</div>' +
      '<div class="chips">' + chips + '</div>' +
      '<div id="food-results" class="food-list">' + resultsHTML() + '</div>' +
      '<p class="fine">内置 ' + window.FOODS.length + ' 种常见食物，数据为每 100g 参考值。找不到可以手动添加或扫码。</p>';
  }

  function buildRecent() {
    var seen = {};
    var list = [];
    Object.keys(state.logs).sort().reverse().forEach(function (k) {
      entriesFor(k).slice().reverse().forEach(function (e) {
        if (!e.per100) return;
        var key = e.name + '|' + e.per100.kcal;
        if (seen[key]) return;
        seen[key] = 1;
        list.push({
          name: e.name,
          brand: e.brand || '',
          per100: e.per100,
          portion: e.portion || { label: '上次 ' + U.fmt(e.grams) + (e.unit === 'ml' ? 'ml' : 'g'), grams: e.grams },
          unit: e.unit || 'g',
          barcode: e.barcode || '',
          source: 'recent'
        });
      });
    });
    App.recent = list.slice(0, 8);
  }

  function resultsHTML() {
    var q = App.search.q;
    var cat = App.search.cat;
    var out = [];
    var seenNames = {};

    if (cat === '全部' || cat === '我的') {
      state.customFoods.forEach(function (c) {
        if (!matches(c.name + ' ' + (c.brand || ''), q)) return;
        out.push({ kind: 'custom', id: c.id, food: toFood(c), tag: '我的' });
        seenNames[c.name] = 1;
      });
    }

    window.FOODS.forEach(function (item) {
      if (cat !== '全部' && cat !== item.cat) return;
      if (!matches(item.name, q)) return;
      if (seenNames[item.name]) return;
      out.push({ kind: 'local', id: item.id, food: window.asFood(item), tag: item.cat });
    });

    if (q && window.NZ_PACK && Array.isArray(window.NZ_PACK.items) && (cat === '全部' || cat === '新西兰')) {
      var packHits = 0;
      for (var i = 0; i < window.NZ_PACK.items.length && packHits < 10; i++) {
        var it = window.NZ_PACK.items[i];
        if (!matches(it[1] + ' ' + (it[2] || ''), q)) continue;
        if (seenNames[it[1]]) continue;
        out.push({ kind: 'pack', id: it[0], food: packFood(it), tag: 'NZ包装' });
        seenNames[it[1]] = 1;
        packHits++;
      }
    }

    if (q && cat === '全部') {
      App.recent.forEach(function (f, i) {
        if (!matches(f.name + ' ' + (f.brand || ''), q)) return;
        if (seenNames[f.name]) return;
        out.push({ kind: 'recent', id: String(i), food: f, tag: '最近' });
        seenNames[f.name] = 1;
      });
    }

    if (!out.length) {
      if (cat === '我的') {
        return '<div class="empty-inline"><div class="empty-icon">' + U.ICONS.search + '</div>' +
          '<p>还没有自定义食物</p>' +
          '<p class="fine">扫码或手动添加时勾选「保存到我的食物库」，就会出现在这里。</p></div>';
      }
      return '<div class="empty-inline"><div class="empty-icon">' + U.ICONS.search + '</div>' +
        '<p>没有找到「' + U.esc(q) + '」</p>' +
        '<p class="fine">试试扫码，或切到「手动」自己填写营养信息。</p></div>';
    }
    return out.slice(0, 50).map(function (r) { return foodRowHTML(r); }).join('');
  }

  function foodRowHTML(r) {
    var f = r.food;
    var p = f.per100;
    return '<button type="button" class="food-row" data-act="pick-food" data-kind="' + r.kind + '" data-id="' + U.esc(r.id) + '">' +
      '<div class="food-main">' +
        '<div class="food-name">' + U.esc(f.name) + ' <span class="tag">' + U.esc(r.tag) + '</span></div>' +
        '<div class="food-sub">每 100' + unitOf(f) + ' · 碳 ' + U.fmt(p.carb, 1) + ' · 蛋 ' + U.fmt(p.protein, 1) + ' · 脂 ' + U.fmt(p.fat, 1) + '</div>' +
      '</div>' +
      '<div class="food-kcal">' + U.fmt(p.kcal) + '<span>kcal</span></div>' +
    '</button>';
  }

  function renderResults() {
    var box = document.getElementById('food-results');
    if (box) box.innerHTML = resultsHTML();
  }

  function pickFood(kind, id) {
    var food = null;
    if (kind === 'local') {
      var item = window.FOODS.filter(function (x) { return x.id === id; })[0];
      if (item) food = window.asFood(item);
    } else if (kind === 'custom') {
      var c = state.customFoods.filter(function (x) { return x.id === id; })[0];
      if (c) food = toFood(c);
    } else if (kind === 'recent') {
      food = App.recent[Number(id)];
    } else if (kind === 'pack') {
      var packedItem = packByCode(id);
      if (packedItem) food = packFood(packedItem);
    }
    if (food) openPortion(food, App.addMeal, { fromAdd: true });
  }

  /* ----- 份量 / 编辑 ----- */

  function defaultGrams(food) {
    return food.portion && food.portion.grams ? food.portion.grams : 100;
  }

  function openPortion(food, meal, opts) {
    opts = opts || {};
    App.portion = {
      mode: 'add',
      food: food,
      per100: food.per100,
      grams: defaultGrams(food),
      meal: meal || mealForNow(),
      unit: unitOf(food),
      barcode: opts.barcode || food.barcode || '',
      fromAdd: !!opts.fromAdd,
      saveToLib: !!opts.saveToLib
    };
    U.openSheet(portionHTML(), 'sheet-tall');
  }

  function gramChips(food, grams) {
    var list = [];
    if (food.portion && food.portion.grams) list.push({ g: food.portion.grams, label: food.portion.label });
    [50, 100, 150, 200, 250, 300].forEach(function (g) {
      var exists = list.some(function (o) { return o.g === g; });
      if (!exists) list.push({ g: g, label: g + 'g' });
    });
    return list.slice(0, 6).map(function (o) {
      return '<button type="button" class="chip' + (o.g === grams ? ' on' : '') + '" data-act="gram-chip" data-g="' + o.g + '">' + U.esc(o.label) + '</button>';
    }).join('');
  }

  function portionHTML() {
    var s = App.portion;
    var f = s.food;
    var p = s.per100;
    var canSave = s.mode === 'add' && f.source !== 'local' && !state.customFoods.some(function (c) { return c.name === f.name; });

    return '' +
      '<div class="sheet-head">' +
        '<button type="button" class="icon-btn" data-act="' + (s.fromAdd ? 'add-back' : 'close-sheet') + '" aria-label="返回">' + U.ICONS.back + '</button>' +
        '<div class="sheet-title">' + (s.mode === 'edit' ? '修改记录' : '记录食物') + '</div>' +
        '<button type="button" class="icon-btn" data-act="close-sheet" aria-label="关闭">' + U.ICONS.close + '</button>' +
      '</div>' +

      '<div class="portion-head">' +
        (f.image ? '<img class="portion-img" src="' + U.esc(f.image) + '" alt="" onerror="this.style.display=\'none\'">' : '') +
        '<div>' +
          '<div class="portion-name">' + U.esc(f.name) + '</div>' +
          '<div class="portion-sub">' + (f.brand ? U.esc(f.brand) + ' · ' : '') + '每 100' + s.unit + ' · ' + U.fmt(p.kcal) + ' 千卡</div>' +
          '<div class="portion-macros">碳 ' + U.fmt(p.carb, 1) + ' · 蛋 ' + U.fmt(p.protein, 1) + ' · 脂 ' + U.fmt(p.fat, 1) + '</div>' +
        '</div>' +
      '</div>' +

      '<div class="field">' +
        '<label>吃了多少（' + (s.unit === 'ml' ? '毫升' : '克') + '）</label>' +
        '<div class="grams-input"><input id="grams" type="number" inputmode="decimal" min="1" max="5000" step="1" value="' + s.grams + '"><span>' + s.unit + '</span></div>' +
      '</div>' +
      '<div class="chips" id="gram-chips">' + gramChips(f, s.grams) + '</div>' +
      '<div class="live" id="live-calc">' + liveText(p, s.grams, s.unit) + '</div>' +

      '<div class="field"><label>餐次</label>' +
        '<div class="seg" id="meal-seg">' +
          MEALS.map(function (m) {
            return '<button type="button" class="seg-btn' + (s.meal === m.id ? ' on' : '') + '" data-act="pick-meal" data-target="pending" data-meal="' + m.id + '">' + m.label + '</button>';
          }).join('') +
        '</div>' +
      '</div>' +

      (canSave ? '<label class="check"><input type="checkbox" id="save-lib"' + (s.saveToLib ? ' checked' : '') + '> 保存到我的食物库，下次直接搜</label>' : '') +

      '<button type="button" class="btn primary block" data-act="confirm-portion">' + (s.mode === 'edit' ? '保存修改' : '添加') + '</button>' +
      (s.mode === 'edit' ? '<button type="button" class="btn ghost block delete-link" data-act="delete-entry">删除这条记录</button>' : '');
  }

  function liveText(per100, grams, unit) {
    var sc = N.scale(per100, grams);
    return '<b>' + U.fmt(grams) + ' ' + unit + ' ≈ ' + U.fmt(sc.kcal) + ' 千卡</b>' +
      '<span>碳水 ' + U.fmt(sc.carb, 1) + ' · 蛋白质 ' + U.fmt(sc.protein, 1) + ' · 脂肪 ' + U.fmt(sc.fat, 1) + '</span>';
  }

  function updateLive() {
    var input = document.getElementById('grams');
    var box = document.getElementById('live-calc');
    if (!input || !box || !App.portion) return;
    var g = U.clamp(input.value, 0, 5000);
    App.portion.grams = g;
    box.innerHTML = liveText(App.portion.per100, g, App.portion.unit);
  }

  function openEntry(id) {
    var e = findEntry(App.date, id);
    if (!e) return;
    App.portion = {
      mode: 'edit',
      id: e.id,
      date: App.date,
      food: { name: e.name, brand: e.brand || '', per100: e.per100, unit: e.unit || 'g', image: '' },
      per100: e.per100,
      grams: e.grams,
      meal: e.meal,
      unit: e.unit || 'g',
      barcode: e.barcode || '',
      fromAdd: false,
      saveToLib: false
    };
    U.openSheet(portionHTML(), 'sheet-tall');
  }

  function confirmPortion() {
    var s = App.portion;
    if (!s) return;
    var input = document.getElementById('grams');
    var grams = U.clamp(input ? input.value : s.grams, 1, 5000);
    if (!grams) { U.toast('请输入份量'); return; }

    if (s.mode === 'edit') {
      var e = findEntry(s.date, s.id);
      if (e) {
        var sc = N.scale(e.per100, grams);
        e.grams = grams;
        e.meal = s.meal;
        e.kcal = sc.kcal;
        e.carb = sc.carb;
        e.protein = sc.protein;
        e.fat = sc.fat;
        persist();
        U.toast('已修改');
      }
      U.closeSheet();
      App.portion = null;
      render();
      return;
    }

    var f = s.food;
    var sv = document.getElementById('save-lib');
    if (sv && sv.checked) saveCustom(f, s.barcode);
    var scaled = N.scale(s.per100, grams);
    var entry = {
      id: uid(),
      name: f.name,
      brand: f.brand || '',
      grams: grams,
      unit: s.unit,
      meal: s.meal,
      per100: s.per100,
      kcal: scaled.kcal,
      carb: scaled.carb,
      protein: scaled.protein,
      fat: scaled.fat,
      barcode: s.barcode || '',
      at: Date.now()
    };
    if (!state.logs[App.date]) state.logs[App.date] = [];
    state.logs[App.date].push(entry);
    persist();
    U.closeSheet();
    U.toast('已添加 ' + entry.name);
    App.portion = null;
    render();
  }

  function saveCustom(food, barcode) {
    var existing = null;
    if (barcode) {
      existing = state.customFoods.filter(function (c) { return c.barcode === barcode; })[0] || null;
    }
    if (!existing) {
      existing = state.customFoods.filter(function (c) { return c.name === food.name; })[0] || null;
    }
    if (existing) {
      existing.per100 = food.per100;
      existing.barcode = barcode || existing.barcode || '';
      existing.brand = food.brand || existing.brand || '';
      return;
    }
    state.customFoods.push({
      id: uid(),
      name: food.name,
      brand: food.brand || '',
      per100: food.per100,
      portion: food.portion || null,
      unit: food.unit || 'g',
      barcode: barcode || ''
    });
  }

  function deleteEntry(id) {
    U.confirm({ title: '删除这条记录？', text: '删除后无法恢复。', ok: '删除', danger: true }).then(function (ok) {
      if (!ok) return;
      var list = state.logs[App.date] || [];
      state.logs[App.date] = list.filter(function (e) { return e.id !== id; });
      persist();
      U.toast('已删除');
      render();
    });
  }

  /* ----- 扫码 ----- */

  function scanBodyHTML() {
    return '' +
      '<div class="scan-box">' +
        '<video id="scan-video" playsinline muted></video>' +
        '<div class="scan-frame"></div>' +
        '<div class="scan-mask show" id="scan-mask">正在启动相机…</div>' +
      '</div>' +
      '<p class="scan-hint" id="scan-hint">把包装上的条码放入框内，识别后自动查询营养数据</p>' +
      '<div class="btn-row">' +
        '<button type="button" class="btn ghost" data-act="scan-toggle">重新扫描</button>' +
        '<button type="button" class="btn ghost" data-act="scan-photo">拍照识别</button>' +
      '</div>' +
      '<input type="file" id="scan-photo-input" accept="image/*" capture="environment" class="sr-only">' +
      '<p class="fine">iPhone 建议用 Safari 打开；如果实时扫码打不开相机，点「拍照识别」对准条码拍一张照片也能识别。</p>' +
      '<div class="hr"><span>或者手动输入条码</span></div>' +
      '<form class="inline-form" data-form="barcode" novalidate>' +
        '<input id="barcode-input" name="code" inputmode="numeric" autocomplete="off" placeholder="输入 8–13 位条码">' +
        '<button type="submit" class="btn small">查询</button>' +
      '</form>' +
      '<p class="fine">条码数据来自 Open Food Facts（免费开放数据库）。查不到时，可以手动填写包装上的营养信息，只需一次。</p>' +
      '<details class="scan-tip"><summary>扫码打不开相机？</summary><p>浏览器要求 HTTPS 才能使用相机（localhost 除外）。把本应用部署到免费静态托管（如 GitHub Pages）即可正常扫码；也可以用上面的手动输入。</p></details>';
  }

  function setScanMask(text, show) {
    var mask = document.getElementById('scan-mask');
    if (!mask) return;
    mask.textContent = text;
    mask.classList.toggle('show', !!show);
  }

  async function startScan() {
    var video = document.getElementById('scan-video');
    if (!video) return;
    setScanMask('正在启动相机…', true);
    try {
      await window.Scanner.start(video, function (code) { lookupCode(code); });
      setScanMask('', false);
    } catch (err) {
      setScanMask(window.Scanner.errorMessage(err), true);
      var v = document.getElementById('scan-video');
      if (v) v.style.display = 'none';
      var hint = document.getElementById('scan-hint');
      if (hint) hint.textContent = '相机不可用，可直接在下方输入条码，或改用「手动」填写营养信息';
    }
  }

  function showScanNotFound(code, why) {
    window.Scanner.stop();
    var body = document.getElementById('add-body');
    if (!body) return;
    body.innerHTML = '' +
      '<div class="empty-inline scan-result">' +
        '<div class="empty-icon">' + U.ICONS.scan + '</div>' +
        '<h3>没有找到这个条码</h3>' +
        '<p class="fine">' + U.esc(why || ('条码 ' + code + ' 暂未收录。')) + '</p>' +
        '<button type="button" class="btn primary block" data-act="manual-barcode" data-code="' + U.esc(code) + '">手动填写营养信息</button>' +
        '<button type="button" class="btn ghost block" data-act="add-tab" data-tab="scan">重新扫描</button>' +
      '</div>';
  }

  async function lookupCode(code) {
    code = String(code || '').trim();
    if (code.length < 6) { U.toast('请输入完整的条码'); return; }
    setScanMask('已识别 ' + code + '，正在查询…', true);

    var custom = state.customFoods.filter(function (c) { return c.barcode === code; })[0];
    if (custom) {
      openPortion(toFood(custom), App.addMeal, { fromAdd: true, barcode: code });
      return;
    }

    var packed = packByCode(code);
    if (packed) {
      openPortion(packFood(packed), App.addMeal, { fromAdd: true, barcode: code });
      return;
    }

    try {
      var product = await window.OFF.lookup(code);
      if (product) {
        openPortion(product, App.addMeal, { fromAdd: true, barcode: code, saveToLib: true });
      } else {
        showScanNotFound(code, '条码 ' + code + ' 暂未收录，可以手动填写包装上的营养信息。');
      }
    } catch (err) {
      showScanNotFound(code, '网络查询失败（' + (err && err.message ? err.message : '网络不可用') + '）。你也可以直接手动填写。');
    }
  }

  /* ----- 手动添加 ----- */

  function manualBodyHTML() {
    return '' +
      '<form id="manual-form" data-form="manual" novalidate>' +
        '<div class="field"><label>食物名称</label><input name="name" type="text" placeholder="如：全麦贝果" required></div>' +
        '<div class="grid-4">' +
          '<div class="field"><label>热量</label><input name="kcal" type="number" inputmode="decimal" placeholder="kcal" min="0" required></div>' +
          '<div class="field"><label>碳水 g</label><input name="carb" type="number" inputmode="decimal" placeholder="0" min="0"></div>' +
          '<div class="field"><label>蛋白 g</label><input name="protein" type="number" inputmode="decimal" placeholder="0" min="0"></div>' +
          '<div class="field"><label>脂肪 g</label><input name="fat" type="number" inputmode="decimal" placeholder="0" min="0"></div>' +
        '</div>' +
        '<p class="fine">以上为每 100g（或 100ml）的数值，包装「营养成分表」通常按每 100g 标注。</p>' +
        '<div class="grid-2">' +
          '<div class="field"><label>吃了多少 g</label><input name="grams" type="number" inputmode="decimal" value="100" min="1" max="5000"></div>' +
          '<div class="field"><label>餐次</label><select name="meal">' +
            MEALS.map(function (m) {
              return '<option value="' + m.id + '"' + (App.addMeal === m.id ? ' selected' : '') + '>' + m.label + '</option>';
            }).join('') +
          '</select></div>' +
        '</div>' +
        '<div class="live" id="manual-live"></div>' +
        '<label class="check"><input type="checkbox" name="saveLib" checked> 保存到我的食物库</label>' +
        '<input type="hidden" name="barcode" value="' + U.esc(App.manualBarcode) + '">' +
        '<button type="submit" class="btn primary block">添加</button>' +
      '</form>';
  }

  function updateManualLive() {
    var form = document.getElementById('manual-form');
    var box = document.getElementById('manual-live');
    if (!form || !box) return;
    var fd = new FormData(form);
    var per100 = {
      kcal: Number(fd.get('kcal')) || 0,
      carb: Number(fd.get('carb')) || 0,
      protein: Number(fd.get('protein')) || 0,
      fat: Number(fd.get('fat')) || 0
    };
    var grams = Number(fd.get('grams')) || 0;
    if (!per100.kcal && !grams) { box.innerHTML = ''; return; }
    box.innerHTML = liveText(per100, grams, 'g');
  }

  function saveManual(form) {
    var fd = new FormData(form);
    var name = String(fd.get('name') || '').trim();
    if (!name) { U.toast('请填写食物名称'); return; }
    var per100 = {
      kcal: Math.round(Number(fd.get('kcal')) || 0),
      carb: Math.round((Number(fd.get('carb')) || 0) * 10) / 10,
      protein: Math.round((Number(fd.get('protein')) || 0) * 10) / 10,
      fat: Math.round((Number(fd.get('fat')) || 0) * 10) / 10
    };
    var grams = U.clamp(fd.get('grams'), 1, 5000);
    var meal = String(fd.get('meal') || 'snack');
    var barcode = String(fd.get('barcode') || '').trim();
    if (!per100.kcal) { U.toast('请填写热量（每 100g）'); return; }

    var food = { name: name, brand: '', per100: per100, unit: 'g', barcode: barcode, source: 'manual' };
    if (fd.get('saveLib')) saveCustom(food, barcode);
    var sc = N.scale(per100, grams);
    if (!state.logs[App.date]) state.logs[App.date] = [];
    state.logs[App.date].push({
      id: uid(), name: name, brand: '', grams: grams, unit: 'g', meal: meal,
      per100: per100, kcal: sc.kcal, carb: sc.carb, protein: sc.protein, fat: sc.fat,
      barcode: barcode, at: Date.now()
    });
    persist();
    U.closeSheet();
    U.toast('已添加 ' + name);
    render();
  }

  /* ---------------- AI 拍照识别 ---------------- */

  function aiBodyHTML() {
    if (!AI || !AI.hasKey()) return aiSetupHTML();

    var hasImage = !!App.ai.image;
    var items = App.ai.items;
    return '' +
      '<div class="ai-shot">' +
        '<input type="file" id="ai-photo-input" accept="image/*" class="sr-only">' +
        '<label class="ai-empty' + (hasImage ? ' hidden' : '') + '" for="ai-photo-input">' +
          '<span class="ai-empty-icon">' + U.ICONS.scan + '</span>' +
          '<b>拍一张这餐的照片</b>' +
          '<span class="ai-empty-sub">尽量俯拍、光线充足，让所有食物都能看清</span>' +
        '</label>' +
        '<img id="ai-preview" class="ai-preview' + (hasImage ? '' : ' hidden') + '" alt="待识别的食物照片"' +
          (hasImage ? ' src="' + App.ai.image + '"' : '') + '>' +
      '</div>' +
      '<div class="btn-row ai-actions">' +
        '<button type="button" class="btn ghost" data-act="ai-pick">' + (hasImage ? '重选照片' : '拍照 / 选图') + '</button>' +
        '<button type="button" class="btn primary" data-act="ai-run" id="ai-run"' + (hasImage ? '' : ' disabled') + '>' +
          (items.length ? '重新识别' : '开始识别') +
        '</button>' +
      '</div>' +
      '<div id="ai-result">' + (items.length ? aiReviewHTML() : '') + '</div>' +
      '<div class="ai-foot"><span>发送前已压缩并去除定位信息</span>' +
        '<button type="button" class="link" data-act="ai-settings">Key 设置</button></div>';
  }

  function aiSetupHTML() {
    return '' +
      '<div class="ai-setup">' +
        '<div class="empty-icon">' + U.ICONS.spark + '</div>' +
        '<h3>用照片记录一餐</h3>' +
        '<p>填入 DeepSeek API Key 后，拍一张饭菜照片，AI 会自动估算食物、克数和营养，你确认后入账。</p>' +
        '<button type="button" class="btn primary block" data-act="ai-settings">填入 API Key</button>' +
        '<p class="fine">Key 只保存在这台手机；照片直接发送给 DeepSeek（不经过本应用服务器）；每顿约 0.4 分钱。</p>' +
      '</div>';
  }

  function aiReviewHTML() {
    var items = App.ai.items;
    var total = items.reduce(function (sum, it) {
      return sum + N.scale(it.per100, it.grams).kcal;
    }, 0);

    var rows = items.map(function (it, i) {
      var s = N.scale(it.per100, it.grams);
      return '<div class="ai-item" data-row="' + i + '">' +
        '<div class="ai-item-main">' +
          '<input class="ai-name" data-idx="' + i + '" value="' + U.esc(it.name) + '" maxlength="30" aria-label="食物名称">' +
          '<div class="ai-item-sub">碳 <span data-carb="' + i + '">' + U.fmt(s.carb, 1) + '</span> · ' +
            '蛋 <span data-protein="' + i + '">' + U.fmt(s.protein, 1) + '</span> · ' +
            '脂 <span data-fat="' + i + '">' + U.fmt(s.fat, 1) + '</span> g</div>' +
        '</div>' +
        '<div class="ai-item-side">' +
          '<label class="ai-grams"><input type="number" class="ai-grams-input" data-idx="' + i + '" value="' + it.grams + '" min="1" max="3000" inputmode="decimal"><span>g</span></label>' +
          '<b class="ai-kcal" data-kcal="' + i + '">' + U.fmt(s.kcal) + '<span>kcal</span></b>' +
          '<button type="button" class="icon-btn tiny" data-act="ai-del" data-idx="' + i + '" aria-label="删除">' + U.ICONS.close + '</button>' +
        '</div>' +
      '</div>';
    }).join('');

    return '<div class="ai-review">' +
      '<div class="ai-review-head"><b>识别到 ' + items.length + ' 项</b><span id="ai-total">' + U.fmt(total) + ' 千卡</span></div>' +
      (App.ai.note ? '<p class="ai-note">' + U.esc(App.ai.note) + '</p>' : '') +
      '<div class="ai-items">' + rows + '</div>' +
      '<div class="field" style="margin-top:12px"><label>记到哪一餐</label>' +
        '<div class="seg" id="ai-meal">' +
          MEALS.map(function (m) {
            return '<button type="button" class="seg-btn' + (App.ai.meal === m.id ? ' on' : '') + '" data-act="ai-meal" data-meal="' + m.id + '">' + m.label + '</button>';
          }).join('') +
        '</div>' +
      '</div>' +
      '<button type="button" class="btn primary block" data-act="ai-add">全部添加</button>' +
      '<p class="fine">AI 估算通常有 20%–30% 误差，请按实际份量调整克数再添加。</p>' +
    '</div>';
  }

  function renderAIReview() {
    var box = document.getElementById('ai-result');
    if (box) box.innerHTML = App.ai.items.length ? aiReviewHTML() : '';
  }

  function updateAITotal() {
    var el = document.getElementById('ai-total');
    if (!el) return;
    var total = App.ai.items.reduce(function (sum, it) {
      return sum + N.scale(it.per100, it.grams).kcal;
    }, 0);
    el.textContent = U.fmt(total) + ' 千卡';
  }

  function openAISettings(opts) {
    opts = opts || {};
    App.aiSettingsReturn = !!opts.returnToAI;
    var s = AI.getState();
    var has = !!s.key;

    U.openSheet(
      '<div class="sheet-head"><div class="sheet-title">AI 拍照识别</div>' +
        '<button type="button" class="icon-btn" data-act="close-sheet" aria-label="关闭">' + U.ICONS.close + '</button></div>' +
      '<div class="ai-status' + (has ? ' on' : '') + '"><span class="dot"></span>' +
        (has ? '已启用 · 今日已用 ' + s.usageToday + ' / ' + (s.limit > 0 ? s.limit : '不限') + ' 次' : '未启用') +
      '</div>' +
      '<div class="field"><label>DeepSeek API Key</label>' +
        '<input id="ai-key-input" type="password" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="' +
          (has ? '已保存 ' + U.esc(AI.maskKey(s.key)) + '（留空不修改）' : 'sk-...') + '">' +
      '</div>' +
      '<div class="field"><label>每日识别上限</label><select id="ai-limit">' +
        [10, 20, 50, 0].map(function (n) {
          return '<option value="' + n + '"' + (s.limit === n ? ' selected' : '') + '>' + (n ? n + ' 次 / 天' : '不限次数') + '</option>';
        }).join('') +
      '</select></div>' +
      '<div class="btn-row">' +
        '<button type="button" class="btn ghost" data-act="ai-test">测试连接</button>' +
        '<button type="button" class="btn primary" data-act="ai-save">保存</button>' +
      '</div>' +
      (has ? '<button type="button" class="row-link danger-text" data-act="ai-clear">清除 API Key</button>' : '') +
      '<p class="fine">Key 只保存在这台手机的浏览器里，不会进入 GitHub 仓库，也不会写进导出的备份文件。照片会直接发送到 api.deepseek.com 识别（已在手机端压缩并去除定位信息），本应用没有服务器。</p>' +
      '<p class="fine">还没有 Key？打开 <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener">platform.deepseek.com/api_keys</a> 创建一个，充值少量金额即可。</p>',
      'sheet-tall'
    );
  }

  function saveAISettings() {
    var input = document.getElementById('ai-key-input');
    var limitEl = document.getElementById('ai-limit');
    var key = input ? input.value.trim() : '';
    if (key) AI.setKey(key);
    if (limitEl) AI.setLimit(Number(limitEl.value));
    if (!AI.hasKey()) {
      U.toast('请先填入 API Key');
      return;
    }
    U.closeSheet();
    U.toast('AI 拍照识别已启用');
    if (App.aiSettingsReturn) {
      App.aiSettingsReturn = false;
      App.addTab = 'ai';
      App.ai.meal = App.ai.meal || App.addMeal || mealForNow();
      openAdd(App.addMeal, true);
    } else {
      render();
    }
  }

  async function testAIKey() {
    var input = document.getElementById('ai-key-input');
    var key = input ? input.value.trim() : '';
    U.toast('正在测试连接…');
    try {
      await AI.testKey(key || undefined);
      U.toast('连接正常，Key 可以使用');
    } catch (err) {
      U.toast(AI.errorMessage(err));
    }
  }

  function clearAIKey() {
    U.confirm({
      title: '清除 API Key？',
      text: '清除后 AI 拍照识别需要重新填写 Key，已经记录的饮食不受影响。',
      ok: '清除',
      danger: true
    }).then(function (ok) {
      if (!ok) return;
      AI.clearKey();
      App.ai.image = '';
      App.ai.items = [];
      U.closeSheet();
      U.toast('已清除 Key');
      render();
    });
  }

  function handleAIPhoto(file) {
    if (!file) return;
    U.toast('正在处理图片…');
    AI.compress(file, 1024, 0.82).then(function (dataUrl) {
      App.ai.image = dataUrl;
      App.ai.items = [];
      App.ai.note = '';
      var img = document.getElementById('ai-preview');
      if (img) {
        img.src = dataUrl;
        img.classList.remove('hidden');
      }
      var empty = document.querySelector('.ai-empty');
      if (empty) empty.classList.add('hidden');
      var run = document.getElementById('ai-run');
      if (run) {
        run.disabled = false;
        run.textContent = '开始识别';
      }
      var body = document.getElementById('ai-result');
      if (body) body.innerHTML = '';
    }).catch(function (err) {
      U.toast(AI.errorMessage(err));
    });
  }

  async function runAIRecognize() {
    if (!App.ai.image) { U.toast('请先拍照或选择照片'); return; }
    if (App.ai.busy) return;
    App.ai.busy = true;
    var btn = document.getElementById('ai-run');
    if (btn) { btn.disabled = true; btn.textContent = '识别中…'; }

    try {
      var result = await AI.recognize(App.ai.image);
      App.ai.items = result.items;
      App.ai.note = result.note || '';
      if (!App.ai.meal) App.ai.meal = App.addMeal || mealForNow();
      renderAIReview();
      if (btn) btn.textContent = '重新识别';
      var box = document.getElementById('ai-result');
      if (box && box.scrollIntoView) {
        setTimeout(function () {
          try { box.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) { /* ignore */ }
        }, 80);
      }
    } catch (err) {
      U.toast(AI.errorMessage(err));
      if (btn) btn.textContent = App.ai.items.length ? '重新识别' : '开始识别';
    } finally {
      App.ai.busy = false;
      if (btn) btn.disabled = false;
    }
  }

  function addAIEntries() {
    var items = App.ai.items.filter(function (it) { return it.name && it.grams > 0; });
    if (!items.length) { U.toast('没有可添加的食物'); return; }
    var meal = App.ai.meal || mealForNow();
    if (!state.logs[App.date]) state.logs[App.date] = [];

    items.forEach(function (it) {
      var s = N.scale(it.per100, it.grams);
      state.logs[App.date].push({
        id: uid(),
        name: it.name,
        brand: '',
        grams: it.grams,
        unit: 'g',
        meal: meal,
        per100: it.per100,
        kcal: s.kcal,
        carb: s.carb,
        protein: s.protein,
        fat: s.fat,
        source: 'ai',
        at: Date.now()
      });
    });
    persist();
    U.closeSheet();
    App.ai = { image: '', items: [], note: '', meal: '', busy: false };
    U.toast('已添加 ' + items.length + ' 项');
    render();
  }

  /* ---------------- 体重 / 数据 ---------------- */

  function saveWeight(form) {
    var fd = new FormData(form);
    var kg = Math.round((Number(fd.get('kg')) || 0) * 10) / 10;
    if (!kg || kg < 30 || kg > 300) { U.toast('请输入 30–300 kg 之间的体重'); return; }
    var key = Store.dateKey();
    var rec = state.weights.filter(function (w) { return w.date === key; })[0];
    if (rec) rec.kg = kg;
    else state.weights.push({ date: key, kg: kg });
    state.weights.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    state.profile.weight = kg;
    persist();
    form.reset();
    U.toast('体重已记录');
    render();
  }

  function delWeight(date) {
    state.weights = state.weights.filter(function (w) { return w.date !== date; });
    persist();
    U.toast('已删除');
    render();
  }

  function exportData() {
    downloadJSON(state, 'qingka-backup-' + Store.dateKey() + '.json');
    U.toast('备份已导出');
  }

  function importData(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(String(reader.result));
        if (!data || !data.profile) throw new Error('bad');
        state = {
          version: 1,
          profile: data.profile,
          logs: data.logs || {},
          weights: Array.isArray(data.weights) ? data.weights : [],
          customFoods: Array.isArray(data.customFoods) ? data.customFoods : []
        };
        persist();
        App.tab = 'home';
        location.hash = '#/home';
        render();
        U.toast('已导入备份');
      } catch (e) {
        U.toast('文件格式不正确');
      }
    };
    reader.readAsText(file);
  }

  function showFoodLibrary() {
    var list = state.customFoods.length
      ? state.customFoods.map(function (c) {
          return '<div class="food-row static">' +
            '<div class="food-main"><div class="food-name">' + U.esc(c.name) + (c.barcode ? ' <span class="tag">条码</span>' : '') + '</div>' +
            '<div class="food-sub">每 100' + (c.unit === 'ml' ? 'ml' : 'g') + ' · ' + U.fmt(c.per100.kcal) + ' 千卡 · 碳 ' + U.fmt(c.per100.carb, 1) + ' · 蛋 ' + U.fmt(c.per100.protein, 1) + ' · 脂 ' + U.fmt(c.per100.fat, 1) + '</div></div>' +
            '<button type="button" class="icon-btn tiny" data-act="del-custom" data-id="' + c.id + '" aria-label="删除">' + U.ICONS.trash + '</button>' +
          '</div>';
        }).join('')
      : '<div class="empty-inline"><p>还没有自定义食物</p><p class="fine">扫码或手动添加时勾选「保存到我的食物库」就会出现在这里。</p></div>';

    U.openSheet(
      '<div class="sheet-head"><div class="sheet-title">我的食物库</div>' +
      '<button type="button" class="icon-btn" data-act="close-sheet" aria-label="关闭">' + U.ICONS.close + '</button></div>' +
      '<div class="btn-row" style="margin-bottom:8px">' +
        '<button type="button" class="btn ghost" data-act="export-foods">导出食物库</button>' +
        '<button type="button" class="btn ghost" data-act="import-foods">导入食物库</button>' +
      '</div>' +
      '<p class="fine">导出为 JSON，可换手机迁移或分享给朋友；导入会与现有食物合并，不覆盖。</p>' +
      '<input type="file" id="food-pack-input" accept="application/json,.json" class="sr-only">' +
      '<div class="food-list">' + list + '</div>' +
      '<p class="fine">' +
        (window.NZ_PACK && Array.isArray(window.NZ_PACK.items)
          ? '新西兰包装数据来自 Open Food Facts（ODbL），共 ' + window.NZ_PACK.items.length + ' 条。'
          : '') +
        '删除后不会影响已经记录的饮食。</p>',
      'sheet-tall'
    );
  }

  function buildFoodPack() {
    return {
      type: 'qingka-food-pack',
      version: 1,
      exportedAt: new Date().toISOString(),
      count: state.customFoods.length,
      items: state.customFoods.map(function (c) {
        return {
          name: c.name,
          brand: c.brand || '',
          per100: { kcal: c.per100.kcal, carb: c.per100.carb, protein: c.per100.protein, fat: c.per100.fat },
          unit: c.unit || 'g',
          portion: c.portion || null,
          barcode: c.barcode || ''
        };
      })
    };
  }

  function normalizePackFoods(data) {
    var raw = Array.isArray(data) ? data : (data && (data.items || data.foods));
    if (!Array.isArray(raw)) return [];
    var out = [];
    raw.slice(0, 3000).forEach(function (it) {
      if (!it || typeof it !== 'object') return;
      var name = String(it.name || '').trim().slice(0, 60);
      if (!name) return;
      var p = it.per100 && typeof it.per100 === 'object' ? it.per100 : it;
      var kcal = Number(p.kcal);
      if (!isFinite(kcal) || kcal < 0 || kcal > 1000) return;
      var carb = Number(p.carb);
      var protein = Number(p.protein);
      var fat = Number(p.fat);
      if (!isFinite(carb) || carb < 0) carb = 0;
      if (!isFinite(protein) || protein < 0) protein = 0;
      if (!isFinite(fat) || fat < 0) fat = 0;
      var portion = null;
      if (it.portion && Number(it.portion.grams) > 0) {
        portion = {
          label: String(it.portion.label || '').slice(0, 12),
          grams: Math.round(Number(it.portion.grams))
        };
        if (!portion.label) portion.label = portion.grams + 'g';
      }
      out.push({
        name: name,
        brand: String(it.brand || '').slice(0, 40),
        per100: {
          kcal: Math.round(kcal),
          carb: N.round(carb, 1),
          protein: N.round(protein, 1),
          fat: N.round(fat, 1)
        },
        unit: it.unit === 'ml' ? 'ml' : 'g',
        portion: portion,
        barcode: String(it.barcode || '').replace(/[^\d]/g, '').slice(0, 14)
      });
    });
    return out;
  }

  function mergeFoodPack(data) {
    var items = normalizePackFoods(data);
    var added = 0;
    var skipped = 0;
    items.forEach(function (it) {
      var dup = state.customFoods.some(function (c) {
        if (it.barcode && c.barcode) return it.barcode === c.barcode;
        return c.name === it.name && Math.round(c.per100.kcal) === Math.round(it.per100.kcal);
      });
      if (dup) { skipped++; return; }
      state.customFoods.push({
        id: uid(),
        name: it.name,
        brand: it.brand,
        per100: it.per100,
        portion: it.portion,
        unit: it.unit,
        barcode: it.barcode
      });
      added++;
    });
    if (added) persist();
    return { added: added, skipped: skipped, total: items.length };
  }

  function exportFoodPack() {
    if (!state.customFoods.length) { U.toast('食物库还是空的'); return; }
    downloadJSON(buildFoodPack(), 'qingka-foods-' + Store.dateKey() + '.json');
    U.toast('已导出 ' + state.customFoods.length + ' 项食物');
  }

  function importFoodPack(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(String(reader.result));
        var r = mergeFoodPack(data);
        if (r.added) U.toast('已导入 ' + r.added + ' 项食物' + (r.skipped ? '，跳过 ' + r.skipped + ' 项重复' : ''));
        else if (r.skipped) U.toast('这些食物已经在库里了');
        else U.toast('文件里没有可导入的食物');
        showFoodLibrary();
        render();
      } catch (e) {
        U.toast('文件格式不正确');
      }
    };
    reader.readAsText(file);
  }

  function downloadJSON(data, filename) {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* ---------------- 事件绑定 ---------------- */

  var ACTIONS = {
    'go': function (el) { go(el.getAttribute('data-tab')); },
    'close-sheet': function () { window.Scanner.stop(); U.closeSheet(); },
    'open-add': function (el) { openAdd(el.getAttribute('data-meal') || mealForNow()); },
    'add-tab': function (el) { switchAddTab(el.getAttribute('data-tab')); },
    'cat': function (el) {
      App.search.cat = el.getAttribute('data-cat');
      U.$$('#add-body .chips .chip').forEach(function (b) {
        b.classList.toggle('on', b.getAttribute('data-cat') === App.search.cat);
      });
      renderResults();
    },
    'pick-food': function (el) { pickFood(el.getAttribute('data-kind'), el.getAttribute('data-id')); },
    'add-back': function () { openAdd(App.addMeal, true); },
    'gram-chip': function (el) {
      if (!App.portion) return;
      var g = Number(el.getAttribute('data-g'));
      App.portion.grams = g;
      var input = document.getElementById('grams');
      if (input) input.value = g;
      updateLive();
      var chips = document.getElementById('gram-chips');
      if (chips) U.$$('.chip', chips).forEach(function (c) { c.classList.toggle('on', Number(c.getAttribute('data-g')) === g); });
    },
    'pick-meal': function (el) {
      if (!App.portion) return;
      App.portion.meal = el.getAttribute('data-meal');
      var seg = document.getElementById('meal-seg');
      if (seg) U.$$('.seg-btn', seg).forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-meal') === App.portion.meal); });
    },
    'confirm-portion': function () { confirmPortion(); },
    'ai-settings': function () {
      openAISettings({ returnToAI: !!document.getElementById('add-body') });
    },
    'ai-save': function () { saveAISettings(); },
    'ai-test': function () { testAIKey(); },
    'ai-clear': function () { clearAIKey(); },
    'ai-pick': function () {
      var input = document.getElementById('ai-photo-input');
      if (input) input.click();
    },
    'ai-run': function () { runAIRecognize(); },
    'ai-del': function (el) {
      var idx = Number(el.getAttribute('data-idx'));
      if (!App.ai.items[idx]) return;
      App.ai.items.splice(idx, 1);
      renderAIReview();
      if (!App.ai.items.length) {
        var run = document.getElementById('ai-run');
        if (run) run.textContent = '开始识别';
      }
    },
    'ai-meal': function (el) {
      App.ai.meal = el.getAttribute('data-meal');
      var seg = document.getElementById('ai-meal');
      if (seg) U.$$('.seg-btn', seg).forEach(function (b) {
        b.classList.toggle('on', b.getAttribute('data-meal') === App.ai.meal);
      });
    },
    'ai-add': function () { addAIEntries(); },
    'delete-entry': function () {
      var s = App.portion;
      if (!s || s.mode !== 'edit') return;
      var id = s.id;
      var date = s.date;
      U.confirm({ title: '删除这条记录？', text: '删除后无法恢复。', ok: '删除', danger: true }).then(function (ok) {
        if (!ok) { openEntry(id); return; }
        var list = state.logs[date] || [];
        state.logs[date] = list.filter(function (e) { return e.id !== id; });
        persist();
        App.portion = null;
        U.toast('已删除');
        render();
      });
    },
    'edit-entry': function (el) { openEntry(el.getAttribute('data-id')); },
    'day-prev': function () {
      App.date = shiftDate(App.date, -1);
      render();
    },
    'day-next': function () {
      if (isToday(App.date)) return;
      App.date = shiftDate(App.date, 1);
      render();
    },
    'day-today': function () {
      App.date = Store.dateKey();
      render();
    },
    'day-pick': function (el) {
      App.date = el.getAttribute('data-date');
      render();
    },
    'scan-toggle': function () {
      var v = document.getElementById('scan-video');
      if (v) v.style.display = '';
      startScan();
    },
    'scan-photo': function () {
      window.Scanner.stop();
      var input = document.getElementById('scan-photo-input');
      if (input) input.click();
    },
    'manual-barcode': function (el) {
      App.manualBarcode = el.getAttribute('data-code') || '';
      App.addTab = 'manual';
      U.$$('.seg-tabs [data-act="add-tab"]').forEach(function (b) {
        b.classList.toggle('on', b.getAttribute('data-tab') === 'manual');
      });
      var body = document.getElementById('add-body');
      if (body) body.innerHTML = manualBodyHTML();
    },
    'manage-foods': function () { showFoodLibrary(); },
    'export-foods': function () { exportFoodPack(); },
    'import-foods': function () {
      var input = document.getElementById('food-pack-input');
      if (input) input.click();
    },
    'del-custom': function (el) {
      var id = el.getAttribute('data-id');
      state.customFoods = state.customFoods.filter(function (c) { return c.id !== id; });
      persist();
      showFoodLibrary();
      U.toast('已删除');
    },
    'del-weight': function (el) { delWeight(el.getAttribute('data-date')); },
    'export': function () { exportData(); },
    'import': function () {
      var input = document.getElementById('import-file');
      if (input) input.click();
    },
    'reset': function () {
      U.confirm({
        title: '清空全部数据？',
        text: '个人资料、饮食记录、体重和自定义食物都会被删除，且无法恢复。建议先导出备份。',
        ok: '全部清空',
        danger: true
      }).then(function (ok) {
        if (!ok) return;
        Store.reset();
        state = Store.empty();
        App.tab = 'home';
        App.date = Store.dateKey();
        location.hash = '#/home';
        renderOnboarding();
        U.toast('已清空');
      });
    }
  };

  function onClick(e) {
    var el = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!el) return;
    var act = el.getAttribute('data-act');
    if (!ACTIONS[act]) return;
    e.preventDefault();
    ACTIONS[act](el);
  }

  function onSubmit(e) {
    var form = e.target.closest ? e.target.closest('form[data-form]') : null;
    if (!form) return;
    e.preventDefault();
    var kind = form.getAttribute('data-form');
    if (kind === 'settings' || kind === 'onboard') saveProfile(form, kind);
    else if (kind === 'weight') saveWeight(form);
    else if (kind === 'manual') saveManual(form);
    else if (kind === 'barcode') {
      var input = form.querySelector('[name="code"]');
      var code = input ? input.value : '';
      if (String(code).trim().length < 6) { U.toast('请输入完整的条码'); return; }
      lookupCode(code);
    }
  }

  function onInput(e) {
    var t = e.target;
    if (!t) return;
    if (t.id === 'food-search') {
      App.search.q = t.value.trim();
      renderResults();
      return;
    }
    if (t.classList && t.classList.contains('ai-grams-input')) {
      var gIdx = Number(t.getAttribute('data-idx'));
      var gItem = App.ai.items[gIdx];
      if (!gItem || t.value === '') return;
      var grams = U.clamp(t.value, 1, 3000);
      gItem.grams = grams;
      var scaled = N.scale(gItem.per100, grams);
      var row = t.closest('.ai-item');
      if (row) {
        var kcalEl = row.querySelector('[data-kcal="' + gIdx + '"]');
        if (kcalEl) kcalEl.innerHTML = U.fmt(scaled.kcal) + '<span>kcal</span>';
        var carbEl = row.querySelector('[data-carb="' + gIdx + '"]');
        if (carbEl) carbEl.textContent = U.fmt(scaled.carb, 1);
        var proEl = row.querySelector('[data-protein="' + gIdx + '"]');
        if (proEl) proEl.textContent = U.fmt(scaled.protein, 1);
        var fatEl = row.querySelector('[data-fat="' + gIdx + '"]');
        if (fatEl) fatEl.textContent = U.fmt(scaled.fat, 1);
      }
      updateAITotal();
      return;
    }
    if (t.classList && t.classList.contains('ai-name')) {
      var nIdx = Number(t.getAttribute('data-idx'));
      if (App.ai.items[nIdx]) App.ai.items[nIdx].name = String(t.value).slice(0, 30);
      return;
    }
    if (t.id === 'grams') { updateLive(); return; }
    if (t.closest && t.closest('#manual-form')) { updateManualLive(); return; }
    if (t.closest && t.closest('.profile-form')) updatePreview(t.closest('.profile-form'));
  }

  function onChange(e) {
    var t = e.target;
    if (t.id === 'food-pack-input') {
      var packFile = t.files && t.files[0];
      t.value = '';
      if (packFile) importFoodPack(packFile);
      return;
    }
    if (t.id === 'ai-photo-input') {
      var aiFile = t.files && t.files[0];
      t.value = '';
      if (aiFile) handleAIPhoto(aiFile);
      return;
    }
    if (t.id === 'scan-photo-input') {
      var file = t.files && t.files[0];
      t.value = '';
      if (!file) return;
      setScanMask('正在识别照片中的条码…', true);
      window.Scanner.decodeImageFile(file).then(function (code) {
        lookupCode(code);
      }).catch(function () {
        setScanMask('没有识别到条码，请靠近一点重拍，或手动输入', true);
        U.toast('没有识别到条码');
      });
      return;
    }
    if (t.id === 'import-file') {
      importData(t.files && t.files[0]);
      t.value = '';
      return;
    }
    if (t.closest && t.closest('.profile-form')) {
      var form = t.closest('.profile-form');
      if (t.name === 'goal') syncGoalFields(form);
      updatePreview(form);
    }
  }

  function syncGoalFields(form) {
    var goal = form.querySelector('input[name="goal"]:checked');
    var isMaintain = goal && goal.value === 'maintain';
    U.$$('.only-goal', form).forEach(function (el) { el.style.display = isMaintain ? 'none' : ''; });
  }

  /* ---------------- 启动 ---------------- */

  function applyDemo() {
    var params = new URLSearchParams(location.search);
    if (params.get('demo') !== '1') return;
    App.demo = true;
    state.profile = {
      sex: 'male', age: 29, height: 178, weight: 74, activity: 1.375,
      goal: 'lose', targetWeight: 68, rate: 0.5, proteinPerKg: 1.6, fatPct: 0.25,
      startWeight: 76
    };
    var today = Store.dateKey();
    function demoEntry(name, grams, per100, meal, unit) {
      var sc = N.scale(per100, grams);
      return {
        id: uid(), name: name, grams: grams, unit: unit || 'g', meal: meal, per100: per100,
        kcal: sc.kcal, carb: sc.carb, protein: sc.protein, fat: sc.fat, at: Date.now()
      };
    }
    state.logs[today] = [
      demoEntry('燕麦片（干）', 60, { kcal: 377, carb: 66, protein: 13, fat: 6.7 }, 'breakfast'),
      demoEntry('全脂牛奶', 250, { kcal: 65, carb: 4.9, protein: 3.3, fat: 3.6 }, 'breakfast', 'ml'),
      demoEntry('鸡胸肉（熟）', 150, { kcal: 165, carb: 0, protein: 31, fat: 3.6 }, 'lunch'),
      demoEntry('米饭（熟）', 150, { kcal: 116, carb: 25.9, protein: 2.6, fat: 0.3 }, 'lunch'),
      demoEntry('西兰花', 150, { kcal: 34, carb: 6.6, protein: 2.8, fat: 0.4 }, 'lunch'),
      demoEntry('苹果', 200, { kcal: 52, carb: 13.8, protein: 0.3, fat: 0.2 }, 'snack')
    ];
    state.weights = [
      { date: today, kg: 74 },
      { date: shiftDate(today, -6), kg: 74.8 },
      { date: shiftDate(today, -13), kg: 75.5 }
    ];
  }

  function boot() {
    var hashTab = currentTabFromHash();
    App.tab = hashTab || 'home';
    applyDemo();
    applyDateParam();

    if (window.RegSW) window.RegSW();

    document.addEventListener('click', onClick);
    document.addEventListener('submit', onSubmit);
    document.addEventListener('input', onInput);
    document.addEventListener('change', onChange);
    window.addEventListener('hashchange', function () {
      U.closeSheet();
      window.Scanner.stop();
      var tab = currentTabFromHash() || 'home';
      if (!state.profile) { renderOnboarding(); return; }
      if (tab === App.tab) { render(); return; }
      App.tab = tab;
      window.scrollTo(0, 0);
      render();
    });

    render();

    var params = new URLSearchParams(location.search);
    if (params.get('open') === 'add' && state.profile) {
      setTimeout(function () { openAdd('lunch'); }, 250);
    }
  }

  function applyDateParam() {
    var d = new URLSearchParams(location.search).get('date');
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) App.date = d;
  }

  window.QK = {
    state: function () { return state; },
    render: render,
    openAdd: openAdd,
    buildFoodPack: buildFoodPack,
    mergeFoodPack: mergeFoodPack,
    showAIReview: function (items, note) {
      App.ai.items = items || [];
      App.ai.note = note || '';
      App.ai.meal = App.ai.meal || mealForNow();
      renderAIReview();
    }
  };

  boot();
})();
