/* THE WORKBASE: メモの文字の装飾（太字・赤字・青字・下線）
 *  書き方: **太字**  {red:赤字}  {blue:青字}  {u:下線}  — 授業・校務・テスト成績の手順・メモで共通 */
(function (root) {
  "use strict";
  const A = root.A;
  const fmt = s => s.replace(/\{(red|blue|u):([^{}]*)\}/g, (m, k, t) => '<span class="rt-' + k + '">' + t + "</span>");
  /* メモをタグ別にまとめて並べる。タグの並び順どおりに見出しを付け、タグなしは一番上。
   * items: [[doc, index], ...]  card(doc, index): 1件ぶんのHTML  chip(tag|null): 見出しの色つきタグ */
  function grp(tags, items, card, chip) {
    const known = {}; tags.forEach(t => { known[t.id] = 1; });
    const out = [];
    const sect = (t, l) => l.length ? '<div class="tgh">' + chip(t) + '<span class="tgn">' + l.length + "件</span></div>" + l.map(x => card(x[0], x[1])).join("") : "";
    out.push(sect(null, items.filter(x => !known[x[0].tag])));   /* タグなしは一番上（まだ整理していないメモに気づきやすい） */
    tags.forEach(t => { out.push(sect(t, items.filter(x => x[0].tag === t.id))); });
    return out.join("");
  }
  /* タグの並べ替え（▲▼）。i番目を d(-1/+1) だけ動かす */
  const mvBtns = (i, n, act) => '<span class="tmv"><button class="btn sm" ' + act + ' data-i="' + i + '" data-d="-1" aria-label="上へ"' + (i === 0 ? " disabled" : "") + '>▲</button><button class="btn sm" ' + act + ' data-i="' + i + '" data-d="1" aria-label="下へ"' + (i >= n - 1 ? " disabled" : "") + ">▼</button></span>";
  function mv(tags, i, d) { const j = i + d; if (j < 0 || j >= tags.length) return false; const t = tags[i]; tags[i] = tags[j]; tags[j] = t; return true; }
  A.rt = {
    grp, mvBtns, mv,
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
