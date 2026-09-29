/* Quản trị hệ thống: Người dùng, Phân quyền (quyền chức năng + quyền dữ liệu), Đa đơn vị, Công cụ dữ liệu.
   Roles follow "Tài liệu thuyết minh EduPay" §4; perms are stored in App.data.roles[].perms. */
(function () {
  'use strict';
  const { route, frame } = App;
  const { esc, icon, btn, field, grid, bindGrid, dialog, confirm, toast, badge, crudList, validate, formValues, $, $$ } = UI;
  const D = () => App.data;

  frame('QT1', 'Người dùng', '/nguoi-dung', 'Quản trị hệ thống');
  frame('QT2', 'Phân quyền theo vai trò', '/phan-quyen?role=thu-quy', 'Quản trị hệ thống');
  frame('QT3', 'Đa đơn vị (trường)', '/da-don-vi', 'Quản trị hệ thống');
  frame('QT4', 'Công cụ dữ liệu', '/cong-cu-du-lieu', 'Quản trị hệ thống');
  frame('ĐN', 'Đăng nhập', '/dang-xuat', 'Chung');

  const roleName = (id) => ((D().roles || []).find((r) => r.id === id) || {}).name || id;
  const unitName = (id) => ((D().orgUnits || []).find((u) => u.id === id) || {}).name || '';
  function scopeOptions() {
    const out = [{ value: 'all', label: 'Toàn trường' }];
    (D().grades || []).forEach((g) => out.push({ value: 'grade:' + g.id, label: g.name }));
    (D().classes || []).filter((c) => c.yearId === D().currentYearId).forEach((c) => out.push({ value: 'class:' + c.id, label: 'Lớp ' + c.name }));
    return out;
  }
  const scopeLabel = (s) => (scopeOptions().find((o) => o.value === s) || { label: 'Toàn trường' }).label;

  // Logout link used by the screen index.
  route('/dang-xuat', { title: 'Đăng xuất', render() { App.login(''); App.go('/'); } });

  // ---------- Người dùng ----------
  route('/nguoi-dung', {
    title: 'Người dùng', menu: 'nguoi-dung',
    render({ el }) {
      const list = crudList({
        el, title: 'Người dùng', rowKey: 'id', searchKeys: ['username', 'name', 'email', 'phone'],
        rows: () => D().users,
        columns: [
          { key: 'username', label: 'Tên đăng nhập', render: (u) => '<b>' + esc(u.username) + '</b>' + (u.id === (App.user() || {}).id ? ' ' + badge('Đang đăng nhập', 'accent') : '') },
          { key: 'name', label: 'Họ và tên' },
          { key: 'roleId', label: 'Vai trò', render: (u) => esc(roleName(u.roleId)) },
          { key: 'unitId', label: 'Đơn vị', render: (u) => esc(unitName(u.unitId)) },
          { key: 'dataScope', label: 'Quyền dữ liệu', render: (u) => u.roleId === 'phu-huynh' ? esc((u.studentIds || []).length + ' học sinh') : esc(scopeLabel(u.dataScope)) },
          { key: 'active', label: 'Trạng thái', render: (u) => u.active === false ? badge('Đã khóa', 'danger') : badge('Hoạt động', 'success') },
          { key: 'lastLogin', label: 'Đăng nhập gần nhất', render: (u) => '<span class="muted">' + esc(u.lastLogin || '—') + '</span>' },
        ],
        onCreate: () => editUser(null, () => list.redraw()),
        onEdit: (id) => editUser(id, () => list.redraw()),
        onRemove: (ids) => {
          if (ids.includes((App.user() || {}).id)) { toast('Không thể xóa tài khoản đang đăng nhập.', 'danger'); return false; }
          D().users = D().users.filter((u) => !ids.includes(u.id));
        },
      });
    },
  });

  function editUser(id, done) {
    const u = id ? D().users.find((x) => x.id === id) : null;
    const v = u || { roleId: 'thu-quy', unitId: 'sch1', dataScope: 'all', active: true, studentIds: [] };
    const codes = (v.studentIds || []).map((sid) => ((D().students || []).find((s) => s.id === sid) || {}).code).filter(Boolean).join(', ');
    dialog({
      title: u ? 'Sửa người dùng' : 'Thêm người dùng', width: '720px',
      body: '<form class="form-grid" style="--cols:2" id="quForm">' +
        field({ name: 'name', label: 'Họ và tên', required: true, value: v.name }) +
        field({ name: 'username', label: 'Tên đăng nhập', required: true, value: v.username, help: 'Phụ huynh đăng nhập bằng số điện thoại.' }) +
        field({ name: 'email', label: 'Email', value: v.email }) +
        field({ name: 'phone', label: 'Số điện thoại', value: v.phone }) +
        field({ name: 'roleId', label: 'Vai trò', type: 'select', required: true, value: v.roleId, options: (D().roles || []).map((r) => ({ value: r.id, label: r.name })) }) +
        field({ name: 'unitId', label: 'Đơn vị (trường)', type: 'select', value: v.unitId, options: (D().orgUnits || []).filter((x) => x.active !== false || x.id === v.unitId).map((x) => ({ value: x.id, label: x.name })) }) +
        '<div class="field span-all" id="quScopeWrap">' + field({ name: 'dataScope', label: 'Quyền dữ liệu', type: 'select', value: v.dataScope || 'all', options: scopeOptions(), help: 'Giới hạn khối/lớp mà người dùng được xem và thao tác.' }) + '</div>' +
        '<div class="field span-all" id="quKidsWrap">' + field({ name: 'kids', label: 'Học sinh liên kết (mã học sinh, cách nhau dấu phẩy)', value: codes, placeholder: 'VD: HS100003, HS100150' }) + '</div>' +
        '<div class="field span-all"><label class="chk"><input type="checkbox" name="active"' + (v.active !== false ? ' checked' : '') + '> Tài khoản đang hoạt động</label></div>' +
        '</form>',
      footer: (u ? btn({ label: 'Đặt lại mật khẩu', icon: 'key', variant: 'tertiary', action: 'reset' }) + '<span class="grow"></span>' : '') + btn({ label: 'Hủy', action: 'close' }) + btn({ label: 'Lưu', icon: 'check', variant: 'primary', action: 'ok' }),
      onMount(d, close) {
        const sync = () => { const parent = $('[name=roleId]', d).value === 'phu-huynh'; $('#quKidsWrap', d).hidden = !parent; $('#quScopeWrap', d).hidden = parent; };
        $('[name=roleId]', d).addEventListener('change', sync); sync();
        d.addEventListener('click', (e) => {
          const a = e.target.closest('[data-action]'); if (!a) return;
          if (a.dataset.action === 'reset') toast('Đã gửi mật khẩu tạm cho ' + (u.email || u.phone || u.username), 'success');
          if (a.dataset.action !== 'ok') return;
          const f = $('#quForm', d); if (!validate(f)) return;
          const x = formValues(f);
          if (D().users.some((o) => o.username.toLowerCase() === x.username.trim().toLowerCase() && o.id !== id)) { toast('Tên đăng nhập đã tồn tại.', 'danger'); return; }
          if (id === (App.user() || {}).id && (!x.active || x.roleId !== u.roleId)) { toast('Không thể khóa hoặc đổi vai trò của tài khoản đang đăng nhập.', 'danger'); return; }
          const kids = String(x.kids || '').split(/[,\s]+/).filter(Boolean).map((c) => ((D().students || []).find((s) => s.code.toLowerCase() === c.toLowerCase()) || {}).id).filter(Boolean);
          const rec = Object.assign(u || { id: UI.uid('u'), lastLogin: '' }, { name: x.name.trim(), username: x.username.trim(), email: x.email, phone: x.phone, roleId: x.roleId, unitId: x.unitId, dataScope: x.dataScope || 'all', active: !!x.active, studentIds: x.roleId === 'phu-huynh' ? kids : [] });
          if (!u) D().users.push(rec);
          App.save(); close(); toast(u ? 'Đã lưu người dùng' : 'Đã thêm người dùng', 'success'); done();
        });
      },
    });
  }

  // ---------- Phân quyền ----------
  route('/phan-quyen', {
    title: 'Phân quyền', menu: 'phan-quyen',
    render({ el, query }) {
      let roleId = query.role && D().roles.some((r) => r.id === query.role) ? query.role : D().roles[0].id;
      let draft = null; let dirty = false;
      const load = () => { const r = D().roles.find((x) => x.id === roleId); draft = JSON.parse(JSON.stringify(r)); dirty = false; };
      load();
      const LEVELS = [['', 'Không'], ['view', 'Chỉ xem'], ['full', 'Toàn quyền']];
      function draw() {
        const users = (D().users || []).filter((u) => u.roleId === roleId);
        el.innerHTML = '<div class="view-head"><h1 class="view-title">Phân quyền</h1><span class="grow"></span>' +
          btn({ label: 'Thêm vai trò', icon: 'plus', action: 'new-role' }) + '</div>' +
          '<div class="split qt-split" style="--split-left:270px">' +
          '<div class="card"><div class="card-head">Vai trò</div><div class="vtabs">' + D().roles.map((r) => '<button type="button" class="vtab' + (r.id === roleId ? ' active' : '') + '" data-role="' + esc(r.id) + '"><span style="flex:1">' + esc(r.name) + '</span><span class="badge">' + D().users.filter((u) => u.roleId === r.id).length + '</span></button>').join('') + '</div></div>' +
          '<div class="stack">' +
          '<div class="card card-pad"><div class="form-grid" style="--cols:2" id="qtRoleForm">' +
          field({ id: 'qtName', name: 'name', label: 'Tên vai trò', required: true, value: draft.name }) +
          field({ id: 'qtWho', name: 'who', label: 'Ai đảm nhiệm', value: draft.who }) +
          field({ id: 'qtDesc', name: 'desc', label: 'Công việc chính', type: 'textarea', value: draft.desc, cls: 'span-all' }) +
          field({ id: 'qtHome', name: 'home', label: 'Màn hình mở đầu sau khi đăng nhập', type: 'select', value: draft.home, options: [{ value: '/', label: 'Trang chủ' }].concat(App.MENU.flatMap((g) => g.items).map((i) => ({ value: i.path, label: i.label }))) }) +
          '<div class="field"><span class="lbl">Người dùng thuộc vai trò</span><div class="qt-users">' + (users.length ? users.map((u) => '<span class="badge' + (u.active === false ? '' : ' accent') + '">' + esc(u.name) + '</span>').join('') : '<span class="muted">Chưa có</span>') + '</div></div>' +
          '</div></div>' +
          '<div class="card"><div class="card-head">Quyền chức năng<span class="grow"></span>' +
          '<span class="muted qt-legend">Chỉ xem: mở màn hình, không thêm/sửa/xóa · Toàn quyền: thao tác đầy đủ</span></div>' +
          '<div class="ui-grid-wrap" style="border:0;border-radius:0"><table class="ui-grid perm-matrix"><thead><tr><th>Chức năng</th>' + LEVELS.map((l) => '<th style="text-align:center;width:110px">' + l[1] + '</th>').join('') + '</tr></thead><tbody>' +
          App.MENU.map((g) => '<tr class="grp"><td colspan="4">' + esc(g.label) + ' <button type="button" class="btn tertiary sm" data-all="' + g.id + '">Cho phép toàn bộ nhóm</button> <button type="button" class="btn tertiary sm" data-none="' + g.id + '">Bỏ toàn bộ</button></td></tr>' +
            g.items.map((i) => '<tr><td>' + icon(i.icon) + ' ' + esc(i.label) + '</td>' + LEVELS.map((l) => '<td style="text-align:center"><input type="radio" name="p_' + i.id + '" value="' + l[0] + '" aria-label="' + esc(i.label + ': ' + l[1]) + '"' + ((draft.perms[i.id] || '') === l[0] ? ' checked' : '') + '></td>').join('') + '</tr>').join('')).join('') +
          '</tbody></table></div></div>' +
          '<div class="card card-pad stack"><b>Quyền dữ liệu</b><p class="muted" style="margin:0">Mỗi người dùng chỉ làm việc trên dữ liệu của đơn vị (trường) mình. Phạm vi khối/lớp được gán cho từng người dùng trong màn <a href="#/nguoi-dung">Người dùng</a>; phụ huynh chỉ xem được học sinh được liên kết.</p></div>' +
          '<div class="row end">' + (draft.system ? '' : btn({ label: 'Xóa vai trò', icon: 'trash', variant: 'danger', action: 'del-role' })) + '<span class="grow"></span>' +
          '<span class="muted" id="qtDirty">' + (dirty ? 'Có thay đổi chưa lưu' : '') + '</span>' + btn({ label: 'Hoàn tác', action: 'undo', disabled: !dirty }) + btn({ label: 'Lưu phân quyền', icon: 'check', variant: 'primary', action: 'save', disabled: !dirty }) + '</div>' +
          '</div></div>';
      }
      const markDirty = () => { dirty = true; $('#qtDirty', el).textContent = 'Có thay đổi chưa lưu'; $('[data-action=undo]', el).disabled = false; $('[data-action=save]', el).disabled = false; };
      el.addEventListener('change', (e) => {
        const t = e.target;
        if (t.name && t.name.startsWith('p_')) { const k = t.name.slice(2); if (t.value) draft.perms[k] = t.value; else delete draft.perms[k]; markDirty(); }
        else if (t.closest('#qtRoleForm')) { draft[t.name] = t.value; markDirty(); }
      });
      el.addEventListener('input', (e) => { if (e.target.closest('#qtRoleForm') && e.target.name) { draft[e.target.name] = e.target.value; markDirty(); } });
      el.addEventListener('click', async (e) => {
        const r = e.target.closest('[data-role]');
        if (r) {
          if (dirty && !(await confirm({ title: 'Bỏ thay đổi?', message: 'Phân quyền của vai trò "' + draft.name + '" chưa được lưu.', okLabel: 'Bỏ thay đổi', danger: true }))) return;
          roleId = r.dataset.role; load(); draw(); return;
        }
        const all = e.target.closest('[data-all]'); const none = e.target.closest('[data-none]');
        if (all || none) { const g = App.MENU.find((x) => x.id === (all || none).dataset.all || x.id === (all || none).dataset.none); g.items.forEach((i) => { if (all) draft.perms[i.id] = 'full'; else delete draft.perms[i.id]; }); dirty = true; draw(); return; }
        const a = e.target.closest('[data-action]'); if (!a || a.disabled) return;
        if (a.dataset.action === 'undo') { load(); draw(); }
        if (a.dataset.action === 'save') {
          if (!draft.name.trim()) { toast('Tên vai trò không được để trống.', 'danger'); return; }
          const me = App.user();
          if (me && me.roleId === roleId && draft.perms['phan-quyen'] !== 'full') { toast('Không thể bỏ quyền Phân quyền của chính vai trò bạn đang dùng.', 'danger'); return; }
          const i = D().roles.findIndex((x) => x.id === roleId); D().roles[i] = draft; App.save(); load();
          toast('Đã lưu phân quyền cho vai trò ' + draft.name, 'success'); App.render();
        }
        if (a.dataset.action === 'new-role') {
          const id = UI.uid('role'); D().roles.push({ id, name: 'Vai trò mới', who: '', desc: '', home: '/', perms: {} }); App.save();
          roleId = id; load(); draw(); $('#qtName', el).focus();
        }
        if (a.dataset.action === 'del-role') {
          const n = D().users.filter((u) => u.roleId === roleId).length;
          if (n) { toast('Còn ' + n + ' người dùng thuộc vai trò này. Chuyển họ sang vai trò khác trước khi xóa.', 'danger'); return; }
          if (!(await confirm({ title: 'Xóa vai trò', message: 'Xóa vai trò "' + draft.name + '"?', okLabel: 'Xóa', danger: true }))) return;
          D().roles = D().roles.filter((x) => x.id !== roleId); App.save(); roleId = D().roles[0].id; load(); draw(); toast('Đã xóa vai trò', 'success');
        }
      });
      draw();
    },
  });

  // ---------- Đa đơn vị ----------
  route('/da-don-vi', {
    title: 'Đa đơn vị', menu: 'da-don-vi',
    render({ el }) {
      const list = crudList({
        el, title: 'Đơn vị (trường)', rowKey: 'id', searchKeys: ['code', 'name', 'address'],
        rows: () => D().orgUnits,
        columns: [
          { key: 'code', label: 'Mã đơn vị', width: '110px' },
          { key: 'name', label: 'Tên đơn vị', render: (u) => '<b>' + esc(u.name) + '</b>' },
          { key: 'address', label: 'Địa chỉ' },
          { key: 'taxCode', label: 'Mã số thuế' },
          { key: 'users', label: 'Người dùng', align: 'right', render: (u) => String((D().users || []).filter((x) => x.unitId === u.id).length) },
          { key: 'active', label: 'Trạng thái', render: (u) => u.active === false ? badge('Ngừng sử dụng') : badge('Đang sử dụng', 'success') },
        ],
        onCreate: () => editUnit(null, () => list.redraw()),
        onEdit: (id) => editUnit(id, () => list.redraw()),
        onRemove: (ids) => {
          if (ids.some((id) => (D().users || []).some((u) => u.unitId === id))) { toast('Đơn vị còn người dùng, không thể xóa. Hãy chuyển sang "Ngừng sử dụng".', 'danger'); return false; }
          D().orgUnits = D().orgUnits.filter((u) => !ids.includes(u.id));
        },
      });
    },
  });
  function editUnit(id, done) {
    const u = id ? D().orgUnits.find((x) => x.id === id) : null; const v = u || { active: true };
    dialog({ title: u ? 'Sửa đơn vị' : 'Thêm đơn vị', width: '640px',
      body: '<form class="form-grid" style="--cols:2" id="qdForm">' + field({ name: 'code', label: 'Mã đơn vị', required: true, value: v.code }) + field({ name: 'taxCode', label: 'Mã số thuế', value: v.taxCode }) +
        field({ name: 'name', label: 'Tên đơn vị', required: true, value: v.name, cls: 'span-all' }) + field({ name: 'address', label: 'Địa chỉ', value: v.address, cls: 'span-all' }) +
        field({ name: 'phone', label: 'Điện thoại', value: v.phone }) + '<div class="field" style="justify-content:flex-end"><label class="chk"><input type="checkbox" name="active"' + (v.active !== false ? ' checked' : '') + '> Đang sử dụng</label></div></form>',
      footer: btn({ label: 'Hủy', action: 'close' }) + btn({ label: 'Lưu', icon: 'check', variant: 'primary', action: 'ok' }),
      onMount(d, close) {
        $('[data-action=ok]', d).addEventListener('click', () => {
          const f = $('#qdForm', d); if (!validate(f)) return; const x = formValues(f);
          const rec = Object.assign(u || { id: UI.uid('sch') }, x, { active: !!x.active }); if (!u) D().orgUnits.push(rec);
          App.save(); close(); toast('Đã lưu đơn vị', 'success'); done();
        });
      } });
  }

  // ---------- Công cụ dữ liệu ----------
  route('/cong-cu-du-lieu', {
    title: 'Công cụ dữ liệu', menu: 'cong-cu',
    render({ el }) {
      const d = D();
      const rows = [
        ['Năm học', (d.years || []).length], ['Lớp học', (d.classes || []).length], ['Học sinh', (d.students || []).length],
        ['Khoản thu', (d.feeItems || []).length], ['Đợt thu', (d.rounds || []).length], ['Phiếu thu', (d.payments || []).length],
        ['Giao dịch ngân hàng', (d.bankTransfers || []).length], ['Người dùng', (d.users || []).length], ['Vai trò', (d.roles || []).length],
      ].map(([k, n], i) => ({ id: String(i), k, n }));
      el.innerHTML = '<h1 class="view-title">Công cụ dữ liệu</h1>' +
        '<div class="note">Dữ liệu của prototype được lưu trên trình duyệt của từng người xem. Thao tác ở đây không ảnh hưởng người khác.</div>' +
        grid({ columns: [{ key: 'k', label: 'Bảng dữ liệu' }, { key: 'n', label: 'Số bản ghi', align: 'right' }], rows, striped: true }) +
        '<div class="row">' + btn({ label: 'Xem dữ liệu JSON', icon: 'code', action: 'json' }) + btn({ label: 'Khôi phục dữ liệu mẫu', icon: 'refresh', variant: 'danger', action: 'reset' }) + '</div>';
      el.addEventListener('click', async (e) => {
        const a = e.target.closest('[data-action]'); if (!a) return;
        if (a.dataset.action === 'json') {
          dialog({ title: 'Dữ liệu JSON', width: '860px', footer: btn({ label: 'Sao chép', icon: 'copy', action: 'copy' }) + btn({ label: 'Đóng', variant: 'primary', action: 'close' }),
            body: '<textarea class="ctl" id="qtJson" readonly style="min-height:420px;font-family:ui-monospace,Consolas,monospace;font-size:12px">' + esc(JSON.stringify(D(), null, 2)) + '</textarea>',
            onMount(dl) { $('[data-action=copy]', dl).addEventListener('click', () => { const t = $('#qtJson', dl); navigator.clipboard.writeText(t.value).then(() => toast('Đã sao chép', 'success'), () => { t.select(); toast('Nhấn Ctrl+C để sao chép'); }); }); } });
        }
        if (a.dataset.action === 'reset' && await confirm({ title: 'Khôi phục dữ liệu mẫu', message: 'Mọi thay đổi trong prototype trên trình duyệt này sẽ bị xóa.', okLabel: 'Khôi phục', danger: true })) {
          App.resetData(); App.save(); toast('Đã khôi phục dữ liệu mẫu', 'success'); App.render();
        }
      });
    },
  });

  void bindGrid; void $$;
})();
