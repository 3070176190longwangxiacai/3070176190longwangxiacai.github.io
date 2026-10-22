/*!
 * giscus-boot.js —— 保证 Giscus 在任何进入方式下都能挂载
 *
 * 【为什么需要】
 * 主题把 giscus 的初始化写在 layout/includes/third-party/comments/giscus.pug 的
 * 内联 <script> 里，而这段脚本位于 <div class="js-pjax"> 中。pjax 换页时
 * 只做 element.innerHTML = 新内容，通过 innerHTML 插入的 <script> 浏览器不会执行，
 * 所以「从首页点菜单进留言板」这条最常见路径上，评论区会是一个空壳；
 * 直接访问 /comments/ 或刷新才正常。
 *
 * 【做法】
 * pjax:complete 之后检查 #giscus-wrap：既没有 giscus 的 iframe、也没有 client.js
 * 标签时才补挂一次。首屏（内联脚本已经挂过）和 pjax 缓存命中的情况都会跳过，
 * 不会重复插入两个评论框。
 * 配置与 _config.fomalhaut.yml 的 giscus 段保持一致，改那边时记得同步这里。
 * 回滚：删掉本文件，并去掉 _config.fomalhaut.yml 里引用它的那一行即可。
 */
(function () {
  'use strict';

  var REPO = '3070176190longwangxiacai/3070176190longwangxiacai.github.io';
  var REPO_ID = 'R_kgDOVPkw4A';
  var CATEGORY_ID = 'DIC_kwDOVPkw4M4DJWVB';

  function ensureGiscus() {
    var wrap = document.getElementById('giscus-wrap');
    if (!wrap) return;
    if (wrap.querySelector('iframe.giscus-frame')) return;
    if (wrap.querySelector('script[src*="giscus.app"]')) return;

    var theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    var s = document.createElement('script');
    s.src = 'https://giscus.app/client.js';
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.setAttribute('data-repo', REPO);
    s.setAttribute('data-repo-id', REPO_ID);
    s.setAttribute('data-category-id', CATEGORY_ID);
    s.setAttribute('data-mapping', 'pathname');
    s.setAttribute('data-strict', '0');
    s.setAttribute('data-reactions-enabled', '1');
    s.setAttribute('data-emit-metadata', '0');
    s.setAttribute('data-input-position', 'top');
    s.setAttribute('data-theme', theme);
    s.setAttribute('data-lang', 'zh-CN');
    wrap.insertAdjacentElement('afterbegin', s);
  }

  document.addEventListener('pjax:complete', function () {
    setTimeout(ensureGiscus, 30);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureGiscus);
  } else {
    ensureGiscus();
  }

  window.giscusBoot = ensureGiscus;
})();
