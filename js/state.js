/* 轻卡 · 本地数据存储（localStorage，无服务器） */
(function (root) {
  'use strict';

  var KEY = 'qingka.state.v1';

  function pad(n) { return String(n).padStart(2, '0'); }

  /** 本地时区的 YYYY-MM-DD */
  function dateKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  /** YYYY-MM-DD -> 本地 Date（避免 UTC 偏移） */
  function parseKey(k) {
    var p = String(k).split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function empty() {
    return {
      version: 1,
      profile: null,
      logs: {},
      weights: [],
      customFoods: []
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return empty();
      var s = JSON.parse(raw);
      var base = empty();
      return {
        version: 1,
        profile: s.profile || null,
        logs: s.logs && typeof s.logs === 'object' ? s.logs : {},
        weights: Array.isArray(s.weights) ? s.weights : [],
        customFoods: Array.isArray(s.customFoods) ? s.customFoods : []
      };
    } catch (e) {
      return empty();
    }
  }

  function save(s) {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
      return true;
    } catch (e) {
      return false;
    }
  }

  function reset() {
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  }

  root.Store = {
    KEY: KEY,
    dateKey: dateKey,
    parseKey: parseKey,
    empty: empty,
    load: load,
    save: save,
    reset: reset
  };
})(typeof self !== 'undefined' ? self : this);
