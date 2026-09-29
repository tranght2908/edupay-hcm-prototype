/* screens: hoc-sinh — group B: Danh sách học sinh, wizard Thêm học sinh, xếp/chuyển lớp, năm học mới + lấy học sinh từ năm trước. */
(function () {
  'use strict';
  const { route, frame } = App;
  const { esc, icon, btn, field, search, grid, bindGrid, dialog, menu, toast, norm, formValues, validate, badge, $, $$ } = UI;

  const G = 'Học sinh';
  frame('06', 'Danh sách học sinh', '/hoc-sinh?year=y2025&class=c10A1', G);
  frame('06b', 'Thêm học sinh / Bước 1', '/hoc-sinh?dialog=add', G);
  frame('06bE', 'Thêm học sinh / Lỗi bắt buộc', '/hoc-sinh?dialog=add&error=1', G);
  frame('06b2', 'Thêm học sinh / Bước 2', '/hoc-sinh?dialog=add&step=2', G);
  frame('06b3', 'Thêm học sinh / Bước 3', '/hoc-sinh?dialog=add&step=3', G);
  frame('06c', 'Năm học mới / Trống', '/hoc-sinh?year=y2026', G);
  frame('06d', 'Lấy học sinh từ năm trước', '/hoc-sinh?year=y2026&dialog=import', G);
  frame('06e', 'Học sinh chưa xếp lớp', '/hoc-sinh?year=y2025&filter=unassigned&select=all', G);
  frame('06f', 'Xếp/chuyển lớp', '/hoc-sinh?year=y2025&filter=unassigned&select=all&dialog=assign', G);
  frame('06g', 'Sau khi xếp lớp', '/hoc-sinh?year=y2025&class=c10A1&result=assigned', G);

  // ---------- data helpers ----------
  const D = App.data;
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o || {}, k);
  const yearById = (id) => (D.years || []).find((y) => y.id === id);
  const yearName = (id) => ((yearById(id) || {}).name || '').replace('-', '–');
  const prevYearOf = (id) => { const ys = D.years || []; const i = ys.findIndex((y) => y.id === id); return i > 0 ? ys[i - 1] : null; };
  const classById = (id) => (D.classes || []).find((c) => c.id === id);
  const classesOf = (yid) => (D.classes || []).filter((c) => c.yearId === yid).sort((a, b) => a.name.localeCompare(b.name, 'vi', { numeric: true }));
  const studentsOf = (yid) => (D.students || []).filter((s) => has(s.classes, yid));
  const gradesOf = (yid) => { const cls = classesOf(yid); return (D.grades || []).filter((g) => cls.some((c) => c.gradeId === g.id)); };
  const gradeById = (id) => (D.grades || []).find((g) => g.id === id);
  const nextCode = () => {
    const max = (D.students || []).reduce((m, s) => Math.max(m, Number(String(s.code || '').replace(/\D/g, '')) || 0), 100000);
    return 'HS' + (max + 1);
  };
  const monthsOf = (yid) => {
    const y = yearById(yid); if (!y) return [];
    const [, sm, sy] = y.start.split('/').map(Number); const [, em, ey] = y.end.split('/').map(Number);
    const out = []; let m = sm, yy = sy;
    while (yy < ey || (yy === ey && m <= em)) { out.push(String(m).padStart(2, '0') + '/' + yy); m++; if (m > 12) { m = 1; yy++; } }
    return out;
  };

  // ---------- view state (kept while navigating inside the screen) ----------
  const S = { node: 'all', q: '', sel: new Set(), expanded: new Set(['g10']), flash: null };
  const nodeQuery = () => (S.node.startsWith('class:') ? '?class=' + S.node.slice(6) : S.node.startsWith('grade:') ? '?grade=' + S.node.slice(6) : S.node === 'unassigned' ? '?filter=unassigned' : '');
  const syncUrl = () => { try { history.replaceState(null, '', '#/hoc-sinh' + nodeQuery()); } catch (e) { /* ignore */ } };

  function nodeValid(node, yid) {
    if (node === 'all' || node === 'unassigned') return true;
    const [k, id] = node.split(':');
    if (k === 'class') { const c = classById(id); return !!c && c.yearId === yid; }
    if (k === 'grade') return gradesOf(yid).some((g) => g.id === id);
    return false;
  }
  function setNode(node) {
    if (node !== S.node) { S.sel.clear(); S.flash = null; }
    S.node = node;
    if (node.startsWith('class:')) { const c = classById(node.slice(6)); if (c) S.expanded.add(c.gradeId); }
    if (node.startsWith('grade:')) S.expanded.add(node.slice(6));
  }
  function nodeStudents(yid) {
    const all = studentsOf(yid);
    if (S.node === 'all') return all;
    if (S.node === 'unassigned') return all.filter((s) => !s.classes[yid]);
    const [k, id] = S.node.split(':');
    if (k === 'class') return all.filter((s) => s.classes[yid] === id);
    return all.filter((s) => { const c = classById(s.classes[yid]); return c && c.gradeId === id; });
  }
  function nodeTitle() {
    if (S.node === 'all') return 'Tất cả học sinh';
    if (S.node === 'unassigned') return 'Chưa xếp lớp';
    const [k, id] = S.node.split(':');
    if (k === 'class') return 'Lớp ' + ((classById(id) || {}).name || '');
    return (gradeById(id) || {}).name || '';
  }

  // ---------- route ----------
  let ctxEl = null;
  route('/hoc-sinh', {
    title: 'Danh sách học sinh', menu: 'hoc-sinh',
    render(ctx) {
      ctxEl = ctx.el;
      const q = ctx.query;
      // one-shot params: switch working year, then strip them so the header switcher keeps working
      if (q.year && yearById(q.year) && q.year !== D.currentYearId) {
        D.currentYearId = q.year; App.save();
        const sel = document.getElementById('yearSel'); if (sel) sel.value = q.year;
      }
      const yid = D.currentYearId;
      if (q.class) setNode('class:' + q.class);
      else if (q.grade) setNode('grade:' + q.grade);
      else if (q.filter === 'unassigned') setNode('unassigned');
      else if (q.year || q.dialog || q.result) { /* frame link without a node: keep default */ if (q.year) setNode('all'); }
      if (!nodeValid(S.node, yid)) setNode('all');
      if (q.result === 'assigned' && S.node.startsWith('class:')) prepareAssignedResult(yid, S.node.slice(6));
      if (q.select === 'all') { S.sel = new Set(nodeStudents(yid).map((s) => s.id)); }
      syncUrl();

      draw();

      if (q.dialog === 'add') openWizard({ step: Number(q.step) || 1, error: q.error === '1' });
      else if (q.dialog === 'import') openImport();
      else if (q.dialog === 'assign') { const ids = Array.from(S.sel); if (ids.length) openAssign(ids); else toast('Không có học sinh nào để xếp lớp'); }
    },
  });

  // 06g: show the class right after an assignment; if there was none yet, do one on real data (unassigned → this class).
  function prepareAssignedResult(yid, classId) {
    if (S.flash && S.flash.classId === classId) return;
    const inCls = studentsOf(yid).filter((s) => s.classes[yid] === classId && s.assignedAt);
    let ids;
    if (inCls.length) { const t = Math.max.apply(null, inCls.map((s) => s.assignedAt)); ids = inCls.filter((s) => s.assignedAt === t).map((s) => s.id); }
    else {
      const un = studentsOf(yid).filter((s) => !s.classes[yid]);
      if (!un.length) return;
      ids = un.map((s) => s.id); doAssign(ids, classId, monthsOf(yid)[0] || '');
    }
    const st0 = D.students.find((s) => s.id === ids[0]);
    const last = st0 && (st0.classHistory || []).slice(-1)[0];
    S.flash = { classId, ids: new Set(ids), month: last ? last.month : '' };
  }

  // ---------- main draw ----------
  function draw() {
    const el = ctxEl; if (!el || !el.isConnected) return;
    const yid = D.currentYearId;
    const studs = studentsOf(yid);
    if (!studs.length) { drawEmpty(el, yid); return; }
    el.innerHTML =
      '<h1 class="view-title">Danh sách học sinh</h1>' +
      '<div class="hs-top">' +
      '<div class="hs-search">' + search({ id: 'hsQ', placeholder: 'Tên hoặc mã học sinh', value: S.q }) + '</div>' +
      '<span class="grow"></span>' +
      btn({ label: 'Thêm học sinh', variant: 'primary', action: 'add', cls: 'hs-add' }) +
      btn({ icon: 'ellipsis-dots-h', aria: 'Thao tác khác', action: 'more' }) +
      '</div>' +
      '<div class="hs-body">' +
      '<section class="hs-card hs-tree" aria-label="Khối và lớp học"><div class="hs-card-title">Khối và lớp học</div><div class="tree" id="hsTree"></div></section>' +
      '<section class="hs-card hs-list" id="hsList"></section>' +
      '</div>' +
      '<div class="hs-actionbar" id="hsBar"></div>';
    drawTree(); drawList();
    const qi = $('#hsQ', el);
    qi.addEventListener('input', () => { S.q = qi.value; S.sel.clear(); drawList(); });
    el.onclick = onClick;
  }

  function drawTree() {
    const box = $('#hsTree', ctxEl); if (!box) return;
    const yid = D.currentYearId; const studs = studentsOf(yid);
    const count = {}; let un = 0;
    studs.forEach((s) => { const c = s.classes[yid]; if (c) count[c] = (count[c] || 0) + 1; else un++; });
    const item = (node, label, cnt, cls, chev) =>
      '<button type="button" class="tree-item hs-ti ' + cls + (S.node === node ? ' active' : '') + '" data-node="' + node + '"' + (S.node === node ? ' aria-current="true"' : '') + '>' +
      (chev ? '<span class="hs-chev" data-chev="' + node + '">' + icon(chev) + '</span>' : '') + '<span class="hs-ti-lbl">' + esc(label) + '</span><span class="cnt">' + cnt + '</span></button>';
    let h = item('all', 'Tất cả', studs.length, 'top', 'angle-down');
    h += item('unassigned', 'Chưa xếp lớp', un, 'top', 'angle-right');
    gradesOf(yid).forEach((g) => {
      const cls = classesOf(yid).filter((c) => c.gradeId === g.id);
      const open = S.expanded.has(g.id);
      h += item('grade:' + g.id, g.name, cls.reduce((t, c) => t + (count[c.id] || 0), 0), 'top', open ? 'angle-down' : 'angle-right');
      if (open) cls.forEach((c) => { h += item('class:' + c.id, c.name, count[c.id] || 0, 'cls', ''); });
    });
    box.innerHTML = h;
  }

  function drawList() {
    const box = $('#hsList', ctxEl); if (!box) return;
    const yid = D.currentYearId;
    const isClass = S.node.startsWith('class:');
    let rows = nodeStudents(yid);
    if (S.q.trim()) { const k = norm(S.q.trim()); rows = rows.filter((s) => norm(s.name).includes(k) || norm(s.code).includes(k)); }
    rows = rows.slice().sort((a, b) => {
      const ca = (classById(a.classes[yid]) || {}).name || '', cb = (classById(b.classes[yid]) || {}).name || '';
      return ca.localeCompare(cb, 'vi', { numeric: true }) || a.code.localeCompare(b.code);
    });
    const flash = S.flash && isClass && S.flash.classId === S.node.slice(6) ? S.flash : null;
    if (flash) rows = rows.filter((r) => flash.ids.has(r.id)).concat(rows.filter((r) => !flash.ids.has(r.id)));
    const cols = [
      { key: 'stt', label: 'STT', width: '44px', render: (r, i) => String(i + 1) },
      { key: 'code', label: 'Mã học sinh' },
      { key: 'name', label: 'Họ và tên', render: (r) => esc(r.name) + (flash && flash.ids.has(r.id) ? ' ' + badge('Mới xếp', 'success') : '') },
    ];
    if (!isClass && S.node !== 'unassigned') cols.push({ key: 'cls', label: 'Lớp', render: (r) => { const c = classById(r.classes[yid]); return c ? esc(c.name) : badge('Chưa xếp lớp', 'warning'); } });
    cols.push(
      { key: 'dob', label: 'Ngày sinh' },
      { key: 'gender', label: 'Giới tính' },
      { key: 'parent', label: 'Phụ huynh liên hệ', render: (r) => esc((r.parent || {}).name || '') },
      { key: 'phone', label: 'Số điện thoại', render: (r) => esc(fmtPhone((r.parent || {}).phone)) },
      { key: 'act', label: 'Thao tác', width: '72px', render: (r) => btn({ icon: 'ellipsis-dots-h', variant: 'tertiary', cls: 'sm hs-rowbtn', aria: 'Thao tác với ' + r.name, attrs: { 'data-rowmenu': r.id } }) },
    );
    const visible = new Set(rows.map((r) => r.id));
    Array.from(S.sel).forEach((id) => { if (!visible.has(id)) S.sel.delete(id); });
    box.innerHTML =
      '<div class="hs-list-head"><span>' + esc(nodeTitle()) + '</span><span>' + rows.length + ' học sinh</span>' +
      (S.q.trim() ? '<span class="muted hs-q">Kết quả tìm “' + esc(S.q.trim()) + '”</span>' : '') + '</div>' +
      (flash ? '<div class="note success hs-flash">' + icon('check-circle') + '<span>Đã xếp ' + flash.ids.size + ' học sinh vào lớp ' + esc((classById(flash.classId) || {}).name) + (flash.month ? ' từ tháng ' + esc(flash.month) : '') + '. Các khoản thu từ tháng áp dụng sẽ tính theo lớp mới.</span></div>' : '') +
      grid({ id: 'hsGrid', columns: cols, rows, selectable: 'multi', selected: Array.from(S.sel), striped: true,
        empty: S.node === 'unassigned' ? 'Tất cả học sinh đã được xếp lớp' : S.q ? 'Không tìm thấy học sinh phù hợp' : 'Lớp chưa có học sinh' });
    const g = $('#hsGrid', box);
    if (flash) $$('tbody tr[data-key]', g).forEach((tr) => { if (flash.ids.has(tr.dataset.key)) tr.classList.add('hs-new'); });
    bindGrid(g, { selectable: 'multi', selected: Array.from(S.sel), onSelect: (ids) => { S.sel = new Set(ids); drawBar(); }, onRowDblClick: (k) => openWizard({ editId: k }) });
    drawBar();
  }
  const fmtPhone = (p) => { const d = String(p || '').replace(/\D/g, ''); return d.length === 10 ? d.slice(0, 4) + ' ' + d.slice(4, 7) + ' ' + d.slice(7) : p || ''; };

  function drawBar() {
    const bar = $('#hsBar', ctxEl); if (!bar) return;
    const yid = D.currentYearId; const n = S.sel.size;
    const show = n > 0 || S.node === 'unassigned';
    bar.hidden = !show;
    if (!show) { bar.innerHTML = ''; return; }
    const allUn = n > 0 && Array.from(S.sel).every((id) => { const s = D.students.find((x) => x.id === id); return s && !s.classes[yid]; });
    bar.innerHTML = '<span class="muted">' + (n ? 'Đã chọn ' + n + ' học sinh' : 'Chọn học sinh để xếp lớp') + '</span><span class="grow"></span>' +
      btn({ label: 'Bỏ chọn', action: 'clearsel', disabled: !n }) +
      btn({ label: (allUn || (!n && S.node === 'unassigned') ? 'Xếp lớp' : 'Chuyển lớp') + (n ? ' (' + n + ')' : ''), icon: allUn || S.node === 'unassigned' ? 'user-check' : 'exchange', variant: 'primary', action: 'assign', disabled: !n });
  }

  async function onClick(e) {
    const chev = e.target.closest('[data-chev]');
    const ti = e.target.closest('[data-node]');
    if (ti) {
      const node = ti.dataset.node;
      if (chev && node.startsWith('grade:')) { const g = node.slice(6); S.expanded.has(g) ? S.expanded.delete(g) : S.expanded.add(g); drawTree(); return; }
      setNode(node); syncUrl(); drawTree(); drawList(); return;
    }
    const rb = e.target.closest('[data-rowmenu]');
    if (rb) { rowMenu(rb, rb.dataset.rowmenu); return; }
    const a = e.target.closest('[data-action]'); if (!a || a.disabled) return;
    const act = a.dataset.action;
    if (act === 'add') openWizard({});
    else if (act === 'more') moreMenu(a);
    else if (act === 'import') openImport();
    else if (act === 'clearsel') { S.sel.clear(); drawList(); }
    else if (act === 'assign') { if (S.sel.size) openAssign(Array.from(S.sel)); }
  }

  function moreMenu(anchor) {
    const yid = D.currentYearId; const prev = prevYearOf(yid);
    menu(anchor, [
      { label: prev ? 'Lấy học sinh từ năm học ' + yearName(prev.id) : 'Lấy học sinh từ năm trước', icon: 'copy', disabled: !prev, onClick: openImport },
      { label: 'Học sinh chưa xếp lớp', icon: 'user-check', onClick: () => { setNode('unassigned'); syncUrl(); drawTree(); drawList(); } },
      { label: 'Chuyển lớp học sinh đã chọn', icon: 'exchange', disabled: !S.sel.size, onClick: () => openAssign(Array.from(S.sel)) },
      '-',
      { label: 'Nhập từ Excel', icon: 'upload', onClick: () => toast('Prototype: chức năng nhập Excel chưa hoạt động') },
      { label: 'Xuất Excel', icon: 'download', onClick: () => toast('Prototype: đã xuất danh sách (giả lập)') },
    ]);
  }

  function rowMenu(anchor, id) {
    const st = D.students.find((s) => s.id === id); if (!st) return;
    const yid = D.currentYearId;
    menu(anchor, [
      { label: 'Xem / sửa thông tin', icon: 'pencil', onClick: () => openWizard({ editId: id }) },
      { label: st.classes[yid] ? 'Chuyển lớp' : 'Xếp lớp', icon: st.classes[yid] ? 'exchange' : 'user-check', onClick: () => openAssign([id]) },
      '-',
      { label: 'Xóa khỏi năm học', icon: 'trash', danger: true, onClick: async () => {
        if (!(await UI.confirm({ title: 'Xóa học sinh', message: 'Xóa học sinh ' + st.name + ' (' + st.code + ') khỏi năm học ' + yearName(yid) + '?', okLabel: 'Xóa', danger: true }))) return;
        delete st.classes[yid];
        const hasPay = (D.payments || []).some((p) => p.studentId === id);
        if (!Object.keys(st.classes).length && !hasPay) D.students.splice(D.students.indexOf(st), 1);
        S.sel.delete(id); App.save(); draw(); toast('Đã xóa học sinh ' + st.name, 'success');
      } },
    ]);
  }

  // ---------- 06c: empty new year ----------
  function drawEmpty(el, yid) {
    const prev = prevYearOf(yid);
    const cls = classesOf(yid);
    el.innerHTML =
      '<h1 class="view-title">Danh sách học sinh</h1>' +
      '<div class="hs-top"><span class="grow"></span>' +
      (prev ? btn({ label: 'Lấy từ năm trước', icon: 'copy', action: 'import' }) : '') +
      btn({ label: 'Thêm học sinh', variant: 'primary', action: 'add', cls: 'hs-add' }) + '</div>' +
      '<div class="hs-body">' +
      '<section class="hs-card hs-tree"><div class="hs-card-title">Khối và lớp học</div>' +
      (cls.length ? '<div class="tree">' + cls.map((c) => '<div class="tree-item hs-ti cls">' + esc(c.name) + '<span class="cnt">0</span></div>').join('') + '</div>'
        : '<p class="hs-tree-empty">Năm học ' + esc(yearName(yid)) + ' chưa có lớp học.</p>') + '</section>' +
      '<section class="hs-card hs-empty">' +
      '<div class="hs-empty-ic">' + icon('plus') + '</div>' +
      '<h2>Năm học ' + esc(yearName(yid)) + ' chưa có học sinh</h2>' +
      '<p>' + (prev ? 'Lấy danh sách học sinh từ năm học ' + esc(yearName(prev.id)) + ' — hệ thống tự động lên lớp (10 → 11, 11 → 12), học sinh khối 12 được xem là đã tốt nghiệp. Bạn cũng có thể thêm từng học sinh mới.' : 'Thêm học sinh mới để bắt đầu năm học.') + '</p>' +
      (prev ? btn({ label: 'Lấy học sinh từ năm học ' + yearName(prev.id), icon: 'copy', variant: 'primary', action: 'import', cls: 'hs-import-btn' }) : '') +
      '</section></div>';
    el.onclick = onClick;
  }

  // ---------- 06f: xếp / chuyển lớp ----------
  function doAssign(ids, classId, month) {
    const yid = D.currentYearId; const now = Date.now();
    ids.forEach((id) => {
      const st = D.students.find((s) => s.id === id); if (!st) return;
      const from = st.classes[yid] || '';
      st.classes[yid] = classId; st.assignedAt = now;
      (st.classHistory = st.classHistory || []).push({ yearId: yid, from, to: classId, month });
    });
    App.save();
  }

  function openAssign(ids) {
    const yid = D.currentYearId;
    const studs = ids.map((id) => D.students.find((s) => s.id === id)).filter(Boolean);
    if (!studs.length) return;
    const cls = classesOf(yid);
    if (!cls.length) { toast('Năm học ' + yearName(yid) + ' chưa có lớp học. Hãy tạo lớp ở màn hình Khối và lớp học.', 'danger'); return; }
    const allUn = studs.every((s) => !s.classes[yid]);
    const count = {}; studentsOf(yid).forEach((s) => { if (s.classes[yid]) count[s.classes[yid]] = (count[s.classes[yid]] || 0) + 1; });
    const cur = studs.length === 1 ? studs[0].classes[yid] : '';
    const months = monthsOf(yid);
    const today = new Date(); const tm = String(today.getMonth() + 1).padStart(2, '0') + '/' + today.getFullYear();
    dialog({
      title: (allUn ? 'Xếp lớp cho ' : 'Chuyển lớp cho ') + studs.length + ' học sinh', width: '560px',
      body: '<form class="stack hs-assign" novalidate>' +
        field({ label: 'Lớp chuyển đến', name: 'classId', type: 'select', required: true, placeholder: 'Chọn lớp',
          options: cls.filter((c) => c.id !== cur).map((c) => ({ value: c.id, label: c.name + ' · ' + ((gradeById(c.gradeId) || {}).name || '') + ' · sĩ số ' + (count[c.id] || 0) + '/' + (c.capacity || 35) })) }) +
        field({ label: 'Áp dụng từ tháng', name: 'month', type: 'select', required: true, value: months.includes(tm) ? tm : months[0], options: months.map((m) => ({ value: m, label: 'Tháng ' + m })) }) +
        '<p class="muted hs-assign-names">' + esc(studs.slice(0, 4).map((s) => s.name).join(', ') + (studs.length > 4 ? ' và ' + (studs.length - 4) + ' học sinh khác' : '')) + '</p>' +
        '</form>',
      footer: btn({ label: 'Hủy', action: 'close' }) + btn({ label: 'Xác nhận', variant: 'primary', action: 'ok' }),
      onMount(dlg, close) {
        dlg.querySelector('[data-action="ok"]').addEventListener('click', () => {
          const f = $('form', dlg); if (!validate(f)) return;
          const v = formValues(f); const c = classById(v.classId);
          doAssign(studs.map((s) => s.id), v.classId, v.month);
          setNode('class:' + v.classId);
          S.flash = { classId: v.classId, ids: new Set(studs.map((s) => s.id)), month: v.month };
          close(); syncUrl(); draw();
          toast('Đã ' + (allUn ? 'xếp ' : 'chuyển ') + studs.length + ' học sinh vào lớp ' + c.name, 'success');
        });
      },
    });
  }

  // ---------- 06b: wizard thêm / sửa học sinh ----------
  const PROVINCES = ['TP. Hồ Chí Minh', 'Hà Nội', 'Bình Dương', 'Đồng Nai', 'Long An', 'Tây Ninh', 'Bà Rịa - Vũng Tàu'];
  const DISTRICTS = ['Quận 1', 'Quận 3', 'Quận 4', 'Quận 5', 'Quận 10', 'Quận Bình Thạnh', 'Quận Phú Nhuận', 'TP. Thủ Đức'];
  const WARDS = ['Phường Bến Thành', 'Phường Sài Gòn', 'Phường Tân Định', 'Phường Xuân Hòa', 'Phường Bàn Cờ', 'Phường Cầu Ông Lãnh'];
  const AREAS = ['Khu vực 1', 'Khu vực 2', 'Khu vực 3'];
  const BANKS = ['BIDV', 'Vietcombank', 'VietinBank', 'Agribank', 'Techcombank', 'MB Bank', 'ACB', 'Sacombank'];
  const STEPS = ['Thông tin cơ bản', 'Địa chỉ', 'Phụ huynh'];

  function valsFromStudent(st, yid) {
    const a = st.address || {}; const p = st.parent || {};
    return {
      name: st.name, code: st.code, dob: st.dob, gender: st.gender, classId: has(st.classes, yid) ? (st.classes[yid] || '__none') : '', trainingSystemId: st.trainingSystemId,
      idNumber: st.idNumber, passport: st.passport || '', statCode: st.statCode || '', enrollYear: st.enrollYear, transferFrom: st.transferFrom || '', transferDate: st.transferDate || '', bhyt: st.bhyt,
      province: a.city || 'TP. Hồ Chí Minh', district: a.district || '', ward: a.ward || '', area: a.area || '', house: a.street || '', village: a.village || '', fullAddress: a.full || '',
      parentName: p.name, phone: p.phone, email: p.email, bank: p.bank || '', owner: p.owner || '', account: p.account || '', receiveInvoice: !!p.receiveInvoice,
    };
  }
  function sampleVals(yid, step) {
    const cls = classesOf(yid)[0];
    const v = { name: 'Nguyễn Minh Anh', code: nextCode(), dob: '12/03/2010', gender: 'Nữ', classId: cls ? cls.id : '__none', trainingSystemId: 'ts1', idNumber: '079210012345', passport: '',
      statCode: '', enrollYear: (yearById(yid) || { name: '2025' }).name.slice(0, 4), transferFrom: '', transferDate: '', bhyt: 'HS4790123456789' };
    if (step >= 3) Object.assign(v, { province: 'TP. Hồ Chí Minh', district: 'Quận 1', ward: 'Phường Bến Thành', area: 'Khu vực 1', house: '45 Lê Thánh Tôn', village: 'Khu phố 2' });
    return v;
  }

  function openWizard(o) {
    const yid = D.currentYearId;
    const editing = o.editId ? D.students.find((s) => s.id === o.editId) : null;
    let step = Math.min(3, Math.max(1, o.step || 1));
    const vals = editing ? valsFromStudent(editing, yid)
      : Object.assign({ gender: 'Nam', trainingSystemId: 'ts1', province: 'TP. Hồ Chí Minh', enrollYear: (yearById(yid) || { name: '' }).name.slice(0, 4), code: nextCode(), receiveInvoice: true },
        o.error ? { code: '', gender: '', trainingSystemId: '' } : step > 1 ? sampleVals(yid, step) : {});
    const cls = classesOf(yid);
    let dlgEl, closeFn;

    const f = (name, label, extra) => field(Object.assign({ name, id: 'hsw_' + name, label, value: vals[name] }, extra || {}));
    function stepHtml() {
      if (step === 1) {
        return '<div class="form-grid" style="--cols:3">' +
          f('name', 'Họ và tên', { required: true, placeholder: 'Nhập họ và tên' }) +
          f('code', 'Mã HS/Mã thanh toán', { required: true, placeholder: 'VD: ' + nextCode() }) +
          f('dob', 'Ngày sinh', { type: 'date' }) +
          f('gender', 'Giới tính', { type: 'select', placeholder: o.error ? 'Chọn' : '', options: ['Nam', 'Nữ'] }) +
          f('classId', 'Lớp', { type: 'select', required: true, placeholder: 'Chọn lớp', options: cls.map((c) => ({ value: c.id, label: c.name })).concat([{ value: '__none', label: 'Chưa xếp lớp' }]) }) +
          f('trainingSystemId', 'Hệ đào tạo', { type: 'select', placeholder: o.error ? 'Chọn' : '', options: (D.trainingSystems || []).map((t) => ({ value: t.id, label: t.name })) }) +
          f('idNumber', 'Số định danh cá nhân', { placeholder: '12 chữ số' }) +
          f('passport', 'Số hộ chiếu', { placeholder: 'Nếu có' }) +
          f('statCode', 'Mã thống kê', { placeholder: 'Mã trên CSDL ngành' }) +
          f('enrollYear', 'Năm nhập học', { placeholder: 'VD: 2025', attrs: { inputmode: 'numeric', maxlength: '4' } }) +
          f('transferDate', 'Ngày chuyển đến', { type: 'date' }) +
          f('bhyt', 'Mã BHYT', { placeholder: 'VD: HS4790…' }) +
          '</div>' +
          '<div class="note hs-wiz-note">' + icon('info-circle') + '<span>Các trường có dấu * là bắt buộc. Mã học sinh không được trùng với học sinh khác trong trường.</span></div>';
      }
      if (step === 2) {
        return '<div class="form-grid" style="--cols:3">' +
          f('province', 'Tỉnh/Thành phố', { type: 'select', options: PROVINCES }) +
          f('district', 'Quận/Huyện', { type: 'select', placeholder: 'Chọn quận/huyện', options: DISTRICTS }) +
          f('ward', 'Phường/Xã', { type: 'select', placeholder: 'Chọn phường/xã', options: WARDS }) +
          f('area', 'Khu vực', { type: 'select', placeholder: 'Chọn khu vực', options: AREAS }) +
          f('house', 'Số nhà, tên đường', { placeholder: 'VD: 45 Lê Thánh Tôn' }) +
          f('village', 'Tổ / Khu phố / Ấp', { placeholder: 'VD: Khu phố 2' }) +
          f('fullAddress', 'Địa chỉ thường trú', { cls: 'span-all', placeholder: 'Tự động ghép từ các trường ở trên — có thể sửa' }) +
          '</div>' +
          '<div class="note hs-wiz-note">' + icon('info-circle') + '<span>Địa chỉ được in trên thông báo thu tiền và phiếu thu gửi phụ huynh.</span></div>';
      }
      return '<div class="form-grid" style="--cols:3">' +
        f('parentName', 'Họ tên phụ huynh', { required: true, placeholder: 'Nhập họ tên' }) +
        f('phone', 'Số điện thoại', { required: true, placeholder: 'VD: 0901 234 567' }) +
        f('email', 'Email', { placeholder: 'Nhận thông báo và hóa đơn' }) +
        f('bank', 'Ngân hàng', { type: 'select', placeholder: 'Chọn ngân hàng', options: BANKS }) +
        f('owner', 'Chủ tài khoản', { placeholder: 'Viết hoa không dấu' }) +
        f('account', 'Số tài khoản', { placeholder: 'Nhập số tài khoản' }) +
        '</div>' +
        '<label class="chk hs-invoice"><input type="checkbox" name="receiveInvoice"' + (vals.receiveInvoice ? ' checked' : '') + '> Nhận hóa đơn điện tử qua email</label>' +
        '<div class="note hs-wiz-note">' + icon('info-circle') + '<span>Tài khoản ngân hàng dùng để đối soát khi phụ huynh chuyển khoản và để hoàn tiền nếu có.</span></div>';
    }
    function paint() {
      $('.hs-steps', dlgEl).innerHTML = STEPS.map((s, i) => {
        const n = i + 1; const st = n < step ? 'done' : n === step ? 'active' : '';
        return '<div class="step ' + st + '"' + (n === step ? ' aria-current="step"' : '') + '><span class="dot">' + (n < step ? icon('check') : n) + '</span><span class="lbl">' + esc(s) + '</span></div>';
      }).join('');
      const body = $('.hs-wiz-body', dlgEl);
      body.innerHTML = '<h3 class="hs-wiz-h">' + esc(STEPS[step - 1]) + '</h3><form class="hs-wiz-form" novalidate>' + stepHtml() + '</form>';
      $('.dlg-foot', dlgEl).innerHTML = btn({ label: 'Hủy', action: 'close' }) + (step > 1 ? btn({ label: 'Quay lại', icon: 'angle-left', action: 'back' }) : '') +
        (step < 3 ? btn({ label: 'Tiếp tục', variant: 'primary', action: 'next', cls: 'hs-next' }) : btn({ label: editing ? 'Lưu thay đổi' : 'Lưu học sinh', icon: 'check', variant: 'primary', action: 'save' }));
      if (step === 2) {
        const form = $('form', body);
        const compose = () => { const v = formValues(form); const fa = $('[name="fullAddress"]', form); if (fa.dataset.touched) return; fa.value = [v.house, v.village, v.ward, v.district, v.province].filter(Boolean).join(', '); };
        $('[name="fullAddress"]', form).addEventListener('input', (e) => { e.target.dataset.touched = '1'; });
        form.addEventListener('change', compose); form.addEventListener('input', (e) => { if (e.target.name !== 'fullAddress') compose(); });
        if (!vals.fullAddress) compose();
      }
    }
    function collect() { Object.assign(vals, formValues($('form', dlgEl))); }
    function checkStep() {
      const form = $('form', dlgEl);
      let ok = validate(form);
      if (step === 1) {
        const code = String(vals.code || '').trim();
        if (code && D.students.some((s) => s.code.toLowerCase() === code.toLowerCase() && (!editing || s.id !== editing.id))) {
          const fl = $('[name="code"]', form).closest('.field'); fl.classList.add('invalid');
          const old = fl.querySelector('.err'); if (old) old.remove();
          fl.insertAdjacentHTML('beforeend', '<div class="err">Mã học sinh đã tồn tại.</div>'); ok = false;
        }
      }
      if (!ok) { const bad = $('.field.invalid .ctl', form); if (bad) bad.focus(); }
      return ok;
    }
    function saveStudent() {
      const v = vals;
      const address = { street: v.house || '', ward: v.ward || '', city: v.province || '', district: v.district || '', area: v.area || '', village: v.village || '', full: v.fullAddress || '' };
      const parent = { name: v.parentName.trim(), relation: (editing && editing.parent && editing.parent.relation) || 'Phụ huynh', phone: v.phone.trim(), email: v.email || '', bank: v.bank || '', owner: v.owner || '', account: v.account || '', receiveInvoice: !!v.receiveInvoice };
      const classId = v.classId === '__none' ? '' : v.classId;
      let st = editing;
      if (!st) {
        const n = D.students.reduce((m, s) => Math.max(m, Number(String(s.id).replace(/\D/g, '')) || 0), 0) + 1;
        st = { id: 's' + n, classes: {}, priorityId: '', status: 'dang-hoc' };
        D.students.push(st);
        if (D.registrations && !D.registrations[st.id]) D.registrations[st.id] = [];
      }
      Object.assign(st, { code: v.code.trim(), name: v.name.trim(), gender: v.gender || '', dob: v.dob || '', trainingSystemId: v.trainingSystemId || '', enrollYear: String(v.enrollYear || ''),
        idNumber: v.idNumber || '', passport: v.passport || '', statCode: v.statCode || '', transferFrom: v.transferFrom || '', transferDate: v.transferDate || '', bhyt: v.bhyt || '', address, parent });
      if (st.classes[yid] !== classId) { st.classes[yid] = classId; if (editing) st.assignedAt = Date.now(); }
      App.save();
      setNode(classId ? 'class:' + classId : 'unassigned');
      S.q = '';
      if (!editing && classId) S.flash = null;
      closeFn(); syncUrl(); draw();
      const tr = $('#hsGrid tr[data-key="' + st.id + '"]', ctxEl);
      if (tr) { tr.classList.add('hs-new'); tr.scrollIntoView({ block: 'nearest' }); }
      toast((editing ? 'Đã cập nhật học sinh ' : 'Đã thêm học sinh ') + st.name, 'success');
    }

    const d = dialog({
      title: editing ? 'Sửa thông tin học sinh' : 'Thêm học sinh', width: '900px', large: true, rawBody: true,
      body: '<div class="hs-wiz dlg-with-steps"><nav class="steps hs-steps" aria-label="Các bước"></nav><div class="dlg-body hs-wiz-body"></div></div>',
      footer: '<span></span>',
      onClose: () => { if (/[?&]dialog=/.test(location.hash)) syncUrl(); },
      onMount(dlg, close) {
        dlgEl = dlg; closeFn = close;
        dlg.addEventListener('click', (e) => {
          const a = e.target.closest('[data-action]'); if (!a) return;
          if (a.dataset.action === 'next') { collect(); if (checkStep()) { step++; paint(); } }
          else if (a.dataset.action === 'back') { collect(); step--; paint(); }
          else if (a.dataset.action === 'save') { collect(); if (checkStep()) saveStudent(); }
        });
        dlg.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('input.ctl')) { e.preventDefault(); const b = $('[data-action="next"], [data-action="save"]', dlg); if (b) b.click(); } });
      },
    });
    void d;
    paint();
    if (o.error) checkStep();
    else { const first = $('.hs-wiz-body .ctl', dlgEl); if (first) setTimeout(() => first.focus(), 40); }
  }

  // ---------- 06d: lấy học sinh từ năm trước ----------
  function promotedName(c) {
    const g = gradeById(c.gradeId); if (!g) return null;
    const lv = g.level + 1; if (lv > 12) return null;
    return c.name.replace(/^\d+/, String(lv));
  }
  function openImport() {
    const tid = D.currentYearId;
    const prev = prevYearOf(tid);
    if (!prev) { toast('Không có năm học trước để lấy dữ liệu', 'danger'); return; }
    let sid = prev.id;
    let focus = 'all'; let q = '';
    let sel = new Set(); let cand = [];
    const target = new Map(); // studentId -> {name} proposed class name in target year ('' = chưa xếp lớp)
    const load = () => {
      cand = studentsOf(sid).filter((s) => !has(s.classes, tid));
      target.clear();
      const keep = [];
      cand.forEach((s) => {
        const c = classById(s.classes[sid]);
        if (!c) { target.set(s.id, ''); keep.push(s); return; }
        const pn = promotedName(c); if (pn === null) return; // khối 12: tốt nghiệp
        target.set(s.id, pn); keep.push(s);
      });
      cand = keep; sel = new Set(cand.map((s) => s.id));
    };
    load();
    const srcClasses = () => classesOf(sid);
    const inFocus = (s) => {
      if (focus === 'all') return true;
      if (focus === '__none') return !s.classes[sid];
      const [k, id] = focus.split(':'); const c = classById(s.classes[sid]);
      return k === 'class' ? s.classes[sid] === id : !!c && c.gradeId === id;
    };
    const graduating = () => studentsOf(sid).filter((s) => { const c = classById(s.classes[sid]); return c && promotedName(c) === null; }).length;
    let dlgEl;

    function treeHtml() {
      const groups = [];
      (D.grades || []).forEach((g) => { const cls = srcClasses().filter((c) => c.gradeId === g.id); if (cls.length) groups.push({ g, cls }); });
      const members = (pred) => cand.filter(pred).map((s) => s.id);
      const box = (ids) => { const n = ids.filter((id) => sel.has(id)).length; return { checked: ids.length > 0 && n === ids.length, ind: n > 0 && n < ids.length, dis: !ids.length }; };
      const row = (key, label, ids, lvl, extra) => {
        const b = box(ids);
        return '<div class="hs-imp-ti l' + lvl + (focus === key ? ' active' : '') + '"><input type="checkbox" data-tree="' + key + '" aria-label="Chọn ' + esc(label) + '"' + (b.checked ? ' checked' : '') + (b.dis ? ' disabled' : '') + (b.ind ? ' data-ind="1"' : '') + '>' +
          '<button type="button" data-focus="' + key + '">' + esc(label) + (extra ? ' <span class="muted">' + extra + '</span>' : '') + '</button><span class="cnt">' + ids.length + '</span></div>';
      };
      let h = row('all', 'Tất cả', cand.map((s) => s.id), 0);
      groups.forEach(({ g, cls }) => {
        const grad = g.level + 1 > 12;
        h += row('grade:' + g.id, g.name, members((s) => { const c = classById(s.classes[sid]); return c && c.gradeId === g.id; }), 0, grad ? '· tốt nghiệp' : '');
        if (!grad) cls.forEach((c) => { h += row('class:' + c.id, c.name, members((s) => s.classes[sid] === c.id), 1, '→ ' + esc(promotedName(c))); });
      });
      const un = members((s) => !s.classes[sid]);
      if (un.length) h += row('__none', 'Chưa xếp lớp', un, 0);
      return h;
    }
    function membersOf(key) {
      if (key === 'all') return cand.map((s) => s.id);
      if (key === '__none') return cand.filter((s) => !s.classes[sid]).map((s) => s.id);
      const [k, id] = key.split(':');
      return cand.filter((s) => { const c = classById(s.classes[sid]); return k === 'class' ? s.classes[sid] === id : c && c.gradeId === id; }).map((s) => s.id);
    }
    function paint() {
      $('#hsImpTree', dlgEl).innerHTML = treeHtml();
      $$('#hsImpTree input[data-ind]', dlgEl).forEach((i) => { i.indeterminate = true; });
      let rows = cand.filter(inFocus);
      if (q.trim()) { const k = norm(q.trim()); rows = rows.filter((s) => norm(s.name).includes(k) || norm(s.code).includes(k)); }
      $('#hsImpGridBox', dlgEl).innerHTML = grid({ id: 'hsImpGrid', rows, selectable: 'multi', selected: rows.filter((s) => sel.has(s.id)).map((s) => s.id), striped: true,
        empty: cand.length ? 'Không có học sinh phù hợp' : 'Tất cả học sinh năm học ' + yearName(sid) + ' đã được lấy sang năm học mới',
        columns: [
          { key: 'name', label: 'Họ và tên' },
          { key: 'code', label: 'Mã học sinh' },
          { key: 'old', label: 'Lớp ' + yearName(sid), render: (s) => esc((classById(s.classes[sid]) || {}).name || '—') },
          { key: 'new', label: 'Lớp ' + yearName(tid), render: (s) => (target.get(s.id) ? '<b>' + esc(target.get(s.id)) + '</b>' : badge('Chưa xếp lớp', 'warning')) },
        ] });
      const visible = rows.map((s) => s.id);
      bindGrid($('#hsImpGrid', dlgEl), { selectable: 'multi', selected: visible.filter((id) => sel.has(id)), onSelect: (ids) => { const set = new Set(ids); visible.forEach((id) => (set.has(id) ? sel.add(id) : sel.delete(id))); paintTreeAndCount(); } });
      paintTreeAndCount(true);
    }
    function paintTreeAndCount(skipTree) {
      if (!skipTree) { $('#hsImpTree', dlgEl).innerHTML = treeHtml(); $$('#hsImpTree input[data-ind]', dlgEl).forEach((i) => { i.indeterminate = true; }); }
      const g = graduating();
      $('#hsImpCount', dlgEl).innerHTML = 'Đã chọn <b>' + sel.size + '</b> / ' + cand.length + ' học sinh' + (g ? ' · ' + g + ' học sinh khối 12 tốt nghiệp, không chuyển sang' : '');
      $('[data-action="doimport"]', dlgEl).disabled = !sel.size;
    }
    function doImport(close) {
      // copy the class structure of the source year (reuse classes that already exist by name)
      const byName = {}; classesOf(tid).forEach((c) => (byName[c.name] = c));
      let created = 0;
      srcClasses().forEach((c) => {
        if (byName[c.name]) return;
        const nc = Object.assign({}, c, { id: 'c' + c.name + '-' + tid, yearId: tid });
        D.classes.push(nc); byName[c.name] = nc; created++;
      });
      // promoted classes that did not exist last year (e.g. 10A4 → 11A4)
      srcClasses().forEach((c) => {
        const pn = promotedName(c); if (!pn || byName[pn]) return;
        const g = (D.grades || []).find((x) => x.level === gradeById(c.gradeId).level + 1); if (!g) return;
        const nc = Object.assign({}, c, { id: 'c' + pn + '-' + tid, name: pn, gradeId: g.id, yearId: tid, room: 'P.' + pn.replace('A', '0') });
        D.classes.push(nc); byName[pn] = nc; created++;
      });
      let n = 0;
      cand.forEach((s) => {
        if (!sel.has(s.id)) return;
        const pn = target.get(s.id);
        s.classes[tid] = pn && byName[pn] ? byName[pn].id : '';
        n++;
      });
      App.save(); close();
      setNode('all'); S.q = ''; syncUrl(); draw();
      toast('Đã lấy ' + n + ' học sinh sang năm học ' + yearName(tid) + (created ? ' và tạo ' + created + ' lớp' : ''), 'success');
    }

    dialog({
      title: 'Lấy học sinh từ năm học trước', width: '1010px', large: true,
      body: '<div class="hs-imp-top">' +
        field({ label: 'Năm học nguồn', name: 'src', id: 'hsImpSrc', type: 'select', value: sid, options: (D.years || []).filter((y) => y.id !== tid).map((y) => ({ value: y.id, label: 'Năm học ' + yearName(y.id) })) }) +
        field({ label: 'Năm học đích', name: 'dst', type: 'readonly', value: 'Năm học ' + yearName(tid) }) +
        search({ id: 'hsImpQ', label: 'Tìm kiếm', placeholder: 'Tên hoặc mã học sinh' }) +
        '</div>' +
        '<div class="hs-imp-body"><section class="hs-card hs-imp-tree"><div class="hs-card-title">Khối và lớp học năm ' + esc(yearName(sid)) + '</div><div id="hsImpTree"></div></section>' +
        '<div id="hsImpGridBox" class="hs-imp-grid"></div></div>',
      footer: '<span class="grow hs-imp-count" id="hsImpCount"></span>' + btn({ label: 'Hủy', action: 'close' }) + btn({ label: 'Lấy học sinh', icon: 'copy', variant: 'primary', action: 'doimport' }),
      onClose: () => { if (/[?&]dialog=/.test(location.hash)) syncUrl(); },
      onMount(dlg, close) {
        dlgEl = dlg;
        dlg.addEventListener('click', (e) => {
          const fb = e.target.closest('[data-focus]'); if (fb) { focus = fb.dataset.focus; paint(); return; }
          const a = e.target.closest('[data-action="doimport"]'); if (a && !a.disabled) doImport(close);
        });
        dlg.addEventListener('change', (e) => {
          const t = e.target;
          if (t.dataset.tree) { const ids = membersOf(t.dataset.tree); ids.forEach((id) => (t.checked ? sel.add(id) : sel.delete(id))); paint(); }
          else if (t.id === 'hsImpSrc') { sid = t.value; focus = 'all'; load(); $('.hs-imp-tree .hs-card-title', dlg).textContent = 'Khối và lớp học năm ' + yearName(sid); paint(); }
        });
        $('#hsImpQ', dlg).addEventListener('input', (e) => { q = e.target.value; paint(); });
      },
    });
    paint();
  }
})();
