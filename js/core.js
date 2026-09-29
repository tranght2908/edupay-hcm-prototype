/* EduPay HCM prototype core: router, shell, data store, UI helpers.
   Screens register with App.route(); see README.md for the contract. */
(function () {
  'use strict';

  // ---------- helpers ----------
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => (n == null || n === '' || isNaN(n) ? '' : Math.round(Number(n)).toLocaleString('vi-VN').replace(/,/g, '.'));
  const parseMoney = (s) => Number(String(s || '').replace(/[^\d-]/g, '')) || 0;
  const uid = (p) => (p || 'id') + '_' + Math.random().toString(36).slice(2, 9);
  const pad = (n) => String(n).padStart(2, '0');
  const fmtDate = (d) => { if (!d) return ''; const x = d instanceof Date ? d : new Date(d); return pad(x.getDate()) + '/' + pad(x.getMonth() + 1) + '/' + x.getFullYear(); };
  const toISO = (vn) => { if (!vn) return ''; const m = String(vn).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); return m ? m[3] + '-' + pad(m[2]) + '-' + pad(m[1]) : vn; };
  const fromISO = (iso) => { if (!iso) return ''; const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + m[1] : iso; };
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function icon(name, cls) {
    const body = (window.VAADIN_ICONS || {})[name];
    if (!body) return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 16 16"></svg>';
    return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 16 16" aria-hidden="true">' + body + '</svg>';
  }

  // ---------- data store ----------
  const STORE_KEY = 'edupay-proto-v1';
  const data = {};
  const seeds = {};
  function seed(key, value) { seeds[key] = value; if (!(key in data)) data[key] = typeof value === 'function' ? value() : value; return data[key]; }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) { /* storage unavailable */ } }
  function loadSaved() {
    try { const raw = localStorage.getItem(STORE_KEY); if (raw) Object.assign(data, JSON.parse(raw)); } catch (e) { /* ignore */ }
  }
  function resetData() {
    try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
    Object.keys(data).forEach((k) => delete data[k]);
    Object.keys(seeds).forEach((k) => { const v = seeds[k]; data[k] = typeof v === 'function' ? v() : JSON.parse(JSON.stringify(v)); });
  }

  // ---------- routing ----------
  const routes = [];
  const frames = []; // Figma frame index for the screen picker
  function route(pattern, def) {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/\/:([\w]+)/g, (_, k) => { keys.push(k); return '/([^/]+)'; }) + '/?$');
    routes.push(Object.assign({ pattern, re, keys }, def));
  }
  function frame(code, name, path, group) { frames.push({ code, name, path, group }); }
  function parseHash() {
    const h = decodeURIComponent(location.hash.replace(/^#/, '')) || '/';
    const [path, qs] = h.split('?');
    const query = {};
    (qs || '').split('&').filter(Boolean).forEach((p) => { const [k, v] = p.split('='); query[k] = decodeURIComponent(v || ''); });
    return { path: path.startsWith('/') ? path : '/' + path, query };
  }
  function go(path) { if (location.hash === '#' + path) render(); else location.hash = path; }
  function back(fallback) { if (history.length > 1) history.back(); else go(fallback || '/'); }

  // ---------- menu ----------
  const MENU = [
    { id: 'nam-hoc-lop', label: 'Năm học và lớp học', icon: 'calendar', items: [
      { id: 'nam-hoc', label: 'Năm học', icon: 'calendar', path: '/nam-hoc' },
      { id: 'khoi-lop', label: 'Khối và lớp học', icon: 'office', path: '/khoi-lop' },
      { id: 'hoc-sinh', label: 'Danh sách học sinh', icon: 'users', path: '/hoc-sinh' },
    ] },
    { id: 'dung-chung', label: 'Danh mục dùng chung', icon: 'list', items: [
      { id: 'he-dao-tao', label: 'Hệ đào tạo', icon: 'academy-cap', path: '/he-dao-tao' },
      { id: 'dien-uu-tien', label: 'Diện ưu tiên', icon: 'star', path: '/dien-uu-tien' },
      { id: 'don-vi-tinh', label: 'Đơn vị tính', icon: 'calc', path: '/don-vi-tinh' },
    ] },
    { id: 'thu-phi', label: 'Quản lý thu phí', icon: 'list', items: [
      { id: 'khoan-thu', label: 'Danh sách khoản thu', icon: 'list', path: '/khoan-thu' },
      { id: 'dang-ky', label: 'Đăng ký khoản thu', icon: 'calc', path: '/dang-ky-khoan-thu' },
      { id: 'chinh-sach-gia', label: 'Chính sách giá', icon: 'star', path: '/chinh-sach-gia' },
      { id: 'mien-giam', label: 'Miễn giảm', icon: 'building', path: '/mien-giam' },
      { id: 'dot-thu', label: 'Đợt thu', icon: 'calendar', path: '/dot-thu' },
      { id: 'thu-tien', label: 'Thu tiền', icon: 'money', path: '/thu-tien' },
      { id: 'phieu-thu', label: 'Phiếu thu', icon: 'file-text-o', path: '/phieu-thu' },
      { id: 'bao-cao', label: 'Báo cáo thu', icon: 'bar-chart', path: '/bao-cao' },
    ] },
    { id: 'phu-huynh', label: 'Cổng phụ huynh', icon: 'family', items: [
      { id: 'ph-hoc-phi', label: 'Học phí của con', icon: 'child', path: '/phu-huynh' },
      { id: 'ph-lich-su', label: 'Lịch sử nộp tiền', icon: 'clock', path: '/phu-huynh/lich-su' },
    ] },
    { id: 'quan-tri', label: 'Quản trị hệ thống', icon: 'cog', items: [
      { id: 'nguoi-dung', label: 'Người dùng', icon: 'users', path: '/nguoi-dung' },
      { id: 'phan-quyen', label: 'Phân quyền', icon: 'shield', path: '/phan-quyen' },
      { id: 'da-don-vi', label: 'Đa đơn vị', icon: 'building', path: '/da-don-vi' },
      { id: 'cong-cu', label: 'Công cụ dữ liệu', icon: 'database', path: '/cong-cu-du-lieu' },
    ] },
  ];
  const collapsed = (() => { try { return JSON.parse(localStorage.getItem('edupay-nav') || '{}'); } catch (e) { return {}; } })();

  // ---------- session & permissions ----------
  // Roles live in data.roles: {id, name, perms: {menuItemId: 'full' | 'view'}}; users in data.users: {id, username, name, roleId, ...}.
  const SESSION_KEY = 'edupay-session';
  let sessionUserId = (() => { try { return localStorage.getItem(SESSION_KEY) || ''; } catch (e) { return ''; } })();
  function user() { return (data.users || []).find((u) => u.id === sessionUserId && u.active !== false) || null; }
  function role(u) { const x = u || user(); return x ? (data.roles || []).find((r) => r.id === x.roleId) || null : null; }
  function perm(menuId, r) { const x = r || role(); return x && x.perms ? x.perms[menuId] || '' : ''; }
  // can('thu-tien') → may open; can('thu-tien', 'full') → may create/edit/delete.
  function can(menuId, level, r) { const p = perm(menuId, r); return level === 'full' ? p === 'full' : !!p; }
  function login(userId) {
    sessionUserId = userId || '';
    try { if (userId) localStorage.setItem(SESSION_KEY, userId); else localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
    refreshHeader();
  }
  const initials = (name) => { const p = String(name || '').trim().split(/\s+/); return (p.length > 2 ? p[0][0] + p[p.length - 2][0] + p[p.length - 1][0] : p.map((x) => x[0]).join('') || '?').toUpperCase(); };

  function renderNav(active) {
    return MENU.map((g) => {
      const items = g.items.filter((i) => can(i.id));
      if (!items.length) return '';
      const isCol = collapsed[g.id] && !items.some((i) => i.id === active);
      return '<div class="nav-group' + (isCol ? ' collapsed' : '') + '" data-group="' + g.id + '">' +
        '<button class="nav-group-head" type="button" data-toggle-group="' + g.id + '">' + icon(g.icon) + '<span class="lbl">' + esc(g.label) + '</span>' + icon('angle-down', 'chev') + '</button>' +
        '<div class="nav-items">' + items.map((i) => '<a class="nav-item' + (i.id === active ? ' active' : '') + '" href="#' + i.path + '">' + icon(i.icon) + '<span>' + esc(i.label) + '</span>' + (perm(i.id) === 'view' ? '<span class="nav-ro" title="Chỉ xem">' + icon('eye') + '</span>' : '') + '</a>').join('') + '</div></div>';
    }).join('');
  }

  // ---------- shell ----------
  let appEl, mainEl, navEl;
  function mountShell() {
    document.body.innerHTML =
      '<div class="app" id="app">' +
      '<header class="app-header">' +
      '<button class="hdr-menu-toggle" type="button" id="navToggle" aria-label="Mở menu">' + icon('menu') + '</button>' +
      '<a class="app-logo" href="#/" aria-label="Trang chủ">' + icon('academy-cap') + '</a>' +
      '<div class="app-title">HỆ THỐNG THU PHÍ - ' + esc(data.school ? data.school.name : '') + '</div>' +
      '<label class="app-year" id="yearWrap" title="Năm học đang làm việc"><select id="yearSel" aria-label="Năm học"></select>' + icon('angle-down') + '</label>' +
      '<button class="hdr-btn" type="button" id="cogBtn" aria-label="Công cụ prototype">' + icon('cog') + '</button>' +
      '<button class="hdr-btn hdr-user" type="button" id="userBtn"><span class="hdr-avatar" id="userAvatar"></span><span class="name" id="userName"></span></button>' +
      '</header>' +
      '<nav class="app-sidebar" id="sidebar"><div class="nav" id="nav"></div><div class="nav-status">Online</div></nav>' +
      '<main class="app-main" id="main"></main>' +
      '</div><div class="toasts" id="toasts"></div>';
    appEl = $('#app'); mainEl = $('#main'); navEl = $('#nav');
    fillYearSelect(); refreshHeader();
    $('#yearSel').addEventListener('change', (e) => { data.currentYearId = e.target.value; save(); render(); toast('Đã chuyển sang năm học ' + currentYear().name); });
    $('#navToggle').addEventListener('click', () => appEl.classList.toggle('nav-open'));
    navEl.addEventListener('click', (e) => {
      const t = e.target.closest('[data-toggle-group]');
      if (t) {
        const id = t.dataset.toggleGroup; const g = t.parentElement;
        g.classList.toggle('collapsed'); collapsed[id] = g.classList.contains('collapsed');
        try { localStorage.setItem('edupay-nav', JSON.stringify(collapsed)); } catch (err) { /* ignore */ }
      } else if (e.target.closest('.nav-item')) appEl.classList.remove('nav-open');
    });
    $('#cogBtn').addEventListener('click', (e) => menu(e.currentTarget, [
      { label: 'Danh sách màn hình (Figma)', icon: 'list', onClick: screenIndex },
      { label: 'Đổi vai trò demo', icon: 'user-card', onClick: switchUserDlg },
      '-',
      { label: 'Khôi phục dữ liệu mẫu', icon: 'refresh', onClick: resetPrompt },
    ]));
    $('#userBtn').addEventListener('click', (e) => { const u = user(); if (!u) return; menu(e.currentTarget, [
      { label: u.name + ' · ' + (role() || {}).name, icon: 'user', onClick: () => {} },
      { label: 'Đổi tài khoản', icon: 'user-card', onClick: switchUserDlg },
      { label: 'Đăng xuất', icon: 'sign-out', onClick: () => { login(''); render(); } },
    ]); });
  }
  async function resetPrompt() {
    if (await confirmDlg({ title: 'Khôi phục dữ liệu mẫu', message: 'Mọi thay đổi bạn đã làm trong prototype sẽ bị xóa và dữ liệu quay về trạng thái ban đầu.', okLabel: 'Khôi phục', danger: true })) {
      resetData(); fillYearSelect(); refreshHeader(); render(); toast('Đã khôi phục dữ liệu mẫu', 'success');
    }
  }
  function refreshHeader() {
    const u = user(); if (!$('#userName')) return;
    $('#userName').textContent = u ? u.name : '';
    $('#userAvatar').textContent = u ? initials(u.name) : '';
    const r = role();
    $('#yearWrap').hidden = !u || !!(r && r.noYear);
    $('#userBtn').hidden = !u;
    appEl.classList.toggle('logged-out', !u);
  }
  function fillYearSelect() {
    const sel = $('#yearSel'); if (!sel) return;
    sel.innerHTML = (data.years || []).map((y) => '<option value="' + y.id + '"' + (y.id === data.currentYearId ? ' selected' : '') + '>Năm học ' + esc(y.name.replace('-', '–')) + '</option>').join('');
  }
  function currentYear() { return (data.years || []).find((y) => y.id === data.currentYearId) || (data.years || [])[0]; }

  function demoUsers() {
    return (data.roles || []).map((r) => (data.users || []).find((u) => u.roleId === r.id && u.active !== false && u.demo)).filter(Boolean);
  }
  function userCard(u) {
    const r = role(u) || {};
    return '<button type="button" class="login-user" data-login="' + esc(u.id) + '"><span class="hdr-avatar lg">' + esc(initials(u.name)) + '</span>' +
      '<span class="lu-text"><b>' + esc(r.name) + '</b><span>' + esc(u.name) + ' · ' + esc(u.username) + '</span><em>' + esc(r.desc || '') + '</em></span>' + icon('angle-right') + '</button>';
  }
  function afterLogin() { const r = role(); toast('Đã đăng nhập: ' + user().name + ' (' + r.name + ')', 'success'); }
  function switchUserDlg() {
    dialog({ title: 'Đổi vai trò demo', width: '600px', footer: false,
      body: '<p class="muted" style="margin:0 0 12px">Chọn một tài khoản để xem hệ thống theo quyền của vai trò đó.</p><div class="login-users">' + demoUsers().map(userCard).join('') + '</div>',
      onMount: (d, close) => d.addEventListener('click', (e) => {
        const b = e.target.closest('[data-login]'); if (!b) return; close(); login(b.dataset.login); afterLogin();
        const p = parseHash().path; if (p === '/' || !canOpenPath(p)) go(role().home || '/'); else render();
      }) });
  }
  function renderLogin(view) {
    view.className = 'login-page';
    view.innerHTML = '<div class="login-card">' +
      '<div class="login-brand"><span class="app-logo">' + icon('academy-cap') + '</span><div><b>EduPay</b><span>Hệ thống thu phí · ' + esc(data.school ? data.school.name : '') + '</span></div></div>' +
      '<form id="loginForm" class="stack" autocomplete="off">' +
      field({ id: 'lgUser', name: 'username', label: 'Tên đăng nhập', placeholder: 'VD: ketoan' }) +
      field({ id: 'lgPass', name: 'password', label: 'Mật khẩu', placeholder: 'Mật khẩu demo: 123456', inputType: 'password' }) +
      btn({ label: 'Đăng nhập', icon: 'sign-in', variant: 'primary', type: 'submit', cls: 'login-submit' }) + '</form>' +
      '<div class="login-sep"><span>Hoặc chọn nhanh tài khoản demo</span></div>' +
      '<div class="login-users">' + demoUsers().map(userCard).join('') + '</div></div>';
    const target = parseHash().path;
    const done = () => { afterLogin(); if (target === '/' || !canOpenPath(target)) go(role().home || '/'); else render(); };
    view.addEventListener('click', (e) => { const b = e.target.closest('[data-login]'); if (b) { login(b.dataset.login); done(); } });
    $('#loginForm', view).addEventListener('submit', (e) => {
      e.preventDefault();
      const name = $('#lgUser', view).value.trim().toLowerCase();
      const u = (data.users || []).find((x) => x.username.toLowerCase() === name && x.active !== false);
      if (!u || $('#lgPass', view).value !== '123456') { toast('Sai tên đăng nhập hoặc mật khẩu. Mật khẩu demo là 123456.', 'danger'); return; }
      login(u.id); done();
    });
  }
  function matchRoute(path) {
    for (const x of routes) { const m = path.match(x.re); if (m) { const params = {}; x.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1]))); return { r: x, params }; } }
    return { r: routes.find((x) => x.pattern === '/404'), params: {} };
  }
  function canOpenPath(path) { const { r } = matchRoute(path); return !r || !r.menu || can(r.menu); }
  function renderDenied(view, r) {
    const allowed = (data.roles || []).filter((x) => can(r.menu, 'view', x));
    const users = allowed.map((x) => (data.users || []).find((u) => u.roleId === x.id && u.demo && u.active !== false)).filter(Boolean);
    view.innerHTML = '<h1 class="view-title">' + esc(r.title || 'Không có quyền') + '</h1><div class="placeholder"><div>' + icon('lock') +
      '<h2>Bạn không có quyền truy cập chức năng này</h2><p>Vai trò <b>' + esc((role() || {}).name) + '</b> chưa được cấp quyền. Chức năng này dành cho: ' + esc(allowed.map((x) => x.name).join(', ') || 'chưa có vai trò nào') + '.</p>' +
      (users.length ? '<div class="row" style="justify-content:center;margin-top:12px">' + users.map((u) => btn({ label: 'Xem bằng tài khoản ' + (role(u) || {}).name, icon: 'user-card', attrs: { 'data-login': u.id } })).join('') + '</div>' : '') + '</div></div>';
    view.addEventListener('click', (e) => { const b = e.target.closest('[data-login]'); if (b) { login(b.dataset.login); afterLogin(); render(); } });
  }

  let cleanup = [];
  function onLeave(fn) { cleanup.push(fn); }
  function render() {
    cleanup.forEach((f) => { try { f(); } catch (e) { /* ignore */ } }); cleanup = [];
    closeMenus(); $$('.dlg-scrim').forEach((d) => d.remove());
    const { path, query } = parseHash();
    const view = document.createElement('div');
    view.className = 'view';
    mainEl.innerHTML = ''; mainEl.appendChild(view); mainEl.scrollTop = 0;
    const u = user();
    refreshHeader();
    if (!u) { navEl.innerHTML = ''; document.title = 'Đăng nhập · EduPay HCM'; renderLogin(view); return; }
    const rl = role();
    if (path === '/' && rl && rl.home && rl.home !== '/') { go(rl.home); return; }
    const { r, params } = matchRoute(path);
    navEl.innerHTML = renderNav(r && r.menu);
    document.title = (r && r.title ? r.title + ' · ' : '') + 'EduPay HCM';
    if (r.menu && !can(r.menu)) { renderDenied(view, r); return; }
    const readOnly = !!(r.menu && !can(r.menu, 'full'));
    view.classList.toggle('read-only', readOnly);
    try {
      r.render({ el: view, params, query, path, go, data, save, year: currentYear(), user: u, role: rl, readOnly });
      const h = readOnly && view.querySelector('.view-title');
      if (h && !view.querySelector('.ro-banner')) h.insertAdjacentHTML('beforeend', '<span class="ro-banner">' + icon('eye') + 'Chỉ xem</span>');
    }
    catch (err) { console.error(err); view.innerHTML = '<div class="note danger">Lỗi hiển thị màn hình: ' + esc(err.message) + '</div>'; }
  }

  // ---------- UI helpers ----------
  function btn(o) {
    const cls = ['btn'].concat(o.variant ? o.variant.split(' ') : []).concat(o.label ? [] : ['icon']).concat(o.cls ? [o.cls] : []).join(' ');
    const attrs = Object.entries(o.attrs || {}).map(([k, v]) => ' ' + k + '="' + esc(v) + '"').join('');
    return '<button type="' + (o.type || 'button') + '" class="' + cls + '"' + (o.id ? ' id="' + o.id + '"' : '') + (o.action ? ' data-action="' + o.action + '"' : '') +
      (o.disabled ? ' disabled' : '') + (o.title || (!o.label && o.aria) ? ' title="' + esc(o.title || o.aria) + '" aria-label="' + esc(o.title || o.aria) + '"' : '') + attrs + '>' +
      (o.icon ? icon(o.icon) : '') + (o.label ? '<span>' + esc(o.label) + '</span>' : '') + '</button>';
  }

  // field({label, id, type:'text'|'number'|'money'|'date'|'select'|'textarea'|'readonly', value, options:[{value,label}]|[str], required, placeholder, error, help, cls, attrs, icon})
  function field(o) {
    const id = o.id || uid('f');
    const attrs = Object.entries(o.attrs || {}).map(([k, v]) => ' ' + k + '="' + esc(v) + '"').join('');
    const common = ' id="' + id + '" name="' + (o.name || id) + '"' + (o.placeholder ? ' placeholder="' + esc(o.placeholder) + '"' : '') + (o.required ? ' required' : '') + (o.disabled ? ' disabled' : '') + attrs;
    let ctl;
    if (o.type === 'select') {
      const opts = (o.options || []).map((x) => (typeof x === 'object' ? x : { value: x, label: x }));
      ctl = '<select class="ctl"' + common + '>' + (o.placeholder ? '<option value="">' + esc(o.placeholder) + '</option>' : '') + opts.map((x) => '<option value="' + esc(x.value) + '"' + (String(x.value) === String(o.value) ? ' selected' : '') + '>' + esc(x.label) + '</option>').join('') + '</select>';
    } else if (o.type === 'textarea') {
      ctl = '<textarea class="ctl"' + common + '>' + esc(o.value) + '</textarea>';
    } else if (o.type === 'date') {
      // dd/mm/yyyy text field (browser-locale independent) + calendar button that opens a native picker.
      ctl = '<div class="ctl-wrap suffix date-wrap"><input class="ctl" type="text" data-date inputmode="numeric" placeholder="dd/mm/yyyy"' + common.replace(/ placeholder="[^"]*"/, '') + ' value="' + esc(o.value) + '"' + (o.readonly ? ' readonly' : '') + '>' +
        '<button type="button" class="date-btn" tabindex="-1" aria-label="Chọn ngày"' + (o.readonly || o.disabled ? ' disabled' : '') + '>' + icon('calendar') + '</button><input type="date" class="date-native" tabindex="-1" aria-hidden="true"></div>';
    } else if (o.type === 'money') {
      ctl = '<input class="ctl num" inputmode="numeric" data-money' + common + ' value="' + esc(money(o.value)) + '">';
    } else {
      ctl = '<input class="ctl' + (o.type === 'number' ? ' num' : '') + '" type="' + (o.type === 'number' ? 'number' : o.inputType || 'text') + '"' + common + ' value="' + esc(o.value) + '"' + (o.type === 'readonly' || o.readonly ? ' readonly' : '') + '>';
    }
    if (o.icon) ctl = '<div class="ctl-wrap' + (o.iconRight ? ' suffix' : '') + '">' + icon(o.icon) + ctl + '</div>';
    return '<div class="field' + (o.error ? ' invalid' : '') + (o.cls ? ' ' + o.cls : '') + '">' +
      (o.label ? '<label for="' + id + '">' + esc(o.label) + (o.required ? '<span class="req">*</span>' : '') + '</label>' : '') +
      ctl + (o.error ? '<div class="err">' + esc(o.error) + '</div>' : '') + (o.help ? '<div class="help">' + esc(o.help) + '</div>' : '') + '</div>';
  }
  function search(o) { return field(Object.assign({ icon: 'search', placeholder: 'Tìm kiếm…' }, o)); }
  // Read a form's values: {name: value}; date inputs come back as dd/mm/yyyy, money as number.
  function formValues(root) {
    const out = {};
    $$('input[name], select[name], textarea[name]', root).forEach((el) => {
      if (el.type === 'checkbox') out[el.name] = el.checked;
      else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
      else if (el.type === 'date') out[el.name] = fromISO(el.value);
      else if (el.hasAttribute('data-money')) out[el.name] = parseMoney(el.value);
      else out[el.name] = el.value;
    });
    return out;
  }
  // Mark required fields that are empty; returns true when valid.
  function validate(root) {
    let ok = true;
    $$('.field', root).forEach((f) => {
      const c = f.querySelector('[required]'); const old = f.querySelector('.err'); if (old) old.remove(); f.classList.remove('invalid');
      if (c && !String(c.value).trim()) { ok = false; f.classList.add('invalid'); f.insertAdjacentHTML('beforeend', '<div class="err">Trường này là bắt buộc.</div>'); }
    });
    return ok;
  }
  // Date fields: calendar button opens the native picker; picked value is written back as dd/mm/yyyy.
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('.date-btn'); if (!b || b.disabled) return;
    const wrap = b.parentElement; const txt = wrap.querySelector('[data-date]'); const nat = wrap.querySelector('.date-native');
    nat.value = toISO(txt.value);
    try { nat.showPicker(); } catch (err) { nat.focus(); nat.click(); }
  });
  document.addEventListener('change', (e) => {
    const nat = e.target; if (!nat.classList || !nat.classList.contains('date-native')) return;
    const txt = nat.parentElement.querySelector('[data-date]'); txt.value = fromISO(nat.value);
    txt.dispatchEvent(new Event('input', { bubbles: true })); txt.dispatchEvent(new Event('change', { bubbles: true }));
  });
  // Live thousand separators on money inputs.
  document.addEventListener('input', (e) => {
    const el = e.target; if (!el.hasAttribute || !el.hasAttribute('data-money')) return;
    const n = parseMoney(el.value); el.value = el.value.trim() === '' ? '' : money(n);
  });

  /* grid({columns:[{key,label,width,align:'right',render:(row,i)=>html, cls}], rows, rowKey:'id', selectable:'single'|'multi',
           selected:[ids], striped, empty, foot:html, actions:(row)=>html, onRowClick, clickable})
     Returns html. Call UI.bindGrid(root, opts) after insertion to wire selection (fires opts.onSelect(ids)). */
  function grid(o) {
    const key = o.rowKey || 'id'; const sel = new Set(o.selected || []);
    const cols = o.columns;
    let h = '<div class="ui-grid-wrap' + (o.fill ? ' fill' : '') + '"' + (o.id ? ' id="' + o.id + '"' : '') + (o.maxHeight ? ' style="max-height:' + o.maxHeight + '"' : '') + '><table class="ui-grid' + (o.striped !== false ? ' striped' : '') + '"><thead><tr>';
    if (o.selectable === 'multi') h += '<th class="chk-col"><input type="checkbox" class="grid-all" aria-label="Chọn tất cả"' + (o.rows.length && o.rows.every((r) => sel.has(r[key])) ? ' checked' : '') + '></th>';
    cols.forEach((c) => { h += '<th' + (c.align === 'right' ? ' class="num"' : c.align === 'center' ? ' style="text-align:center"' : '') + (c.width ? ' style="width:' + c.width + '"' : '') + '>' + esc(c.label) + '</th>'; });
    if (o.actions) h += '<th class="actions"></th>';
    h += '</tr></thead><tbody>';
    if (!o.rows.length) h += '<tr><td colspan="' + (cols.length + (o.selectable === 'multi' ? 1 : 0) + (o.actions ? 1 : 0)) + '" class="ui-grid-empty">' + esc(o.empty || 'Không có dữ liệu') + '</td></tr>';
    o.rows.forEach((r, i) => {
      h += '<tr data-key="' + esc(r[key]) + '" class="' + (sel.has(r[key]) ? 'selected ' : '') + (o.selectable || o.clickable ? 'clickable' : '') + '">';
      if (o.selectable === 'multi') h += '<td class="chk-col"><input type="checkbox" class="grid-chk" aria-label="Chọn dòng"' + (sel.has(r[key]) ? ' checked' : '') + '></td>';
      cols.forEach((c) => {
        const v = c.render ? c.render(r, i) : esc(r[c.key]);
        h += '<td class="' + (c.align === 'right' ? 'num ' : '') + (c.cls || '') + '"' + (c.align === 'center' ? ' style="text-align:center"' : '') + '>' + v + '</td>';
      });
      if (o.actions) h += '<td class="actions">' + o.actions(r, i) + '</td>';
      h += '</tr>';
    });
    h += '</tbody>' + (o.foot ? '<tfoot>' + o.foot + '</tfoot>' : '') + '</table></div>';
    return h;
  }
  function bindGrid(root, o) {
    const wrap = typeof root === 'string' ? $(root) : root; if (!wrap) return;
    const sel = new Set(o.selected || []);
    const emit = () => o.onSelect && o.onSelect(Array.from(sel));
    wrap.addEventListener('click', (e) => {
      if (e.target.closest('button, a, input:not(.grid-chk):not(.grid-all), select, textarea')) return;
      const tr = e.target.closest('tbody tr[data-key]'); const all = e.target.closest('.grid-all');
      if (all) { const rows = $$('tbody tr[data-key]', wrap); rows.forEach((r) => { r.classList.toggle('selected', all.checked); const c = r.querySelector('.grid-chk'); if (c) c.checked = all.checked; all.checked ? sel.add(r.dataset.key) : sel.delete(r.dataset.key); }); emit(); return; }
      if (!tr) return;
      const k = tr.dataset.key;
      if (o.selectable === 'multi') {
        const c = tr.querySelector('.grid-chk'); if (e.target !== c) c.checked = !c.checked;
        tr.classList.toggle('selected', c.checked); c.checked ? sel.add(k) : sel.delete(k); emit();
      } else if (o.selectable === 'single') {
        $$('tbody tr.selected', wrap).forEach((r) => r.classList.remove('selected'));
        if (sel.has(k)) sel.clear(); else { sel.clear(); sel.add(k); tr.classList.add('selected'); }
        emit();
      }
      if (o.onRowClick) o.onRowClick(k, e);
    });
    if (o.onRowDblClick) wrap.addEventListener('dblclick', (e) => { const tr = e.target.closest('tbody tr[data-key]'); if (tr) o.onRowDblClick(tr.dataset.key, e); });
  }

  function stat(o) { return '<div class="stat ' + (o.tone || '') + '"><div class="k">' + esc(o.label) + '</div><div class="v">' + (o.html || esc(o.value)) + '</div></div>'; }
  function badge(text, tone) { return '<span class="badge ' + (tone || '') + '">' + esc(text) + '</span>'; }

  // dialog({title, body:html, footer:html | false, width:'670px', large, onMount(dlg, close), onClose, dismissable})
  function dialog(o) {
    const scrim = document.createElement('div');
    scrim.className = 'dlg-scrim';
    scrim.innerHTML = '<div class="dlg" role="dialog" aria-modal="true" style="--dlg-w:' + (o.width || '670px') + '">' +
      '<div class="dlg-head' + (o.large ? ' lg' : '') + '"><h2>' + esc(o.title) + '</h2><button class="dlg-close" type="button" aria-label="Đóng">' + icon('close') + '</button></div>' +
      (o.rawBody ? o.body : '<div class="dlg-body">' + (o.body || '') + '</div>') +
      (o.footer === false ? '' : '<div class="dlg-foot">' + (o.footer || btn({ label: 'Hủy', action: 'close' }) + btn({ label: 'Đồng ý', variant: 'primary', action: 'ok' })) + '</div>') +
      '</div>';
    document.body.appendChild(scrim);
    const dlg = scrim.firstChild;
    const close = () => { scrim.remove(); document.removeEventListener('keydown', onKey); o.onClose && o.onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    dlg.querySelector('.dlg-close').addEventListener('click', close);
    scrim.addEventListener('mousedown', (e) => { if (e.target === scrim && o.dismissable !== false) close(); });
    dlg.addEventListener('click', (e) => { const a = e.target.closest('[data-action="close"]'); if (a) close(); });
    o.onMount && o.onMount(dlg, close);
    const first = dlg.querySelector('.dlg-body input:not([readonly]), .dlg-body select, .dlg-body textarea'); if (first) setTimeout(() => first.focus(), 30);
    return { el: dlg, close };
  }
  function confirmDlg(o) {
    return new Promise((resolve) => {
      let done = false;
      dialog({ title: o.title || 'Xác nhận', width: o.width || '460px', body: '<p style="margin:0;line-height:1.5">' + (o.html || esc(o.message)) + '</p>',
        footer: btn({ label: o.cancelLabel || 'Hủy', action: 'close' }) + btn({ label: o.okLabel || 'Đồng ý', variant: 'primary' + (o.danger ? ' danger' : ''), action: 'ok' }),
        onMount: (d, close) => d.querySelector('[data-action="ok"]').addEventListener('click', () => { done = true; close(); resolve(true); }),
        onClose: () => { if (!done) resolve(false); } });
    });
  }

  // menu(anchorEl, [{label, icon, onClick, danger} | '-'])
  function closeMenus() { $$('.menu-pop').forEach((m) => m.remove()); }
  function menu(anchor, items) {
    closeMenus();
    const m = document.createElement('div'); m.className = 'menu-pop';
    m.innerHTML = items.map((it, i) => (it === '-' ? '<hr>' : '<button type="button" data-i="' + i + '" class="' + (it.danger ? 'danger' : '') + '"' + (it.disabled ? ' disabled' : '') + '>' + (it.icon ? icon(it.icon) : '') + '<span>' + esc(it.label) + '</span></button>')).join('');
    document.body.appendChild(m);
    const r = anchor.getBoundingClientRect();
    const w = m.offsetWidth, hgt = m.offsetHeight;
    m.style.left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)) + 'px';
    m.style.top = (r.bottom + 4 + hgt > window.innerHeight ? Math.max(8, r.top - hgt - 4) : r.bottom + 4) + 'px';
    m.addEventListener('click', (e) => { const b = e.target.closest('button[data-i]'); if (!b) return; closeMenus(); const it = items[+b.dataset.i]; it.onClick && it.onClick(); });
    setTimeout(() => document.addEventListener('mousedown', function h(e) { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('mousedown', h); } }), 0);
    return m;
  }
  function toast(msg, tone) {
    const t = document.createElement('div'); t.className = 'toast ' + (tone || '');
    t.innerHTML = (tone === 'success' ? icon('check-circle') : tone === 'danger' ? icon('warning') : icon('info-circle')) + '<span>' + esc(msg) + '</span>';
    $('#toasts').appendChild(t); setTimeout(() => t.remove(), 3200);
  }
  function placeholder(el, title, text) {
    el.innerHTML = '<h1 class="view-title">' + esc(title) + '</h1><div class="placeholder"><div>' + icon('file-text-o') + '<h2>Chưa có thiết kế cho màn hình này</h2><p>' + esc(text || 'Màn hình này có trong menu nhưng file Figma chưa có thiết kế tương ứng.') + '</p></div></div>';
  }

  /* crudList — the standard Jmix list view (Filter · Refresh · Search · Create/Edit/Remove · pager · grid).
     o: {el, title, columns, rows:()=>[], onCreate(), onEdit(id), onRemove(ids) (return true to confirm removal), searchKeys:[...], rowKey} */
  function crudList(o) {
    let selected = [];
    let q = '';
    let filterOpen = true;
    const ro = o.readOnly != null ? o.readOnly : o.el.classList.contains('read-only');
    const draw = () => {
      const all = o.rows();
      const rows = q ? all.filter((r) => (o.searchKeys || o.columns.map((c) => c.key)).some((k) => norm(r[k]).includes(norm(q)))) : all;
      o.el.innerHTML = '<h1 class="view-title">' + esc(o.title) + '</h1>' +
        '<div><button class="filter-head' + (filterOpen ? '' : ' closed') + '" type="button" data-action="filter">' + icon('angle-down') + 'Filter</button></div>' +
        (filterOpen ? '<div class="toolbar">' + btn({ label: 'Refresh', icon: 'refresh', variant: 'primary', action: 'refresh' }) + btn({ icon: 'search', aria: 'Tìm kiếm', action: 'search' }) +
          (q ? '<div style="width:260px">' + search({ id: 'crudQ', value: q }) + '</div>' : btn({ label: 'Add search condition', variant: 'tertiary', action: 'addcond' })) + '</div>' : '') +
        '<div class="toolbar">' + (ro ? '<span class="badge">' + icon('eye') + ' Chỉ xem</span>' : btn({ label: 'Create', icon: 'plus', variant: 'primary', action: 'create' }) +
        btn({ label: 'Edit', icon: 'pencil', action: 'edit', disabled: selected.length !== 1 }) + btn({ label: 'Remove', icon: 'trash', action: 'remove', disabled: !selected.length })) +
        (o.extraTools || '') + '<span class="grow"></span>' +
        '<span class="pager">' + btn({ icon: 'angle-double-left', aria: 'Trang đầu', disabled: true }) + btn({ icon: 'angle-left', aria: 'Trang trước', disabled: true }) +
        '<span class="count">' + rows.length + ' rows</span>' + btn({ icon: 'angle-right', aria: 'Trang sau', disabled: true }) + btn({ icon: 'angle-double-right', aria: 'Trang cuối', disabled: true }) + '</span></div>' +
        grid({ columns: o.columns, rows, rowKey: o.rowKey, selectable: 'single', selected, fill: true, striped: false, id: 'crudGrid' });
      bindGrid($('#crudGrid', o.el), { selectable: 'single', selected, onSelect: (ids) => { selected = ids; syncBtns(); }, onRowDblClick: (k) => !ro && o.onEdit && o.onEdit(k) });
      const qi = $('#crudQ', o.el); if (qi) { qi.addEventListener('input', () => { q = qi.value; const pos = qi.selectionStart; draw(); const n = $('#crudQ', o.el); n.focus(); n.setSelectionRange(pos, pos); }); }
    };
    const syncBtns = () => { if (ro) return; $('[data-action="edit"]', o.el).disabled = selected.length !== 1; $('[data-action="remove"]', o.el).disabled = !selected.length; };
    o.el.onclick = async (e) => {
      const a = e.target.closest('[data-action]'); if (!a || a.disabled) return;
      const act = a.dataset.action;
      if (act === 'filter') { filterOpen = !filterOpen; draw(); }
      else if (act === 'refresh') { draw(); toast('Đã tải lại dữ liệu'); }
      else if (act === 'addcond' || act === 'search') { if (!q) { q = ' '; draw(); q = ''; const n = $('#crudQ', o.el); if (n) { n.value = ''; n.focus(); } } }
      else if (act === 'create') o.onCreate && o.onCreate();
      else if (act === 'edit') o.onEdit && o.onEdit(selected[0]);
      else if (act === 'remove') {
        if (await confirmDlg({ title: 'Xác nhận xóa', message: 'Bạn có chắc muốn xóa ' + selected.length + ' bản ghi đã chọn?', okLabel: 'Xóa', danger: true })) {
          const res = o.onRemove ? o.onRemove(selected) : true; if (res === false) return; selected = []; save(); draw(); toast('Đã xóa', 'success');
        }
      }
    };
    draw();
    return { redraw: draw };
  }

  function screenIndex() {
    const groups = {};
    frames.forEach((f) => (groups[f.group] = groups[f.group] || []).push(f));
    dialog({ title: 'Danh sách màn hình theo Figma', width: '760px', footer: false,
      body: '<p class="muted" style="margin:0 0 8px">Chọn một màn hình để mở đúng trạng thái đã thiết kế trong Figma.</p><div class="proto-list">' +
        Object.keys(groups).map((g) => '<h3>' + esc(g) + '</h3>' + groups[g].map((f) => '<a href="#' + f.path + '" data-close><code>' + esc(f.code) + '</code><span>' + esc(f.name) + '</span></a>').join('')).join('') + '</div>',
      onMount: (d, close) => d.addEventListener('click', (e) => { if (e.target.closest('a[data-close]')) close(); }) });
  }

  // ---------- boot ----------
  function start() {
    loadSaved();
    if (!data.currentYearId && data.years && data.years.length) data.currentYearId = data.years[0].id;
    mountShell();
    window.addEventListener('hashchange', render);
    render();
  }

  window.App = { route, frame, go, back, data, seed, save, resetData, start, render, onLeave, currentYear, MENU, user, role, can, perm, login, initials };
  window.UI = { esc, money, parseMoney, uid, fmtDate, toISO, fromISO, norm, $, $$, icon, btn, field, search, formValues, validate, grid, bindGrid, stat, badge, dialog, confirm: confirmDlg, menu, closeMenus, toast, placeholder, crudList, screenIndex };
})();
