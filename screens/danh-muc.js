/* screens: danh-muc (group A) — Năm học, Khối & lớp, Hệ đào tạo, Diện ưu tiên, Đơn vị tính.
   Figma frames 01–05b. Lists use UI.crudList; details are full-page Jmix editors with OK/Cancel. */
(function () {
  'use strict';
  const { route, frame } = App;
  const { esc, btn, field, grid, bindGrid, dialog, confirm, toast, validate, formValues, uid, $ } = UI;

  // ---------- local helpers ----------
  const D = () => App.data;
  const schoolName = () => (D().school || {}).name || '';
  const dnum = (s) => { const m = String(s || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); return m ? +m[3] * 10000 + +m[2] * 100 + +m[1] : 0; };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const clearQuery = (path) => { try { history.replaceState(null, '', '#' + path); } catch (e) { /* ignore */ } };
  const schoolField = (w) => field({ label: 'Trường (đơn vị)', name: '_school', type: 'readonly', value: schoolName(), required: true, cls: 'w' + w });

  function refreshYearSelect() {
    const sel = document.getElementById('yearSel'); if (!sel) return;
    sel.innerHTML = (D().years || []).map((y) => '<option value="' + esc(y.id) + '"' + (y.id === D().currentYearId ? ' selected' : '') + '>Năm học ' + esc(y.name.replace('-', '–')) + '</option>').join('');
  }

  // Full-page Jmix editor: title, body, then Cancel / OK at bottom-right.
  function editor(el, o) {
    el.classList.add('dm-view');
    el.innerHTML = '<h1 class="view-title dm-title">' + esc(o.title) + '</h1>' + o.body +
      '<div class="dm-foot">' + btn({ label: 'Cancel', action: 'dm-cancel' }) + btn({ label: 'OK', variant: 'primary', action: 'dm-ok' }) + '</div>';
    el.addEventListener('click', (e) => {
      const a = e.target.closest('[data-action]'); if (!a || a.disabled) return;
      if (a.dataset.action === 'dm-cancel') App.go(o.back);
      else if (a.dataset.action === 'dm-ok') {
        const form = $('.dm-form', el);
        if (!validate(form)) { toast('Vui lòng nhập đủ các trường bắt buộc', 'danger'); return; }
        const err = o.onOk(formValues(form));
        if (err) { toast(err, 'danger'); return; }
        App.save(); toast('Đã lưu', 'success'); App.go(o.back);
      }
    });
  }
  function fieldError(root, name, msg) {
    const c = root.querySelector('[name="' + name + '"]'); if (!c) return;
    const f = c.closest('.field'); f.classList.add('invalid');
    const old = f.querySelector('.err'); if (old) old.remove();
    f.insertAdjacentHTML('beforeend', '<div class="err">' + esc(msg) + '</div>');
  }
  // Small dialog with a form (Figma: no header divider, bordered close, Cancel/OK).
  function formDialog(o) {
    return dialog({
      title: o.title, width: o.width, body: '<div class="dm-form dm-dlg-form">' + o.body + '</div>',
      footer: btn({ label: 'Cancel', action: 'close' }) + btn({ label: 'OK', variant: 'primary', action: 'ok' }),
      onClose: o.onClose,
      onMount(dlg, close) {
        dlg.classList.add('dm-dlg');
        const form = $('.dm-form', dlg);
        const submit = () => {
          if (!validate(form)) return;
          const v = formValues(form); const err = o.onOk(v, form);
          if (err) { fieldError(form, err[0], err[1]); return; }
          close();
        };
        dlg.querySelector('[data-action="ok"]').addEventListener('click', submit);
        form.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); submit(); } });
        o.onMount && o.onMount(dlg);
      },
    });
  }
  // Nested grid toolbar (Create / Edit / Remove) + grid, re-drawn in place.
  function nestedGrid(host, o) {
    let sel = [];
    const draw = () => {
      const rows = o.rows();
      sel = sel.filter((k) => rows.some((r) => r.id === k));
      host.innerHTML = '<div class="dm-tools">' + btn({ label: 'Create', icon: 'plus', variant: 'primary', action: 'n-create' }) +
        btn({ label: 'Edit', icon: 'pencil', action: 'n-edit', disabled: sel.length !== 1 }) + btn({ label: 'Remove', icon: 'trash', action: 'n-remove', disabled: !sel.length }) + '</div>' +
        grid({ columns: o.columns, rows, selectable: 'single', selected: sel, striped: o.striped, empty: o.empty, id: o.id });
      const g = host.querySelector('.ui-grid-wrap'); g.classList.add(...o.cls.split(' '));
      bindGrid(g, { selectable: 'single', selected: sel, onSelect: (ids) => { sel = ids; host.querySelector('[data-action="n-edit"]').disabled = sel.length !== 1; host.querySelector('[data-action="n-remove"]').disabled = !sel.length; }, onRowDblClick: (k) => o.onEdit(k) });
    };
    host.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-action^="n-"]'); if (!a || a.disabled) return;
      e.stopPropagation();
      if (a.dataset.action === 'n-create') o.onCreate();
      else if (a.dataset.action === 'n-edit') o.onEdit(sel[0]);
      else if (a.dataset.action === 'n-remove') {
        if (await confirm({ title: 'Xác nhận xóa', message: o.removeMsg || 'Bạn có chắc muốn xóa bản ghi đã chọn?', okLabel: 'Xóa', danger: true })) { o.onRemove(sel[0]); sel = []; draw(); }
      }
    });
    draw();
    return { redraw: draw };
  }

  // =====================================================================
  // 01 — Năm học
  // =====================================================================
  frame('01', 'Năm học / Danh sách', '/nam-hoc', 'Năm học & lớp');
  frame('01b', 'Năm học / Chi tiết', '/nam-hoc/y2025', 'Năm học & lớp');
  frame('01c', 'Năm học / Thêm giai đoạn', '/nam-hoc/y2025?dialog=stage', 'Năm học & lớp');

  route('/nam-hoc', {
    title: 'Năm học', menu: 'nam-hoc',
    render({ el }) {
      UI.crudList({
        el, title: 'Năm học',
        columns: [
          { key: 'name', label: 'Năm học', width: '25%' },
          { key: 'start', label: 'Ngày bắt đầu', width: '25%' },
          { key: 'end', label: 'Ngày kết thúc', width: '25%' },
          { key: 'school', label: 'Trường (đơn vị)', render: () => esc(schoolName()) },
        ],
        rows: () => D().years,
        searchKeys: ['name', 'start', 'end'],
        onCreate: () => App.go('/nam-hoc/new'),
        onEdit: (id) => App.go('/nam-hoc/' + id),
        onRemove: (ids) => {
          if (D().years.length - ids.length < 1) { toast('Phải giữ lại ít nhất một năm học', 'danger'); return; }
          D().years = D().years.filter((y) => !ids.includes(y.id));
          const gone = new Set(D().classes.filter((c) => ids.includes(c.yearId)).map((c) => c.id));
          D().classes = D().classes.filter((c) => !gone.has(c.id));
          (D().students || []).forEach((s) => ids.forEach((y) => { if (s.classes) delete s.classes[y]; }));
          if (ids.includes(D().currentYearId)) D().currentYearId = D().years[0].id;
          refreshYearSelect();
        },
      });
    },
  });

  route('/nam-hoc/:id', {
    title: 'Thông tin năm học', menu: 'nam-hoc',
    render({ el, params, query }) {
      const isNew = params.id === 'new';
      const src = isNew ? { id: uid('y'), name: '', start: '', end: '', schoolId: (D().school || {}).id, stages: [] } : D().years.find((y) => y.id === params.id);
      if (!src) { UI.placeholder(el, 'Không tìm thấy năm học', 'Năm học này không tồn tại hoặc đã bị xóa.'); return; }
      const draft = clone(src); draft.stages = draft.stages || [];
      editor(el, {
        title: 'Thông tin năm học', back: '/nam-hoc',
        body: '<div class="dm-form">' + schoolField(560) +
          field({ label: 'Năm học', name: 'name', value: draft.name, required: true, placeholder: 'VD: 2027-2028', cls: 'w280' }) +
          '<div class="dm-break"></div>' +
          field({ label: 'Ngày bắt đầu', name: 'start', type: 'date', value: draft.start, required: true, cls: 'w280' }) +
          field({ label: 'Ngày kết thúc', name: 'end', type: 'date', value: draft.end, required: true, cls: 'w280' }) + '</div>' +
          '<h2 class="dm-section">Các giai đoạn trong năm học</h2><div class="dm-nested dm-fill" id="stHost"></div>',
        onOk(v) {
          const name = v.name.trim();
          if (!/^\d{4}-\d{4}$/.test(name)) { fieldError(el, 'name', 'Định dạng năm học: YYYY-YYYY'); return 'Tên năm học không hợp lệ'; }
          if (D().years.some((y) => y.id !== draft.id && y.name === name)) { fieldError(el, 'name', 'Năm học đã tồn tại'); return 'Năm học đã tồn tại'; }
          if (dnum(v.end) <= dnum(v.start)) { fieldError(el, 'end', 'Ngày kết thúc phải sau ngày bắt đầu'); return 'Ngày kết thúc phải sau ngày bắt đầu'; }
          Object.assign(draft, { name, start: v.start, end: v.end });
          if (isNew) D().years.push(draft); else Object.assign(src, draft);
          refreshYearSelect();
          return null;
        },
      });
      const stageDialog = (st) => {
        const n = draft.stages.length;
        const val = st || { name: 'Học Kì ' + (n + 1), start: n ? '' : formValues($('.dm-form', el)).start, end: '' };
        formDialog({
          title: st ? 'Sửa giai đoạn' : 'Thêm giai đoạn', width: '650px',
          body: field({ label: 'Tên giai đoạn', name: 'name', value: val.name, required: true }) +
            field({ label: 'Ngày bắt đầu', name: 'start', type: 'date', value: val.start, required: true }) +
            field({ label: 'Ngày kết thúc', name: 'end', type: 'date', value: val.end, required: true }),
          onClose: () => clearQuery('/nam-hoc/' + params.id),
          onOk(v) {
            if (dnum(v.end) <= dnum(v.start)) return ['end', 'Ngày kết thúc phải sau ngày bắt đầu'];
            if (draft.stages.some((x) => x !== st && x.name.trim().toLowerCase() === v.name.trim().toLowerCase())) return ['name', 'Tên giai đoạn đã tồn tại'];
            if (st) Object.assign(st, { name: v.name.trim(), start: v.start, end: v.end });
            else draft.stages.push({ id: uid('st'), name: v.name.trim(), start: v.start, end: v.end });
            draft.stages.sort((a, b) => dnum(a.start) - dnum(b.start));
            stages.redraw();
            return null;
          },
        });
      };
      const stages = nestedGrid($('#stHost', el), {
        id: 'stGrid', cls: 'dm-compact fill', striped: true, empty: 'Chưa có giai đoạn nào',
        columns: [{ key: 'name', label: 'Tên giai đoạn', width: '33.33%' }, { key: 'start', label: 'Ngày bắt đầu', width: '33.33%' }, { key: 'end', label: 'Ngày kết thúc' }],
        rows: () => draft.stages,
        onCreate: () => stageDialog(null),
        onEdit: (id) => stageDialog(draft.stages.find((s) => s.id === id)),
        onRemove: (id) => { draft.stages = draft.stages.filter((s) => s.id !== id); },
        removeMsg: 'Bạn có chắc muốn xóa giai đoạn đã chọn?',
      });
      if (query.dialog === 'stage') stageDialog(null);
    },
  });

  // =====================================================================
  // 02 — Khối và lớp học
  // =====================================================================
  frame('02', 'Khối và lớp học / Danh sách', '/khoi-lop', 'Năm học & lớp');
  frame('02b', 'Khối và lớp học / Chi tiết', '/khoi-lop/g10', 'Năm học & lớp');
  frame('02c', 'Khối và lớp học / Thêm lớp', '/khoi-lop/g10?dialog=class', 'Năm học & lớp');

  const expanded = { g10: true };
  const classesOf = (gradeId, yearId) => D().classes.filter((c) => c.gradeId === gradeId && c.yearId === yearId).sort((a, b) => a.name.localeCompare(b.name, 'vi', { numeric: true }));
  const studentsIn = (classId) => (D().students || []).filter((s) => Object.values(s.classes || {}).includes(classId)).length;
  function removeClasses(ids) {
    const set = new Set(ids);
    D().classes = D().classes.filter((c) => !set.has(c.id));
    (D().students || []).forEach((s) => Object.keys(s.classes || {}).forEach((y) => { if (set.has(s.classes[y])) s.classes[y] = ''; }));
  }

  route('/khoi-lop', {
    title: 'Khối và lớp học', menu: 'khoi-lop',
    render({ el, year }) {
      const rows = () => {
        const out = [];
        D().grades.slice().sort((a, b) => (a.level || 0) - (b.level || 0) || a.name.localeCompare(b.name)).forEach((g) => {
          const cls = classesOf(g.id, year.id);
          out.push({ key: 'g:' + g.id, kind: 'g', id: g.id, name: g.name, year: year.name, count: cls.length });
          if (expanded[g.id]) cls.forEach((c) => out.push({ key: 'c:' + c.id, kind: 'c', id: c.id, gradeId: g.id, name: c.name, year: year.name, count: '' }));
        });
        return out;
      };
      const list = UI.crudList({
        el, title: 'Khối và lớp học', rowKey: 'key',
        columns: [
          { key: 'name', label: 'Tên khối/lớp', width: '40%', render: (r) => r.kind === 'g'
            ? '<button type="button" class="dm-tog" data-tog="' + esc(r.id) + '" aria-label="' + (expanded[r.id] ? 'Thu gọn' : 'Mở rộng') + '">' + UI.icon(expanded[r.id] ? 'angle-down' : 'angle-right') + '</button>' + esc(r.name)
            : '<span class="dm-indent">' + esc(r.name) + '</span>' },
          { key: 'year', label: 'Năm học', width: '20%' },
          { key: 'school', label: 'Trường (đơn vị)', width: '29%', render: () => esc(schoolName()) },
          { key: 'count', label: 'Số lớp' },
        ],
        rows, searchKeys: ['name'],
        onCreate: () => App.go('/khoi-lop/new'),
        onEdit: (key) => { const [k, id] = key.split(':'); if (k === 'g') App.go('/khoi-lop/' + id); else { const c = D().classes.find((x) => x.id === id); if (c) App.go('/khoi-lop/' + c.gradeId + '?class=' + id); } },
        onRemove: (keys) => keys.forEach((key) => {
          const [k, id] = key.split(':');
          if (k === 'c') removeClasses([id]);
          else { removeClasses(D().classes.filter((c) => c.gradeId === id).map((c) => c.id)); D().grades = D().grades.filter((g) => g.id !== id); }
        }),
      });
      el.addEventListener('click', (e) => {
        const t = e.target.closest('[data-tog]'); if (!t) return;
        expanded[t.dataset.tog] = !expanded[t.dataset.tog]; list.redraw();
      });
    },
  });

  route('/khoi-lop/:id', {
    title: 'Thông tin khối', menu: 'khoi-lop',
    render({ el, params, query, year }) {
      const isNew = params.id === 'new';
      const src = isNew ? { id: uid('g'), name: '', level: 0 } : D().grades.find((g) => g.id === params.id);
      if (!src) { UI.placeholder(el, 'Không tìm thấy khối', 'Khối này không tồn tại hoặc đã bị xóa.'); return; }
      const draft = clone(src);
      let yearId = year.id;
      let cls = clone(D().classes.filter((c) => c.gradeId === src.id)); // all years, committed on OK
      editor(el, {
        title: 'Thông tin khối', back: '/khoi-lop',
        body: '<div class="dm-form">' + schoolField(360) +
          field({ label: 'Năm học', name: 'yearId', type: 'select', value: yearId, required: true, options: D().years.map((y) => ({ value: y.id, label: y.name })), cls: 'w360' }) +
          field({ label: 'Tên khối', name: 'name', value: draft.name, required: true, placeholder: 'VD: Khối 10', cls: 'w360' }) + '</div>' +
          '<h2 class="dm-section">Danh sách lớp</h2><div class="dm-nested dm-w1120" id="clsHost"></div>',
        onOk(v) {
          const name = v.name.trim();
          if (D().grades.some((g) => g.id !== draft.id && g.name.toLowerCase() === name.toLowerCase())) { fieldError(el, 'name', 'Tên khối đã tồn tại'); return 'Tên khối đã tồn tại'; }
          draft.name = name; const lv = name.match(/\d+/); draft.level = lv ? +lv[0] : draft.level;
          if (isNew) D().grades.push(draft); else Object.assign(src, draft);
          const keep = new Set(cls.map((c) => c.id));
          removeClasses(D().classes.filter((c) => c.gradeId === src.id && !keep.has(c.id)).map((c) => c.id));
          cls.forEach((c) => { const ex = D().classes.find((x) => x.id === c.id); if (ex) Object.assign(ex, c); else D().classes.push(c); });
          expanded[draft.id] = true;
          return null;
        },
      });
      const classDialog = (c) => formDialog({
        title: c ? 'Sửa lớp' : 'Thêm lớp', width: '520px',
        body: field({ label: 'Tên lớp', name: 'name', value: c ? c.name : '', required: true, placeholder: 'VD: 10A5' }),
        onClose: () => clearQuery('/khoi-lop/' + params.id),
        onOk(v) {
          const name = v.name.trim().toUpperCase();
          const clash = cls.concat(D().classes.filter((x) => x.gradeId !== src.id)).some((x) => x.id !== (c && c.id) && x.yearId === yearId && x.name.toUpperCase() === name);
          if (clash) return ['name', 'Lớp ' + name + ' đã có trong năm học này'];
          if (c) c.name = name;
          else cls.push({ id: uid('c'), name, gradeId: src.id, yearId, teacher: '', room: 'P.' + name.replace('A', '0'), trainingSystemId: (D().trainingSystems[0] || {}).id || '', capacity: 35 });
          classes.redraw();
          return null;
        },
      });
      const classes = nestedGrid($('#clsHost', el), {
        id: 'clsGrid', cls: 'dm-tall', striped: false, empty: 'Khối chưa có lớp nào trong năm học này',
        columns: [{ key: 'name', label: 'Tên lớp' }],
        rows: () => cls.filter((c) => c.yearId === yearId).sort((a, b) => a.name.localeCompare(b.name, 'vi', { numeric: true })),
        onCreate: () => classDialog(null),
        onEdit: (id) => classDialog(cls.find((c) => c.id === id)),
        onRemove: (id) => { const n = studentsIn(id); cls = cls.filter((c) => c.id !== id); if (n) toast(n + ' học sinh của lớp sẽ chuyển sang "Chưa xếp lớp" khi lưu'); },
        removeMsg: 'Bạn có chắc muốn xóa lớp đã chọn?',
      });
      $('[name="yearId"]', el).addEventListener('change', (e) => { yearId = e.target.value; classes.redraw(); });
      if (query.dialog === 'class') classDialog(null);
      else if (query.class) { const c = cls.find((x) => x.id === query.class); if (c) classDialog(c); }
    },
  });

  // =====================================================================
  // 03 / 05 — simple named catalogs (Hệ đào tạo, Đơn vị tính)
  // =====================================================================
  function simpleCatalog(o) {
    frame(o.code, o.title + ' / Danh sách', o.base, 'Danh mục dùng chung');
    frame(o.code + 'b', o.title + ' / Chi tiết', o.base + '/' + o.sample, 'Danh mục dùng chung');
    route(o.base, {
      title: o.title, menu: o.menu,
      render({ el }) {
        UI.crudList({
          el, title: o.title,
          columns: [{ key: 'name', label: o.nameLabel, width: '42%' }, { key: 'school', label: 'Trường (đơn vị)', render: () => esc(schoolName()) }],
          rows: () => D()[o.key], searchKeys: ['name', 'code'],
          onCreate: () => App.go(o.base + '/new'),
          onEdit: (id) => App.go(o.base + '/' + id),
          onRemove: (ids) => { D()[o.key] = D()[o.key].filter((x) => !ids.includes(x.id)); },
        });
      },
    });
    route(o.base + '/:id', {
      title: o.detailTitle, menu: o.menu,
      render({ el, params }) {
        const isNew = params.id === 'new';
        const src = isNew ? { id: uid(o.prefix), code: '', name: '' } : D()[o.key].find((x) => x.id === params.id);
        if (!src) { UI.placeholder(el, 'Không tìm thấy bản ghi', 'Bản ghi này không tồn tại hoặc đã bị xóa.'); return; }
        editor(el, {
          title: o.detailTitle, back: o.base,
          body: '<div class="dm-form dm-gap20">' + schoolField(520) + field({ label: o.nameLabel, name: 'name', value: src.name, required: true, cls: 'w520' }) + '</div>',
          onOk(v) {
            const name = v.name.trim();
            if (D()[o.key].some((x) => x.id !== src.id && x.name.toLowerCase() === name.toLowerCase())) { fieldError(el, 'name', o.nameLabel + ' đã tồn tại'); return o.nameLabel + ' đã tồn tại'; }
            src.name = name;
            if (!src.code) src.code = UI.norm(name).replace(/[^a-z0-9]+/g, '').toUpperCase().slice(0, 8);
            if (isNew) D()[o.key].push(src);
            return null;
          },
        });
      },
    });
  }
  simpleCatalog({ code: '03', title: 'Hệ đào tạo', base: '/he-dao-tao', menu: 'he-dao-tao', key: 'trainingSystems', sample: 'ts1', prefix: 'ts', nameLabel: 'Tên hệ đào tạo', detailTitle: 'Thông tin hệ đào tạo' });

  // =====================================================================
  // 04 — Diện ưu tiên
  // =====================================================================
  frame('04', 'Diện ưu tiên / Danh sách', '/dien-uu-tien', 'Danh mục dùng chung');
  frame('04b', 'Diện ưu tiên / Chi tiết', '/dien-uu-tien/pg2', 'Danh mục dùng chung');

  const LOAI = [{ value: 'mien', label: 'Miễn học phí' }, { value: 'giam', label: 'Giảm học phí' }];
  const THOI_GIAN = [{ value: 'nam-hoc', label: 'Cả năm học' }, { value: 'thang', label: 'Theo khoảng tháng' }];
  const MONTHS = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8].map((m) => ({ value: String(m), label: 'Tháng ' + m }));
  const pgType = (p) => p.type || (Number(p.discount) >= 100 ? 'mien' : 'giam');
  const pgPeriod = (p) => (p.period === 'thang' ? 'Tháng ' + p.fromMonth + ' – Tháng ' + p.toMonth : 'Cả năm học');

  route('/dien-uu-tien', {
    title: 'Diện ưu tiên', menu: 'dien-uu-tien',
    render({ el }) {
      UI.crudList({
        el, title: 'Diện ưu tiên',
        columns: [
          { key: 'name', label: 'Tên diện ưu tiên', width: '20.3%' },
          { key: 'type', label: 'Loại miễn giảm', width: '17.7%', render: (r) => esc((LOAI.find((x) => x.value === pgType(r)) || {}).label) },
          { key: 'discount', label: 'Mức miễn giảm', width: '14.3%', render: (r) => esc(r.discount + '%') },
          { key: 'period', label: 'Thời gian áp dụng', width: '17.7%', render: (r) => esc(pgPeriod(r)) },
          { key: 'school', label: 'Trường (đơn vị)', render: () => esc(schoolName()) },
        ],
        rows: () => D().priorityGroups, searchKeys: ['name', 'code'],
        onCreate: () => App.go('/dien-uu-tien/new'),
        onEdit: (id) => App.go('/dien-uu-tien/' + id),
        onRemove: (ids) => {
          D().priorityGroups = D().priorityGroups.filter((p) => !ids.includes(p.id));
          (D().students || []).forEach((s) => { if (ids.includes(s.priorityId)) s.priorityId = ''; });
        },
      });
    },
  });

  route('/dien-uu-tien/:id', {
    title: 'Thông tin diện ưu tiên', menu: 'dien-uu-tien',
    render({ el, params }) {
      const isNew = params.id === 'new';
      const src = isNew ? { id: uid('pg'), code: '', name: '', discount: 100, type: 'mien', period: 'nam-hoc', fromMonth: '9', toMonth: '5', note: '' } : D().priorityGroups.find((p) => p.id === params.id);
      if (!src) { UI.placeholder(el, 'Không tìm thấy diện ưu tiên', 'Diện ưu tiên này không tồn tại hoặc đã bị xóa.'); return; }
      const type = pgType(src); const period = src.period || 'nam-hoc';
      const nStudents = (D().students || []).filter((s) => s.priorityId === src.id).length;
      editor(el, {
        title: 'Thông tin diện ưu tiên', back: '/dien-uu-tien',
        body: '<div class="dm-form">' + schoolField(360) +
          field({ label: 'Tên diện ưu tiên', name: 'name', value: src.name, required: true, cls: 'w360' }) +
          field({ label: 'Loại miễn giảm', name: 'type', type: 'select', value: type, options: LOAI, required: true, cls: 'w360' }) +
          field({ label: 'Mức miễn giảm (%)', name: 'discount', type: 'number', value: src.discount, required: true, cls: 'w360', attrs: { min: 0, max: 100 } }) +
          field({ label: 'Thời gian áp dụng', name: 'period', type: 'select', value: period, options: THOI_GIAN, required: true, cls: 'w360' }) +
          field({ label: 'Từ tháng', name: 'fromMonth', type: 'select', value: src.fromMonth || '9', options: MONTHS, cls: 'w170', disabled: period !== 'thang' }) +
          field({ label: 'Đến tháng', name: 'toMonth', type: 'select', value: src.toMonth || '5', options: MONTHS, cls: 'w170', disabled: period !== 'thang' }) + '</div>' +
          '<div class="note dm-summary"><b class="dm-sum-title">Quy tắc áp dụng</b><div>Mức miễn giảm chỉ áp dụng cho các khoản thu có đánh dấu “Áp dụng miễn giảm”, trong thời gian áp dụng. ' +
          (isNew ? 'Gán diện ưu tiên cho học sinh tại hồ sơ học sinh.' : 'Hiện có <b>' + nStudents + '</b> học sinh thuộc diện này.') + '</div></div>',
        onOk(v) {
          const name = v.name.trim(); const disc = Number(v.discount);
          if (!(disc > 0 && disc <= 100)) { fieldError(el, 'discount', 'Nhập từ 1 đến 100'); return 'Mức miễn giảm không hợp lệ'; }
          if (D().priorityGroups.some((p) => p.id !== src.id && p.name.toLowerCase() === name.toLowerCase())) { fieldError(el, 'name', 'Tên diện ưu tiên đã tồn tại'); return 'Tên diện ưu tiên đã tồn tại'; }
          Object.assign(src, { name, type: v.type, discount: disc, period: v.period, fromMonth: v.fromMonth || src.fromMonth || '9', toMonth: v.toMonth || src.toMonth || '5' });
          src.note = (v.type === 'mien' ? 'Miễn ' : 'Giảm ') + disc + '% học phí';
          if (!src.code) src.code = UI.norm(name).split(/\s+/).map((w) => w[0] || '').join('').toUpperCase();
          if (isNew) D().priorityGroups.push(src);
          return null;
        },
      });
      const f = $('.dm-form', el);
      const typeSel = $('[name="type"]', f), disc = $('[name="discount"]', f), per = $('[name="period"]', f);
      const syncType = () => { if (typeSel.value === 'mien') { disc.value = 100; disc.readOnly = true; } else { disc.readOnly = false; if (+disc.value >= 100) disc.value = 50; } };
      typeSel.addEventListener('change', syncType); if (typeSel.value === 'mien') disc.readOnly = true;
      per.addEventListener('change', () => { ['fromMonth', 'toMonth'].forEach((n) => { $('[name="' + n + '"]', f).disabled = per.value !== 'thang'; }); });
    },
  });

  simpleCatalog({ code: '05', title: 'Đơn vị tính', base: '/don-vi-tinh', menu: 'don-vi-tinh', key: 'units', sample: 'u1', prefix: 'u', nameLabel: 'Tên đơn vị tính', detailTitle: 'Thông tin đơn vị tính' });
})();
