/* ==========================================================================
   /szolgaltatasok — the solutions, one line at a time (owner, 2026-11-14).

   The section reads like Apple Music's lyrics: the panel pins for the length
   of the section, the line the scroll has reached is lit, the others dim and
   soften by their distance from it, and the whole stack moves to the lit line
   with a staggered ease — the lines nearest the movement first. The work that
   belongs to the line sits beside it, and a blurred copy of that work glows
   behind the panel.

   Scroll, not time, is the song: the section is `--n` steps tall and each
   line owns one step. A line is still a link into its service page; focusing
   one with the keyboard scrolls the page to its step, so Tab walks the song.

   The static page is the design. Without this file, or for a reader who asked
   for reduced motion, the section stays six plain rows with every line lit
   and every work beside its line. This file only adds `is-live`, the glows,
   the arrows and the scrubber, and writes custom properties; the look is in
   page-services.css.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.querySelector('[data-lyrics]');
  if (!root || !window.requestAnimationFrame) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var panel = root.querySelector('.lyrics__panel');
  var items = Array.prototype.slice.call(root.querySelectorAll('.lyric'));
  var lines = items.map(function (li) { return li.querySelector('.lyric__line'); });
  var n = items.length;
  if (!panel || n < 2 || lines.indexOf(null) !== -1) return;

  var ARROW = '<svg class="lyric__arrow" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">' +
    '<path d="M3 13L13 3M13 3H5M13 3v8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  // How far each step of distance dims and softens a line. Index = distance.
  var OPACITY = [1, 0.4, 0.27, 0.16, 0.1];
  var BLUR = [0, 1.2, 2.2, 3.2, 4];
  var STAGGER = 55;   // ms between neighbouring lines as the stack moves

  root.style.setProperty('--n', n);
  root.classList.add('is-live');

  // The glow behind the panel: the work's narrowest variant, blurred anyway.
  var glows = items.map(function (li) {
    var g = document.createElement('div');
    g.className = 'lyrics__glow';
    g.setAttribute('aria-hidden', 'true');
    var img = li.querySelector('.lyric__media img');
    if (img) {
      var set = img.getAttribute('srcset');
      var src = set ? set.split(',')[0].trim().split(/\s+/)[0] : img.getAttribute('src');
      g.dataset.src = src;
    }
    panel.insertBefore(g, panel.firstChild);
    return g;
  });

  // The arrow rides on the line's last two letters, so it never wraps to a
  // row of its own (an empty row would open a gap in the stack). Only two:
  // the rest of the word stays breakable, which is what lets shell.js's
  // fit-words pass see a word too long for the screen
  // ("Suchmaschinenoptimierung" on a phone) and narrow the line.
  lines.forEach(function (h) {
    var a = h.querySelector('a');
    var text = a && a.lastChild;
    if (!text || text.nodeType !== 3) return;
    var t = text.nodeValue.replace(/\s+$/, '');
    var cut = Math.max(0, t.length - 2);
    text.nodeValue = t.slice(0, cut);
    var end = document.createElement('span');
    end.className = 'lyric__end';
    end.textContent = t.slice(cut);
    end.insertAdjacentHTML('beforeend', ARROW);
    a.appendChild(end);
  });

  var scrub = document.createElement('div');
  scrub.className = 'lyrics__scrub';
  scrub.setAttribute('aria-hidden', 'true');
  scrub.innerHTML = '<span class="lyrics__at">01</span><span class="lyrics__track"><span class="lyrics__fill"></span></span>' +
    '<span>' + (n < 10 ? '0' : '') + n + '</span>';
  panel.appendChild(scrub);
  var at = scrub.querySelector('.lyrics__at');
  var fill = scrub.querySelector('.lyrics__fill');

  var active = -1;
  var anchor = 0.5;
  var ticking = false;

  var pad = function (i) { return (i < 9 ? '0' : '') + (i + 1); };

  var readAnchor = function () {
    var v = parseFloat(getComputedStyle(panel).getPropertyValue('--anchor'));
    anchor = isNaN(v) ? 0.5 : v;
  };

  // Lights line `i`, moves the stack to it. `from` is the line lit before, so
  // the wave runs the way the song is going.
  var light = function (i, from) {
    var h = lines[i];
    var y = panel.clientHeight * anchor - (h.offsetTop + h.offsetHeight / 2);
    var forward = from === -1 || i > from;
    for (var k = 0; k < n; k++) {
      var d = Math.min(Math.abs(k - i), OPACITY.length - 1);
      // Moving on: the lines from the old one downwards follow one by one.
      // Moving back: the same, upwards. Lines behind the movement go at once.
      var order = (from === -1 || from === i) ? 0 : (forward ? k - Math.min(i, from) : Math.max(i, from) - k);
      var s = lines[k].style;
      s.setProperty('--y', y.toFixed(1) + 'px');
      s.setProperty('--o', OPACITY[d]);
      s.setProperty('--b', BLUR[d] + 'px');
      s.setProperty('--s', k === i ? 1 : 0.965);
      s.setProperty('--delay', Math.max(0, Math.min(order, 6)) * STAGGER + 'ms');
      lines[k].classList.toggle('is-on', k === i);
      items[k].classList.toggle('is-on', k === i);
      items[k].classList.toggle('is-past', k < i);
    }
    glows.forEach(function (g, k) {
      // The picture is fetched for the glow the first time it is needed.
      if (Math.abs(k - i) <= 1 && g.dataset.src) {
        g.style.backgroundImage = 'url("' + g.dataset.src + '")';
        delete g.dataset.src;
      }
      g.classList.toggle('is-on', k === i);
    });
    at.textContent = pad(i);
  };

  var travel = function () { return Math.max(1, root.offsetHeight - window.innerHeight); };

  var paint = function () {
    ticking = false;
    var p = Math.min(1, Math.max(0, -root.getBoundingClientRect().top / travel()));
    fill.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    var i = Math.min(n - 1, Math.floor(p * n));
    if (i !== active) {
      var from = active;
      active = i;
      light(i, from);
    }
  };
  var onScroll = function () {
    if (!ticking) { ticking = true; window.requestAnimationFrame(paint); }
  };

  // Fonts, the fit-words pass in shell.js and a resize all move the lines;
  // re-anchor without a wave.
  var relayout = function () {
    readAnchor();
    if (active >= 0) light(active, active);
  };
  var layoutTimer = 0;
  var later = function () { window.clearTimeout(layoutTimer); layoutTimer = window.setTimeout(relayout, 180); };

  // Tab walks the song: a focused line is brought to its step.
  items.forEach(function (li, k) {
    li.addEventListener('focusin', function () {
      if (k === active) return;
      var top = root.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, Math.round(top + ((k + 0.5) / n) * travel()));
    });
  });

  readAnchor();
  paint();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', later);
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(later);
    lines.forEach(function (l) { ro.observe(l); });
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
})();
