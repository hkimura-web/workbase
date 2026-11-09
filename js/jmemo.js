/* THE WORKBASE: 「授業」の手順・メモ（テスト成績・校務の「手順・メモ」と同じ形）
 *  - データ: data/jugyomemo.json（トークンがあれば GitHub に自動保存。なければこの端末の下書き）
 *  - ★を付けたものは、どのホームの「重要Tips」にも出ます */
(function (root) {
  "use strict";
  const J = root.JD, S = root.JDStore, A = root.A, LS = S.LS, esc = J.esc;
  const $ = id => document.getElementById(id);
  const FILE = "data/jugyomemo.json", DK = "jd.draft.jugyomemo";
  const Q = { S: null, sha: null, dirty: false, saving: false, timer: null, token: false, conflict: false, ask: false, needCreate: false, draftP: null, canSave: true, ready: false };
  const ui = { dq: "", dtag: "", dedit: null, det: {} };
  const TGN = ["ピンク", "ブルー", "グリーン", "オレンジ", "パープル", "ティール", "レッド", "グレー"];
  const DEFTAGS = () => [{ id: "jugyo", n: "授業", c: 1 }, { id: "kyozai", n: "教材・プリント", c: 2 }, { id: "jimu", n: "事務・提出", c: 3 }];
  A.jmemo = {}; A.ui.memo = ui;
  let uid = Date.now();
  const tagOf = k => Q.S.tags.find(t => t.id === k);
  const dl = d => { const o = []; if (d.u) o.push({ t: d.ut || "リンク1", u: d.u }); d.ls.forEach((x, k) => { if (x.u) o.push({ t: x.t || "リンク" + (k + 2), u: x.u }); }); return o; };
  const goLink = d => { const n = dl(d).length; if (!n) return false; if (d.go === "link") return true; if (d.go === "detail") return false; return n === 1 && !d.b.trim(); };
  const lnkH = d => dl(d).map(x => '<a class="btn wlnk" href="' + esc(x.u) + '" target="_blank" rel="noopener noreferrer">' + esc(x.t) + " ↗</a>").join("");
  const md2h = x => (A.seiseki && A.seiseki.md2h ? A.seiseki.md2h(x) : "<p>" + esc(x) + "</p>");

  function mig(s) {
    s = s && typeof s === "object" ? s : {}; s.v = 1;
    if (!Array.isArray(s.tags) || !s.tags.length) s.tags = DEFTAGS();
    s.tags = s.tags.filter(t => t && t.id).map(t => ({ id: String(t.id), n: String(t.n || "タグ"), c: Math.max(0, Math.min(7, +t.c || 0)) }));
    s.docs = (Array.isArray(s.docs) ? s.docs : []).filter(d => d && d.id).map(d => ({ id: String(d.id), t: String(d.t || "無題"), b: String(d.b || ""), u: String(d.u || ""), ut: String(d.ut || ""), ls: (Array.isArray(d.ls) ? d.ls : []).filter(x => x && typeof x === "object").slice(0, 7).map(x => ({ t: String(x.t || ""), u: String(x.u || "") })), tip: !!d.tip, kw: String(d.kw || ""), img: Array.isArray(d.img) ? d.img.map(String) : [], tag: String(d.tag || ""), go: d.go === "link" || d.go === "detail" ? d.go : "" }));
    s.tipOrder = Array.isArray(s.tipOrder) ? s.tipOrder.map(String) : []; s.upd = s.upd || 0; return s;
  }
  const ghOn = () => { const s = S.getSettings(); return !!(s.token && s.owner && s.repo); };
  async function load() {
    const s = S.getSettings(); Q.token = ghOn(); let text = null;
    if (Q.token) {
      try { const r = await S.remoteGet(s, FILE); text = r.text; Q.sha = r.sha; }
      catch (e) { if (e.status !== 404) Q.canSave = false; else Q.needCreate = true; }
    } else { try { const r = await fetch(FILE + "?t=" + Date.now(), { cache: "no-store" }); if (r.ok) text = await r.text(); } catch (e) { text = null; } }
    let p = null; try { p = text ? JSON.parse(text) : null; } catch (e) { p = null; }
    let dr = null; try { const raw = LS.get(DK); dr = raw ? JSON.parse(raw) : null; } catch (e) { dr = null; }
    if (dr && dr.dirty && dr.p) {
      if (Q.token && Q.sha && dr.base !== Q.sha) { Q.ask = true; Q.draftP = dr.p; } else { p = dr.p; Q.dirty = true; }
    }
    Q.S = mig(p); Q.ready = true;
    if (Q.dirty && Q.token && Q.canSave && !Q.ask) flush();
    A.render && A.render();
  }
  function save() {
    Q.S.upd = Date.now(); Q.dirty = true; LS.set(DK, JSON.stringify({ p: Q.S, dirty: true, base: Q.sha }));
    clearTimeout(Q.timer); Q.timer = setTimeout(flush, 900);
  }
  async function flush() {
    if (!Q.dirty || !Q.token || !Q.canSave || Q.conflict || Q.ask) return;
    if (Q.saving) { clearTimeout(Q.timer); Q.timer = setTimeout(flush, 600); return; }
    Q.saving = true; const snap = JSON.stringify(Q.S);
    try {
      const r = await S.remotePut(S.getSettings(), FILE, J.toJSON(Q.S), Q.sha, "授業の手順・メモを更新");
      Q.sha = r.sha; Q.needCreate = false;
      if (JSON.stringify(Q.S) === snap) { Q.dirty = false; LS.del(DK); } else { clearTimeout(Q.timer); Q.timer = setTimeout(flush, 300); }
    } catch (e) { if (e.status === 409 || e.status === 422) Q.conflict = true; }
    Q.saving = false; if (Q.conflict && A.ui.mode === "class" && A.ui.tab === "memo") A.render();
  }
  async function refresh() {
    if (document.hidden || !Q.ready || !Q.token || Q.saving || Q.dirty || Q.conflict || Q.ask || Q.needCreate || !Q.canSave) return;
    if (document.querySelector("dialog[open]") || (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) return;
    try { const r = await S.remoteGet(S.getSettings(), FILE); if (r.sha !== Q.sha && !Q.dirty && !Q.saving) { Q.sha = r.sha; Q.S = mig(JSON.parse(r.text)); A.render(); } } catch (e) { /* 次の機会に */ }
  }
  document.addEventListener("visibilitychange", refresh); window.addEventListener("focus", refresh); setInterval(refresh, 120000);
  function askH() {
    if (Q.ask) return '<div class="banner err"><div>この端末に、GitHubにまだ保存していない「授業の手順・メモ」の変更があります。どちらを使いますか？</div><div class="btns"><button class="btn" data-jact="draft-drop">GitHubの最新を使う</button><button class="btn" data-jact="draft-use">この端末の内容を使う</button></div></div>';
    if (Q.conflict) return '<div class="banner err"><div>別の端末で先に更新されています。</div><div class="btns"><button class="btn" data-jact="reload">最新を読み込み直す</button></div></div>';
    return "";
  }

  /* ---------- 重要Tips（共通の帯に渡す） ---------- */
  A.jmemo.setTipOrder = ids => { Q.S.tipOrder = ids; save(); };
  A.jmemo.tips = function () {
    if (!Q.ready || !Q.S) return [];
    const ord = d => { const i = Q.S.tags.findIndex(x => x.id === d.tag); return i < 0 ? 99 : i; };
    const to = Q.S.tipOrder || [], pos = d => { const i = to.indexOf(d.id); return i < 0 ? 1e6 : i; };
    return Q.S.docs.map((d, k) => [d, k]).filter(x => x[0].tip).sort((a, b) => (to.length ? pos(a[0]) - pos(b[0]) : 0) || ord(a[0]) - ord(b[0]) || a[1] - b[1]).map(([d]) => {
      const t = tagOf(d.tag);
      return { src: "class", id: d.id, t: d.t, cls: "t-sclass", tag: t ? t.n : "", href: goLink(d) ? dl(d)[0].u : "", n: dl(d).length, kw: d.kw || "", sortable: true,
        detail: () => '<div class="tsmv-in" style="margin-top:8px">' + (d.b.trim() ? md2h(d.b) : "") + "</div>" + (A.work && A.work.imgsH ? A.work.imgsH(d) : "") + (dl(d).length ? '<div class="wlnks">' + lnkH(d) + "</div>" : "") };
    });
  };

  A.jmemo.alldocs = function () {
    if (!Q.ready || !Q.S) return [];
    return Q.S.docs.map(d => { const t = tagOf(d.tag); return { src: "class", id: d.id, t: d.t, tag: t ? t.n : "", star: !!d.tip,
      detail: () => '<div class="tsmv-in">' + (d.b.trim() ? md2h(d.b) : "") + "</div>" + (A.work && A.work.imgsH ? A.work.imgsH(d) : "") + (dl(d).length ? '<div class="wlnks">' + lnkH(d) + "</div>" : "") }; });
  };
  A.jmemo.openDoc = id => { ui.det["d" + id] = true; A.ui.tab = "memo"; };

  /* ---------- 画面 ---------- */
  const docMatch = d => { const q = ui.dq.trim().toLowerCase(); return (!ui.dtag || d.tag === ui.dtag) && (!q || (d.t + " " + d.b).toLowerCase().includes(q)); };
  function docCard(d, i) {
    const t = tagOf(d.tag), ed = ui.dedit === d.id, k = "d" + d.id;
    const sum = '<summary><span class="wdt">' + esc(d.t || "（無題）") + "</span>" + (t ? '<span class="tgchip tgx tg-' + t.c + '">' + esc(t.n) + "</span>" : "") + (d.tip ? '<span class="tsstar on tsmini">★</span>' : "") + "</summary>";
    let b;
    if (!ed) b = '<div class="tsmv">' + md2h(d.b) + "</div>" + (A.work && A.work.imgsH ? A.work.imgsH(d) : "") + (dl(d).length ? '<div class="wlnks">' + lnkH(d) + "</div>" : "") + '<div class="btns" style="margin-top:8px"><button class="btn" data-jact="doc-edit" data-id="' + d.id + '">編集する</button><button class="btn" data-jact="doc-star" data-i="' + i + '">' + (d.tip ? "★ 重要から外す" : "☆ 重要にする（ホームに出す）") + "</button></div>";
    else {
      const row = (tt, u, fn, fu, j, ph) => '<div class="wlrow"><input type="text" value="' + esc(tt) + '" placeholder="' + ph + '" data-jf="' + fn + '" data-i="' + i + '" data-j="' + j + '" aria-label="リンクの名前"><input type="url" value="' + esc(u) + '" placeholder="https://…" data-jf="' + fu + '" data-i="' + i + '" data-j="' + j + '" autocomplete="off" aria-label="リンクのURL">' + '<span class="wlbtn"><button type="button" class="btn sm" data-jact="doc-lmv" data-i="' + i + '" data-j="' + j + '" data-d="-1" aria-label="ひとつ上へ"' + (j < 0 ? " disabled" : "") + '>↑</button><button type="button" class="btn sm" data-jact="doc-lmv" data-i="' + i + '" data-j="' + j + '" data-d="1" aria-label="ひとつ下へ"' + (j + 1 >= d.ls.length ? " disabled" : "") + '>↓</button>' + (j >= 0 ? '<button class="btn sm" data-jact="doc-ldel" data-i="' + i + '" data-j="' + j + '">消す</button>' : "<span></span>") + "</span></div>";
      b = '<div class="wcard" style="border:0;padding:4px 0 8px"><label>見出し</label><input type="text" value="' + esc(d.t) + '" data-jf="doc-t" data-i="' + i + '">' +
        '<label class="tsimp">タグ： <select data-jchg="doc-tag" data-i="' + i + '" style="width:auto"><option value="">なし</option>' + Q.S.tags.map(x => '<option value="' + x.id + '"' + (d.tag === x.id ? " selected" : "") + ">" + esc(x.n) + "</option>").join("") + "</select></label>" +
        '<label>今日の授業で目立たせる言葉（空でもOK。例：古文，漢文。授業の単元名やクラス名に含まれると、授業の「今日」でこのTipsが目立ちます）</label><input type="text" value="' + esc(d.kw) + '" data-jf="doc-kw" data-i="' + i + '" placeholder="例：古文，言語文化">' +
        '<label class="tsimp"><input type="checkbox" data-jchg="doc-tip" data-i="' + i + '"' + (d.tip ? " checked" : "") + "> 重要（ホームの重要Tipsに出す）</label>" +
        '<label class="tsimp">重要Tipsのボタンを押したら： <select data-jchg="doc-go" data-i="' + i + '" style="width:auto"><option value="">自動（説明が空なら資料をすぐ開く／説明があれば説明を出す）</option><option value="link"' + (d.go === "link" ? " selected" : "") + '>いつも資料をすぐ開く</option><option value="detail"' + (d.go === "detail" ? " selected" : "") + ">いつも説明を出す</option></select></label>" +
        '<div class="wlset"><b class="small">資料リンク（最大8つ。名前は、押すボタンに出ます）</b>' + row(d.ut, d.u, "doc-ut", "doc-u", -1, "リンク1の名前") + d.ls.map((x, j) => row(x.t, x.u, "doc-lt", "doc-lu", j, "リンク" + (j + 2) + "の名前")).join("") + (1 + d.ls.length < 8 ? '<button class="btn sm" data-jact="doc-ladd" data-i="' + i + '">＋ リンクを足す</button>' : "") + "</div>" +
        '<label>本文（「# 」見出し・「- 」箇条書き・「1. 」番号・「|表|」・上のボタンで 太字・赤字・青字・下線、[名前](URL) が使えます）</label>' + A.rt.bar() + '<textarea rows="24" data-jf="doc-b" data-i="' + i + '">' + esc(d.b) + "</textarea>" +
        '<div class="btns"><button class="btn on" data-jact="doc-done">編集を終える</button><button class="btn danger" data-jact="doc-del" data-i="' + i + '">このメモを削除</button></div></div>';
    }
    return '<details class="wdet wdoc" data-ph="' + k + '"' + (ui.det[k] || ed ? " open" : "") + ">" + sum + b + "</details>";
  }
  const listH = () => Q.S.docs.map((d, i) => docMatch(d) ? docCard(d, i) : "").join("") || '<p class="note" style="margin:0">該当するメモがありません。</p>';
  A.jmemo.view = function () {
    if (!Q.ready) return '<p class="note">読み込み中…</p>';
    let h = askH();
    h += '<div class="pghd"><div><h2 class="pgt">MEMO</h2><p class="pgs">授業の手順やメモ。★を付けると、どのホームの「重要Tips」にも出ます。</p></div></div>';
    h += A.memoHead("class");
    h += '<div class="tsbar"><input type="search" id="jm_q" placeholder="手順・メモをさがす" value="' + esc(ui.dq) + '" autocomplete="off"><button class="btn on" data-jact="doc-add" style="white-space:nowrap">＋ 新しいメモ</button></div>';
    h += '<div class="tsseg"><button class="btn' + (ui.dtag ? "" : " on") + '" data-jact="dtag" data-v="">すべて</button>' + Q.S.tags.map(t => '<button class="btn' + (ui.dtag === t.id ? " on" : "") + '" data-jact="dtag" data-v="' + t.id + '">' + esc(t.n) + "</button>").join("") + "</div>";
    h += '<div id="jm_l">' + listH() + "</div>" + A.memoOthers("class");
    h += '<details class="wdet" data-ph="tagmgr"' + (ui.det.tagmgr ? " open" : "") + "><summary><b>タグを管理する（増やす・名前や色を変える）</b></summary><div class=\"tsadd\">" +
      Q.S.tags.map((t, i) => '<div class="tstg"><span class="tgchip tgx tg-' + t.c + '">' + esc(t.n) + '</span><input type="text" value="' + esc(t.n) + '" data-jf="tag-n" data-i="' + i + '" aria-label="タグの名前"><select data-jchg="tag-c" data-i="' + i + '" aria-label="色">' + TGN.map((n, c) => '<option value="' + c + '"' + (t.c === c ? " selected" : "") + ">" + n + "</option>").join("") + '</select><button class="btn sm danger" data-jact="tag-del" data-i="' + i + '">消す</button></div>').join("") +
      '<div class="tstg"><input type="text" id="jm_tn" placeholder="新しいタグの名前"><select id="jm_tc">' + TGN.map((n, c) => '<option value="' + c + '">' + n + "</option>").join("") + '</select><button class="btn on" data-jact="tag-add">タグを足す</button></div></div></details>';
    return h;
  };
  document.addEventListener("toggle", e => { const d = e.target; if (d && d.tagName === "DETAILS" && d.dataset.ph && A.ui.mode === "class" && A.ui.tab === "memo") ui.det[d.dataset.ph] = d.open; }, true);
  document.addEventListener("click", e => {
    const t = e.target.closest && e.target.closest("[data-jact]"); if (!t || !Q.S) return;
    const a = t.dataset.jact, S0 = Q.S, i = +t.dataset.i;
    switch (a) {
      case "draft-drop": LS.del(DK); Q.ask = false; Q.draftP = null; Q.dirty = false; load(); return;
      case "draft-use": Q.S = mig(Q.draftP); Q.draftP = null; Q.ask = false; Q.dirty = true; save(); A.render(); return;
      case "reload": S.remoteGet(S.getSettings(), FILE).then(r => { Q.sha = r.sha; Q.S = mig(JSON.parse(r.text)); Q.conflict = false; Q.dirty = false; LS.del(DK); A.render(); }).catch(x => root.alert(S.explain(x))); return;
      case "dtag": ui.dtag = t.dataset.v; A.render(); return;
      case "doc-add": { const nid = "d" + (uid++); S0.docs.unshift({ id: nid, t: "新しいメモ", b: "", u: "", ut: "", ls: [], tip: false, kw: "", tag: ui.dtag || "", go: "" }); ui.det["d" + nid] = true; ui.dedit = nid; save(); A.render(); return; }
      case "doc-edit": ui.dedit = t.dataset.id; ui.det["d" + t.dataset.id] = true; A.render(); return;
      case "doc-done": ui.dedit = null; A.render(); return;
      case "doc-star": { const d = S0.docs[i]; if (d) { d.tip = !d.tip; ui.det["d" + d.id] = true; save(); A.render(); } return; }
      case "doc-del": if (root.confirm("このメモを削除しますか？")) { S0.docs.splice(i, 1); ui.dedit = null; save(); A.render(); } return;
      case "doc-ladd": { const d = S0.docs[i]; if (d && 1 + d.ls.length < 8) { d.ls.push({ t: "", u: "" }); save(); A.render(); } return; }
      case "doc-lmv": { const d = S0.docs[i]; if (!d) return; const all = [{ t: d.ut, u: d.u }].concat(d.ls), a = +t.dataset.j + 1, b = a + (+t.dataset.d); if (b < 0 || b >= all.length) return; const x = all[a]; all[a] = all[b]; all[b] = x; d.ut = all[0].t; d.u = all[0].u; d.ls = all.slice(1); save(); A.render(); return; }
      case "doc-ldel": { const d = S0.docs[i]; if (d) { d.ls.splice(+t.dataset.j, 1); save(); A.render(); } return; }
      case "tag-add": { const n = ($("jm_tn").value || "").trim(); if (!n) return; S0.tags.push({ id: "g" + (uid++), n, c: +$("jm_tc").value || 0 }); ui.det.tagmgr = true; save(); A.render(); return; }
      case "tag-del": { const tg = S0.tags[i]; if (tg && root.confirm("タグ「" + tg.n + "」を消しますか？（メモは残り、タグだけ外れます）")) { S0.docs.forEach(d => { if (d.tag === tg.id) d.tag = ""; }); S0.tags.splice(i, 1); ui.det.tagmgr = true; save(); A.render(); } return; }
    }
  });
  document.addEventListener("change", e => {
    const t = e.target, f = t.dataset && t.dataset.jchg; if (!f || !Q.S) return;
    const i = +t.dataset.i, d = Q.S.docs[i];
    if (f === "doc-tag" && d) d.tag = t.value; else if (f === "doc-go" && d) d.go = t.value; else if (f === "doc-tip" && d) d.tip = t.checked;
    else if (f === "tag-c") { const tg = Q.S.tags[i]; if (tg) { tg.c = +t.value || 0; ui.det.tagmgr = true; } }
    save(); if (f !== "doc-go") A.render();
  });
  document.addEventListener("input", e => {
    const t = e.target;
    if (t.id === "jm_q") { ui.dq = t.value; const r = $("jm_l"); if (r) r.innerHTML = listH(); return; }
    const f = t.dataset && t.dataset.jf; if (!f || !Q.S) return;
    const i = +t.dataset.i, d = Q.S.docs[i];
    if (f === "tag-n") { const tg = Q.S.tags[i]; if (tg) { tg.n = t.value; save(); } return; }
    if (!d) return;
    if (f === "doc-t") d.t = t.value; else if (f === "doc-b") d.b = t.value; else if (f === "doc-u") d.u = t.value; else if (f === "doc-ut") d.ut = t.value; else if (f === "doc-kw") d.kw = t.value;
    else if (f === "doc-lt") d.ls[+t.dataset.j].t = t.value; else if (f === "doc-lu") d.ls[+t.dataset.j].u = t.value;
    save();
  });
  A.jmemo.ready = () => !!(Q.ready && Q.S && !Q.ask && !Q.conflict && Q.canSave);
  A.jmemo.getDoc = id => (Q.S && Q.S.docs.find(d => d.id === id)) || null;
  A.jmemo.addDocs = function (docs) {
    if (!A.jmemo.ready()) return false;
    if (!Q.S.tags.some(t => t.id === "jugyo")) Q.S.tags.unshift({ id: "jugyo", n: "授業", c: 1 });
    mig({ docs: docs }).docs.forEach(d => { if (!Q.S.docs.some(x => x.id === d.id)) Q.S.docs.push(d); });
    save(); A.render(); return true;
  };
  A.views.memo = () => A.jmemo.view();
  A.jmemo.load = load;
  load();
})(window);
