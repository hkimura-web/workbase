/* THE WORKBASE: メモの文字の装飾（太字・赤字・青字・下線）
 *  書き方: **太字**  {red:赤字}  {blue:青字}  {u:下線}  — 授業・校務・テスト成績の手順・メモで共通 */
(function (root) {
  "use strict";
  const A = root.A;
  const fmt = s => s.replace(/\{(red|blue|u):([^{}]*)\}/g, (m, k, t) => '<span class="rt-' + k + '">' + t + "</span>");
  A.rt = {
    fmt,
    /* すでにエスケープした文字に、太字と色・下線を当てる */
    inl: s => fmt(s.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")),
    bar: () => '<div class="rtbar" role="group" aria-label="文字の装飾"><span class="note">選んだ文字を：</span>' +
      '<button type="button" class="btn sm" data-rt="b" title="太字"><b>B</b> 太字</button>' +
      '<button type="button" class="btn sm rtb-red" data-rt="red" title="赤字">赤字</button>' +
      '<button type="button" class="btn sm rtb-blue" data-rt="blue" title="青字">青字</button>' +
      '<button type="button" class="btn sm rtb-u" data-rt="u" title="下線">下線</button></div>'
  };
  document.addEventListener("mousedown", e => { if (e.target.closest && e.target.closest("[data-rt]")) e.preventDefault(); });
  document.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest("[data-rt]"); if (!b) return;
    const bar = b.closest(".rtbar"), ta = bar && bar.nextElementSibling; if (!ta || ta.tagName !== "TEXTAREA") return;
    const k = b.dataset.rt, o = k === "b" ? "**" : "{" + k + ":", c = k === "b" ? "**" : "}";
    const s = ta.selectionStart, en = ta.selectionEnd, sel = ta.value.slice(s, en) || "文字";
    ta.focus(); ta.setRangeText(o + sel + c, s, en, "end");
    ta.setSelectionRange(s + o.length, s + o.length + sel.length);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  });
})(window);
