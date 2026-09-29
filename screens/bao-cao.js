/* screens: bao-cao — Báo cáo thu (Ban giám hiệu: xem; Kế toán: đầy đủ). Read-only screen.
   Every number is derived from App.calc (studentStatus / studentDue) and App.data.payments so it matches Đợt thu / Thu tiền / Phiếu thu. */
(function () {
  'use strict';
  const { route, frame } = App;
  const { esc, money, icon, btn, field, grid, toast, badge, norm, $ } = UI;

  const D = () => App.data;
  const C = () => App.calc;
  const yearRounds = () => (D().rounds || []).filter((r) => r.yearId === D().currentYearId);
  const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
  const pctTxt = (a, b) => (b ? String(pct(a, b)).replace('.', ',') + '%' : '—');
  const sortKey = (dmy) => { const m = String(dmy || '').match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? m[3] + m[2] + m[1] : ''; };
  const PH_ST = (status) => C().STATUS_LABEL[status] || ['', ''];

  function defaultRound() {
    const rs = yearRounds(); if (!rs.length) return '';
    if (rs.some((r) => r.id === 'r2')) return 'r2';
    const active = rs.filter((r) => r.status === 'dang-thu');
    return (active[active.length - 1] || rs[0]).id;
  }

  // Build the full dataset for the filters. roundId '' = every round of the current year.
  function compute(roundId, gradeId) {
    const rounds = roundId ? yearRounds().filter((r) => r.id === roundId) : yearRounds();
    const rids = new Set(rounds.map((r) => r.id));
    const gradeOk = (st) => { const c = C().classOf(st); return !!c && (!gradeId || c.gradeId === gradeId); };
    const per = new Map(); // studentId → {st, cls, due, paid, remaining}
    const feeAgg = new Map(); // feeId → {due, paid, students:Set}
    rounds.forEach((r) => {
      C().roundStudents(r.id).filter(gradeOk).forEach((st) => {
        const s = C().studentStatus(st.id, r.id);
        let x = per.get(st.id);
        if (!x) { x = { id: st.id, st, cls: C().classOf(st), due: 0, paid: 0, remaining: 0 }; per.set(st.id, x); }
        x.due += s.due; x.paid += s.paid; x.remaining += s.remaining;
        C().studentDue(st.id, r.id).lines.forEach((l) => {
          const f = feeAgg.get(l.feeId) || { due: 0, paid: 0, students: new Set() };
          f.due += l.amount; f.students.add(st.id); feeAgg.set(l.feeId, f);
        });
      });
    });
    per.forEach((x) => { x.status = x.due === 0 ? 'khong-thu' : x.paid === 0 ? 'chua-thu' : x.remaining > 0 ? 'mot-phan' : 'da-thu'; });
    const pays = (D().payments || []).filter((p) => rids.has(p.roundId) && per.has(p.studentId));
    const valid = pays.filter((p) => p.status !== 'da-huy');
    valid.forEach((p) => (p.lines || []).forEach((l) => {
      const f = feeAgg.get(l.feeId) || { due: 0, paid: 0, students: new Set() };
      f.paid += l.amount; feeAgg.set(l.feeId, f);
    }));
    const studs = Array.from(per.values());
    const tot = studs.reduce((t, x) => ({ due: t.due + x.due, paid: t.paid + x.paid, remaining: t.remaining + x.remaining }), { due: 0, paid: 0, remaining: 0 });
    const counts = { 'chua-thu': 0, 'mot-phan': 0, 'da-thu': 0, 'khong-thu': 0 };
    studs.forEach((x) => counts[x.status]++);
    return { rounds, studs, tot, counts, pays, valid, cancelled: pays.length - valid.length, feeAgg };
  }

  const bar = (a, b) => { const p = Math.min(100, pct(a, b)); return '<div class="bc-prog"><span class="bc-prog-bar" aria-hidden="true"><i style="width:' + p + '%"></i></span><span class="bc-prog-v">' + pctTxt(a, b) + '</span></div>'; };

  function tabClasses(R, gradeId) {
    const grades = (D().grades || []).filter((g) => !gradeId || g.id === gradeId);
    const byClass = new Map();
    R.studs.forEach((x) => { if (!x.cls) return; const a = byClass.get(x.cls.id) || { n: 0, due: 0, paid: 0, remaining: 0 }; a.n++; a.due += x.due; a.paid += x.paid; a.remaining += x.remaining; byClass.set(x.cls.id, a); });
    const row = (cls, label, a) => '<tr class="' + cls + '"><td>' + label + '</td><td class="num">' + a.n + '</td><td class="num">' + money(a.due) + '</td><td class="num">' + money(a.paid) + '</td><td class="num">' + money(a.remaining) + '</td><td>' + bar(a.paid, a.due) + '</td></tr>';
    let body = '';
    grades.forEach((g) => {
      const classes = (D().classes || []).filter((c) => c.gradeId === g.id && c.yearId === D().currentYearId && byClass.has(c.id));
      if (!classes.length) return;
      const ga = classes.reduce((t, c) => { const a = byClass.get(c.id); return { n: t.n + a.n, due: t.due + a.due, paid: t.paid + a.paid, remaining: t.remaining + a.remaining }; }, { n: 0, due: 0, paid: 0, remaining: 0 });
      body += row('bc-grade', '<b>' + esc(g.name) + '</b> <span class="muted">· ' + classes.length + ' lớp</span>', ga);
      classes.forEach((c) => { body += row('bc-class', 'Lớp ' + esc(c.name) + '<span class="sub">GVCN ' + esc(c.teacher || '') + '</span>', byClass.get(c.id)); });
    });
    return '<div class="ui-grid-wrap bc-table"><table class="ui-grid"><thead><tr><th>Khối / Lớp</th><th class="num">Sĩ số</th><th class="num">Phải thu (đ)</th><th class="num">Đã thu (đ)</th><th class="num">Còn phải thu (đ)</th><th style="width:200px">% hoàn thành</th></tr></thead><tbody>' +
      (body || '<tr><td colspan="6" class="ui-grid-empty">Không có dữ liệu</td></tr>') + '</tbody>' +
      '<tfoot><tr><td>Tổng cộng</td><td class="num">' + R.studs.length + '</td><td class="num">' + money(R.tot.due) + '</td><td class="num">' + money(R.tot.paid) + '</td><td class="num">' + money(R.tot.remaining) + '</td><td>' + bar(R.tot.paid, R.tot.due) + '</td></tr></tfoot></table></div>' +
      '<div class="grid-foot"><span>Sĩ số = số học sinh thuộc phạm vi đợt thu. Phải thu = Đã thu + Còn phải thu.</span></div>';
  }

  function tabFees(R) {
    const rows = (D().feeItems || []).filter((f) => R.feeAgg.has(f.id)).map((f) => { const a = R.feeAgg.get(f.id); return { id: f.id, f, a, remaining: Math.max(0, a.due - a.paid) }; });
    const t = rows.reduce((s, r) => ({ due: s.due + r.a.due, paid: s.paid + r.a.paid, remaining: s.remaining + r.remaining }), { due: 0, paid: 0, remaining: 0 });
    return grid({
      id: 'bcFees', rows, striped: false, empty: 'Không có khoản thu trong phạm vi đã chọn.',
      columns: [
        { key: 'code', label: 'Mã', width: '90px', render: (r) => '<code class="bc-code">' + esc(r.f.code) + '</code>' },
        { key: 'name', label: 'Khoản thu', render: (r) => esc(r.f.name) + '<span class="sub">' + esc(r.f.group) + (r.f.mandatory ? ' · Bắt buộc' : ' · Tự nguyện') + '</span>' },
        { key: 'n', label: 'Số HS', align: 'right', render: (r) => r.a.students.size },
        { key: 'due', label: 'Phải thu (đ)', align: 'right', render: (r) => money(r.a.due) },
        { key: 'paid', label: 'Đã thu (đ)', align: 'right', render: (r) => money(r.a.paid) },
        { key: 'rem', label: 'Còn phải thu (đ)', align: 'right', render: (r) => money(r.remaining) },
        { key: 'pct', label: '% hoàn thành', width: '200px', render: (r) => bar(r.a.paid, r.a.due) },
      ],
      foot: '<tr><td></td><td>Tổng cộng</td><td></td><td class="num">' + money(t.due) + '</td><td class="num">' + money(t.paid) + '</td><td class="num">' + money(t.remaining) + '</td><td>' + bar(t.paid, t.due) + '</td></tr>',
    }) + '<div class="grid-foot"><span>Đã thu theo khoản được cộng từ các dòng khoản thu trên phiếu thu (không tính phiếu đã hủy).</span></div>';
  }

  function tabDebt(R, st) {
    const q = norm(st.q.trim());
    const rows = R.studs.filter((x) => x.remaining > 0)
      .filter((x) => !q || norm(x.st.name + ' ' + x.st.code + ' ' + (x.cls ? x.cls.name : '') + ' ' + ((x.st.parent || {}).name || '')).includes(q))
      .sort((a, b) => (st.sort === 'name' ? a.st.name.localeCompare(b.st.name, 'vi') : st.sort === 'class' ? (a.cls ? a.cls.name : '').localeCompare(b.cls ? b.cls.name : '') || a.st.name.localeCompare(b.st.name, 'vi') : b.remaining - a.remaining));
    const sum = rows.reduce((s, x) => s + x.remaining, 0);
    return '<div class="toolbar"><div class="bc-search">' + UI.search({ id: 'bcQ', value: st.q, placeholder: 'Tìm theo tên, mã học sinh, lớp, phụ huynh…' }) + '</div>' +
      '<div class="bc-sort">' + field({ id: 'bcSort', type: 'select', value: st.sort, options: [{ value: 'debt', label: 'Còn nợ: nhiều → ít' }, { value: 'class', label: 'Theo lớp' }, { value: 'name', label: 'Theo tên' }], attrs: { 'aria-label': 'Sắp xếp' } }) + '</div></div>' +
      grid({
        id: 'bcDebt', rows, striped: false, maxHeight: '520px', empty: 'Không có học sinh còn nợ.',
        columns: [
          { key: 'i', label: '#', width: '44px', align: 'right', render: (r, i) => i + 1 },
          { key: 'name', label: 'Học sinh', render: (r) => esc(r.st.name) + '<span class="sub">' + esc((r.st.parent || {}).name || '') + (r.st.parent && r.st.parent.phone ? ' · ' + esc(r.st.parent.phone) : '') + '</span>' },
          { key: 'code', label: 'Mã HS', render: (r) => esc(r.st.code) },
          { key: 'cls', label: 'Lớp', render: (r) => esc(r.cls ? r.cls.name : '—') },
          { key: 'due', label: 'Phải thu (đ)', align: 'right', render: (r) => money(r.due) },
          { key: 'paid', label: 'Đã thu (đ)', align: 'right', render: (r) => money(r.paid) },
          { key: 'rem', label: 'Còn nợ (đ)', align: 'right', cls: 'bc-debt', render: (r) => money(r.remaining) },
          { key: 'st', label: 'Trạng thái', render: (r) => { const [l, t] = PH_ST(r.status); return badge(l, t || 'danger'); } },
        ],
        foot: '<tr><td></td><td colspan="5">' + rows.length + ' học sinh còn nợ</td><td class="num">' + money(sum) + '</td><td></td></tr>',
      });
  }

  function tabDays(R) {
    const days = new Map();
    R.valid.forEach((p) => {
      const d = days.get(p.date) || { date: p.date, n: 0, cash: 0, bank: 0 };
      d.n++; if (p.method === 'chuyen-khoan') d.bank += p.amount; else d.cash += p.amount; days.set(p.date, d);
    });
    const rows = Array.from(days.values()).sort((a, b) => (sortKey(a.date) < sortKey(b.date) ? -1 : 1)).map((d) => Object.assign({ id: d.date, total: d.cash + d.bank }, d));
    const max = Math.max(1, ...rows.map((r) => r.total));
    // nice axis max
    const step = Math.pow(10, Math.floor(Math.log10(max))); const top = Math.ceil(max / step) * step;
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * top);
    const mTxt = (v) => (v >= 1e6 ? String(Math.round(v / 1e5) / 10).replace('.', ',') + ' tr' : money(v));
    const t = rows.reduce((s, r) => ({ n: s.n + r.n, cash: s.cash + r.cash, bank: s.bank + r.bank }), { n: 0, cash: 0, bank: 0 });
    const chart = rows.length ? '<figure class="card bc-chart"><figcaption><b>Số tiền thu theo ngày</b><span class="bc-legend"><span><i class="bc-sw cash"></i>Tiền mặt</span><span><i class="bc-sw bank"></i>Chuyển khoản</span></span></figcaption>' +
      '<div class="bc-plot"><div class="bc-yaxis">' + ticks.slice().reverse().map((v) => '<span>' + mTxt(v) + '</span>').join('') + '</div>' +
      '<div class="bc-area"><div class="bc-gridlines">' + ticks.map(() => '<i></i>').join('') + '</div><div class="bc-bars">' +
      rows.map((r) => '<div class="bc-col" tabindex="0" aria-label="' + esc(r.date + ': ' + r.n + ' phiếu, tiền mặt ' + money(r.cash) + ' đ, chuyển khoản ' + money(r.bank) + ' đ') + '">' +
        '<div class="bc-stack" style="height:' + (r.total / top * 100).toFixed(2) + '%">' + (r.bank ? '<i class="bank" style="flex:' + r.bank + '"></i>' : '') + (r.cash ? '<i class="cash" style="flex:' + r.cash + '"></i>' : '') + '</div>' +
        '<div class="bc-tip"><b>' + esc(r.date) + '</b><span>' + r.n + ' phiếu</span><span><i class="bc-sw cash"></i>Tiền mặt ' + money(r.cash) + ' đ</span><span><i class="bc-sw bank"></i>Chuyển khoản ' + money(r.bank) + ' đ</span><span>Tổng <b>' + money(r.total) + ' đ</b></span></div>' +
        '<span class="bc-x">' + esc(r.date.slice(0, 5)) + '</span></div>').join('') +
      '</div></div></div></figure>' : '';
    return chart + grid({
      id: 'bcDays', rows: rows.slice().reverse(), striped: false, empty: 'Chưa có phiếu thu trong phạm vi đã chọn.',
      columns: [
        { key: 'date', label: 'Ngày thu', render: (r) => esc(r.date) },
        { key: 'n', label: 'Số phiếu', align: 'right', render: (r) => r.n },
        { key: 'cash', label: 'Tiền mặt (đ)', align: 'right', render: (r) => money(r.cash) },
        { key: 'bank', label: 'Chuyển khoản (đ)', align: 'right', render: (r) => money(r.bank) },
        { key: 'total', label: 'Tổng (đ)', align: 'right', render: (r) => '<b>' + money(r.total) + '</b>' },
      ],
      foot: '<tr><td>Tổng cộng</td><td class="num">' + t.n + '</td><td class="num">' + money(t.cash) + '</td><td class="num">' + money(t.bank) + '</td><td class="num">' + money(t.cash + t.bank) + '</td></tr>',
    }) + '<div class="grid-foot"><span>Chỉ tính phiếu thu đã ghi nhận' + (R.cancelled ? ' · ' + R.cancelled + ' phiếu đã hủy không được tính' : '') + '. Tổng theo ngày = Đã thu.</span></div>';
  }

  const TABS = [['lop', 'Theo khối/lớp'], ['khoan', 'Theo khoản thu'], ['no', 'Học sinh còn nợ'], ['ngay', 'Theo ngày']];

  frame('BC', 'Báo cáo thu', '/bao-cao', 'Báo cáo');
  route('/bao-cao', {
    title: 'Báo cáo thu', menu: 'bao-cao',
    render({ el, query, readOnly }) {
      el.classList.add('bc-view');
      const rs = yearRounds();
      if (!rs.length) {
        el.innerHTML = '<h1 class="view-title dark">Báo cáo thu</h1><div class="note">Năm học ' + esc((App.currentYear() || {}).name || '') + ' chưa có đợt thu nào nên chưa có số liệu báo cáo.</div>';
        return;
      }
      const st = {
        round: query.round === 'all' ? '' : query.round && rs.some((r) => r.id === query.round) ? query.round : defaultRound(),
        grade: query.grade || '', tab: TABS.some((t) => t[0] === query.tab) ? query.tab : 'lop', q: '', sort: 'debt',
      };
      const draw = () => {
        const R = compute(st.round, st.grade);
        const c = R.counts;
        const roundName = st.round ? (rs.find((r) => r.id === st.round) || {}).name : 'Tất cả đợt thu năm học ' + ((App.currentYear() || {}).name || '');
        el.innerHTML =
          '<div class="view-head"><h1 class="view-title dark">Báo cáo thu</h1>' + (readOnly ? '<span class="ro-banner">' + icon('eye') + ' Chỉ xem</span>' : '') + '<span class="grow"></span>' +
          btn({ label: 'Xuất Excel', icon: 'download', action: 'export' }) + '</div>' +
          '<div class="bc-filters">' +
          field({ label: 'Đợt thu', id: 'bcRound', type: 'select', value: st.round, options: [{ value: '', label: 'Tất cả đợt trong năm' }].concat(rs.map((r) => ({ value: r.id, label: r.name }))) }) +
          field({ label: 'Khối', id: 'bcGrade', type: 'select', value: st.grade, options: [{ value: '', label: 'Tất cả khối' }].concat((D().grades || []).map((g) => ({ value: g.id, label: g.name }))) }) +
          '<div class="bc-scope muted">' + icon('info-circle') + ' ' + esc(roundName) + (st.grade ? ' · ' + esc(((D().grades || []).find((g) => g.id === st.grade) || {}).name || '') : '') + ' · số liệu đến ' + esc('29/09/2025') + '</div></div>' +
          '<div class="stats bc-kpi">' +
          UI.stat({ label: 'Tổng phải thu (đ)', value: money(R.tot.due) }) +
          UI.stat({ label: 'Đã thu (đ)', tone: 'success', html: esc(money(R.tot.paid)) + '<span class="bc-pct">' + pctTxt(R.tot.paid, R.tot.due) + '</span>' }) +
          UI.stat({ label: 'Còn phải thu (đ)', value: money(R.tot.remaining), tone: 'warning' }) +
          UI.stat({ label: 'Học sinh', html: '<span class="bc-counts"><span><b>' + c['chua-thu'] + '</b> chưa thu</span><span><b>' + c['mot-phan'] + '</b> thu một phần</span><span><b>' + c['da-thu'] + '</b> đã thu đủ</span></span>' }) +
          UI.stat({ label: 'Phiếu thu', html: '<span class="bc-counts"><span><b>' + R.valid.length + '</b> đã ghi nhận</span><span><b>' + R.cancelled + '</b> đã hủy</span></span>' }) +
          '</div>' +
          '<nav class="tabs" role="tablist">' + TABS.map(([id, label]) => '<button type="button" role="tab" class="tab' + (id === st.tab ? ' active' : '') + '" aria-selected="' + (id === st.tab) + '" data-tab="' + id + '">' + esc(label) + (id === 'no' ? ' <span class="bc-tabn">' + (c['chua-thu'] + c['mot-phan']) + '</span>' : '') + '</button>').join('') + '</nav>' +
          '<div id="bcBody" class="stack">' + (st.tab === 'lop' ? tabClasses(R, st.grade) : st.tab === 'khoan' ? tabFees(R) : st.tab === 'no' ? tabDebt(R, st) : tabDays(R)) + '</div>';
        const qi = $('#bcQ', el);
        if (qi) qi.addEventListener('input', () => { st.q = qi.value; const pos = qi.selectionStart; draw(); const n = $('#bcQ', el); n.focus(); n.setSelectionRange(pos, pos); });
      };
      el.addEventListener('change', (e) => {
        if (e.target.id === 'bcRound') { st.round = e.target.value; draw(); }
        if (e.target.id === 'bcGrade') { st.grade = e.target.value; draw(); }
        if (e.target.id === 'bcSort') { st.sort = e.target.value; draw(); }
      });
      el.addEventListener('click', (e) => {
        const t = e.target.closest('[data-tab]'); if (t) { st.tab = t.dataset.tab; draw(); return; }
        const a = e.target.closest('[data-action="export"]');
        if (a) toast('Đã xuất báo cáo “' + (TABS.find((x) => x[0] === st.tab) || [])[1] + '” ra Excel (mô phỏng)', 'success');
      });
      draw();
    },
  });
})();
