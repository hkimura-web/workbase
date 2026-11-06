/* THE WORKBASE: 特別日課（短縮授業・模試・面談週間など、その日だけ時間割が変わる日）
 *  - 「授業なしにする時限」と「授業時間（1限の開始・1コマの長さ・休み時間）」を日付の範囲で決めます
 *  - 年によって変わるので、決め打ちにせず、いつでもここで直せます */
(function (root) {
  "use strict";
  const A = root.A, J = root.JD, esc = J.esc, $ = id => document.getElementById(id);
  const hm = m => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
  const mm = s => { const m = /^(\d+):(\d+)$/.exec(s || ""); return m ? +m[1] * 60 + +m[2] : null; };
  const list = () => (A.st && A.st.days) || [];
  const save = () => { A.commit && A.commit(); };
  function view() {
    const d = list();
    let h = '<h2 style="margin:0 0 4px">特別日課</h2><p class="note" style="margin:0 0 10px">短縮授業・模試・面談週間など、その日だけ時間割が変わる日を入れます。「授業なしにする時限」に入れた時限は、授業なし（計画が自動で後ろへずれます）になり、授業時間を変えると「今日」の時刻表示も変わります。年によって変わるので、いつでも直せます。</p>';
    h += d.length ? d.map((e, i) => {
      const off = e.off === "all", set = new Set(Array.isArray(e.off) ? e.off : []), b = e.bell;
      return '<div class="wcard" style="margin-bottom:10px"><label>名前</label><input type="text" value="' + esc(e.name) + '" data-dsf="name" data-i="' + i + '" placeholder="例：面談週間（40分授業）">' +
        '<div class="btns" style="margin-top:6px;align-items:center"><span class="small">期間</span><input type="date" value="' + esc(e.from) + '" data-dsf="from" data-i="' + i + '" style="width:auto"><span>〜</span><input type="date" value="' + esc(e.to || e.from) + '" data-dsf="to" data-i="' + i + '" style="width:auto"></div>' +
        '<div style="margin-top:8px"><b class="small">授業なしにする時限</b><div class="btns" style="margin-top:4px"><label class="tsimp"><input type="checkbox" data-dsc="all" data-i="' + i + '"' + (off ? " checked" : "") + '> 全部（模試など）</label>' +
        [1, 2, 3, 4, 5, 6, 7].map(p => '<label class="tsimp"><input type="checkbox" data-dsc="p" data-p="' + p + '" data-i="' + i + '"' + (off || set.has(p) ? " checked" : "") + (off ? " disabled" : "") + "> " + p + "限</label>").join("") + "</div>" +
        '<label class="small">理由（授業なしの表示に出ます。空なら名前）</label><input type="text" value="' + esc(e.why || "") + '" data-dsf="why" data-i="' + i + '" placeholder="例：面談"></div>' +
        '<div style="margin-top:8px"><label class="tsimp"><input type="checkbox" data-dsc="bell" data-i="' + i + '"' + (b ? " checked" : "") + '> 授業時間を変える（40分授業など）</label>' +
        (b ? '<div class="btns" style="margin-top:4px;align-items:center"><span class="small">1限の開始</span><input type="time" value="' + hm(b.s) + '" data-dsf="bs" data-i="' + i + '" style="width:auto"><span class="small">1コマ</span><input type="number" min="10" max="90" value="' + b.len + '" data-dsf="blen" data-i="' + i + '" style="width:64px"><span class="small">分　休み</span><input type="number" min="0" max="30" value="' + (b.brk || 0) + '" data-dsf="bbrk" data-i="' + i + '" style="width:64px"><span class="small">分</span></div><p class="note" style="margin:4px 0 0">1限〜7限が、この長さと休みで続けて並びます（昼休みは入りません）。</p>' : "") + "</div>" +
        '<div class="btns" style="margin-top:8px"><button class="btn danger" data-dsa="del" data-i="' + i + '">この特別日課を消す</button></div></div>';
    }).join("") : '<p class="note">まだありません。</p>';
    return h + '<div class="dlg-btns" style="justify-content:space-between"><button class="btn on" data-dsa="add">＋ 特別日課を足す</button><button class="btn" data-dsa="close">閉じる</button></div>';
  }
  function open() { $("wbody").innerHTML = view(); if (!$("wdlg").open) $("wdlg").showModal(); }
  const redraw = () => { const y = ($("wdlg") || {}).scrollTop; $("wbody").innerHTML = view(); };
  document.addEventListener("click", e => {
    const o = e.target.closest && e.target.closest('[data-act="days-open"]'); if (o) { open(); return; }
    const t = e.target.closest && e.target.closest("[data-dsa]"); if (!t || !A.st) return;
    const a = t.dataset.dsa, i = +t.dataset.i;
    if (a === "close") { $("wdlg").close(); return; }
    if (!Array.isArray(A.st.days)) A.st.days = [];
    if (a === "add") { const d = A.ui.asof || J.ds(new Date()); A.st.days.push({ id: "z" + Date.now(), from: d, to: d, name: "特別日課", off: [], why: "", bell: null }); save(); redraw(); }
    else if (a === "del" && A.st.days[i] && root.confirm("この特別日課を消しますか？")) { A.st.days.splice(i, 1); save(); redraw(); }
  });
  document.addEventListener("change", e => {
    const t = e.target, c = t.dataset && t.dataset.dsc;
    if (c && A.st) {
      const i = +t.dataset.i, x = A.st.days[i]; if (!x) return;
      if (c === "all") x.off = t.checked ? "all" : [];
      else if (c === "p") { const s = new Set(Array.isArray(x.off) ? x.off : []); t.checked ? s.add(+t.dataset.p) : s.delete(+t.dataset.p); x.off = [...s].sort((p, q) => p - q); }
      else if (c === "bell") x.bell = t.checked ? { s: 532, len: 40, brk: 8 } : null;
      save(); redraw(); return;
    }
    const f = t.dataset && t.dataset.dsf; if (!f || !A.st) return;
    const x = A.st.days[+t.dataset.i]; if (!x) return;
    if (f === "name") x.name = t.value; else if (f === "why") x.why = t.value;
    else if (f === "from") { x.from = t.value; if (!x.to || x.to < x.from) x.to = x.from; } else if (f === "to") x.to = t.value < x.from ? x.from : t.value;
    else if (f === "bs") { const m = mm(t.value); if (m != null) x.bell.s = m; } else if (f === "blen") x.bell.len = Math.max(10, +t.value || 40); else if (f === "bbrk") x.bell.brk = Math.max(0, +t.value || 0);
    save(); if (f === "from" || f === "to") redraw();
  });
  A.days = { open };
})(window);
