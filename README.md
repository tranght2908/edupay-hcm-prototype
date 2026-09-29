# EduPay HCM — clickable prototype

Built from Figma file `FJfelvO2aDwEx73OOaXUO5` (page "School Fee Design System", 1440×900 frames, Jmix/Vaadin Aura look).
Plain HTML/CSS/JS, no build step for development. `node build.js` inlines everything into `dist/EduPay.html` (the published artifact).

Dev server: `npx http-server -p 5178 -c-1 .` → http://localhost:5178/index.html

## Files & ownership

| File | Owner | Contents |
|---|---|---|
| `css/base.css`, `js/core.js`, `js/icons.js`, `index.html`, `build.js` | lead | tokens, shell, router, UI helpers — **do not edit**; ask lead if you need a new shared helper |
| `js/data.js` | lead; section owners may edit **only their section** | shared mock data + `App.calc` |
| `screens/common.js` | lead | home `/`, 404, placeholders |
| `screens/danh-muc.{js,css}` | group A | Năm học, Khối & lớp, Hệ đào tạo, Diện ưu tiên, Đơn vị tính |
| `screens/hoc-sinh.{js,css}` | group B | Danh sách học sinh + wizard + xếp lớp |
| `screens/khoan-thu.{js,css}` | group C | Khoản thu, Đăng ký khoản thu |
| `screens/dot-thu.{js,css}` | group D | Đợt thu, Tổng quan đợt thu, Thông báo thu tiền |
| `screens/thu-tien.{js,css}` | group E | Thu tiền, Đối soát, Phiếu thu |

Screen files are loaded in the order above, after `data.js`. Wrap each file in an IIFE.

## Screen contract

```js
App.frame('01b', 'Năm học / Chi tiết', '/nam-hoc/y2025', 'Năm học & lớp');   // index entry → cog menu "Danh sách màn hình"
App.route('/nam-hoc/:id', {
  title: 'Thông tin năm học',   // browser tab
  menu: 'nam-hoc',              // sidebar item id to highlight (see App.MENU in core.js)
  render(ctx) {                 // ctx = {el, params, query, path, go, data, save, year}
    ctx.el.innerHTML = '...';   // ctx.el is the .view container (flex column, gap 12px)
    // bind events on ctx.el (use el.onclick delegation or addEventListener on children)
  },
});
```
- Every Figma frame must have an `App.frame(code, name, path, group)` entry whose path opens the screen **in the state shown in Figma** (use query params or sub-routes for dialog-open states, e.g. `/dot-thu?dialog=new` or `/hoc-sinh/them?step=2`). Query strings work: `ctx.query`.
- Navigate with `App.go('/path')`. Re-render current route with `App.render()`.
- Persist changes: mutate `App.data.*` then `App.save()` (localStorage, per viewer).
- Current working year: `ctx.year` (`App.currentYear()`), id in `App.data.currentYearId`. Header has a year switcher; `y2025` has data, `y2026` is the empty new year.

## UI helpers (window.UI) — use these, don't re-implement
- `icon(name)` → inline Vaadin SVG (`vaadin:<name>` names, e.g. `plus`, `pencil`, `trash`, `search`, `ellipsis-dots-h`, `angle-down`, `calendar`, `users`, `money`, `qrcode`, `print`, `check`, `close`, `exchange`, `bell`, `paperplane`, `file-text-o`). 656 icons in `js/icons.js`.
- `btn({label, icon, variant:'primary'|'tertiary'|'danger'|'primary danger'|'success primary', action, id, disabled, aria, cls, attrs})`
- `field({label, id, name, type:'text'|'number'|'money'|'date'|'select'|'textarea'|'readonly', value, options, required, placeholder, error, help, icon})` — date values are `dd/mm/yyyy` strings; `formValues(root)` reads them back in the same format; money fields return numbers.
- `search({id, placeholder, value})`, `validate(root)` (marks empty `required` fields, returns bool).
- `grid({columns:[{key,label,width,align,render(row,i)}], rows, rowKey, selectable:'single'|'multi', selected, striped, fill, maxHeight, empty, foot, actions(row), clickable, id})` + `bindGrid(el, {selectable, selected, onSelect(ids), onRowClick(key,e), onRowDblClick(key)})`.
- `crudList({el, title, columns, rows:()=>[], onCreate, onEdit(id), onRemove(ids), searchKeys})` — the standard Jmix list view (Filter, Refresh, Create/Edit/Remove, pager, grid). Use it for every simple "Danh sách" screen.
- `dialog({title, body, footer, width, large, rawBody, onMount(dlgEl, close), onClose})`, `confirm({title, message, okLabel, danger})` → Promise<bool>, `menu(anchorEl, items)`, `toast(msg, 'success'|'danger')`.
- `stat({label, value, tone:'accent'|'success'|'warning'|'danger'})` inside `<div class="stats">`; `badge(text, tone)`.
- Format: `money(n)` → `1.284.500.000`; `parseMoney`, `fmtDate`, `norm` (accent-insensitive search), `esc` (ALWAYS escape data in HTML).

## CSS classes available (css/base.css)
`.view-title` (24px blue title; add `.dark` for black title used on later screens), `.view-head`, `.toolbar`, `.row`, `.stack`, `.split` (set `--split-left`), `.card`, `.card-head`, `.card-pad`, `.section-title`, `.stats`/`.stat`, `.badge`, `.note(.warning|.danger|.success)`, `.tabs`/`.tab.active`, `.vtabs`/`.vtab`, `.tree`/`.tree-item(.l1|.l2|.active)` + `.cnt`, `.form-grid` (`--cols`), `.span-2`, `.span-all`, `.chk`, `.radio-row`, `.steps`/`.step(.active|.done)` + `.dot`, `.dlg-*`, `.grid-foot`, `.muted`, `.num`.

Group CSS goes in `screens/<group>.css`, prefixed with a group class (e.g. `.kt-…`). **Colors only via the CSS variables in base.css** (light + dark themes are defined there). No external requests besides Google Fonts.

## Layout rules
- Designs are 1440×900; main content area is ~1164px wide. Recreate layout with flex/grid, not absolute positioning.
- Must not break at narrow widths: wide tables live inside `.ui-grid-wrap` (scrolls), multi-column layouts collapse (`.split` and `.form-grid` already do at ≤900px).
- Copy is Vietnamese, taken from the Figma frames. Use data from `App.data`, not hardcoded rows, so screens stay consistent with each other.
