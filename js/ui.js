/* 轻卡 · 通用 UI 工具 */
(function (root) {
  'use strict';

  var ICONS = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5.5h4V20"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6.5h12M8 12h12M8 17.5h12"/><circle cx="4" cy="6.5" r="1.2" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="4" cy="17.5" r="1.2" fill="currentColor" stroke="none"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.6"/><path d="M4.8 20c.6-3.6 3.6-5.6 7.2-5.6s6.6 2 7.2 5.6"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 5 8 12l6.5 7"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="6.6"/><path d="m16 16 4 4"/></svg>',
    scan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8.5V6a2 2 0 0 1 2-2h2.5M15.5 4H18a2 2 0 0 1 2 2v2.5M20 15.5V18a2 2 0 0 1-2 2h-2.5M8.5 20H6a2 2 0 0 1-2-2v-2.5"/><path d="M4 12h16"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 5.5 18.5 9.5 9 19H5v-4z"/><path d="m12.5 7.5 4 4"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13"/><path d="M10.5 11v5M13.5 11v5"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 5 7 7-7 7"/></svg>',
    scale: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4.5" width="16" height="15" rx="3"/><path d="M8 10.5a4 4 0 0 1 8 0"/><path d="m12 10.5 2-1.5"/></svg>',
    spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5c.6 3.6 2.9 5.9 6.5 6.5-3.6.6-5.9 2.9-6.5 6.5-.6-3.6-2.9-5.9-6.5-6.5 3.6-.6 5.9-2.9 6.5-6.5Z"/><path d="M18.5 16.5c.3 1.6 1.4 2.7 3 3-1.6.3-2.7 1.4-3 3-.3-1.6-1.4-2.7-3-3 1.6-.3 2.7-1.4 3-3Z"/></svg>',
    flame: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3s5 4.2 5 9a5 5 0 0 1-10 0c0-2 1-3.4 1-3.4S8 11 10 11c0-3 2-6 2-8Z"/></svg>'
  };

  function $(sel, el) { return (el || document).querySelector(sel); }
  function $$(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmt(n, digits) {
    var v = Number(n);
    if (!isFinite(v)) v = 0;
    return v.toLocaleString('zh-CN', {
      minimumFractionDigits: digits || 0,
      maximumFractionDigits: digits || 0
    });
  }

  function clamp(n, min, max) {
    n = Number(n);
    if (!isFinite(n)) n = min;
    return Math.min(max, Math.max(min, n));
  }

  var toastTimer = null;
  function toast(msg) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2000);
  }

  function openSheet(html, className) {
    var old = document.getElementById('sheet');
    if (!old || !old.parentNode) return;
    // 替换节点可顺带清理上一次弹层上绑定的事件，避免旧回调理被误触发
    var sheet = old.cloneNode(false);
    old.parentNode.replaceChild(sheet, old);
    sheet.innerHTML =
      '<div class="sheet-backdrop" data-act="close-sheet"></div>' +
      '<div class="sheet-panel ' + (className || '') + '" role="dialog" aria-modal="true">' +
      html +
      '</div>';
    document.body.classList.add('sheet-open');
    var panel = sheet.querySelector('.sheet-panel');
    if (panel) panel.scrollTop = 0;
  }

  function closeSheet() {
    var sheet = document.getElementById('sheet');
    if (sheet) sheet.innerHTML = '';
    document.body.classList.remove('sheet-open');
  }

  /** 底部确认框，返回 Promise<boolean> */
  function confirmDialog(opts) {
    return new Promise(function (resolve) {
      var title = (opts && opts.title) || '确认';
      var text = (opts && opts.text) || '';
      var ok = (opts && opts.ok) || '确定';
      var cancel = (opts && opts.cancel) || '取消';
      var danger = opts && opts.danger;
      openSheet(
        '<div class="sheet-head"><div class="sheet-title">' + esc(title) + '</div></div>' +
        '<p class="confirm-text">' + esc(text) + '</p>' +
        '<div class="btn-row">' +
        '<button class="btn ghost" data-confirm="0">' + esc(cancel) + '</button>' +
        '<button class="btn ' + (danger ? 'danger' : 'primary') + '" data-confirm="1">' + esc(ok) + '</button>' +
        '</div>',
        'sheet-small'
      );
      var sheet = document.getElementById('sheet');
      function onClick(e) {
        var b = e.target.closest('[data-confirm]');
        if (!b) return;
        sheet.removeEventListener('click', onClick);
        var val = b.getAttribute('data-confirm') === '1';
        closeSheet();
        resolve(val);
      }
      sheet.addEventListener('click', onClick);
    });
  }

  root.UI = {
    ICONS: ICONS,
    $: $,
    $$: $$,
    esc: esc,
    fmt: fmt,
    clamp: clamp,
    toast: toast,
    openSheet: openSheet,
    closeSheet: closeSheet,
    confirm: confirmDialog
  };
})(typeof self !== 'undefined' ? self : this);
