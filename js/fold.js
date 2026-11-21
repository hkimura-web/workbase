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
      let t = h.querySelector(".fold-t");
      if (!t) { t = document.createElement("button"); t.type = "button"; t.className = "fold-t"; t.dataset.foldk = k; h.appendChild(t); }
      const f = !!st[k]; p.classList.toggle("folded", f); t.dataset.foldk = k; t.textContent = f ? "ひらく" : "たたむ"; t.setAttribute("aria-expanded", String(!f));
    });
  }
  document.addEventListener("click", e => {
    const t = e.target.closest && e.target.closest(".fold-t"); if (!t) return;
    const st = load(), k = t.dataset.foldk; if (st[k]) delete st[k]; else st[k] = 1;
    save(st); decorate();
  });
  let q = 0; const later = () => { if (q) return; q = requestAnimationFrame(() => { q = 0; decorate(); }); };
  function start() { const app = document.getElementById("app"); if (!app) return; new MutationObserver(later).observe(app, { childList: true, subtree: true }); decorate(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})(window);
