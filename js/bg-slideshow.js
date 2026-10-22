/* ============================================================
   站点背景轮播 · 2026-10-22（站点自有脚本，非主题源码）
   · 九张插画按顺序循环，交叉淡入淡出，不硬切
   · 首屏由 bg-slideshow.css 的 body::before 兜底，这里接管后淡出
   · 图片在 window.load 之后才挂载下载，不拖慢首屏
   · 标签页切到后台自动暂停，回到前台恢复
   ============================================================ */
(function () {
  'use strict';

  var IMAGES = [
    '/img/bg/bg-01.jpg', // 创世纪（圣光）
    '/img/bg/bg-02.jpg', // 金色雨中的仰望
    '/img/bg/bg-03.jpg', // 雪中红伞
    '/img/bg/bg-04.jpg', // 天顶壁画
    '/img/bg/bg-05.jpg', // 蒙娜丽莎
    '/img/bg/bg-06.jpg', // 雪中礼帽
    '/img/bg/bg-07.jpg', // 噩梦
    '/img/bg/bg-08.jpg', // 戴珍珠耳环
    '/img/bg/bg-09.jpg'  // 彼岸花
  ];

  var INTERVAL = 9000;   // 每张停留时长（毫秒）
  var FIRST_HOLD = 5000; // 首张停留略短，进站不久就能看到变化

  var host = null;
  var slides = [];
  var index = 0;
  var timer = null;
  var paused = false;
  var started = false;

  function ensureHost() {
    if (host && document.body.contains(host)) return host;
    host = document.getElementById('bg-slideshow');
    if (host) {
      slides = Array.prototype.slice.call(host.querySelectorAll('.bgs-slide'));
      return host;
    }
    host = document.createElement('div');
    host.id = 'bg-slideshow';
    host.setAttribute('aria-hidden', 'true');
    slides = IMAGES.map(function (src, i) {
      var d = document.createElement('div');
      d.className = 'bgs-slide';
      d.setAttribute('data-bgs-index', String(i));
      host.appendChild(d);
      return d;
    });
    document.body.appendChild(host);
    return host;
  }

  function paint(i) {
    if (!slides[i]) return;
    slides.forEach(function (s, k) {
      s.classList.toggle('is-on', k === i);
    });
    index = i;
  }

  function setImage(i) {
    var d = slides[i];
    if (!d || d.style.backgroundImage) return;
    d.style.backgroundImage = 'url("' + IMAGES[i] + '")';
  }

  function preloadAll() {
    // 直接给每一层挂背景图，浏览器会并行下载并缓存；opacity:0 不影响下载
    for (var i = 0; i < slides.length; i++) setImage(i);
  }

  function next() {
    if (paused || slides.length < 2) return;
    paint((index + 1) % slides.length);
  }

  function start(delay) {
    stop();
    timer = setTimeout(function () {
      next();
      start(INTERVAL);
    }, typeof delay === 'number' ? delay : INTERVAL);
  }

  function stop() {
    if (timer) { clearTimeout(timer); timer = null; }
  }

  function init() {
    if (started) return;
    if (!document.body) return;
    started = true;

    ensureHost();
    setImage(0);
    paint(0);

    // 等兜底层与第 1 张同图都画出来，再让兜底层淡出，肉眼看不到切换
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        document.body.classList.add('bgs-live');
      });
    });

    // 首屏优先：等 load 之后再补下其余八张
    if (document.readyState === 'complete') preloadAll();
    else window.addEventListener('load', preloadAll, { once: true });

    start(FIRST_HOLD);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      paused = true;
      stop();
    } else {
      paused = false;
      start(INTERVAL);
    }
  });

  // pjax 换页不会重跑 defer 脚本，这里确认容器还在、状态还活着
  document.addEventListener('pjax:complete', function () {
    started = false;
    init();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  // 手动控制入口，控制台可用：bgSlideshow.next() / bgSlideshow.goto(3) / bgSlideshow.pause(true)
  window.bgSlideshow = {
    images: IMAGES.slice(),
    next: next,
    goto: function (i) { if (i >= 0 && i < slides.length) { paint(i); start(INTERVAL); } },
    pause: function (flag) { paused = !!flag; if (paused) stop(); else start(INTERVAL); }
  };
})();
