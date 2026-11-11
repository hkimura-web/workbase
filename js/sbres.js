/* THE WORKBASE: 左のメニューの幅を、つまんで引っぱって変える（パソコン幅のみ）。幅はこの端末に覚える。ダブルクリックで元の幅。 */
(function () {
  "use strict";
  const KEY = "jd.sbw", DEF = 244, MIN = 180, MAX = 480;
  const sh = document.querySelector(".shell"); if (!sh) return;
  const get = () => { try { const v = +localStorage.getItem(KEY); return v >= MIN && v <= MAX ? v : DEF; } catch (e) { return DEF; } };
  const set = w => { document.documentElement.style.setProperty("--sbw", w + "px"); };
  set(get());
  const h = document.createElement("div");
  h.id = "sbres"; h.title = "ドラッグで幅を変える（ダブルクリックで元の幅）"; h.setAttribute("role", "separator"); h.setAttribute("aria-orientation", "vertical");
  sh.appendChild(h);
  let drag = false;
  const w = e => { const r = sh.getBoundingClientRect(); const k = r.width ? sh.offsetWidth / r.width : 1; return Math.max(MIN, Math.min(MAX, Math.round((e.clientX - r.left) * k))); };
  h.addEventListener("pointerdown", e => { drag = true; h.setPointerCapture(e.pointerId); h.classList.add("on"); document.body.style.userSelect = "none"; e.preventDefault(); });
  h.addEventListener("pointermove", e => { if (drag) set(w(e)); });
  const end = e => { if (!drag) return; drag = false; h.classList.remove("on"); document.body.style.userSelect = ""; const v = w(e); set(v); try { localStorage.setItem(KEY, String(v)); } catch (x) { /* 覚えられなくても動く */ } };
  h.addEventListener("pointerup", end); h.addEventListener("pointercancel", () => { drag = false; h.classList.remove("on"); document.body.style.userSelect = ""; });
  h.addEventListener("dblclick", () => { set(DEF); try { localStorage.removeItem(KEY); } catch (e) { /* 何もしない */ } });
})();
