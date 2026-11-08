/* THE WORKBASE: 共通の「重要Tips」帯（授業の今日・校務のホーム・テストのホームに、同じ形で出す）
 *  - 授業・校務・テスト成績それぞれの「手順・メモ」で ★ を付けたものを集めます
 *  - いま開いているモードのものを先に、ほかは「ほかのTips」に折りたたみます */
(function (root) {
  "use strict";
  const A = root.A, esc = root.JD.esc, $ = id => document.getElementById(id);
  const SRC = [["class", "授業", "jmemo", "memo"], ["work", "校務", "work", "docs"], ["test", "テスト", "seiseki", "man"]];
  const ui = { more: (function () { try { return localStorage.getItem("jd.tpmore") !== "0"; } catch (e) { return true; } })(), q: "" }; let map = {};
  const nf = x => String(x || "").normalize("NFKC").toLowerCase();
  const chip = (it, sorting) => {
    const wrap = h => sorting ? '<span class="wtpw" data-src="' + it.src + '" data-id="' + esc(it.id) + '"><span class="wgrip" aria-hidden="true">⠿</span>' + h + "</span>" : h;
    const tt = it.tag ? ' title="' + esc(it.tag) + '"' : "", kw = it.kw ? ' data-kw="' + esc(it.kw) + '"' : "";
    if (it.href && !sorting) return '<a class="wtp ' + it.cls + '"' + kw + ' href="' + esc(it.href) + '" target="_blank" rel="noopener noreferrer"' + tt + ">" + esc(it.t) + ' <span class="wgo">↗</span></a>';
    return wrap('<button class="wtp ' + it.cls + '"' + kw + ' data-tbact="open" data-k="' + it.src + ":" + esc(it.id) + '"' + tt + ">" + esc(it.t) + (it.n > 1 ? ' <span class="wgo">▾' + it.n + "</span>" : "") + "</button>");
  };
  const sortOn = () => !!(A.ui.work && A.ui.work.tipSort);
  function rowsOf() {
    map = {};
    return SRC.map(([k, n, m]) => { let l = []; try { l = (A[m] && A[m].tips && A[m].tips()) || []; } catch (e) { l = []; } l.forEach(it => { map[it.src + ":" + it.id] = it; }); return { k, n, l }; });
  }
  function bodyH(scope) {
    const sorting = sortOn(), q = nf(ui.q).split(/\s+/).filter(Boolean);
    const rows = rowsOf().map(r => ({ k: r.k, n: r.n, all: r.l, l: q.length ? r.l.filter(it => q.every(w => nf(it.t + " " + it.tag + " " + (it.kw || "")).indexOf(w) >= 0)) : r.l }));
    const me = rows.find(r => r.k === scope), others = rows.filter(r => r.k !== scope && r.l.length);
    const row = r => '<div class="tprow"><span class="tplab tb-' + r.k + '">' + r.n + '</span><span class="tpchips">' + r.l.map(it => chip(it, sorting)).join("") + "</span></div>";
    const cnt = others.reduce((a, r) => a + r.l.length, 0), openMore = ui.more || q.length > 0;
    let b = "";
    if (sorting) b += '<p class="note" style="margin:0 0 6px">ボタンをつかんで、同じ段の中で動かしたい場所にドラッグして離してください。 <button class="btn sm" data-wact="tip-auto">自動の並びに戻す</button></p>';
    if (me.l.length) b += row(me);
    else if (q.length) b += '<p class="note" style="margin:0">' + me.n + "のTipsには、見つかりません。</p>";
    else b += '<p class="note" style="margin:0">' + me.n + "の「手順・メモ」で ☆ を押すと、ここに並びます。</p>";
    if (others.length) b += '<details class="tpmore"' + (openMore ? " open" : "") + "><summary>ほかのTips（" + others.map(r => r.n + " " + r.l.length).join("・") + "）</summary>" + others.map(row).join("") + "</details>";
    else if (q.length && !me.l.length) b = '<p class="note" style="margin:0">見つかりません。</p>';
    return b;
  }
  function markHits() {
    const band = document.querySelector('.tpband[data-scope="class"]'); if (!band) return;
    const lessons = document.querySelector(".tworow"); const txt = nf(lessons ? (lessons.firstElementChild || lessons).textContent : "");
    band.querySelectorAll("[data-kw]").forEach(el => {
      const hit = nf(el.dataset.kw).split(/[,、，\s]+/).filter(Boolean).some(w => txt.indexOf(w) >= 0);
      el.classList.toggle("tphit", hit);
      if (hit && !el.closest(".wtpw")) { const p = el.parentNode; if (p && p.firstChild !== el) p.insertBefore(el, p.firstChild); }
    });
  }
  A.tipsBand = function (scope) {
    const sorting = sortOn();
    setTimeout(markHits, 0);
    return '<section class="panel p-tips tpband" data-scope="' + scope + '"><header class="panel-h"><h2>重要Tips</h2><span class="panel-n"><input type="search" id="tp_q" class="tpq" placeholder="さがす" value="' + esc(ui.q) + '" autocomplete="off" aria-label="Tipsをさがす"> <button class="btn sm" data-wact="tip-sort">' + (sorting ? "完了" : "並べ替え") + '</button> <button class="btn sm" data-tbact="goto" data-k="' + scope + '">手順・メモを開く</button></span></header><div class="panel-b" id="tp_b">' + bodyH(scope) + "</div></section>";
  };
  A.tipsSetOrder = (src, ids) => { const s = SRC.find(x => x[0] === src); if (s && A[s[2]] && A[s[2]].setTipOrder) A[s[2]].setTipOrder(ids); };
  A.tipsClearOrder = () => SRC.forEach(s => A[s[2]] && A[s[2]].setTipOrder && A[s[2]].setTipOrder([]));
  document.addEventListener("input", e => {
    if (e.target.id !== "tp_q") return; ui.q = e.target.value;
    const band = e.target.closest(".tpband"), bd = $("tp_b"); if (band && bd) { bd.innerHTML = bodyH(band.dataset.scope); markHits(); }
  });

  /* ---------- 手順・メモ：3つ（授業・校務・テスト成績）を、どこを開いても一覧で見えるようにする ---------- */
  const NAME = { class: "授業", work: "校務", test: "テスト成績" }, MOD = { class: "jmemo", work: "work", test: "seiseki" };
  const mo = { open: {} };
  const allOf = src => { try { return (A[MOD[src]] && A[MOD[src]].alldocs && A[MOD[src]].alldocs()) || []; } catch (e) { return []; } };
  const qNow = () => { const i = document.querySelector("#jm_q,#wdq,#ts_dq"); return i ? nf(i.value).split(/\s+/).filter(Boolean) : []; };
  const moCard = it => '<details class="wdet mo-card mo-' + it.src + '" data-mk="' + it.src + ":" + esc(it.id) + '"' + (mo.open[it.src + ":" + it.id] ? " open" : "") + '><summary><span class="mo-src">' + (NAME[it.src]) + '</span><span class="wdt">' + esc(it.t || "（無題）") + "</span>" + (it.tag ? '<span class="mo-tag">' + esc(it.tag) + "</span>" : "") + (it.star ? '<span class="tsstar on tsmini">★</span>' : "") + "</summary>" +
    '<div class="mo-body">' + it.detail() + '</div><div class="btns" style="margin-top:8px"><button class="btn" data-tbact="memo-go" data-k="' + it.src + ":" + esc(it.id) + '">' + NAME[it.src] + "のメモで開く（編集はそこで）</button></div></details>";
  function moInner(scope) {
    const q = qNow();
    return ["class", "work", "test"].filter(s => s !== scope).map(s => {
      const all = allOf(s), l = q.length ? all.filter(it => q.every(w => nf(it.t + " " + it.tag).indexOf(w) >= 0)) : all;
      return '<div class="mo-sec mo-sec-' + s + '"><div class="mo-h"><span class="mo-lab mo-lab-' + s + '">' + NAME[s] + "</span><b>" + NAME[s] + "のメモ</b><span class=\"note\">" + (q.length ? l.length + " / " : "") + all.length + "件・読むだけ</span></div>" + (l.map(moCard).join("") || '<p class="note" style="margin:4px 0 0">' + (all.length ? "見つかりません。" : "まだありません。") + "</p>") + "</div>";
    }).join("");
  }
  A.memoHead = scope => '<div class="mo-top">' + ["class", "work", "test"].map(s => '<span class="mo-chip mo-chip-' + s + (s === scope ? " here" : "") + '">' + NAME[s] + " " + allOf(s).length + "</span>").join("") + '<span class="note">いま開いているモード（' + NAME[scope] + '）のメモが上、ほかは下に出ます。</span></div>' +
    '<div class="mo-h own"><span class="mo-lab mo-lab-' + scope + '">' + NAME[scope] + "</span><b>" + NAME[scope] + 'のメモ</b><span class="note">ここで編集できます</span></div>';
  A.memoOthers = scope => '<div id="mo_in" data-scope="' + scope + '">' + moInner(scope) + "</div>";
  document.addEventListener("input", e => {
    if (!/^(jm_q|wdq|ts_dq)$/.test(e.target.id)) return;
    const w = $("mo_in"); if (w) w.innerHTML = moInner(w.dataset.scope);
  });
  document.addEventListener("toggle", e => { const d = e.target; if (d && d.dataset && d.dataset.mk) mo.open[d.dataset.mk] = d.open; }, true);
  A.movedDoc = id => (A.jmemo && A.jmemo.getDoc && A.jmemo.getDoc(id)) || (A.seiseki && A.seiseki.getDoc && A.seiseki.getDoc(id)) || null;
  /* 校務の手順・メモで、タグが「授業」のものは授業へ、「テスト成績」のものはテスト成績へ、自動で移す（先に移し先へ入れてから、校務から外す） */
  const mv = setInterval(() => {
    const w = A.work, j = A.jmemo, s = A.seiseki; if (!w || !j || !s || !w.ready() || !j.ready() || !s.ready()) return;
    clearInterval(mv);
    const a = w.peekDocs(["jugyo"]), b = w.peekDocs(["seiseki"]);
    if (a.length && j.addDocs(JSON.parse(JSON.stringify(a)))) w.takeDocs(["jugyo"]);
    if (b.length && s.addDocs(JSON.parse(JSON.stringify(b)))) w.takeDocs(["seiseki"]);
  }, 1000);
  document.addEventListener("toggle", e => { const d = e.target; if (d && d.classList && d.classList.contains("tpmore")) { ui.more = d.open; try { localStorage.setItem("jd.tpmore", d.open ? "1" : "0"); } catch (x) { /* 保存できなくても動く */ } } }, true);
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
    if (a === "memo-go") {
      const k = t.dataset.k.split(":"), src = k[0], id = k.slice(1).join(":"), m = A[MOD[src]]; if (!m || !m.openDoc) return;
      m.openDoc(id); A.ui.mode = src === "class" ? "class" : src;
      try { root.JDStore.LS.set("jd.mode", A.ui.mode); } catch (x) { /* なくても動く */ }
      A.render(); root.scrollTo(0, 0);
      setTimeout(() => { const el = document.querySelector('[data-ph="d' + id + '"],.wdoc[data-id="' + id + '"]'); if (el) el.scrollIntoView({ block: "start" }); }, 60); return;
    }
    if (a === "goto") {
      const s = SRC.find(x => x[0] === t.dataset.k); if (!s) return;
      if (s[0] === "class") A.ui.tab = "memo"; else if (s[0] === "work") A.ui.work.tab = s[3]; else A.ui.test.tab = s[3];
      A.render(); root.scrollTo(0, 0);
    }
  });
})(window);
