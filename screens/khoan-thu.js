/* Group C — Khoản thu (07, 07b/d/e/f) + Đăng ký khoản thu (08). */
(function () {
  'use strict';
  const { route, frame } = App;
  const { esc, money, icon, btn, field, search, grid, bindGrid, dialog, confirm, menu, toast, uid, norm, formValues, validate, $, $$ } = UI;

  frame('07', 'Khoản thu / Danh sách', '/khoan-thu', 'Khoản thu');
  frame('07b', 'Khoản thu / Thêm mới — Học kỳ', '/khoan-thu?dialog=new&cycle=hoc-ky', 'Khoản thu');
  frame('07d', 'Khoản thu / Thêm mới — Tháng', '/khoan-thu?dialog=new&cycle=thang', 'Khoản thu');
  frame('07e', 'Khoản thu / Thêm mới — Quý', '/khoan-thu?dialog=new&cycle=quy', 'Khoản thu');
  frame('07f', 'Khoản thu / Thêm mới — Năm học', '/khoan-thu?dialog=new&cycle=nam-hoc', 'Khoản thu');
  frame('08', 'Đăng ký khoản thu / Theo lớp (ma trận)', '/dang-ky-khoan-thu?class=c11A1', 'Khoản thu');

  const CYCLES = [['thang', 'Tháng'], ['quy', 'Quý'], ['hoc-ky', 'Học kỳ'], ['nam-hoc', 'Năm học']];
  const CYCLE_LABEL = Object.fromEntries(CYCLES);
  const GROUPS = ['Học phí', 'Bán trú', 'Dịch vụ', 'Bảo hiểm', 'Khác'];
  const MONTHS = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: 'Tháng ' + (i + 1) }));
  const DEFAULT_TIMING = { 'hoc-ky': [8, 1], quy: [9, 12, 3, 6], 'nam-hoc': [8], thang: [] };
  const FLAG_DEFAULTS = { scope: 'all', priceMode: 'single', prices: [], vat: 0, timing: [], timingText: '', defaultQty: 1,
    service: false, invoice: true, voucher: true, refundable: false, internal: false, track: true, invoiceRate: 100 };
  // Older saved data may lack the extra fields — read through this.
  const full = (f) => Object.assign({}, FLAG_DEFAULTS, f);
  const units = () => App.data.units || [];
  const unitName = (id) => (units().find((u) => u.id === id) || {}).name || '';

  function priceText(f) {
    if (f.priceMode === 'multi' && (f.prices || []).length > 1) return 'Nhiều đơn giá';
    const u = unitName(f.unitId);
    return money(f.price) + (u ? '/' + u : '');
  }
  function timingText(f) {
    if (f.cycle === 'thang') return f.timingText || 'Hàng tháng';
    const t = (f.timing && f.timing.length ? f.timing : DEFAULT_TIMING[f.cycle]) || [];
    return t.length ? 'Tháng ' + t.join(', ') : '-';
  }
  const cb = (on) => '<span class="kt-cb' + (on ? ' on' : '') + '" role="img" aria-label="' + (on ? 'Có' : 'Không') + '">' + (on ? icon('check') : '') + '</span>';

  // =====================================================================
  // 07 — Danh sách khoản thu
  // =====================================================================
  route('/khoan-thu', {
    title: 'Danh sách khoản thu',
    menu: 'khoan-thu',
    render(ctx) {
      const { el, query } = ctx;
      let q = '';
      let openDlg = null; let leaving = false;
      App.onLeave(() => { leaving = true; if (openDlg) openDlg.close(); });

      el.classList.add('kt-view');
      el.innerHTML =
        '<h1 class="view-title">Danh sách khoản thu</h1>' +
        '<div class="kt-listbar">' +
        '<div class="kt-search">' + search({ id: 'ktQ', placeholder: 'Tìm theo tên khoản thu...' }) + '</div>' +
        '<span class="grow"></span>' +
        btn({ label: 'Thêm mới', icon: 'plus', variant: 'primary', action: 'new', cls: 'kt-add' }) +
        '</div>' +
        '<div id="ktGridHost"></div>';

      const columns = [
        { key: 'name', label: 'Tên khoản thu', width: '190px', render: (f) => esc(f.name) },
        { key: 'price', label: 'Đơn giá', width: '150px', render: (f) => esc(priceText(f)) },
        { key: 'vat', label: 'Thuế GTGT', width: '120px', render: (f) => (f.vat ? esc(f.vat) + '%' : '-') },
        { key: 'cycle', label: 'Kỳ thu', width: '120px', render: (f) => esc(CYCLE_LABEL[f.cycle] || '') },
        { key: 'timing', label: 'Thời điểm thu', width: '140px', render: (f) => esc(timingText(f)) },
        { key: 'service', label: 'Dịch vụ', width: '110px', render: (f) => cb(f.service) },
        { key: 'discountable', label: 'Miễn giảm', width: '110px', render: (f) => cb(f.discountable) },
        { key: 'invoice', label: 'Hóa đơn', width: '110px', render: (f) => cb(f.invoice) },
        { key: 'voucher', label: 'Chứng từ', width: '110px', render: (f) => cb(f.voucher) },
        { key: 'refundable', label: 'Hoàn trả', width: '110px', render: (f) => cb(f.refundable) },
        { key: 'mandatory', label: 'Bắt buộc', width: '110px', render: (f) => cb(f.mandatory) },
        { key: 'track', label: 'Theo dõi', width: '110px', render: (f) => cb(f.track) },
      ];

      function drawGrid() {
        const all = (App.data.feeItems || []).map(full);
        const rows = q ? all.filter((f) => norm(f.name + ' ' + f.code).includes(norm(q))) : all;
        $('#ktGridHost', el).innerHTML =
          '<div class="kt-fee-grid">' + grid({ id: 'ktGrid', columns, rows, clickable: true, empty: q ? 'Không tìm thấy khoản thu phù hợp' : 'Chưa có khoản thu',
            actions: (f) => btn({ icon: 'ellipsis-dots-h', aria: 'Thao tác', variant: 'tertiary', cls: 'sm', action: 'row-menu', attrs: { 'data-id': f.id } }) }) + '</div>' +
          '<div class="kt-gridfoot"><span class="kt-total">Tổng số: ' + rows.length + ' khoản thu</span><span class="muted">Kéo ngang để xem đầy đủ các cột cấu hình</span></div>';
        bindGrid($('#ktGrid', el), { onRowClick: (id) => openForm({ id }) });
      }

      function remove(id) {
        const f = (App.data.feeItems || []).find((x) => x.id === id); if (!f) return;
        const usedIn = (App.data.rounds || []).filter((r) => (r.items || []).some((it) => it.feeId === id));
        if (usedIn.length) {
          toast('Không thể xóa: khoản thu đang dùng trong đợt thu "' + usedIn[0].name + '"' + (usedIn.length > 1 ? ' và ' + (usedIn.length - 1) + ' đợt khác' : ''), 'danger');
          return;
        }
        confirm({ title: 'Xóa khoản thu', message: 'Bạn có chắc muốn xóa khoản thu "' + f.name + '"? Các đăng ký của học sinh cho khoản thu này cũng sẽ bị xóa.', okLabel: 'Xóa', danger: true }).then((ok) => {
          if (!ok) return;
          App.data.feeItems = App.data.feeItems.filter((x) => x.id !== id);
          const reg = App.data.registrations || {};
          Object.keys(reg).forEach((sid) => { reg[sid] = (reg[sid] || []).filter((x) => x !== id); });
          App.save(); drawGrid(); toast('Đã xóa khoản thu ' + f.name, 'success');
        });
      }

      function afterClose() {
        openDlg = null;
        if (leaving) return;
        if (query.dialog) App.go('/khoan-thu'); else drawGrid();
      }
      function openForm(o) {
        if (openDlg) return;
        openDlg = feeDialog(Object.assign({}, o, { onDone: afterClose }));
      }

      el.onclick = (e) => {
        const a = e.target.closest('[data-action]'); if (!a) return;
        if (a.dataset.action === 'new') openForm({ cycle: 'hoc-ky' });
        else if (a.dataset.action === 'row-menu') {
          const id = a.dataset.id;
          menu(a, [
            { label: 'Chỉnh sửa', icon: 'pencil', onClick: () => openForm({ id }) },
            { label: 'Xóa', icon: 'trash', danger: true, onClick: () => remove(id) },
          ]);
        }
      };
      const qi = $('#ktQ', el);
      qi.addEventListener('input', () => { q = qi.value; drawGrid(); });
      drawGrid();

      if (query.dialog === 'new') openForm({ cycle: CYCLE_LABEL[query.cycle] ? query.cycle : 'hoc-ky' });
      else if (query.dialog === 'edit' && query.id) openForm({ id: query.id });
    },
  });

  // ---------- 07b / 07d / 07e / 07f — Thêm / sửa khoản thu ----------
  function blankFee(cycle) {
    return full({ id: '', code: '', name: '', group: '', unitId: 'u1', cycle, price: 1000000, mandatory: true, discountable: true,
      timing: DEFAULT_TIMING[cycle].slice(), timingText: cycle === 'thang' ? 'Hàng tháng' : '', prices: [{ name: 'Mức 1', price: 1000000 }, { name: 'Mức 2', price: 0 }] });
  }

  function feeDialog(o) {
    const existing = o.id ? (App.data.feeItems || []).find((f) => f.id === o.id) : null;
    let st = existing ? JSON.parse(JSON.stringify(full(existing))) : blankFee(o.cycle || 'hoc-ky');
    if (!st.timing || !st.timing.length) st.timing = DEFAULT_TIMING[st.cycle].slice();
    if (!st.prices || !st.prices.length) st.prices = [{ name: 'Mức 1', price: st.price }];
    let savedAny = false;

    const scopeOpts = [{ value: 'all', label: 'Toàn trường' }].concat((App.data.grades || []).map((g) => ({ value: 'grade:' + g.id, label: g.name })));
    const radio = (name, value, label, checked) => '<label><input type="radio" name="' + name + '" value="' + value + '"' + (checked ? ' checked' : '') + '>' + esc(label) + '</label>';
    const chk = (name, label, checked, disabled) => '<label class="chk' + (disabled ? ' kt-dis' : '') + '"><input type="checkbox" name="' + name + '"' + (checked ? ' checked' : '') + (disabled ? ' disabled' : '') + '><span>' + esc(label) + '</span></label>';

    function timingHtml() {
      const t = st.timing || [];
      const sel = (i, label) => field({ type: 'select', name: 'timing' + i, label, value: String(t[i] || DEFAULT_TIMING[st.cycle][i]), options: MONTHS });
      if (st.cycle === 'hoc-ky') return '<div class="form-grid kt-g2">' + sel(0, 'Thời điểm thu học kỳ I') + sel(1, 'Thời điểm thu học kỳ II') + '</div>';
      if (st.cycle === 'quy') return '<div class="form-grid kt-g4">' + [0, 1, 2, 3].map((i) => sel(i, 'Thời điểm thu quý ' + (i + 1))).join('') + '</div>';
      if (st.cycle === 'nam-hoc') return '<div class="form-grid kt-g2">' + sel(0, 'Thời điểm thu năm học') + '</div>';
      return '<div class="form-grid kt-g2">' + field({ name: 'timingText', label: 'Thời điểm thu hàng tháng', value: st.timingText || 'Hàng tháng', placeholder: 'VD: Từ ngày 01 đến ngày 10 hàng tháng' }) + '</div>';
    }
    function tiersHtml() {
      if (st.priceMode !== 'multi') return '';
      return '<div class="kt-tiers"><table class="ui-grid"><thead><tr><th style="width:48px">STT</th><th>Tên mức giá</th><th class="num" style="width:220px">Đơn giá (đã gồm thuế)</th><th class="actions"></th></tr></thead><tbody>' +
        st.prices.map((p, i) => '<tr><td>' + (i + 1) + '</td><td><input class="ctl" name="tierName' + i + '" value="' + esc(p.name) + '" required aria-label="Tên mức giá ' + (i + 1) + '"></td>' +
          '<td><input class="ctl num" data-money inputmode="numeric" name="tierPrice' + i + '" value="' + esc(money(p.price)) + '" aria-label="Đơn giá mức ' + (i + 1) + '"></td>' +
          '<td class="actions">' + btn({ icon: 'trash', aria: 'Xóa mức giá', variant: 'tertiary', cls: 'sm', action: 'tier-del', attrs: { 'data-i': i }, disabled: st.prices.length <= 2 }) + '</td></tr>').join('') +
        '</tbody></table>' + btn({ label: 'Thêm mức giá', icon: 'plus', variant: 'tertiary', cls: 'sm', action: 'tier-add' }) + '</div>';
    }
    function bodyHtml() {
      return '<form class="kt-form" novalidate>' +
        '<section class="kt-sec"><h3>Thông tin khoản thu</h3><div class="form-grid kt-g2">' +
        field({ name: 'name', label: 'Tên khoản thu', required: true, value: st.name, placeholder: 'Nhập tên khoản thu' }) +
        field({ name: 'scope', label: 'Phạm vi thu', required: true, type: 'select', value: st.scope, options: scopeOpts }) + '</div></section>' +

        '<section class="kt-sec"><h3>Đơn giá</h3><div class="kt-sub">Cách xác định đơn giá *</div>' +
        '<div class="radio-row kt-radios">' + radio('priceMode', 'single', 'Một đơn giá', st.priceMode !== 'multi') + radio('priceMode', 'multi', 'Nhiều đơn giá', st.priceMode === 'multi') + '</div>' +
        '<div class="form-grid kt-g4">' +
        (st.priceMode === 'multi'
          ? field({ name: 'priceInfo', label: 'Đơn giá đã bao gồm thuế GTGT', type: 'readonly', value: 'Theo bảng mức giá bên dưới' })
          : field({ name: 'price', label: 'Đơn giá đã bao gồm thuế GTGT', required: true, type: 'money', value: st.price })) +
        field({ name: 'unitId', label: 'Đơn vị tính', required: true, type: 'select', value: st.unitId, options: units().map((u) => ({ value: u.id, label: u.name })) }) +
        field({ name: 'vat', label: 'Thuế suất GTGT (%)', type: 'number', value: st.vat, attrs: { min: 0, max: 100 } }) +
        field({ name: 'group', label: 'Tính chất', type: 'select', value: st.group, placeholder: 'Chọn', options: GROUPS }) +
        '</div>' + tiersHtml() + '</section>' +

        '<section class="kt-sec"><h3>Kỳ thu và thời điểm thu</h3><div class="kt-sub">Kỳ thu *</div>' +
        '<div class="radio-row kt-radios">' + CYCLES.map(([v, l]) => radio('cycle', v, l, st.cycle === v)).join('') + '</div>' +
        timingHtml() + '</section>' +

        '<section class="kt-sec last"><h3>Quy tắc áp dụng</h3><div class="kt-rules">' +
        chk('discountable', 'Áp dụng miễn giảm', st.discountable) + chk('mandatory', 'Khoản thu bắt buộc', st.mandatory) + chk('invoice', 'Cho phép xuất hóa đơn', st.invoice) +
        chk('service', 'Khoản thu dịch vụ', st.service) + chk('internal', 'Thu nội bộ', st.internal) + chk('voucher', 'Cho phép xuất chứng từ', st.voucher) +
        chk('refundable', 'Cho phép hoàn trả', st.refundable && st.service, !st.service) +
        '<div class="kt-rate">' + field({ name: 'invoiceRate', label: 'Tỷ lệ số tiền xuất hóa đơn (%)', type: 'number', value: st.invoiceRate, disabled: !st.invoice, attrs: { min: 0, max: 100 } }) + '</div>' +
        chk('track', 'Theo dõi công nợ', st.track) +
        '</div></section></form>';
    }

    // Pull current inputs into st (so re-paints keep what the user typed).
    function readForm(dlg) {
      const v = formValues(dlg);
      st.name = v.name != null ? v.name : st.name;
      st.scope = v.scope || st.scope;
      st.priceMode = v.priceMode || st.priceMode;
      if (v.price != null) st.price = v.price;
      st.unitId = v.unitId || st.unitId;
      st.vat = Math.max(0, Math.min(100, Number(v.vat) || 0));
      st.group = v.group != null ? v.group : st.group;
      st.cycle = v.cycle || st.cycle;
      if (v.timingText != null) st.timingText = v.timingText;
      const t = [0, 1, 2, 3].map((i) => v['timing' + i]).filter((x) => x != null && x !== '').map(Number);
      if (t.length) st.timing = t;
      if (st.prices) st.prices = st.prices.map((p, i) => ({ name: v['tierName' + i] != null ? v['tierName' + i] : p.name, price: v['tierPrice' + i] != null ? v['tierPrice' + i] : p.price }));
      ['discountable', 'mandatory', 'invoice', 'service', 'internal', 'voucher', 'refundable', 'track'].forEach((k) => { if (k in v) st[k] = v[k]; });
      if (v.invoiceRate != null) st.invoiceRate = Math.max(0, Math.min(100, Number(v.invoiceRate) || 0));
    }

    function commit() {
      const name = st.name.trim();
      const items = App.data.feeItems || (App.data.feeItems = []);
      if (items.some((f) => f.id !== st.id && norm(f.name) === norm(name))) return 'Đã có khoản thu tên "' + name + '".';
      if (st.priceMode === 'multi') {
        if (st.prices.some((p) => !String(p.name).trim() || !(p.price > 0))) return 'Nhập tên và đơn giá lớn hơn 0 cho mọi mức giá.';
      } else if (!(st.price > 0)) return 'Đơn giá phải lớn hơn 0.';
      const rec = JSON.parse(JSON.stringify(st));
      rec.name = name;
      if (rec.priceMode === 'multi') rec.price = rec.prices[0].price; else rec.prices = [];
      if (!rec.service) rec.refundable = false;
      rec.timing = rec.cycle === 'thang' ? [] : rec.timing.slice(0, { quy: 4, 'hoc-ky': 2, 'nam-hoc': 1 }[rec.cycle]);
      if (!rec.id) {
        rec.id = uid('f');
        const base = norm(name).toUpperCase().replace(/[^A-Z0-9 ]/g, '').split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 8) || 'KT';
        let code = base, n = 2; while (items.some((f) => f.code === code)) code = base + n++;
        rec.code = code;
        items.push(rec);
      } else {
        const i = items.findIndex((f) => f.id === rec.id);
        items[i] = Object.assign({}, items[i], rec);
      }
      App.save(); savedAny = true;
      return '';
    }

    const d = dialog({
      title: existing ? 'Sửa khoản thu' : 'Thêm khoản thu', large: true, width: '1124px',
      body: bodyHtml(),
      footer: btn({ label: 'Hủy', action: 'close' }) + (existing ? '' : btn({ label: 'Lưu và thêm', action: 'save-new' })) + btn({ label: 'Lưu', variant: 'primary', action: 'save' }),
      onClose: () => o.onDone && o.onDone(savedAny),
      onMount(dlg, close) {
        dlg.classList.add('kt-dlg');
        const body = $('.dlg-body', dlg);
        const repaint = () => { readForm(dlg); const y = body.scrollTop; body.innerHTML = bodyHtml(); body.scrollTop = y; };
        body.addEventListener('change', (e) => {
          const n = e.target.name;
          if (n === 'cycle' || n === 'priceMode' || n === 'service' || n === 'invoice') {
            if (n === 'cycle') { readForm(dlg); st.cycle = e.target.value; st.timing = DEFAULT_TIMING[st.cycle].slice(); if (st.cycle === 'thang' && !st.timingText) st.timingText = 'Hàng tháng'; body.innerHTML = bodyHtml(); }
            else repaint();
          }
        });
        dlg.addEventListener('click', (e) => {
          const a = e.target.closest('[data-action]'); if (!a || a.disabled) return;
          const act = a.dataset.action;
          if (act === 'tier-add') { readForm(dlg); st.prices.push({ name: 'Mức ' + (st.prices.length + 1), price: 0 }); body.innerHTML = bodyHtml(); }
          else if (act === 'tier-del') { readForm(dlg); st.prices.splice(+a.dataset.i, 1); body.innerHTML = bodyHtml(); }
          else if (act === 'save' || act === 'save-new') {
            readForm(dlg);
            if (!validate(body)) { toast('Vui lòng nhập đầy đủ các trường bắt buộc', 'danger'); return; }
            const err = commit();
            if (err) { toast(err, 'danger'); return; }
            toast((existing ? 'Đã cập nhật khoản thu ' : 'Đã thêm khoản thu ') + st.name.trim(), 'success');
            if (act === 'save') close();
            else { st = blankFee(st.cycle); body.innerHTML = bodyHtml(); const f = $('input[name="name"]', body); if (f) f.focus(); }
          }
        });
        body.addEventListener('submit', (e) => e.preventDefault());
      },
    });
    return d;
  }

  // =====================================================================
  // 08 — Đăng ký khoản thu theo lớp (ma trận học sinh × khoản thu tự chọn)
  // =====================================================================
  let draft = null;          // working copy of registrations until "Lưu đăng ký"
  let expanded = null;       // Set of expanded grade ids in the class tree
  let feeFilter = 'all';
  let classQ = '';

  const optionalFees = () => (App.data.feeItems || []).filter((f) => !f.mandatory);
  const regOf = (sid) => (draft[sid] || []);
  function pendingCount() {
    const saved = App.data.registrations || {};
    let n = 0;
    Object.keys(draft).forEach((sid) => {
      const a = new Set(draft[sid] || []), b = new Set(saved[sid] || []);
      optionalFees().forEach((f) => { if (a.has(f.id) !== b.has(f.id)) n++; });
    });
    return n;
  }

  route('/dang-ky-khoan-thu', {
    title: 'Đăng ký khoản thu',
    menu: 'dang-ky',
    render(ctx) {
      const { el, query, year } = ctx;
      if (!draft) draft = JSON.parse(JSON.stringify(App.data.registrations || {}));
      App.onLeave(() => setTimeout(() => { if (!location.hash.startsWith('#/dang-ky-khoan-thu')) { draft = null; expanded = null; } }, 0));

      const grades = App.data.grades || [];
      const classes = (App.data.classes || []).filter((c) => c.yearId === (year && year.id));
      const studentsOf = (cid) => (App.data.students || []).filter((s) => (s.classes || {})[year.id] === cid && s.status !== 'nghi-hoc');
      const cls = classes.find((c) => c.id === query.class) || classes[0];
      if (!expanded) expanded = new Set(cls ? [cls.gradeId] : []);
      else if (cls && query.class) expanded.add(cls.gradeId);
      let selected = [];

      el.classList.add('kt-view');
      if (!cls) {
        el.innerHTML = '<h1 class="view-title">Đăng ký khoản thu</h1><div class="note">Năm học ' + esc(year ? year.name : '') + ' chưa có lớp học. Hãy tạo khối và lớp trước khi đăng ký khoản thu.</div>';
        return;
      }
      const students = studentsOf(cls.id);

      function treeHtml() {
        const qn = norm(classQ);
        return grades.map((g) => {
          const gc = classes.filter((c) => c.gradeId === g.id);
          const shown = qn ? gc.filter((c) => norm(c.name).includes(qn)) : gc;
          if (qn && !shown.length) return '';
          const open = qn || expanded.has(g.id);
          return '<button type="button" class="tree-item kt-grade" data-grade="' + g.id + '" aria-expanded="' + (open ? 'true' : 'false') + '">' + icon(open ? 'angle-down' : 'angle-right') +
            '<span>' + esc(g.name) + '</span><span class="cnt">' + gc.length + ' lớp</span></button>' +
            (open ? shown.map((c) => '<button type="button" class="tree-item l1 kt-class' + (c.id === cls.id ? ' active' : '') + '" data-class="' + c.id + '"><span>' + esc(c.name) + '</span><span class="cnt">' + studentsOf(c.id).length + '</span></button>').join('') : '');
        }).join('') || '<div class="muted kt-tree-empty">Không tìm thấy lớp</div>';
      }

      function toggleCell(sid, fid, on) {
        const cur = new Set(regOf(sid));
        if (on === undefined) on = !cur.has(fid);
        if (on) cur.add(fid); else cur.delete(fid);
        draft[sid] = optionalFees().map((f) => f.id).filter((id) => cur.has(id)).concat(Array.from(cur).filter((id) => !optionalFees().some((f) => f.id === id)));
      }

      function matrixHtml() {
        const fees = optionalFees().filter((f) => feeFilter === 'all' || f.id === feeFilter);
        const single = fees.length === 1;
        const cols = [
          { key: 'stt', label: 'STT', width: '52px', align: 'center', render: (s, i) => String(i + 1) },
          { key: 'name', label: 'Họ và tên', width: single ? '240px' : '200px', render: (s) => '<span class="kt-name">' + esc(s.name) + '</span><span class="sub">' + esc(s.code) + '</span>' },
        ].concat(fees.map((f) => ({ key: f.id, label: f.name, align: 'center', render: (s) => {
          const on = regOf(s.id).includes(f.id);
          return '<button type="button" class="kt-tg' + (on ? ' on' : '') + (single ? ' wide' : '') + '" data-sid="' + s.id + '" data-fid="' + f.id + '" aria-pressed="' + on + '" title="' + (on ? 'Đã đăng ký' : 'Chưa đăng ký') + ' — ' + esc(f.name) + '">' +
            icon(on ? 'check-circle' : 'circle-thin') + (single ? '<span>' + (on ? 'Đã đăng ký' : 'Chưa đăng ký') + '</span>' : '') + '</button>';
        } })));
        const foot = '<tr><td></td><td></td><td>Đã đăng ký</td>' + fees.map((f) => {
          const n = students.filter((s) => regOf(s.id).includes(f.id)).length;
          const allOn = students.length && n === students.length;
          return '<td style="text-align:center"><div class="kt-footcell"><span>' + n + '/' + students.length + '</span>' +
            btn({ label: allOn ? 'Bỏ cả lớp' : 'Cả lớp', variant: 'tertiary', cls: 'sm', action: 'col-all', attrs: { 'data-fid': f.id, 'data-on': allOn ? '0' : '1' } }) + '</div></td>';
        }).join('') + '</tr>';
        return '<div class="kt-matrix' + (single ? ' single' : '') + '">' + grid({ id: 'ktMatrix', columns: cols, rows: students, selectable: 'multi', selected, foot, empty: 'Lớp chưa có học sinh' }) + '</div>';
      }

      function summaryHtml() {
        const fees = optionalFees();
        let regs = 0, amount = 0;
        students.forEach((s) => regOf(s.id).forEach((fid) => { const f = fees.find((x) => x.id === fid); if (f) { regs++; amount += f.price * (f.defaultQty || 1); } }));
        const p = pendingCount();
        return '<span>Lớp ' + esc(cls.name) + ' · ' + students.length + ' học sinh · <b>' + regs + '</b> lượt đăng ký khoản thu tự chọn</span>' +
          '<span>Dự kiến thu theo đơn giá: <b class="kt-amt">' + money(amount) + ' đ</b></span>' +
          (p ? '<span class="kt-pending">' + icon('warning') + p + ' thay đổi chưa lưu</span>' : '<span class="kt-saved">' + icon('check') + 'Đã lưu</span>');
      }
      function bulkHtml() {
        return '<span class="kt-selcount">' + (selected.length ? 'Đã chọn <b>' + selected.length + '</b> học sinh' : 'Chọn học sinh để đăng ký hàng loạt') + '</span>' +
          btn({ label: 'Đăng ký hàng loạt', icon: 'check-square-o', cls: 'sm', action: 'bulk-on', disabled: !selected.length }) +
          btn({ label: 'Hủy đăng ký', icon: 'close-circle', cls: 'sm', variant: 'danger', action: 'bulk-off', disabled: !selected.length });
      }

      el.innerHTML =
        '<h1 class="view-title">Đăng ký khoản thu</h1>' +
        '<div class="kt-reg">' +
        '<aside class="card kt-tree-card"><div class="kt-tree-head">Danh sách lớp</div>' +
        '<div class="kt-tree-search">' + search({ id: 'ktClassQ', placeholder: 'Tìm lớp', value: classQ }) + '</div>' +
        '<div class="tree" id="ktTree">' + treeHtml() + '</div></aside>' +
        '<section class="kt-reg-main">' +
        '<div class="kt-reg-head"><div class="kt-reg-title"><h2>Lớp ' + esc(cls.name) + '</h2><span class="muted">' + students.length + ' học sinh · GVCN ' + esc(cls.teacher || '') + '</span></div>' +
        '<span class="grow"></span>' +
        '<div class="kt-feesel">' + field({ type: 'select', id: 'ktFee', value: feeFilter, attrs: { 'aria-label': 'Khoản thu tự chọn' },
          options: [{ value: 'all', label: 'Tất cả khoản thu tự chọn' }].concat(optionalFees().map((f) => ({ value: f.id, label: f.name }))) }) + '</div>' +
        btn({ label: 'Lưu đăng ký', icon: 'check', variant: 'primary', action: 'save' }) + '</div>' +
        '<div class="kt-bulk" id="ktBulk">' + bulkHtml() + '</div>' +
        '<div id="ktMatrixHost">' + matrixHtml() + '</div>' +
        '<div class="grid-foot kt-sum" id="ktSum">' + summaryHtml() + '</div>' +
        '</section></div>';

      function paintMatrix() {
        const host = $('#ktMatrixHost', el); const wrap = $('.ui-grid-wrap', host); const sx = wrap ? wrap.scrollLeft : 0, sy = wrap ? wrap.scrollTop : 0;
        host.innerHTML = matrixHtml();
        const w2 = $('.ui-grid-wrap', host); w2.scrollLeft = sx; w2.scrollTop = sy;
        bindGrid($('#ktMatrix', el), { selectable: 'multi', selected, onSelect: (ids) => { selected = ids; $('#ktBulk', el).innerHTML = bulkHtml(); } });
        $('#ktSum', el).innerHTML = summaryHtml();
        $('#ktBulk', el).innerHTML = bulkHtml();
      }
      paintMatrix();

      function bulk(on, fids) {
        selected.forEach((sid) => fids.forEach((fid) => toggleCell(sid, fid, on)));
        toast((on ? 'Đã đăng ký ' : 'Đã hủy đăng ký ') + (fids.length === 1 ? '"' + optionalFees().find((f) => f.id === fids[0]).name + '"' : fids.length + ' khoản thu') + ' cho ' + selected.length + ' học sinh (chưa lưu)');
        paintMatrix();
      }
      function bulkPick(anchor, on) {
        if (feeFilter !== 'all') { bulk(on, [feeFilter]); return; }
        menu(anchor, [{ label: 'Tất cả khoản thu tự chọn', icon: 'list', onClick: () => bulk(on, optionalFees().map((f) => f.id)) }, '-']
          .concat(optionalFees().map((f) => ({ label: f.name, icon: on ? 'check-circle' : 'circle-thin', onClick: () => bulk(on, [f.id]) }))));
      }

      el.onclick = (e) => {
        const g = e.target.closest('[data-grade]');
        if (g) { const id = g.dataset.grade; expanded.has(id) ? expanded.delete(id) : expanded.add(id); $('#ktTree', el).innerHTML = treeHtml(); return; }
        const c = e.target.closest('[data-class]');
        if (c) { if (c.dataset.class !== cls.id) App.go('/dang-ky-khoan-thu?class=' + c.dataset.class); return; }
        const t = e.target.closest('.kt-tg');
        if (t) { toggleCell(t.dataset.sid, t.dataset.fid); paintMatrix(); return; }
        const a = e.target.closest('[data-action]'); if (!a || a.disabled) return;
        const act = a.dataset.action;
        if (act === 'col-all') { const on = a.dataset.on === '1'; students.forEach((s) => toggleCell(s.id, a.dataset.fid, on)); paintMatrix(); }
        else if (act === 'bulk-on') bulkPick(a, true);
        else if (act === 'bulk-off') bulkPick(a, false);
        else if (act === 'save') {
          const n = pendingCount();
          if (!n) { toast('Không có thay đổi cần lưu'); return; }
          App.data.registrations = JSON.parse(JSON.stringify(draft));
          App.save(); paintMatrix();
          toast('Đã lưu ' + n + ' thay đổi đăng ký khoản thu', 'success');
        }
      };
      $('#ktFee', el).addEventListener('change', (e) => { feeFilter = e.target.value; paintMatrix(); });
      const cq = $('#ktClassQ', el);
      cq.addEventListener('input', () => { classQ = cq.value; $('#ktTree', el).innerHTML = treeHtml(); });
    },
  });

  void $$;
})();
