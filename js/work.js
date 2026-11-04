/* THE WORKBASE: 「校務」モード（1年間の仕事・リンク集・手順メモ・カレンダー）
 *  - 校務のデータ: data/work.json（トークンがあれば GitHub に自動保存。なければこの端末の下書き）
 *  - リンク集の元データ: work/links.json（tools/xlsx_to_work.py でスプレッドシートから作る。アプリでは読むだけ）
 *  - 自分で足したリンク・★は work.json に入る */
(function (root) {
  "use strict";
  const J = root.JD, S = root.JDStore, A = root.A, LS = S.LS, esc = J.esc;
  const { SEED, IMG, RL, tgl, OLDN, DOCS } = root.WSEED;
  const $ = id => document.getElementById(id);
  const ORDER = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
  const now = new Date(), FY = now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  const MAIL = "h.k1(サブ)のGmail";
  const EM = "\nClaudeアカウント: " + MAIL;
  const DAYS = { "前年度の出金伝票": 11, "中間試験問題作成": 28, "面談調査用紙": 20, "スポーツ安全保険": 31 };
  const PAT = { "懇談会(S1)": "d11", "懇談会(S3)": "d12", "夏期面談の実施": "d13", "通知表プレビュー": "d7", "指導要録ほぼ完成": "d8", "指導要録の最終確認": "d8" };
  const PV = ["備考欄の「出停」「忌引」の数字が表と一致", "成績に抜けがない", "委員・係・検定の入力", "欠課時数の合算(遅刻3回=欠課1)"];
  const W = { S: null, links: null, sha: null, dirty: false, saving: false, timer: null, token: false, conflict: false, ask: false, needCreate: false, draftP: null, canSave: true, st: "読み込み中…", ready: false, ed: null };
  const ui = { tab: "home", q: "", grp: "", fav: false, tipSort: false, dq: "", docOpen: {} };
  A.work = {}; A.ui.work = ui;
  /* 授業時間表（分は「0時からの分」）。設定で変えられます */
  const BDEF = { p: { 1: [532, 582], 2: [590, 640], 3: [648, 698], 4: [706, 756], 5: [794, 844], 6: [852, 902], 7: [910, 960] }, yo: 500, gj: 1080, gh: 1125 };
  const hmm = m => Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0");
  const okm = v => typeof v === "number" && v >= 0 && v < 1440;
  function bellMig(b) {
    b = b && typeof b === "object" ? b : {}; const o = { p: {}, yo: okm(b.yo) ? b.yo : BDEF.yo, gj: okm(b.gj) ? b.gj : BDEF.gj, gh: okm(b.gh) ? b.gh : BDEF.gh };
    for (let i = 1; i <= 7; i++) { const x = b.p && b.p[i]; o.p[i] = Array.isArray(x) && okm(x[0]) && okm(x[1]) && x[1] > x[0] ? [x[0], x[1]] : BDEF.p[i].slice(); }
    return o;
  }
  A.work.bell = () => (W && W.S && W.S.bell) || BDEF;
  const dur = m => m >= 60 ? Math.floor(m / 60) + "時間" + (m % 60 ? m % 60 + "分" : "") : m + "分";
  /* 朝の確認の横: 予鈴までの時間／下校までの時間 */
  A.work.bellText = function () {
    const d = new Date(), now = d.getHours() * 60 + d.getMinutes(), b = A.work.bell(), dow = d.getDay();
    if (dow === 0 || dow === 6) return "";
    const gk = W.S && W.S.g === "J" ? b.gj : b.gh;
    if (now < b.yo) return "予鈴 " + hmm(b.yo) + " まで あと" + dur(b.yo - now);
    if (now < gk) return "下校 " + hmm(gk) + " まで あと" + dur(gk - now);
    return "";
  };
  const nl = s => esc(s).replace(/\n/g, "<br>");
  const nfkc = s => String(s == null ? "" : s).normalize("NFKC").toLowerCase();
  const pad = n => String(n).padStart(2, "0");

  /* ---------- データ ---------- */
  const U = k => "https://docs.google.com/" + (k[0] === "s" ? "spreadsheets" : "document") + "/d/" + k.slice(1) + "/edit";
  const LK = { att: 's1coeU3UCaEPLb0k_0bHZIFzzz92B-26jThI2VIURSftA', yo: 'd1nTvqPpJnBGcaREvU8Hw5vh0gi6FHmshaCaP0wv9og9Q', sei: 's1KQE9tKWQsx0PwGnRogI59oAvlAlRAJSJuo8wQh0GIF8', sin: 'd1vWaba5FgTkuGDipEFjhQsgW7g947dzzsMJMNqu-am1Q', san: 's1Z85uVnzohQjYUHYhj1_84ia8kIeV5xb0zcrI7k2x4i8', pro: 'd1WnaKwGZBtXo6bmo58zCQCe4MSZpWb49b1PLKnDJBVGg', dat: 's1nunck2Sur7n2negbkOGUqZXK9B2xQYhLNumqkaakokU', cls: 's1LlrvW2Q69NHbk2mr7MJWbL-try9C9gAuyY9_VXKFDBA', tai: 's19nJUdkpWGQsLZuVlrYDP-6d0ddm6RNIkD0MusiWkjog', sui: 'd1Yz4mAAgKGstWST1GV1BIgFJjfnSqv63Ql5QLCN0genE' };
  const mkT = (a, i) => ({ id: "t" + i, m: a[0], r: a[1], tg: a[2], t: a[3], n: a[4] || "", u: a[5] && LK[a[5]] ? U(LK[a[5]]) : "", p: a[6] || "", c: a[7] === "__PV" ? PV.slice() : [], rep: !!a[8], k: "", dd: 0, lk: [] });
  function san(s) {
    return String(s == null ? "" : s)
      .replace(/Claudeで作成\(hayato\.kimura\.1@gmail\.com のアカウント\)/g, "Claudeアカウント: " + MAIL)
      .replace(/hayato\.kimura\.1@gmail\.com/g, MAIL)
      .replace(/カウンセラー直通[ 　]*[0-9０-９\-－ー]+\n?/g, "");
  }
  function mig(s) {
    s.tasks = s.tasks || []; s.docs = s.docs || [];
    if ((s.v || 0) < 2) {
      DOCS.forEach(d => { if (!s.docs.find(x => x.id === d.id)) s.docs.push(JSON.parse(JSON.stringify(d))); });
      SEED.forEach((a, i) => { if (i >= OLDN && !s.tasks.find(t => t.id === "t" + i)) s.tasks.push(mkT(a, i)); });
      ["d2", "d6"].forEach(id => { const d = s.docs.find(x => x.id === id); if (d && !d.b.includes("h.k1")) d.b += EM; });
      s.v = 2;
    }
    if (s.v < 3) {
      DOCS.forEach(d => { if (!s.docs.find(x => x.id === d.id)) s.docs.push(JSON.parse(JSON.stringify(d))); });
      const d3 = s.docs.find(x => x.id === "d3"); if (d3) d3.b = d3.b.split("\n").filter(l => !l.startsWith("マイコプラズマ")).join("\n");
      s.docs.forEach(d => { if (["d3", "d4", "d5", "d15", "d16", "d17"].includes(d.id)) d.tip = true; });
      s.v = 3;
    }
    s.docs = s.docs.filter(d => !(d.t === "新しいTips" && !String(d.b || "").trim() && !d.u && !(d.ls || []).length)); /* 追加ボタンで作ってしまった空のTipsは消す */
    s.docs.forEach(d => { if (d.tag === undefined) d.tag = TAGDEF[d.id] || ""; });
    s.docs.forEach(d => { d.img = (DOCS.find(x => x.id === d.id) || {}).img || d.img || []; d.b = san(d.b); d.t = san(d.t); d.u = d.u || ""; d.ut = typeof d.ut === "string" ? d.ut : ""; d.ls = (Array.isArray(d.ls) ? d.ls : []).filter(x => x && typeof x === "object").slice(0, 4).map(x => ({ t: String(x.t || ""), u: String(x.u || "") })); });
    s.tasks.forEach(t => {
      if (t.dd == null) t.dd = 0;
      for (const k in DAYS) if (!t.dd && t.t.startsWith(k)) t.dd = DAYS[k];
      for (const k in PAT) if (!t.p && t.t.startsWith(k)) t.p = PAT[k];
      if (t.t.startsWith("11月個人面談 予定表") && !String(t.n).includes("h.k1") && !String(t.n).includes("hayato")) t.n += (t.n ? "\n" : "") + "Claudeアカウント: " + MAIL + " で作成";
      t.n = san(t.n); t.k = san(t.k); t.t = san(t.t); t.lk = Array.isArray(t.lk) ? t.lk : [];
    });
    const mo = s.morning = s.morning || {};
    if (!Array.isArray(mo.items)) mo.items = [{ id: "m1", t: "KGM通信", u: "" }, { id: "m2", t: "BLEND", u: "" }, { id: "m3", t: "学年のドキュメント", u: "" }, { id: "m4", t: "学年のスプレッドシート", u: "" }];
    mo.done = mo.done || {}; mo.weekend = !!mo.weekend;
    { const old = J.addDays(J.ds(new Date()), -3); Object.keys(mo.done).forEach(k => { if (k.slice(0, 10) < old) delete mo.done[k]; }); }
    s.d = s.d || {}; s.cd = s.cd || {}; s.tipOrder = Array.isArray(s.tipOrder) ? s.tipOrder : []; s.fav = Array.isArray(s.fav) ? s.fav : []; s.mine = Array.isArray(s.mine) ? s.mine : [];
    s.bell = bellMig(s.bell);
    s.roles = s.roles || ["担", "教", "部"]; s.g = s.g || "3";
    if (!s.y || s.y < FY) s.y = FY; /* 年度が変わると自動で新しい年度になる（完了チェックは年度ごとに別なので、未完了に戻る） */
    return s;
  }
  const fresh = () => mig({ v: 3, y: FY, g: "3", roles: ["担", "教", "部"], docs: JSON.parse(JSON.stringify(DOCS)), d: {}, cd: {}, tasks: SEED.map(mkT), fav: [], mine: [] });

  /* ---------- 読み込み・保存 ---------- */
  const ghOn = () => { const s = S.getSettings(); return !!(s.token && s.owner && s.repo); };
  async function load() {
    try { const r = await fetch("work/links.json?t=" + Date.now(), { cache: "no-store" }); W.links = r.ok ? await r.json() : { sections: [] }; } catch (e) { W.links = { sections: [] }; }
    const s = S.getSettings(); W.token = ghOn();
    let text = null;
    if (W.token) {
      try { const r = await S.remoteGet(s, "data/work.json"); text = r.text; W.sha = r.sha; W.st = "GitHubと同期中"; }
      catch (e) { if (e.status !== 404) { W.canSave = false; W.st = "⚠ " + S.explain(e) + "（GitHubへの保存は止めています）"; } else { W.needCreate = true; W.st = "GitHubに work.json が見つかりません"; } }
    } else {
      try { const r = await fetch("data/work.json?t=" + Date.now(), { cache: "no-store" }); if (r.ok) text = await r.text(); } catch (e) { text = null; }
      W.st = "この端末のみ保存（右上の「設定」でGitHubを接続できます）";
    }
    let p = null; try { p = text ? JSON.parse(text) : null; } catch (e) { p = null; }
    let dr = null; try { const raw = LS.get("jd.draft.work"); dr = raw ? JSON.parse(raw) : null; } catch (e) { dr = null; }
    /* この端末に未保存の下書きがあるとき: GitHubが別の端末で更新されていたら、勝手に上書きせず、どちらを使うか聞く */
    if (dr && dr.dirty && dr.p && dr.p.tasks) {
      if (W.token && W.sha && dr.base !== W.sha) { W.ask = true; W.draftP = dr.p; }
      else if (W.token && W.needCreate) { W.draftP = dr.p; W.ask = true; }
      else { p = dr.p; W.dirty = true; }
    }
    W.S = mig(p && p.tasks ? p : fresh());
    if (!(p && p.tasks) && !W.token) W.dirty = true; /* GitHub未接続: この端末にひな形を保存 */
    W.ready = true;
    if (W.dirty && W.token && W.canSave && !W.ask && !W.needCreate) flush(); else if (W.dirty) LS.set("jd.draft.work", JSON.stringify({ p: W.S, dirty: true, base: W.sha }));
    A.render && A.render(); A.remCheck && A.remCheck();
  }
  function save() {
    W.dirty = true; LS.set("jd.draft.work", JSON.stringify({ p: W.S, dirty: true, base: W.sha }));
    clearTimeout(W.timer); W.timer = setTimeout(flush, 900); setStatus();
  }
  async function flush() {
    if (!W.dirty || !W.token || !W.canSave || W.conflict || W.ask || W.needCreate) { setStatus(); return; }
    if (W.saving) { clearTimeout(W.timer); W.timer = setTimeout(flush, 600); return; }
    W.saving = true; W.st = "GitHubに保存中…"; setStatus();
    const snap = JSON.stringify(W.S), body = J.toJSON(W.S);
    try {
      const r = await S.remotePut(S.getSettings(), "data/work.json", body, W.sha, "校務タブを更新");
      W.sha = r.sha; W.st = "GitHubに保存済み";
      if (JSON.stringify(W.S) === snap) { W.dirty = false; LS.del("jd.draft.work"); } else { clearTimeout(W.timer); W.timer = setTimeout(flush, 300); }
    } catch (e) {
      if (e.status === 409 || e.status === 422) W.conflict = true;
      W.st = "⚠ " + S.explain(e);
    }
    W.saving = false; setStatus(); if (W.conflict && A.ui.mode === "work") A.render();
  }
  function setStatus() { if (A.ui.mode === "work" && A.renderStatus) A.renderStatus(); }
  async function reloadRemote() {
    try { const r = await S.remoteGet(S.getSettings(), "data/work.json"); W.sha = r.sha; W.S = mig(JSON.parse(r.text)); W.conflict = false; W.canSave = true; W.dirty = false; LS.del("jd.draft.work"); W.st = "GitHubと同期中"; A.render(); }
    catch (e) { root.alert(S.explain(e)); }
  }
  /* 開いたままの画面でも、ときどきGitHubの最新を確かめて取り込む（古い内容で上書きしないため） */
  async function refreshWork() {
    if (document.hidden || !W.ready || !W.token || W.saving || W.dirty || W.conflict || W.ask || W.needCreate || !W.canSave || $("wdlg").open) return;
    try { const r = await S.remoteGet(S.getSettings(), "data/work.json"); if (r.sha !== W.sha && !W.dirty && !W.saving) { W.sha = r.sha; W.S = mig(JSON.parse(r.text)); A.render(); } } catch (e) { /* 次の機会に */ }
  }
  document.addEventListener("visibilitychange", refreshWork);
  window.addEventListener("focus", refreshWork);
  setInterval(refreshWork, 120000);
  function askH() {
    if (W.needCreate) return '<div class="banner err"><div>GitHubに work.json が見つかりません。ブランチ名やリポジトリ名が違っていないか、設定を確かめてください。新しく作ってよい場合だけ、下のボタンを押してください（今のデータがあるリポジトリでは押さないでください）。</div><div class="btns"><button class="btn" data-wact="create">ひな形から新しく作る</button></div></div>';
    if (W.ask) return '<div class="banner err"><div>この端末に、GitHubにまだ保存していない変更があります。GitHubは別の端末で更新されているかもしれません。どちらを使いますか？</div><div class="btns"><button class="btn" data-wact="draft-drop">GitHubの最新を使う（この端末の変更は破棄）</button><button class="btn" data-wact="draft-use">この端末の変更で上書き保存</button></div></div>';
    return "";
  }


  /* ---------- 重要Tipsの並べ替え: つかんで動かす（パソコンもスマホも） ---------- */
  let dg = null;
  document.addEventListener("pointerdown", e => {
    if (!ui.tipSort || (e.pointerType === "mouse" && e.button !== 0)) return;
    const w = e.target.closest && e.target.closest(".p-tips .wtpw"); if (!w) return;
    dg = { w, id: w.dataset.id, x: e.clientX, y: e.clientY, on: false, pid: e.pointerId };
  });
  document.addEventListener("pointermove", e => {
    if (!dg || e.pointerId !== dg.pid) return;
    if (!dg.on) {
      if (Math.hypot(e.clientX - dg.x, e.clientY - dg.y) < 6) return;
      dg.on = true; dg.w.classList.add("dragging");
      const r = dg.w.getBoundingClientRect(); dg.dx = e.clientX - r.left; dg.dy = e.clientY - r.top;
      dg.g = dg.w.cloneNode(true); dg.g.className = "wtpw wghost"; dg.g.style.width = r.width + "px"; document.body.appendChild(dg.g);
      try { dg.w.setPointerCapture(e.pointerId); } catch (x) { /* なくても動く */ }
    }
    e.preventDefault();
    dg.g.style.left = e.clientX - dg.dx + "px"; dg.g.style.top = e.clientY - dg.dy + "px";
    const el = document.elementFromPoint(e.clientX, e.clientY), t = el && el.closest && el.closest(".p-tips .wtpw");
    if (t && t !== dg.w && !t.classList.contains("wghost")) {
      const r = t.getBoundingClientRect(), after = e.clientX > r.left + r.width / 2;
      t.parentNode.insertBefore(dg.w, after ? t.nextSibling : t);
    }
  }, { passive: false });
  function endDrag(e) {
    if (!dg || (e && e.pointerId !== dg.pid)) return;
    const d = dg; dg = null;
    if (!d.on) return;
    d.g.remove(); d.w.classList.remove("dragging");
    const ids = [...document.querySelectorAll(".p-tips .wtpw")].map(x => x.dataset.id);
    W.S.tipOrder = ids; save(); A.render();
  }
  document.addEventListener("pointerup", endDrag);
  document.addEventListener("pointercancel", endDrag);

  /* ---------- 計算 ---------- */
  const vis = t => W.S.roles.includes(t.r) && (!t.tg || t.tg.includes(W.S.g));
  const key = (t, m) => W.S.y + ":" + t.id + (t.rep ? ":" + m : "");
  const ck = (t, i) => W.S.y + ":" + t.id + ":c" + i;
  const isD = (t, m) => !!W.S.d[key(t, m)];
  const inM = m => W.S.tasks.filter(t => vis(t) && (t.rep || t.m === m));
  const calYear = m => m >= 4 ? W.S.y : W.S.y + 1;
  const idx = m => ORDER.indexOf(m);
  const fyIdx = () => W.S.y === FY ? idx(now.getMonth() + 1) : W.S.y > FY ? 0 : 11;
  function dueOf(t, m) {
    const y = calYear(m);
    if (t.rep) return y + "-" + pad(m) + "-" + pad(new Date(y, m, 0).getDate());
    return t.dd ? y + "-" + pad(m) + "-" + pad(Math.min(t.dd, new Date(y, m, 0).getDate())) : null;
  }
  /* 期限が今日までに来ている／2日以内に来る校務 */
  function dueList() {
    if (!W.ready || W.S.y !== FY) return [];
    const today = J.ds(new Date()), lim = J.addDays(today, 2), m0 = new Date().getMonth() + 1, out = [];
    W.S.tasks.filter(vis).forEach(t => {
      const m = t.rep ? m0 : t.m;
      if (isD(t, m)) return;
      const due = dueOf(t, m);
      if (!due || due > lim) return;
      out.push({ t, m, due, kind: due < today ? "late" : due === today ? "today" : "soon" });
    });
    return out.sort((a, b) => a.due < b.due ? -1 : a.due > b.due ? 1 : 0);
  }
  function monthCounts() {
    if (!W.ready || W.S.y !== FY) return { cur: 0, carry: 0 };
    const m0 = new Date().getMonth() + 1, i0 = idx(m0); let cur = 0, carry = 0;
    W.S.tasks.filter(t => vis(t) && !t.rep && !t.dd).forEach(t => { if (isD(t, t.m)) return; const i = idx(t.m); if (i === i0) cur++; else if (i < i0) carry++; });
    return { cur, carry, m0 };
  }
  const dueTag = x => x.kind === "late" ? '<span class="late">期限切れ ' + J.md(x.due) + "</span>" : x.kind === "today" ? '<span class="late today">今日</span>' : '<span class="late soon">' + J.md(x.due) + "</span>";

  /* ---------- 画面の部品 ---------- */
  const imgs = d => (d.img || []).filter(k => IMG[k]).map(k => '<img class="wim" title="押すと大きく開きます" loading="lazy" src="' + IMG[k] + '" alt="">').join("");
  const linkOf = u => { const t = linkTitle(u); return '<a class="ml" href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">' + esc(t) + "</a>"; };
  function allLinks() {
    const o = []; ((W.links && W.links.sections) || []).forEach(s => s.items.forEach(i => o.push({ t: i.t, u: i.u, sec: s.title, grp: s.group })));
    W.S.mine.forEach(i => o.push({ t: i.t, u: i.u, sec: i.sec || "自分で追加", grp: "自分で追加", mine: i.id }));
    return o;
  }
  function linkTitle(u) { const f = allLinks().find(x => x.u === u); if (f) return f.t; const m = /^https?:\/\/([^/]+)/.exec(u); return m ? m[1] : u; }
  function item(t, m, tag) {
    const dn = isD(t, m);
    return '<div class="wit' + (dn ? " dn" : "") + '"><input type="checkbox" aria-label="完了" ' + (dn ? "checked" : "") + ' data-wchg="tg" data-id="' + t.id + '" data-m="' + m + '"><div class="wbody" data-wact="op" data-id="' + t.id + '" data-m="' + m + '"><b>' + esc(t.t) + '</b> <span class="wc">' + RL[t.r] + (t.tg ? " " + tgl(t.tg) : "") + (t.dd && !t.rep ? " " + m + "/" + t.dd : "") + "</span>" + (tag || "") +
      (t.n ? '<div class="ww">⚠ ' + esc(t.n.split("\n")[0]) + "</div>" : "") + (t.k ? '<div class="wk">📝 ' + esc(t.k.split("\n")[0]) + "</div>" : "") + "</div></div>";
  }
  const TAGS = [["komu", "校務全般"], ["class", "クラス"], ["jugyo", "授業"], ["kokugo", "国語科"], ["seiseki", "テスト成績"], ["bukatsu", "部活動"]]; /* この順番で、重要Tipsも並ぶ */
  const TAGDEF = { d1: "seiseki", d17: "seiseki", d2: "class", d3: "class", d4: "class", d5: "class", d6: "class", d7: "class", d8: "class", d9: "class", d10: "class", d11: "class", d12: "class", d13: "class", d14: "class", d15: "class", d16: "class" };
  const tagName = k => (TAGS.find(x => x[0] === k) || ["", ""])[1];
  const TO = ["d5", "d3", "d15", "d4", "d16", "d17"];
  /* 重要Tipsの並び: はじめは「公務全般→クラス→授業→部活動」の順。手で動かしたら、その順番を覚える */
  function tipList() {
    const tr = x => { const k = TAGS.findIndex(t => t[0] === x.tag); return k < 0 ? TAGS.length : k; }, f = x => { const i = TO.indexOf(x.id); return tr(x) * 100 + (i < 0 ? 99 : i); };
    const ord = W.S.tipOrder || [], pos = x => { const i = ord.indexOf(x.id); return i < 0 ? 1e6 : i; };
    return W.S.docs.filter(d => d.tip).sort((a, b) => ord.length ? (pos(a) - pos(b) || f(a) - f(b)) : f(a) - f(b));
  }
  /* 重要Tipsのボタンを押したとき: 自動＝説明が空でURLがあればすぐ開く／説明があれば説明を出す。手で「すぐ開く」「説明を出す」に固定もできる */
  /* 資料リンク: 1つ目（d.u と名前 d.ut）と、2つ目以降（d.ls）。URLが空のものは数えない */
  function dlinks(d) { const o = []; if (d.u) o.push({ t: d.ut || "リンク1", u: d.u }); (d.ls || []).forEach((x, k) => { if (x.u) o.push({ t: x.t || "リンク" + (k + 2), u: x.u }); }); return o; }
  const lnkH = d => dlinks(d).map(x => '<a class="btn wlnk" href="' + esc(x.u) + '" target="_blank" rel="noopener noreferrer">' + esc(x.t) + " ↗</a>").join("");
  /* ボタンを押したとき: 自動＝リンクが1つで説明が空ならすぐ開く（複数ならリンクの選択、説明があれば説明）。手で固定もできる */
  function goLink(d) { const n = dlinks(d).length; if (!n) return false; if (d.go === "link") return true; if (d.go === "detail") return false; return n === 1 && !String(d.b || "").trim(); }
  function tipsH() {
    const l = tipList(), used = TAGS.filter(t => l.some(d => d.tag === t[0])), sorting = ui.tipSort;
    const btn = d => (goLink(d) && !sorting) ? '<a class="wtp t-' + esc(d.tag || "none") + '" href="' + esc(dlinks(d)[0].u) + '" target="_blank" rel="noopener noreferrer" title="押すと資料がすぐ開きます">' + esc(d.t) + ' <span class="wgo">↗</span></a>' : '<button class="wtp t-' + esc(d.tag || "none") + '" data-wact="tip" data-id="' + d.id + '"' + (dlinks(d).length > 1 ? ' title="押すとリンクを選べます"' : "") + ">" + esc(d.t) + (dlinks(d).length > 1 ? ' <span class="wgo">▾' + dlinks(d).length + "</span>" : "") + "</button>";
    const body = l.map((d, k) => sorting ? '<span class="wtpw" data-id="' + d.id + '"><span class="wgrip" aria-hidden="true">⠿</span>' + btn(d) + "</span>" : btn(d)).join("");
    return '<section class="panel p-work p-tips"><header class="panel-h"><h2>重要Tips</h2><span class="panel-n"><button class="btn sm" data-wact="tip-sort">' + (sorting ? "完了" : "並べ替え") + '</button></span></header><div class="panel-b">' +
      (sorting ? '<p class="note" style="margin:0 0 8px">ボタンをつかんで、動かしたい場所にドラッグして離してください。よく使うものを前にしてください。 <button class="btn sm" data-wact="tip-auto">自動の並び（校務→クラス→授業→国語科→テスト成績→部活動）に戻す</button></p>' : (used.length ? '<div class="wleg">' + used.map(t => '<span class="wtag t-' + t[0] + '">' + t[1] + "</span>").join("") + "</div>" : "")) +
      body + "</div></section>";
  }
  const panel = (cls, title, count, body) => '<section class="panel ' + cls + '"><header class="panel-h"><h2>' + title + "</h2>" + (count ? '<span class="panel-n">' + count + "</span>" : "") + '</header><div class="panel-b">' + body + "</div></section>";

  /* ---------- 各タブ ---------- */
  function viewHome() {
    const s = W.S, cur = fyIdx(), all = s.tasks.filter(t => vis(t) && !t.rep), dn = all.filter(t => isD(t, t.m)).length, due = dueList();
    let late = ""; for (let i = 0; i < cur; i++) { const m = ORDER[i]; inM(m).filter(t => !isD(t, m)).forEach(t => { late += item(t, m, '<span class="late">' + m + "月</span>"); }); }
    const m = ORDER[Math.max(0, Math.min(11, cur))], nx = cur < 11 ? ORDER[cur + 1] : null;
    let h = A.work.morning();
    h += askH();
    if (W.conflict) h += '<div class="banner err"><div>別の端末で先に更新されています。</div><div class="btns"><button class="btn" data-wact="reload">最新を読み込み直す</button></div></div>';
    if (due.length) h += panel("p-work", "期限が近い校務", due.length + "件", due.map(x => item(x.t, x.m, dueTag(x))).join(""));
    h += tipsH();
    h += panel("p-rem", s.y + "進捗状況", "", '<div class="note">' + esc(s.g === "J" ? "中学" : "高" + s.g) + "担当 ・ " + esc(W.st) + '</div><div class="bar"><i style="width:' + (all.length ? dn / all.length * 100 : 0) + '%"></i></div><div class="note">年間の進み: ' + dn + " / " + all.length + "</div>");
    if (late) h += panel("p-late", "⚠ 繰越・期限切れ", "", late);
    h += panel("p-now", "今月（" + m + "月）", "", inM(m).map(t => item(t, m)).join("") || '<p class="note" style="margin:0">なし</p>');
    if (nx) h += panel("p-soon", "来月（" + nx + "月）の準備 ― 前倒しOK", "", inM(nx).filter(t => !t.rep && !isD(t, nx)).map(t => item(t, nx)).join("") || '<p class="note" style="margin:0">なし</p>');
    return h;
  }
  function viewYear() {
    const cur = fyIdx();
    return '<p><button class="btn on" data-wact="eo">＋ タスク追加</button></p>' + ORDER.map((m, i) => {
      const l = inM(m), d = l.filter(t => isD(t, m)).length;
      return '<details class="wdet"' + (i === cur ? " open" : "") + "><summary><b>" + m + '月</b> <span class="note">' + d + "/" + l.length + "</span></summary>" + (l.map(t => item(t, m)).join("") || '<div class="note">なし</div>') + "</details>";
    }).join("");
  }
  function linkRow(x) {
    const fav = W.S.fav.indexOf(x.u) >= 0;
    return '<div class="wlink"><button class="wstar" data-wact="fav" data-u="' + esc(x.u) + '" aria-pressed="' + fav + '" title="★よく使う">' + (fav ? "★" : "☆") + '</button><a class="ml" href="' + esc(x.u) + '" target="_blank" rel="noopener noreferrer">' + esc(x.t) + "</a>" +
      (x.mine ? '<button class="btn sm danger" data-wact="mine-del" data-id="' + esc(x.mine) + '">消す</button>' : "") + "</div>";
  }
  function linkResults() {
    const q = nfkc(ui.q).split(/\s+/).filter(Boolean), secs = {};
    const list = allLinks().filter(x => (!ui.grp || x.grp === ui.grp) && (!ui.fav || W.S.fav.indexOf(x.u) >= 0) && q.every(t => nfkc(x.t + " " + x.sec).indexOf(t) >= 0));
    list.forEach(x => { (secs[x.sec + "\u0001" + x.grp] = secs[x.sec + "\u0001" + x.grp] || []).push(x); });
    let h = "";
    if (!q.length && !ui.fav && !ui.grp) {
      const fs = allLinks().filter(x => W.S.fav.indexOf(x.u) >= 0);
      h += panel("p-ev", "★よく使う", fs.length + "件", fs.length ? fs.map(linkRow).join("") : '<p class="note" style="margin:0">リンクの左の ☆ を押すと、ここに出ます。</p>');
    } else h += '<p class="note"><b>' + list.length + "件</b>見つかりました</p>";
    const memoOf = {}; ((W.links && W.links.sections) || []).forEach(s => { memoOf[s.title] = s.memo; });
    Object.keys(secs).forEach(k => {
      const [t, g] = k.split("\u0001"), open = q.length || ui.fav || ui.grp;
      h += '<details class="wdet"' + (open ? " open" : "") + "><summary><b>" + esc(t) + '</b> <span class="note">' + secs[k].length + "件 ・ " + esc(g) + "</span></summary>" + secs[k].map(linkRow).join("") + ((memoOf[t] || []).length && !q.length ? '<p class="note">' + (memoOf[t] || []).map(esc).join(" ／ ") + "</p>" : "") + "</details>";
    });
    return h;
  }
  function viewLinks() {
    const grps = ["", "ポータル", "ICTマニュアル", "自分で追加"], nm = { "": "すべて" };
    const secs = []; ((W.links && W.links.sections) || []).forEach(s => { if (secs.indexOf(s.title) < 0) secs.push(s.title); });
    let h = '<div class="seg">' + grps.map(g => '<button data-wact="grp" data-v="' + g + '" aria-pressed="' + (ui.grp === g) + '">' + (nm[g] || g) + "</button>").join("") + "</div>";
    h += '<div class="lbar"><input type="search" id="wq" class="lq" data-wf="lq" placeholder="リンクをさがす（例：勤怠　BLEND　推薦書　陸上）" value="' + esc(ui.q) + '" autocomplete="off"><label class="lfav"><input type="checkbox" data-wchg="favonly"' + (ui.fav ? " checked" : "") + '> ★だけ</label></div>';
    h += '<div id="wres">' + linkResults() + "</div>";
    h += '<details class="wdet"><summary><b>＋ リンクを追加する</b></summary><div style="padding:6px 0"><label>名前</label><input type="text" id="wl_t" placeholder="例：新しい手順書"><label>URL</label><input type="text" id="wl_u" placeholder="https://…"><label>分類</label><select id="wl_s"><option value="">自分で追加（分類なし）</option>' + secs.map(s => "<option>" + esc(s) + "</option>").join("") + '</select><button class="btn on" data-wact="mine-add">追加</button></div></details>';
    return h + '<p class="note">リンク一覧の作成日：' + esc((W.links && W.links.built) || "—") + "（" + esc((W.links && W.links.year) || "") + "年度のシートから）。パスワード・IDはここには入れません。</p>";
  }
  /* 手順・メモ: 上に「＋ 新しいメモ」と検索。メモは見出しだけに畳んであり、押すと開く */
  function linkRows(d, i) {
    const row = (t, u, fn, fu, j, ph) => '<div class="wlrow"><input type="text" value="' + esc(t) + '" placeholder="' + ph + '" data-wf="' + fn + '" data-i="' + i + '" data-j="' + j + '" aria-label="リンクの名前"><input type="url" value="' + esc(u) + '" placeholder="https://…" data-wf="' + fu + '" data-i="' + i + '" data-j="' + j + '" autocomplete="off" aria-label="リンクのURL">' + (j >= 0 ? '<button class="btn sm" data-wact="doc-ldel" data-i="' + i + '" data-j="' + j + '" aria-label="このリンクを消す">消す</button>' : "") + "</div>";
    return row(d.ut || "", d.u || "", "doc-ut", "doc-u", -1, "名前（例：ブレンド）") + (d.ls || []).map((x, j) => row(x.t, x.u, "doc-lt", "doc-lu", j, "名前（例：参考サイト）")).join("");
  }
  function docCard(d, i) {
    const open = ui.docOpen[d.id] ? " open" : "";
    return '<details class="wdet wdoc" data-id="' + d.id + '"' + open + '><summary><span class="wtag t-' + esc(d.tag || "none") + '">' + esc(tagName(d.tag) || "タグなし") + '</span> <b class="wdt">' + esc(d.t || "（無題）") + "</b>" + (d.tip ? ' <span class="wst">★</span>' : "") + "</summary>" +
      '<div class="wcard" style="border:0;padding:4px 0 8px"><input type="text" value="' + esc(d.t) + '" data-wf="doc-t" data-i="' + i + '" aria-label="見出し"><button class="wstar" data-wact="doc-star" data-i="' + i + '" aria-pressed="' + !!d.tip + '" title="★を付けると、ホームの重要Tipsに出ます">' + (d.tip ? "★" : "☆") + '</button><label class="wck">タグ（ボタンの色）： <select data-wchg="doc-tag" data-i="' + i + '" style="width:auto"><option value="">なし</option>' + TAGS.map(t => '<option value="' + t[0] + '"' + (d.tag === t[0] ? " selected" : "") + ">" + t[1] + "</option>").join("") + '</select></label><label class="wck">重要Tipsのボタンを押したら： <select data-wchg="doc-go" data-i="' + i + '" style="width:auto"><option value="">自動（説明が空なら資料をすぐ開く／説明があれば説明を出す）</option><option value="link"' + (d.go === "link" ? " selected" : "") + '>いつも資料をすぐ開く</option><option value="detail"' + (d.go === "detail" ? " selected" : "") + '>いつも説明を出す</option></select></label><div class="wlset"><b class="small">資料リンク（最大5つ。名前は、押すボタンに出ます）</b>' + linkRows(d, i) + (1 + (d.ls || []).length < 5 ? '<button class="btn sm" data-wact="doc-ladd" data-i="' + i + '">＋ リンクを足す</button>' : "") + '</div><textarea style="min-height:110px" data-wf="doc-b" data-i="' + i + '">' + esc(d.b) + "</textarea>" + imgs(d) + '<button class="btn" data-wact="doc-del" data-i="' + i + '">削除</button></div></details>';
  }
  function docList() {
    const q = nfkc(ui.dq).split(/\s+/).filter(Boolean);
    return W.S.docs.map((d, i) => [d, i]).filter(x => q.every(t => nfkc(x[0].t + " " + x[0].b).indexOf(t) >= 0)).map(x => docCard(x[0], x[1])).join("") || '<p class="note">見つかりません。</p>';
  }
  function viewDocs() {
    return '<div class="wdocbar"><input type="search" id="wdq" data-wf="dq" placeholder="メモをさがす" value="' + esc(ui.dq) + '" autocomplete="off"><button class="btn on" data-wact="doc-add">＋ 新しいメモ</button></div>' +
      '<p class="note">タスクの「手順」として紐づけられる共通メモです。1か所直せば全部に反映されます。</p><div id="wdocs">' + docList() + '</div><button class="wfab" data-wact="doc-add" aria-label="新しいメモを足す" title="新しいメモを足す">＋</button>';
  }
  function icsText(o) {
    const yr = calYear, e = s => String(s).replace(/\\/g, "\\\\").replace(/[,;]/g, "\\$&").replace(/\n/g, "\\n"), s = W.S, ev = []; let n = 0;
    const add = (ds, sum, desc, rr) => ev.push(["BEGIN:VEVENT", "UID:work" + (n++) + "-" + s.y + "@myclassblueprint", "DTSTAMP:20260101T000000Z", "DTSTART;VALUE=DATE:" + ds, "SUMMARY:" + e(sum), "DESCRIPTION:" + e(desc), rr || "", "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + e(sum), "TRIGGER:PT9H", "END:VALARM", "END:VEVENT"].filter(Boolean).join("\r\n"));
    ORDER.forEach(m => {
      const l = s.tasks.filter(t => vis(t) && !t.rep && t.m === m); if (!l.length) return;
      const tx = l.map(t => "・" + t.t + (t.n ? "\n   ⚠ " + t.n.split("\n")[0] : "")).join("\n");
      if (o.a) add(yr(m) + pad(m) + "01", "【今月】" + m + "月のタスク(" + l.length + "件)", tx);
      if (o.b) { const pm = m === 1 ? 12 : m - 1; add((m === 4 ? s.y : yr(pm)) + pad(pm) + "25", "【来月の準備】" + m + "月のタスク", tx); }
      if (o.c) l.filter(t => t.dd).forEach(t => add(yr(m) + pad(m) + pad(t.dd), t.t, t.n || ""));
    });
    if (o.d) s.tasks.filter(t => vis(t) && t.rep).forEach(t => add(s.y + "0430", t.t, t.n || "", "RRULE:FREQ=MONTHLY;BYMONTHDAY=-1;COUNT=12"));
    return "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//myclassblueprint-work//JA\r\nCALSCALE:GREGORIAN\r\n" + ev.join("\r\n") + "\r\nEND:VCALENDAR";
  }
  function lessonIcs(onlyFuture) {
    const st = A.st, asof = A.ui.asof, e = x => String(x).replace(/\\/g, "\\\\").replace(/[,;]/g, "\\$&").replace(/\n/g, "\\n"), ev = []; let n = 0;
    const stamp = (d, m) => d.replace(/-/g, "") + "T" + pad(Math.floor(m / 60)) + pad(m % 60) + "00";
    st.classes.forEach(c => {
      const pj = J.classStats(st, c, asof).pj;
      pj.rows.forEach(r => {
        if (r.kind === "off" || r.kind === "cancel" || (onlyFuture && r.date < asof)) return;
        const t = A.timeSpan(r); if (!t) return;
        const ttl = A.rowTitle(r), per = (r.periods || []).filter(Boolean).join("・") + "時間目";
        ev.push(["BEGIN:VEVENT", "UID:lesson" + (n++) + "-" + c.id + "-" + r.date + "@workbase", "DTSTAMP:20260101T000000Z", "DTSTART;TZID=Asia/Tokyo:" + stamp(r.date, t[0]), "DTEND;TZID=Asia/Tokyo:" + stamp(r.date, t[1]),
          "SUMMARY:" + e(c.name.replace(/\s+/g, " ") + " " + (ttl || "")), "DESCRIPTION:" + e(per + (r.rec && r.rec.n ? "\n" + r.rec.n : "")), "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + e(c.name), "TRIGGER:-PT10M", "END:VALARM", "END:VEVENT"].join("\r\n"));
      });
    });
    return { n: ev.length, text: "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//workbase-lessons//JA\r\nCALSCALE:GREGORIAN\r\nBEGIN:VTIMEZONE\r\nTZID:Asia/Tokyo\r\nBEGIN:STANDARD\r\nDTSTART:19700101T000000\r\nTZOFFSETFROM:+0900\r\nTZOFFSETTO:+0900\r\nTZNAME:JST\r\nEND:STANDARD\r\nEND:VTIMEZONE\r\n" + ev.join("\r\n") + "\r\nEND:VCALENDAR" };
  }
  function viewCal() {
    const o = (k, l) => '<label class="wck"><input type="checkbox" id="' + k + '" checked> ' + l + "</label>";
    return '<div class="wcard"><b>Googleカレンダーなどに取り込む(.icsファイル)</b><p class="note">' + W.S.y + "年度・今の担当設定で表示されるタスクが対象です。日付は各タスクの編集画面の「日」で設定できます(未設定はまとめ予定になります)。</p>" +
      o("c1", "毎月1日に「今月のタスク一覧」") + o("c2", "前月25日に「来月の準備」(前倒し用)") + o("c3", "日付を設定したタスクを個別の予定に") + o("c4", "毎月末の繰り返しタスク(出欠確認など)") + '<button class="btn on" data-wact="ics">.icsを書き出す</button><textarea id="icsx" style="display:none"></textarea></div>' +
      '<div class="wcard"><b>授業もカレンダーに（時刻つき）</b><p class="note">授業の計画表から、実際の授業の時刻（授業時間表のとおり）で、予定を作ります。開始の10分前に通知が出ます。休講や授業なしの日は入りません。</p><label class="wck"><input type="checkbox" id="lc1" checked> 基準日（今日の画面の日付）以降の授業だけ</label><button class="btn on" data-wact="ics-lesson">授業の.icsを書き出す</button></div>' +
      '<div class="wcard"><b>取り込み方</b><p>Googleカレンダー(PC) → 右上の歯車 → 設定 → 「インポート/エクスポート」 → ファイルを選んで取り込み。予定の通知はカレンダー側で届きます。</p><p class="note">一度取り込んだ予定は自動では更新されません。タスクを変更したら、古い予定を消して取り込み直してください。</p></div>';
  }
  const tin = m => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
  function bellCard() {
    const b = W.S.bell, row = i => '<div class="bellrow"><span>第' + i + "時限</span>" + '<input type="time" value="' + tin(b.p[i][0]) + '" data-wchg="bell" data-k="p' + i + 's" aria-label="第' + i + '時限の始まり"> 〜 <input type="time" value="' + tin(b.p[i][1]) + '" data-wchg="bell" data-k="p' + i + 'e" aria-label="第' + i + '時限の終わり"></div>';
    return '<div class="wcard"><b>授業時間表</b><p class="note">「いま／次の授業」や、授業の時刻の表示に使います。短縮授業の日などは、ここを直してください（直したら、すべての端末に反映されます）。</p>' + [1, 2, 3, 4, 5, 6, 7].map(row).join("") +
      '<div class="bellrow"><span>予鈴</span><input type="time" value="' + tin(b.yo) + '" data-wchg="bell" data-k="yo"></div>' +
      '<div class="bellrow"><span>下校（中学）</span><input type="time" value="' + tin(b.gj) + '" data-wchg="bell" data-k="gj"></div>' +
      '<div class="bellrow"><span>下校（高校）</span><input type="time" value="' + tin(b.gh) + '" data-wchg="bell" data-k="gh"></div>' +
      '<button class="btn" data-wact="bell-reset">初期の時間表に戻す</button></div>';
  }
  function viewSet() {
    const s = W.S;
    return '<div class="wcard"><b>担当</b><br>' + [["J", "中学"], ["1", "高1"], ["2", "高2"], ["3", "高3"]].map(([v, l]) => '<label class="wck" style="display:inline-block;margin-right:12px"><input type="radio" name="wg" ' + (s.g === v ? "checked" : "") + ' data-wchg="grade" data-v="' + v + '"> ' + l + "</label>").join("") + "<br><b>表示する校務</b><br>" +
      Object.entries(RL).map(([v, l]) => '<label class="wck" style="display:inline-block;margin-right:12px"><input type="checkbox" ' + (s.roles.includes(v) ? "checked" : "") + ' data-wchg="role" data-v="' + v + '"> ' + l + "</label>").join("") + "</div>" +
      '<div class="wcard"><b>朝の確認</b><p class="note">毎朝、ホームに小さく出ます。名前とURL（任意）を入れてください。URLがあると、押して開くと同時に「確認済み」になります。</p>' + s.morning.items.map((x, i) => '<div class="wlink"><input type="text" value="' + esc(x.t) + '" data-wf="m-t" data-i="' + i + '" placeholder="名前" style="flex:1;margin:0"><input type="text" value="' + esc(x.u) + '" data-wf="m-u" data-i="' + i + '" placeholder="https://…" style="flex:2;margin:0"><button class="btn sm" data-wact="m-up" data-i="' + i + '" aria-label="上へ">↑</button><button class="btn sm" data-wact="m-dn" data-i="' + i + '" aria-label="下へ">↓</button><button class="btn sm danger" data-wact="m-del" data-i="' + i + '">消す</button></div>').join("") + '<button class="btn" data-wact="m-add">＋ 追加</button><label class="wck"><input type="checkbox" data-wchg="m-weekend"' + (s.morning.weekend ? " checked" : "") + '> 土日にも出す</label></div>' +
      bellCard() +
      '<div class="wcard"><b>保存</b><p class="note">' + esc(W.st) + '</p><p class="note">GitHubの接続は、画面右上の「設定」で授業の記録と共通です（トークンは1つで足ります）。校務のデータは <code>data/work.json</code> に保存されます。</p></div>' +
      '<div class="wcard"><b>バックアップ</b><p class="note">いままでの「1年間の仕事」アプリで書き出した .json は、そのまま読み込めます（完了チェックも引き継がれます）。</p><button class="btn" data-wact="bk-out">ファイルに書き出す</button> <label class="btn" for="wbk" style="margin:0">ファイルから読み込む</label><input type="file" id="wbk" accept="application/json,.json" hidden></div>' +
      '<div class="wcard"><b>年度</b><p class="note">いまは ' + s.y + "年度です。4月になると自動で新しい年度になり、完了チェックは未完了に戻ります（タスクの内容と「来年へのメモ」はそのまま残ります）。</p></div>";
  }
  /* 毎朝の確認（KGM通信・BLEND・学年の資料など）。小さな1行にして、全部済んだら細い線に畳む */
  A.work.morning = function () {
    if (!W.ready) return "";
    const m = W.S.morning, today = J.ds(new Date()), dow = new Date().getDay();
    if (!m.items.length || (!m.weekend && (dow === 0 || dow === 6))) return "";
    const done = id => !!m.done[today + ":" + id], n = m.items.filter(x => done(x.id)).length, all = n === m.items.length;
    if (all && !ui.mornOpen) return '<div class="wmorn wmorn-done"><span class="wm-t">☀ 朝の確認</span><span class="wm-ok">✓ すべて確認しました</span><span class="wm-b lv-yo">' + A.work.bellText() + '</span><button class="wm-more" data-wact="m-fold">ひらく</button></div>';
    const chips = m.items.map(x => '<span class="wmc' + (done(x.id) ? " on" : "") + '"><button class="wmck" data-wact="m-toggle" data-id="' + x.id + '" aria-pressed="' + done(x.id) + '" aria-label="確認済みにする">' + (done(x.id) ? "✓" : "") + "</button>" +
      (x.u ? '<a class="wml" href="' + esc(x.u) + '" target="_blank" rel="noopener noreferrer" data-wact="m-link" data-id="' + x.id + '">' + esc(x.t) + " ↗</a>" : '<span class="wml" data-wact="m-toggle" data-id="' + x.id + '">' + esc(x.t) + "</span>") + "</span>").join("");
    return '<div class="wmorn"><span class="wm-t">☀ 朝の確認</span><span class="wm-chips">' + chips + '</span><span class="wm-b lv-yo">' + A.work.bellText() + '</span><span class="wm-n">' + n + "/" + m.items.length + "</span>" + (all ? '<button class="wm-more" data-wact="m-fold">とじる</button>' : "") + "</div>";
  };
  A.work.view = function () {
    if (!W.ready) return '<p class="note">読み込んでいます…</p>';
    return { home: viewHome, year: viewYear, links: viewLinks, docs: viewDocs, cal: viewCal, set: viewSet }[ui.tab]();
  };
  A.work.sub = () => W.ready ? "校務 ・ " + W.S.y + "年度" : "校務";
  A.work.statusText = () => W.st;
  A.work.dueCount = () => dueList().length;

  /* 授業の「今日」タブの下に出す「今日の校務」 */
  A.work.todayPanel = function () {
    if (!W.ready) return "";
    const due = dueList(), mc = monthCounts(), ts = A.seiseki && A.seiseki.todayItems ? A.seiseki.todayItems() : { n: 0, html: "" };
    let b = due.length ? due.map(x => item(x.t, x.m, dueTag(x))).join("") : '<p class="note" style="margin:0 0 6px">今日が期限の校務はありません。</p>';
    if (mc.cur || mc.carry) b += '<p class="note" style="margin:8px 0 0">' + (mc.cur ? mc.m0 + "月の校務（日付なし）：未完了 " + mc.cur + "件" : "") + (mc.cur && mc.carry ? " ／ " : "") + (mc.carry ? "繰越 " + mc.carry + "件" : "") + ' <button class="btn sm wbtn" data-wact="go-home">校務タブを開く</button></p>';
    b += ts.html;
    const kn = A.kintai && A.kintai.todayItems ? A.kintai.todayItems() : { n: 0, html: "" }; b += kn.html;
    const n = due.length + ts.n + kn.n;
    return panel("p-work" + (!due.length && !mc.cur && !mc.carry && !ts.n && !kn.n ? " p-slim" : ""), "今日の校務", n ? n + "件" : "", b);
  };
  /* 「記録待ち」と同じお知らせ画面に出す、期限が近い校務 */
  A.work.remHtml = function () {
    const due = dueList(); if (!due.length) return "";
    return '<h2 class="wrem-h">期限が近い校務があります</h2><div class="remlist">' + due.map(x => '<div class="wit"><div class="wbody"><b>' + esc(x.t.t) + "</b> " + dueTag(x) + (x.t.n ? '<div class="ww">⚠ ' + esc(x.t.n.split("\n")[0]) + "</div>" : "") + "</div></div>").join("") + '</div><p><button class="btn wbtn" data-wact="go-home">校務タブで開く</button></p>';
  };
  A.work.dueCount = () => dueList().length;

  /* ---------- 操作 ---------- */
  function modal(h) { $("wbody").innerHTML = h; if (!$("wdlg").open) $("wdlg").showModal(); }
  function cl() { if ($("wdlg").open) $("wdlg").close(); }
  function redraw() { if (A.ui.mode === "work") A.render(); else A.render(); }
  function toggle(id, m) {
    const t = W.S.tasks.find(x => x.id === id), k = key(t, m);
    if (!W.S.d[k] && t.c.length && !t.c.every((_, i) => W.S.cd[ck(t, i)])) { root.alert("完了前チェックがまだ終わっていません。詳細を開いて確認してください。"); redraw(); return; }
    if (W.S.d[k]) delete W.S.d[k]; else W.S.d[k] = true;
    save(); redraw();
  }
  function openTask(id, m) {
    const t = W.S.tasks.find(x => x.id === id), p = W.S.docs.find(d => d.id === t.p), dn = isD(t, m);
    modal('<h2 style="margin:0">' + esc(t.t) + '</h2><div class="note">' + (t.rep ? "毎月" : t.m + "月") + " ・ " + RL[t.r] + " ・ " + (t.tg ? tgl(t.tg) : "全学年") + "</div>" +
      (t.n ? '<div class="ww2">⚠ ' + nl(t.n) + "</div>" : "") +
      (p ? '<details class="wdet" open><summary>' + esc(p.t) + "</summary><div>" + nl(p.b) + "</div>" + (dlinks(p).length ? '<div class="wlnks">' + lnkH(p) + "</div>" : "") + imgs(p) + "</details>" : "") +
      (t.c.length ? "<b>完了前チェック</b>" : "") + t.c.map((c, i) => '<label class="wck"><input type="checkbox" ' + (W.S.cd[ck(t, i)] ? "checked" : "") + ' data-wchg="cc" data-id="' + t.id + '" data-i="' + i + '"> ' + esc(c) + "</label>").join("") +
      (t.u ? '<p><a href="' + esc(t.u) + '" target="_blank" rel="noopener">資料を開く ↗</a></p>' : "") + (t.lk.length ? "<p>" + t.lk.map(linkOf).join(" ") + "</p>" : "") +
      '<div class="note">📝 来年へのメモ(次の年度の注意として残ります)</div><textarea data-wchg="mk" data-id="' + t.id + '">' + esc(t.k) + "</textarea>" +
      '<div class="dlg-btns" style="justify-content:flex-start"><button class="btn on" data-wact="done" data-id="' + t.id + '" data-m="' + m + '">' + (dn ? "未完了に戻す" : "完了にする") + '</button><button class="btn" data-wact="eo" data-id="' + t.id + '">編集</button><button class="btn" data-wact="cl">閉じる</button></div>');
  }
  function openEdit(id) {
    const t = id ? W.S.tasks.find(x => x.id === id) : { m: fyIdx() >= 0 && fyIdx() < 12 ? ORDER[fyIdx()] : 4, r: "担", tg: "", t: "", n: "", u: "", p: "", c: [], rep: false, k: "", dd: 0, lk: [] };
    W.ed = Object.assign({}, t, { _id: id || "", c: t.c.slice(), lk: (t.lk || []).slice() }); renderEdit();
  }
  function renderEdit() {
    const t = W.ed, id = t._id, secs = {};
    allLinks().forEach(x => { (secs[x.sec] = secs[x.sec] || []).push(x); });
    modal('<h2 style="margin:0">' + (id ? "編集" : "タスク追加") + '</h2><label>タイトル</label><input type="text" id="we1" value="' + esc(t.t) + '"><label>月</label><select id="we2">' + ORDER.map(m => "<option " + (m === t.m ? "selected" : "") + ">" + m + "</option>").join("") + "</select>" +
      '<label>役割</label><select id="we3">' + ["担", "教", "部"].map(r => '<option value="' + r + '" ' + (r === t.r ? "selected" : "") + ">" + RL[r] + "</option>").join("") + "</select>" +
      '<div>対象(未選択=全学年): ' + ["J", "1", "2", "3"].map(g => '<label class="wck" style="display:inline-block;margin-right:8px"><input type="checkbox" class="we4" value="' + g + '" ' + (t.tg.includes(g) ? "checked" : "") + "> " + (g === "J" ? "中学" : "高" + g) + "</label>").join("") + '<label class="wck" style="display:inline-block"><input type="checkbox" id="we8" ' + (t.rep ? "checked" : "") + "> 毎月繰り返す</label></div>" +
      '<label>日(任意・期限のお知らせとカレンダー用)</label><input type="number" id="we10" min="0" max="31" value="' + (t.dd || "") + '" style="width:90px"><label>注意事項(見落とし防止)</label><textarea id="we5">' + esc(t.n) + '</textarea><label>資料URL</label><input type="text" id="we6" value="' + esc(t.u) + '">' +
      '<label>手順メモ</label><select id="we7"><option value="">なし</option>' + W.S.docs.map(d => '<option value="' + d.id + '" ' + (d.id === t.p ? "selected" : "") + ">" + esc(d.t) + "</option>").join("") + "</select>" +
      '<label>リンク集のリンク（タスクを開いたときに出ます）</label>' + (t.lk.length ? t.lk.map((u, i) => '<div class="wlink"><span class="ml">' + esc(linkTitle(u)) + '</span><button class="btn sm danger" data-wact="lk-del" data-i="' + i + '">外す</button></div>').join("") : "") +
      '<div class="wlink"><select id="we_lk"><option value="">リンク集から選ぶ…</option>' + Object.keys(secs).map(k => '<optgroup label="' + esc(k) + '">' + secs[k].map(x => '<option value="' + esc(x.u) + '">' + esc(x.t) + "</option>").join("") + "</optgroup>").join("") + '</select><button class="btn sm" data-wact="lk-add">追加</button></div>' +
      '<label>完了前チェック(1行1項目)</label><textarea id="we9">' + esc(t.c.join("\n")) + '</textarea><div class="dlg-btns" style="justify-content:flex-start"><button class="btn on" data-wact="es">保存</button>' + (id ? '<button class="btn danger" data-wact="task-del" data-id="' + id + '">削除</button>' : "") + '<button class="btn" data-wact="cl">キャンセル</button></div>');
  }
  function readEd() {
    const t = W.ed;
    Object.assign(t, { t: $("we1").value, m: +$("we2").value, r: $("we3").value, tg: [].slice.call(document.querySelectorAll(".we4:checked")).map(x => x.value).join(""), n: $("we5").value, u: $("we6").value.trim(), p: $("we7").value, c: $("we9").value.split("\n").filter(x => x.trim()), rep: $("we8").checked, dd: +$("we10").value || 0 });
  }
  function saveEdit() {
    readEd(); const e = W.ed; let t = e._id ? W.S.tasks.find(x => x.id === e._id) : null;
    if (!t) { t = { id: "n" + Date.now(), k: "" }; W.S.tasks.push(t); }
    Object.assign(t, { t: e.t || "(無題)", m: e.m, r: e.r, tg: e.tg, n: e.n, u: e.u, p: e.p, c: e.c, rep: e.rep, dd: e.dd, lk: e.lk });
    save(); cl(); redraw();
  }
  function exportBackup() {
    const text = JSON.stringify(W.S, null, 1), name = "shigoto-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    try { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "application/json" })); a.download = name; a.click(); } catch (e) { root.alert("書き出せませんでした。"); }
  }
  function importBackup(f) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const o = JSON.parse(r.result); if (!o.tasks || !o.docs) throw 0;
        if (!root.confirm("いまの校務タブのデータを、このファイルの内容に置き換えます。よろしいですか？\n（メールアドレスや電話番号は自動で伏せ字に置き換えます。生徒の名前など個人情報が書いていないかは、念のため確認してください）")) return;
        o.y = o.y || FY; W.S = mig(o); save(); ui.tab = "home"; A.render(); A.toast && A.toast("読み込みました");
      } catch (e) { root.alert("読み込めませんでした。「1年間の仕事」アプリで書き出したバックアップ(.json)を選んでください。"); }
    };
    r.readAsText(f);
  }

  function zoom(z) {
    const i = $("wimgbig"); i.dataset.z = z; i.style.width = z === "fit" ? "100%" : z === "x2" ? "200%" : "300%";
    document.querySelectorAll("[data-wzoom]").forEach(b => b.setAttribute("aria-pressed", b.dataset.wzoom === z));
  }
  document.addEventListener("click", e => {
    const im = e.target.closest(".wim");
    if (im) { $("wimgbig").src = im.src; zoom("fit"); if (!$("wimgdlg").open) $("wimgdlg").showModal(); return; }
    const zb = e.target.closest("[data-wzoom]"); if (zb) { zoom(zb.dataset.wzoom); return; }
    if (e.target.id === "wimgbig") { zoom($("wimgbig").dataset.z === "fit" ? "x2" : "fit"); return; }
    if (e.target.id === "wimgclose") { $("wimgdlg").close(); return; }
    const tb = e.target.closest("[data-wtab]");
    if (tb) { ui.tab = tb.dataset.wtab; A.render(); root.scrollTo(0, 0); return; }
    const t = e.target.closest("[data-wact]"); if (!t) return;
    const a = t.dataset.wact, id = t.dataset.id, i = +t.dataset.i;
    switch (a) {
      case "op": openTask(id, +t.dataset.m); break;
      case "cl": cl(); break;
      case "done": toggle(id, +t.dataset.m); cl(); break;
      case "eo": openEdit(id || ""); break;
      case "es": saveEdit(); break;
      case "task-del": if (root.confirm("削除しますか？")) { W.S.tasks = W.S.tasks.filter(x => x.id !== id); save(); cl(); redraw(); } break;
      case "lk-add": { readEd(); const u = $("we_lk").value; if (u && W.ed.lk.indexOf(u) < 0) W.ed.lk.push(u); renderEdit(); break; }
      case "lk-del": readEd(); W.ed.lk.splice(i, 1); renderEdit(); break;
      case "tip": { if (ui.tipSort) break; const d = W.S.docs.find(x => x.id === id); modal('<h2 style="margin:0">' + esc(d.t) + '</h2><div style="margin-top:8px">' + nl(d.b) + "</div>" + (dlinks(d).length ? '<div class="wlnks">' + lnkH(d) + "</div>" : "") + imgs(d) + '<div class="dlg-btns"><button class="btn" data-wact="cl">閉じる</button></div>'); break; }
      case "tip-add": W.S.docs.push({ id: "d" + Date.now(), t: "新しいTips", b: "", tip: true, img: [], u: "", tag: "" }); save(); ui.tab = "docs"; A.render(); root.scrollTo(0, document.body.scrollHeight); break;
      case "doc-add": {
        const d = { id: "d" + Date.now(), t: "", b: "", img: [], u: "", tag: "" };
        W.S.docs.unshift(d); ui.docOpen[d.id] = true; ui.dq = ""; ui.tab = "docs"; save(); A.render(); root.scrollTo(0, 0);
        const el = document.querySelector('.wdoc[data-id="' + d.id + '"] [data-wf="doc-t"]'); if (el) el.focus();
        break;
      }
      case "doc-del": if (root.confirm("削除しますか？")) { W.S.docs.splice(i, 1); save(); A.render(); } break;
      case "fav": { const u = t.dataset.u, k = W.S.fav.indexOf(u); if (k >= 0) W.S.fav.splice(k, 1); else W.S.fav.push(u); save(); A.render(); break; }
      case "doc-ladd": { const d = W.S.docs[i]; d.ls = d.ls || []; if (1 + d.ls.length < 5) d.ls.push({ t: "", u: "" }); ui.docOpen[d.id] = true; save(); A.render(); break; }
      case "doc-ldel": { const d = W.S.docs[i]; d.ls.splice(+t.dataset.j, 1); ui.docOpen[d.id] = true; save(); A.render(); break; }
      case "doc-star": W.S.docs[i].tip = !W.S.docs[i].tip; save(); A.render(); break;
      case "tip-sort": ui.tipSort = !ui.tipSort; A.render(); break;
      case "tip-auto": W.S.tipOrder = []; save(); A.render(); break;
      case "tip-mv": {
        const ids = tipList().map(d => d.id), k = ids.indexOf(id), to = k + (+t.dataset.d);
        if (k >= 0 && to >= 0 && to < ids.length) { ids.splice(to, 0, ids.splice(k, 1)[0]); W.S.tipOrder = ids; save(); A.render(); }
        break;
      }
      case "m-toggle": { const k = J.ds(new Date()) + ":" + id; if (W.S.morning.done[k]) delete W.S.morning.done[k]; else W.S.morning.done[k] = true; save(); A.render(); break; }
      case "m-link": { W.S.morning.done[J.ds(new Date()) + ":" + id] = true; save(); setTimeout(() => A.render(), 120); break; }
      case "m-fold": ui.mornOpen = !ui.mornOpen; A.render(); break;
      case "m-add": W.S.morning.items.push({ id: "m" + Date.now(), t: "", u: "" }); save(); A.render(); break;
      case "m-del": W.S.morning.items.splice(i, 1); save(); A.render(); break;
      case "m-up": if (i > 0) { const a = W.S.morning.items; a.splice(i - 1, 0, a.splice(i, 1)[0]); save(); A.render(); } break;
      case "m-dn": if (i < W.S.morning.items.length - 1) { const a = W.S.morning.items; a.splice(i + 1, 0, a.splice(i, 1)[0]); save(); A.render(); } break;
      case "grp": ui.grp = t.dataset.v; A.render(); break;
      case "mine-add": {
        const n = $("wl_t").value.trim(), u = $("wl_u").value.trim();
        if (!n || !/^https?:\/\//.test(u)) { root.alert("名前と、https:// から始まるURLを入れてください。"); break; }
        W.S.mine.push({ id: "m" + Date.now(), t: n, u, sec: $("wl_s").value }); save(); A.render(); break;
      }
      case "mine-del": if (root.confirm("このリンクを消しますか？")) { W.S.mine = W.S.mine.filter(x => x.id !== id); save(); A.render(); } break;
      case "ics-lesson": {
        const r = lessonIcs($("lc1").checked);
        if (!r.n) { root.alert("書き出せる授業がありません。"); break; }
        try { const el = document.createElement("a"); el.href = URL.createObjectURL(new Blob([r.text], { type: "text/calendar" })); el.download = "jugyo-" + A.st.term.id + ".ics"; el.click(); } catch (x) { root.alert("書き出せませんでした。"); }
        break;
      }
      case "ics": {
        const txt = icsText({ a: $("c1").checked, b: $("c2").checked, c: $("c3").checked, d: $("c4").checked });
        try { const el = document.createElement("a"); el.href = URL.createObjectURL(new Blob([txt], { type: "text/calendar" })); el.download = "shigoto-" + W.S.y + ".ics"; el.click(); } catch (x) { const ta = $("icsx"); ta.style.display = "block"; ta.value = txt; ta.select(); root.alert("自動保存できなかったので、下の欄に出しました。コピーして .ics として保存してください。"); }
        break;
      }
      case "bk-out": exportBackup(); break;
      case "reload": reloadRemote(); break;
      case "bell-reset": W.S.bell = bellMig(null); save(); A.render(); break;
      case "create": W.needCreate = false; W.dirty = true; save(); A.render(); break;
      case "draft-drop": LS.del("jd.draft.work"); W.ask = false; W.draftP = null; W.dirty = false; W.st = "GitHubと同期中"; A.render(); break;
      case "draft-use": W.S = mig(W.draftP); W.draftP = null; W.ask = false; W.needCreate = false; W.dirty = true; save(); A.render(); break;
      case "go-home": { const rd = $("remdlg"); if (rd && rd.open) rd.close(); A.ui.mode = "work"; LS.set("jd.mode", "work"); ui.tab = "home"; A.render(); root.scrollTo(0, 0); break; }
    }
  });
  document.addEventListener("change", e => {
    const t = e.target;
    if (t.id === "wbk") { if (t.files[0]) importBackup(t.files[0]); t.value = ""; return; }
    const c = t.dataset && t.dataset.wchg; if (!c) return;
    const id = t.dataset.id, i = +t.dataset.i;
    switch (c) {
      case "tg": toggle(id, +t.dataset.m); break;
      case "cc": { const tk = W.S.tasks.find(x => x.id === id), k = ck(tk, i); if (W.S.cd[k]) delete W.S.cd[k]; else W.S.cd[k] = true; save(); break; }
      case "mk": W.S.tasks.find(x => x.id === id).k = t.value; save(); if (A.ui.mode === "work") A.render(); break;
      case "doc-tag": W.S.docs[i].tag = t.value; save(); break;
      case "doc-go": W.S.docs[i].go = t.value; save(); break;
      case "grade": W.S.g = t.dataset.v; save(); break;
      case "role": { const v = t.dataset.v; W.S.roles = W.S.roles.includes(v) ? W.S.roles.filter(x => x !== v) : W.S.roles.concat(v); save(); break; }
      case "bell": {
        const m = /^(\d{1,2}):(\d{2})$/.exec(t.value); if (!m) break;
        const v = +m[1] * 60 + +m[2], k = t.dataset.k, b = W.S.bell;
        if (k === "yo" || k === "gj" || k === "gh") b[k] = v; else { const i = +k[1], e = k[2] === "e"; b.p[i][e ? 1 : 0] = v; if (b.p[i][1] <= b.p[i][0]) { root.alert("終わりの時刻は、始まりより後にしてください。"); b.p[i] = BDEF.p[i].slice(); } }
        save(); A.render(); break;
      }
      case "m-weekend": W.S.morning.weekend = t.checked; save(); break;
      case "favonly": ui.fav = t.checked; A.render(); break;
    }
  });
  document.addEventListener("input", e => {
    const t = e.target, f = t.dataset && t.dataset.wf; if (!f) return;
    const i = +t.dataset.i;
    if (f === "m-t" || f === "m-u") { W.S.morning.items[i][f === "m-t" ? "t" : "u"] = t.value.trim(); save(); return; }
    if (f === "dq") { ui.dq = t.value; const r = $("wdocs"); if (r) r.innerHTML = docList(); return; }
    if (f === "lq") { ui.q = t.value; const r = $("wres"); if (r) r.innerHTML = linkResults(); return; }
    if (f === "doc-t") { W.S.docs[i].t = t.value; const sm = t.closest(".wdoc"); if (sm) sm.querySelector(".wdt").textContent = t.value || "（無題）"; } else if (f === "doc-b") W.S.docs[i].b = t.value; else if (f === "doc-u") W.S.docs[i].u = t.value; else if (f === "doc-ut") W.S.docs[i].ut = t.value; else if (f === "doc-lt") W.S.docs[i].ls[+t.dataset.j].t = t.value; else if (f === "doc-lu") W.S.docs[i].ls[+t.dataset.j].u = t.value;
    save();
  });

  document.addEventListener("toggle", e => { const d = e.target; if (d && d.classList && d.classList.contains("wdoc")) { if (d.open) ui.docOpen[d.dataset.id] = true; else delete ui.docOpen[d.dataset.id]; } }, true);
  A.work.load = load;
  load();
})(window);
