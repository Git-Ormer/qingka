/* 轻卡 · 注册 Service Worker（离线可用） */
(function (root) {
  'use strict';

  root.RegSW = function () {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
    // 开发/截图时可用 ?nosw=1 跳过缓存，避免看到旧版本
    try {
      if (new URLSearchParams(location.search).get('nosw') === '1') return;
    } catch (e) { /* ignore */ }
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {
        /* 本地直接打开或非安全上下文时忽略 */
      });
    });
  };
})(typeof self !== 'undefined' ? self : this);
