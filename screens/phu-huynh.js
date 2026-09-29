/* screens: phu-huynh — Cổng phụ huynh: Học phí của con (PH1), Nộp tiền QR (PH2), Lịch sử nộp tiền (PH3).
   Parents only ever see the students in ctx.user.studentIds. All money comes from App.calc. */
(function () {
  'use strict';
  const { route, frame } = App;
  const { esc, money, icon, btn, dialog, toast, badge, $, $$, parseMoney } = UI;
  const G = 'Phụ huynh';
  const TODAY = '29/09/2025'; // "today" inside the 2025-2026 sample data (same as thu-tien)
  const METHOD = { 'tien-mat': 'Tiền mặt', 'chuyen-khoan': 'Chuyển khoản' };
  const PH_STATUS = { 'chua-thu': ['Chưa nộp', 'danger'], 'mot-phan': ['Nộp một phần', 'warning'], 'da-thu': ['Đã nộp đủ', 'success'], 'khong-thu': ['Không phải nộp', ''] };
  const BANKS = ['Vietcombank', 'VietinBank', 'BIDV', 'Agribank', 'Techcombank', 'MB Bank', 'ACB', 'VPBank', 'Sacombank', 'TPBank', 'Khác'];
  const BANK_CODE = { Vietcombank: 'VCB', VietinBank: 'CTG', BIDV: 'BIDV', Agribank: 'AGR', Techcombank: 'TCB', 'MB Bank': 'MB', ACB: 'ACB', VPBank: 'VPB', Sacombank: 'STB', TPBank: 'TPB', 'Khác': 'NH' };

  const D = () => App.data;
  const C = () => App.calc;
  const pad = (n) => String(n).padStart(2, '0');
  const nowTime = () => { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const student = (id) => (D().students || []).find((s) => s.id === id);
  const getRound = (id) => (D().rounds || []).find((r) => r.id === id);
  const up = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toUpperCase();
  const className = (st) => ((st && C().classOf(st)) || {}).name || '—';
  const feeName = (id) => (C().fee(id) || {}).name || id;
  const monthLabel = (r) => (r && r.month ? 'Tháng ' + r.month.slice(5) + '/' + r.month.slice(0, 4) : '');
  // Same format thu-tien's reconciliation matches (HS\d{6} inside HP-<code>-T<MM>).
  const transferCode = (st, r) => 'HP-' + st.code + '-T' + (r && r.month ? r.month.slice(5) : '');
  const sortKey = (dmy, hm) => { const m = String(dmy || '').match(/(\d{2})\/(\d{2})\/(\d{4})/); return (m ? m[3] + m[2] + m[1] : '') + ' ' + (hm || ''); };
  const cmpDesc = (a, b) => (a < b ? 1 : a > b ? -1 : 0);

  function myKids(user) { return ((user && user.studentIds) || []).map(student).filter(Boolean); }
  function yearRounds() {
    return (D().rounds || []).filter((r) => r.yearId === D().currentYearId)
      .sort((a, b) => cmpDesc(a.month + sortKey(a.createdAt), b.month + sortKey(b.createdAt)));
  }
  // Rounds of the current year where the child owes something (newest first).
  function childRounds(stId) { return yearRounds().map((r) => ({ r, s: C().studentStatus(stId, r.id) })).filter((x) => x.s.due > 0); }
  // A round the parent should act on now: notice sent, collection started, or money already moving.
  const isActive = (x, st) => !!x.r.notice || x.r.status !== 'chua-thu' || x.s.paid > 0 || pendingTx(st, x.r.id).length > 0;
  function childTotals(stId) {
    return childRounds(stId).reduce((t, x) => ({ due: t.due + x.s.due, paid: t.paid + x.s.paid, remaining: t.remaining + x.s.remaining }), { due: 0, paid: 0, remaining: 0 });
  }
  // Transfers belonging to a child: explicitly assigned, or carrying the child's code in the content.
  const txOf = (t, st) => t.studentId === st.id || (!t.studentId && up(t.content).includes(st.code));
  function pendingTx(st, roundId) {
    return (D().bankTransfers || []).filter((t) => t.status === 'cho-xu-ly' && (!roundId || t.roundId === roundId) && txOf(t, st));
  }
  const pendingSum = (st, roundId) => pendingTx(st, roundId).reduce((s, t) => s + t.amount, 0);
  const receiptsOf = (stId, roundId) => (D().payments || []).filter((p) => p.studentId === stId && (!roundId || p.roundId === roundId));

  // ---------- deterministic fake QR (local copy; thu-tien's is private) ----------
  function qrSvg(text, px) {
    const n = 29; let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    const rnd = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296;
    const finder = (x, y) => (x < 8 && y < 8) || (x >= n - 8 && y < 8) || (x < 8 && y >= n - 8);
    const logo = (x, y) => x >= 11 && x <= 17 && y >= 11 && y <= 17;
    let r = '';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { if (finder(x, y) || logo(x, y)) continue; if (rnd() < 0.48) r += 'M' + x + ' ' + y + 'h1v1h-1z'; }
    const eye = (x, y) => 'M' + x + ' ' + y + 'h7v7h-7zM' + (x + 1) + ' ' + (y + 1) + 'v5h5v-5zM' + (x + 2) + ' ' + (y + 2) + 'h3v3h-3z';
    return '<svg class="ph-qr" viewBox="-2 -2 ' + (n + 4) + ' ' + (n + 4) + '" width="' + px + '" height="' + px + '" role="img" aria-label="Mã VietQR"><rect x="-2" y="-2" width="' + (n + 4) + '" height="' + (n + 4) + '" class="ph-qr-bg"/>' +
      '<path fill-rule="evenodd" d="' + eye(0, 0) + eye(n - 7, 0) + eye(0, n - 7) + r + '"/><rect x="11.5" y="11.5" width="6" height="6" rx="1.2" class="ph-qr-logo"/><text x="14.5" y="15.6" text-anchor="middle" class="ph-qr-logo-t">QR</text></svg>';
  }

  function copyText(value, srcEl) {
    const done = () => toast('Đã sao chép: ' + value, 'success');
    const fallback = () => {
      try {
        const r = document.createRange(); r.selectNodeContents(srcEl); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
        let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        if (ok) done(); else toast('Đã chọn sẵn nội dung — nhấn giữ hoặc Ctrl+C để sao chép');
      } catch (e) { toast('Không sao chép được, vui lòng chép thủ công', 'danger'); }
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(value).then(done, fallback);
      else fallback();
    } catch (e) { fallback(); }
  }

  // ---------- receipt / transfer detail (read-only for parents) ----------
  function receiptDialog(p) {
    const st = student(p.studentId) || { name: '—', code: '' }; const r = getRound(p.roundId) || {};
    const void_ = p.status === 'da-huy';
    dialog({
      title: 'Phiếu thu ' + p.receiptNo, width: '560px',
      body: '<div class="ph-rcpt' + (void_ ? ' void' : '') + '">' +
        '<div class="ph-rcpt-head"><div><b>' + esc(D().school.name) + '</b><span>' + esc(D().school.address || '') + '</span></div>' + (void_ ? badge('Đã hủy', 'danger') : badge('Đã ghi nhận', 'success')) + '</div>' +
        '<dl class="ph-dl">' +
        '<dt>Số phiếu</dt><dd>' + esc(p.receiptNo) + '</dd>' +
        '<dt>Ngày thu</dt><dd>' + esc(p.date) + ' lúc ' + esc(p.time) + '</dd>' +
        '<dt>Học sinh</dt><dd>' + esc(st.name) + ' · ' + esc(className(st)) + '</dd>' +
        '<dt>Đợt thu</dt><dd>' + esc(r.name || '') + '</dd>' +
        '<dt>Hình thức</dt><dd>' + esc(METHOD[p.method] || p.method) + (p.bankRef ? ' · ' + esc(p.bankRef) : '') + '</dd>' +
        '<dt>Người nộp</dt><dd>' + esc(p.payer || '—') + '</dd>' +
        '<dt>Người thu</dt><dd>' + esc(p.collector || '—') + '</dd>' +
        '</dl>' +
        '<table class="ph-mini"><thead><tr><th>Khoản thu</th><th class="num">Số tiền (đ)</th></tr></thead><tbody>' +
        (p.lines || []).map((l) => '<tr><td>' + esc(feeName(l.feeId)) + '</td><td class="num">' + money(l.amount) + '</td></tr>').join('') +
        '</tbody><tfoot><tr><td>Tổng cộng</td><td class="num">' + money(p.amount) + '</td></tr></tfoot></table>' +
        (void_ ? '<div class="note danger">Phiếu đã hủy ngày ' + esc(p.cancelledAt || '') + '. Lý do: ' + esc(p.cancelReason || '—') + '. Số tiền này không được tính vào số đã nộp.</div>' : '') +
        '</div>',
      footer: btn({ label: 'Đóng', action: 'close' }),
    });
  }
  function transferDialog(t) {
    const r = getRound(t.roundId) || {};
    const st = myKidOfTx(t);
    const refund = t.status === 'hoan-tien';
    dialog({
      title: refund ? 'Giao dịch cần hoàn tiền' : 'Chuyển khoản chờ xác nhận', width: '520px',
      body: '<div class="note ' + (refund ? 'warning' : '') + '" style="margin-bottom:14px">' +
        (refund ? 'Nhà trường không khớp được giao dịch này với khoản phải nộp và sẽ liên hệ để hoàn tiền.' : 'Nhà trường sẽ đối chiếu sao kê và xác nhận trong 1–2 ngày làm việc. Sau khi xác nhận, phiếu thu sẽ xuất hiện trong lịch sử.') + '</div>' +
        '<dl class="ph-dl">' +
        '<dt>Thời gian</dt><dd>' + esc(t.time) + '</dd>' +
        '<dt>Học sinh</dt><dd>' + esc(st ? st.name + ' · ' + className(st) : '—') + '</dd>' +
        '<dt>Đợt thu</dt><dd>' + esc(r.name || '') + '</dd>' +
        '<dt>Số tiền</dt><dd><b>' + money(t.amount) + ' đ</b></dd>' +
        '<dt>Nội dung</dt><dd><code>' + esc(t.content) + '</code></dd>' +
        '<dt>Từ ngân hàng</dt><dd>' + esc(t.fromBank) + ' · ' + esc(t.fromName) + '</dd>' +
        '<dt>Mã giao dịch</dt><dd>' + esc(t.bankRef) + '</dd>' +
        '</dl>',
      footer: btn({ label: 'Đóng', action: 'close' }),
    });
  }
  let currentKids = [];
  const myKidOfTx = (t) => currentKids.find((st) => txOf(t, st));

  // ---------- pay dialog (VietQR) ----------
  function payDialog(st, r, onChange) {
    const s = C().studentStatus(st.id, r.id);
    const payable = Math.max(0, s.remaining - pendingSum(st, r.id));
    if (!payable) { toast('Khoản này đã được nộp hoặc đang chờ nhà trường xác nhận'); return; }
    const allowPartial = !r.notice || r.notice.partial !== false;
    const content = transferCode(st, r);
    const bank = D().school.bank || 'BIDV'; const acc = D().school.account || ''; const benef = up(D().school.name);
    let amount = payable;
    const copyRow = (label, value, key, strong) => '<div class="ph-kv"><span class="k">' + esc(label) + '</span><span class="v' + (strong ? ' strong' : '') + '" data-copy-src="' + key + '">' + esc(value) + '</span>' +
      btn({ icon: 'copy-o', aria: 'Sao chép ' + label.toLowerCase(), variant: 'tertiary', cls: 'sm', attrs: { 'data-copy': key } }) + '</div>';
    const body = () => '<div class="ph-pay">' +
      '<div class="ph-pay-who"><span><b>' + esc(st.name) + '</b> · Lớp ' + esc(className(st)) + '</span><span class="muted">' + esc(r.name) + ' · Còn phải nộp ' + money(s.remaining) + ' đ' + (s.remaining !== payable ? ' (đang chờ xác nhận ' + money(s.remaining - payable) + ' đ)' : '') + '</span></div>' +
      '<fieldset class="ph-amt"><legend>Số tiền nộp</legend>' +
      '<label class="ph-opt"><input type="radio" name="phAmt" value="full" checked><span>Nộp toàn bộ <b>' + money(payable) + ' đ</b></span></label>' +
      '<label class="ph-opt' + (allowPartial ? '' : ' disabled') + '"><input type="radio" name="phAmt" value="part"' + (allowPartial ? '' : ' disabled') + '><span>Nộp một phần' + (allowPartial ? '' : ' <span class="muted">(nhà trường không nhận nộp một phần cho đợt này)</span>') + '</span></label>' +
      '<div class="ph-part" id="phPart" hidden><div class="ctl-wrap suffix"><input class="ctl num" id="phAmtIn" inputmode="numeric" data-money value="' + money(Math.round(payable / 2 / 1000) * 1000) + '" aria-label="Số tiền muốn nộp"><span class="ph-unit">đ</span></div><div class="help" id="phAmtHelp">Tối thiểu 10.000 đ, tối đa ' + money(payable) + ' đ</div></div>' +
      '</fieldset>' +
      '<div class="ph-qrwrap"><div class="ph-qrbox"><div id="phQr"></div><div class="ph-qrcap">' + icon('qrcode') + ' Quét bằng ứng dụng ngân hàng</div></div>' +
      '<div class="ph-qrinfo">' +
      copyRow('Ngân hàng', bank, 'bank') +
      copyRow('Số tài khoản', acc, 'acc', true) +
      copyRow('Chủ tài khoản', benef, 'benef') +
      copyRow('Số tiền', money(amount), 'amt', true) +
      copyRow('Nội dung', content, 'content', true) +
      '</div></div>' +
      '<div class="note warning">' + icon('info-circle') + '<span>Giữ nguyên nội dung <b>' + esc(content) + '</b> để nhà trường tự động đối soát. Chuyển sai nội dung có thể làm chậm việc xác nhận.</span></div>' +
      '<div class="field"><label for="phFromBank">Bạn chuyển từ ngân hàng</label><select class="ctl" id="phFromBank">' + BANKS.map((b) => '<option>' + esc(b) + '</option>').join('') + '</select></div>' +
      '</div>';
    dialog({
      title: 'Nộp tiền bằng chuyển khoản', width: '640px', body: body(),
      footer: btn({ label: 'Đóng', action: 'close' }) + btn({ label: 'Tôi đã chuyển khoản', icon: 'check', variant: 'primary', action: 'sent', id: 'phSent' }),
      onClose: onChange,
      onMount(d, close) {
        const drawQr = () => {
          $('#phQr', d).innerHTML = qrSvg(bank + '|' + acc + '|' + content + '|' + amount, 180);
          $('[data-copy-src="amt"]', d).textContent = money(amount);
        };
        const readAmt = () => {
          const part = $('input[name="phAmt"]:checked', d).value === 'part';
          $('#phPart', d).hidden = !part;
          let ok = true;
          if (part) {
            const v = parseMoney($('#phAmtIn', d).value); ok = v >= 10000 && v <= payable;
            $('#phAmtHelp', d).classList.toggle('err', !ok); $('#phAmtHelp', d).textContent = ok ? 'Tối thiểu 10.000 đ, tối đa ' + money(payable) + ' đ' : 'Số tiền phải từ 10.000 đ đến ' + money(payable) + ' đ';
            if (ok) amount = v;
          } else amount = payable;
          $('#phSent', d).disabled = !ok;
          if (ok) drawQr();
        };
        d.addEventListener('change', (e) => { if (e.target.name === 'phAmt') readAmt(); });
        d.addEventListener('input', (e) => { if (e.target.id === 'phAmtIn') readAmt(); });
        d.addEventListener('click', (e) => {
          const c = e.target.closest('[data-copy]');
          if (c) { const src = $('[data-copy-src="' + c.dataset.copy + '"]', d); const val = c.dataset.copy === 'amt' ? String(amount) : src.textContent; copyText(val, src); return; }
          const a = e.target.closest('[data-action="sent"]'); if (!a || a.disabled) return;
          const fromBank = $('#phFromBank', d).value;
          const list = D().bankTransfers || (D().bankTransfers = []);
          const n = list.reduce((m, t) => Math.max(m, Number(String(t.id).replace(/\D/g, '')) || 0), 0) + 1;
          const t = { id: 'bt' + n, roundId: r.id, time: TODAY + ' ' + nowTime(), amount, content, fromName: up(st.parent && st.parent.name), fromBank: BANK_CODE[fromBank] || fromBank,
            bankRef: 'FT2527' + String(Math.floor(Math.random() * 1e7)).padStart(7, '0'), status: 'cho-xu-ly', studentId: '', paymentId: '' };
          list.push(t); App.save();
          $('.dlg-body', d).innerHTML = '<div class="ph-done">' + icon('check-circle') + '<h3>Đã ghi nhận thông tin chuyển khoản</h3>' +
            '<p>Nhà trường sẽ xác nhận trong 1–2 ngày làm việc. Khi được xác nhận, phiếu thu điện tử sẽ có trong mục <b>Lịch sử nộp tiền</b>.</p>' +
            '<dl class="ph-dl"><dt>Học sinh</dt><dd>' + esc(st.name) + '</dd><dt>Đợt thu</dt><dd>' + esc(r.name) + '</dd><dt>Số tiền</dt><dd><b>' + money(amount) + ' đ</b></dd><dt>Nội dung</dt><dd><code>' + esc(content) + '</code></dd><dt>Thời gian</dt><dd>' + esc(t.time) + '</dd></dl></div>';
          $('.dlg-foot', d).innerHTML = btn({ label: 'Xem lịch sử', icon: 'clock', action: 'hist' }) + btn({ label: 'Xong', variant: 'primary', action: 'close' });
          $('[data-action="hist"]', d).addEventListener('click', () => { close(); App.go('/phu-huynh/lich-su'); });
        });
        readAmt();
      },
    });
  }

  // ---------- PH1 / PH2 — Học phí của con ----------
  let selKid = '';
  const noKids = (el, title) => { el.innerHTML = '<h1 class="view-title dark">' + esc(title) + '</h1><div class="note warning">Tài khoản của bạn chưa được liên kết với học sinh nào. Vui lòng liên hệ văn phòng nhà trường.</div>'; };

  frame('PH1', 'Học phí của con', '/phu-huynh', G);
  frame('PH2', 'Nộp tiền (QR)', '/phu-huynh?pay=r2', G);
  frame('PH3', 'Lịch sử nộp tiền', '/phu-huynh/lich-su', G);

  route('/phu-huynh', {
    title: 'Học phí của con', menu: 'ph-hoc-phi',
    render({ el, query, user }) {
      const kids = myKids(user); currentKids = kids;
      if (!kids.length) return noKids(el, 'Học phí của con');
      if (query.child && kids.some((k) => k.id === query.child)) selKid = query.child;
      if (!kids.some((k) => k.id === selKid)) selKid = kids[0].id;
      el.classList.add('ph-view');
      const yr = App.currentYear();

      const kidCard = (st) => {
        const t = childTotals(st.id);
        return '<button type="button" class="ph-kid' + (st.id === selKid ? ' on' : '') + '" data-kid="' + esc(st.id) + '" aria-pressed="' + (st.id === selKid) + '">' +
          '<span class="ph-av">' + esc(App.initials(st.name)) + '</span><span class="ph-kid-t"><b>' + esc(st.name) + '</b>' +
          '<span>Lớp ' + esc(className(st)) + ' · ' + esc(D().school.name) + '</span><span>Mã học sinh / mã thanh toán: <code>' + esc(st.code) + '</code></span></span>' +
          '<span class="ph-kid-due">' + (t.remaining > 0 ? '<em>Còn phải nộp</em><b>' + money(t.remaining) + ' đ</b>' : '<em>Đã nộp đủ</em>' + icon('check-circle')) + '</span></button>';
      };
      const lineRows = (st, r) => C().studentDue(st.id, r.id).lines.map((l) => '<tr><td><b>' + esc(l.name) + '</b><span class="ph-sub">' + l.qty + ' ' + esc(l.unit.toLowerCase()) + ' × ' + money(l.price) + (l.discount ? ' · Miễn giảm −' + money(l.discount) : '') + '</span></td>' +
        '<td class="num ph-c-qty">' + l.qty + ' ' + esc(l.unit.toLowerCase()) + ' × ' + money(l.price) + '</td><td class="num ph-c-disc">' + (l.discount ? '−' + money(l.discount) : '—') + '</td><td class="num">' + money(l.amount) + '</td></tr>').join('');
      const roundCard = (st, x) => {
        const { r, s } = x; const [lbl, tone] = PH_STATUS[s.status];
        const pend = pendingTx(st, r.id); const pSum = pend.reduce((a, t) => a + t.amount, 0);
        const payable = Math.max(0, s.remaining - pSum);
        const rc = receiptsOf(st.id, r.id).filter((p) => p.status !== 'da-huy');
        const open = isActive(x, st);
        return '<details class="card ph-round"' + (open ? ' open' : '') + '><summary class="ph-round-head"><span class="ph-round-t"><b>' + esc(r.name) + '</b><span class="muted">' + esc(monthLabel(r)) + '</span></span>' +
          '<span class="ph-round-r">' + badge(lbl, tone) + '<span class="ph-round-amt">' + (s.remaining ? '<em>Còn</em> ' + money(s.remaining) + ' đ' : money(s.due) + ' đ') + '</span>' + icon('angle-down', 'ph-chev') + '</span></summary>' +
          '<div class="ph-round-body">' +
          (r.notice ? '<div class="ph-notice">' + icon('bell') + '<span>Nhà trường đã gửi thông báo ngày <b>' + esc(r.notice.sentAt) + '</b>' + (r.notice.deadline ? ' · Hạn nộp <b>' + esc(r.notice.deadline) + '</b>' : '') + '</span></div>'
            : '<div class="ph-notice muted">' + icon('bell') + '<span>Nhà trường chưa gửi thông báo thu tiền cho đợt này.</span></div>') +
          '<table class="ph-lines"><thead><tr><th>Khoản thu</th><th class="num ph-c-qty">Số lượng × đơn giá</th><th class="num ph-c-disc">Miễn giảm</th><th class="num">Thành tiền (đ)</th></tr></thead><tbody>' + lineRows(st, r) + '</tbody>' +
          '<tfoot><tr><td>Tổng phải nộp</td><td class="ph-c-qty"></td><td class="ph-c-disc"></td><td class="num">' + money(s.due) + '</td></tr>' +
          '<tr class="ok"><td>Đã nộp</td><td class="ph-c-qty"></td><td class="ph-c-disc"></td><td class="num">' + money(s.paid) + '</td></tr>' +
          '<tr class="rem"><td>Còn phải nộp</td><td class="ph-c-qty"></td><td class="ph-c-disc"></td><td class="num">' + money(s.remaining) + '</td></tr></tfoot></table>' +
          (rc.length ? '<div class="ph-rcpts"><span class="muted">Phiếu thu:</span>' + rc.map((p) => '<button type="button" class="ph-chip" data-rcpt="' + esc(p.id) + '">' + icon('file-text-o') + esc(p.receiptNo) + ' · ' + esc(p.date.slice(0, 5)) + ' · ' + money(p.amount) + ' đ</button>').join('') + '</div>' : '') +
          pend.map((t) => '<button type="button" class="ph-pending" data-tx="' + esc(t.id) + '">' + icon('hourglass') + '<span>Đang chờ nhà trường xác nhận <b>' + money(t.amount) + ' đ</b><span class="muted"> · chuyển khoản lúc ' + esc(t.time) + '</span></span></button>').join('') +
          (payable > 0 ? '<div class="ph-round-act">' + btn({ label: pend.length ? 'Nộp thêm ' + money(payable) + ' đ' : 'Nộp tiền', icon: 'qrcode', variant: 'primary', attrs: { 'data-pay': r.id } }) + '</div>' : '') +
          '</div></details>';
      };
      const draw = () => {
        const st = student(selKid); const rounds = childRounds(st.id); const t = childTotals(st.id);
        const active = rounds.filter((x) => isActive(x, st)); const later = rounds.filter((x) => !isActive(x, st));
        el.innerHTML = '<div class="view-head"><h1 class="view-title dark">Học phí của con</h1><span class="grow"></span><span class="muted">Năm học ' + esc(yr ? yr.name : '') + '</span></div>' +
          '<div class="ph-kids" role="group" aria-label="Chọn con">' + kids.map(kidCard).join('') + '</div>' +
          '<div class="stats ph-stats">' + UI.stat({ label: 'Tổng phải nộp (đ)', value: money(t.due) }) + UI.stat({ label: 'Đã nộp (đ)', value: money(t.paid), tone: 'success' }) +
          UI.stat({ label: 'Còn phải nộp (đ)', value: money(t.remaining), tone: t.remaining ? 'warning' : 'success' }) + '</div>' +
          (rounds.length ? '' : '<div class="note">Chưa có khoản phải nộp nào trong năm học này.</div>') +
          (active.length ? '<h2 class="ph-sec">Đợt thu đang thu</h2><div class="ph-rounds">' + active.map((x) => roundCard(st, x)).join('') + '</div>' : '') +
          (later.length ? '<h2 class="ph-sec">Đợt thu sắp tới <span class="muted">· nhà trường chưa gửi thông báo</span></h2><div class="ph-rounds">' + later.map((x) => roundCard(st, x)).join('') + '</div>' : '');
      };
      el.addEventListener('click', (e) => {
        const k = e.target.closest('[data-kid]'); if (k) { selKid = k.dataset.kid; draw(); return; }
        const p = e.target.closest('[data-pay]'); if (p) { payDialog(student(selKid), getRound(p.dataset.pay), draw); return; }
        const rc = e.target.closest('[data-rcpt]'); if (rc) { const x = (D().payments || []).find((y) => y.id === rc.dataset.rcpt); if (x) receiptDialog(x); return; }
        const tx = e.target.closest('[data-tx]'); if (tx) { const x = (D().bankTransfers || []).find((y) => y.id === tx.dataset.tx); if (x) transferDialog(x); }
      });
      if (query.pay) {
        const r = getRound(query.pay);
        const kid = r && kids.find((k) => C().studentStatus(k.id, r.id).remaining - pendingSum(k, r.id) > 0);
        if (kid) selKid = kid.id;
        draw();
        try { history.replaceState(null, '', '#/phu-huynh'); } catch (e) { /* ignore */ }
        if (kid) payDialog(kid, r, draw); else toast('Không còn khoản nào cần nộp cho đợt thu này');
        return;
      }
      draw();
    },
  });

  // ---------- PH3 — Lịch sử nộp tiền ----------
  route('/phu-huynh/lich-su', {
    title: 'Lịch sử nộp tiền', menu: 'ph-lich-su',
    render({ el, user }) {
      const kids = myKids(user); currentKids = kids;
      if (!kids.length) return noKids(el, 'Lịch sử nộp tiền');
      el.classList.add('ph-view');
      let filter = '';
      const ids = new Set(kids.map((k) => k.id));
      const draw = () => {
        const shown = kids.filter((k) => !filter || k.id === filter);
        const items = [];
        (D().payments || []).filter((p) => ids.has(p.studentId) && (!filter || p.studentId === filter)).forEach((p) => items.push({ kind: 'p', key: sortKey(p.date, p.time), p, st: student(p.studentId) }));
        (D().bankTransfers || []).filter((t) => t.status === 'cho-xu-ly' || t.status === 'hoan-tien').forEach((t) => {
          const st = shown.find((k) => txOf(t, k)); if (st) items.push({ kind: 't', key: sortKey(t.time.slice(0, 10), t.time.slice(11)), t, st });
        });
        items.sort((a, b) => cmpDesc(a.key, b.key) || (a.kind === 't' ? -1 : 1));
        const valid = items.filter((x) => x.kind === 'p' && x.p.status !== 'da-huy');
        const pend = items.filter((x) => x.kind === 't' && x.t.status === 'cho-xu-ly');
        const row = (x) => {
          if (x.kind === 't') {
            const r = getRound(x.t.roundId) || {}; const refund = x.t.status === 'hoan-tien';
            return '<button type="button" class="ph-hist pending" data-tx="' + esc(x.t.id) + '"><span class="ph-hist-ic">' + icon(refund ? 'exchange' : 'hourglass') + '</span>' +
              '<span class="ph-hist-t"><b>' + (refund ? 'Chuyển khoản cần hoàn tiền' : 'Chuyển khoản chờ xác nhận') + '</b><span>' + esc(x.st.name) + ' · ' + esc(r.name || '') + '</span><span class="muted">' + esc(x.t.time) + ' · ' + esc(x.t.fromBank) + '</span></span>' +
              '<span class="ph-hist-r"><b>' + money(x.t.amount) + ' đ</b>' + badge(refund ? 'Cần hoàn tiền' : 'Chờ xác nhận', refund ? 'danger' : 'warning') + '</span></button>';
          }
          const p = x.p; const r = getRound(p.roundId) || {}; const void_ = p.status === 'da-huy';
          return '<button type="button" class="ph-hist' + (void_ ? ' void' : '') + '" data-rcpt="' + esc(p.id) + '"><span class="ph-hist-ic">' + icon(p.method === 'chuyen-khoan' ? 'institution' : 'money') + '</span>' +
            '<span class="ph-hist-t"><b>' + esc(p.receiptNo) + ' · ' + esc(METHOD[p.method] || '') + '</b><span>' + esc(x.st.name) + ' · ' + esc(r.name || '') + '</span><span class="muted">' + esc(p.date) + ' ' + esc(p.time) + ' · Người thu: ' + esc(p.collector || '') + '</span></span>' +
            '<span class="ph-hist-r"><b>' + (void_ ? '<s>' + money(p.amount) + ' đ</s>' : money(p.amount) + ' đ') + '</b>' + (void_ ? badge('Đã hủy', 'danger') : badge('Đã ghi nhận', 'success')) + '</span></button>';
        };
        el.innerHTML = '<div class="view-head"><h1 class="view-title dark">Lịch sử nộp tiền</h1></div>' +
          (kids.length > 1 ? '<div class="ph-filter" role="group" aria-label="Lọc theo con"><button type="button" class="ph-pill' + (!filter ? ' on' : '') + '" data-f="">Tất cả</button>' + kids.map((k) => '<button type="button" class="ph-pill' + (filter === k.id ? ' on' : '') + '" data-f="' + esc(k.id) + '">' + esc(k.name) + '</button>').join('') + '</div>' : '') +
          '<div class="stats ph-stats">' + UI.stat({ label: 'Số phiếu thu', value: String(valid.length) }) + UI.stat({ label: 'Tổng đã nộp (đ)', value: money(valid.reduce((s, x) => s + x.p.amount, 0)), tone: 'success' }) +
          UI.stat({ label: 'Chờ xác nhận (đ)', value: money(pend.reduce((s, x) => s + x.t.amount, 0)), tone: pend.length ? 'warning' : '' }) + '</div>' +
          '<div class="card ph-hist-list">' + (items.length ? items.map(row).join('') : '<div class="ph-empty muted">Chưa có giao dịch nộp tiền nào.</div>') + '</div>' +
          '<p class="muted ph-foot">Phiếu thu do nhà trường lập, không thể sửa. Nếu có sai sót, vui lòng liên hệ văn phòng nhà trường. Phiếu đã hủy không được tính vào số đã nộp.</p>';
      };
      el.addEventListener('click', (e) => {
        const f = e.target.closest('[data-f]'); if (f) { filter = f.dataset.f; draw(); return; }
        const rc = e.target.closest('[data-rcpt]'); if (rc) { const x = (D().payments || []).find((y) => y.id === rc.dataset.rcpt); if (x) receiptDialog(x); return; }
        const tx = e.target.closest('[data-tx]'); if (tx) { const x = (D().bankTransfers || []).find((y) => y.id === tx.dataset.tx); if (x) transferDialog(x); }
      });
      draw();
    },
  });
})();
