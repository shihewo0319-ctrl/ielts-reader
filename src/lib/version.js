/* ============ 版本号唯一来源 ============
 * 改版本只改这里的 VERSION（package.json 版本保持同步即可，
 * 页面顶栏的 .version 胶囊由本模块自动填充，不再写死在 HTML 里）。
 */
export const VERSION = '1.4.3';

document.querySelectorAll('.version').forEach((el) => {
  el.textContent = 'v' + VERSION;
});
