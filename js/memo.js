/* THE WORKBASE: 「手順・メモ」を、授業・校務・テスト成績で同じ画面・同じ形にそろえる
 *  - 大きな分類（授業 / 校務 / テスト成績）と、3つ共通の「ジャンル」の2段で整理する
 *  - どのモードの「手順・メモ」を開いても、同じ画面。上の分類ボタンで、見る範囲を切りかえる
 *  - データは今までどおり、3つのファイル（jugyomemo.json / work.json / seiseki.json）に保存。
 *    ジャンルの一覧は、3つに同じものを持たせて、ここで直すと3つとも直る */
(function (root) {
  "use strict";
  const J = root.JD, A = root.A, esc = J.esc, $ = id => document.getElementById(id);
  /* 大きな分類は、自分で増やしたり減らしたりできる（ここは、はじめの4つ）。
   * データの入れものは3つ（授業=jugyomemo.json／校務=work.json／テスト成績=seiseki.json）。
   * 「授業」「テスト成績」の分類のメモは、それぞれの入れものに入る。それ以外の分類は、校務の入れもの(work.json)の中に、cat:"分類のid" の印を付けて入れる */
  const STORES = ["class", "work", "test"];
  const MODN = { class: "jmemo", work: "work", test: "seiseki" };
  const CPAL = ["#8fa8d6", "#7dbb92", "#e6a95f", "#e48ab3", "#a994d6", "#6fbfbf", "#e58b86", "#a3acba"];   /* 分類の色（うすめ） */
  const CNAME = ["ブルー", "グリーン", "オレンジ", "ピンク", "パープル", "ティール", "レッド", "グレー"];
  const DEFCATS = [{ id: "class", n: "授業", c: 0 }, { id: "hr", n: "クラス", c: 1 }, { id: "work", n: "校務", c: 2 }, { id: "test", n: "テスト成績", c: 3 }];
  const INK = "#1f2a44";
  const TGN = ["ピンク", "ブルー", "グリーン", "オレンジ", "パープル", "ティール", "レッド", "グレー"];
  /* 共通のジャンル（はじめの並び）。左は今までのタグの id。同じ意味のものは1つにまとめた */
  const GEN = [
    { id: "komu", n: "全般", c: 7 }, { id: "jugyo", n: "授業", c: 1 }, { id: "kokugo", n: "国語科", c: 4 },
    { id: "kyozai", n: "教材・プリント", c: 3 }, { id: "jimu", n: "事務・提出", c: 6 }, { id: "jyunbi", n: "試験準備", c: 5 }, { id: "seiseki", n: "成績処理", c: 0 },
    { id: "hokoku", n: "報告・会議", c: 1 }, { id: "ryu", n: "留学・欠席", c: 3 }, { id: "bukatsu", n: "部活動", c: 2 }
  ];
  /* 今までのタグの、はじめの名前と色（名前や色を自分で変えていたら、それを引きつぐため） */
  const OLD = {
    work: { komu: ["校務全般", -1], class: ["クラス", -1], jugyo: ["授業", -1], kokugo: ["国語科", -1], seiseki: ["テスト成績", -1], bukatsu: ["部活動", -1] },
    class: { jugyo: ["授業", 1], kyozai: ["教材・プリント", 2], jimu: ["事務・提出", 3] },
    test: { jyunbi: ["試験準備", 1], seiseki: ["成績処理", 0], hokoku: ["報告・会議", 2], ryu: ["留学・欠席", 3] }
  };
  const ui = { cat: { class: "class", work: "work", test: "test" }, g: "", q: "", open: {}, edit: null, mgr: false };
  A.ui.mm = ui; A.memo = {};
  const nf = x => String(x || "").normalize("NFKC").toLowerCase();
  const clone = x => JSON.parse(JSON.stringify(x));
  const sk = c => (c === "class" || c === "test" ? c : "work");   /* 分類 → データの入れもの */
  const mod = c => A[MODN[sk(c)]];
  const st = c => { const m = mod(c); return m && m.mm ? m.mm.S() : null; };
  const touch = c => { const m = mod(c); if (m && m.mm) m.mm.save(); };
  /* 分類の一覧（3つの入れものに同じものを持たせる。いちばん新しく直したものを使う） */
  function catsNow() {
    let best = null;
    STORES.forEach(c => { const s = st(c); if (s && Array.isArray(s.cats) && s.cats.length && (!best || (s.catsUpd || 0) > (best.catsUpd || 0))) best = s; });
    return best ? best.cats : DEFCATS;
  }
  const catOf = (storeKey, d) => { const l = catsNow(), id = d.cat || storeKey; return l.some(x => x.id === id) ? id : l[0].id; };   /* 持ち主の分類が消えているときは、いちばん上の分類に出す */
  const cinfo = id => catsNow().find(x => x.id === id) || { id, n: id, c: 7 };
  const ccol = id => CPAL[cinfo(id).c] || CPAL[7];
  A.memo.cats = () => catsNow().map(x => ({ id: x.id, n: x.n, col: CPAL[x.c] || CPAL[7] }));
  A.memo.catOfItem = it => { const s = st(it.src), d = s && s.docs.find(x => x.id === it.id); return d ? catOf(it.src, d) : it.src; };
  A.memo.ink = INK;
  const isReady = c => { const m = mod(c); return !!(m && m.mm && m.mm.S() && m.ready && m.ready()); };
  const md2h = x => (A.seiseki && A.seiseki.md2h ? A.seiseki.md2h(x) : "<p>" + esc(x) + "</p>");
  const imgs = d => (A.work && A.work.imgsH ? A.work.imgsH(d) : "");
  const dl = d => { const o = []; if (d.u) o.push({ t: d.ut || "リンク1", u: d.u }); (d.ls || []).forEach((x, k) => { if (x.u) o.push({ t: x.t || "リンク" + (k + 2), u: x.u }); }); return o; };
  const lnkH = d => dl(d).map(x => '<a class="btn wlnk" href="' + esc(x.u) + '" target="_blank" rel="noopener noreferrer">' + esc(x.t) + " ↗</a>").join("");
  let uid = Date.now();

  /* ---------- ジャンル（3つに同じ一覧を持たせる） ---------- */
  function tagsNow() {   /* いちばん新しく直したものを使う */
    let best = null;
    STORES.forEach(c => { const s = st(c); if (s && Array.isArray(s.tags) && s.tags.length && (!best || (s.gen === 1 && (best.gen !== 1 || (s.tagsUpd || 0) > (best.tagsUpd || 0))))) best = s; });
    return best ? best.tags : GEN;
  }
  function remapDocs(s, master, oldTags) {
    const ids = {}; master.forEach(t => { ids[t.id] = 1; });
    const byName = {}; master.forEach(t => { byName[t.n] = t.id; });
    const nm = {}; (oldTags || []).forEach(t => { nm[t.id] = byName[t.n] || ""; });
    s.docs.forEach(d => { const o = d.tag || ""; d.tag = !o ? "" : ids[o] ? o : (nm[o] || ""); });
  }
  function reconcileTags() {
    const S = STORES.map(c => st(c)), key = s => JSON.stringify(s.tags);
    if (S.every(s => s.gen === 1 && key(s) === key(S[0]))) return;
    let master, done = S.filter(s => s.gen === 1);
    if (done.length) {   /* 3つのうち、どれかが新しい ＝ いちばん新しいものにそろえる */
      master = clone(done.reduce((a, b) => ((b.tagsUpd || 0) > (a.tagsUpd || 0) ? b : a)).tags);
    } else {   /* はじめての整理: 共通の一覧を作る（今までの名前・色の変更は引きつぐ） */
      master = GEN.map(g => ({ id: g.id, n: g.n, c: g.c }));
      [["work", S[1]], ["class", S[0]], ["test", S[2]]].forEach(([c, s]) => s.tags.forEach(t => {
        const o = (OLD[c] || {})[t.id], m = master.find(x => x.id === t.id); if (!m || !o) return;
        if (t.n && t.n !== o[0]) m.n = t.n;
        if (t.c >= 0 && o[1] >= 0 && t.c !== o[1]) m.c = t.c;
      }));
      [["work", S[1]], ["class", S[0]], ["test", S[2]]].forEach(([c, s]) => s.tags.forEach(t => {
        if (master.some(x => x.id === t.id)) return;
        const same = master.find(x => x.n === t.n); if (same) return;
        master.push({ id: t.id, n: t.n, c: t.c >= 0 ? t.c : 7 });
      }));
    }
    const now = Date.now();
    S.forEach(s => {
      if (s.gen === 1 && key(s) === JSON.stringify(master)) return;
      const old = clone(s.tags);
      if (s.gen !== 1) { const tg = {}; s.docs.forEach(d => { tg[d.id] = d.tag || ""; }); s.genBak = { tags: old, tg }; }   /* 念のため、整理前のジャンルを控えておく */
      remapDocs(s, master, old);
      s.tags = clone(master); s.gen = 1; s.tagsUpd = done.length ? (s.tagsUpd || now) : now;
    });
    STORES.forEach(c => touch(c));
    A.render && A.render();
  }
  /* 「クラス」を、ジャンルから大きな分類へ格上げ（1回だけ）: 校務のメモのうち、ジャンルが「クラス」のものを、分類「クラス」へ移す */
  function hrMig() {
    const W = st("work"); if (!W || W.hr === 1 || !STORES.every(c => st(c).gen === 1)) return;
    W.docs.forEach(d => { if (d.tag === "class") { d.cat = "hr"; d.tag = ""; } });
    STORES.forEach(c => st(c).docs.forEach(d => { if (d.tag === "class") d.tag = ""; }));
    W.hr = 1; W.hr2 = 1;
    const list = clone(tagsNow()).filter(t => t.id !== "class");
    setTags(list);   /* ジャンルの「クラス」は、もう要らない（3つとも保存される） */
    A.render && A.render();
  }
  /* 前の版で「クラス」の印が消えてしまった人のための、1回だけの直し: 最初のジャンルを控えた記録(genBak)を見て、もとクラスだったメモを分類「クラス」へ戻す */
  function hrFix() {
    const W = st("work"); if (!W || W.hr !== 1 || W.hr2 === 1) return;
    const tg = (W.genBak && W.genBak.tg) || {}; let n = 0;
    W.docs.forEach(d => { if (tg[d.id] === "class" && !d.cat) { d.cat = "hr"; n++; } });
    W.hr2 = 1; touch("work"); if (n) A.render && A.render();
  }
  function reconcileCats() {   /* 分類の一覧を、3つの入れものでそろえる */
    const S = STORES.map(c => st(c)), key = s => JSON.stringify(s.cats || null), have = S.filter(s => Array.isArray(s.cats) && s.cats.length);
    if (have.length === 3 && S.every(s => key(s) === key(S[0]))) return;
    const best = have.length ? have.reduce((a, b) => ((b.catsUpd || 0) > (a.catsUpd || 0) ? b : a)) : null;
    const master = best ? clone(best.cats) : clone(DEFCATS), now = best ? (best.catsUpd || Date.now()) : Date.now();
    S.forEach(s => { s.cats = clone(master); s.catsUpd = now; });
    STORES.forEach(c => touch(c)); A.render && A.render();
  }
  function reconcile() {
    if (!STORES.every(isReady)) return;   /* 3つとも読みこめてから */
    reconcileTags(); hrMig(); hrFix(); reconcileCats();
  }
  const rec = setInterval(() => { reconcile(); if (STORES.every(isReady) && STORES.every(c => st(c).gen === 1 && Array.isArray(st(c).cats)) && st("work").hr === 1 && st("work").hr2 === 1) { /* 以後も、別の端末での変更を拾うため、ゆっくり見張る */ clearInterval(rec); setInterval(reconcile, 30000); } }, 1000);

  function setCats(list) {   /* ここで直したら、3つとも同じにする */
    const now = Date.now();
    STORES.forEach(c => { const s = st(c); if (!s) return; s.cats = clone(list); s.catsUpd = now; touch(c); });
  }
  function setTags(list) {   /* ここで直したら、3つとも同じにする */
    const now = Date.now();
    STORES.forEach(c => { const s = st(c); if (!s) return; s.tags = clone(list); s.tagsUpd = now; s.gen = 1; touch(c); });
  }

  /* ---------- メモの集め方 ---------- */
  const all = () => { const o = []; STORES.forEach(k => { const S = st(k); if (S) S.docs.forEach(d => o.push({ c: catOf(k, d), d, s: S, sk: k })); }); return o; };
  const find = k => {
    const i = k.indexOf(":"), c = k.slice(0, i), id = k.slice(i + 1), l = all();
    return l.find(x => x.d.id === id && x.c === c) || l.find(x => x.d.id === id) || null;   /* 分類が変わったあとの古い印でも、番号で見つかるように */
  };
  A.memo.otherDocs = () => [["class", "授業"], ["test", "テスト成績"]].flatMap(([c, n]) => { const s = st(c); return s ? s.docs.map(d => ({ id: d.id, t: d.t, cat: n })) : []; });

  function move(it, to) {
    const dst = st(to); if (!dst || it.c === to) return;
    const from = it.s, d = it.d, toK = sk(to);
    if (from !== dst) {   /* ファイルをまたぐ移動 */
      from.docs.splice(from.docs.indexOf(d), 1); from.tipOrder = (from.tipOrder || []).filter(x => x !== d.id);
      if (it.sk === "work") { from.moved = from.moved || {}; from.moved[d.id] = toK; }   /* 校務のタスクの「手順メモ」リンクが、移したあとも開けるように */
      if (toK === "work" && dst.moved) delete dst.moved[d.id];
      if (dst.docs.some(x => x.id === d.id)) {   /* 同じ番号のメモが移し先にあるときは、番号を付け替える（タスクの手順リンクも合わせる） */
        const old = d.id; d.id = old + "_" + (uid++);
        if (it.sk === "work" && from.tasks) from.tasks.forEach(x => { if (x.p === old) x.p = d.id; });
        if (from.moved) delete from.moved[old];
      }
      d.ls = d.ls || []; d.img = d.img || []; d.kw = d.kw || ""; d.go = d.go || ""; d.u = d.u || ""; d.ut = d.ut || ""; d.b = d.b || ""; d.tag = d.tag || "";
      dst.docs.unshift(d);
    }
    if (to === toK) delete d.cat; else d.cat = to;   /* 同じ入れものの中の移動は、印を付けかえるだけ */
    touch(it.c); touch(to);
    ui.edit = to + ":" + d.id; ui.open[to + ":" + d.id] = true;
  }

  /* ---------- 画面 ---------- */
  function banners() { return STORES.map(c => { const m = mod(c); return m && m.banner ? m.banner() : ""; }).join(""); }
  const chip = t => '<span class="tgchip tgx tg-' + (t ? t.c : "n") + '">' + esc(t ? t.n : "ジャンルなし") + "</span>";
  function match(it, scope) {
    const cf = ui.cat[scope], q = nf(ui.q).split(/\s+/).filter(Boolean), tg = tagsNow().find(x => x.id === it.d.tag);
    if (cf !== "all" && it.c !== cf) return false;
    if (ui.g && it.d.tag !== ui.g) return false;
    const txt = nf(it.d.t + " " + it.d.b + " " + (tg ? tg.n : "") + " " + cinfo(it.c).n);
    return q.every(w => txt.indexOf(w) >= 0);
  }
  function card(it) {
    const d = it.d, k = it.c + ":" + d.id, t = tagsNow().find(x => x.id === d.tag), ed = ui.edit === k;
    const sum = '<summary><span class="mo-lab" style="background:' + ccol(it.c) + ';color:' + INK + '">' + esc(cinfo(it.c).n) + '</span><span class="wdt">' + esc(d.t || "（無題）") + "</span>" + (t ? chip(t) : "") + (d.tip ? '<span class="tsstar on tsmini">★</span>' : "") + "</summary>";
    let b;
    if (!ed) {
      b = '<div class="tsmv">' + md2h(d.b || "") + "</div>" + imgs(d) + (dl(d).length ? '<div class="wlnks">' + lnkH(d) + "</div>" : "") +
        '<div class="btns" style="margin-top:8px"><button class="btn" data-ma="edit" data-k="' + esc(k) + '">編集する</button><button class="btn" data-ma="star" data-k="' + esc(k) + '">' + (d.tip ? "★ 重要から外す" : "☆ 重要にする（ホームの重要Tipsに出す）") + "</button></div>";
    } else {
      const ls = d.ls || [];
      const row = (tt, u, fn, fu, j, ph) => '<div class="wlrow"><input type="text" value="' + esc(tt) + '" placeholder="' + ph + '" data-mf="' + fn + '" data-k="' + esc(k) + '" data-j="' + j + '" aria-label="リンクの名前"><input type="url" value="' + esc(u) + '" placeholder="https://…" data-mf="' + fu + '" data-k="' + esc(k) + '" data-j="' + j + '" autocomplete="off" aria-label="リンクのURL">' +
        '<span class="wlbtn"><button type="button" class="btn sm" data-ma="lmv" data-k="' + esc(k) + '" data-j="' + j + '" data-d="-1" aria-label="ひとつ上へ"' + (j < 0 ? " disabled" : "") + '>↑</button><button type="button" class="btn sm" data-ma="lmv" data-k="' + esc(k) + '" data-j="' + j + '" data-d="1" aria-label="ひとつ下へ"' + (j + 1 >= ls.length ? " disabled" : "") + '>↓</button>' +
        (j >= 0 ? '<button class="btn sm" data-ma="ldel" data-k="' + esc(k) + '" data-j="' + j + '">消す</button>' : "<span></span>") + "</span></div>";
      const sel = (f, cur, opts) => '<select data-mc="' + f + '" data-k="' + esc(k) + '" style="width:auto">' + opts.map(o => '<option value="' + esc(o[0]) + '"' + (cur === o[0] ? " selected" : "") + ">" + esc(o[1]) + "</option>").join("") + "</select>";
      b = '<div class="wcard" style="border:0;padding:4px 0 8px"><label>見出し</label><input type="text" value="' + esc(d.t) + '" data-mf="t" data-k="' + esc(k) + '">' +
        '<div class="mm-pick"><label class="tsimp">分類： ' + sel("cat", it.c, catsNow().map(x => [x.id, x.n])) + '</label><label class="tsimp">ジャンル： ' + sel("tag", d.tag || "", [["", "なし"]].concat(tagsNow().map(x => [x.id, x.n]))) + "</label></div>" +
        '<label class="tsimp"><input type="checkbox" data-mc="tip" data-k="' + esc(k) + '"' + (d.tip ? " checked" : "") + "> 重要（ホームの重要Tipsに出す）</label>" +
        '<label class="tsimp">重要Tipsのボタンを押したら： ' + sel("go", d.go || "", [["", "自動（説明が空なら資料をすぐ開く／説明があれば説明を出す）"], ["link", "いつも資料をすぐ開く"], ["detail", "いつも説明を出す"]]) + "</label>" +
        (it.c === "class" ? '<label>今日の授業で目立たせる言葉（空でもOK。例：古文，漢文。授業の単元名やクラス名に含まれると、授業の「今日」でこのTipsが目立ちます）</label><input type="text" value="' + esc(d.kw || "") + '" data-mf="kw" data-k="' + esc(k) + '" placeholder="例：古文，言語文化">' : "") +
        '<div class="wlset"><b class="small">資料リンク（最大8つ。名前は、押すボタンに出ます）</b>' + row(d.ut || "", d.u || "", "ut", "u", -1, "リンク1の名前") + ls.map((x, j) => row(x.t, x.u, "lt", "lu", j, "リンク" + (j + 2) + "の名前")).join("") + (1 + ls.length < 8 ? '<button class="btn sm" data-ma="ladd" data-k="' + esc(k) + '">＋ リンクを足す</button>' : "") + "</div>" +
        '<label>本文（「# 」見出し・「- 」箇条書き・「1. 」番号・「|表|」・上のボタンで 太字・赤字・青字・下線、[名前](URL) が使えます）</label>' + A.rt.bar() + '<textarea rows="24" data-mf="b" data-k="' + esc(k) + '">' + esc(d.b || "") + "</textarea>" + imgs(d) +
        (it.sk === "work" && A.work && A.work.usedByH ? A.work.usedByH(d) : "") +
        '<div class="btns"><button class="btn on" data-ma="done">編集を終える</button><button class="btn danger" data-ma="del" data-k="' + esc(k) + '">このメモを削除</button></div></div>';
    }
    return '<details class="wdet wdoc mo-card" style="border-left-color:' + ccol(it.c) + '" data-mk="' + esc(k) + '" data-id="' + esc(d.id) + '" data-ph="d' + esc(d.id) + '"' + (ui.open[k] || ed ? " open" : "") + ">" + sum + b + "</details>";
  }
  function listH(scope) {
    const tags = tagsNow(), known = {}; tags.forEach(t => { known[t.id] = 1; });
    const items = all().filter(it => match(it, scope));
    if (!items.length) return '<p class="note" style="margin:0">該当するメモがありません。</p>';
    const rank = it => (it.c === scope ? 0 : 1);   /* 同じジャンルの中では、いま開いているモードのメモを先に */
    const sect = (t, l) => l.length ? '<div class="tgh">' + chip(t) + '<span class="tgn">' + l.length + "件</span></div>" + l.sort((a, b) => rank(a) - rank(b)).map(card).join("") : "";
    return sect(null, items.filter(x => !known[x.d.tag])) + tags.map(t => sect(t, items.filter(x => x.d.tag === t.id))).join("");   /* ジャンルなしは一番上 */
  }
  function mgrH() {
    const tags = tagsNow(), cs = catsNow();
    const swatch = (c, f, i) => '<select data-mg="' + f + '" data-i="' + i + '" aria-label="色" style="border-left:6px solid ' + (CPAL[c] || CPAL[7]) + '">' + CNAME.map((n, k) => '<option value="' + k + '"' + (c === k ? " selected" : "") + ">" + n + "</option>").join("") + "</select>";
    return '<details class="wdet" data-ph="mgr"' + (ui.mgr ? " open" : "") + "><summary><b>分類とジャンルを管理する（増やす・減らす・名前・色・順番）</b></summary><div class=\"tsadd\">" +
      '<p class="note" style="margin:6px 0"><b>① 大きな分類</b>（今は ' + cs.map(x => esc(x.n)).join("・") + '）。メモは、ひとつの分類に入ります。▲▼で、ボタンやTipsの並びも変わります。</p>' +
      cs.map((c, i) => '<div class="tstg"><span class="mo-lab" style="background:' + (CPAL[c.c] || CPAL[7]) + ';color:' + INK + '">' + esc(c.n) + '</span><input type="text" value="' + esc(c.n) + '" data-mg="cn" data-i="' + i + '" aria-label="分類の名前">' + swatch(c.c, "cc", i) +
        A.rt.mvBtns(i, cs.length, 'data-ma="cat-mv"') + '<button class="btn sm danger" data-ma="cat-del" data-i="' + i + '"' + (cs.length < 2 ? " disabled" : "") + ">消す</button></div>").join("") +
      '<div class="tstg"><input type="text" id="mm_cn" placeholder="新しい分類の名前（例：部活動）"><select id="mm_cc">' + CNAME.map((n, k) => '<option value="' + k + '">' + n + "</option>").join("") + '</select><button class="btn on" data-ma="cat-add">分類を足す</button></div>' +
      '<div class="tstg"><span class="note">分類を消すとき、その中のメモの移し先：</span><select id="mm_cto">' + cs.map(c => '<option value="' + esc(c.id) + '">' + esc(c.n) + "</option>").join("") + "</select></div>" +
      '<p class="note" style="margin:14px 0 6px"><b>② ジャンル</b>（分類の下の細かい分け。どの分類でも共通です）。▲▼で順番を変えると、メモの一覧も、重要Tipsも、その順に並びます。</p>' +
      tags.map((t, i) => '<div class="tstg"><span class="tgchip tgx tg-' + t.c + '">' + esc(t.n) + '</span><input type="text" value="' + esc(t.n) + '" data-mg="n" data-i="' + i + '" aria-label="ジャンルの名前"><select data-mg="c" data-i="' + i + '" aria-label="色">' + TGN.map((n, c) => '<option value="' + c + '"' + (t.c === c ? " selected" : "") + ">" + n + "</option>").join("") + "</select>" +
        A.rt.mvBtns(i, tags.length, 'data-ma="tag-mv"') + '<button class="btn sm danger" data-ma="tag-del" data-i="' + i + '">消す</button></div>').join("") +
      '<div class="tstg"><input type="text" id="mm_tn" placeholder="新しいジャンルの名前"><select id="mm_tc">' + TGN.map((n, c) => '<option value="' + c + '">' + n + '</option>').join("") + '</select><button class="btn on" data-ma="tag-add">ジャンルを足す</button></div></div></details>';
  }
  A.memo.view = function (scope) {
    const loaded = STORES.some(c => st(c));
    if (!loaded) return '<p class="note">読み込み中…</p>';
    const cs = catsNow();
    if (!ui.cat[scope]) ui.cat[scope] = scope;
    if (ui.cat[scope] !== "all" && !cs.some(x => x.id === ui.cat[scope])) ui.cat[scope] = "all";   /* その分類が消えているときは「すべて」 */
    const cnt = {}; all().forEach(it => { cnt[it.c] = (cnt[it.c] || 0) + 1; });
    const total = all().length, cf = ui.cat[scope];
    const inCat = all().filter(it => cf === "all" || it.c === cf), used = {}; inCat.forEach(it => { used[it.d.tag] = (used[it.d.tag] || 0) + 1; });
    let h = banners();
    h += '<div class="pghd"><div><h2 class="pgt">MEMO</h2><p class="pgs">手順やメモを、「分類」と「ジャンル」の2段で整理できます。★を付けると、どのホームの「重要Tips」にも出ます。</p></div></div>';
    h += '<div class="tsbar"><input type="search" id="mm_q" placeholder="手順・メモをさがす（全部のメモから）" value="' + esc(ui.q) + '" autocomplete="off"><button class="btn on" data-ma="add" data-s="' + scope + '" style="white-space:nowrap">＋ 新しいメモ</button></div>';
    h += '<div class="tsseg mmseg mm-cat"><button class="btn' + (cf === "all" ? " on" : "") + '" data-ma="cat" data-s="' + scope + '" data-v="all">すべて ' + total + "</button>" +
      cs.map(x => '<button class="btn mm-cb' + (cf === x.id ? " on" : "") + '" style="--cc:' + (CPAL[x.c] || CPAL[7]) + '" data-ma="cat" data-s="' + scope + '" data-v="' + esc(x.id) + '">' + esc(x.n) + " " + (cnt[x.id] || 0) + "</button>").join("") + "</div>";
    h += '<div class="tsseg mmseg"><button class="btn' + (ui.g ? "" : " on") + '" data-ma="gen" data-v="">ジャンル：すべて</button>' +
      tagsNow().filter(t => used[t.id] || ui.g === t.id).map(t => '<button class="btn' + (ui.g === t.id ? " on" : "") + '" data-ma="gen" data-v="' + esc(t.id) + '">' + esc(t.n) + " " + (used[t.id] || 0) + "</button>").join("") + "</div>";
    h += '<div id="mm_l" data-s="' + scope + '">' + listH(scope) + "</div>" + mgrH();
    return h;
  };
  A.views.memo = () => A.memo.view("class");

  /* 重要Tipsの窓から「編集する」で来たとき、いまのモードのまま、そのメモを開く */
  A.memo.openDoc = function (src, id, edit) {
    const sc = A.ui.mode === "work" || A.ui.mode === "test" ? A.ui.mode : "class";
    ui.cat[sc] = "all"; ui.g = ""; ui.q = ""; ui.open[src + ":" + id] = true; if (edit) ui.edit = src + ":" + id;
    if (sc === "class") A.ui.tab = "memo"; else if (sc === "work") A.ui.work.tab = "docs"; else A.ui.test.tab = "man";
  };

  /* ---------- 操作 ---------- */
  function refreshList() { const l = $("mm_l"); if (l) l.innerHTML = listH(l.dataset.s); }
  document.addEventListener("toggle", e => { const d = e.target; if (!d || d.tagName !== "DETAILS") return; if (d.dataset.mk) ui.open[d.dataset.mk] = d.open; else if (d.dataset.ph === "mgr") ui.mgr = d.open; }, true);
  document.addEventListener("click", e => {
    const t = e.target.closest && e.target.closest("[data-ma]"); if (!t) return;
    const a = t.dataset.ma, k = t.dataset.k, it = k ? find(k) : null, s = t.dataset.s;
    switch (a) {
      case "cat": ui.cat[s] = t.dataset.v; ui.g = ""; A.render(); return;
      case "gen": ui.g = t.dataset.v; A.render(); return;
      case "add": {
        const cf = ui.cat[s], c0 = cf === "all" ? s : cf, c = catsNow().some(x => x.id === c0) ? c0 : catsNow()[0].id, dst = st(c); if (!dst) return;
        const d = { id: "d" + (uid++), t: "新しいメモ", b: "", u: "", ut: "", ls: [], tip: false, kw: "", img: [], tag: ui.g || "", go: "" };
        if (c !== sk(c)) d.cat = c;
        dst.docs.unshift(d); ui.open[c + ":" + d.id] = true; ui.edit = c + ":" + d.id; touch(c); A.render(); return;
      }
      case "edit": ui.edit = k; ui.open[k] = true; A.render(); return;
      case "done": ui.edit = null; A.render(); return;
      case "star": if (it) { it.d.tip = !it.d.tip; ui.open[k] = true; touch(it.c); A.render(); } return;
      case "del": if (it && root.confirm("このメモを削除しますか？")) { it.s.docs.splice(it.s.docs.indexOf(it.d), 1); it.s.tipOrder = (it.s.tipOrder || []).filter(x => x !== it.d.id); ui.edit = null; touch(it.c); A.render(); } return;
      case "ladd": if (it && 1 + (it.d.ls || []).length < 8) { it.d.ls = it.d.ls || []; it.d.ls.push({ t: "", u: "" }); touch(it.c); A.render(); } return;
      case "lmv": { if (!it) return; const d = it.d, all0 = [{ t: d.ut || "", u: d.u || "" }].concat(d.ls || []), x = +t.dataset.j + 1, y = x + (+t.dataset.d); if (y < 0 || y >= all0.length) return; const z = all0[x]; all0[x] = all0[y]; all0[y] = z; d.ut = all0[0].t; d.u = all0[0].u; d.ls = all0.slice(1); touch(it.c); A.render(); return; }
      case "ldel": if (it) { it.d.ls.splice(+t.dataset.j, 1); touch(it.c); A.render(); } return;
      case "cat-add": { const n = ($("mm_cn").value || "").trim(); if (!n) { root.alert("分類の名前を入れてください。"); return; } const l = clone(catsNow()); l.push({ id: "k" + (uid++), n, c: +$("mm_cc").value || 0 }); setCats(l); ui.mgr = true; A.render(); return; }
      case "cat-mv": { const l = clone(catsNow()); if (A.rt.mv(l, +t.dataset.i, +t.dataset.d)) { setCats(l); ui.mgr = true; A.render(); } return; }
      case "cat-del": {
        const l = clone(catsNow()), g = l[+t.dataset.i]; if (!g || l.length < 2) return;
        const to = ($("mm_cto") || {}).value, tgt = l.find(x => x.id === to && x.id !== g.id) || l.find(x => x.id !== g.id), mine = all().filter(x => x.c === g.id);
        if (!root.confirm("分類「" + g.n + "」を消しますか？" + (mine.length ? "\n中のメモ " + mine.length + " 件は、「" + tgt.n + "」に移します。" : ""))) return;
        mine.forEach(x => move(x, tgt.id)); ui.edit = null;
        l.splice(+t.dataset.i, 1); setCats(l);
        Object.keys(ui.cat).forEach(k => { if (ui.cat[k] === g.id) ui.cat[k] = "all"; });
        ui.mgr = true; A.render(); return;
      }
      case "tag-add": { const n = ($("mm_tn").value || "").trim(); if (!n) { root.alert("ジャンルの名前を入れてください。"); return; } const l = clone(tagsNow()); l.push({ id: "g" + (uid++), n, c: +$("mm_tc").value || 0 }); setTags(l); ui.mgr = true; A.render(); return; }
      case "tag-mv": { const l = clone(tagsNow()); if (A.rt.mv(l, +t.dataset.i, +t.dataset.d)) { setTags(l); ui.mgr = true; A.render(); } return; }
      case "tag-del": { const l = clone(tagsNow()), g = l[+t.dataset.i]; if (g && root.confirm("ジャンル「" + g.n + "」を消しますか？（メモは残り、ジャンルだけ外れます）")) { all().forEach(x => { if (x.d.tag === g.id) x.d.tag = ""; }); l.splice(+t.dataset.i, 1); if (ui.g === g.id) ui.g = ""; setTags(l); ui.mgr = true; A.render(); } return; }
    }
  });
  document.addEventListener("change", e => {
    const t = e.target, f = t.dataset && t.dataset.mc, g = t.dataset && t.dataset.mg;
    if (f) {
      const it = find(t.dataset.k); if (!it) return;
      if (f === "cat") { move(it, t.value); A.render(); return; }
      if (f === "tag") it.d.tag = t.value; else if (f === "go") it.d.go = t.value; else if (f === "tip") it.d.tip = t.checked;
      touch(it.c); if (f !== "go") A.render(); return;
    }
    if (g === "c") { const l = clone(tagsNow()), x = l[+t.dataset.i]; if (x) { x.c = +t.value || 0; setTags(l); ui.mgr = true; A.render(); } }
    if (g === "cc") { const l = clone(catsNow()), x = l[+t.dataset.i]; if (x) { x.c = +t.value || 0; setCats(l); ui.mgr = true; A.render(); } }
  });
  document.addEventListener("input", e => {
    const t = e.target;
    if (t.id === "mm_q") { ui.q = t.value; refreshList(); return; }
    if (t.dataset && t.dataset.mg === "cn") { const l = clone(catsNow()), x = l[+t.dataset.i]; if (x) { x.n = t.value; setCats(l); } return; }
    if (t.dataset && t.dataset.mg === "n") { const l = clone(tagsNow()), x = l[+t.dataset.i]; if (x) { x.n = t.value; setTags(l); } return; }
  });
  document.addEventListener("input", e => {   /* 見出し・本文・リンクなどの入力を、そのメモに反映 */
    const t = e.target, f = t.dataset && t.dataset.mf; if (!f) return;
    const it = find(t.dataset.k); if (!it) return;
    const d = it.d, j = +t.dataset.j;
    if (f === "t") d.t = t.value; else if (f === "b") d.b = t.value; else if (f === "u") d.u = t.value; else if (f === "ut") d.ut = t.value; else if (f === "kw") d.kw = t.value;
    else if (f === "lt") d.ls[j].t = t.value; else if (f === "lu") d.ls[j].u = t.value;
    touch(it.c);
  });
})(window);
