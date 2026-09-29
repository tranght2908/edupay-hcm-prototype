// Inline every local css/js referenced by index.html into dist/EduPay.html (single-file artifact).
const fs = require('fs'), path = require('path');
const root = __dirname;
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="(?!https?:)([^"]+)">/g, (_, p) => '<style>\n' + fs.readFileSync(path.join(root, p), 'utf8') + '\n</style>');
html = html.replace(/<script src="(?!https?:)([^"]+)"><\/script>/g, (_, p) => '<script>\n' + fs.readFileSync(path.join(root, p), 'utf8').replace(/<\/script/gi, '<\/script') + '\n</script>');
// Artifact publishing adds its own doctype/html/head/body skeleton.
html = html.replace(/<!doctype html>\s*/i, '').replace(/<\/?html[^>]*>\s*/gi, '').replace(/<\/?head>\s*/gi, '').replace(/<\/?body>\s*/gi, '')
  .replace(/<meta charset="utf-8">\s*/i, '').replace(/<meta name="viewport"[^>]*>\s*/i, '');
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'EduPay.html'), html);
console.log('dist/EduPay.html', (html.length / 1024).toFixed(0) + ' KB');
