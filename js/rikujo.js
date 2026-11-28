/* THE WORKBASE: 「陸上部」モード（大会の申込・請求の管理、JAAF登録、大会結果のURL）
 *  - データ: data/rikujo.json（トークンがあれば GitHub に自動保存。なければこの端末の下書き）
 *  - 1つの大会ごとに、7つの手続き（申込・郵送・参加費・出張・引率費・プログラム代・駐車場代）を「未→済→不要」で管理します
 *  - 申込の締切や、大会のあとの請求のし忘れは、「今日の校務」にも出ます
 *  - はじめの中身（2026年度）は js/rikujoseed.js から入ります。パスワードは入れていません */
(function (root) {
  "use strict";
  const J = root.JD, S = root.JDStore, A = root.A, LS = S.LS, esc = J.esc;
  const WD = "日月火水木金土";
  const okd = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const now = () => J.ds(new Date());
  const fy = s => { const p = s.split("-").map(Number); return p[0] - (p[1] < 4 ? 1 : 0); };
  const wd = s => WD[J.pd(s).getDay()];
  const md = s => (okd(s) ? +s.slice(5, 7) + "/" + +s.slice(8, 10) : "");
  const mdw = s => (okd(s) ? md(s) + "(" + wd(s) + ")" : "");
  const diff = s => Math.round((J.pd(s) - J.pd(now())) / 864e5);
  const uid = () => Math.random().toString(36).slice(2, 9);
  const STEPS = [["web", "申込", "WEB・メールの申込"], ["post", "郵送", "申込書の郵送"], ["fee", "参加費", "大会参加費の請求"], ["trip", "出張", "出張申請"], ["esc", "引率費", "引率費の請求"], ["prog", "プログラム", "プログラム代の請求"], ["park", "駐車場", "駐車場代の請求（自家用車届）"]];
  const JST = [["list", "会員一覧＋職印"], ["rcpt", "コンビニ領収書"], ["cert", "支払い証明書"], ["claim", "事務へ請求"], ["sub", "専門部へ提出"]];
  const LV = ["", "中", "高", "中高"];
  const FORMK = [["fee", "参加費の書式（現金払い清算書）"], ["esc", "引率費の書式（出張費精算・出金伝票）"], ["prog", "プログラム代の書式"], ["park", "駐車場代の書式（自家用車届）"]];
  const SL = ["未", "済", "不要"], SC = ["s0", "s1", "s2"];
  const Q = { S: null, sha: null, dirty: false, saving: false, timer: null, token: false, conflict: false, ask: false, needCreate: false, draftP: null, canSave: true, st: "読み込み中…", ready: false };
  const ui = { tab: "home", Y: fy(now()), ed: null, open: {}, jed: false, msg: "" };
  A.rikujo = {}; A.ui.rik = ui;

  /* ---------- データ ---------- */
  const url = u => (/^https?:\/\//i.test(String(u || "")) ? String(u).trim() : "");
  const stOf = (o, keys) => { const r = {}; keys.forEach(k => { const v = o && o[k]; r[k] = v === 1 || v === 2 ? v : 0; }); return r; };
  function migMeet(m) {
    const lk = {}; if (m.lk && typeof m.lk === "object") Object.keys(m.lk).forEach(k => { if (url(m.lk[k])) lk[k] = url(m.lk[k]); });
    return { id: String(m.id || uid()), y: +m.y || 2026, n: String(m.n || "（名前なし）"), lv: LV.includes(m.lv) ? m.lv : "", d1: okd(m.d1) ? m.d1 : "", d2: okd(m.d2) ? m.d2 : "", r1: okd(m.r1) ? m.r1 : "", r2: okd(m.r2) ? m.r2 : "",
      st: stOf(m.st, STEPS.map(x => x[0])), dir: url(m.dir), lk, nt: String(m.nt || ""), rs: (Array.isArray(m.rs) ? m.rs : []).filter(x => Array.isArray(x) && url(x[1])).map(x => [String(x[0] || ""), url(x[1])]) };
  }
  function mig(s) {
    s = s && typeof s === "object" && !Array.isArray(s) ? s : {};
    const out = { v: 1, upd: +s.upd || 0, seeded: s.seeded ? 1 : 0, meets: [], jaaf: [], jnote: String(s.jnote || ""), links: [], forms: {} };
    out.meets = (Array.isArray(s.meets) ? s.meets : []).filter(m => m && typeof m === "object").map(migMeet);
    out.jaaf = (Array.isArray(s.jaaf) ? s.jaaf : []).filter(r => r && typeof r === "object").map(r => ({ id: String(r.id || uid()), y: +r.y || 2026, n: String(r.n || ""), st: stOf(r.st, JST.map(x => x[0])) }));
    out.links = (Array.isArray(s.links) ? s.links : []).filter(l => Array.isArray(l) && url(l[1])).map(l => [String(l[0] || "リンク"), url(l[1])]);
    FORMK.forEach(f => { out.forms[f[0]] = url(s.forms && s.forms[f[0]]); });
    if (!out.seeded && !out.meets.length && !out.jaaf.length && root.RIKUJO_SEED) {
      const d = JSON.parse(JSON.stringify(root.RIKUJO_SEED));
      out.meets = d.meets.map(migMeet); out.jaaf = d.jaaf.map(r => ({ id: String(r.id), y: r.y, n: r.n, st: stOf(r.st, JST.map(x => x[0])) }));
      out.jnote = String(d.jnote || ""); out.links = d.links.filter(l => url(l[1])); FORMK.forEach(f => { out.forms[f[0]] = url(d.forms && d.forms[f[0]]); }); out.seeded = 1;
    }
    return out;
  }

  /* ---------- 読み込み・保存（他のモードと同じ安全のしくみ） ---------- */
  const ghOn = () => { const s = S.getSettings(); return !!(s.token && s.owner && s.repo); };
  async function load() {
    const s = S.getSettings(); Q.token = ghOn();
    let text = null;
    if (Q.token) {
      try { const r = await S.remoteGet(s, "data/rikujo.json"); text = r.text; Q.sha = r.sha; Q.st = "GitHubと同期中"; }
      catch (e) { if (e.status !== 404) { Q.canSave = false; Q.st = "⚠ " + S.explain(e) + "（GitHubへの保存は止めています）"; } else { Q.needCreate = true; Q.st = "GitHubに rikujo.json がまだありません"; } }
    } else {
      try { const r = await fetch("data/rikujo.json?t=" + Date.now(), { cache: "no-store" }); if (r.ok) text = await r.text(); } catch (e) { text = null; }
      Q.st = "この端末のみ保存（右上の「設定」でGitHubを接続できます）";
    }
    let p = null; try { p = text ? JSON.parse(text) : null; } catch (e) { p = null; }
    let dr = null; try { const raw = LS.get("jd.draft.rikujo"); dr = raw ? JSON.parse(raw) : null; } catch (e) { dr = null; }
    if (dr && dr.dirty && dr.p) {
      if (Q.token && Q.sha && dr.base !== Q.sha) { Q.ask = true; Q.draftP = dr.p; }
      else { p = dr.p; Q.dirty = true; }
    }
    Q.S = mig(p); Q.ready = true;
    if (Q.dirty && Q.token && Q.canSave && !Q.ask && !Q.needCreate) flush(); else if (Q.dirty) LS.set("jd.draft.rikujo", JSON.stringify({ p: Q.S, dirty: true, base: Q.sha }));
    A.render && A.render();
  }
  function save() {
    Q.S.upd = Date.now(); Q.dirty = true; LS.set("jd.draft.rikujo", JSON.stringify({ p: Q.S, dirty: true, base: Q.sha }));
    clearTimeout(Q.timer); Q.timer = setTimeout(flush, 900); setStatus();
  }
  async function flush() {
    if (!Q.dirty || !Q.token || !Q.canSave || Q.conflict || Q.ask || Q.needCreate) { setStatus(); return; }
    if (Q.saving) { clearTimeout(Q.timer); Q.timer = setTimeout(flush, 600); return; }
    Q.saving = true; Q.st = "GitHubに保存中…"; setStatus();
    const snap = JSON.stringify(Q.S), body = J.toJSON(Q.S);
    try {
      const r = await S.remotePut(S.getSettings(), "data/rikujo.json", body, Q.sha, "陸上部を更新");
      Q.sha = r.sha; Q.st = "GitHubに保存済み";
      if (JSON.stringify(Q.S) === snap) { Q.dirty = false; LS.del("jd.draft.rikujo"); } else { clearTimeout(Q.timer); Q.timer = setTimeout(flush, 300); }
    } catch (e) {
      if (e.status === 409 || e.status === 422) Q.conflict = true;
      Q.st = "⚠ " + S.explain(e);
    }
    Q.saving = false; setStatus(); if (Q.conflict && A.ui.mode === "rik") A.render();
  }
  const setStatus = () => { if (A.ui.mode === "rik" && A.renderStatus) A.renderStatus(); };
  async function reloadRemote() {
    try { const r = await S.remoteGet(S.getSettings(), "data/rikujo.json"); Q.sha = r.sha; Q.S = mig(JSON.parse(r.text)); Q.conflict = false; Q.canSave = true; Q.dirty = false; LS.del("jd.draft.rikujo"); Q.st = "GitHubと同期中"; A.render(); }
    catch (e) { root.alert(S.explain(e)); }
  }
  async function refreshRik() {
    if (document.hidden || !Q.ready || !Q.token || Q.saving || Q.dirty || Q.conflict || Q.ask || Q.needCreate || !Q.canSave) return;
    if (document.querySelector("dialog[open]") || (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) return;
    try { const r = await S.remoteGet(S.getSettings(), "data/rikujo.json"); if (r.sha !== Q.sha && !Q.dirty && !Q.saving) { Q.sha = r.sha; Q.S = mig(JSON.parse(r.text)); A.render(); } } catch (e) { /* 次の機会に */ }
  }
  document.addEventListener("visibilitychange", refreshRik);

  /* ---------- 計算 ---------- */
  const meetsY = y => Q.S.meets.filter(m => m.y === y).sort((a, b) => (a.d1 || "9999") < (b.d1 || "9999") ? -1 : (a.d1 || "9999") > (b.d1 || "9999") ? 1 : 0);
  const jaafY = y => Q.S.jaaf.filter(r => r.y === y);
  const years = () => [...new Set([fy(now()), fy(now()) + 1, ui.Y].concat(Q.S.meets.map(m => m.y), Q.S.jaaf.map(r => r.y)))].sort();
  const names = (m, keys) => keys.filter(k => m.st[k] === 0).map(k => STEPS.find(x => x[0] === k)[1]);
  /* やること：[{t:文, bad:急ぎ, d:並べ替えの日付, id}] */
  function todos(y) {
    const t = now(), out = [];
    meetsY(y).forEach(m => {
      const end = m.d2 || m.d1, ap = names(m, ["web", "post"]);
      if (ap.length && m.r2 && (!end || end >= t)) {
        const n = diff(m.r2);
        if (n < 0) out.push({ t: m.n + "：申込（" + ap.join("・") + "）がまだ。締切 " + md(m.r2) + " を過ぎています", bad: 1, d: m.r2, id: m.id });
        else if (n <= 14) out.push({ t: m.n + "：申込（" + ap.join("・") + "）がまだ。締切 " + md(m.r2) + "（あと" + n + "日）", bad: n <= 3 ? 1 : 0, d: m.r2, id: m.id });
      }
      if (m.st.trip === 0 && m.d1 && m.d1 >= t && diff(m.d1) <= 7) out.push({ t: m.n + "：出張申請がまだ（大会 " + md(m.d1) + "）", bad: 0, d: m.d1, id: m.id });
      if (end && end < t) {
        const cl = names(m, ["fee", "trip", "esc", "prog", "park"]);
        if (cl.length) out.push({ t: m.n + "：大会のあとの手続きがまだ（" + cl.join("・") + "）", bad: 1, d: end, id: m.id });
      }
    });
    jaafY(y).forEach(r => {
      const ks = JST.map(x => x[0]), done = ks.filter(k => r.st[k] === 1).length, left = JST.filter(x => r.st[x[0]] === 0).map(x => x[1]);
      if (done > 0 && left.length) out.push({ t: "JAAF登録 " + r.n + "：あと " + left.join("・"), bad: 0, d: "9999", id: r.id, j: 1 });
    });
    return out.sort((a, b) => (b.bad - a.bad) || (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
  }

  /* ---------- 表示 ---------- */
  const hdr = t => '<div class="pghd"><div><h2 class="pgt">TRACK</h2><p class="pgs">' + t + "</p></div></div>";
  const panel = (h, b, cls) => '<section class="panel p-rik' + (cls ? " " + cls : "") + '"><header class="panel-h"><h2>' + h + '</h2></header><div class="panel-b">' + b + "</div></section>";
  const yearSel = () => '<select data-rchg="y" style="width:auto;margin:0 0 12px">' + years().map(y => "<option" + (y === ui.Y ? " selected" : "") + ">" + y + "</option>").join("") + "</select> 年度";
  function askH() {
    if (Q.needCreate) return '<div class="banner"><div>GitHubに data/rikujo.json がまだありません。はじめて使うときは、下のボタンで作ってください。前に作ったことがあるのにこの表示が出るときは、押さずに、右上の「設定」のブランチ名などを確かめてください。</div><div class="btns"><button class="btn" data-ract="create">新しく作る</button></div></div>';
    if (Q.ask) return '<div class="banner err"><div>この端末に、GitHubにまだ保存していない変更があります。GitHubは別の端末で更新されているかもしれません。どちらを使いますか？</div><div class="btns"><button class="btn" data-ract="draft-drop">GitHubの最新を使う（この端末の変更は破棄）</button><button class="btn" data-ract="draft-use">この端末の変更で上書き保存</button></div></div>';
    if (Q.conflict) return '<div class="banner err"><div>別の端末で先に更新されています。</div><div class="btns"><button class="btn" data-ract="reload">最新を読み込み直す</button></div></div>';
    return "";
  }
  const linkChips = () => Q.S.links.length ? '<div class="rkln">' + Q.S.links.map(l => '<a class="rkl2" href="' + esc(l[1]) + '" target="_blank" rel="noopener">' + esc(l[0]) + "</a>").join("") + "</div>" : "";
  function chip(m, k, lab, isJ) {
    const v = m.st[k], ln = isJ ? "" : ((m.lk && m.lk[k]) || (Q.S.forms && Q.S.forms[k]) || "");
    return '<span class="rkcw"><button class="rkc ' + SC[v] + '" data-ract="st" data-id="' + esc(m.id) + '" data-k="' + k + '"' + (isJ ? ' data-j="1"' : "") + ' title="押すたびに 未→済→不要 と変わります（いまは' + SL[v] + '）">' + (v === 1 ? "✓ " : "") + esc(lab) + "</button>" +
      (ln ? '<a class="rkl" href="' + esc(ln) + '" target="_blank" rel="noopener" title="書式を開く">↗</a>' : "") + "</span>";
  }
  const resHtml = m => m.rs.length ? '<div class="rkrs">🏁 ' + m.rs.map((x, i) => '<span class="rkrc"><a href="' + esc(x[1]) + '" target="_blank" rel="noopener">' + esc(x[0] || "結果") + "</a><button class=\"rkx\" data-ract=\"rsdel\" data-id=\"" + esc(m.id) + '" data-i="' + i + '" title="このリンクを消す">×</button></span>').join("") + "</div>" : "";
  function meetCard(m) {
    if (ui.ed === m.id) return meetForm(m);
    const open = !!ui.open[m.id], t = now(), end = m.d2 || m.d1, past = end && end < t;
    const fin = STEPS.every(s => m.st[s[0]] !== 0);
    const dt = m.d1 ? mdw(m.d1) + (m.d2 && m.d2 !== m.d1 ? "〜" + mdw(m.d2) : "") : "日程未定";
    const rg = m.r1 || m.r2 ? "登録 " + (md(m.r1) || "") + "〜" + (md(m.r2) || "") : "";
    const nw = diff(m.r2 || "9999-12-31");
    const warn = !fin && m.r2 && names(m, ["web", "post"]).length && (!end || end >= t) ? (nw < 0 ? '<span class="rkw bad">締切 過ぎ</span>' : nw <= 14 ? '<span class="rkw">締切まで' + nw + "日</span>" : "") : "";
    let b = '<div class="rkm' + (fin && past ? " fin" : "") + '"><div class="rkh"><span class="rkd">' + dt + '</span>' + (m.lv ? '<span class="rklv lv' + (m.lv === "中" ? "c" : m.lv === "高" ? "k" : "b") + '">' + m.lv + "</span>" : "") +
      '<button class="rkn" data-ract="tg" data-id="' + esc(m.id) + '" aria-expanded="' + open + '">' + esc(m.n) + "</button>" + (rg ? '<span class="rkr">' + rg + "</span>" : "") + warn + "</div>";
    b += '<div class="rkcs">' + STEPS.map(s => chip(m, s[0], s[1])).join("") + "</div>" + resHtml(m);
    if (open) {
      b += '<div class="rkdt">';
      if (m.nt) b += '<div class="rknt">' + esc(m.nt).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>') + "</div>";
      b += '<div class="rkac">' + (m.dir ? '<a class="btn" href="' + esc(m.dir) + '" target="_blank" rel="noopener">📁 大会のフォルダ</a>' : "") +
        '<button class="btn" data-ract="ed" data-id="' + esc(m.id) + '">編集</button><button class="btn danger" data-ract="del" data-id="' + esc(m.id) + '">削除</button></div>';
      b += '<form class="rkrf" data-rform="rs" data-id="' + esc(m.id) + '"><input name="u" type="url" placeholder="大会結果のURLを貼る" required><input name="l" type="text" placeholder="名前（省略できます）" style="max-width:11em"><button class="btn on" type="submit">結果を足す</button></form></div>';
    }
    return b + "</div>";
  }
  function meetForm(m) {
    const nw = m.id === "new", v = k => esc(m[k] || ""), inp = (k, l, ty) => '<label>' + l + '<input type="' + (ty || "text") + '" name="' + k + '" value="' + v(k) + '"></label>';
    return '<form class="rkf" data-rform="meet" data-id="' + esc(m.id) + '"><h3>' + (nw ? "大会を足す" : "大会を直す") + "</h3><div class=\"rkfg\">" + inp("n", "大会名") +
      '<label>区分<select name="lv">' + LV.map(x => "<option value=\"" + x + "\"" + (m.lv === x ? " selected" : "") + ">" + (x || "なし") + "</option>").join("") + "</select></label>" +
      inp("d1", "大会の初日", "date") + inp("d2", "最終日（1日だけなら空）", "date") + inp("r1", "登録期間の始め", "date") + inp("r2", "登録期間の終わり（締切）", "date") + "</div>" +
      '<div class="rkfg">' + inp("dir", "大会のフォルダ（Googleドライブ）のURL", "url") + FORMK.map(f => '<label>' + f[1] + "（この大会だけ別のとき）" + '<input type="url" name="lk_' + f[0] + '" value="' + esc((m.lk && m.lk[f[0]]) || "") + '"></label>').join("") + "</div>" +
      '<label>備考<textarea name="nt" rows="4">' + esc(m.nt) + '</textarea></label><label>大会結果のURL（1行に1つ。「名前 URL」でも書けます）<textarea name="rs" rows="2">' + esc(m.rs.map(x => (x[0] ? x[0] + " " : "") + x[1]).join("\n")) + '</textarea></label>' +
      '<div class="rkac"><button class="btn on" type="submit">保存</button><button class="btn" type="button" data-ract="c">やめる</button></div></form>';
  }
  function viewHome() {
    const y = Math.max(fy(now()), 2026), td = todos(y), t = now();
    const up = Q.S.meets.filter(m => m.d1 && (m.d2 || m.d1) >= t).sort((a, b) => a.d1 < b.d1 ? -1 : 1).slice(0, 4);
    let h = askH() + hdr("陸上部 ・ " + y + "年度");
    h += panel("やること", td.length ? td.map(x => '<div class="rktd' + (x.bad ? " bad" : "") + '"><span>' + esc(x.t) + '</span><button class="btn" data-ract="open" data-id="' + esc(x.id) + '"' + (x.j ? ' data-j="1"' : "") + ">開く</button></div>").join("") : '<p class="note" style="margin:0">いま、やることはありません。</p>');
    h += panel("これからの大会", up.length ? up.map(m => '<div class="rktd"><span><b>' + mdw(m.d1) + (m.d2 && m.d2 !== m.d1 ? "〜" + mdw(m.d2) : "") + "</b>　" + esc(m.n) + (m.lv ? "（" + m.lv + "）" : "") + (m.r2 ? '<span class="note">　締切 ' + mdw(m.r2) + "</span>" : "") + '</span><button class="btn" data-ract="open" data-id="' + esc(m.id) + '">開く</button></div>').join("") : '<p class="note" style="margin:0">日程の入った、これからの大会はありません。</p>');
    if (Q.S.links.length) h += panel("リンク", linkChips());
    return h;
  }
  function viewMeets() {
    const y = ui.Y, ms = meetsY(y);
    let h = askH() + hdr("大会") + '<div class="rkbar">' + yearSel() + '<button class="btn on" data-ract="new">大会を足す</button></div>';
    h += '<p class="note" style="margin:0 0 8px">手続きのボタンは、押すたびに「未 → 済 → 不要」と変わります。ボタンの右の ↗ は、書式を開きます。大会名を押すと、備考や結果のURLが開きます。</p>';
    if (ui.ed === "new") h += meetForm({ id: "new", n: "", lv: "", d1: "", d2: "", r1: "", r2: "", dir: "", lk: {}, nt: "", rs: [], st: {} });
    if (!ms.length && ui.ed !== "new") {
      const prev = Q.S.meets.filter(m => m.y === y - 1).length;
      h += '<p class="note">' + y + "年度の大会は、まだありません。</p>" + (prev ? '<button class="btn on" data-ract="carry">' + (y - 1) + "年度の大会を引き継いで作る</button>" : "");
    }
    return h + ms.map(meetCard).join("");
  }
  function viewJaaf() {
    const y = ui.Y, rs = jaafY(y);
    let h = askH() + hdr("JAAF登録") + '<div class="rkbar">' + yearSel() + '<button class="btn on" data-ract="jadd">行を足す</button></div>';
    h += '<p class="note" style="margin:0 0 8px">ボタンは、押すたびに「未 → 済 → 不要」と変わります。</p>';
    if (!rs.length) h += '<p class="note">' + y + "年度の行は、まだありません。</p>" + (Q.S.jaaf.some(r => r.y === y - 1) ? '<button class="btn on" data-ract="jcarry">' + (y - 1) + "年度の行を引き継いで作る</button>" : "");
    h += rs.map(r => '<div class="rkm"><div class="rkh"><b class="rkjn">' + esc(r.n) + '</b><button class="rkx2" data-ract="jren" data-id="' + esc(r.id) + '" title="名前を直す">名前</button><button class="rkx2" data-ract="jdel" data-id="' + esc(r.id) + '" title="この行を消す">削除</button></div><div class="rkcs">' + JST.map(s => chip(r, s[0], s[1], true)).join("") + "</div></div>").join("");
    h += '<details class="rkman"' + (ui.jed ? " open" : "") + '><summary>手順メモ（登録費の請求・中体連への会員一覧の提出）</summary><textarea data-rchg="jnote" rows="9">' + esc(Q.S.jnote) + "</textarea></details>";
    return h + panel("リンク", linkChips() || '<p class="note" style="margin:0">「設定」でリンクを入れられます。</p>');
  }
  function viewSet() {
    let h = askH() + hdr("設定");
    h += panel("共通のリンク", '<p class="note" style="margin:0 0 6px">1行に1つ。「名前 URL」の形で書きます。ホームとJAAF登録に出ます。</p><textarea data-rchg="links" rows="8" style="width:100%">' + esc(Q.S.links.map(l => l[0] + " " + l[1]).join("\n")) + "</textarea>");
    h += panel("手続きの書式のリンク（全部の大会で共通）", '<div class="rkfg">' + FORMK.map(f => "<label>" + f[1] + '<input type="url" data-rchg="form" data-k="' + f[0] + '" value="' + esc(Q.S.forms[f[0]] || "") + '"></label>').join("") + "</div>");
    const y = ui.Y;
    h += panel("年度を進める", '<p class="note" style="margin:0 0 8px">大会名・区分・備考・書式のリンクを引き継ぎます。日程と結果は空にして、手続きは「未」からはじめます（「不要」はそのまま）。</p><button class="btn on" data-ract="carry-set">' + (ui.Y) + "年度から " + (ui.Y + 1) + "年度を作る</button>");
    h += panel("バックアップ", '<button class="btn" data-ract="export">ファイルに書き出す</button>');
    return h;
  }
  A.rikujo.view = function () {
    if (!Q.ready) return '<p class="note">読み込んでいます…</p>';
    return { home: viewHome, meets: viewMeets, jaaf: viewJaaf, set: viewSet }[ui.tab]();
  };
  A.rikujo.sub = () => "陸上部" + (Q.ready ? " ・ " + ui.Y + "年度" : "");
  A.rikujo.statusText = () => Q.st;
  A.rikujo.dueCount = () => (Q.ready ? todos(Math.max(fy(now()), 2026)).length : 0);
  /* 「今日の校務」の枠に一緒に出す */
  A.rikujo.todayItems = function () {
    if (!Q.ready) return { n: 0, html: "" };
    const td = todos(Math.max(fy(now()), 2026)); if (!td.length) return { n: 0, html: "" };
    return { n: td.length, html: '<h3 class="tstd rtd">陸上部 <span class="note">' + td.length + "件</span></h3>" + td.map(x => '<div class="ktodo"><span class="' + (x.bad ? "bad" : "") + '">' + esc(x.t) + '</span><button class="btn" data-ract="open" data-id="' + esc(x.id) + '"' + (x.j ? ' data-j="1"' : "") + ">開く</button></div>").join("") };
  };

  /* ---------- 操作 ---------- */
  const parseLines = txt => String(txt || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean).map(s => { const p = s.split(/\s+/), i = p.findIndex(x => /^https?:\/\//i.test(x)); return i < 0 ? null : [p.slice(0, i).join(" "), p[i]]; }).filter(Boolean);
  const dl = (name, text) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "application/json" })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); };
  function carryMeets(from, to) {
    if (Q.S.meets.some(m => m.y === to)) return 0;
    const src = Q.S.meets.filter(m => m.y === from).sort((a, b) => (a.d1 || "9999") < (b.d1 || "9999") ? -1 : 1);
    src.forEach(m => { const c = migMeet(JSON.parse(JSON.stringify(m))); c.id = uid(); c.y = to; c.d1 = c.d2 = c.r1 = c.r2 = ""; c.rs = []; Object.keys(c.st).forEach(k => { if (c.st[k] === 1) c.st[k] = 0; }); Q.S.meets.push(c); });
    return src.length;
  }
  function carryJaaf(from, to) {
    if (Q.S.jaaf.some(r => r.y === to)) return 0;
    const src = Q.S.jaaf.filter(r => r.y === from);
    src.forEach(r => { const c = JSON.parse(JSON.stringify(r)); c.id = uid(); c.y = to; Object.keys(c.st).forEach(k => { if (c.st[k] === 1) c.st[k] = 0; }); Q.S.jaaf.push(c); });
    return src.length;
  }
  document.addEventListener("click", e => {
    const tb = e.target.closest("[data-rtab]");
    if (tb) { A.ui.mode = "rik"; LS.set("jd.mode", "rik"); ui.tab = tb.dataset.rtab; ui.ed = null; A.render(); root.scrollTo(0, 0); return; }
    const t = e.target.closest("[data-ract]"); if (!t) return;
    const a = t.dataset.ract, id = t.dataset.id, S0 = Q.S, m = S0 && S0.meets.find(x => x.id === id), jr = S0 && S0.jaaf.find(x => x.id === id);
    switch (a) {
      case "create": Q.needCreate = false; Q.dirty = true; save(); A.render(); return;
      case "reload": reloadRemote(); return;
      case "draft-drop": LS.del("jd.draft.rikujo"); Q.ask = false; Q.draftP = null; Q.dirty = false; Q.st = "GitHubと同期中"; A.render(); return;
      case "draft-use": Q.S = mig(Q.draftP); Q.draftP = null; Q.ask = false; Q.needCreate = false; Q.dirty = true; save(); A.render(); return;
      case "st": { const o = t.dataset.j ? jr : m, k = t.dataset.k; if (!o) return; o.st[k] = ((o.st[k] || 0) + 1) % 3; save(); A.render(); return; }
      case "tg": ui.open[id] = !ui.open[id]; A.render(); return;
      case "open": {
        A.ui.mode = "rik"; LS.set("jd.mode", "rik");
        if (t.dataset.j) { ui.tab = "jaaf"; if (jr) ui.Y = jr.y; } else { ui.tab = "meets"; if (m) { ui.Y = m.y; ui.open[id] = true; } }
        A.render(); root.scrollTo(0, 0); return;
      }
      case "new": ui.ed = "new"; A.render(); return;
      case "ed": ui.ed = id; A.render(); return;
      case "c": ui.ed = null; A.render(); return;
      case "del": if (m && root.confirm("「" + m.n + "」を削除しますか？")) { S0.meets = S0.meets.filter(x => x.id !== id); save(); A.render(); } return;
      case "rsdel": if (m) { m.rs.splice(+t.dataset.i, 1); save(); A.render(); } return;
      case "jadd": { const n = root.prompt("追加する行の名前（例：高校(4回目)）"); if (n && n.trim()) { S0.jaaf.push({ id: uid(), y: ui.Y, n: n.trim(), st: stOf({}, JST.map(x => x[0])) }); save(); A.render(); } return; }
      case "jren": { const n = jr && root.prompt("名前を直す", jr.n); if (n && n.trim()) { jr.n = n.trim(); save(); A.render(); } return; }
      case "jdel": if (jr && root.confirm("「" + jr.n + "」の行を削除しますか？")) { S0.jaaf = S0.jaaf.filter(x => x.id !== id); save(); A.render(); } return;
      case "carry": { const n = carryMeets(ui.Y - 1, ui.Y); if (n) { carryJaaf(ui.Y - 1, ui.Y); save(); } A.render(); return; }
      case "jcarry": { if (carryJaaf(ui.Y - 1, ui.Y)) save(); A.render(); return; }
      case "carry-set": {
        const to = ui.Y + 1;
        if (S0.meets.some(x => x.y === to) || S0.jaaf.some(x => x.y === to)) { root.alert(to + "年度は、もうあります。"); return; }
        if (!root.confirm(ui.Y + "年度から、" + to + "年度を作りますか？")) return;
        carryMeets(ui.Y, to); carryJaaf(ui.Y, to); ui.Y = to; ui.tab = "meets"; save(); A.render(); return;
      }
      case "export": dl("rikujo-" + now() + ".json", J.toJSON(S0)); return;
    }
  });
  document.addEventListener("change", e => {
    const t = e.target.closest && e.target.closest("[data-rchg]"); if (!t || !Q.S) return;
    const k = t.dataset.rchg;
    if (k === "y") { ui.Y = +t.value; ui.ed = null; A.render(); return; }
    if (k === "jnote") Q.S.jnote = t.value;
    else if (k === "links") Q.S.links = parseLines(t.value).map(x => [x[0] || "リンク", x[1]]);
    else if (k === "form") Q.S.forms[t.dataset.k] = url(t.value);
    else return;
    save();
  });
  document.addEventListener("submit", e => {
    const f = e.target.closest && e.target.closest("form[data-rform]"); if (!f) return;
    e.preventDefault();
    const k = f.dataset.rform, id = f.dataset.id, fd = {}; new FormData(f).forEach((v, n) => { fd[n] = String(v).trim(); });
    if (k === "rs") {
      const m = Q.S.meets.find(x => x.id === id); if (!m || !url(fd.u)) return;
      m.rs.push([fd.l || "", url(fd.u)]); save(); A.render(); return;
    }
    if (!fd.n) { root.alert("大会名を入れてください"); return; }
    if (fd.d1 && fd.d2 && fd.d2 < fd.d1) { root.alert("最終日が、初日より前になっています"); return; }
    const lk = {}; FORMK.forEach(x => { if (url(fd["lk_" + x[0]])) lk[x[0]] = url(fd["lk_" + x[0]]); });
    const rs = parseLines(fd.rs).map(x => [x[0], x[1]]);
    if (id === "new") {
      const m = migMeet({ id: uid(), y: ui.Y, n: fd.n, lv: fd.lv, d1: fd.d1, d2: fd.d2, r1: fd.r1, r2: fd.r2, dir: fd.dir, lk, nt: fd.nt, rs, st: {} });
      Q.S.meets.push(m); ui.open[m.id] = true;
    } else {
      const i = Q.S.meets.findIndex(x => x.id === id); if (i < 0) return;
      Q.S.meets[i] = migMeet(Object.assign({}, Q.S.meets[i], { n: fd.n, lv: fd.lv, d1: fd.d1, d2: fd.d2, r1: fd.r1, r2: fd.r2, dir: fd.dir, lk, nt: fd.nt, rs }));
    }
    ui.ed = null; save(); A.render();
  });
  document.addEventListener("toggle", e => { const d = e.target; if (d && d.classList && d.classList.contains("rkman")) ui.jed = d.open; }, true);
  A.rikujo.load = load;
  load();
})(window);
