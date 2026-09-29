/* Shared mock data + fee calculation helpers. Section owners are listed in README.md. */
(function () {
  'use strict';
  const { seed } = App;

  // Deterministic PRNG so every viewer sees the same sample data.
  let s = 20250905;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

  seed('school', { id: 'sch1', code: 'NBK', name: 'THPT Nguyễn Bỉnh Khiêm', address: '12 Lê Lợi, Phường Bến Thành, TP. Hồ Chí Minh', bank: 'BIDV', account: '0000000002' });

  // ---------- Năm học ----------
  seed('years', [
    { id: 'y2025', name: '2025-2026', start: '05/09/2025', end: '27/05/2026', schoolId: 'sch1',
      stages: [{ id: 'st1', name: 'Học Kì 1', start: '05/09/2025', end: '01/01/2026' }, { id: 'st2', name: 'Học Kì 2', start: '03/01/2026', end: '27/05/2026' }] },
    { id: 'y2026', name: '2026-2027', start: '05/09/2026', end: '28/05/2027', schoolId: 'sch1',
      stages: [{ id: 'st3', name: 'Học Kì 1', start: '05/09/2026', end: '10/01/2027' }, { id: 'st4', name: 'Học Kì 2', start: '11/01/2027', end: '28/05/2027' }] },
  ]);
  seed('currentYearId', 'y2025');

  // ---------- Danh mục dùng chung ----------
  seed('trainingSystems', [
    { id: 'ts1', code: 'CQ', name: 'Chính quy', note: 'Học sinh học chương trình chính quy' },
    { id: 'ts2', code: 'TC', name: 'Tích hợp', note: 'Chương trình tích hợp tiếng Anh' },
    { id: 'ts3', code: 'CLC', name: 'Chất lượng cao', note: 'Lớp chất lượng cao' },
  ]);
  seed('priorityGroups', [
    { id: 'pg1', code: 'HN', name: 'Hộ nghèo', discount: 100, note: 'Miễn 100% học phí' },
    { id: 'pg2', code: 'CN', name: 'Hộ cận nghèo', discount: 50, note: 'Giảm 50% học phí' },
    { id: 'pg3', code: 'TB', name: 'Con thương binh, liệt sĩ', discount: 100, note: 'Miễn 100% học phí' },
    { id: 'pg4', code: 'MC', name: 'Mồ côi cả cha lẫn mẹ', discount: 100, note: 'Miễn 100% học phí' },
    { id: 'pg5', code: 'DTTS', name: 'Dân tộc thiểu số', discount: 70, note: 'Giảm 70% học phí' },
  ]);
  seed('units', [
    { id: 'u1', code: 'THANG', name: 'Tháng' }, { id: 'u2', code: 'NGAY', name: 'Ngày' }, { id: 'u3', code: 'HK', name: 'Học kỳ' },
    { id: 'u4', code: 'QUY', name: 'Quý' }, { id: 'u5', code: 'NAM', name: 'Năm học' }, { id: 'u6', code: 'LAN', name: 'Lần' }, { id: 'u7', code: 'QUYEN', name: 'Quyển' },
  ]);

  // ---------- Khối & lớp (year 2025-2026) ----------
  const GRADES = [{ id: 'g10', name: 'Khối 10', level: 10 }, { id: 'g11', name: 'Khối 11', level: 11 }, { id: 'g12', name: 'Khối 12', level: 12 }];
  const CLASS_LIST = [
    ['10A1', 'g10', 'Nguyễn Thị Mai'], ['10A2', 'g10', 'Trần Văn Hùng'], ['10A3', 'g10', 'Lê Thị Hồng'], ['10A4', 'g10', 'Phạm Quốc Bảo'],
    ['11A1', 'g11', 'Võ Thị Thu'], ['11A2', 'g11', 'Đặng Minh Khoa'], ['11A3', 'g11', 'Huỳnh Thị Lan'],
    ['12A1', 'g12', 'Bùi Văn Tâm'], ['12A2', 'g12', 'Phan Thị Ngọc'],
  ];
  seed('grades', GRADES);
  seed('classes', () => CLASS_LIST.map(([name, gradeId, teacher]) => ({ id: 'c' + name, name, gradeId, yearId: 'y2025', teacher, room: 'P.' + name.replace('A', '0'), trainingSystemId: 'ts1', capacity: 35 })));

  // ---------- Học sinh (owner: hoc-sinh) ----------
  const HO = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý'];
  const DEM_NAM = ['Văn', 'Minh', 'Quốc', 'Đức', 'Gia', 'Hoàng', 'Thanh', 'Anh', 'Tuấn', 'Hữu'];
  const DEM_NU = ['Thị', 'Ngọc', 'Thu', 'Minh', 'Khánh', 'Bảo', 'Thanh', 'Mỹ', 'Phương', 'Gia'];
  const TEN_NAM = ['An', 'Bảo', 'Khang', 'Phúc', 'Huy', 'Khoa', 'Nam', 'Long', 'Quân', 'Duy', 'Giang', 'Hải', 'Tài', 'Trung', 'Việt', 'Sơn', 'Đạt', 'Kiên'];
  const TEN_NU = ['Anh', 'Trang', 'Vy', 'Hà', 'Ngân', 'Linh', 'Chi', 'My', 'Nhi', 'Thảo', 'Hân', 'Uyên', 'Yến', 'Trâm', 'Quỳnh', 'Hương', 'Lan', 'Mai'];
  const STREETS = ['Lê Lợi', 'Nguyễn Huệ', 'Hai Bà Trưng', 'Pasteur', 'Điện Biên Phủ', 'Cách Mạng Tháng 8', 'Võ Văn Tần', 'Nam Kỳ Khởi Nghĩa'];
  const WARDS = ['Phường Bến Thành', 'Phường Sài Gòn', 'Phường Tân Định', 'Phường Xuân Hòa', 'Phường Bàn Cờ'];
  seed('students', () => {
    const out = []; let n = 1;
    CLASS_LIST.forEach(([cls, gradeId]) => {
      const birthYear = 2025 - Number(gradeId.slice(1)) - 5;
      for (let i = 0; i < 30; i++) {
        const female = rnd() < 0.5;
        const ho = pick(HO);
        const name = ho + ' ' + pick(female ? DEM_NU : DEM_NAM) + ' ' + pick(female ? TEN_NU : TEN_NAM);
        const parentHo = rnd() < 0.7 ? ho : pick(HO);
        const code = 'HS' + (100000 + n);
        const dd = String(1 + Math.floor(rnd() * 28)).padStart(2, '0'); const mm = String(1 + Math.floor(rnd() * 12)).padStart(2, '0');
        out.push({
          id: 's' + n, code, name, gender: female ? 'Nữ' : 'Nam', dob: dd + '/' + mm + '/' + birthYear,
          classes: { y2025: 'c' + cls }, trainingSystemId: 'ts1', enrollYear: String(2025 - (Number(gradeId.slice(1)) - 10)),
          priorityId: rnd() < 0.06 ? pick(['pg1', 'pg2', 'pg3', 'pg5']) : '',
          idNumber: '0792' + String(Math.floor(rnd() * 1e8)).padStart(8, '0'), bhyt: rnd() < 0.8 ? 'HS4' + String(Math.floor(rnd() * 1e10)).padStart(10, '0') : '',
          address: { street: (1 + Math.floor(rnd() * 250)) + ' ' + pick(STREETS), ward: pick(WARDS), city: 'TP. Hồ Chí Minh' },
          parent: { name: parentHo + ' ' + pick(DEM_NAM) + ' ' + pick(TEN_NAM), relation: rnd() < 0.6 ? 'Bố' : 'Mẹ', phone: '09' + String(Math.floor(rnd() * 1e8)).padStart(8, '0'), email: '' },
          status: 'dang-hoc',
        });
        n++;
      }
    });
    // A few newly admitted students without a class yet (06e — Học sinh chưa xếp lớp)
    ['Trương Gia Hân', 'Lâm Minh Khôi', 'Tạ Ngọc Diệp', 'Châu Quốc Thịnh', 'Mai Thùy Dương'].forEach((name, i) => {
      out.push({ id: 's' + n, code: 'HS' + (100000 + n), name, gender: i % 2 ? 'Nam' : 'Nữ', dob: '1' + i + '/0' + (i + 3) + '/2010', classes: { y2025: '' }, trainingSystemId: 'ts1', enrollYear: '2025', priorityId: '', idNumber: '', bhyt: '', address: { street: '', ward: '', city: 'TP. Hồ Chí Minh' }, parent: { name: '', relation: 'Mẹ', phone: '', email: '' }, status: 'dang-hoc' });
      n++;
    });
    return out;
  });

  // ---------- Khoản thu (owner: khoan-thu) ----------
  // cycle: 'thang' | 'hoc-ky' | 'quy' | 'nam-hoc'; mandatory: every student pays; otherwise student must be registered (data.registrations).
  // price = base per-unit price (used by App.calc). Extra fields (07 — Danh sách khoản thu / 07b-f form):
  //   scope 'all' | 'grade:g10'; priceMode 'single' | 'multi' + prices [{name, price}] (price = first tier);
  //   vat (%); timing: month numbers (hoc-ky [HK I, HK II], quy [Q1..Q4], nam-hoc [m]); timingText for 'thang';
  //   flags: service, invoice, voucher, refundable, internal, track; invoiceRate (%).
  const FEE = (o) => Object.assign({ scope: 'all', priceMode: 'single', prices: [], vat: 0, timing: [], timingText: '', defaultQty: 1,
    service: false, invoice: true, voucher: true, refundable: false, internal: false, track: true, invoiceRate: 100 }, o);
  seed('feeItems', [
    FEE({ id: 'f1', code: 'HP2B', name: 'Học phí 2 buổi/ngày', group: 'Học phí', unitId: 'u1', cycle: 'thang', price: 300000, mandatory: true, discountable: true, timingText: 'Hàng tháng' }),
    FEE({ id: 'f2', code: 'BANTRU', name: 'Tiền ăn bán trú', group: 'Bán trú', unitId: 'u2', cycle: 'thang', price: 35000, mandatory: false, defaultQty: 22, discountable: false, timingText: 'Hàng tháng', service: true, invoice: false, refundable: true }),
    FEE({ id: 'f3', code: 'XEDD', name: 'Phí xe đưa đón', group: 'Dịch vụ', unitId: 'u1', cycle: 'thang', price: 450000, mandatory: false, discountable: false, timingText: 'Hàng tháng', service: true, refundable: true,
      priceMode: 'multi', prices: [{ name: 'Dưới 5 km', price: 450000 }, { name: 'Từ 5 đến 10 km', price: 600000 }, { name: 'Trên 10 km', price: 750000 }] }),
    FEE({ id: 'f4', code: 'BHTT', name: 'Bảo hiểm thân thể', group: 'Bảo hiểm', unitId: 'u5', cycle: 'nam-hoc', price: 200000, mandatory: false, discountable: false, timing: [9], voucher: false }),
    FEE({ id: 'f5', code: 'BHYT', name: 'Bảo hiểm y tế', group: 'Bảo hiểm', unitId: 'u5', cycle: 'nam-hoc', price: 500000, mandatory: true, discountable: false, timing: [9], invoice: false }),
    FEE({ id: 'f6', code: 'BBGV', name: 'Phí bồi bổ giáo viên', group: 'Học phí', unitId: 'u3', cycle: 'hoc-ky', price: 1000000, mandatory: true, discountable: true, timing: [8, 1] }),
    FEE({ id: 'f7', code: 'GUIXE', name: 'Phí gửi xe', group: 'Dịch vụ', unitId: 'u1', cycle: 'thang', price: 100000, mandatory: false, discountable: false, timingText: 'Hàng tháng', service: true, vat: 8 }),
    FEE({ id: 'f8', code: 'XEDIEN', name: 'Phí giữ xe đạp điện', group: 'Dịch vụ', unitId: 'u1', cycle: 'thang', price: 112000, mandatory: false, discountable: false, timingText: 'Hàng tháng', service: true, vat: 8 }),
    FEE({ id: 'f9', code: 'DOAN', name: 'Phí đoàn trường', group: 'Khác', unitId: 'u5', cycle: 'nam-hoc', price: 120000, mandatory: true, discountable: false, timing: [10], invoice: false, internal: true, track: false }),
    FEE({ id: 'f10', code: 'NUOC', name: 'Tiền nước uống', group: 'Dịch vụ', unitId: 'u1', cycle: 'thang', price: 50000, mandatory: true, discountable: false, timingText: 'Hàng tháng', service: true }),
  ]);

  // ---------- Đăng ký khoản thu (owner: khoan-thu) ----------
  // registrations[studentId] = [feeId, ...] for optional fees.
  seed('registrations', () => {
    const reg = {};
    (App.data.students || []).forEach((st, i) => {
      const r = [];
      if (i % 3 !== 0) r.push('f2');
      if (i % 5 === 0) r.push('f3');
      if (i % 2 === 0) r.push('f4');
      if (i % 4 === 1) r.push('f7');
      if (i % 6 === 2) r.push('f8');
      reg[st.id] = r;
    });
    return reg;
  });

  // ---------- Đợt thu (owner: dot-thu) ----------
  // items: [{feeId, qty}]; scope: 'all' | 'grade:g10' | 'class:c10A1'; status: 'chua-thu' | 'dang-thu' | 'da-khoa'
  seed('rounds', [
    { id: 'r1', yearId: 'y2025', month: '2025-09', name: 'Thu đầu năm 2025-2026', scope: 'all', status: 'dang-thu', createdAt: '01/09/2025',
      items: [{ feeId: 'f4', qty: 1 }, { feeId: 'f5', qty: 1 }, { feeId: 'f6', qty: 1 }, { feeId: 'f9', qty: 1 }] },
    { id: 'r2', yearId: 'y2025', month: '2025-09', name: 'Thu tiền tháng 09/2025', scope: 'all', status: 'dang-thu', createdAt: '01/09/2025',
      items: [{ feeId: 'f1', qty: 1 }, { feeId: 'f2', qty: 22 }, { feeId: 'f3', qty: 1 }, { feeId: 'f7', qty: 1 }, { feeId: 'f8', qty: 1 }, { feeId: 'f10', qty: 1 }] },
    { id: 'r3', yearId: 'y2025', month: '2025-10', name: 'Thu tiền tháng 10/2025', scope: 'all', status: 'chua-thu', createdAt: '28/09/2025',
      items: [{ feeId: 'f1', qty: 1 }, { feeId: 'f2', qty: 21 }, { feeId: 'f3', qty: 1 }, { feeId: 'f7', qty: 1 }, { feeId: 'f8', qty: 1 }, { feeId: 'f10', qty: 1 }] },
    // Extra rounds so the month list looks like Figma 10 (08/2025 … 05/2026). No payments are seeded for them.
    { id: 'r4', yearId: 'y2025', month: '2025-08', name: 'Thu nhập học khối 10', scope: 'grade:g10', status: 'da-khoa', createdAt: '15/08/2025',
      items: [{ feeId: 'f5', qty: 1 }, { feeId: 'f9', qty: 1 }] },
    { id: 'r5', yearId: 'y2025', month: '2025-09', name: 'Thu phí xe đưa đón khối 12', scope: 'grade:g12', status: 'chua-thu', createdAt: '05/09/2025',
      items: [{ feeId: 'f3', qty: 1 }, { feeId: 'f7', qty: 1 }] },
    { id: 'r6', yearId: 'y2025', month: '2025-11', name: 'Thu tiền tháng 11/2025', scope: 'all', status: 'chua-thu', createdAt: '28/10/2025',
      items: [{ feeId: 'f1', qty: 1 }, { feeId: 'f2', qty: 20 }, { feeId: 'f3', qty: 1 }, { feeId: 'f7', qty: 1 }, { feeId: 'f8', qty: 1 }, { feeId: 'f10', qty: 1 }] },
    { id: 'r7', yearId: 'y2025', month: '2025-12', name: 'Thu tiền tháng 12/2025', scope: 'all', status: 'chua-thu', createdAt: '27/11/2025',
      items: [{ feeId: 'f1', qty: 1 }, { feeId: 'f2', qty: 22 }, { feeId: 'f3', qty: 1 }, { feeId: 'f7', qty: 1 }, { feeId: 'f8', qty: 1 }, { feeId: 'f10', qty: 1 }] },
    { id: 'r8', yearId: 'y2025', month: '2025-12', name: 'Thu bồi bổ giáo viên học kỳ 2', scope: 'all', status: 'chua-thu', createdAt: '27/11/2025',
      items: [{ feeId: 'f6', qty: 1 }] },
    { id: 'r9', yearId: 'y2025', month: '2026-01', name: 'Thu tiền tháng 01/2026', scope: 'all', status: 'chua-thu', createdAt: '26/12/2025',
      items: [{ feeId: 'f1', qty: 1 }, { feeId: 'f2', qty: 18 }, { feeId: 'f3', qty: 1 }, { feeId: 'f7', qty: 1 }, { feeId: 'f8', qty: 1 }, { feeId: 'f10', qty: 1 }] },
  ]);
  // Optional round fields written by dot-thu: adhoc:true (tab "Thu không đăng ký trước"), notice:{sentAt, count, channels, deadline}.
  // Per-round overrides for a single student: roundOverrides[roundId][studentId] = {add:[feeId], remove:[feeId]}
  seed('roundOverrides', {});

  // ---------- Calculation helpers (shared by dot-thu and thu-tien) ----------
  const fee = (id) => (App.data.feeItems || []).find((f) => f.id === id);
  const unitName = (id) => ((App.data.units || []).find((u) => u.id === id) || {}).name || '';
  const classOf = (st, yearId) => (App.data.classes || []).find((c) => c.id === (st.classes || {})[yearId || App.data.currentYearId]);
  function inScope(st, round) {
    const cls = classOf(st, round.yearId); if (!cls) return false;
    if (!round.scope || round.scope === 'all') return true;
    const [kind, id] = round.scope.split(':');
    return kind === 'grade' ? cls.gradeId === id : cls.id === id;
  }
  function discountRate(st, f) {
    if (!st.priorityId || !f.discountable) return 0;
    const pg = (App.data.priorityGroups || []).find((p) => p.id === st.priorityId); return pg ? pg.discount / 100 : 0;
  }
  // Lines a student owes in a round (before payments).
  function studentDue(studentId, roundId) {
    const st = (App.data.students || []).find((x) => x.id === studentId);
    const round = (App.data.rounds || []).find((r) => r.id === roundId);
    if (!st || !round || !inScope(st, round)) return { lines: [], total: 0 };
    const reg = (App.data.registrations || {})[studentId] || [];
    const ov = ((App.data.roundOverrides || {})[roundId] || {})[studentId] || { add: [], remove: [] };
    const lines = [];
    round.items.forEach((it) => {
      const f = fee(it.feeId); if (!f) return;
      const applies = (f.mandatory || reg.includes(f.id) || ov.add.includes(f.id)) && !ov.remove.includes(f.id);
      if (!applies) return;
      const gross = f.price * (it.qty || 1);
      const disc = Math.round(gross * discountRate(st, f));
      lines.push({ feeId: f.id, name: f.name, unit: unitName(f.unitId), qty: it.qty || 1, price: f.price, gross, discount: disc, amount: gross - disc });
    });
    return { lines, total: lines.reduce((t, l) => t + l.amount, 0) };
  }
  function paid(studentId, roundId) {
    return (App.data.payments || []).filter((p) => p.studentId === studentId && p.roundId === roundId && p.status !== 'da-huy').reduce((t, p) => t + p.amount, 0);
  }
  // {due, paid, remaining, status:'chua-thu'|'mot-phan'|'da-thu'|'khong-thu'}
  function studentStatus(studentId, roundId) {
    const due = studentDue(studentId, roundId).total; const p = paid(studentId, roundId); const remaining = Math.max(0, due - p);
    return { due, paid: p, remaining, status: due === 0 ? 'khong-thu' : p === 0 ? 'chua-thu' : remaining > 0 ? 'mot-phan' : 'da-thu' };
  }
  function roundStudents(roundId) {
    const round = (App.data.rounds || []).find((r) => r.id === roundId); if (!round) return [];
    return (App.data.students || []).filter((st) => inScope(st, round));
  }
  function roundSummary(roundId) {
    let due = 0, p = 0; const counts = { 'chua-thu': 0, 'mot-phan': 0, 'da-thu': 0, 'khong-thu': 0 };
    roundStudents(roundId).forEach((st) => { const x = studentStatus(st.id, roundId); due += x.due; p += x.paid; counts[x.status]++; });
    return { due, paid: p, remaining: Math.max(0, due - p), counts, students: roundStudents(roundId).length };
  }
  const STATUS_LABEL = { 'chua-thu': ['Chưa thu', ''], 'mot-phan': ['Thu một phần', 'warning'], 'da-thu': ['Đã thu', 'success'], 'khong-thu': ['Không phải thu', ''] };

  App.calc = { fee, unitName, classOf, inScope, studentDue, paid, studentStatus, roundStudents, roundSummary, STATUS_LABEL };

  // ---------- Thu tiền & phiếu thu (owner: thu-tien) ----------
  // payments: one confirmed collection = one receipt. lines: [{feeId, amount}]
  // Optional fields: transferId (bank transfer it came from), cancelReason / cancelledAt / cancelledBy (status 'da-huy').
  seed('payments', () => {
    const out = []; let no = 1;
    const hm = (h, m) => String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    const add = (p) => { out.push(Object.assign({ id: 'p' + no, receiptNo: 'PT' + String(no).padStart(5, '0'), roundId: 'r2', collector: 'Thị Hà Doãn', note: '', status: 'da-ghi-nhan', bankRef: '' }, p)); no++; };
    const studs = (App.data.students || []).filter((x) => x.classes.y2025);
    const partial = [];
    studs.forEach((st, i) => {
      if (i % 9 === 0 || i % 9 === 4) return; // chưa thu
      const due = App.calc.studentDue(st.id, 'r2');
      const full = i % 9 !== 2 && i % 9 !== 7; // thu một phần
      let remaining = full ? due.total : Math.round(due.total * 0.5 / 1000) * 1000;
      let lines = [];
      due.lines.forEach((l) => { const a = Math.min(l.amount, remaining); if (a > 0) { lines.push({ feeId: l.feeId, amount: a }); remaining -= a; } });
      const day = 8 + (i % 12);
      const method = i % 3 === 0 ? 'chuyen-khoan' : 'tien-mat';
      // PT00019 is the first of two receipts for its student (figma 13.2 shows a payment history)
      if (no === 19 && lines.length > 1) { partial.push({ st, lines: lines.slice(1), day: day + 9 }); lines = lines.slice(0, 1); }
      else if (!full && i % 4 === 1) partial.push({ st, lines: null, day: day + 6 });
      add({ studentId: st.id, lines, amount: lines.reduce((t, l) => t + l.amount, 0), method,
        date: String(day).padStart(2, '0') + '/09/2025', time: hm(8 + (i % 10), (i * 7) % 60),
        payer: st.parent.name, bankRef: method === 'chuyen-khoan' ? 'FT25' + String(250900000 + i * 37) : '' });
    });
    // Second (later) collections: multiple partial payments per student, each with its own receipt.
    partial.forEach(({ st, lines }, k) => {
      if (!lines) {
        const paidBy = {}; out.filter((p) => p.studentId === st.id).forEach((p) => p.lines.forEach((l) => (paidBy[l.feeId] = (paidBy[l.feeId] || 0) + l.amount)));
        let budget = 200000 + (k % 3) * 100000; lines = [];
        App.calc.studentDue(st.id, 'r2').lines.forEach((l) => { const a = Math.min(l.amount - (paidBy[l.feeId] || 0), budget); if (a > 0) { lines.push({ feeId: l.feeId, amount: a }); budget -= a; } });
      }
      if (!lines.length) return;
      add({ studentId: st.id, lines, amount: lines.reduce((t, l) => t + l.amount, 0), method: k % 2 ? 'chuyen-khoan' : 'tien-mat',
        date: String(20 + Math.floor(k * 7 / partial.length)).padStart(2, '0') + '/09/2025', time: hm(8 + ((k * 3) % 9), (k * 13) % 60), payer: st.parent.name,
        bankRef: k % 2 ? 'FT25' + String(252600000 + k * 91) : '' });
    });
    // A receipt that was cancelled (collected for the wrong student) — kept for audit, excluded from all totals.
    const wrong = studs[9];
    const wl = App.calc.studentDue(wrong.id, 'r2').lines.slice(0, 2).map((l) => ({ feeId: l.feeId, amount: l.amount }));
    add({ studentId: wrong.id, lines: wl, amount: wl.reduce((t, l) => t + l.amount, 0), method: 'tien-mat', date: '27/09/2025', time: '10:12', payer: wrong.parent.name,
      status: 'da-huy', cancelReason: 'Thu nhầm học sinh, đã hoàn tiền mặt cho phụ huynh', cancelledAt: '27/09/2025 10:40', cancelledBy: 'Thị Hà Doãn' });
    return out;
  });

  // Incoming transfers to the school account (BIDV 0000000002), waiting to be reconciled (12.3).
  // status: 'cho-xu-ly' (pending) | 'da-khop' (confirmed → paymentId) | 'hoan-tien' (to refund)
  seed('bankTransfers', () => {
    const studs = (App.data.students || []).filter((x) => x.classes.y2025);
    const open = studs.filter((st) => App.calc.studentStatus(st.id, 'r2').status !== 'da-thu');
    const up = (s) => App.data && s ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toUpperCase() : '';
    const rem = (st) => App.calc.studentStatus(st.id, 'r2').remaining;
    const t = (id, st, amount, content, time, fromName, fromBank, roundId) => ({ id, roundId: roundId || 'r2', time, amount, content, fromName: fromName || up(st.parent.name), fromBank, bankRef: 'FT2526' + id.replace(/\D/g, '').padStart(7, '0'), status: 'cho-xu-ly', studentId: '', paymentId: '' });
    const [a, b, c, d, e, f, g] = [open[0], open[3], open[5], open[8], open[11], open[14], open[17]];
    return [
      t('bt1', a, rem(a), 'HP-' + a.code + '-T09', '27/09/2025 08:42', '', 'VCB'),
      t('bt2', b, rem(b), 'HP-' + b.code + '-T09 ' + up(b.name), '27/09/2025 09:15', '', 'TCB'),
      t('bt3', c, Math.round(rem(c) / 2 / 1000) * 1000, 'HP-' + c.code + '-T09 NOP TRUOC MOT PHAN', '27/09/2025 11:47', '', 'MB'),
      t('bt4', d, rem(d), up(d.parent.name) + ' CHUYEN TIEN HOC', '28/09/2025 14:02', '', 'ACB'),
      t('bt5', e, rem(e) + 88000, 'HP-' + e.code + '-T09', '28/09/2025 20:15', '', 'VPB'),
      t('bt6', f, rem(f), 'HOC PHI CON ' + up(f.name) + ' ' + ((App.calc.classOf(f) || {}).name || ''), '29/09/2025 07:31', '', 'BIDV'),
      t('bt7', g, rem(g), 'HP-' + g.code + '-T09', '29/09/2025 08:05', '', 'VCB'),
    ];
  });

})();
