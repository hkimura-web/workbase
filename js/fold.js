/* THE WORKBASE: トップページ（今日・校務ホーム・テストのホーム）の各ブロックを「たたむ／ひらく」。
 *  たたんだ状態は、この端末に覚えます（今朝のまとめと同じ見た目。見出しは残るので一望できます） */
(function (root) {
  "use strict";
  const A = root.A, KEY = "jd.fold";
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { return {}; } };
  const save = o => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* 覚えられなくても動く */ } };
  const keyOf = p => ((A.ui && A.ui.mode) || "class") + ":" + [...p.classList].filter(c => /^p-/.test(c)).join(".");
  function decorate() {
    const app = document.getElementById("app"); if (!app) return;
    const st = load();
    app.querySelectorAll(".panel").forEach(p => {
      if (p.classList.contains("mb")) return;   /* 今朝のまとめは、もとの開閉を使う */
      const h = p.querySelector(":scope>.panel-h"), b = p.querySelector(":scope>.panel-b"); if (!h || !b) return;
      const k = keyOf(p); if (!/:p-/.test(k)) return;
      p.classList.add("foldable");
      let c = h.querySelector(".fold-c");
      if (!c) { c = document.createElement("span"); c.className = "fold-c"; c.setAttribute("aria-hidden", "true"); h.appendChild(c); h.setAttribute("role", "button"); h.tabIndex = 0; }
      const f = !!st[k]; p.classList.toggle("folded", f); h.dataset.foldk = k; c.textContent = f ? "▸" : "▾"; h.setAttribute("aria-expanded", String(!f));
    });
  }
  const toggle = h => { const st = load(), k = h.dataset.foldk; if (!k) return; if (st[k]) delete st[k]; else st[k] = 1; save(st); decorate(); };
  document.addEventListener("click", e => {
    const h = e.target.closest && e.target.closest(".panel.foldable>.panel-h"); if (!h) return;
    if (e.target.closest("a,button,input,select,textarea,label,summary")) return;   /* 見出しの中の操作は、そのまま使える */
    toggle(h);
  });
  document.addEventListener("keydown", e => {
    const h = e.target && e.target.matches && e.target.matches(".panel.foldable>.panel-h") ? e.target : null;
    if (h && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggle(h); }
  });
  let q = 0; const later = () => { if (q) return; q = requestAnimationFrame(() => { q = 0; decorate(); }); };
  function start() { const app = document.getElementById("app"); if (!app) return; new MutationObserver(later).observe(app, { childList: true, subtree: true }); decorate(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})(window);
