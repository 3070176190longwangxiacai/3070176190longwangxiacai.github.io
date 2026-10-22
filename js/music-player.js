/* ============================================================
   侧栏音乐盒 · 2026-10-22（站点自有脚本，不改主题源码）
   ------------------------------------------------------------
   卡片插在侧栏「头像卡 → 公告栏 → 【音乐盒】 → 日历」中间，
   也就是紧贴日历卡上方；文章页没有日历卡，就追加到侧栏末尾。

   结构上分两层：
     · <audio id="mp-audio"> 挂在 body 上 —— pjax 换页只换 #body-wrap，
       内核不会被销毁，所以点进别的文章音乐不会断。
     · 侧栏那张卡片只是「遥控器」，pjax:complete 后重建、再按内核状态回填 UI。

   歌曲信息取自 mp3 自带的 ID3 标签（歌名/歌手/专辑都是真的，不是从文件名猜的）。
   ============================================================ */
(function () {
  'use strict';

  var TRACKS = [
    { src: '/music/01-bu-ying-gai.mp3',        title: '不应该',                artist: '陈绮贞',           album: '吉他手' },
    { src: '/music/02-xiao-chen-ai.mp3',       title: '小尘埃',                artist: '陈绮贞',           album: '吉他手' },
    { src: '/music/03-jing-jing-de-sheng-huo.mp3', title: '静静的生活',        artist: '陈绮贞',           album: '华丽的冒险' },
    { src: '/music/04-xiao-bu-wu-qu.mp3',      title: '小步舞曲',              artist: '陈绮贞',           album: '精选 1998-2005' },
    { src: '/music/05-do-you-like-me.mp3',     title: 'Do You Like Me?',      artist: 'Daniel Caesar',    album: 'Do You Like Me? (Explicit)' },
    { src: '/music/06-no-more-sweet-music.mp3', title: 'No More Sweet Music',  artist: 'Hooverphonic',     album: 'No More Sweet Music' },
    { src: '/music/07-color-your-night.mp3',   title: 'Color Your Night',     artist: 'Atlus Sound Team', album: 'P3 Reload OST' }
  ];

  /* 封面按约定自动找：/music/covers/ + 音频同名 + .jpg
     比如 01-bu-ying-gai.mp3 → /music/covers/01-bu-ying-gai.jpg
     放到目录里就生效，找不到就退回「歌手首字色块」，不用改代码。 */
  function coverOf(t) {
    if (t.cover) return t.cover;
    var base = t.src.split('/').pop().replace(/\.mp3$/i, '');
    return '/music/covers/' + base + '.jpg';
  }

  var AUDIO_ID = 'mp-audio';
  var CARD_ID = 'aside-music';

  var audioEl = null;
  var card = null;
  var coverOk = {};   // 只把确认加载成功的封面交给系统媒体面板，避免通知里出现破图

  /* ---------------- 音频内核（挂在 body，随页面存活） ---------------- */

  function getAudio() {
    if (audioEl && document.body.contains(audioEl)) return audioEl;
    audioEl = document.getElementById(AUDIO_ID);
    if (audioEl) return audioEl;

    audioEl = document.createElement('audio');
    audioEl.id = AUDIO_ID;
    audioEl.preload = 'none';
    audioEl.setAttribute('playsinline', '');
    audioEl.style.display = 'none';
    document.body.appendChild(audioEl);
    bindAudio(audioEl);
    return audioEl;
  }

  function curIndex() {
    var n = Number(getAudio().dataset.index);
    return Number.isFinite(n) && n >= 0 && n < TRACKS.length ? n : 0;
  }

  function bindAudio(a) {
    if (a.dataset.bound === '1') return;
    a.dataset.bound = '1';

    a.addEventListener('loadstart', function () { setBusy(true); });
    a.addEventListener('canplay', function () { setBusy(false); });

    a.addEventListener('play', function () { sync(); });
    a.addEventListener('pause', function () { sync(); });
    a.addEventListener('ended', function () { next(); });

    a.addEventListener('loadedmetadata', function () { syncTimes(); });
    a.addEventListener('timeupdate', function () { syncProgress(); });

    a.addEventListener('error', function () {
      setBusy(false);
      setStatus('这首歌加载失败了，检查一下 /music 里的文件是否还在');
    });
  }

  /* ---------------- 播放控制 ---------------- */

  function setTrack(i, autoplay) {
    var a = getAudio();
    i = ((i % TRACKS.length) + TRACKS.length) % TRACKS.length;
    var changed = a.dataset.index !== String(i);
    a.dataset.index = String(i);

    if (changed || !a.getAttribute('src')) {
      a.src = TRACKS[i].src;
      a.load();
    }
    renderNow();
    updateMediaSession();
    if (autoplay) play();
    else sync();
  }

  function play() {
    var a = getAudio();
    if (!a.getAttribute('src')) {
      setTrack(curIndex(), false);
    }
    var p = a.play();
    if (p && p.catch) {
      p.catch(function () {
        setBusy(false);
        setStatus('浏览器拦住了自动播放，再点一下播放键即可');
        sync();
      });
    }
  }

  function pause() { getAudio().pause(); }

  function toggle() {
    var a = getAudio();
    if (a.paused) play();
    else pause();
  }

  function next() { setTrack(curIndex() + 1, true); }
  function prev() { setTrack(curIndex() - 1, true); }

  /* ---------------- 卡片 UI ---------------- */

  function icon(path, size) {
    return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size +
      '" fill="currentColor" aria-hidden="true"><path d="' + path + '"/></svg>';
  }

  var ICON = {
    play: 'M8 5v14l11-7z',
    pause: 'M6 5h4v14H6zm8 0h4v14h-4z',
    prev: 'M6 6h2v12H6zm3.5 6l8.5 6V6z',
    next: 'M16 6h2v12h-2zM6 18l8.5-6L6 6z',
    list: 'M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z'
  };

  function initialOf(t) {
    var s = (t.artist || t.title || '?').trim();
    return s.charAt(0).toUpperCase();
  }

  function buildCard() {
    var aside = document.getElementById('aside-content');
    if (!aside) return false;

    var old = document.getElementById(CARD_ID);
    if (old) old.parentNode.removeChild(old);

    var el = document.createElement('div');
    el.className = 'card-widget card-music';
    el.id = CARD_ID;
    el.innerHTML =
      '<div class="item-headline">' +
        '<svg class="faa-tada icon" style="height:25px;width:25px;fill:currentColor;position:relative;top:5px" viewBox="0 0 24 24" aria-hidden="true">' +
          '<path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>' +
        '</svg>' +
        '<span style="font-weight:bold">音乐盒</span>' +
        '<button type="button" class="mp-btn mp-listbtn" style="margin-left:auto" aria-label="展开播放列表" title="播放列表">' +
          icon(ICON.list, 18) +
        '</button>' +
      '</div>' +
      '<div class="mp-now">' +
        '<button type="button" class="mp-cover" aria-label="播放或暂停">' +
          '<span class="mp-initial"></span>' +
          '<span class="mp-eq" aria-hidden="true"><i></i><i></i><i></i></span>' +
        '</button>' +
        '<div class="mp-meta">' +
          '<div class="mp-title">—</div>' +
          '<div class="mp-artist">—</div>' +
        '</div>' +
      '</div>' +
      '<div class="mp-bar" role="slider" aria-label="播放进度" tabindex="0"><div class="mp-bar-fill"></div></div>' +
      '<div class="mp-times"><span class="mp-t-cur">0:00</span><span class="mp-t-dur">0:00</span></div>' +
      '<div class="mp-ctrl">' +
        '<button type="button" class="mp-btn mp-prev" aria-label="上一首">' + icon(ICON.prev, 20) + '</button>' +
        '<button type="button" class="mp-btn mp-play" aria-label="播放">' +
          '<span class="mp-i-play">' + icon(ICON.play, 18) + '</span>' +
          '<span class="mp-i-pause" style="display:none">' + icon(ICON.pause, 18) + '</span>' +
        '</button>' +
        '<button type="button" class="mp-btn mp-next" aria-label="下一首">' + icon(ICON.next, 20) + '</button>' +
      '</div>' +
      '<ol class="mp-list">' +
        TRACKS.map(function (t, i) {
          return '<li class="mp-item" data-i="' + i + '">' +
            '<span class="mp-idx">' + (i + 1) + '</span>' +
            '<span class="mp-item-title">' + esc(t.title) + '</span>' +
            '<span class="mp-item-artist">' + esc(t.artist) + '</span>' +
            '</li>';
        }).join('') +
      '</ol>';

    var cal = document.getElementById('aside-calendar');
    if (cal && cal.parentNode) cal.parentNode.insertBefore(el, cal);
    else aside.appendChild(el);

    card = el;
    bindCard(el);
    return true;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function bindCard(el) {
    var a = getAudio();

    el.querySelector('.mp-play').addEventListener('click', toggle);
    el.querySelector('.mp-prev').addEventListener('click', prev);
    el.querySelector('.mp-next').addEventListener('click', next);
    el.querySelector('.mp-cover').addEventListener('click', toggle);

    el.querySelector('.mp-listbtn').addEventListener('click', function () {
      el.classList.toggle('is-open');
      this.setAttribute('aria-label', el.classList.contains('is-open') ? '收起播放列表' : '展开播放列表');
    });

    el.querySelector('.mp-list').addEventListener('click', function (e) {
      var li = e.target.closest('.mp-item');
      if (!li) return;
      setTrack(Number(li.dataset.i), true);
    });

    var bar = el.querySelector('.mp-bar');
    function seek(e) {
      if (!a.duration) return;
      var r = bar.getBoundingClientRect();
      var ratio = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      a.currentTime = ratio * a.duration;
      syncProgress();
    }
    bar.addEventListener('click', seek);
    bar.addEventListener('keydown', function (e) {
      if (!a.duration) return;
      if (e.key === 'ArrowRight') { a.currentTime = Math.min(a.duration, a.currentTime + 5); syncProgress(); }
      if (e.key === 'ArrowLeft') { a.currentTime = Math.max(0, a.currentTime - 5); syncProgress(); }
    });
  }

  /* ---------------- UI 同步（每次重建卡片后都要能回填） ---------------- */

  function q(sel) { return card ? card.querySelector(sel) : null; }

  function renderNow() {
    if (!card) return;
    var t = TRACKS[curIndex()];
    var coverBtn = q('.mp-cover');

    q('.mp-title').textContent = t.title;
    q('.mp-artist').textContent = t.artist + (t.album ? ' · ' + t.album : '');

    var old = coverBtn.querySelector('img');
    if (old) old.parentNode.removeChild(old);

    var ini = coverBtn.querySelector('.mp-initial');
    ini.textContent = initialOf(t);
    ini.style.display = '';           // 先亮首字兜底，封面加载成功再收起，避免白块

    var img = document.createElement('img');
    img.alt = '';
    img.loading = 'lazy';
    img.addEventListener('load', function () {
      ini.style.display = 'none';
      coverOk[coverOf(t)] = true;
      updateMediaSession();
    });
    img.addEventListener('error', function () {
      if (img.parentNode) img.parentNode.removeChild(img);
      ini.style.display = '';
    });
    img.src = coverOf(t);
    coverBtn.insertBefore(img, ini);

    var items = card.querySelectorAll('.mp-item');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle('is-on', i === curIndex());
    }
    sync();
  }

  function sync() {
    if (!card) return;
    var a = getAudio();
    var playing = !a.paused && !!a.getAttribute('src');
    card.classList.toggle('is-playing', playing);

    var btn = q('.mp-play');
    if (btn) {
      btn.querySelector('.mp-i-play').style.display = playing ? 'none' : '';
      btn.querySelector('.mp-i-pause').style.display = playing ? '' : 'none';
      btn.setAttribute('aria-label', playing ? '暂停' : '播放');
    }
    syncTimes();
    syncProgress();
  }

  function fmt(sec) {
    if (!Number.isFinite(sec) || sec < 0) sec = 0;
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function syncTimes() {
    if (!card) return;
    var a = getAudio();
    var dur = q('.mp-t-dur');
    if (dur) dur.textContent = fmt(a.duration);
    var cur = q('.mp-t-cur');
    if (cur) cur.textContent = fmt(a.currentTime);
  }

  function syncProgress() {
    if (!card) return;
    var a = getAudio();
    var fill = q('.mp-bar-fill');
    if (fill && a.duration) fill.style.width = (a.currentTime / a.duration * 100).toFixed(2) + '%';
    var cur = q('.mp-t-cur');
    if (cur) cur.textContent = fmt(a.currentTime);
  }

  function setBusy(flag) {
    if (!card) return;
    var btn = q('.mp-play');
    if (btn) btn.classList.toggle('is-loading', !!flag);
  }

  function setStatus(msg) {
    if (!card) return;
    var el = q('.mp-artist');
    if (el) el.textContent = msg;
  }

  function updateMediaSession() {
    if (!('mediaSession' in navigator) || typeof window.MediaMetadata !== 'function') return;
    var t = TRACKS[curIndex()];
    var art = coverOf(t);
    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: t.title,
        artist: t.artist,
        album: t.album || '',
        artwork: coverOk[art] ? [{ src: art, sizes: '500x500', type: 'image/jpeg' }] : []
      });
      navigator.mediaSession.setActionHandler('play', play);
      navigator.mediaSession.setActionHandler('pause', pause);
      navigator.mediaSession.setActionHandler('previoustrack', prev);
      navigator.mediaSession.setActionHandler('nexttrack', next);
    } catch (e) { /* 老浏览器忽略 */ }
  }

  /* ---------------- 挂载 ---------------- */

  function mount() {
    getAudio();
    if (!buildCard()) return;
    // 首次挂载：内核还没有 src，选第 1 首但不自动播（浏览器也不允许无交互自动播）
    if (!getAudio().getAttribute('src')) setTrack(0, false);
    else { renderNow(); sync(); }  // 换页重挂：按内核现状回填
  }

  // 页面上还有别的播放器（八音盒页），谁播谁独占，避免两个声音叠在一起
  document.addEventListener('play', function (e) {
    if (!e.target || e.target.tagName !== 'AUDIO') return;
    if (e.target !== audioEl && audioEl) audioEl.pause();
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }

  document.addEventListener('pjax:complete', mount);

  // 控制台可用：mpPlayer.next() / mpPlayer.play() / mpPlayer.goto(2)
  window.mpPlayer = {
    tracks: TRACKS.slice(),
    play: play,
    pause: pause,
    next: next,
    prev: prev,
    goto: function (i) { setTrack(i, true); },
    audio: getAudio
  };
})();
