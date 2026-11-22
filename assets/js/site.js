/* SHUMC鼠鼠茶屋 Wiki：侧边栏、页内目录、站内搜索、菜单截图灯箱。无需构建。 */
(function () {
  "use strict";
  var NAV = window.SHUMC_NAV || [];
  var here = (location.pathname.split("/").pop() || "index.html").split("?")[0] || "index.html";
  if (!/\.html$/.test(here)) here = "index.html";

  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function slug(text, used) {
    var base = text.replace(/[\s·、，。：:（）()\/【】「」？！!?,.]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "sec";
    var s = base, i = 2;
    while (used[s]) s = base + "-" + i++;
    used[s] = 1;
    return s;
  }

  /* ---- 给标题补 id ---- */
  var main = document.querySelector("main.content");
  var used = {};
  if (main) {
    main.querySelectorAll("h2, h3").forEach(function (h) {
      if (!h.id) h.id = slug(h.textContent, used); else used[h.id] = 1;
    });
  }

  /* ---- 侧边栏 ---- */
  var side = document.getElementById("sidebar");
  if (side) {
    side.appendChild(el("div", { "class": "nav-title" }, "目 录 · WIKI"));
    var ul = el("ul");
    NAV.forEach(function (p) {
      var li = el("li");
      var a = el("a", { href: p.href, "class": "nav-link", title: p.desc || "" },
        '<img class="px" src="' + p.icon + '" alt="">' + '<span>' + esc(p.title) + "</span>");
      li.appendChild(a);
      if (p.href === here) {
        li.className = "current";
        if (main) {
          var toc = el("ul", { "class": "toc" });
          main.querySelectorAll("h2").forEach(function (h) {
            var t = el("li");
            t.appendChild(el("a", { href: "#" + h.id }, esc(h.textContent.replace(/^❀\s*/, ""))));
            toc.appendChild(t);
          });
          if (toc.children.length) li.appendChild(toc);
        }
      }
      ul.appendChild(li);
    });
    side.appendChild(ul);
    side.addEventListener("click", function (e) { if (e.target.closest("a")) document.body.classList.remove("nav-open"); });
  }
  var toggle = document.querySelector(".menu-toggle");
  if (toggle) toggle.addEventListener("click", function () { document.body.classList.toggle("nav-open"); });

  /* ---- 上一页 / 下一页 ---- */
  var idx = NAV.findIndex(function (p) { return p.href === here; });
  if (main && idx >= 0) {
    var pn = el("nav", { "class": "page-nav" });
    if (idx > 0) pn.appendChild(el("a", { href: NAV[idx - 1].href, "class": "prev" }, "<small>← 上一页</small>" + esc(NAV[idx - 1].title)));
    if (idx < NAV.length - 1) pn.appendChild(el("a", { href: NAV[idx + 1].href, "class": "next" }, "<small>下一页 →</small>" + esc(NAV[idx + 1].title)));
    main.appendChild(pn);
  }

  /* ---- 灯箱（点击菜单截图看带按钮说明的完整图） ---- */
  var lb = el("div", { "class": "lightbox" });
  document.body.appendChild(lb);
  lb.addEventListener("click", function () { lb.classList.remove("open"); lb.innerHTML = ""; });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { lb.classList.remove("open"); lb.innerHTML = ""; closeResults(); } });
  document.querySelectorAll("figure.menu-shot a").forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      var cap = a.parentNode.querySelector("figcaption");
      lb.innerHTML = '<div class="lb-cap">' + (cap ? esc(cap.textContent) : "") + "（点任意处关闭）</div>";
      var img = el("img", { src: a.getAttribute("href"), alt: "" });
      lb.appendChild(img);
      lb.classList.add("open");
    });
  });

  /* ---- 站内搜索：首次输入时抓取所有页面，按 h2/h3 分段建索引 ---- */
  var input = document.getElementById("search");
  var box = document.getElementById("search-results");
  var index = null, loading = null, activeIdx = -1;

  function buildIndex() {
    if (loading) return loading;
    var cacheKey = "shumc-search-v2";
    try {
      var cached = sessionStorage.getItem(cacheKey);
      if (cached) { index = JSON.parse(cached); return (loading = Promise.resolve(index)); }
    } catch (e) {}
    loading = Promise.all(NAV.map(function (p) {
      return fetch(p.href).then(function (r) { return r.text(); }).then(function (html) {
        var doc = new DOMParser().parseFromString(html, "text/html");
        var m = doc.querySelector("main.content");
        if (!m) return [];
        var u = {}, out = [];
        var cur = { page: p.title, href: p.href, id: "", title: p.title, text: "" };
        var walker = m.querySelectorAll("h1, h2, h3, p, li, td, th, figcaption, .i-name, .i-sub, .card-title, .card-desc");
        m.querySelectorAll("h2, h3").forEach(function (h) { if (!h.id) h.id = slug(h.textContent, u); else u[h.id] = 1; });
        walker.forEach(function (n) {
          if (/^H[23]$/.test(n.tagName)) {
            out.push(cur);
            cur = { page: p.title, href: p.href, id: n.id, title: n.textContent.replace(/^❀\s*/, ""), text: "" };
          } else if (n.tagName !== "H1" && !(n.parentElement && n.parentElement.closest("li, td, p"))) {
            cur.text += " " + n.textContent.replace(/\s+/g, " ");
          }
        });
        out.push(cur);
        return out;
      }).catch(function () { return []; });
    })).then(function (lists) {
      index = [].concat.apply([], lists);
      try { sessionStorage.setItem(cacheKey, JSON.stringify(index)); } catch (e) {}
      return index;
    });
    return loading;
  }

  function highlight(text, terms) {
    var out = esc(text);
    terms.forEach(function (t) { if (t) out = out.split(esc(t)).join("<mark>" + esc(t) + "</mark>"); });
    return out;
  }
  function closeResults() { if (box) { box.classList.remove("open"); activeIdx = -1; } }

  function runSearch(q) {
    q = q.trim();
    if (!q) { closeResults(); return; }
    var terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    buildIndex().then(function (idx) {
      var scored = [];
      idx.forEach(function (s) {
        var title = s.title.toLowerCase(), text = s.text.toLowerCase(), score = 0, ok = true;
        terms.forEach(function (t) {
          var inT = title.indexOf(t) >= 0, inX = text.indexOf(t) >= 0;
          if (!inT && !inX) ok = false;
          score += (inT ? 10 : 0) + (inX ? 1 + Math.min(5, text.split(t).length - 1) : 0);
        });
        if (ok) scored.push({ s: s, score: score });
      });
      scored.sort(function (a, b) { return b.score - a.score; });
      var html = "";
      scored.slice(0, 14).forEach(function (r) {
        var s = r.s, t0 = terms[0], pos = s.text.toLowerCase().indexOf(t0);
        var snip = pos >= 0 ? s.text.slice(Math.max(0, pos - 24), pos + 60) : s.text.slice(0, 80);
        html += '<a href="' + s.href + (s.id ? "#" + s.id : "") + '"><span class="r-title">' + highlight(s.title, terms) +
          '</span><span class="r-page">' + esc(s.page) + '</span><div class="r-snip">…' + highlight(snip.trim(), terms) + "…</div></a>";
      });
      box.innerHTML = html || '<div class="r-empty">没有找到「' + esc(q) + '」。试试指令名（如 /sell）或玩法名（如 锦鲤）。</div>';
      box.classList.add("open");
      activeIdx = -1;
    });
  }

  if (input && box) {
    var timer;
    input.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(function () { runSearch(input.value); }, 120); });
    input.addEventListener("focus", function () { buildIndex(); if (input.value.trim()) runSearch(input.value); });
    input.addEventListener("keydown", function (e) {
      var links = box.querySelectorAll("a");
      if (!links.length) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        activeIdx = (activeIdx + (e.key === "ArrowDown" ? 1 : -1) + links.length) % links.length;
        links.forEach(function (l, i) { l.classList.toggle("active", i === activeIdx); });
      } else if (e.key === "Enter") {
        (links[activeIdx >= 0 ? activeIdx : 0]).click();
      }
    });
    document.addEventListener("click", function (e) { if (!e.target.closest(".search-wrap")) closeResults(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "/" && document.activeElement !== input && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); input.focus(); }
    });
  }
})();
