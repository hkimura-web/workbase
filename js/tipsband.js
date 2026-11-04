/* THE WORKBASE: 共通の「重要Tips」帯（授業の今日・校務のホーム・テストのホームに、同じ形で出す）
 *  - 授業・校務・テスト成績それぞれの「手順・メモ」で ★ を付けたものを集めます
 *  - いま開いているモードのものを先に、ほかは「ほかのTips」に折りたたみます */
(function (root) {
  "use strict";
  const A = root.A, esc = root.JD.esc, $ = id => document.getElementById(id);
  const SRC = [["class", "授業", "jmemo", "memo"], ["work", "校務", "work", "docs"], ["test", "テスト", "seiseki", "man"]];
  const ui = { more: false }; let map = {};
  const chip = (it, sorting) => {
    const wrap = h => (sorting && it.sortable) ? '<span class="wtpw" data-id="' + esc(it.id) + '"><span class="wgrip" aria-hidden="true">⠿</span>' + h + "</span>" : h;
    const tt = it.tag ? ' title="' + esc(it.tag) + '"' : "";
    if (it.href && !sorting) return '<a class="wtp ' + it.cls + '" href="' + esc(it.href) + '" target="_blank" rel="noopener noreferrer"' + tt + ">" + esc(it.t) + ' <span class="wgo">↗</span></a>';
    return wrap('<button class="wtp ' + it.cls + '" data-tbact="open" data-k="' + it.src + ":" + esc(it.id) + '"' + tt + ">" + esc(it.t) + (it.n > 1 ? ' <span class="wgo">▾' + it.n + "</span>" : "") + "</button>");
  };
  A.tipsBand = function (scope) {
    map = {};
    const sorting = scope === "work" && A.ui.work && A.ui.work.tipSort;
    const rows = SRC.map(([k, n, m]) => { let l = []; try { l = (A[m] && A[m].tips && A[m].tips()) || []; } catch (e) { l = []; } l.forEach(it => { map[it.src + ":" + it.id] = it; }); return { k, n, l }; });
    const me = rows.find(r => r.k === scope), others = rows.filter(r => r.k !== scope && r.l.length);
    const row = r => '<div class="tprow"><span class="tplab tb-' + r.k + '">' + r.n + "</span><span class=\"tpchips\">" + r.l.map(it => chip(it, sorting && r.k === "work")).join("") + "</span></div>";
    const cnt = others.reduce((a, r) => a + r.l.length, 0), openMore = ui.more || !me.l.length;
    let b = me.l.length ? row(me) : '<p class="note" style="margin:0">' + me.n + 'の「手順・メモ」で ☆ を押すと、ここに並びます。</p>';
    if (sorting) b = '<p class="note" style="margin:0 0 6px">ボタンをつかんで、動かしたい場所にドラッグして離してください。 <button class="btn sm" data-wact="tip-auto">自動の並びに戻す</button></p>' + b;
    if (others.length) b += '<details class="tpmore"' + (openMore ? " open" : "") + '><summary>ほかのTips（' + others.map(r => r.n + " " + r.l.length).join("・") + "）</summary>" + others.map(row).join("") + "</details>";
    const memoBtn = '<button class="btn sm" data-tbact="goto" data-k="' + scope + '">手順・メモを開く</button>';
    return '<section class="panel p-tips tpband"><header class="panel-h"><h2>重要Tips</h2><span class="panel-n">' + (scope === "work" ? '<button class="btn sm" data-wact="tip-sort">' + (sorting ? "完了" : "並べ替え") + "</button> " : "") + memoBtn + '</span></header><div class="panel-b">' + b + "</div></section>";
  };
  A.movedDoc = id => (A.jmemo && A.jmemo.getDoc && A.jmemo.getDoc(id)) || (A.seiseki && A.seiseki.getDoc && A.seiseki.getDoc(id)) || null;
  /* 校務の手順・メモで、タグが「授業」のものは授業へ、「テスト成績」のものはテスト成績へ、自動で移す（先に移し先へ入れてから、校務から外す） */
  const mv = setInterval(() => {
    const w = A.work, j = A.jmemo, s = A.seiseki; if (!w || !j || !s || !w.ready() || !j.ready() || !s.ready()) return;
    clearInterval(mv);
    const a = w.peekDocs(["jugyo"]), b = w.peekDocs(["seiseki"]);
    if (a.length && j.addDocs(JSON.parse(JSON.stringify(a)))) w.takeDocs(["jugyo"]);
    if (b.length && s.addDocs(JSON.parse(JSON.stringify(b)))) w.takeDocs(["seiseki"]);
  }, 1000);
  document.addEventListener("toggle", e => { const d = e.target; if (d && d.classList && d.classList.contains("tpmore")) ui.more = d.open; }, true);
  document.addEventListener("click", e => {
    const t = e.target.closest && e.target.closest("[data-tbact]"); if (!t) return;
    const a = t.dataset.tbact;
    if (a === "cl") { const d = $("wdlg"); if (d && d.open) d.close(); return; }
    if (a === "open") {
      if (A.ui.work && A.ui.work.tipSort) return;
      const it = map[t.dataset.k]; if (!it) return;
      $("wbody").innerHTML = '<h2 style="margin:0">' + esc(it.t) + "</h2>" + it.detail() + '<div class="dlg-btns"><button class="btn" data-tbact="cl">閉じる</button></div>';
      if (!$("wdlg").open) $("wdlg").showModal(); return;
    }
    if (a === "goto") {
      const s = SRC.find(x => x[0] === t.dataset.k); if (!s) return;
      if (s[0] === "class") A.ui.tab = "memo"; else if (s[0] === "work") A.ui.work.tab = s[3]; else A.ui.test.tab = s[3];
      A.render(); root.scrollTo(0, 0);
    }
  });
})(window);
