/* Shared helpers: progress storage, search, theme, small UI bits. */
(function () {
  "use strict";
  var KEY = "iagen:v1";
  var BASE = window.SITE_BASE || "";

  function norm(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  function load() {
    var d = { seen: {}, seenClass: {}, star: {}, pos: {}, last: "", quiz: {}, cards: {}, errors: {}, dev: {}, runs: [] };
    try { var s = localStorage.getItem(KEY); if (s) Object.assign(d, JSON.parse(s)); } catch (e) {}
    return d;
  }
  var state = load();
  var t;
  function save() {
    clearTimeout(t);
    t = setTimeout(function () { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }, 120);
  }
  function isDark() {
    var a = document.documentElement.getAttribute("data-theme");
    if (a) return a === "dark";
    return window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches;
  }
  function renderMath(el) {
    if (!window.renderMathInElement) { setTimeout(function () { if (window.renderMathInElement) renderMath(el); }, 300); return; }
    try {
      window.renderMathInElement(el, {
        delimiters: [{ left: "$$", right: "$$", display: true }, { left: "\\(", right: "\\)", display: false }, { left: "$", right: "$", display: false }],
        throwOnError: false, ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code", "input"]
      });
    } catch (e) {}
  }
  window.Study = { state: state, load: function () { return state; }, save: save, norm: norm, base: BASE, isDark: isDark, renderMath: renderMath };

  // theme
  var tb = document.getElementById("theme-btn");
  if (tb) tb.addEventListener("click", function () {
    var next = isDark() ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("iagen:theme", next); } catch (e) {}
    document.dispatchEvent(new CustomEvent("themechange", { detail: next }));
  });
  // mobile sidebar
  var mb = document.getElementById("menu-btn"), sb = document.getElementById("sidebar");
  function closeSb() { sb.classList.remove("open"); var s = document.querySelector(".scrim"); if (s) s.remove(); }
  if (mb) mb.addEventListener("click", function () {
    sb.classList.add("open");
    var s = document.createElement("div"); s.className = "scrim"; s.onclick = closeSb; document.body.appendChild(s);
  });
  // sidebar: per-class progress, marked count, exam countdown
  function paintNav() {
    document.querySelectorAll(".meter[data-class]").forEach(function (el) {
      var c = +el.dataset.class, tot = +el.dataset.total, seen = 0;
      Object.keys(state.seen).forEach(function (k) { if (+state.seenClass[k] === c) seen += state.seen[k].length; });
      el.firstElementChild.style.width = Math.min(100, Math.round(100 * seen / Math.max(1, tot))) + "%";
    });
    document.querySelectorAll(".progress[data-class]").forEach(function (el) {
      var c = +el.dataset.class, tot = +el.dataset.total, seen = 0;
      Object.keys(state.seen).forEach(function (k) { if (+state.seenClass[k] === c) seen += state.seen[k].length; });
      el.firstElementChild.style.width = Math.min(100, Math.round(100 * seen / Math.max(1, tot))) + "%";
      el.title = seen + " de " + tot + " vistas";
    });
    var n = Object.keys(state.star).length, sc = document.getElementById("star-count");
    if (sc) sc.textContent = n ? n : "";
  }
  window.Study.paintNav = paintNav;
  paintNav();
  var ex = document.getElementById("exam-left");
  if (ex) {
    var d = Math.round((new Date(2026, 11, 4) - new Date(new Date().toDateString())) / 864e5);
    ex.textContent = d > 0 ? "Final en " + d + " días" : d === 0 ? "El final es hoy" : "2ª fecha: 10 dic";
  }
  // code viewer dialog: any [data-code="tpN-id"] opens <template id="sn-tpN-id">
  var dlg = document.getElementById("code-dlg");
  function highlight(codeEl, tries) {
    tries = tries || 0;
    if (window.hljs) { try { window.hljs.highlightElement(codeEl); } catch (e) {} }
    else if (tries < 40) setTimeout(function () { highlight(codeEl, tries + 1); }, 150);
  }
  // `keys` is one snippet key or a comma-separated chain ("tp3-a,tp3-b"): the definition, where it
  // is wired and where it is used. A chain gets a strip of numbered steps to move between files.
  function openCode(keys, nota) {
    var list = String(keys).split(",").filter(function (k) { return document.getElementById("sn-" + k); });
    if (!list.length || !dlg) return;
    showCode(list, 0, nota);
    if (!dlg.open) dlg.showModal();
  }
  function showCode(list, at, nota) {
    var key = list[at], tpl = document.getElementById("sn-" + key);
    var body = document.getElementById("code-dlg-body");
    body.innerHTML = "";
    if (list.length > 1) {
      var strip = document.createElement("nav");
      strip.className = "code-chain"; strip.setAttribute("aria-label", "Fragmentos relacionados");
      list.forEach(function (k, j) {
        var t = document.getElementById("sn-" + k), b = document.createElement("button");
        b.type = "button"; b.className = "chain-step"; b.setAttribute("aria-current", String(j === at));
        b.title = t.dataset.title;
        b.innerHTML = '<span class="n mono"></span><span class="f mono"></span><span class="t"></span>';
        b.children[0].textContent = j + 1;
        b.children[1].textContent = t.dataset.file.split("/").pop();
        b.children[2].textContent = t.dataset.title;
        b.onclick = function () { showCode(list, j, nota); };
        strip.appendChild(b);
      });
      body.appendChild(strip);
    }
    body.appendChild(tpl.content.cloneNode(true));
    document.getElementById("code-dlg-title").textContent = tpl.dataset.title;
    document.getElementById("code-dlg-tp").textContent = "TP" + tpl.dataset.tp;
    document.getElementById("code-dlg-tp").title = tpl.dataset.tpTitle;
    document.getElementById("code-dlg-open").href = BASE + "/tp/" + tpl.dataset.tp + "/#codigo=" + key;
    var code = body.querySelector("code"), start = +code.dataset.start || 1;
    var n = code.textContent.replace(/\n$/, "").split("\n").length, gut = [];
    for (var k = 0; k < n; k++) gut.push(start + k);
    var g = document.createElement("div"); g.className = "gutter"; g.setAttribute("aria-hidden", "true"); g.textContent = gut.join("\n");
    code.parentNode.parentNode.insertBefore(g, code.parentNode);
    highlight(code);
    if (nota) {
      var ns = body.querySelector(".nota-slot");
      ns.innerHTML = '<div class="callout"><b>En esta diapositiva.</b> </div>';
      ns.firstChild.appendChild(document.createTextNode(nota));
    }
    renderMath(body);
    body.querySelector(".code-scroll").scrollTop = 0;
  }
  window.Study.openCode = openCode;
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-code]");
    if (b) { e.preventDefault(); openCode(b.dataset.code, b.dataset.nota || ""); }
  });
  if (dlg) {
    document.getElementById("code-dlg-close").onclick = function () { dlg.close(); };
    dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
  }

  // generic tabs: [data-tabs] container with [data-tab] buttons and [data-panel] siblings
  document.querySelectorAll("[data-tabs]").forEach(function (group) {
    var scope = document.getElementById(group.dataset.tabs);
    group.addEventListener("click", function (e) {
      var b = e.target.closest("[data-tab]"); if (!b) return;
      group.querySelectorAll("[data-tab]").forEach(function (x) { x.setAttribute("aria-selected", String(x === b)); });
      scope.querySelectorAll("[data-panel]").forEach(function (p) { p.hidden = p.dataset.panel !== b.dataset.tab; });
      renderMath(scope);
    });
  });
  // clickable table rows
  document.querySelectorAll("tr[data-href]").forEach(function (tr) {
    tr.addEventListener("click", function (e) { if (!e.target.closest("a")) location.href = tr.dataset.href; });
  });

  // search
  var input = document.getElementById("search"), box = document.getElementById("search-results");
  var index = null, results = [], sel = 0;
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function ensureIndex() {
    if (index) return Promise.resolve(index);
    return fetch(BASE + "/data/search.json").then(function (r) { return r.json(); }).then(function (d) {
      index = d.map(function (e) {
        var url = e.g ? BASE + "/glosario/#" + e.g : e.tpd ? BASE + "/tp-diapositivas/" + e.tpd + "/#d=" + e.d + "&s=" + e.i : BASE + "/clases/" + pad(e.c) + "/#d=" + e.d + "&s=" + e.i;
        var sub = e.g ? "Glosario · clase " + pad(e.c) : e.tpd ? "TP" + e.tpd + " en diapositivas · " + e.i : "Clase " + pad(e.c) + " · diapositiva " + e.i;
        return { t: e.t || "(sin título)", nt: norm(e.t), nx: norm(e.x), url: url, sub: sub + (e.e ? " · complementaria" : ""), g: !!e.g };
      });
      return index;
    });
  }
  function draw() {
    if (!results.length) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = results.map(function (r, i) {
      return '<a href="' + r.url + '" class="' + (i === sel ? "sel" : "") + '">' + esc(r.t) + "<small>" + esc(r.sub) + "</small></a>";
    }).join("");
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  if (input) {
    input.addEventListener("focus", ensureIndex);
    input.addEventListener("input", function () {
      var q = norm(input.value.trim()); sel = 0;
      if (q.length < 2) { results = []; draw(); return; }
      ensureIndex().then(function (idx) {
        results = idx.map(function (r) {
          var s = r.nt.indexOf(q) === 0 ? 6 : r.nt.indexOf(q) >= 0 ? 4 : r.nx.indexOf(q) >= 0 ? 1 : 0;
          if (s && r.g) s += 1;
          return [s, r];
        }).filter(function (x) { return x[0] > 0; }).sort(function (a, b) { return b[0] - a[0]; }).slice(0, 12).map(function (x) { return x[1]; });
        draw();
      });
    });
    input.addEventListener("keydown", function (e) {
      e.stopPropagation();
      if (e.key === "ArrowDown") { sel = Math.min(sel + 1, results.length - 1); draw(); e.preventDefault(); }
      else if (e.key === "ArrowUp") { sel = Math.max(sel - 1, 0); draw(); e.preventDefault(); }
      else if (e.key === "Enter" && results[sel]) { location.href = results[sel].url; input.blur(); results = []; draw(); input.value = ""; }
      else if (e.key === "Escape") { input.value = ""; results = []; draw(); input.blur(); }
    });
    input.addEventListener("blur", function () { setTimeout(function () { box.hidden = true; }, 150); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "/" && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); input.focus(); }
    });
  }
  document.addEventListener("DOMContentLoaded", function () { renderMath(document.querySelector("main") || document.body); });
})();
