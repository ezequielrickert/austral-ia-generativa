/* Slide viewer: drives the course's own reveal.js deck in a same-origin iframe
   and keeps the note card, the scrubber and the index in sync with it. */
(function () {
  "use strict";
  var S = window.Study, st = S.state, BASE = S.base;
  var root = document.getElementById("viewer");
  var classNum = +root.dataset.class;
  var frame = document.getElementById("deck-frame");
  var tabs = [].slice.call(document.querySelectorAll("[role=tab][data-deck]"));
  var scrubs = {}, indexes = {}, notes = {};
  document.querySelectorAll("[data-scrub]").forEach(function (el) { scrubs[el.dataset.scrub] = el; });
  document.querySelectorAll("[data-index]").forEach(function (el) { indexes[el.dataset.index] = el; });
  document.querySelectorAll(".note").forEach(function (el) { (notes[el.dataset.deck] = notes[el.dataset.deck] || [])[+el.dataset.i] = el; });
  var decks = Object.keys(scrubs);
  var tpMark = document.getElementById("tp-mark"), tpPop = document.getElementById("tp-pop");
  var starBtn = document.getElementById("star");
  var filters = new Set(); // empty = all slides; otherwise union of "key" / "tp"
  var cur = { deck: null, i: 0, R: null };
  st.seenKey = st.seenKey || {};

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function ticks(deck) { return [].slice.call(scrubs[deck].children); }
  function total(deck) { return scrubs[deck].children.length; }
  function matches(tk) { if (!filters.size) return true; for (var f of filters) if (tk.classList.contains(f)) return true; return false; }
  function visible(deck) { return ticks(deck).filter(matches).map(function (t) { return +t.dataset.i; }); }

  function loadDeck(deck, i) {
    cur.deck = deck; cur.R = null;
    tabs.forEach(function (b) { b.setAttribute("aria-selected", String(b.dataset.deck === deck)); });
    // Is the open deck part of the course calendar, or a complementary one from the course repo?
    var kind = document.getElementById("deck-kind"), extra = tabs.some(function (b) { return b.dataset.deck === deck && b.dataset.extra; });
    kind.className = "pill " + (extra ? "compl" : "sched");
    kind.textContent = extra ? kind.dataset.kindExtra : kind.dataset.kindSched;
    kind.title = extra ? "No figura en el calendario de la materia" : "Figura en el calendario de la materia";
    decks.forEach(function (d) { scrubs[d].hidden = d !== deck; indexes[d].hidden = d !== deck; });
    frame.onload = attach;
    frame.src = BASE + "/decks/" + deck + "/index.html" + (S.isDark() ? "?deck-theme=dark" : "");
    ["all", "key", "tp"].forEach(function (f) {
      var n = f === "all" ? total(deck) : ticks(deck).filter(function (t) { return t.classList.contains(f); }).length;
      var el = document.querySelector('[data-fc="' + f + '"]'); if (el) el.textContent = n;
      var b = document.querySelector('#filter [data-f="' + f + '"]'); if (b) b.disabled = !n;
    });
    paintFilter();
    show(i, false);
  }

  function attach() {
    var w = frame.contentWindow, tries = 0;
    try {
      var css = w.document.createElement("style");
      css.textContent = ".reveal .slides section .fragment{opacity:1!important;visibility:inherit!important;transform:none!important}";
      w.document.head.appendChild(css);
    } catch (e) {}
    (function wait() {
      var R = w && w.Reveal;
      if (!R || !R.isReady || !R.isReady()) { if (tries++ < 120) setTimeout(wait, 60); return; }
      cur.R = R;
      // The deck re-enables fragments on its own (deckAnim after init, its animations toggle).
      // Fragments are forced visible by the CSS above, so with them on, each arrow press inside
      // the deck steps an invisible fragment and the slide seems stuck. Keep them off for good.
      try {
        var configure = R.configure;
        R.configure = function (o) { return configure.call(R, Object.assign({}, o, { fragments: false })); };
        R.configure({ hash: false, history: false }); R.slide(cur.i);
      } catch (e) {}
      R.on("slidechanged", function (e) { if (e.indexh !== cur.i) show(e.indexh, false); });
      try { w.document.addEventListener("keydown", function (e) {
        if (!handleKey(e, true)) return;
        e.preventDefault();
        if (e.key === "p" || e.key === "P") e.stopPropagation();   // reveal.js maps P to "previous slide"
      }, true); } catch (e) {}
    })();
  }

  function show(i, moveDeck) {
    var n = total(cur.deck);
    i = Math.max(0, Math.min(n - 1, i | 0));
    Object.keys(notes).forEach(function (d) { notes[d].forEach(function (el) { if (el) el.hidden = true; }); });
    cur.i = i;
    var el = notes[cur.deck][i];
    if (el) { el.hidden = false; S.renderMath(el); }
    if (moveDeck && cur.R) { try { cur.R.slide(i); } catch (e) {} }
    var seen = st.seen[cur.deck] || (st.seen[cur.deck] = []);
    if (seen.indexOf(i) < 0) seen.push(i);
    var tk = ticks(cur.deck)[i];
    if (tk && tk.classList.contains("key")) st.seenKey[cur.deck + "#" + i] = 1;
    st.seenClass[cur.deck] = classNum; st.pos[cur.deck] = i;
    st.last = "/clases/" + pad(classNum) + "/#d=" + cur.deck + "&s=" + i;
    S.save();
    history.replaceState(null, "", "#d=" + cur.deck + "&s=" + i);
    paint();
  }

  function paint() {
    var i = cur.i, n = total(cur.deck), seen = st.seen[cur.deck] || [];
    ticks(cur.deck).forEach(function (t) {
      var k = +t.dataset.i;
      t.classList.toggle("cur", k === i);
      t.classList.toggle("seen", seen.indexOf(k) >= 0);
      t.hidden = !matches(t);
    });
    scrubs[cur.deck].setAttribute("aria-valuenow", i);
    var visAll = visible(cur.deck), at = visAll.indexOf(i);
    document.getElementById("pos").textContent = !filters.size ? pad(i) + " / " + pad(n - 1)
      : (at >= 0 ? pad(at + 1) : "–") + " / " + pad(visAll.length);
    document.getElementById("pos").title = !filters.size ? "" : "Diapositiva " + i + " de la clase";
    document.getElementById("note-pos").textContent = i + " / " + (n - 1);
    var vis = visible(cur.deck);
    document.getElementById("prev").disabled = !vis.some(function (k) { return k < i; });
    document.getElementById("next").disabled = !vis.some(function (k) { return k > i; });
    // index: open + highlight the current section
    var idx = indexes[cur.deck], secName = "";
    idx.querySelectorAll(".idx-sec").forEach(function (sec) {
      var inSec = i >= +sec.dataset.first && i <= +sec.dataset.last;
      if (inSec && !sec.classList.contains("current")) sec.open = true;
      sec.classList.toggle("current", inSec);
      if (inSec) { secName = sec.querySelector(".sec-t").textContent; }
    });
    var tk = ticks(cur.deck);
    idx.querySelectorAll(".idx-row").forEach(function (r) {
      r.classList.toggle("cur", +r.dataset.i === i);
      r.hidden = !matches(tk[+r.dataset.i]);
    });
    idx.querySelectorAll(".idx-sec").forEach(function (sec) {
      sec.hidden = !sec.querySelector(".idx-row:not([hidden])");
    });
    document.getElementById("sec-name").textContent = secName || "Portada";
    // star
    var on = !!st.star[cur.deck + "#" + i];
    starBtn.classList.toggle("on", on);
    starBtn.querySelector("span").textContent = on ? "Marcada" : "Marcar";
    // TP marker on the slide
    var el = notes[cur.deck][i], tpl = el ? el.querySelector("template.tp-data") : null;
    var refs = tpl ? [].slice.call(tpl.content.querySelectorAll(".tp-ref")) : [];
    tpMark.hidden = !refs.length; tpPop.hidden = true; tpMark.setAttribute("aria-expanded", "false");
    if (refs.length) {
      var tps = refs.map(function (r) { return "TP" + r.dataset.tp; }).filter(function (v, k, a) { return a.indexOf(v) === k; });
      document.getElementById("tp-mark-label").textContent = tps.join(" · ");
      tpPop.innerHTML = '<div class="card-header"><div class="card-title">¿Te acordás?</div><button class="btn icon sm ghost" id="tp-close" aria-label="Cerrar"><svg class="i" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div><div class="card-body">' + refs.map(function (r) { return r.outerHTML; }).join("") + "</div>";
      document.getElementById("tp-close").onclick = toggleTp;
    }
  }

  function paintFilter() {
    document.querySelectorAll("#filter button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.f === "all" ? !filters.size : filters.has(b.dataset.f)));
    });
  }

  function step(dir) {
    var vis = visible(cur.deck), j = null, a;
    if (dir > 0) { for (a = 0; a < vis.length; a++) if (vis[a] > cur.i) { j = vis[a]; break; } }
    else { for (a = vis.length - 1; a >= 0; a--) if (vis[a] < cur.i) { j = vis[a]; break; } }
    if (j != null) show(j, true);
  }
  function toggleTp() {
    if (tpMark.hidden) return;
    tpPop.hidden = !tpPop.hidden;
    tpMark.setAttribute("aria-expanded", String(!tpPop.hidden));
    if (!tpPop.hidden) S.renderMath(tpPop);
  }
  function toggleStar() {
    var k = cur.deck + "#" + cur.i;
    if (st.star[k]) delete st.star[k]; else st.star[k] = Date.now();
    S.save(); paint(); S.paintNav();
  }
  function handleKey(e, fromDeck) {
    if (/input|textarea|select/i.test((document.activeElement || {}).tagName || "")) return false;
    if (e.metaKey || e.ctrlKey || e.altKey) return false;
    if (document.querySelector("dialog[open]")) return false;
    if (!fromDeck && (e.key === "ArrowRight" || e.key === "PageDown")) { step(1); return true; }
    if (!fromDeck && (e.key === "ArrowLeft" || e.key === "PageUp")) { step(-1); return true; }
    if (e.key === "t" || e.key === "T") { toggleTp(); return true; }
    if (e.key === "m" || e.key === "M") { toggleStar(); return true; }
    if (e.key === "f" || e.key === "F") { setFocus(!app.classList.contains("focus")); return true; }
    if (e.key === "p" || e.key === "P") { toggleFullscreen(); return true; }
    return false;
  }

  // scrubber: click / drag / hover tooltip
  var tip = document.createElement("div"); tip.className = "scrub-tip"; tip.hidden = true;
  decks.forEach(function (d) {
    var sc = scrubs[d];
    function tickAt(x) {
      var ts = ticks(d).filter(function (t) { return !t.hidden; }), r = sc.getBoundingClientRect();
      var k = Math.max(0, Math.min(ts.length - 1, Math.floor((x - r.left) / r.width * ts.length)));
      return ts[k];
    }
    var dragging = false;
    sc.addEventListener("pointerdown", function (e) { dragging = true; sc.setPointerCapture(e.pointerId); var t = tickAt(e.clientX); show(+t.dataset.i, true); });
    sc.addEventListener("pointerup", function () { dragging = false; });
    sc.addEventListener("pointermove", function (e) {
      var t = tickAt(e.clientX), foot = sc.parentNode, r = foot.getBoundingClientRect(), tr = t.getBoundingClientRect();
      if (tip.parentNode !== foot) { foot.style.position = "relative"; foot.appendChild(tip); }
      tip.hidden = false; tip.textContent = t.dataset.i + " · " + t.dataset.t;
      tip.style.left = (tr.left + tr.width / 2 - r.left) + "px";
      if (dragging && +t.dataset.i !== cur.i) show(+t.dataset.i, true);
    });
    sc.addEventListener("pointerleave", function () { tip.hidden = true; });
    sc.addEventListener("keydown", function (e) {
      if (e.key === "Home") { show(0, true); e.preventDefault(); }
      if (e.key === "End") { show(total(d) - 1, true); e.preventDefault(); }
    });
    indexes[d].addEventListener("click", function (e) { var r = e.target.closest(".idx-row"); if (r) show(+r.dataset.i, true); });
  });

  // focus mode (hide the navigation sidebar), remembered across classes
  var app = document.querySelector(".app"), focusBtn = document.getElementById("focus-btn");
  function setFocus(on) {
    app.classList.toggle("focus", on); focusBtn.setAttribute("aria-pressed", String(on));
    try { localStorage.setItem("iagen:focus", on ? "1" : ""); } catch (e) {}
  }
  focusBtn.addEventListener("click", function () { setFocus(!app.classList.contains("focus")); });
  try { if (localStorage.getItem("iagen:focus")) setFocus(true); } catch (e) {}

  // full screen for the whole viewer (slides + notes + TP help), not just the deck. The class
  // sidebar hides while it lasts and comes back as it was; the remembered focus preference is untouched.
  var fsBtn = document.getElementById("fs-btn"), docEl = document.documentElement, focusBefore = false;
  function fsElement() { return document.fullscreenElement || document.webkitFullscreenElement; }
  function toggleFullscreen() {
    if (fsElement()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else {
      var req = docEl.requestFullscreen || docEl.webkitRequestFullscreen;
      if (req) { var p = req.call(docEl); if (p && p.catch) p.catch(function () {}); }
    }
  }
  function onFullscreen() {
    var on = !!fsElement();
    if (on) { focusBefore = app.classList.contains("focus"); app.classList.add("focus"); }
    else if (!focusBefore) app.classList.remove("focus");
    docEl.classList.toggle("is-fs", on);
    try { if (cur.R) cur.R.layout(); } catch (e) {}
  }
  fsBtn.addEventListener("click", toggleFullscreen);
  document.getElementById("fs-exit").addEventListener("click", toggleFullscreen);
  document.addEventListener("fullscreenchange", onFullscreen);
  document.addEventListener("webkitfullscreenchange", onFullscreen);

  document.getElementById("prev").addEventListener("click", function () { step(-1); });
  document.getElementById("next").addEventListener("click", function () { step(1); });
  document.getElementById("filter").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    var f = b.dataset.f;
    if (f === "all") filters.clear(); else if (filters.has(f)) filters.delete(f); else filters.add(f);
    paintFilter();
    var vis = visible(cur.deck);
    if (vis.length && vis.indexOf(cur.i) < 0) {
      var next = vis.filter(function (k) { return k > cur.i; })[0];
      show(next != null ? next : vis[vis.length - 1], true);
    } else paint();
  });
  tpMark.addEventListener("click", toggleTp);
  starBtn.addEventListener("click", toggleStar);
  tabs.forEach(function (b) { b.addEventListener("click", function () { if (b.dataset.deck !== cur.deck) loadDeck(b.dataset.deck, st.pos[b.dataset.deck] || 0); }); });
  document.addEventListener("keydown", function (e) { if (handleKey(e, false)) e.preventDefault(); });
  document.addEventListener("themechange", function (e) {
    try { frame.contentDocument.documentElement.setAttribute("data-deck-theme", e.detail === "dark" ? "dark" : "light"); if (cur.R) cur.R.layout(); } catch (x) {}
  });
  function fromHash() {
    var p = new URLSearchParams(location.hash.slice(1));
    return { d: p.get("d"), s: p.get("s") != null ? +p.get("s") : null };
  }
  window.addEventListener("hashchange", function () {
    var h = fromHash();
    if (h.d && h.d !== cur.deck && scrubs[h.d]) loadDeck(h.d, h.s || 0);
    else if (h.s != null && h.s !== cur.i) show(h.s, true);
  });

  var h = fromHash();
  var deck = h.d && scrubs[h.d] ? h.d : decks[0];
  loadDeck(deck, h.s != null ? h.s : (st.pos[deck] || 0));
})();
