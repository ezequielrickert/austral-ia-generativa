/* Practice: multiple choice, flashcards (Leitner boxes), open questions, and past mistakes. */
(function () {
  "use strict";
  var S = window.Study, st = S.state, BASE = S.base;
  var card = document.getElementById("run-card"), run = document.getElementById("run");
  var DATA = null, mode = "quiz", N = 20, sel = new Set(), ALL = [];
  var Q = [], F = [], D = [], keyHandler = null;

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function md(s) { return esc(s).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\n{2,}/g, "<br><br>"); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function label(x) { return x.src === "c" ? "Clase " + pad(x.num) : "TP" + x.num; }
  function setHead(title, pos, frac) {
    document.getElementById("run-title").textContent = title;
    document.getElementById("run-pos").textContent = pos || "";
    document.getElementById("run-bar").style.width = Math.round((frac || 0) * 100) + "%";
  }

  function build() {
    DATA.clases.forEach(function (c) {
      (c.quiz || []).forEach(function (q, i) { Q.push(Object.assign({ id: "c" + c.num + "q" + i, src: "c", num: c.num }, q)); });
      (c.flashcards || []).forEach(function (f, i) { F.push({ id: "c" + c.num + "f" + i, src: "c", num: c.num, q: f.q, a: f.a }); });
      (c.desarrollo || []).forEach(function (d, i) { D.push(Object.assign({ id: "c" + c.num + "d" + i, src: "c", num: c.num }, d)); });
    });
    DATA.tps.forEach(function (t) {
      (t.quiz || []).forEach(function (q, i) { Q.push(Object.assign({ id: "t" + t.num + "q" + i, src: "t", num: t.num }, q)); });
      (t.flashcards || []).forEach(function (f, i) { F.push({ id: "t" + t.num + "f" + i, src: "t", num: t.num, q: f.q, a: f.a }); });
    });
  }
  function inSel(x) { return sel.has(x.src + x.num); }
  function pool() {
    if (mode === "quiz") return Q.filter(inSel);
    if (mode === "cards") return F.filter(inSel);
    if (mode === "dev") return D.filter(inSel);
    return Q.filter(function (q) { return st.errors[q.id]; });
  }
  function topicsLabel() {
    var c = 0, t = 0; sel.forEach(function (k) { if (k[0] === "c") c++; else t++; });
    var tc = DATA.clases.length, tt = DATA.tps.length;
    if (c === tc && t === tt) return "Todas las clases y TPs";
    if (!c && !t) return "Ningún tema";
    var parts = [];
    if (c) parts.push(c === tc ? "Todas las clases" : c === 1 ? "Clase " + [].slice.call(sel).filter(function (k) { return k[0] === "c"; })[0].slice(1).padStart(2, "0") : c + " clases");
    if (t) parts.push(t === tt ? "todos los TPs" : t === 1 ? "TP" + [].slice.call(sel).filter(function (k) { return k[0] === "t"; })[0].slice(1) : t + " TPs");
    return parts.join(", ");
  }
  function summary() {
    if (!DATA) return;
    var rows = [];
    function add(src, num, titulo) {
      var qs = Q.filter(function (q) { return q.src === src && q.num === num; });
      var ans = qs.filter(function (q) { return st.quiz[q.id]; }), ok = ans.filter(function (q) { return st.quiz[q.id].ok; }).length;
      var pct = ans.length ? Math.round(100 * ok / ans.length) : null;
      rows.push('<tr><td class="mono faint">' + (src === "c" ? pad(num) : "TP" + num) + '</td><td>' + esc(titulo) + '</td><td class="r num muted">' + ans.length + " / " + qs.length + '</td><td>' +
        (pct == null ? '<span class="faint">—</span>' : '<span style="display:flex;align-items:center;gap:8px"><span class="progress" style="width:80px"><i style="width:' + pct + '%;background:' + (pct >= 60 ? "var(--ok)" : "var(--bad)") + '"></i></span><span class="num" style="font-size:12.5px">' + pct + "%</span></span>") + "</td></tr>");
    }
    DATA.clases.forEach(function (c) { add("c", c.num, c.titulo); });
    DATA.tps.forEach(function (t) { add("t", t.num, t.titulo); });
    document.getElementById("by-topic").innerHTML = rows.join("");
    var runs = (st.runs || []).slice(-8).reverse();
    document.getElementById("recent").innerHTML = runs.length ? '<div class="rows">' + runs.map(function (r) {
      var d = new Date(r.t);
      return '<div class="row-item" style="cursor:default;grid-template-columns:minmax(0,1fr) auto;align-items:center"><span><span class="t">' + d.toLocaleDateString("es-AR", { day: "numeric", month: "short" }) + " · " + d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) + '</span><span class="d">' + r.n + ' preguntas</span></span><span class="score ' + (r.p >= 60 ? "ok" : "no") + '" style="font-size:18px">' + r.p + "%</span></div>";
    }).join("") + "</div>" : '<div class="empty">Todavía no hiciste ninguna ronda.</div>';
  }

  function updateConfig() {
    summary();
    document.getElementById("topics-field").hidden = mode === "errors";
    document.getElementById("count-field").hidden = mode === "dev" || mode === "errors";
    var n = pool().length;
    document.getElementById("avail").textContent = n + (mode === "cards" ? " tarjetas" : " preguntas");
    var e = Object.keys(st.errors).length;
    document.getElementById("err-n").textContent = e ? " " + e : "";
    document.getElementById("start").disabled = !n;
    document.getElementById("topics-label").textContent = topicsLabel();
    document.querySelectorAll("#topics-menu input").forEach(function (i) { i.checked = sel.has(i.value); });
  }

  // ---------- multiple choice ----------
  function quiz(items, exam, title) {
    items = items.map(function (q) { return { q: q, perm: shuffle(q.opciones.map(function (_, k) { return k; })), ans: null }; });
    var i = 0;
    function record(it) {
      var ok = it.ans === it.q.correcta;
      st.quiz[it.q.id] = { ok: ok, t: Date.now() };
      if (ok) delete st.errors[it.q.id]; else st.errors[it.q.id] = Date.now();
      S.save();
    }
    function draw() {
      if (i >= items.length) return finish();
      var it = items[i], q = it.q, done = it.ans != null && !exam;
      setHead(title, (i + 1) + " / " + items.length + " · " + label(q), i / items.length);
      var h = '<div class="card-body"><div class="q-text">' + md(q.q) + '</div><div class="opts">';
      it.perm.forEach(function (k, j) {
        var cls = "";
        if (done) { if (k === q.correcta) cls = "right"; else if (k === it.ans) cls = "wrong"; }
        else if (exam && it.ans === k) cls = "sel";
        h += '<button class="opt ' + cls + '" data-k="' + k + '"' + (done ? " disabled" : "") + '><span class="l">' + "ABCDEF"[j] + "</span><span>" + md(q.opciones[k]) + "</span></button>";
      });
      h += "</div>";
      if (done) h += '<div class="feedback"><b class="' + (it.ans === q.correcta ? "ok" : "no") + '">' + (it.ans === q.correcta ? "Correcta." : "Incorrecta.") + "</b> " + md(q.explicacion) + "</div>";
      h += '</div><div class="card-footer" style="justify-content:space-between">' + (exam && i > 0 ? '<button class="btn" id="back">Anterior</button>' : "<span></span>");
      h += '<button class="btn primary" id="nx"' + ((exam && it.ans == null) || (!exam && !done) ? " disabled" : "") + ">" + (i === items.length - 1 ? "Ver resultado" : "Siguiente") + "</button></div>";
      run.innerHTML = h; S.renderMath(run);
      run.querySelectorAll(".opt").forEach(function (b) { b.onclick = function () { if (b.disabled) return; it.ans = +b.dataset.k; if (!exam) record(it); draw(); }; });
      var nx = document.getElementById("nx"); if (nx) nx.onclick = function () { i++; draw(); };
      var bk = document.getElementById("back"); if (bk) bk.onclick = function () { i--; draw(); };
    }
    function finish() {
      if (exam) items.forEach(record);
      var ok = items.filter(function (it) { return it.ans === it.q.correcta; }).length, pct = Math.round(100 * ok / items.length);
      st.runs.push({ t: Date.now(), p: pct, n: items.length }); S.save();
      setHead("Resultado", ok + " de " + items.length, 1);
      var h = '<div class="card-body" style="flex-direction:row;align-items:center;justify-content:space-between;flex-wrap:wrap"><div style="display:flex;align-items:baseline;gap:12px"><span class="score ' + (pct >= 60 ? "ok" : "no") + '">' + pct + '%</span><span class="muted">' + ok + " de " + items.length + ' correctas</span></div><div style="display:flex;gap:8px"><button class="btn" id="close2">Cambiar configuración</button><button class="btn primary" id="again">Otra ronda</button></div></div>';
      h += '<div class="row-group" style="position:static;border-top:1px solid var(--border)"><span>Revisión</span><span class="mono">' + items.length + "</span></div>";
      h += items.map(function (it, j) {
        var good = it.ans === it.q.correcta;
        return '<div class="review-row"><span><span class="' + (good ? "ok" : "no") + '">' + (good ? "✓" : "✗") + "</span> " + (j + 1) + ". " + md(it.q.q) + ' <span class="faint mono" style="font-size:11.5px">' + label(it.q) + "</span></span>" +
          (good ? "" : '<span class="muted">Tu respuesta: ' + (it.ans == null ? "(sin responder)" : md(it.q.opciones[it.ans])) + "</span>") +
          "<span>Correcta: <strong>" + md(it.q.opciones[it.q.correcta]) + '</strong></span><span class="faint">' + md(it.q.explicacion) + "</span></div>";
      }).join("");
      run.innerHTML = h; S.renderMath(run);
      document.getElementById("again").onclick = start;
      document.getElementById("close2").onclick = closeRun;
      updateConfig();
    }
    draw();
  }

  // ---------- flashcards ----------
  function box(id) { return (st.cards[id] && st.cards[id].box) || 0; }
  function cards(items) {
    var order = shuffle(items).sort(function (a, b) { return box(a.id) - box(b.id); }).slice(0, N);
    var i = 0, flipped = false, tally = [0, 0, 0];
    function draw() {
      if (i >= order.length) {
        setHead("Ronda terminada", order.length + " tarjetas", 1);
        run.innerHTML = '<div class="card-body" style="flex-direction:row;align-items:center;justify-content:space-between"><span class="muted">' + tally[2] + " bien · " + tally[1] + " con dudas · " + tally[0] + ' para repetir</span><button class="btn primary" id="again">Otra ronda</button></div>';
        document.getElementById("again").onclick = start; return;
      }
      var c = order[i];
      setHead("Tarjetas", (i + 1) + " / " + order.length + " · " + label(c) + " · caja " + box(c.id), i / order.length);
      run.innerHTML = '<div class="flash" id="flash"><div class="front">' + md(c.q) + "</div>" + (flipped ? '<div class="back">' + md(c.a) + "</div>" : '<span class="faint" style="font-size:13px">Tocá la tarjeta o apretá <kbd>espacio</kbd></span>') + "</div>" +
        (flipped ? '<div class="card-footer"><div class="rate"><button class="btn" data-r="0">No la sabía <kbd>1</kbd></button><button class="btn" data-r="1">Con dudas <kbd>2</kbd></button><button class="btn" data-r="2">La sabía <kbd>3</kbd></button></div></div>' : "");
      S.renderMath(run);
      document.getElementById("flash").onclick = function () { if (!flipped) { flipped = true; draw(); } };
      run.querySelectorAll("[data-r]").forEach(function (b) { b.onclick = function () { rate(+b.dataset.r); }; });
    }
    function rate(r) {
      var c = order[i], b = box(c.id);
      st.cards[c.id] = { box: r === 0 ? 0 : r === 1 ? Math.max(1, b) : Math.min(5, b + 1), t: Date.now() };
      tally[r]++; S.save(); i++; flipped = false; draw();
    }
    keyHandler = function (e) {
      if (/input|textarea/i.test(document.activeElement.tagName)) return;
      if (e.key === " " && !flipped && i < order.length) { e.preventDefault(); flipped = true; draw(); }
      else if (flipped && "123".indexOf(e.key) >= 0) rate(+e.key - 1);
    };
    draw();
  }
  document.addEventListener("keydown", function (e) { if (keyHandler && mode === "cards" && !card.hidden) keyHandler(e); });

  // ---------- open questions ----------
  function dev(items) {
    setHead("A desarrollar", items.length + " preguntas", 0);
    run.innerHTML = items.map(function (d) {
      var s = st.dev[d.id] || {};
      return '<div class="card-section dev" data-id="' + d.id + '"><span class="section-label">' + label(d) + '</span><div class="q-text" style="font-weight:500">' + md(d.pregunta) + "</div>" +
        '<textarea id="dev-' + d.id + '" aria-label="Tu respuesta" placeholder="Escribí tu respuesta">' + esc(s.draft || "") + "</textarea>" +
        '<div><button class="btn sm" data-show>' + (s.shown ? "Ocultar respuesta modelo" : "Ver respuesta modelo") + "</button></div>" +
        '<div class="callout model" style="display:flex;flex-direction:column;gap:10px"' + (s.shown ? "" : " hidden") + ">" + ((d.puntos_clave || []).length ? '<div style="display:flex;flex-direction:column;gap:6px"><span class="section-label">Puntos clave</span>' + d.puntos_clave.map(function (p, k) {
          return '<label><input type="checkbox" data-ck="' + k + '"' + ((s.checks || [])[k] ? " checked" : "") + "> <span>" + md(p) + "</span></label>";
        }).join("") + "</div>" : "") + "<div>" + md(d.respuesta_modelo) + "</div></div></div>";
    }).join("");
    S.renderMath(run);
    run.querySelectorAll(".dev").forEach(function (el) {
      var id = el.dataset.id, s = function () { return st.dev[id] || (st.dev[id] = {}); };
      el.querySelector("textarea").oninput = function (e) { s().draft = e.target.value; S.save(); };
      el.querySelector("[data-show]").onclick = function (e) {
        var o = s(); o.shown = !o.shown; S.save();
        el.querySelector(".model").hidden = !o.shown; e.target.textContent = o.shown ? "Ocultar respuesta modelo" : "Ver respuesta modelo";
      };
      el.querySelectorAll("[data-ck]").forEach(function (c) { c.onchange = function () { var o = s(); o.checks = o.checks || []; o.checks[+c.dataset.ck] = c.checked; S.save(); }; });
    });
  }

  function start() {
    keyHandler = null;
    var p = pool(); if (!p.length) return;
    card.hidden = false;
    if (mode === "quiz") quiz(shuffle(p).sort(function (a, b) { return (st.quiz[a.id] ? 1 : 0) - (st.quiz[b.id] ? 1 : 0); }).slice(0, N), true, "Simulacro");
    else if (mode === "errors") quiz(shuffle(p), false, "Mis errores");
    else if (mode === "cards") cards(p);
    else dev(p);
    card.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function closeRun() { card.hidden = true; run.innerHTML = ""; keyHandler = null; window.scrollTo({ top: 0, behavior: "smooth" }); }
  document.getElementById("run-close").onclick = closeRun;

  // ---------- topics menu ----------
  var menu = document.getElementById("topics-menu"), mbtn = document.getElementById("topics-btn");
  function openMenu(v) { menu.hidden = !v; mbtn.setAttribute("aria-expanded", String(v)); }
  mbtn.onclick = function (e) { e.stopPropagation(); openMenu(menu.hidden); };
  document.getElementById("topics-done").onclick = function () { openMenu(false); };
  document.addEventListener("click", function (e) { if (!menu.hidden && !e.target.closest(".menu-wrap")) openMenu(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") openMenu(false); });
  menu.addEventListener("change", function (e) { var i = e.target; if (i.type !== "checkbox") return; i.checked ? sel.add(i.value) : sel.delete(i.value); updateConfig(); });
  document.getElementById("all").onclick = function () { ALL.forEach(function (k) { sel.add(k); }); updateConfig(); };
  document.getElementById("none").onclick = function () { sel.clear(); updateConfig(); };

  function setMode(m) {
    mode = m;
    document.querySelectorAll("#mode button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.mode === m)); });
    closeRun(); updateConfig();
  }
  document.getElementById("mode").onclick = function (e) { var b = e.target.closest("button"); if (b) setMode(b.dataset.mode); };
  document.getElementById("count").onclick = function (e) {
    var b = e.target.closest("button"); if (!b) return; N = +b.dataset.n;
    document.querySelectorAll("#count button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
  };
  document.getElementById("start").onclick = start;

  fetch(BASE + "/data/practice.json").then(function (r) { return r.json(); }).then(function (d) {
    DATA = d; build();
    var hc = "", ht = "";
    d.clases.forEach(function (c) { hc += '<label class="check-row"><input type="checkbox" value="c' + c.num + '"><span class="n">' + pad(c.num) + '</span><span class="t">' + esc(c.titulo) + "</span></label>"; ALL.push("c" + c.num); });
    d.tps.forEach(function (t) { ht += '<label class="check-row"><input type="checkbox" value="t' + t.num + '"><span class="n">' + t.num + '</span><span class="t">' + esc(t.titulo) + "</span></label>"; ALL.push("t" + t.num); });
    document.getElementById("topics-clases").insertAdjacentHTML("beforeend", hc);
    document.getElementById("topics-tps").insertAdjacentHTML("beforeend", ht);
    var hash = location.hash.slice(1);
    (hash && ALL.indexOf(hash) >= 0 ? [hash] : ALL).forEach(function (k) { sel.add(k); });
    if (hash.charAt(0) === "t") setMode("cards"); else updateConfig();
  });
})();
