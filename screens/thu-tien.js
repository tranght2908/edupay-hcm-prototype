/* screens: thu-tien — group E: Thu tiền (12.1, 12.2), Đối soát chuyển khoản (12.3), Phiếu thu (13.1, 13.2). */
(function () {
  'use strict';
  const { route, frame } = App;
  const { esc, money, icon, btn, field, grid, bindGrid, dialog, menu, toast, norm, $, $$, badge, parseMoney, toISO, fromISO } = UI;
  const G = 'Thu tiền & phiếu thu';
  const TODAY = '29/09/2025'; // "today" inside the 2025-2026 sample data
  const COLLECTOR = 'Lê Thị Thu';
  const METHOD = { 'tien-mat': 'Tiền mặt', 'chuyen-khoan': 'Chuyển khoản' };
  const calc = () => App.calc;

  // ---------- data helpers ----------
  const D = () => App.data;
  const student = (id) => (D().students || []).find((s) => s.id === id);
  const getRound = (id) => (D().rounds || []).find((r) => r.id === id);
  const yearRounds = () => (D().rounds || []).filter((r) => r.yearId === D().currentYearId);
  const className = (st) => ((st && calc().classOf(st)) || {}).name || '—';
  const feeName = (id) => (calc().fee(id) || {}).name || id;
  function defaultRound() {
    const rs = yearRounds(); if (!rs.length) return '';
    const active = rs.filter((r) => r.status === 'dang-thu');
    return (active.length ? active[active.length - 1] : rs[0]).id;
  }
  const pickRound = (q) => (q && getRound(q) && getRound(q).yearId === D().currentYearId ? q : defaultRound());
  const payNo = (p) => Number(String(p.receiptNo).replace(/\D/g, '')) || 0;
  const byNo = (a, b) => payNo(a) - payNo(b);
  const roundPayments = (stId, roundId, withCancelled) => (D().payments || []).filter((p) => p.studentId === stId && p.roundId === roundId && (withCancelled || p.status !== 'da-huy')).sort(byNo);
  function nextReceiptNo() { const m = (D().payments || []).reduce((x, p) => Math.max(x, payNo(p)), 0); return 'PT' + String(m + 1).padStart(5, '0'); }
  const pad = (n) => String(n).padStart(2, '0');
  const nowTime = () => { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const shortDT = (p) => (p ? p.date.slice(0, 5) + ' ' + p.time : '');
  const transferCode = (st, round) => 'HP-' + st.code + '-T' + (round && round.month ? round.month.slice(5) : '');
  // Remaining per fee line for a student in a round (due line − already paid on that fee).
  function feeRemaining(stId, roundId, beforeNo) {
    const paidBy = {};
    roundPayments(stId, roundId).filter((p) => beforeNo == null || payNo(p) < beforeNo).forEach((p) => p.lines.forEach((l) => (paidBy[l.feeId] = (paidBy[l.feeId] || 0) + l.amount)));
    return calc().studentDue(stId, roundId).lines.map((l) => ({ feeId: l.feeId, name: l.name, due: l.amount, paid: paidBy[l.feeId] || 0, remaining: Math.max(0, l.amount - (paidBy[l.feeId] || 0)) }));
  }
  function allocate(stId, roundId, amount) {
    let left = amount; const lines = [];
    feeRemaining(stId, roundId).forEach((f) => { const a = Math.min(f.remaining, left); if (a > 0) { lines.push({ feeId: f.feeId, amount: a }); left -= a; } });
    return lines;
  }
  function createPayment(o) {
    const n = nextReceiptNo();
    const p = { id: 'p' + Number(n.slice(2)), receiptNo: n, studentId: o.studentId, roundId: o.roundId, lines: o.lines, amount: o.lines.reduce((t, l) => t + l.amount, 0),
      method: o.method, date: o.date || TODAY, time: o.time || nowTime(), payer: o.payer || '', collector: o.collector || (App.user() || {}).name || COLLECTOR, note: o.note || '', status: 'da-ghi-nhan', bankRef: o.bankRef || '' };
    if (o.transferId) p.transferId = o.transferId;
    while ((D().payments || []).some((x) => x.id === p.id)) p.id += 'x';
    D().payments.push(p);
    return p;
  }
  const fakeRef = () => 'FT2527' + String(Math.floor(Math.random() * 1e7)).padStart(7, '0');

  // ---------- number → Vietnamese words ----------
  const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  function words3(n, full) {
    const h = Math.floor(n / 100), t = Math.floor((n % 100) / 10), u = n % 10; const out = [];
    if (full || h) out.push(DIGITS[h] + ' trăm');
    if (t > 1) out.push(DIGITS[t] + ' mươi'); else if (t === 1) out.push('mười'); else if (u && (full || h)) out.push('lẻ');
    if (u) out.push(u === 1 && t > 1 ? 'mốt' : u === 5 && t > 0 ? 'lăm' : u === 4 && t > 1 ? 'tư' : DIGITS[u]);
    return out.join(' ');
  }
  function vnWords(num) {
    num = Math.round(num); if (!num) return 'Không đồng';
    const units = ['', ' nghìn', ' triệu', ' tỷ']; const parts = []; let i = 0; const groups = [];
    while (num > 0) { groups.push(num % 1000); num = Math.floor(num / 1000); }
    for (i = groups.length - 1; i >= 0; i--) if (groups[i]) parts.push(words3(groups[i], i < groups.length - 1) + units[i % 4]);
    const s = parts.join(' ') + ' đồng'; return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // ---------- deterministic fake QR (inline SVG) ----------
  function qrSvg(text, px) {
    const n = 25; let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    const rnd = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296;
    const finder = (x, y) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
    let r = '';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { if (finder(x, y)) continue; if (rnd() < 0.47) r += 'M' + x + ' ' + y + 'h1v1h-1z'; }
    const eye = (x, y) => 'M' + x + ' ' + y + 'h7v7h-7zM' + (x + 1) + ' ' + (y + 1) + 'v5h5v-5zM' + (x + 2) + ' ' + (y + 2) + 'h3v3h-3z';
    return '<svg class="tt-qr" viewBox="-2 -2 ' + (n + 4) + ' ' + (n + 4) + '" width="' + px + '" height="' + px + '" role="img" aria-label="Mã QR"><rect x="-2" y="-2" width="' + (n + 4) + '" height="' + (n + 4) + '" class="tt-qr-bg"/><path fill-rule="evenodd" d="' + eye(0, 0) + eye(n - 7, 0) + eye(0, n - 7) + r + '"/></svg>';
  }

  // ---------- shared pieces ----------
  function flowTabs(active, roundId) {
    const tabs = [['dot-thu', 'Đợt thu', '/dot-thu'], ['thong-bao', 'Thông báo thu tiền', '/thong-bao/' + roundId], ['thu-tien', 'Thu tiền', '/thu-tien?round=' + roundId], ['phieu-thu', 'Phiếu thu', '/phieu-thu?round=' + roundId]];
    return '<nav class="tabs tt-flow" aria-label="Quy trình thu tiền">' + tabs.map(([id, label, href]) => '<a class="tab' + (id === active ? ' active' : '') + '" href="#' + href + '"' + (id === active ? ' aria-current="page"' : '') + '>' + esc(label) + '</a>').join('') + '</nav>';
  }
  const statCard = (label, value, tone) => '<div class="stat tt-stat ' + (tone || '') + '"><div class="k">' + esc(label.toUpperCase().replace('(Đ)', '(đ)')) + '</div><div class="v">' + esc(value) + '</div></div>';
  const roundOptions = (all) => (all ? [{ value: '', label: 'Tất cả đợt thu' }] : []).concat(yearRounds().map((r) => ({ value: r.id, label: r.name })));
  function scopeOptions() {
    const cls = (D().classes || []).filter((c) => c.yearId === D().currentYearId);
    return [{ value: 'all', label: 'Toàn trường' }].concat((D().grades || []).filter((g) => cls.some((c) => c.gradeId === g.id)).map((g) => ({ value: 'grade:' + g.id, label: g.name })))
      .concat(cls.map((c) => ({ value: 'class:' + c.id, label: 'Lớp ' + c.name })));
  }
  function inScopeFilter(st, scope) {
    if (!scope || scope === 'all') return true;
    const c = calc().classOf(st); if (!c) return false;
    const [k, id] = scope.split(':'); return k === 'grade' ? c.gradeId === id : c.id === id;
  }
  const statusText = (s) => { const [l, tone] = calc().STATUS_LABEL[s] || [s, '']; return '<span class="tt-st ' + tone + '"><i></i>' + esc(l) + '</span>'; };
  const emptyYear = (el, title) => { el.innerHTML = '<h1 class="view-title dark">' + esc(title) + '</h1><div class="note">Năm học đang chọn chưa có đợt thu nào. Hãy lập đợt thu trước khi thu tiền.</div>'; };
  // Keep an URL in sync without re-rendering (e.g. after closing the 12.2 dialog)
  const replaceHash = (h) => { try { history.replaceState(null, '', '#' + h); } catch (e) { /* ignore */ } };

  // ======================================================================
  // 12.2 — Ghi nhận thu tiền (partial collection dialog)
  // ======================================================================
  // Role checks (Tài liệu thuyết minh §4): only Thủ quỹ / Người thu records or cancels payments.
  const canCollect = () => App.can('thu-tien', 'full');
  const canVoid = () => App.can('phieu-thu', 'full');
  const roToast = () => toast('Vai trò ' + ((App.role() || {}).name || '') + ' chỉ được xem, không ghi nhận hoặc hủy thu.', 'danger');
  function openCollect(stId, roundId, onDone, onClose, prefill) {
    if (!canCollect()) { roToast(); return null; }
    const st = student(stId); const round = getRound(roundId);
    if (!st || !round) { toast('Không tìm thấy học sinh trong đợt thu', 'danger'); return; }
    const s = calc().studentStatus(stId, roundId);
    const fees = feeRemaining(stId, roundId);
    const hist = roundPayments(stId, roundId);
    const last = hist[hist.length - 1];
    const code = transferCode(st, round);
    const pre = {}; if (prefill > 0) { let left = prefill; fees.forEach((f) => { const a = Math.min(f.remaining, left); pre[f.feeId] = a; left -= a; }); }
    const initVal = (f) => money(prefill > 0 ? pre[f.feeId] || 0 : f.remaining) || '0';
    let method = 'tien-mat'; let done = false;
    const body =
      '<div class="tt-cl">' +
      '<div><div class="tt-cl-name">' + esc(st.name) + ' ' + statusText(s.status) + '</div>' +
      '<div class="muted tt-cl-meta">' + esc(st.code) + ' · Lớp ' + esc(className(st)) + ' · ' + esc(round.name) + (st.parent && st.parent.name ? ' · PH: ' + esc(st.parent.name) + (st.parent.phone ? ' · ' + esc(st.parent.phone) : '') : '') + '</div></div>' +
      '<div class="tt-cl-metrics">' +
      '<div class="tt-box"><div class="k">Còn phải thu (đ)</div><div class="v accent">' + money(s.remaining) + '</div></div>' +
      '<div class="tt-box"><div class="k">Đã thu trước (đ)</div><div class="v">' + money(s.paid) + '</div></div>' +
      '<div class="tt-box"><div class="k">Lịch sử thu</div><div class="h">' + (hist.length ? hist.length + ' lần · gần nhất ' + esc(shortDT(last)) + '<br><span class="muted">' + hist.map((p) => esc(p.receiptNo)).join(', ') + '</span>' : '<span class="muted">Chưa có lần thu nào</span>') + '</div></div>' +
      '</div>' +
      '<div class="tt-sec"><span>Phân bổ số tiền thu</span><span class="grow"></span>' + btn({ label: 'Điền đủ tất cả', variant: 'tertiary', cls: 'sm', action: 'fill' }) + btn({ label: 'Xóa hết', variant: 'tertiary', cls: 'sm', action: 'clear' }) + '</div>' +
      '<div class="ui-grid-wrap tt-alloc"><table class="ui-grid"><thead><tr><th>Khoản thu</th><th class="num">Phải thu</th><th class="num">Còn phải thu</th><th class="num" style="width:190px">Thu lần này</th></tr></thead><tbody>' +
      (fees.length ? fees.map((f) => '<tr><td>' + esc(f.name) + '</td><td class="num">' + money(f.due) + '</td><td class="num">' + money(f.remaining) + '</td><td class="num"><input class="ctl num" inputmode="numeric" data-money data-fee="' + esc(f.feeId) + '" data-max="' + f.remaining + '" aria-label="Thu lần này — ' + esc(f.name) + '" value="' + initVal(f) + '"' + (f.remaining ? '' : ' disabled') + '></td></tr>').join('')
        : '<tr><td colspan="4" class="ui-grid-empty">Học sinh không có khoản phải thu trong đợt này.</td></tr>') +
      '</tbody></table></div>' +
      '<div class="tt-cl-bottom"><div><div class="tt-sec"><span>Hình thức thu</span></div><div class="radio-row" role="radiogroup">' +
      '<label><input type="radio" name="ttMethod" value="tien-mat" checked> Tiền mặt</label><label><input type="radio" name="ttMethod" value="chuyen-khoan"> Chuyển khoản (QR)</label></div></div>' +
      '<div class="tt-total"><div class="k">Tổng thu lần này (đ)</div><div class="v" id="ttTotal">0</div></div></div>' +
      '<div class="tt-payinfo">' +
      '<div class="tt-qrpane" id="ttQr" hidden>' + '<div class="tt-qrbox" id="ttQrImg"></div><div class="tt-qrinfo">' +
      '<div class="tt-qr-bank">' + icon('institution') + ' VietQR · ' + esc(D().school.bank || 'BIDV') + ' · ' + esc(D().school.account || '') + '<br><span class="muted">' + esc(D().school.name) + '</span></div>' +
      '<dl><dt>Số tiền</dt><dd id="ttQrAmt">0 đ</dd><dt>Nội dung chuyển khoản</dt><dd><code>' + esc(code) + '</code></dd></dl>' +
      '<div class="tt-wait">' + icon('hourglass') + '<div><b>Đang chờ ngân hàng xác nhận…</b><br><span>Phụ huynh quét mã để chuyển khoản. Khi tiền về, bấm “Xác nhận đã nhận tiền” để tạo phiếu thu (mô phỏng webhook ngân hàng).</span></div></div>' +
      '</div></div>' +
      '<div class="form-grid" style="--cols:3">' +
      field({ label: 'Người nộp tiền', id: 'ttPayer', value: (st.parent && st.parent.name) || '', required: true }) +
      field({ label: 'Ngày thu', id: 'ttDate', type: 'date', value: TODAY, required: true }) +
      field({ label: 'Người thu', id: 'ttCollector', type: 'readonly', value: (App.user() || {}).name || COLLECTOR }) +
      field({ label: 'Ghi chú', id: 'ttNote', placeholder: 'Ví dụ: phụ huynh nộp trước một phần', cls: 'span-all' }) +
      '</div></div></div>';
    const dlg = dialog({
      title: 'Ghi nhận thu tiền', width: '880px', large: true, body,
      footer: '<span class="tt-foot-warn grow" id="ttWarn"></span>' + btn({ label: 'Hủy', action: 'close' }) + btn({ label: 'Xác nhận thu', icon: 'check', variant: 'primary', action: 'ok', id: 'ttOk' }),
      onClose: () => { if (onClose) onClose(done); },
      onMount(d, close) {
        const inputs = $$('input[data-fee]', d);
        const okBtn = $('#ttOk', d); const warn = $('#ttWarn', d);
        const sync = () => {
          let total = 0, bad = false;
          inputs.forEach((i) => { const v = parseMoney(i.value); const over = v > Number(i.dataset.max); i.closest('td').classList.toggle('tt-bad', over); bad = bad || over; total += v; });
          $('#ttTotal', d).textContent = money(total); $('#ttQrAmt', d).textContent = money(total) + ' đ';
          if (method === 'chuyen-khoan') $('#ttQrImg', d).innerHTML = qrSvg(code + '|' + total, 148);
          okBtn.disabled = bad || total <= 0;
          const rest = s.remaining - total;
          warn.className = 'tt-foot-warn grow' + (bad ? ' danger' : rest > 0 && total > 0 ? ' warning' : '');
          warn.innerHTML = bad ? icon('warning') + ' Số tiền thu vượt quá số còn phải thu của khoản.' : total <= 0 ? '' : rest > 0 ? icon('info-circle') + ' Thu một phần — còn lại ' + money(rest) + ' đ, có thể thu tiếp ở lần sau.' : icon('check-circle') + ' Thu đủ toàn bộ số còn phải thu.';
        };
        d.addEventListener('input', (e) => { if (e.target.matches('input[data-fee]')) sync(); });
        d.addEventListener('change', (e) => {
          if (e.target.name !== 'ttMethod') return;
          method = e.target.value; $('#ttQr', d).hidden = method !== 'chuyen-khoan';
          $('span', okBtn).textContent = method === 'chuyen-khoan' ? 'Xác nhận đã nhận tiền' : 'Xác nhận thu'; sync();
        });
        d.addEventListener('click', (e) => {
          const a = e.target.closest('[data-action]'); if (!a) return;
          if (a.dataset.action === 'fill') { inputs.forEach((i) => (i.value = money(Number(i.dataset.max)))); sync(); }
          if (a.dataset.action === 'clear') { inputs.forEach((i) => (i.value = '0')); sync(); inputs[0] && inputs[0].focus(); }
          if (a.dataset.action === 'ok') {
            if (!UI.validate($('.tt-payinfo', d))) return;
            const lines = inputs.map((i) => ({ feeId: i.dataset.fee, amount: parseMoney(i.value) })).filter((l) => l.amount > 0);
            if (!lines.length) return;
            const p = createPayment({ studentId: stId, roundId, lines, method, payer: $('#ttPayer', d).value.trim(), date: fromISO($('#ttDate', d).value) || TODAY,
              note: $('#ttNote', d).value.trim(), bankRef: method === 'chuyen-khoan' ? fakeRef() : '' });
            App.save(); done = true; close();
            toast('Đã ghi nhận ' + money(p.amount) + ' đ · phiếu thu ' + p.receiptNo, 'success');
            if (onDone) onDone(p);
            successDialog(p);
          }
        });
        sync();
        setTimeout(() => { if (inputs[0]) { inputs[0].focus(); inputs[0].select(); } }, 40);
      },
    });
    return dlg;
  }

  function successDialog(p) {
    const st = student(p.studentId); const s = calc().studentStatus(p.studentId, p.roundId);
    dialog({
      title: 'Đã ghi nhận thu tiền', width: '520px',
      body: '<div class="tt-success">' + icon('check-circle') + '<div class="amt">' + money(p.amount) + ' đ</div>' +
        '<div>Phiếu thu <b>' + esc(p.receiptNo) + '</b> · ' + esc(METHOD[p.method]) + ' · ' + esc(p.date) + ' ' + esc(p.time) + '</div>' +
        '<div class="muted">' + esc(st ? st.name : '') + ' · Lớp ' + esc(className(st)) + '</div>' +
        '<div>' + statusText(s.status) + (s.remaining ? ' <span class="muted">· còn phải thu ' + money(s.remaining) + ' đ</span>' : '') + '</div></div>',
      footer: btn({ label: 'Đóng', action: 'close' }) + btn({ label: 'In phiếu', icon: 'print', action: 'print' }) + btn({ label: 'Xem phiếu thu', icon: 'file-text-o', variant: 'primary', action: 'view' }),
      onMount(d, close) {
        d.addEventListener('click', (e) => {
          const a = e.target.closest('[data-action]'); if (!a) return;
          if (a.dataset.action === 'print') { close(); printPreview(p); }
          if (a.dataset.action === 'view') { close(); App.go('/phieu-thu/' + p.id); }
        });
      },
    });
  }

  function pickStudentDialog(roundId, onPick) {
    const list = calc().roundStudents(roundId).map((st) => ({ st, s: calc().studentStatus(st.id, roundId) })).filter((x) => x.s.remaining > 0);
    dialog({
      title: 'Chọn học sinh cần thu tiền', width: '620px', footer: false,
      body: UI.search({ id: 'ttPickQ', placeholder: 'Tìm theo tên, mã học sinh, lớp…' }) + '<div class="tt-pick" id="ttPickList"></div>',
      onMount(d, close) {
        const draw = () => {
          const q = norm($('#ttPickQ', d).value);
          const rows = list.filter((x) => !q || norm(x.st.name + ' ' + x.st.code + ' ' + className(x.st)).includes(q)).slice(0, 60);
          $('#ttPickList', d).innerHTML = rows.length ? rows.map((x) => '<button type="button" class="tt-pick-item" data-id="' + esc(x.st.id) + '"><span><b>' + esc(x.st.name) + '</b><span class="muted"> · ' + esc(x.st.code) + ' · ' + esc(className(x.st)) + '</span></span><span class="num">' + money(x.s.remaining) + ' đ</span>' + statusText(x.s.status) + '</button>').join('') : '<div class="ui-grid-empty">Không có học sinh nào còn phải thu.</div>';
        };
        $('#ttPickQ', d).addEventListener('input', draw);
        d.addEventListener('click', (e) => { const b = e.target.closest('.tt-pick-item'); if (b) { close(); onPick(b.dataset.id); } });
        draw();
      },
    });
  }

  // ======================================================================
  // 12.1 — Thu tiền / Danh sách phải thu
  // ======================================================================
  frame('12.1', 'Thu tiền / Danh sách phải thu', '/thu-tien?round=r2', G);
  frame('12.2', 'Thu tiền / Ghi nhận thu từng phần', '/thu-tien?round=r2&collect=s3&pay=300000', G);
  route('/thu-tien', {
    title: 'Thu tiền', menu: 'thu-tien',
    render(ctx) {
      const { el, query } = ctx;
      let roundId = pickRound(query.round);
      if (!roundId) return emptyYear(el, 'Thu tiền');
      const f = { scope: query.scope || 'all', status: query.status || '', q: query.q || '' };
      let selected = [];
      el.classList.add('tt-view', 'tt-fit');
      el.innerHTML =
        '<h1 class="view-title dark">Thu tiền</h1><div id="ttTabs"></div><div class="stats tt-stats" id="ttStats"></div>' +
        '<div class="tt-filters">' +
        field({ label: 'Đợt thu', id: 'fRound', type: 'select', options: roundOptions(), value: roundId, cls: 'w-round' }) +
        field({ label: 'Phạm vi', id: 'fScope', type: 'select', options: scopeOptions(), value: f.scope, cls: 'w-scope' }) +
        field({ label: 'Trạng thái thu', id: 'fStatus', type: 'select', options: [{ value: '', label: 'Tất cả' }, { value: 'chua-thu', label: 'Chưa thu' }, { value: 'mot-phan', label: 'Thu một phần' }, { value: 'da-thu', label: 'Đã thu' }], value: f.status, cls: 'w-status' }) +
        '</div>' +
        '<div class="toolbar tt-toolbar"><div class="tt-search">' + UI.search({ id: 'fQ', placeholder: 'Tìm theo tên học sinh, lớp, mã học sinh…', value: f.q }) + '</div><span class="grow"></span>' +
        btn({ label: 'Đối soát ngân hàng', icon: 'exchange', action: 'reconcile', id: 'btnReconcile' }) + btn({ label: 'Thu tiền', icon: 'wallet', variant: 'primary', action: 'collect', id: 'btnCollect', attrs: { 'data-write': '' } }) + '</div>' +
        '<div class="tt-table" id="ttTable"></div>';

      const drawTabs = () => { $('#ttTabs', el).innerHTML = flowTabs('thu-tien', roundId); };
      const drawStats = () => {
        const sm = calc().roundSummary(roundId);
        const pending = (D().bankTransfers || []).filter((t) => t.roundId === roundId && t.status === 'cho-xu-ly').length;
        $('#ttStats', el).innerHTML = statCard('Chưa thu', sm.counts['chua-thu'] + ' học sinh') + statCard('Thu một phần', sm.counts['mot-phan'] + ' học sinh') +
          statCard('Đã thu', sm.counts['da-thu'] + ' học sinh') + statCard('Còn phải thu (đ)', money(sm.remaining), 'accent');
        const b = $('#btnReconcile span', el); if (b) b.textContent = 'Đối soát ngân hàng' + (pending ? ' (' + pending + ')' : '');
      };
      const rowsNow = () => {
        const q = norm(f.q.trim());
        return calc().roundStudents(roundId).filter((st) => inScopeFilter(st, f.scope)).map((st) => {
          const s = calc().studentStatus(st.id, roundId); const ps = roundPayments(st.id, roundId); const last = ps[ps.length - 1];
          return { id: st.id, st, cls: className(st), s, last, count: ps.length };
        }).filter((r) => r.s.status !== 'khong-thu' && (!f.status || r.s.status === f.status) && (!q || norm(r.st.name + ' ' + r.st.code + ' ' + r.cls + ' ' + transferCode(r.st, getRound(roundId))).includes(q)));
      };
      const drawTable = () => {
        const rows = rowsNow(); const total = calc().roundStudents(roundId).length;
        selected = selected.filter((id) => rows.some((r) => r.id === id));
        $('#ttTable', el).innerHTML = grid({
          id: 'ttGrid', selectable: 'multi', selected, rows, fill: true, empty: 'Không có học sinh phù hợp bộ lọc.',
          columns: [
            { key: 'name', label: 'Học sinh', render: (r) => '<button type="button" class="tt-link" data-collect="' + esc(r.id) + '" title="Ghi nhận thu tiền">' + esc(r.st.name) + '</button><span class="sub">' + esc(r.st.code) + '</span>' },
            { key: 'cls', label: 'Lớp', width: '70px' },
            { key: 'due', label: 'Phải thu', align: 'right', render: (r) => money(r.s.due) },
            { key: 'paid', label: 'Đã thu', align: 'right', render: (r) => money(r.s.paid) },
            { key: 'rem', label: 'Còn phải thu', align: 'right', render: (r) => money(r.s.remaining) },
            { key: 'method', label: 'Phương thức', cls: 'tt-dim', render: (r) => (r.last ? esc(METHOD[r.last.method]) + (r.count > 1 ? ' <span class="badge">' + r.count + ' lần</span>' : '') : '—') },
            { key: 'last', label: 'Lần thu gần nhất', cls: 'tt-dim', render: (r) => (r.last ? esc(shortDT(r.last)) : '—') },
            { key: 'status', label: 'Trạng thái thu', render: (r) => statusText(r.s.status) },
          ],
        }) + '<div class="tt-gridfoot"><span id="ttSelInfo">Đã chọn ' + selected.length + ' / ' + total + ' học sinh' + (rows.length !== total ? ' · đang hiển thị ' + rows.length : '') + '</span><span>Có thể ghi nhận nhiều lần thu; mỗi lần xác nhận sinh một phiếu thu riêng.</span></div>';
        bindGrid($('#ttGrid', el), { selectable: 'multi', selected, onSelect: (ids) => { selected = ids; syncSel(); }, onRowDblClick: (k) => collect(k) });
        syncSel();
      };
      const syncSel = () => {
        const info = $('#ttSelInfo', el); if (info) info.firstChild.textContent = 'Đã chọn ' + selected.length + ' / ' + calc().roundStudents(roundId).length + ' học sinh';
        const b = $('#btnCollect span', el); if (b) b.textContent = selected.length > 1 ? 'Thu đủ (' + selected.length + ')' : 'Thu tiền';
      };
      const refresh = () => { drawStats(); drawTable(); };
      const collect = (id) => openCollect(id, roundId, refresh);
      const batchCollect = async () => {
        if (!canCollect()) { roToast(); return; }
        const list = selected.map((id) => ({ id, s: calc().studentStatus(id, roundId) })).filter((x) => x.s.remaining > 0);
        if (!list.length) { toast('Các học sinh đã chọn đều đã thu đủ.'); return; }
        const sum = list.reduce((t, x) => t + x.s.remaining, 0);
        const ok = await UI.confirm({ title: 'Thu đủ cho ' + list.length + ' học sinh', okLabel: 'Xác nhận thu', html: 'Ghi nhận thu <b>' + money(sum) + ' đ</b> bằng <b>tiền mặt</b> cho ' + list.length + ' học sinh đã chọn (thu đủ số còn phải thu).<br><span class="muted">Mỗi học sinh sẽ có một phiếu thu riêng.</span>' });
        if (!ok) return;
        const made = list.map((x) => createPayment({ studentId: x.id, roundId, method: 'tien-mat', lines: allocate(x.id, roundId, x.s.remaining), payer: (student(x.id).parent || {}).name }));
        App.save(); selected = []; refresh();
        toast('Đã tạo ' + made.length + ' phiếu thu (' + made[0].receiptNo + (made.length > 1 ? ' – ' + made[made.length - 1].receiptNo : '') + ')', 'success');
      };

      el.addEventListener('change', (e) => {
        if (e.target.id === 'fRound') { roundId = e.target.value; selected = []; drawTabs(); refresh(); replaceHash('/thu-tien?round=' + roundId); }
        if (e.target.id === 'fScope') { f.scope = e.target.value; drawTable(); }
        if (e.target.id === 'fStatus') { f.status = e.target.value; drawTable(); }
      });
      $('#fQ', el).addEventListener('input', (e) => { f.q = e.target.value; drawTable(); });
      el.addEventListener('click', (e) => {
        const c = e.target.closest('[data-collect]'); if (c) { collect(c.dataset.collect); return; }
        const a = e.target.closest('[data-action]'); if (!a) return;
        if (a.dataset.action === 'reconcile') App.go('/thu-tien/doi-soat?round=' + roundId);
        if (a.dataset.action === 'collect') {
          if (selected.length === 1) collect(selected[0]);
          else if (selected.length > 1) batchCollect();
          else pickStudentDialog(roundId, collect);
        }
      });
      drawTabs(); refresh();
      let dlg = null;
      if (query.collect && student(query.collect)) {
        selected = [query.collect]; drawTable();
        dlg = openCollect(query.collect, roundId, refresh, () => replaceHash('/thu-tien?round=' + roundId), parseMoney(query.pay));
      }
      App.onLeave(() => { if (dlg && dlg.el.isConnected) dlg.el.parentElement.remove(); UI.$$('.dlg-scrim').forEach((x) => x.remove()); });
    },
  });

  // ======================================================================
  // 12.3 — Đối soát chuyển khoản
  // ======================================================================
  const findByCode = (text) => { const m = String(text || '').toUpperCase().match(/HS\d{6}/); return m ? (D().students || []).find((s) => s.code === m[0]) : null; };
  function matchOf(t) {
    if (t.status === 'da-khop') { const p = (D().payments || []).find((x) => x.id === t.paymentId); return { kind: 'done', st: student(t.studentId), p }; }
    if (t.status === 'hoan-tien') return { kind: 'refund', st: t.studentId ? student(t.studentId) : null };
    const st = t.studentId ? student(t.studentId) : findByCode(t.content);
    const round = getRound(t.roundId);
    if (!st || !round || !calc().inScope(st, round)) return { kind: 'none' };
    const s = calc().studentStatus(st.id, t.roundId);
    const kind = s.remaining === 0 || t.amount > s.remaining ? 'over' : t.amount === s.remaining ? 'exact' : 'partial';
    return { kind, st, s, manual: !!t.studentId };
  }
  const RESULT = { exact: ['Khớp đúng', 'success'], partial: ['Thu một phần', 'warning'], over: ['Lệch số tiền', 'danger'], none: ['Chưa khớp', ''], done: ['Đã xác nhận', 'accent'], refund: ['Cần hoàn tiền', 'danger'] };
  function confirmTransfer(t, stId) {
    const r = getRound(t.roundId); const st = student(stId);
    const [date, time] = t.time.split(' ');
    const p = createPayment({ studentId: stId, roundId: r.id, method: 'chuyen-khoan', lines: allocate(stId, r.id, t.amount), payer: (st.parent || {}).name || t.fromName,
      date, time, bankRef: t.bankRef, note: 'Đối soát CK: ' + t.content, transferId: t.id });
    t.status = 'da-khop'; t.studentId = stId; t.paymentId = p.id;
    return p;
  }
  function assignDialog(t, onDone) {
    if (!canCollect()) { roToast(); return; }
    const round = getRound(t.roundId);
    const open = calc().roundStudents(t.roundId).map((st) => ({ st, s: calc().studentStatus(st.id, t.roundId) })).filter((x) => x.s.remaining > 0);
    const text = norm(t.content + ' ' + t.fromName);
    const scored = open.map((x) => {
      const why = [];
      if (x.s.remaining === t.amount) why.push('✓ Trùng số tiền');
      if (x.st.parent && x.st.parent.name && text.includes(norm(x.st.parent.name))) why.push('✓ Tên phụ huynh khớp');
      if (text.includes(norm(x.st.name))) why.push('✓ Tên học sinh khớp');
      if (text.includes(norm(x.st.code))) why.push('✓ Mã học sinh khớp');
      return Object.assign({ why, score: why.length * 2 + (why.some((w) => w.includes('Tên')) ? 3 : 0) }, x);
    }).filter((x) => x.score > 0 && x.why.some((w) => !w.includes('số tiền'))).sort((a, b) => b.score - a.score).slice(0, 4);
    const cur = matchOf(t);
    let chosen = (scored[0] && scored[0].st.id) || (cur.st && cur.st.id) || '';
    const item = (x) => '<label class="tt-cand' + (x.st.id === chosen ? ' on' : '') + '"><input type="radio" name="ttCand" value="' + esc(x.st.id) + '"' + (x.st.id === chosen ? ' checked' : '') + '>' +
      '<span><b>' + esc(x.st.name) + '</b> · ' + esc(className(x.st)) + '<span class="sub">' + esc(x.st.code) + ' · Còn phải thu ' + money(x.s.remaining) + ' đ</span>' + (x.why && x.why.length ? '<span class="sub ok">' + esc(x.why.join(' · ')) + '</span>' : '') + '</span></label>';
    dialog({
      title: 'Gán học sinh cho giao dịch', width: '640px',
      body: '<div class="tt-tx"><div class="muted">Tiền về · ' + esc(t.time) + ' · ' + esc(D().school.bank) + ' ' + esc(D().school.account) + '</div><div class="amt">' + money(t.amount) + ' đ</div>' +
        '<div>Từ: ' + esc(t.fromName) + ' · ' + esc(t.fromBank) + '</div><div>Nội dung: <code>' + esc(t.content) + '</code></div><div class="muted">Mã GD: ' + esc(t.bankRef) + ' · ' + esc(round ? round.name : '') + '</div></div>' +
        '<div class="tt-sec"><span>Gợi ý học sinh phù hợp</span></div><div class="tt-cands" id="ttCands">' + (scored.length ? scored.map(item).join('') : '<div class="muted">Không tìm thấy gợi ý tự động — hãy tìm học sinh bên dưới.</div>') + '</div>' +
        UI.search({ id: 'ttCandQ', placeholder: 'Tìm học sinh khác (tên, mã HS, lớp)…' }) + '<div class="tt-cands" id="ttCandRes"></div>' +
        '<div class="note warning" id="ttAssignWarn" hidden></div>',
      footer: btn({ label: 'Cần hoàn tiền', icon: 'ban', variant: 'tertiary danger', action: 'refund' }) + '<span class="grow"></span>' + btn({ label: 'Hủy', action: 'close' }) + btn({ label: 'Khớp & tạo phiếu thu', icon: 'check', variant: 'primary', action: 'ok', id: 'ttAssignOk' }),
      onMount(d, close) {
        const check = () => {
          const x = chosen && calc().studentStatus(chosen, t.roundId);
          const w = $('#ttAssignWarn', d); const over = x && t.amount > x.remaining;
          w.hidden = !over; if (over) w.textContent = 'Số tiền chuyển (' + money(t.amount) + ' đ) lớn hơn số còn phải thu (' + money(x.remaining) + ' đ). Chỉ khớp khi không vượt số phải thu — phần chênh lệch cần hoàn trả phụ huynh.';
          $('#ttAssignOk', d).disabled = !chosen || over;
          $$('.tt-cand', d).forEach((l) => l.classList.toggle('on', l.querySelector('input').value === chosen));
        };
        $('#ttCandQ', d).addEventListener('input', (e) => {
          const q = norm(e.target.value.trim());
          $('#ttCandRes', d).innerHTML = q.length < 2 ? '' : open.filter((x) => norm(x.st.name + ' ' + x.st.code + ' ' + className(x.st)).includes(q)).slice(0, 6).map(item).join('') || '<div class="muted">Không tìm thấy học sinh còn phải thu.</div>';
          check();
        });
        d.addEventListener('change', (e) => { if (e.target.name === 'ttCand') { chosen = e.target.value; check(); } });
        d.addEventListener('click', (e) => {
          const a = e.target.closest('[data-action]'); if (!a) return;
          if (a.dataset.action === 'ok' && chosen) { const p = confirmTransfer(t, chosen); App.save(); close(); toast('Đã khớp giao dịch và tạo phiếu thu ' + p.receiptNo, 'success'); onDone(); }
          if (a.dataset.action === 'refund') { t.status = 'hoan-tien'; App.save(); close(); toast('Đã đánh dấu giao dịch cần hoàn tiền'); onDone(); }
        });
        check();
      },
    });
  }

  frame('12.3', 'Thu tiền / Đối soát chuyển khoản', '/thu-tien/doi-soat?round=r2', G);
  route('/thu-tien/doi-soat', {
    title: 'Đối soát chuyển khoản', menu: 'thu-tien',
    render({ el, query }) {
      let roundId = pickRound(query.round);
      if (!roundId) return emptyYear(el, 'Đối soát chuyển khoản');
      const f = { result: query.result || '', q: '' };
      el.classList.add('tt-view', 'tt-fit');
      el.innerHTML =
        '<div class="view-head"><h1 class="view-title dark">Đối soát chuyển khoản</h1></div><div id="ttTabs"></div><div class="stats tt-stats" id="ttStats"></div>' +
        '<div class="tt-filters">' +
        field({ label: 'Đợt thu', id: 'fRound', type: 'select', options: roundOptions(), value: roundId, cls: 'w-round' }) +
        field({ label: 'Tài khoản nhận', id: 'fAcc', type: 'select', options: [(D().school.bank || 'BIDV') + ' · ' + (D().school.account || '')], cls: 'w-scope' }) +
        field({ label: 'Kết quả đối soát', id: 'fResult', type: 'select', value: f.result, cls: 'w-status', options: [{ value: '', label: 'Tất cả' }, { value: 'pending', label: 'Chờ xác nhận' }, { value: 'exact', label: 'Khớp đúng' }, { value: 'issue', label: 'Cần xử lý' }, { value: 'done', label: 'Đã xác nhận' }, { value: 'refund', label: 'Cần hoàn tiền' }] }) +
        '</div>' +
        '<div class="toolbar tt-toolbar"><div class="tt-search">' + UI.search({ id: 'fQ', placeholder: 'Tìm theo nội dung chuyển khoản, mã giao dịch, người chuyển…' }) + '</div><span class="grow"></span>' +
        btn({ label: 'Quay lại thu tiền', icon: 'arrow-left', action: 'back' }) + btn({ label: 'Xác nhận các giao dịch khớp đúng', icon: 'check', variant: 'primary', action: 'confirmAll', id: 'btnAll', attrs: { 'data-write': '' } }) + '</div>' +
        '<div class="tt-table" id="ttTable"></div>';
      const list = () => (D().bankTransfers || []).filter((t) => t.roundId === roundId);
      const draw = () => {
        $('#ttTabs', el).innerHTML = flowTabs('thu-tien', roundId);
        const all = list().map((t) => ({ t, m: matchOf(t) }));
        const pend = all.filter((x) => x.t.status === 'cho-xu-ly');
        const exact = pend.filter((x) => x.m.kind === 'exact');
        $('#ttStats', el).innerHTML = statCard('Chờ đối soát', pend.length + ' giao dịch') + statCard('Khớp tự động', pend.filter((x) => x.m.kind === 'exact' || x.m.kind === 'partial').length + ' giao dịch') +
          statCard('Cần xử lý', pend.filter((x) => x.m.kind === 'none' || x.m.kind === 'over').length + ' giao dịch') + statCard('Tiền chờ xác nhận (đ)', money(pend.reduce((s, x) => s + x.t.amount, 0)), 'accent');
        $('#btnAll', el).disabled = !exact.length;
        const q = norm(f.q.trim());
        const rows = all.filter((x) => {
          const k = x.m.kind;
          if (f.result === 'pending' && x.t.status !== 'cho-xu-ly') return false;
          if (f.result === 'exact' && k !== 'exact') return false;
          if (f.result === 'issue' && !(k === 'none' || k === 'over')) return false;
          if (f.result === 'done' && k !== 'done') return false;
          if (f.result === 'refund' && k !== 'refund') return false;
          return !q || norm(x.t.content + ' ' + x.t.bankRef + ' ' + x.t.fromName + ' ' + (x.m.st ? x.m.st.name + ' ' + x.m.st.code : '')).includes(q);
        }).sort((a, b) => (a.t.status === 'cho-xu-ly' ? 0 : 1) - (b.t.status === 'cho-xu-ly' ? 0 : 1)).map((x) => Object.assign({ id: x.t.id }, x));
        $('#ttTable', el).innerHTML = grid({
          id: 'ttGrid', rows, fill: true, empty: 'Không có giao dịch phù hợp.',
          columns: [
            { key: 'time', label: 'Thời gian giao dịch', render: (r) => esc(r.t.time) + '<span class="sub">' + esc(r.t.bankRef) + '</span>' },
            { key: 'content', label: 'Nội dung chuyển khoản', render: (r) => '<code class="tt-code">' + esc(r.t.content) + '</code><span class="sub">' + esc(r.t.fromName) + ' · ' + esc(r.t.fromBank) + '</span>' },
            { key: 'amount', label: 'Số tiền', align: 'right', render: (r) => money(r.t.amount) },
            { key: 'match', label: 'Học sinh khớp', render: (r) => (r.m.st ? '<b>' + esc(r.m.st.name) + '</b> · ' + esc(className(r.m.st)) + '<span class="sub">' + esc(r.m.st.code) + (r.m.s ? ' · Còn phải thu ' + money(r.m.s.remaining) : '') + (r.m.p ? ' · ' + esc(r.m.p.receiptNo) : '') + (r.m.manual && r.m.kind !== 'done' ? ' · gán thủ công' : '') + '</span>' : '<span class="muted">Không tìm thấy mã học sinh</span>') },
            { key: 'result', label: 'Kết quả', render: (r) => { const [l, tone] = RESULT[r.m.kind]; return badge(l, tone); } },
            { key: 'act', label: 'Thao tác', render: (r) => {
              const k = r.m.kind; const id = esc(r.t.id);
              if (k === 'exact' || k === 'partial') return btn({ label: 'Xác nhận', variant: 'primary', cls: 'sm', attrs: { 'data-tx': id, 'data-do': 'confirm', 'data-write': '' } }) + btn({ icon: 'ellipsis-dots-v', aria: 'Thêm thao tác', variant: 'tertiary', cls: 'sm', attrs: { 'data-tx': id, 'data-do': 'more', 'data-write': '' } });
              if (k === 'done') return btn({ label: 'Xem phiếu', icon: 'file-text-o', variant: 'tertiary', cls: 'sm', attrs: { 'data-tx': id, 'data-do': 'view' } });
              if (k === 'refund') return btn({ label: 'Hoàn tác', variant: 'tertiary', cls: 'sm', attrs: { 'data-tx': id, 'data-do': 'undo', 'data-write': '' } });
              return btn({ label: k === 'over' ? 'Xử lý' : 'Gán học sinh', icon: 'user-check', cls: 'sm', attrs: { 'data-tx': id, 'data-do': 'assign', 'data-write': '' } });
            } },
          ],
        }) + '<div class="tt-gridfoot"><span>' + rows.length + ' giao dịch · ' + esc(D().school.bank) + ' ' + esc(D().school.account) + '</span><span>Hệ thống tự khớp theo mã học sinh trong nội dung chuyển khoản (ví dụ HP-HS100001-T09). Phiếu thu chỉ được tạo sau khi xác nhận.</span></div>';
      };
      el.addEventListener('change', (e) => {
        if (e.target.id === 'fRound') { roundId = e.target.value; replaceHash('/thu-tien/doi-soat?round=' + roundId); draw(); }
        if (e.target.id === 'fResult') { f.result = e.target.value; draw(); }
      });
      $('#fQ', el).addEventListener('input', (e) => { f.q = e.target.value; draw(); });
      el.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-tx]');
        if (b) {
          const t = (D().bankTransfers || []).find((x) => x.id === b.dataset.tx); if (!t) return;
          const m = matchOf(t);
          if (['confirm', 'undo', 'more'].includes(b.dataset.do) && !canCollect()) { roToast(); return; }
          if (b.dataset.do === 'confirm') { const p = confirmTransfer(t, m.st.id); App.save(); draw(); toast('Đã xác nhận ' + money(p.amount) + ' đ cho ' + m.st.name + ' · ' + p.receiptNo, 'success'); }
          if (b.dataset.do === 'assign') assignDialog(t, draw);
          if (b.dataset.do === 'view' && m.p) App.go('/phieu-thu/' + m.p.id);
          if (b.dataset.do === 'undo') { t.status = 'cho-xu-ly'; App.save(); draw(); toast('Đã đưa giao dịch về trạng thái chờ đối soát'); }
          if (b.dataset.do === 'more') menu(b, [{ label: 'Gán học sinh khác', icon: 'user-check', onClick: () => assignDialog(t, draw) }, { label: 'Đánh dấu cần hoàn tiền', icon: 'ban', danger: true, onClick: () => { t.status = 'hoan-tien'; App.save(); draw(); toast('Đã đánh dấu giao dịch cần hoàn tiền'); } }]);
          return;
        }
        const a = e.target.closest('[data-action]'); if (!a) return;
        if (a.dataset.action === 'back') App.go('/thu-tien?round=' + roundId);
        if (a.dataset.action === 'confirmAll') {
          if (!canCollect()) { roToast(); return; }
          const ex = list().filter((t) => t.status === 'cho-xu-ly' && matchOf(t).kind === 'exact');
          if (!ex.length) return;
          if (!(await UI.confirm({ title: 'Xác nhận giao dịch khớp đúng', okLabel: 'Xác nhận', html: 'Tạo <b>' + ex.length + '</b> phiếu thu chuyển khoản cho các giao dịch khớp đúng số tiền và mã học sinh (tổng <b>' + money(ex.reduce((s, t) => s + t.amount, 0)) + ' đ</b>)?' }))) return;
          ex.forEach((t) => confirmTransfer(t, matchOf(t).st.id)); App.save(); draw(); toast('Đã xác nhận ' + ex.length + ' giao dịch', 'success');
        }
      });
      draw();
    },
  });

  // ======================================================================
  // Receipt document (13.2 + print preview)
  // ======================================================================
  function receiptLines(p) {
    const before = feeRemaining(p.studentId, p.roundId, payNo(p));
    return p.lines.map((l) => { const b = before.find((x) => x.feeId === l.feeId); const bv = b ? b.remaining : l.amount; return { name: feeName(l.feeId), before: bv, paid: l.amount, after: Math.max(0, bv - l.amount) }; });
  }
  function receiptDoc(p, opts) {
    const st = student(p.studentId) || { name: '—', code: '', parent: {} }; const r = getRound(p.roundId) || { name: '' };
    const lines = receiptLines(p);
    return '<article class="tt-doc' + (p.status === 'da-huy' ? ' void' : '') + (opts && opts.paper ? ' paper' : '') + '">' +
      (p.status === 'da-huy' ? '<div class="tt-stamp" aria-hidden="true">ĐÃ HỦY</div>' : '') +
      '<div class="tt-doc-school">' + esc(D().school.name) + '<span>' + esc(D().school.address || '') + '</span></div>' +
      '<h2 class="tt-doc-title">PHIẾU THU</h2>' +
      '<div class="tt-doc-meta">Số: <b>' + esc(p.receiptNo) + '</b> · Ngày ' + esc(p.date) + ' lúc ' + esc(p.time) + '</div>' +
      '<div class="tt-doc-info">' +
      '<div><span>Người nộp tiền</span><b>' + esc(p.payer || '—') + '</b></div><div><span>Mã chuyển khoản</span><b>' + esc(transferCode(st, r)) + '</b></div>' +
      '<div><span>Học sinh</span><b>' + esc(st.name) + ' · ' + esc(st.code) + ' · Lớp ' + esc(className(st)) + '</b></div><div><span>Hình thức</span><b>' + esc(METHOD[p.method]) + '</b></div>' +
      '<div><span>Đợt thu</span><b>' + esc(r.name) + '</b></div><div><span>Mã giao dịch</span><b>' + esc(p.bankRef || '—') + '</b></div>' +
      '</div>' +
      '<table class="tt-doc-table"><thead><tr><th>Khoản thu</th><th class="num">Trước khi thu</th><th class="num">Thu lần này</th><th class="num">Còn lại</th></tr></thead><tbody>' +
      lines.map((l) => '<tr><td>' + esc(l.name) + '</td><td class="num">' + money(l.before) + '</td><td class="num">' + money(l.paid) + '</td><td class="num">' + money(l.after) + '</td></tr>').join('') +
      '</tbody><tfoot><tr><td colspan="2" class="num">Tổng cộng</td><td class="num tt-doc-total">' + money(p.amount) + ' đ</td><td></td></tr></tfoot></table>' +
      '<div class="tt-doc-words"><div><span>Bằng chữ:</span> <b class="tt-words">' + esc(vnWords(p.amount)) + '</b></div>' +
      '<div><span>Thanh toán:</span> ' + esc(METHOD[p.method]) + (p.method === 'chuyen-khoan' ? ' vào TK ' + esc(D().school.bank) + ' ' + esc(D().school.account) : ' tại quầy thu') + '</div>' +
      '<div><span>Ghi chú:</span> ' + esc(p.note || '—') + '</div>' +
      (p.status === 'da-huy' ? '<div class="danger"><span>Đã hủy:</span> ' + esc(p.cancelledAt || '') + ' · ' + esc(p.cancelledBy || '') + ' · Lý do: ' + esc(p.cancelReason || '') + '</div>' : '') + '</div>' +
      '<div class="tt-doc-sign"><div><b>Người nộp tiền</b><span>(Ký, ghi rõ họ tên)</span><em>' + esc(p.payer || '') + '</em></div><div><b>Người thu tiền</b><span>(Ký, ghi rõ họ tên)</span><em>' + esc(p.collector || '') + '</em></div><div><b>Đại diện nhà trường</b><span>(Ký, đóng dấu)</span><em></em></div></div>' +
      '</article>';
  }
  function printPreview(p) {
    dialog({
      title: 'Xem trước bản in · ' + p.receiptNo, width: '860px',
      body: '<div class="tt-print-bg">' + receiptDoc(p, { paper: true }) + '</div>',
      footer: '<span class="grow muted">Khổ A5 ngang · 1 liên</span>' + btn({ label: 'Đóng', action: 'close' }) + btn({ label: 'In', icon: 'print', variant: 'primary', action: 'ok' }),
      onMount(d, close) { $('[data-action="ok"]', d).addEventListener('click', () => { close(); toast('Đã gửi phiếu ' + p.receiptNo + ' tới máy in (mô phỏng)', 'success'); }); },
    });
  }
  function cancelReceipt(p, after) {
    if (!canVoid()) { roToast(); return; }
    const st = student(p.studentId) || { name: '' };
    const s = calc().studentStatus(p.studentId, p.roundId);
    const nextStatus = calc().STATUS_LABEL[s.paid - p.amount <= 0 ? 'chua-thu' : 'mot-phan'][0];
    dialog({
      title: 'Hủy phiếu thu ' + p.receiptNo + '?', width: '560px',
      body: '<p style="margin:0 0 12px;line-height:1.5">' + esc(st.name) + ' (' + esc(className(st)) + ') sẽ quay về trạng thái “' + esc(nextStatus) + '”, số đã thu giảm <b>' + money(p.amount) + ' đ</b>. Phiếu không bị xóa mà được lưu với trạng thái “Đã hủy” kèm lý do và người hủy.</p>' +
        (p.method === 'chuyen-khoan' ? '<div class="note warning" style="margin-bottom:12px">Phiếu này đến từ chuyển khoản: tiền vẫn nằm trong tài khoản trường. Giao dịch sẽ quay lại danh sách đối soát để khớp lại hoặc hoàn tiền cho phụ huynh.</div>' : '') +
        field({ label: 'Lý do hủy', id: 'ttReason', type: 'textarea', required: true, placeholder: 'Ví dụ: Khớp nhầm học sinh, phụ huynh chuyển trùng…' }),
      footer: btn({ label: 'Đóng', action: 'close' }) + btn({ label: 'Hủy phiếu', icon: 'ban', variant: 'primary danger', action: 'ok' }),
      onMount(d, close) {
        $('[data-action="ok"]', d).addEventListener('click', () => {
          if (!UI.validate(d)) return;
          p.status = 'da-huy'; p.cancelReason = $('#ttReason', d).value.trim(); p.cancelledAt = TODAY + ' ' + nowTime(); p.cancelledBy = (App.user() || {}).name || COLLECTOR;
          const t = (D().bankTransfers || []).find((x) => x.paymentId === p.id || (p.transferId && x.id === p.transferId));
          if (t) { t.status = 'cho-xu-ly'; t.paymentId = ''; t.studentId = ''; }
          App.save(); close(); toast('Đã hủy phiếu thu ' + p.receiptNo, 'success'); after && after();
        });
      },
    });
  }

  // ======================================================================
  // 13.1 — Phiếu thu / Danh sách
  // ======================================================================
  frame('13.1', 'Phiếu thu / Danh sách', '/phieu-thu', G);
  route('/phieu-thu', {
    title: 'Phiếu thu', menu: 'phieu-thu',
    render({ el, query }) {
      const f = { round: query.round && getRound(query.round) ? query.round : '', method: query.method || '', status: query.status || '', q: '' };
      const tabRound = () => f.round || defaultRound();
      el.classList.add('tt-view', 'tt-fit');
      el.innerHTML =
        '<h1 class="view-title dark">Phiếu thu</h1><div id="ttTabs"></div><div class="stats tt-stats" id="ttStats"></div>' +
        '<div class="tt-filters">' +
        field({ label: 'Đợt thu', id: 'fRound', type: 'select', options: roundOptions(true), value: f.round, cls: 'w-round' }) +
        field({ label: 'Hình thức', id: 'fMethod', type: 'select', value: f.method, cls: 'w-scope', options: [{ value: '', label: 'Tất cả' }, { value: 'tien-mat', label: 'Tiền mặt' }, { value: 'chuyen-khoan', label: 'Chuyển khoản' }] }) +
        field({ label: 'Trạng thái phiếu', id: 'fStatus', type: 'select', value: f.status, cls: 'w-status', options: [{ value: '', label: 'Tất cả' }, { value: 'da-ghi-nhan', label: 'Đã ghi nhận' }, { value: 'da-huy', label: 'Đã hủy' }] }) +
        '</div>' +
        '<div class="toolbar tt-toolbar"><div class="tt-search">' + UI.search({ id: 'fQ', placeholder: 'Tìm theo số phiếu, học sinh, người nộp, mã giao dịch…' }) + '</div><span class="grow"></span>' +
        btn({ label: 'Xuất Excel', icon: 'download', action: 'export' }) + btn({ label: 'Thu tiền', icon: 'wallet', variant: 'primary', action: 'collect', attrs: { 'data-write': '' } }) + '</div>' +
        '<div class="tt-table" id="ttTable"></div>';
      const yr = () => new Set(yearRounds().map((r) => r.id));
      const draw = () => {
        $('#ttTabs', el).innerHTML = flowTabs('phieu-thu', tabRound());
        const ids = yr();
        const base = (D().payments || []).filter((p) => ids.has(p.roundId) && (!f.round || p.roundId === f.round));
        const valid = base.filter((p) => p.status !== 'da-huy');
        const sum = (m) => valid.filter((p) => !m || p.method === m).reduce((t, p) => t + p.amount, 0);
        $('#ttStats', el).innerHTML = statCard('Số phiếu thu', valid.length + ' phiếu') + statCard('Tiền mặt (đ)', money(sum('tien-mat'))) + statCard('Chuyển khoản (đ)', money(sum('chuyen-khoan'))) + statCard('Tổng đã thu (đ)', money(sum()), 'accent');
        const q = norm(f.q.trim());
        const rows = base.filter((p) => (!f.method || p.method === f.method) && (!f.status || p.status === f.status)).map((p) => ({ id: p.id, p, st: student(p.studentId) || { name: '—', code: '' } }))
          .filter((r) => !q || norm(r.p.receiptNo + ' ' + r.st.name + ' ' + r.st.code + ' ' + r.p.payer + ' ' + r.p.bankRef + ' ' + className(r.st)).includes(q))
          .sort((a, b) => byNo(b.p, a.p));
        const cancelled = rows.filter((r) => r.p.status === 'da-huy').length;
        $('#ttTable', el).innerHTML = grid({
          id: 'ttGrid', rows, fill: true, clickable: true, empty: 'Không có phiếu thu phù hợp.',
          columns: [
            { key: 'no', label: 'Số phiếu', render: (r) => '<a class="tt-link" href="#/phieu-thu/' + esc(r.p.id) + '">' + esc(r.p.receiptNo) + '</a>' },
            { key: 'date', label: 'Ngày thu', render: (r) => esc(r.p.date) + ' <span class="muted">' + esc(r.p.time) + '</span>' },
            { key: 'st', label: 'Học sinh', render: (r) => esc(r.st.name) + '<span class="sub">' + esc(r.st.code) + '</span>' },
            { key: 'cls', label: 'Lớp', render: (r) => esc(className(r.st)) },
            { key: 'round', label: 'Đợt thu', render: (r) => esc((getRound(r.p.roundId) || {}).name || '') },
            { key: 'amt', label: 'Số tiền', align: 'right', render: (r) => (r.p.status === 'da-huy' ? '<s class="muted">' + money(r.p.amount) + '</s>' : money(r.p.amount)) },
            { key: 'method', label: 'Hình thức', cls: 'tt-dim', render: (r) => esc(METHOD[r.p.method]) },
            { key: 'col', label: 'Người thu', cls: 'tt-dim', render: (r) => esc(r.p.collector) },
            { key: 'status', label: 'Trạng thái', render: (r) => (r.p.status === 'da-huy' ? badge('Đã hủy', 'danger') : badge('Đã ghi nhận', 'success')) },
          ],
          actions: (r) => btn({ icon: 'ellipsis-dots-v', aria: 'Thao tác', variant: 'tertiary', cls: 'sm', attrs: { 'data-more': r.p.id } }),
        }) + '<div class="tt-gridfoot"><span>' + rows.length + ' phiếu thu' + (cancelled ? ' · ' + cancelled + ' đã hủy' : '') + '</span><span>Phiếu thu đã ghi nhận không sửa được — chỉ có thể hủy (lưu vết người hủy và lý do).</span></div>';
        bindGrid($('#ttGrid', el), { onRowClick: (k, e) => { if (!e.target.closest('[data-more]')) App.go('/phieu-thu/' + k); } });
      };
      el.addEventListener('change', (e) => {
        if (e.target.id === 'fRound') { f.round = e.target.value; draw(); }
        if (e.target.id === 'fMethod') { f.method = e.target.value; draw(); }
        if (e.target.id === 'fStatus') { f.status = e.target.value; draw(); }
      });
      $('#fQ', el).addEventListener('input', (e) => { f.q = e.target.value; draw(); });
      el.addEventListener('click', (e) => {
        const m = e.target.closest('[data-more]');
        if (m) {
          const p = (D().payments || []).find((x) => x.id === m.dataset.more); if (!p) return;
          menu(m, [{ label: 'Xem chi tiết', icon: 'file-text-o', onClick: () => App.go('/phieu-thu/' + p.id) }, { label: 'In phiếu', icon: 'print', onClick: () => printPreview(p) },
            '-', { label: 'Hủy phiếu', icon: 'ban', danger: true, disabled: p.status === 'da-huy', onClick: () => cancelReceipt(p, draw) }].filter((it) => canVoid() || (it !== '-' && it.label !== 'Hủy phiếu')));
          return;
        }
        const a = e.target.closest('[data-action]'); if (!a) return;
        if (a.dataset.action === 'export') toast('Đã xuất danh sách phiếu thu ra Excel (mô phỏng)', 'success');
        if (a.dataset.action === 'collect') App.go('/thu-tien?round=' + tabRound());
      });
      draw();
    },
  });

  // ======================================================================
  // 13.2 — Phiếu thu / Chi tiết
  // ======================================================================
  frame('13.2', 'Phiếu thu / Chi tiết PT00019', '/phieu-thu/p19', G);
  route('/phieu-thu/:id', {
    title: 'Chi tiết phiếu thu', menu: 'phieu-thu',
    render({ el, params }) {
      const p = (D().payments || []).find((x) => x.id === params.id || x.receiptNo === params.id);
      if (!p) { el.innerHTML = '<h1 class="view-title dark">Phiếu thu</h1><div class="note danger">Không tìm thấy phiếu thu “' + esc(params.id) + '”.</div><div>' + btn({ label: 'Về danh sách phiếu thu', icon: 'arrow-left', action: 'list' }) + '</div>'; el.onclick = (e) => { if (e.target.closest('[data-action="list"]')) App.go('/phieu-thu'); }; return; }
      el.classList.add('tt-view');
      const draw = () => {
        const st = student(p.studentId) || { name: '—' };
        const s = calc().studentStatus(p.studentId, p.roundId);
        const hist = roundPayments(p.studentId, p.roundId, true);
        const after = Math.max(0, calc().studentDue(p.studentId, p.roundId).total - roundPayments(p.studentId, p.roundId).filter((h) => payNo(h) <= payNo(p)).reduce((t, h) => t + h.amount, 0));
        const void_ = p.status === 'da-huy';
        el.innerHTML =
          '<div class="view-head">' + btn({ icon: 'arrow-left', aria: 'Quay lại danh sách phiếu thu', variant: 'tertiary', action: 'back' }) + '<h1 class="view-title dark">Phiếu thu ' + esc(p.receiptNo) + '</h1>' + (void_ ? badge('Đã hủy', 'danger') : '') + '</div>' +
          '<div class="tt-detail">' + receiptDoc(p) +
          '<aside class="card tt-side">' +
          '<h2>Tóm tắt phiếu thu</h2>' +
          '<div class="k">Trạng thái</div><div>' + (void_ ? badge('Đã hủy', 'danger') : badge('Đã ghi nhận', 'success')) + '</div>' +
          '<div class="k">Số tiền phiếu này</div><div class="v' + (void_ ? ' muted' : '') + '">' + (void_ ? '<s>' + money(p.amount) + ' đ</s>' : money(p.amount) + ' đ') + '</div>' +
          '<div class="k">Còn lại sau phiếu này</div><div class="v warn">' + money(after) + ' đ</div>' +
          '<div class="k">Hiện còn phải thu (' + esc(st.name) + ')</div><div>' + money(s.remaining) + ' đ · ' + statusText(s.status) + '</div>' +
          '<hr><h3>Lịch sử thu</h3><div class="tt-hist">' +
          hist.map((h) => '<a href="#/phieu-thu/' + esc(h.id) + '" class="' + (h.id === p.id ? 'cur ' : '') + (h.status === 'da-huy' ? 'void' : '') + '"><span><b>' + esc(h.receiptNo) + '</b> · ' + esc(shortDT(h)) + '<span class="sub">' + esc(METHOD[h.method]) + (h.status === 'da-huy' ? ' · Đã hủy' : '') + '</span></span><span class="num">' + money(h.amount) + '</span></a>').join('') +
          '</div><div class="tt-hist-total">Tổng đã thu: <b>' + money(s.paid) + '</b> / ' + money(s.due) + ' đ</div>' +
          '<hr><div class="tt-verify">' + qrSvg(p.receiptNo + p.date, 76) + '<div><b>Mã xác thực</b><span>Quét để kiểm tra tính hợp lệ của phiếu thu ' + esc(p.receiptNo) + '.</span></div></div>' +
          '<div class="tt-side-actions">' + btn({ label: 'In phiếu', icon: 'print', action: 'print' }) + btn({ label: 'Tải PDF', icon: 'download', action: 'pdf' }) + btn({ label: 'Hủy phiếu', icon: 'ban', variant: 'danger', action: 'void', attrs: { 'data-write': '' }, disabled: void_ }) + '</div>' +
          '</aside></div>';
      };
      el.onclick = (e) => {
        const a = e.target.closest('[data-action]'); if (!a || a.disabled) return;
        if (a.dataset.action === 'back') App.go('/phieu-thu');
        if (a.dataset.action === 'print') printPreview(p);
        if (a.dataset.action === 'pdf') toast('Đã tải xuống ' + p.receiptNo + '.pdf (mô phỏng)', 'success');
        if (a.dataset.action === 'void') cancelReceipt(p, draw);
      };
      draw();
    },
  });
})();
