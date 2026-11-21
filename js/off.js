/* 轻卡 · Open Food Facts 条码查询（免费、无需 API Key）
 * https://world.openfoodfacts.org
 * 返回每 100g/100ml 的热量与三大营养素，查不到返回 null。
 */
(function (root) {
  'use strict';

  var FIELDS = [
    'code', 'product_name', 'product_name_zh', 'brands',
    'nutriments', 'serving_size', 'serving_quantity', 'quantity',
    'image_front_small_url', 'countries_tags'
  ].join(',');

  function n(v) {
    var x = Number(v);
    return isFinite(x) ? x : 0;
  }

  function r1(v) { return Math.round(n(v) * 10) / 10; }

  function per100From(nut) {
    var kcal = n(nut['energy-kcal_100g']);
    if (!kcal && n(nut['energy-kj_100g'])) kcal = n(nut['energy-kj_100g']) / 4.184;
    if (!kcal && n(nut.energy_100g)) kcal = n(nut.energy_100g) / 4.184;

    var carb = n(nut.carbohydrates_100g);
    var protein = n(nut.proteins_100g);
    var fat = n(nut.fat_100g);

    // 部分产品只标了「每份」，按 serving_quantity 换算成每 100g
    if (!kcal && n(nut['energy-kcal_serving'])) {
      var sq = n(nut.__serving_quantity);
      if (sq > 0) {
        var f = 100 / sq;
        kcal = n(nut['energy-kcal_serving']) * f;
        carb = n(nut.carbohydrates_serving) * f;
        protein = n(nut.proteins_serving) * f;
        fat = n(nut.fat_serving) * f;
      }
    }
    return { kcal: Math.round(kcal), carb: r1(carb), protein: r1(protein), fat: r1(fat) };
  }

  function normalizeCode(code) {
    return String(code || '').replace(/[^0-9A-Za-z]/g, '');
  }

  function mapProduct(p, code) {
    var nut = p.nutriments || {};
    nut.__serving_quantity = p.serving_quantity;
    var per100 = per100From(nut);
    if (!per100.kcal && !per100.carb && !per100.protein && !per100.fat) return null;

    var name = (p.product_name_zh || p.product_name || '').trim();
    if (!name) name = '未命名食品';
    var brand = String(p.brands || '').split(',')[0].trim();

    var servingGrams = n(p.serving_quantity);
    var portion = null;
    if (servingGrams > 0 && servingGrams <= 5000) {
      var label = String(p.serving_size || '').trim().slice(0, 20);
      portion = { label: label || '1 份', grams: Math.round(servingGrams) };
    }

    return {
      name: name,
      brand: brand,
      barcode: code,
      unit: /ml|cl|l\b/i.test(p.quantity || '') ? 'ml' : 'g',
      per100: per100,
      portion: portion,
      image: p.image_front_small_url || '',
      source: 'Open Food Facts'
    };
  }

  async function fetchProduct(code) {
    var c = normalizeCode(code);
    if (!c) return null;
    var url = 'https://world.openfoodfacts.org/api/v2/product/' + encodeURIComponent(c) + '.json?fields=' + FIELDS;
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 9000) : null;
    try {
      var res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: ctrl ? ctrl.signal : undefined
      });
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error('HTTP ' + res.status);
      }
      var data = await res.json();
      if (!data || data.status !== 1 || !data.product) return null;
      return mapProduct(data.product, c);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  root.OFF = {
    lookup: fetchProduct
  };
})(typeof self !== 'undefined' ? self : this);
