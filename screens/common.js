/* Home (00), 404 and menu entries that have no Figma design yet. */
(function () {
  'use strict';
  const { route, frame } = App;
  const { esc, placeholder } = UI;

  frame('00', 'Trang chủ Jmix', '/', 'Chung');

  route('/', {
    title: 'Trang chủ', menu: '',
    render({ el }) {
      el.innerHTML =
        '<div class="home">' +
        '<div class="home-text"><div class="home-rule"></div><h1>Quản lý học phí</h1></div>' +
        '<div class="home-mark" aria-hidden="true"><i class="pink"></i><i class="green"></i><i class="cyan"></i><i class="amber"></i></div>' +
        '</div>';
    },
  });

  route('/404', { title: 'Không tìm thấy', render({ el }) { placeholder(el, 'Không tìm thấy màn hình', 'Đường dẫn này không tồn tại trong prototype.'); } });

  const todo = [
    ['/chinh-sach-gia', 'chinh-sach-gia', 'Chính sách giá'],
    ['/mien-giam', 'mien-giam', 'Miễn giảm'],
    ['/nguoi-dung', 'nguoi-dung', 'Người dùng'],
    ['/phan-quyen', 'phan-quyen', 'Phân quyền'],
    ['/da-don-vi', 'da-don-vi', 'Đa đơn vị'],
    ['/cong-cu-du-lieu', 'cong-cu', 'Công cụ dữ liệu'],
  ];
  todo.forEach(([path, menu, title]) => route(path, { title, menu, render({ el }) { placeholder(el, title); } }));

  const css = document.createElement('style');
  css.textContent =
    '.home{flex:1;display:flex;align-items:center;justify-content:center;gap:clamp(40px,18vw,260px);flex-wrap:wrap;padding:40px 16px}' +
    '.home-rule{width:310px;max-width:100%;height:5px;border-radius:3px;background:var(--text-muted);opacity:.85}' +
    '.home h1{margin:36px 0 0;font-size:48px;font-weight:400;color:var(--text-muted);letter-spacing:-.01em}' +
    '.home-mark{position:relative;width:118px;height:118px}' +
    '.home-mark i{position:absolute;width:46px;height:46px;border:7px solid;border-radius:2px;mix-blend-mode:multiply}' +
    '.home-mark .pink{left:30px;top:8px;border-color:#ee1b5a}.home-mark .green{left:56px;top:31px;border-color:#23c07a}' +
    '.home-mark .cyan{left:31px;top:56px;border-color:#1fb9e0}.home-mark .amber{left:7px;top:31px;border-color:#fbb224}';
  document.head.appendChild(css);
  void esc;
})();
