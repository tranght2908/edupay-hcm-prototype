/* Group D — Đợt thu (10, 10a), Tổng quan đợt thu (10b.x, 10c), Thông báo thu tiền (11.2). */
(function () {
  'use strict';
  const { route, frame } = App;
  const { esc, money, icon, btn, field, grid, dialog, menu, toast, badge, norm, $, $$ } = UI;
  const D = App.data;
  const C = () => App.calc;
  const GROUP = 'Đợt thu';

  // ---------- Figma frame index ----------
  frame('10', 'Đợt thu / Danh sách', '/dot-thu?month=2025-09', GROUP);
  frame('10a', 'Đợt thu / Popup thêm mới', '/dot-thu?month=2025-09&dialog=new', GROUP);
  frame('10b.1', 'Tổng quan đợt thu / Toàn trường', '/dot-thu/r2', GROUP);
  frame('10b.2', 'Tổng quan đợt thu / Khối 11', '/dot-thu/r2?node=g11', GROUP);
  frame('10b.3', 'Tổng quan đợt thu / Lớp 10A2', '/dot-thu/r2?node=c10A2', GROUP);
  frame('10b.4', 'Tổng quan đợt thu / Menu thao tác học sinh', '/dot-thu/r2?node=c10A2&menu=s33', GROUP);
  frame('10b.5', 'Đăng ký khoản thu / Chỉ đợt này', '/dot-thu/r2?node=c10A2&menu=s33&dialog=reg-once', GROUP);
  frame('10b.6', 'Đăng ký khoản thu / Từ đợt này trở đi', '/dot-thu/r2?node=c10A2&menu=s33&dialog=reg-forward', GROUP);
  frame('10c', 'Đợt thu / Cập nhật khoản thu', '/dot-thu/r2?dialog=items', GROUP);
  frame('11.2', 'Thông báo thu tiền / Thiết lập gửi', '/thong-bao/r2', GROUP);

  // ---------- helpers ----------
  const pad = (n) => String(n).padStart(2, '0');
  const monthLabel = (ym) => { const [y, m] = ym.split('-'); return m + '/' + y; };
  const parseVN = (s) => { const m = String(s || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null; };
  const today = () => UI.fmtDate(new Date());
  const round = (id) => (D.rounds || []).find((r) => r.id === id);
  const yearRounds = (yearId) => (D.rounds || []).filter((r) => r.yearId === yearId);
  const grades = () => D.grades || [];
  const classesOf = (yearId, gradeId) => (D.classes || []).filter((c) => c.yearId === yearId && (!gradeId || c.gradeId === gradeId));
  const gradeName = (id) => (grades().find((g) => g.id === id) || {}).name || id;
  const className = (id) => ((D.classes || []).find((c) => c.id === id) || {}).name || id;
  function scopeLabel(scope) {
    if (!scope || scope === 'all') return 'Toàn trường';
    const [k, id] = scope.split(':');
    return k === 'grade' ? gradeName(id) : 'Lớp ' + className(id);
  }
  function scopeOptions(yearId) {
    const out = [{ value: 'all', label: 'Toàn trường' }];
    grades().forEach((g) => {
      out.push({ value: 'grade:' + g.id, label: g.name });
      classesOf(yearId, g.id).forEach((c) => out.push({ value: 'class:' + c.id, label: '— Lớp ' + c.name }));
    });
    return out;
  }
  // Months of a school year: the month before it starts through the month it ends (Figma: 08 → 05).
  function yearMonths(y) {
    const s = parseVN(y.start), e = parseVN(y.end);
    if (!s || !e) return [];
    const out = []; const d = new Date(s.getFullYear(), s.getMonth() - 1, 1);
    while (d <= e) { out.push(d.getFullYear() + '-' + pad(d.getMonth() + 1)); d.setMonth(d.getMonth() + 1); }
    return out;
  }
  function roundState(r, sum) {
    if (r.status === 'da-khoa') return 'Đã khóa';
    if (sum.due > 0 && sum.remaining === 0) return 'Đã thu xong';
    return sum.paid > 0 || r.status === 'dang-thu' ? 'Đang thu' : 'Chưa thu';
  }
  const feeName = (id) => (C().fee(id) || {}).name || id;

  // ======================================================================
  // 10 — Đợt thu / Danh sách
  // ======================================================================
  route('/dot-thu', {
    title: 'Đợt thu', menu: 'dot-thu',
    render(ctx) {
      const { el, query, year } = ctx;
      const months = yearMonths(year);
      const rs = yearRounds(year.id);
      let month = query.month;
      if (!month || (month !== 'adhoc' && !months.includes(month))) {
        const active = rs.find((r) => r.status === 'dang-thu') || rs[0];
        month = active ? (active.adhoc ? 'adhoc' : active.month) : months[1] || months[0] || 'adhoc';
      }
      let q = '';
      const inMonth = (r) => (month === 'adhoc' ? !!r.adhoc : !r.adhoc && r.month === month);

      function draw() {
        const list = rs.filter(inMonth);
        const rows = list.filter((r) => !q || norm(r.name).includes(norm(q))).map((r) => {
          const s = C().roundSummary(r.id);
          return { id: r.id, name: r.name, scope: scopeLabel(r.scope), items: r.items.length, students: s.students, due: s.due, paid: s.paid, remaining: s.remaining, state: roundState(r, s), notice: r.notice };
        });
        const tot = list.reduce((t, r) => { const s = C().roundSummary(r.id); t.due += s.due; t.paid += s.paid; t.rem += s.remaining; return t; }, { due: 0, paid: 0, rem: 0 });
        const tab = (key, label) => {
          const n = rs.filter((r) => (key === 'adhoc' ? r.adhoc : !r.adhoc && r.month === key)).length;
          return '<a class="vtab' + (key === month ? ' active' : '') + (n ? '' : ' dim') + '" href="#/dot-thu?month=' + key + '">' + '<span>' + esc(label) + '</span><span class="dt-cnt">' + n + ' đợt</span></a>';
        };
        el.innerHTML =
          '<h1 class="view-title">Đợt thu</h1>' +
          '<div class="split dt-list" style="--split-left:255px">' +
          '<div class="card dt-months"><nav class="vtabs" aria-label="Tháng thu">' +
          months.map((m) => tab(m, 'Tháng ' + monthLabel(m))).join('') + tab('adhoc', 'Thu không đăng ký trước') +
          '</nav></div>' +
          '<div class="stack">' +
          '<div class="stats dt-stats">' +
          UI.stat({ label: 'SỐ ĐỢT THU', value: String(list.length) }) +
          UI.stat({ label: 'TỔNG PHẢI THU (đ)', value: money(tot.due) || '0' }) +
          UI.stat({ label: 'ĐÃ THU (đ)', value: money(tot.paid) || '0', tone: 'success' }) +
          UI.stat({ label: 'CÒN PHẢI THU (đ)', value: money(tot.rem) || '0', tone: 'warning' }) +
          '</div>' +
          '<div class="toolbar"><div class="dt-search">' + UI.search({ id: 'dtQ', placeholder: 'Tìm kiếm theo tên đợt thu...', value: q }) + '</div><span class="grow"></span>' +
          btn({ label: 'Lập đợt thu', icon: 'plus', variant: 'primary', action: 'new' }) + '</div>' +
          grid({
            id: 'dtGrid', rows, clickable: true, striped: true,
            empty: month === 'adhoc' ? 'Chưa có đợt thu không đăng ký trước' : 'Chưa có đợt thu trong tháng ' + monthLabel(month),
            columns: [
              { key: 'name', label: 'Tên đợt thu', render: (r) => '<a class="dt-link" href="#/dot-thu/' + esc(r.id) + '">' + esc(r.name) + '</a>' + (r.notice ? ' <span class="dt-sent" title="Đã gửi thông báo ' + esc(r.notice.sentAt) + '">' + icon('bell') + '</span>' : '') },
              { key: 'scope', label: 'Phạm vi' },
              { key: 'items', label: 'Khoản thu' },
              { key: 'students', label: 'Học sinh', render: (r) => money(r.students) },
              { key: 'due', label: 'Phải thu', render: (r) => money(r.due) || '0' },
              { key: 'paid', label: 'Đã thu', render: (r) => money(r.paid) || '0' },
              { key: 'remaining', label: 'Còn phải thu', render: (r) => money(r.remaining) || '0' },
              { key: 'state', label: 'Trạng thái' },
            ],
          }) + '</div></div>';
        UI.bindGrid($('#dtGrid', el), { onRowClick: (k, e) => { if (!e.target.closest('a')) App.go('/dot-thu/' + k); } });
        const qi = $('#dtQ', el);
        qi.addEventListener('input', () => { q = qi.value; const p = qi.selectionStart; draw(); const n = $('#dtQ', el); n.focus(); n.setSelectionRange(p, p); });
      }
      el.onclick = (e) => { const a = e.target.closest('[data-action="new"]'); if (a) openNewRound(year, month, draw); };
      draw();
      if (query.dialog === 'new') openNewRound(year, month, draw);
    },
  });

  // Fee checklist used by 10a and 10c: [{feeId, qty}] preselected.
  function feePicker(items) {
    const sel = {}; items.forEach((it) => (sel[it.feeId] = it.qty));
    const fees = (D.feeItems || []).slice().sort((a, b) => (b.id in sel) - (a.id in sel));
    return '<div class="ui-grid-wrap dt-picker"><table class="ui-grid"><thead><tr><th class="chk-col"><input type="checkbox" class="dt-all" aria-label="Chọn tất cả"' + (fees.every((f) => f.id in sel) ? ' checked' : '') + '></th><th>Khoản thu</th><th style="width:150px">Số lượng</th><th>Đơn vị</th><th class="num">Đơn giá</th></tr></thead><tbody>' +
      fees.map((f) => {
        const on = f.id in sel;
        return '<tr data-fee="' + f.id + '"' + (on ? ' class="selected"' : '') + '><td class="chk-col"><input type="checkbox" class="dt-fee" aria-label="Chọn ' + esc(f.name) + '"' + (on ? ' checked' : '') + '></td>' +
          '<td>' + esc(f.name) + (f.mandatory ? '' : ' <span class="muted">(tự chọn)</span>') + '</td>' +
          '<td><input class="ctl num dt-qty" type="number" min="1" step="1" aria-label="Số lượng ' + esc(f.name) + '" value="' + (on ? sel[f.id] : f.defaultQty || 1) + '"' + (on ? '' : ' disabled') + '></td>' +
          '<td>' + esc(C().unitName(f.unitId)) + '</td><td class="num">' + money(f.price) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function bindPicker(dlg) {
    const sync = (tr) => { const c = tr.querySelector('.dt-fee'); tr.classList.toggle('selected', c.checked); tr.querySelector('.dt-qty').disabled = !c.checked; };
    dlg.addEventListener('change', (e) => {
      if (e.target.classList.contains('dt-fee')) sync(e.target.closest('tr'));
      if (e.target.classList.contains('dt-all')) $$('tr[data-fee]', dlg).forEach((tr) => { tr.querySelector('.dt-fee').checked = e.target.checked; sync(tr); });
    });
  }
  const readPicker = (dlg) => $$('tr[data-fee]', dlg).filter((tr) => tr.querySelector('.dt-fee').checked).map((tr) => ({ feeId: tr.dataset.fee, qty: Math.max(1, parseInt(tr.querySelector('.dt-qty').value, 10) || 1) }));

  // 10a — Lập đợt thu (creates a round in App.data.rounds)
  function openNewRound(year, month, redraw) {
    const rs = yearRounds(year.id);
    const ym = month === 'adhoc' ? yearMonths(year)[1] : month;
    const n = rs.filter((r) => r.month === ym).length + 1;
    const defItems = (D.feeItems || []).filter((f) => f.cycle === 'thang').map((f) => ({ feeId: f.id, qty: f.defaultQty || 1 }));
    dialog({
      title: 'Lập đợt thu', width: '670px',
      body: '<div class="dt-form-row">' +
        field({ label: 'Tên đợt thu', name: 'name', required: true, value: month === 'adhoc' ? 'Thu không đăng ký trước ' + n : 'Đợt ' + n + ' · ' + monthLabel(ym) }) +
        field({ label: 'Phạm vi', name: 'scope', type: 'select', options: scopeOptions(year.id), value: 'all' }) + '</div>' +
        '<div class="dt-sec">Chọn khoản thu' + (month === 'adhoc' ? '' : ' · tháng ' + monthLabel(ym)) + '</div>' + feePicker(defItems) +
        '<div class="dt-err" hidden>Chọn ít nhất một khoản thu.</div>',
      footer: btn({ label: 'Hủy', action: 'close' }) + btn({ label: 'Đồng ý', variant: 'primary', action: 'ok' }),
      onMount(dlg, close) {
        bindPicker(dlg);
        dlg.querySelector('[data-action="ok"]').addEventListener('click', () => {
          if (!UI.validate(dlg)) return;
          const v = UI.formValues(dlg); const items = readPicker(dlg);
          const err = dlg.querySelector('.dt-err'); err.hidden = items.length > 0; if (!items.length) return;
          const r = { id: UI.uid('r'), yearId: year.id, month: ym, name: v.name.trim(), scope: v.scope, status: 'chua-thu', createdAt: today(), items };
          if (month === 'adhoc') r.adhoc = true;
          D.rounds.push(r); App.save(); close();
          toast('Đã lập đợt thu "' + r.name + '" · ' + C().roundSummary(r.id).students + ' học sinh', 'success');
          if (location.hash.includes('dialog=new')) App.go('/dot-thu?month=' + month); else redraw();
        });
      },
    });
  }

  // ======================================================================
  // 10b — Tổng quan đợt thu
  // ======================================================================
  function nodeLabel(node) {
    if (!node || node === 'all') return 'Toàn trường';
    if (node[0] === 'g') return gradeName(node);
    return 'Lớp ' + className(node);
  }
  function nodeStudents(r, node) {
    const all = C().roundStudents(r.id);
    if (!node || node === 'all') return all;
    return all.filter((st) => { const c = C().classOf(st, r.yearId); return c && (node[0] === 'g' ? c.gradeId === node : c.id === node); });
  }
  // Aggregate per-fee amounts + due/paid for a set of students.
  function agg(r, studs) {
    const fees = {}; r.items.forEach((it) => (fees[it.feeId] = 0));
    let due = 0, paid = 0;
    studs.forEach((st) => {
      C().studentDue(st.id, r.id).lines.forEach((l) => { fees[l.feeId] = (fees[l.feeId] || 0) + l.amount; });
      const s = C().studentStatus(st.id, r.id); due += s.due; paid += s.paid;
    });
    return { fees, due, paid, remaining: Math.max(0, due - paid), students: studs.length };
  }

  route('/dot-thu/:id', {
    title: 'Tổng quan đợt thu', menu: 'dot-thu',
    render(ctx) {
      const { el, params, query } = ctx;
      const r = round(params.id);
      if (!r) { UI.placeholder(el, 'Không tìm thấy đợt thu', 'Đợt thu này không tồn tại hoặc đã bị xóa.'); return; }
      const node = query.node || 'all';
      let q = '';
      const collapsedG = {};
      const tStuds = C().roundStudents(r.id);
      const tree = () => {
        const gs = grades().filter((g) => tStuds.some((st) => (C().classOf(st, r.yearId) || {}).gradeId === g.id));
        const cnt = (n) => money(nodeStudents(r, n).length) || '0';
        let h = '<a class="tree-item' + (node === 'all' ? ' active' : '') + '" href="#/dot-thu/' + r.id + '">' + icon('institution') + '<span>Toàn trường</span><span class="cnt">' + cnt('all') + '</span></a>';
        gs.forEach((g) => {
          const cls = classesOf(r.yearId, g.id).filter((c) => nodeStudents(r, c.id).length);
          const open = !collapsedG[g.id];
          h += '<div class="dt-tnode"><button type="button" class="dt-chev" data-toggle="' + g.id + '" aria-label="' + (open ? 'Thu gọn ' : 'Mở rộng ') + esc(g.name) + '" aria-expanded="' + open + '">' + icon(open ? 'angle-down' : 'angle-right') + '</button>' +
            '<a class="tree-item l1' + (node === g.id ? ' active' : '') + '" href="#/dot-thu/' + r.id + '?node=' + g.id + '"><span>' + esc(g.name) + '</span><span class="cnt">' + cnt(g.id) + '</span></a></div>';
          if (open) cls.forEach((c) => { h += '<a class="tree-item l2' + (node === c.id ? ' active' : '') + '" href="#/dot-thu/' + r.id + '?node=' + c.id + '"><span>' + esc(c.name) + '</span><span class="cnt">' + cnt(c.id) + '</span></a>'; });
        });
        return h;
      };

      function tableHTML() {
        const feeCols = r.items.map((it) => ({ key: 'f_' + it.feeId, label: feeName(it.feeId), align: 'right', render: (row) => (row.fees[it.feeId] == null ? '<span class="muted">—</span>' : money(row.fees[it.feeId]) || '0') }));
        const moneyCols = [
          { key: 'due', label: 'Tổng phải thu', align: 'right', render: (x) => '<b>' + (money(x.due) || '0') + '</b>' },
          { key: 'paid', label: 'Đã thu', align: 'right', render: (x) => '<span class="dt-ok">' + (money(x.paid) || '0') + '</span>' },
          { key: 'remaining', label: 'Còn phải thu', align: 'right', render: (x) => (x.remaining ? '<span class="dt-warn">' + money(x.remaining) + '</span>' : '0') },
        ];
        let rows, cols;
        if (node === 'all' || node[0] === 'g') {
          const units = node === 'all'
            ? grades().map((g) => ({ id: g.id, name: g.name, studs: nodeStudents(r, g.id), sub: classesOf(r.yearId, g.id).filter((c) => nodeStudents(r, c.id).length).length }))
            : classesOf(r.yearId, node).map((c) => ({ id: c.id, name: 'Lớp ' + c.name, studs: nodeStudents(r, c.id), sub: c.teacher }));
          rows = units.filter((u) => u.studs.length && (!q || norm(u.name).includes(norm(q)))).map((u) => Object.assign({ id: u.id, name: u.name, sub: u.sub }, agg(r, u.studs)));
          cols = [
            { key: 'stt', label: 'STT', width: '50px', render: (x, i) => i + 1 },
            { key: 'name', label: node === 'all' ? 'Khối' : 'Lớp', render: (x) => '<a class="dt-link" href="#/dot-thu/' + r.id + '?node=' + x.id + '">' + esc(x.name) + '</a>' },
            node === 'all' ? { key: 'sub', label: 'Số lớp', align: 'right' } : { key: 'sub', label: 'GVCN' },
            { key: 'students', label: 'Số học sinh', align: 'right' },
          ].concat(feeCols, moneyCols);
        } else {
          const studs = nodeStudents(r, node).filter((st) => !q || norm(st.name + ' ' + st.code).includes(norm(q)));
          rows = studs.map((st) => {
            const d = C().studentDue(st.id, r.id); const s = C().studentStatus(st.id, r.id);
            const fees = {}; d.lines.forEach((l) => (fees[l.feeId] = l.amount));
            return { id: st.id, name: st.name, code: st.code, fees, due: s.due, paid: s.paid, remaining: s.remaining, status: s.status };
          });
          cols = [
            { key: 'stt', label: 'STT', width: '50px', render: (x, i) => i + 1 },
            { key: 'name', label: 'Học sinh', cls: 'dt-namecell', render: (x) => '<div class="dt-namewrap"><span>' + esc(x.name) + '</span>' + btn({ icon: 'ellipsis-dots-v', aria: 'Thao tác với ' + x.name, variant: 'tertiary', cls: 'sm dt-rowmenu', attrs: { 'data-stu': x.id } }) + '</div>' },
            { key: 'code', label: 'Mã học sinh' },
          ].concat(feeCols, moneyCols, [{ key: 'status', label: 'Trạng thái', render: (x) => { const [t, tone] = C().STATUS_LABEL[x.status]; return badge(t, tone); } }]);
        }
        const tot = rows.reduce((t, x) => { t.due += x.due; t.paid += x.paid; t.remaining += x.remaining; r.items.forEach((it) => { t.fees[it.feeId] += x.fees[it.feeId] || 0; }); return t; }, { due: 0, paid: 0, remaining: 0, fees: Object.fromEntries(r.items.map((it) => [it.feeId, 0])) });
        const foot = rows.length ? '<tr>' + cols.map((c, i) => {
          if (i === 1) return '<td>Tổng cộng</td>';
          if (c.key.startsWith('f_')) return '<td class="num">' + (money(tot.fees[c.key.slice(2)]) || '0') + '</td>';
          if (['due', 'paid', 'remaining'].includes(c.key)) return '<td class="num">' + (money(tot[c.key]) || '0') + '</td>';
          if (c.key === 'students') return '<td class="num">' + money(rows.reduce((t, x) => t + x.students, 0)) + '</td>';
          return '<td></td>';
        }).join('') + '</tr>' : '';
        return grid({ id: 'dtOv', rows, columns: cols, striped: true, foot, empty: 'Không có dữ liệu phù hợp' });
      }

      function metrics() {
        const studs = nodeStudents(r, node); const a = agg(r, studs);
        let m1;
        if (node === 'all') m1 = UI.stat({ label: 'Số khối', value: String(grades().filter((g) => nodeStudents(r, g.id).length).length) });
        else if (node[0] === 'g') m1 = UI.stat({ label: 'Số lớp', value: String(classesOf(r.yearId, node).filter((c) => nodeStudents(r, c.id).length).length) });
        else m1 = UI.stat({ label: 'Số học sinh', value: String(studs.length) });
        return m1 + UI.stat({ label: 'Số khoản thu', value: String(r.items.length) }) +
          UI.stat({ label: 'Tổng phải thu (đ)', html: esc(money(a.due) || '0') + '<div class="dt-sub">Đã thu <b class="dt-ok">' + (money(a.paid) || '0') + '</b> · Còn <b class="dt-warn">' + (money(a.remaining) || '0') + '</b></div>' });
      }

      function draw() {
        const searchPh = node === 'all' ? 'Tìm theo tên khối...' : node[0] === 'g' ? 'Tìm theo tên lớp...' : 'Tìm theo tên học sinh...';
        el.innerHTML =
          '<div class="view-head"><div class="dt-titlebox"><div class="dt-crumb"><a href="#/dot-thu?month=' + (r.adhoc ? 'adhoc' : r.month) + '">Đợt thu</a> / ' + esc(r.name) + ' <span class="dt-scope">(phạm vi: ' + esc(scopeLabel(r.scope)) + ')</span></div>' +
          '<h1 class="view-title">Tổng quan đợt thu</h1></div><span class="grow"></span>' +
          btn({ label: 'Cập nhật đợt thu', icon: 'refresh', action: 'items' }) +
          '<a class="btn" href="#/thu-tien?round=' + esc(r.id) + '">' + icon('money') + '<span>Thu tiền</span></a></div>' +
          '<div class="split dt-ov" style="--split-left:280px">' +
          '<div class="card dt-treecard"><div class="dt-treesearch">' + UI.search({ id: 'dtTreeQ', placeholder: 'Tìm khối, lớp...' }) + '</div><div class="tree" id="dtTree">' + tree() + '</div></div>' +
          '<div class="stack">' +
          '<h2 class="dt-ctx">' + esc(nodeLabel(node)) + (r.notice ? ' <span class="badge success">' + icon('bell') + 'Đã gửi thông báo ' + esc(r.notice.sentAt) + '</span>' : '') + '</h2>' +
          '<div class="stats dt-stats3">' + metrics() + '</div>' +
          '<div class="toolbar"><div class="grow">' + UI.search({ id: 'dtOvQ', placeholder: searchPh, value: q }) + '</div>' +
          btn({ label: 'Thông báo thu tiền', icon: 'bell', variant: 'primary', action: 'notice' }) + '</div>' +
          '<div id="dtTable">' + tableHTML() + '</div>' +
          '</div></div>';
        const qi = $('#dtOvQ', el);
        qi.addEventListener('input', () => { q = qi.value; $('#dtTable', el).innerHTML = tableHTML(); });
        const tq = $('#dtTreeQ', el);
        tq.addEventListener('input', () => {
          const v = norm(tq.value);
          $$('#dtTree .tree-item', el).forEach((a) => { const hit = !v || norm(a.textContent).includes(v); (a.parentElement.classList.contains('dt-tnode') ? a.parentElement : a).style.display = hit ? '' : 'none'; });
        });
      }

      el.onclick = (e) => {
        const t = e.target.closest('[data-toggle]');
        if (t) { collapsedG[t.dataset.toggle] = !collapsedG[t.dataset.toggle]; $('#dtTree', el).innerHTML = tree(); return; }
        const m = e.target.closest('.dt-rowmenu');
        if (m) { openStudentMenu(m, r, m.dataset.stu, draw); return; }
        const a = e.target.closest('[data-action]');
        if (!a) return;
        if (a.dataset.action === 'items') openRoundEdit(r, draw);
        if (a.dataset.action === 'notice') App.go('/thong-bao/' + r.id + (node !== 'all' ? '?node=' + node : ''));
      };
      draw();

      // Deep links to Figma states
      if (query.menu) {
        const b = el.querySelector('.dt-rowmenu[data-stu="' + query.menu + '"]');
        if (b) {
          b.scrollIntoView({ block: 'nearest' });
          if (query.dialog === 'reg-once' || query.dialog === 'reg-forward') openRegister(r, query.menu, query.dialog === 'reg-once' ? 'once' : 'forward', draw);
          else setTimeout(() => openStudentMenu(b, r, query.menu, draw), 0);
        }
      }
      if (query.dialog === 'items') openRoundEdit(r, draw);
    },
  });

  // 10b.4 — per-student actions
  function openStudentMenu(anchor, r, sid, redraw) {
    const m = menu(anchor, [
      { label: 'Đăng ký khoản thu', icon: 'check-square-o', onClick: () => openRegister(r, sid, 'once', redraw) },
      { label: 'Xem khoản phải thu', icon: 'search-plus', onClick: () => openStudentDue(r, sid) },
    ]);
    m.classList.add('dt-menu');
    return m;
  }

  function openStudentDue(r, sid) {
    const st = (D.students || []).find((x) => x.id === sid);
    const d = C().studentDue(sid, r.id); const s = C().studentStatus(sid, r.id); const [t, tone] = C().STATUS_LABEL[s.status];
    dialog({
      title: 'Khoản phải thu · ' + st.name, width: '640px',
      body: '<p class="muted" style="margin:0 0 12px">Lớp ' + esc((C().classOf(st, r.yearId) || {}).name || '') + ' · ' + esc(st.code) + ' · ' + esc(r.name) + '</p>' +
        grid({ rows: d.lines.map((l) => Object.assign({ id: l.feeId }, l)), striped: true, columns: [
          { key: 'name', label: 'Khoản thu' }, { key: 'qty', label: 'SL', align: 'right' }, { key: 'unit', label: 'Đơn vị' },
          { key: 'price', label: 'Đơn giá', align: 'right', render: (x) => money(x.price) },
          { key: 'discount', label: 'Miễn giảm', align: 'right', render: (x) => (x.discount ? money(x.discount) : '—') },
          { key: 'amount', label: 'Thành tiền', align: 'right', render: (x) => money(x.amount) || '0' },
        ], empty: 'Học sinh không phải thu khoản nào trong đợt này',
        foot: '<tr><td colspan="5">Tổng phải thu · Đã thu ' + (money(s.paid) || '0') + ' · ' + badge(t, tone) + '</td><td class="num">' + (money(s.due) || '0') + '</td></tr>' }),
      footer: btn({ label: 'Đóng', action: 'close' }) + '<a class="btn primary" href="#/thu-tien?round=' + esc(r.id) + '&student=' + esc(sid) + '" data-action="close">' + icon('money') + '<span>Thu tiền</span></a>',
    });
  }

  // ---------- registration logic (10b.5 / 10b.6) ----------
  function baseApplies(f, sid) { return f.mandatory || ((D.registrations || {})[sid] || []).includes(f.id); }
  function setOverride(rid, sid, f, want) {
    D.roundOverrides = D.roundOverrides || {};
    const byR = (D.roundOverrides[rid] = D.roundOverrides[rid] || {});
    const ov = (byR[sid] = byR[sid] || { add: [], remove: [] });
    ov.add = ov.add.filter((x) => x !== f.id); ov.remove = ov.remove.filter((x) => x !== f.id);
    if (want !== baseApplies(f, sid)) (want ? ov.add : ov.remove).push(f.id);
    if (!ov.add.length && !ov.remove.length) delete byR[sid];
    if (!Object.keys(byR).length) delete D.roundOverrides[rid];
  }
  const applies = (rid, sid, feeId) => C().studentDue(sid, rid).lines.some((l) => l.feeId === feeId);
  function applyForward(r, sid, f, want) {
    const st = (D.students || []).find((x) => x.id === sid);
    const withFee = (D.rounds || []).filter((x) => x.yearId === r.yearId && x.items.some((it) => it.feeId === f.id) && C().inScope(st, x));
    const later = withFee.filter((x) => x.id === r.id || x.month > r.month);
    const earlier = withFee.filter((x) => !later.includes(x));
    if (f.mandatory) { later.forEach((x) => setOverride(x.id, sid, f, want)); return; }
    const before = earlier.map((x) => [x, applies(x.id, sid, f.id)]);
    D.registrations = D.registrations || {};
    const reg = (D.registrations[sid] = (D.registrations[sid] || []).filter((x) => x !== f.id));
    if (want) reg.push(f.id);
    before.forEach(([x, was]) => setOverride(x.id, sid, f, was)); // keep earlier rounds unchanged
    later.forEach((x) => setOverride(x.id, sid, f, want));
  }

  function openRegister(r, sid, defScope, redraw) {
    const st = (D.students || []).find((x) => x.id === sid); if (!st) return;
    const cls = C().classOf(st, r.yearId);
    const rows = r.items.map((it) => { const f = C().fee(it.feeId); return { f, qty: it.qty, on: applies(r.id, sid, f.id), reg: baseApplies(f, sid) }; });
    const statusBadge = (x) => (x.on ? badge(x.reg ? 'Đang áp dụng' : 'Riêng đợt này', x.reg ? 'success' : 'accent') : badge(x.reg ? 'Miễn đợt này' : 'Chưa đăng ký', x.reg ? 'warning' : ''));
    const body =
      '<div class="dt-reg-head"><div><div class="dt-reg-name">' + esc(st.name) + '</div><div class="muted">Lớp ' + esc(cls ? cls.name : '') + ' · ' + esc(st.code) + '</div></div>' +
      '<p class="dt-reg-guide">Tích chọn khoản thu học sinh phải nộp và chọn phạm vi áp dụng: chỉ đợt này hoặc từ đợt này trở đi.</p></div>' +
      '<div class="ui-grid-wrap"><table class="ui-grid dt-reg"><thead><tr><th class="chk-col"></th><th>Khoản thu</th><th>Đơn vị</th><th class="num">Đơn giá</th><th>Phạm vi áp dụng</th><th>Trạng thái hiện tại</th></tr></thead><tbody>' +
      rows.map((x) => '<tr data-fee="' + x.f.id + '"><td class="chk-col"><input type="checkbox" class="dt-regchk" aria-label="Áp dụng ' + esc(x.f.name) + '"' + (x.on ? ' checked' : '') + '></td>' +
        '<td>' + esc(x.f.name) + (x.f.mandatory ? ' <span class="muted">(bắt buộc)</span>' : '') + '</td><td>' + esc(C().unitName(x.f.unitId)) + '</td><td class="num">' + money(x.f.price) + '</td>' +
        '<td><select class="ctl dt-regscope" aria-label="Phạm vi áp dụng ' + esc(x.f.name) + '"><option value="once"' + (defScope === 'once' ? ' selected' : '') + '>Chỉ đợt này</option><option value="forward"' + (defScope === 'forward' ? ' selected' : '') + '>Từ đợt này trở đi</option></select></td>' +
        '<td>' + statusBadge(x) + '</td></tr>').join('') +
      '</tbody></table></div>' +
      '<div class="note dt-reg-note">Lưu ý: thay đổi với phạm vi “Chỉ đợt này” chỉ áp dụng cho đợt thu <b>' + esc(r.name) + '</b>, không làm thay đổi đăng ký khoản thu của học sinh.</div>';
    dialog({
      title: 'Đăng ký khoản thu', width: '860px', body,
      footer: btn({ label: 'Hủy', action: 'close' }) + btn({ label: 'Đồng ý', variant: 'primary', action: 'ok' }),
      onMount(dlg, close) {
        // The note (10b.5) shows while any row uses "Chỉ đợt này"; 10b.6 (all "Từ đợt này trở đi") has none.
        const syncNote = () => { dlg.querySelector('.dt-reg-note').hidden = !$$('.dt-regscope', dlg).some((s) => s.value === 'once'); };
        dlg.addEventListener('change', syncNote); syncNote();
        dlg.querySelector('[data-action="ok"]').addEventListener('click', () => {
          let changed = 0;
          $$('tr[data-fee]', dlg).forEach((tr) => {
            const f = C().fee(tr.dataset.fee); const want = tr.querySelector('.dt-regchk').checked; const scope = tr.querySelector('.dt-regscope').value;
            if (scope === 'once') { if (want !== applies(r.id, sid, f.id)) { setOverride(r.id, sid, f, want); changed++; } }
            else if (want !== applies(r.id, sid, f.id) || (!f.mandatory && want !== baseApplies(f, sid))) { applyForward(r, sid, f, want); changed++; }
          });
          App.save(); close();
          if (location.hash.includes('dialog=reg')) App.go('/dot-thu/' + r.id + '?node=' + (cls ? cls.id : 'all'));
          else redraw();
          toast(changed ? 'Đã cập nhật ' + changed + ' khoản thu cho ' + st.name + ' · phải thu ' + (money(C().studentStatus(sid, r.id).due) || '0') + ' đ' : 'Không có thay đổi', changed ? 'success' : undefined);
        });
      },
    });
  }

  // 10c — Cập nhật đợt thu (name, scope, items + quantities)
  function openRoundEdit(r, redraw) {
    const hasPay = (D.payments || []).some((p) => p.roundId === r.id && p.status !== 'da-huy');
    dialog({
      title: 'Cập nhật đợt thu', width: '670px',
      body: '<div class="dt-form-row">' + field({ label: 'Tên đợt thu', name: 'name', required: true, value: r.name }) +
        field({ label: 'Phạm vi', name: 'scope', type: 'select', options: scopeOptions(r.yearId), value: r.scope || 'all' }) + '</div>' +
        '<div class="dt-sec">Khoản thu trong đợt</div>' + feePicker(r.items) +
        (hasPay ? '<div class="note warning" style="margin-top:12px">Đợt thu đã có phiếu thu. Thay đổi khoản thu sẽ tính lại số còn phải thu của học sinh.</div>' : '') +
        '<div class="dt-err" hidden>Chọn ít nhất một khoản thu.</div>',
      footer: btn({ label: 'Hủy', action: 'close' }) + btn({ label: 'Cập nhật', variant: 'primary', action: 'ok' }),
      onMount(dlg, close) {
        bindPicker(dlg);
        dlg.querySelector('[data-action="ok"]').addEventListener('click', () => {
          if (!UI.validate(dlg)) return;
          const v = UI.formValues(dlg); const items = readPicker(dlg);
          const err = dlg.querySelector('.dt-err'); err.hidden = items.length > 0; if (!items.length) return;
          r.name = v.name.trim(); r.scope = v.scope; r.items = items; App.save(); close();
          toast('Đã cập nhật đợt thu "' + r.name + '"', 'success');
          if (location.hash.includes('dialog=items')) App.go('/dot-thu/' + r.id); else redraw();
        });
      },
    });
  }

  // ======================================================================
  // 11.2 — Thông báo thu tiền / Thiết lập gửi
  // ======================================================================
  const CHANNELS = [
    { id: 'app', label: 'Ứng dụng phụ huynh (thông báo đẩy)' },
    { id: 'zalo', label: 'Zalo OA của trường' },
    { id: 'sms', label: 'Tin nhắn SMS' },
  ];
  const DEFAULT_TPL = 'Kính gửi Quý phụ huynh em {hoc_sinh} – lớp {lop}.\nNhà trường thông báo khoản thu {dot_thu} với tổng số tiền {so_tien} đồng. Quý phụ huynh vui lòng thanh toán trước ngày {han_thanh_toan} bằng tiền mặt tại phòng Kế toán hoặc chuyển khoản theo mã QR đính kèm.\nTrân trọng cảm ơn.';

  route('/thong-bao/:id', {
    title: 'Thông báo thu tiền', menu: 'dot-thu',
    render(ctx) {
      const { el, params, query } = ctx;
      const r = round(params.id);
      if (!r) { UI.placeholder(el, 'Không tìm thấy đợt thu', 'Đợt thu này không tồn tại hoặc đã bị xóa.'); return; }
      const node = query.node || 'all';
      const recips = nodeStudents(r, node).filter((st) => C().studentStatus(st.id, r.id).remaining > 0);
      const [y, m] = r.month.split('-').map(Number);
      const deadlines = [10, 15, 20, 25].map((d) => pad(d) + '/' + pad(m) + '/' + y);
      const st0 = r.notice || {};
      const state = { deadline: st0.deadline || deadlines[1], channels: st0.channels || ['app', 'zalo'], partial: st0.partial !== false, tpl: st0.template || DEFAULT_TPL, i: 0 };

      const fill = (tpl, st) => {
        const c = C().classOf(st, r.yearId); const s = C().studentStatus(st.id, r.id);
        return tpl.replace(/\{hoc_sinh\}/g, st.name).replace(/\{lop\}/g, c ? c.name : '').replace(/\{dot_thu\}/g, r.name)
          .replace(/\{so_tien\}/g, money(s.remaining) || '0').replace(/\{han_thanh_toan\}/g, state.deadline);
      };
      function preview() {
        const st = recips[state.i];
        if (!st) return '<div class="dt-pv-empty muted">Không có học sinh nào còn phải thu trong phạm vi này.</div>';
        const c = C().classOf(st, r.yearId); const d = C().studentDue(st.id, r.id); const s = C().studentStatus(st.id, r.id);
        const school = D.school || {};
        return '<div class="dt-pv-head"><h2>Xem trước thông báo</h2><span class="grow"></span>' +
          btn({ icon: 'angle-left', aria: 'Học sinh trước', variant: 'tertiary', cls: 'sm', action: 'prev', disabled: state.i === 0 }) +
          '<span class="muted dt-pv-idx">' + (state.i + 1) + '/' + recips.length + '</span>' +
          btn({ icon: 'angle-right', aria: 'Học sinh sau', variant: 'tertiary', cls: 'sm', action: 'next', disabled: state.i >= recips.length - 1 }) + '</div>' +
          '<div class="dt-pv-meta">' + esc(st.name) + ' · Lớp ' + esc(c ? c.name : '') + ' · ' + esc(st.code) + '</div>' +
          '<div class="dt-pv-school"><b>' + esc(school.name || '') + '</b><br>' + esc(school.address || '') + '<p>' + esc(fill(state.tpl, st)).replace(/\n/g, '<br>') + '</p></div>' +
          '<hr class="dt-pv-div">' +
          '<div class="dt-pv-items">' + d.lines.map((l) => '<div><span>' + esc(l.name) + (l.qty > 1 ? ' <span class="muted">× ' + l.qty + '</span>' : '') + '</span><span class="num">' + money(l.amount) + '</span></div>').join('') +
          (s.paid ? '<div class="muted"><span>Đã thu</span><span class="num">−' + money(s.paid) + '</span></div>' : '') + '</div>' +
          '<div class="dt-pv-foot"><div><div class="dt-pv-tl">Tổng cần thanh toán</div><div class="dt-pv-total">' + (money(s.remaining) || '0') + ' đ</div>' +
          '<div class="dt-pv-dl">Hạn thanh toán: <b>' + esc(state.deadline) + '</b>' + (state.partial ? '<br><span class="muted">Cho phép thanh toán một phần</span>' : '') + '</div></div>' +
          '<div class="dt-qr" aria-label="Mã QR thanh toán">' + icon('qrcode') + '</div></div>' +
          '<div class="dt-pv-qrnote muted">Quét mã QR bằng ứng dụng ngân hàng để chuyển khoản đúng số tiền và nội dung.</div>' +
          '<div class="dt-pv-bank">Ngân hàng <b>' + esc(school.bank || '') + '</b> · STK <b>' + esc(school.account || '') + '</b><br>Nội dung: <b>' + esc(st.code + ' ' + r.id.toUpperCase()) + '</b></div>';
      }
      function draw() {
        el.innerHTML =
          '<div class="view-head"><div class="dt-titlebox"><div class="dt-crumb"><a href="#/dot-thu?month=' + (r.adhoc ? 'adhoc' : r.month) + '">Đợt thu</a> / <a href="#/dot-thu/' + r.id + (node !== 'all' ? '?node=' + node : '') + '">' + esc(r.name) + '</a></div>' +
          '<h1 class="view-title">Thông báo thu tiền</h1></div></div>' +
          '<div class="dt-notice">' +
          '<section class="card dt-set">' +
          '<h2 class="dt-h">Thiết lập gửi thông báo</h2>' +
          '<div class="muted">Đã chọn <b class="dt-count">' + recips.length + '</b> học sinh còn phải thu · ' + esc(nodeLabel(node)) + (r.notice ? ' · Lần gửi gần nhất ' + esc(r.notice.sentAt) : '') + '</div>' +
          '<div class="dt-form-row eq">' +
          field({ label: 'Đợt thu', id: 'ntRound', type: 'select', value: r.id, options: yearRounds(r.yearId).map((x) => ({ value: x.id, label: x.name })) }) +
          field({ label: 'Hạn thanh toán', id: 'ntDeadline', type: 'select', value: state.deadline, options: deadlines }) + '</div>' +
          '<div class="dt-form-row eq"><div><div class="dt-lbl">Kênh gửi</div><div class="stack dt-chks">' +
          CHANNELS.map((c) => '<label class="chk"><input type="checkbox" class="nt-ch" value="' + c.id + '"' + (state.channels.includes(c.id) ? ' checked' : '') + '>' + esc(c.label) + '</label>').join('') + '</div></div>' +
          '<div><div class="dt-lbl">&nbsp;</div><label class="chk"><input type="checkbox" id="ntPartial"' + (state.partial ? ' checked' : '') + '>Cho phép thanh toán một phần</label>' +
          '<div class="muted dt-small">Phụ huynh có thể thanh toán nhiều lần cho đến khi đủ số tiền.</div></div></div>' +
          '<div class="field"><label for="ntTpl">Nội dung thông báo</label><textarea class="ctl dt-tpl" id="ntTpl">' + esc(state.tpl) + '</textarea>' +
          '<div class="help">Trường dữ liệu: {hoc_sinh}, {lop}, {dot_thu}, {so_tien}, {han_thanh_toan}</div></div>' +
          '<div class="row end dt-set-foot">' + btn({ label: 'Xem trước', icon: 'eye', action: 'preview' }) +
          btn({ label: 'Gửi ' + recips.length + ' thông báo', icon: 'paperplane', variant: 'primary', action: 'send', disabled: !recips.length }) + '</div>' +
          '</section>' +
          '<section class="card dt-preview" id="ntPreview">' + preview() + '</section>' +
          '</div>';
      }
      const repaint = () => { $('#ntPreview', el).innerHTML = preview(); };
      el.onchange = (e) => {
        const t = e.target;
        if (t.id === 'ntRound') { App.go('/thong-bao/' + t.value); return; }
        if (t.id === 'ntDeadline') state.deadline = t.value;
        if (t.id === 'ntPartial') state.partial = t.checked;
        if (t.classList.contains('nt-ch')) state.channels = $$('.nt-ch', el).filter((x) => x.checked).map((x) => x.value);
        repaint();
      };
      el.oninput = (e) => { if (e.target.id === 'ntTpl') { state.tpl = e.target.value; repaint(); } };
      el.onclick = (e) => {
        const a = e.target.closest('[data-action]'); if (!a || a.disabled) return;
        const act = a.dataset.action;
        if (act === 'prev') { state.i = Math.max(0, state.i - 1); repaint(); }
        if (act === 'next') { state.i = Math.min(recips.length - 1, state.i + 1); repaint(); }
        if (act === 'preview') { const p = $('#ntPreview', el); p.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); p.classList.remove('dt-flash'); void p.offsetWidth; p.classList.add('dt-flash'); }
        if (act === 'send') {
          if (!state.channels.length) { toast('Chọn ít nhất một kênh gửi', 'danger'); return; }
          r.notice = { sentAt: today(), count: recips.length, channels: state.channels.slice(), deadline: state.deadline, partial: state.partial, template: state.tpl };
          if (r.status === 'chua-thu') r.status = 'dang-thu';
          App.save();
          const names = state.channels.map((c) => ({ app: 'App', zalo: 'Zalo', sms: 'SMS' }[c])).join(', ');
          toast('Đã gửi ' + recips.length + ' thông báo thu tiền qua ' + names, 'success');
          App.go('/dot-thu/' + r.id + (node !== 'all' ? '?node=' + node : ''));
        }
      };
      draw();
    },
  });
})();
