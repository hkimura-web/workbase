/* THE WORKBASE: 「テスト成績」モード（テスト期間だけ使う、試験準備〜成績会議の工程管理）
 *  - データ: data/seiseki.json（トークンがあれば GitHub に自動保存。なければこの端末の下書き）
 *  - 日程（試験の初日・成績提出・成績会議）を入れると、22件の作業が逆算で並びます
 *  - 「授業」の今日タブにも、期限が近い作業が出ます */
(function (root) {
  "use strict";
  const J = root.JD, S = root.JDStore, A = root.A, LS = S.LS, esc = J.esc;
  const $ = id => document.getElementById(id);
  const PH = ["試験準備", "試験実施・採点", "成績算出", "報告・会議"];
  /* [工程, 作業名, 基準日(E=試験の初日 G=成績提出 M=成績会議), 何日ずらすか, 科目ごとに作る] */
  const TP = [
    [0, "試験範囲を確定・配付", "E", -35, 0], [0, "問題作成", "E", -28, 1], [0, "問題チェックシートを提出", "E", -21, 0], [0, "問題漢字を検索", "E", -21, 1],
    [0, "採点基準を作成", "E", -14, 1], [0, "印刷枚数を確認（在籍＋留学＋予備）", "E", -12, 0], [0, "問題冊子・解答用紙を印刷", "E", -10, 0],
    [0, "封筒・チェックリストを作成", "E", -7, 0], [0, "採点ナビ用の模範解答を作成", "E", -7, 1], [0, "採点ナビを設定", "E", -5, 0],
    [1, "欠席者の見込み点を入力", "E", 7, 0], [1, "素点を入力", "E", 7, 1], [1, "主体性評価・漢字テストを入力", "E", 9, 1],
    [2, "観点別評価を算出", "G", -7, 1], [2, "評定を確認", "G", -5, 1],
    [3, "成績報告書を作成", "G", -3, 1], [3, "評定分布表を作成", "G", -2, 0], [3, "不振者報告書を作成", "G", -2, 0], [3, "教科連絡票を記入", "G", -2, 0],
    [3, "学年確認表を記入", "G", -1, 0], [3, "教科確認表をチェック", "G", 0, 0], [3, "成績会議", "M", 0, 0]];
  const DEFPR = [["1", 41, 1], ["2", 40, 2], ["3", 40, 1], ["4", 41, 2], ["5", 41, 2], ["6GLE", 41, 5]];
  const Q = { S: null, sha: null, dirty: false, saving: false, timer: null, token: false, conflict: false, ask: false, needCreate: false, draftP: null, canSave: true, st: "読み込み中…", ready: false };
  const ui = { tab: "home", form: null, msg: "", det: {}, LQ: "", LE: false, LA: false, OM: "", ME: false, dq: "", dtag: "", dedit: null };
  const TGN = ["ピンク", "ブルー", "グリーン", "オレンジ", "パープル", "ティール", "レッド", "グレー"];
  const DEFTAGS = () => [{ id: "jyunbi", n: "試験準備", c: 1 }, { id: "seiseki", n: "成績処理", c: 0 }, { id: "hokoku", n: "報告・会議", c: 2 }, { id: "ryu", n: "留学・欠席", c: 3 }];
  const SD = root.SEISEKI_SEED || { LK: [], DM: [] };
  const KN = { d: "ドキュメント", s: "シート", f: "フォルダ", p: "PDF", c: "Classroom", u: "Web" };
  const U0 = { d: "https://docs.google.com/document/d/", s: "https://docs.google.com/spreadsheets/d/", f: "https://drive.google.com/drive/folders/", p: "https://drive.google.com/file/d/", c: "https://classroom.google.com/c/" };
  const kind = u => /\/document\//.test(u) ? "d" : /\/spreadsheets\//.test(u) ? "s" : /\/folders\//.test(u) ? "f" : /drive\.google\.com\/file/.test(u) ? "p" : /classroom\.google/.test(u) ? "c" : "u";
  const hrefOf = (k, i) => /^https?:/.test(i) ? i : (U0[k] || "") + i + (k === "p" ? "/view" : "");
  A.seiseki = {}; A.ui.test = ui;
  let uid = Date.now();
  const today = () => J.ds(new Date());
  const diff = s => Math.round((J.pd(s) - J.pd(today())) / 864e5);
  const md = J.md;
  const fmtJ = s => { const d = J.pd(s); return d.getFullYear() + "年" + (d.getMonth() + 1) + "月" + d.getDate() + "日（" + "日月火水木金土"[d.getDay()] + "）"; };
  const okd = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

  /* ---------- データ ---------- */
  function gen(t, subs) {
    const A0 = { E: t.E, G: t.G, M: t.M }, out = [];
    TP.forEach(([p, title, a, o, ps]) => {
      (ps && subs.length ? subs : [""]).forEach(sub => out.push({ id: "t" + (uid++), term: t.id, ph: p, title, sub, due: J.addDays(A0[a], o), done: false, url: "" }));
    });
    return out;
  }
  function mig(s) {
    s = s && typeof s === "object" ? s : {};
    s.v = 1; s.terms = (Array.isArray(s.terms) ? s.terms : []).filter(t => t && t.id && okd(t.E) && okd(t.G) && okd(t.M)).map(t => Object.assign({}, t, { name: String(t.name || "無題"), subs: Array.isArray(t.subs) ? t.subs.map(String) : [] }));
    s.tasks = (Array.isArray(s.tasks) ? s.tasks : []).filter(t => t && t.id && okd(t.due)).map(t => ({ id: String(t.id), term: t.term, ph: Math.max(0, Math.min(3, +t.ph || 0)), title: String(t.title || ""), sub: String(t.sub || ""), due: t.due, done: !!t.done, url: String(t.url || "") }));
    s.pr = s.pr && typeof s.pr === "object" ? s.pr : {};
    if (!s.terms.some(t => t.id === s.cur)) s.cur = s.terms.length ? s.terms[s.terms.length - 1].id : null;
    if (!Array.isArray(s.links)) s.links = JSON.parse(JSON.stringify(SD.LK));
    s.links = s.links.filter(g => Array.isArray(g) && Array.isArray(g[1])).map(g => [String(g[0] || ""), g[1].filter(x => Array.isArray(x) && x.length >= 3).map(x => x[3] ? [String(x[0]), String(x[1]), String(x[2]), 1] : [String(x[0]), String(x[1]), String(x[2])])]);
    if (!Array.isArray(s.man)) s.man = JSON.parse(JSON.stringify(SD.DM));
    s.man = s.man.filter(m => m && m.id).map(m => ({ id: String(m.id), t: String(m.t || "無題"), m: String(m.m || "") }));
    if (!Array.isArray(s.tags) || !s.tags.length) s.tags = DEFTAGS();
    s.tags = s.tags.filter(t => t && t.id).map(t => ({ id: String(t.id), n: String(t.n || "タグ"), c: Math.max(0, Math.min(7, +t.c || 0)) }));
    s.docs = Array.isArray(s.docs) ? s.docs : [];
    if (!s.docsInit) { /* はじめの1回だけ: 今までのマニュアルと、★を付けたリンクを、手順・メモに移す */
      (Array.isArray(s.man) ? s.man : SD.DM).forEach(m => { if (m && m.id && !s.docs.some(d => d.id === "m_" + m.id)) s.docs.push({ id: "m_" + m.id, t: String(m.t || "無題"), b: String(m.m || ""), u: "", ut: "", ls: [], tip: false, tag: "seiseki", go: "" }); });
      s.links.forEach(g => g[1].forEach(x => { if (x[3]) { s.docs.push({ id: "l_" + (uid++), t: x[0], b: "", u: hrefOf(x[1], x[2]), ut: "", ls: [], tip: true, tag: "", go: "" }); x.length = 3; } }));
      delete s.man; s.docsInit = 1;
    }
    s.docs = s.docs.filter(d => d && d.id).map(d => ({ id: String(d.id), t: String(d.t || "無題"), b: String(d.b || ""), u: String(d.u || ""), ut: String(d.ut || ""), ls: (Array.isArray(d.ls) ? d.ls : []).filter(x => x && typeof x === "object").slice(0, 7).map(x => ({ t: String(x.t || ""), u: String(x.u || "") })), tip: !!d.tip, img: Array.isArray(d.img) ? d.img.map(String) : [], tag: String(d.tag || ""), go: d.go === "link" || d.go === "detail" ? d.go : "" }));
    s.tipOrder = Array.isArray(s.tipOrder) ? s.tipOrder.map(String) : []; s.upd = s.upd || 0;
    return s;
  }
  const fresh = () => mig({});
  const cur = () => Q.S && Q.S.terms.find(t => t.id === Q.S.cur);
  const mine = () => Q.S.tasks.filter(t => t.term === Q.S.cur);
  const byDue = (a, b) => a.due < b.due ? -1 : a.due > b.due ? 1 : 0;

  /* ---------- 読み込み・保存（校務と同じ安全のしくみ: 古い下書きでGitHubを上書きしない） ---------- */
  const ghOn = () => { const s = S.getSettings(); return !!(s.token && s.owner && s.repo); };
  async function load() {
    const s = S.getSettings(); Q.token = ghOn();
    let text = null;
    if (Q.token) {
      try { const r = await S.remoteGet(s, "data/seiseki.json"); text = r.text; Q.sha = r.sha; Q.st = "GitHubと同期中"; }
      catch (e) { if (e.status !== 404) { Q.canSave = false; Q.st = "⚠ " + S.explain(e) + "（GitHubへの保存は止めています）"; } else { Q.needCreate = true; Q.st = "GitHubに seiseki.json がまだありません"; } }
    } else {
      try { const r = await fetch("data/seiseki.json?t=" + Date.now(), { cache: "no-store" }); if (r.ok) text = await r.text(); } catch (e) { text = null; }
      Q.st = "この端末のみ保存（右上の「設定」でGitHubを接続できます）";
    }
    let p = null; try { p = text ? JSON.parse(text) : null; } catch (e) { p = null; }
    let dr = null; try { const raw = LS.get("jd.draft.seiseki"); dr = raw ? JSON.parse(raw) : null; } catch (e) { dr = null; }
    if (dr && dr.dirty && dr.p) {
      if (Q.token && Q.sha && dr.base !== Q.sha) { Q.ask = true; Q.draftP = dr.p; }
      else if (Q.token && Q.needCreate) { p = dr.p; Q.dirty = true; }
      else { p = dr.p; Q.dirty = true; }
    }
    Q.S = mig(p);
    Q.ready = true;
    if (Q.dirty && Q.token && Q.canSave && !Q.ask && !Q.needCreate) flush(); else if (Q.dirty) LS.set("jd.draft.seiseki", JSON.stringify({ p: Q.S, dirty: true, base: Q.sha }));
    A.render && A.render();
  }
  function save() {
    Q.S.upd = Date.now(); Q.dirty = true; LS.set("jd.draft.seiseki", JSON.stringify({ p: Q.S, dirty: true, base: Q.sha }));
    clearTimeout(Q.timer); Q.timer = setTimeout(flush, 900); setStatus();
  }
  async function flush() {
    if (!Q.dirty || !Q.token || !Q.canSave || Q.conflict || Q.ask || Q.needCreate) { setStatus(); return; }
    if (Q.saving) { clearTimeout(Q.timer); Q.timer = setTimeout(flush, 600); return; }
    Q.saving = true; Q.st = "GitHubに保存中…"; setStatus();
    const snap = JSON.stringify(Q.S), body = J.toJSON(Q.S);
    try {
      const r = await S.remotePut(S.getSettings(), "data/seiseki.json", body, Q.sha, "テスト成績を更新");
      Q.sha = r.sha; Q.st = "GitHubに保存済み";
      if (JSON.stringify(Q.S) === snap) { Q.dirty = false; LS.del("jd.draft.seiseki"); } else { clearTimeout(Q.timer); Q.timer = setTimeout(flush, 300); }
    } catch (e) {
      if (e.status === 409 || e.status === 422) Q.conflict = true;
      Q.st = "⚠ " + S.explain(e);
    }
    Q.saving = false; setStatus(); if (Q.conflict && A.ui.mode === "test") A.render();
  }
  const setStatus = () => { if (A.ui.mode === "test" && A.renderStatus) A.renderStatus(); };
  async function reloadRemote() {
    try { const r = await S.remoteGet(S.getSettings(), "data/seiseki.json"); Q.sha = r.sha; Q.S = mig(JSON.parse(r.text)); Q.conflict = false; Q.canSave = true; Q.dirty = false; LS.del("jd.draft.seiseki"); Q.st = "GitHubと同期中"; A.render(); }
    catch (e) { root.alert(S.explain(e)); }
  }
  async function refreshSei() {
    if (document.hidden || !Q.ready || !Q.token || Q.saving || Q.dirty || Q.conflict || Q.ask || Q.needCreate || !Q.canSave) return;
    if (document.querySelector("dialog[open]") || (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) return;
    try { const r = await S.remoteGet(S.getSettings(), "data/seiseki.json"); if (r.sha !== Q.sha && !Q.dirty && !Q.saving) { Q.sha = r.sha; Q.S = mig(JSON.parse(r.text)); A.render(); } } catch (e) { /* 次の機会に */ }
  }
  document.addEventListener("visibilitychange", refreshSei);
  window.addEventListener("focus", refreshSei);
  setInterval(refreshSei, 120000);
  function askH() {
    if (Q.needCreate) return '<div class="banner"><div>GitHubに data/seiseki.json がまだありません。はじめて使うときは、下のボタンで作ってください（日程を入れると、自動で作られます）。前に作ったことがあるのにこの表示が出るときは、押さずに、右上の「設定」のブランチ名などを確かめてください。</div><div class="btns"><button class="btn" data-sact="create">新しく作る</button></div></div>';
    if (Q.ask) return '<div class="banner err"><div>この端末に、GitHubにまだ保存していない変更があります。GitHubは別の端末で更新されているかもしれません。どちらを使いますか？</div><div class="btns"><button class="btn" data-sact="draft-drop">GitHubの最新を使う（この端末の変更は破棄）</button><button class="btn" data-sact="draft-use">この端末の変更で上書き保存</button></div></div>';
    if (Q.conflict) return '<div class="banner err"><div>別の端末で先に更新されています。</div><div class="btns"><button class="btn" data-sact="reload">最新を読み込み直す</button></div></div>';
    return "";
  }

  /* ---------- 計算 ---------- */
  const open = () => mine().filter(t => !t.done).sort(byDue);
  const nearList = () => (Q.ready && Q.S ? Q.S.tasks.filter(t => !t.done && Q.S.terms.some(x => x.id === t.term) && diff(t.due) <= 7).sort(byDue) : []);
  A.seiseki.dueCount = () => (Q.ready && Q.S ? Q.S.tasks.filter(t => !t.done && Q.S.terms.some(x => x.id === t.term) && diff(t.due) <= 2).length : 0);
  A.seiseki.statusText = () => Q.st;
  A.seiseki.sub = () => { const t = Q.ready && cur(); return "テスト成績" + (t ? " ・ " + t.name : ""); };
  function dueLbl(t) {
    if (t.done) return ["完了", ""];
    const d = diff(t.due);
    if (d < 0) return [md(t.due) + "・" + -d + "日超過", "late"];
    if (d === 0) return ["今日", "late today"];
    if (d <= 3) return [md(t.due) + "・あと" + d + "日", "late soon"];
    return [md(t.due) + "・あと" + d + "日", "mu"];
  }
  const tag = t => { const [l, c] = dueLbl(t); return '<span class="' + c + '">' + l + "</span>"; };
  function row(t) {
    return '<div class="wit' + (t.done ? " dn" : "") + '"><input type="checkbox" aria-label="完了" data-schg="tg" data-id="' + t.id + '"' + (t.done ? " checked" : "") + '><div class="wbody" style="cursor:default"><b>' + esc(t.title) + "</b>" + (t.sub ? ' <span class="wc">' + esc(t.sub) + "</span>" : "") + " " + tag(t) + (t.url ? ' <a class="ml" href="' + esc(t.url) + '" target="_blank" rel="noopener noreferrer">資料を開く ↗</a>' : "") + "</div></div>";
  }
  const panel = (cls, title, count, body) => '<section class="panel ' + cls + '"><header class="panel-h"><h2>' + title + "</h2>" + (count ? '<span class="panel-n">' + count + "</span>" : "") + '</header><div class="panel-b">' + body + "</div></section>";
  const empty = m => '<p class="note" style="margin:0">' + m + "</p>";

  /* ---------- 画面 ---------- */
  function termForm() {
    const e = ui.form === "edit", t = e ? cur() : { name: "", E: J.addDays(today(), 35), G: J.addDays(today(), 52), M: J.addDays(today(), 56), subs: ["現代の国語", "言語文化"] };
    return '<div class="wcard"><b>' + (e ? "学期の日程を変更" : "新しい学期を作る") + '</b><label>学期名</label><input type="text" id="sf_n" value="' + esc(t.name) + '" placeholder="例：2026年度 2学期 期末">' +
      '<div class="tsg2"><div><label>試験の初日</label><input type="date" id="sf_e" value="' + t.E + '"></div><div><label>成績の提出期限</label><input type="date" id="sf_g" value="' + t.G + '"></div><div><label>成績会議の日</label><input type="date" id="sf_m" value="' + t.M + '"></div></div>' +
      '<label>科目（読点「、」で区切る）</label><input type="text" id="sf_s" value="' + esc(t.subs.join("、")) + '"' + (e ? " disabled" : "") + ">" +
      '<p class="note">' + (e ? "まだ終わっていない作業の期限を、新しい日程に合わせて引き直します。" : "日程から逆算して、試験準備から成績会議までの作業が自動で並びます。") + '</p><div class="btns"><button class="btn on" data-sact="t-ok">' + (e ? "日程を反映" : "作成する") + '</button> <button class="btn" data-sact="t-cancel">やめる</button></div></div>';
  }
  function viewHome() {
    let h = askH();
    const T = cur();
    if (!T) {
      return h + '<div class="pghd"><div><h2 class="pgt">TEST</h2><p class="pgs">試験の準備から、成績会議まで。</p></div></div>' + (A.tipsBand ? A.tipsBand("test") : "") + (ui.form === "new" ? termForm() : panel("p-ts", "はじめに", "", '<p style="margin-top:0">試験の初日・成績の提出期限・成績会議の日を入れると、作業が自動で並びます。</p><div class="btns"><button class="btn on" data-sact="t-new">＋ 学期を作る</button></div><p class="note">今の「テスト・成績 総合ボード」の内容を引き継ぐときは、「学期の設定」から読み込めます。</p>'));
    }
    const all = mine(), op = open(), over = op.filter(t => diff(t.due) < 0), w1 = op.filter(t => diff(t.due) >= 0 && diff(t.due) <= 7), m1 = op.filter(t => diff(t.due) > 7 && diff(t.due) <= 30);
    const pct = all.length ? Math.round(100 * (all.length - op.length) / all.length) : 0;
    const dd = (lbl, d) => { const n = diff(d); return '<div class="tsd"><span>' + lbl + '</span><b class="num">' + md(d) + '</b><small>' + (n > 0 ? "あと" + n + "日" : n === 0 ? "今日" : "終了") + "</small></div>"; };
    h += '<div class="pghd"><div><h2 class="pgt">TEST</h2><p class="pgs">' + esc(T.name) + "</p></div>" + '<div class="pgd num">' + md(today()) + " <small>" + "日月火水木金土"[new Date().getDay()] + "曜日</small></div></div>";
    h += (A.tipsBand ? A.tipsBand("test") : "");
    if (Q.S.terms.length > 1) h += '<select id="ts_sel" data-schg="sel" style="width:auto;margin:0 0 12px">' + Q.S.terms.map(t => '<option value="' + t.id + '"' + (t.id === Q.S.cur ? " selected" : "") + ">" + esc(t.name) + "</option>").join("") + "</select>";
    h += '<div class="tsdates">' + dd("試験の初日", T.E) + dd("成績の提出", T.G) + dd("成績会議", T.M) + "</div>";
    h += '<div class="tskpi"><div class="k"><b>' + pct + '%</b><span>進み（' + (all.length - op.length) + "/" + all.length + '件）</span></div><div class="k' + (over.length ? " bad" : "") + '"><b>' + over.length + '</b><span>期限超過</span></div><div class="k' + (w1.length ? " warn" : "") + '"><b>' + w1.length + '</b><span>7日以内</span></div><div class="k"><b>' + m1.length + "</b><span>8〜30日先</span></div></div>";
    h += A.todoBand ? A.todoBand("test") : "";
    const s0 = J.addDays(today(), -new Date().getDay());
    let cells = "";
    for (let i = 0; i < 35; i++) {
      const d = J.addDays(s0, i), n = op.filter(t => t.due === d).length, x = J.pd(d).getDay(), df = diff(d);
      cells += '<div class="tsc' + (d === today() ? " t" : "") + (df >= 0 && df <= 7 ? " w" : "") + (n && df < 0 ? " o" : "") + (x % 6 === 0 ? " we" : "") + '"><span>' + md(d) + '</span><b class="num">' + (n || "") + "</b></div>";
    }
    h += panel("p-ts", "この5週間（未完了の件数）", "", '<div class="tswk">' + "日月火水木金土".split("").map(c => "<span>" + c + "</span>").join("") + '</div><div class="tscal">' + cells + "</div>");
    h += panel("p-ts", "工程ごとの進み", "", PH.map((n, i) => {
      const a = all.filter(t => t.ph === i), d = a.filter(t => t.done).length, nx = a.filter(t => !t.done).sort(byDue)[0];
      return '<div class="tsph"><b>' + n + '</b><span class="note">' + d + "/" + a.length + (nx ? "　次：" + esc(nx.title) + "（" + md(nx.due) + "）" : "　完了") + '</span><div class="bar"><i style="width:' + (a.length ? 100 * d / a.length : 0) + '%"></i></div></div>';
    }).join(""));
    return h;
  }
  function viewTasks() {
    const T = cur(); let h = askH();
    if (!T) return h + panel("p-ts", "作業一覧", "", empty("先に、ホームか「学期の設定」で学期を作ってください。"));
    const all = mine();
    h += '<p class="note" style="margin-top:0">期限の変更や、資料のURLの登録ができます。URLを入れると、ホームの作業から「資料を開く」で飛べます。</p>';
    h += PH.map((n, i) => '<details class="wdet" data-ph="' + i + '"' + ((ui.det[i] !== undefined ? ui.det[i] : i === 0) ? " open" : "") + "><summary><b>" + n + '</b> <span class="note">' + all.filter(t => t.ph === i && t.done).length + "/" + all.filter(t => t.ph === i).length + '</span></summary><div class="tsl">' + all.filter(t => t.ph === i).sort(byDue).map(t =>
      '<div class="tser"><input type="checkbox" aria-label="完了" data-schg="tg" data-id="' + t.id + '"' + (t.done ? " checked" : "") + '><span class="tstt' + (t.done ? " dn" : "") + '">' + esc(t.title) + (t.sub ? ' <span class="wc">' + esc(t.sub) + "</span>" : "") + '</span><input type="date" value="' + t.due + '" data-schg="due" data-id="' + t.id + '"><input type="text" placeholder="資料・シートのURL" value="' + esc(t.url) + '" data-schg="url" data-id="' + t.id + '"><button class="btn sm danger" data-sact="task-del" data-id="' + t.id + '" aria-label="この作業を消す">✕</button></div>').join("") + "</div></details>").join("");
    h += '<details class="wdet" data-ph="add"' + (ui.det.add ? " open" : "") + '><summary><b>＋ 作業を1件足す</b></summary><div class="tsadd"><label>作業名</label><input type="text" id="ta_n"><div class="tsg2"><div><label>期限</label><input type="date" id="ta_d" value="' + today() + '"></div><div><label>工程</label><select id="ta_p">' + PH.map((n, i) => '<option value="' + i + '">' + n + "</option>").join("") + '</select></div></div><button class="btn on" data-sact="task-add">足す</button></div></details>';
    return h;
  }
  const prd = () => {
    const id = Q.S.cur; if (!Q.S.pr[id]) {
      let src = null; for (const t of Q.S.terms.slice().reverse()) if (t.id !== id && Q.S.pr[t.id]) { src = Q.S.pr[t.id]; break; }
      Q.S.pr[id] = { cl: src ? src.cl.map(c => Object.assign({}, c, { id: "c" + (uid++) })) : DEFPR.map(([n, en, ry]) => ({ id: "c-" + n, n, en, ry, sp: 3 })), ck: {} };
    }
    return Q.S.pr[id];
  };
  const cnt = c => Math.max(0, (+c.en || 0) - (+c.ry || 0) + (+c.sp || 0));
  function viewPrint() {
    const T = cur(); let h = askH();
    if (!T) return h + panel("p-ts", "印刷枚数", "", empty("先に、ホームか「学期の設定」で学期を作ってください。"));
    const P = prd(), subs = T.subs.length ? T.subs : ["テスト"], tot = P.cl.reduce((a, c) => a + cnt(c), 0);
    const num = (i, f, v) => '<input type="number" min="0" inputmode="numeric" value="' + v + '" data-schg="pc" data-k="' + i + "." + f + '" aria-label="' + f + '">';
    h += '<p class="note" style="margin-top:0">印刷枚数 ＝ 在籍 − 留学（長期・ターム）＋ 予備（初期値は3枚）。人数は学期ごとに直せます。前の学期の人数が、そのまま引き継がれます。</p>';
    h += panel("p-ts", "クラスごとの人数", "合計 " + tot + "枚", '<div class="tspr h"><span>クラス</span><span>在籍</span><span>留学</span><span>予備</span><span>枚数</span><span></span></div>' + P.cl.map((c, i) => '<div class="tspr"><input type="text" value="' + esc(c.n) + '" data-schg="pc" data-k="' + i + '.n" aria-label="クラス名">' + num(i, "en", c.en) + num(i, "ry", c.ry) + num(i, "sp", c.sp) + '<b class="pc">' + cnt(c) + '</b><button class="btn sm danger" data-sact="pr-del" data-i="' + i + '" aria-label="クラスを消す">✕</button></div>').join("") + '<div style="margin-top:8px"><button class="btn sm" data-sact="pr-add">＋ クラスを足す</button></div>');
    subs.forEach(s => {
      const k = (c, x) => s + "|" + c.id + "|" + x, done = P.cl.reduce((a, c) => a + (P.ck[k(c, 0)] ? 1 : 0) + (P.ck[k(c, 1)] ? 1 : 0), 0);
      h += panel("p-ts", esc(s) + "　合計 " + tot + "枚", "印刷済み " + done + "/" + P.cl.length * 2, '<div class="tspr ps h"><span>クラス</span><span>枚数</span><span>問題冊子</span><span>解答用紙</span></div>' + P.cl.map(c => '<div class="tspr ps"><span>' + esc(c.n) + '</span><b class="pc">' + cnt(c) + "</b>" + [0, 1].map(x => '<label class="tsck"><input type="checkbox" data-schg="pk" data-k="' + esc(k(c, x)) + '"' + (P.ck[k(c, x)] ? " checked" : "") + ">済</label>").join("") + "</div>").join(""));
    });
    return h;
  }
  const KNN = k => KN[k] || "Web";
  const star = (gi, ii, on) => "";
  const starOld = (gi, ii, on) => '<button class="tsstar' + (on ? " on" : "") + '" data-sact="lstar" data-g="' + gi + '" data-i="' + ii + '" aria-pressed="' + !!on + '" title="' + (on ? "重要から外す" : "重要にする（テストのホームに出ます）") + '">' + (on ? "★" : "☆") + "</button>";
  function linksHtml() {
    const q = ui.LQ.trim().toLowerCase();
    return Q.S.links.map(([n, a], gi) => {
      if (ui.LE) return '<div class="wcard"><div class="tsge"><input type="text" value="' + esc(n) + '" data-schg="gn" data-k="' + gi + '" aria-label="グループ名"><button class="btn sm danger" data-sact="gdel" data-g="' + gi + '">グループを削除</button></div>' + (a.map((x, ii) => '<div class="tsle"><input type="text" value="' + esc(x[0]) + '" data-schg="lt" data-k="' + gi + "." + ii + '" aria-label="表示名"><input type="text" value="' + esc(hrefOf(x[1], x[2])) + '" data-schg="lu" data-k="' + gi + "." + ii + '" aria-label="URL"><span class="tsbtns">' + star(gi, ii, x[3]) + '<button class="btn sm danger" data-sact="ldel" data-g="' + gi + '" data-i="' + ii + '" aria-label="削除">✕</button></span></div>').join("") || empty("リンクがありません")) + "</div>";
      const f = a.map((x, ii) => [x, ii]).filter(([x]) => !q || x[0].toLowerCase().includes(q));
      return f.length ? '<h3 class="tsgh">' + esc(n) + '</h3><div class="tslg">' + f.map(([x, ii]) => '<div class="tslw"><a class="tslc" href="' + esc(hrefOf(x[1], x[2])) + '" target="_blank" rel="noopener noreferrer"><span>' + esc(x[0]) + "</span><small>" + KNN(x[1]) + "</small></a>" + star(gi, ii, x[3]) + "</div>").join("") + "</div>" : "";
    }).join("") || empty("該当するリンクがありません。");
  }
  /* ---------- 手順・メモ（校務の「手順・メモ」と同じ形）と、ホームの重要Tips ---------- */
  const tagOf = id => Q.S.tags.find(t => t.id === id);
  const tgc = d => { const t = tagOf(d.tag); return " tgx tg-" + (t ? t.c : "n"); };
  const dl = d => { const o = []; if (d.u) o.push({ t: d.ut || "リンク1", u: d.u }); d.ls.forEach((x, k) => { if (x.u) o.push({ t: x.t || "リンク" + (k + 2), u: x.u }); }); return o; };
  const goLink = d => { const n = dl(d).length; if (!n) return false; if (d.go === "link") return true; if (d.go === "detail") return false; return n === 1 && !d.b.trim(); };
  const lnkH = d => dl(d).map(x => '<a class="btn wlnk" href="' + esc(x.u) + '" target="_blank" rel="noopener noreferrer">' + esc(x.t) + " ↗</a>").join("");
  function tipList() {
    const ord = d => { const i = Q.S.tags.findIndex(x => x.id === d.tag); return i < 0 ? 99 : i; };
    const to = Q.S.tipOrder || [], pos = d => { const i = to.indexOf(d.id); return i < 0 ? 1e6 : i; };
    return Q.S.docs.map((d, k) => [d, k]).filter(x => x[0].tip).sort((a, b) => (to.length ? pos(a[0]) - pos(b[0]) : 0) || ord(a[0]) - ord(b[0]) || a[1] - b[1]).map(x => x[0]);
  }
  function impPanel() {
    const l = tipList(), used = Q.S.tags.filter(t => l.some(d => d.tag === t.id));
    const btn = d => goLink(d)
      ? '<a class="wtp' + tgc(d) + '" href="' + esc(dl(d)[0].u) + '" target="_blank" rel="noopener noreferrer" title="押すと資料がすぐ開きます">' + esc(d.t) + ' <span class="wgo">↗</span></a>'
      : '<button class="wtp' + tgc(d) + '" data-sact="tip" data-id="' + d.id + '">' + esc(d.t) + (dl(d).length > 1 ? ' <span class="wgo">▾' + dl(d).length + "</span>" : "") + "</button>";
    return '<section class="panel p-ts p-imp"><header class="panel-h"><h2>重要Tips</h2><span class="panel-n"><button class="btn sm" data-sact="go-man">手順・メモを開く</button></span></header><div class="panel-b">' +
      (used.length ? '<div class="wleg">' + used.map(t => '<span class="tgchip tgx tg-' + t.c + '">' + esc(t.n) + "</span>").join("") + "</div>" : "") +
      (l.length ? l.map(btn).join("") : '<p class="note" style="margin:0">よく使う手順やリンクは、「手順・メモ」で ☆ を押すと、ここに並びます。</p>') + "</div></section>";
  }
  function viewLinks() {
    let h = askH();
    h += '<div class="tsbar"><input type="search" id="ts_lq" placeholder="リンクを検索（例：採点、報告書）" value="' + esc(ui.LQ) + '" autocomplete="off"><button class="btn' + (ui.LA ? " on" : "") + '" data-sact="ladd-open" style="white-space:nowrap">＋ リンクを足す</button><button class="btn' + (ui.LE ? " on" : "") + '" data-sact="ledit" style="white-space:nowrap">' + (ui.LE ? "編集を終える" : "編集") + "</button></div>";
    if (ui.LA) h += '<div class="wcard"><b>リンクを足す</b><label>表示名（例：試験範囲 2学期期末）</label><input type="text" id="nt"><label>URL</label><input type="text" id="nu" placeholder="https://..."><label>グループ</label><select id="ng">' + Q.S.links.map(([n], i) => '<option value="' + i + '">' + esc(n) + "</option>").join("") + '<option value="new">＋新しいグループ</option></select><label>新しいグループ名（上で「新しいグループ」を選んだとき）</label><input type="text" id="nn"><div class="btns"><button class="btn on" data-sact="ladd">足す</button><button class="btn" data-sact="ladd-open">閉じる</button></div></div>';
    h += '<div id="ts_ll">' + linksHtml() + "</div>";
    return h;
  }
  const inl = x => A.rt.fmt(esc(x).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'));
  function md2h(x) {
    const L = x.split("\n"); let o = "", i = 0;
    while (i < L.length) {
      const l = L[i];
      if (/^#\s/.test(l)) { o += "<h3>" + inl(l.slice(2)) + "</h3>"; i++; }
      else if (/^-\s/.test(l)) { o += "<ul>"; while (i < L.length && /^-\s/.test(L[i])) o += "<li>" + inl(L[i++].slice(2)) + "</li>"; o += "</ul>"; }
      else if (/^\d+\.\s/.test(l)) { o += "<ol>"; while (i < L.length && /^\d+\.\s/.test(L[i])) o += "<li>" + inl(L[i++].replace(/^\d+\.\s/, "")) + "</li>"; o += "</ol>"; }
      else if (/^\|/.test(l)) { o += "<table>"; while (i < L.length && /^\|/.test(L[i])) o += "<tr>" + L[i++].replace(/^\||\|$/g, "").split("|").map(c => "<td>" + inl(c.trim()) + "</td>").join("") + "</tr>"; o += "</table>"; }
      else if (/^>\s/.test(l)) { o += '<p class="note">' + inl(l.slice(2)) + "</p>"; i++; }
      else if (l.trim() === "") i++;
      else { o += "<p>" + inl(l) + "</p>"; i++; }
    }
    return o || '<p class="note">（本文がありません）</p>';
  }
  A.seiseki.todo = function () {
    const o = { late: [], now: [], soon: [] }; if (!Q.ready || !Q.S || !cur()) return o;
    const op = open(); op.filter(t => diff(t.due) < 0).forEach(t => o.late.push({ html: row(t) }));
    mine().sort(byDue).filter(t => diff(t.due) >= 0 && diff(t.due) <= 7 || (t.done && diff(t.due) < 0 && diff(t.due) >= -3)).forEach(t => o.now.push({ html: row(t) }));
    op.filter(t => diff(t.due) > 7 && diff(t.due) <= 30).forEach(t => o.soon.push({ html: row(t) }));
    return o;
  };
  A.seiseki.md2h = md2h;
  A.seiseki.setTipOrder = ids => { Q.S.tipOrder = ids; save(); };
  A.seiseki.ready = () => !!(Q.ready && Q.S && !Q.ask && !Q.conflict && Q.canSave && !Q.needCreate);
  A.seiseki.getDoc = id => (Q.S && Q.S.docs.find(d => d.id === id)) || null;
  A.seiseki.addDocs = function (docs) {
    if (!A.seiseki.ready()) return false;
    if (!Q.S.tags.some(t => t.id === "seiseki")) Q.S.tags.push({ id: "seiseki", n: "成績処理", c: 0 });
    docs.forEach(d => { if (!Q.S.docs.some(x => x.id === d.id)) Q.S.docs.push({ id: String(d.id), t: String(d.t || "無題"), b: String(d.b || ""), u: String(d.u || ""), ut: String(d.ut || ""), ls: (d.ls || []).slice(0, 7).map(x => ({ t: String(x.t || ""), u: String(x.u || "") })), tip: !!d.tip, img: (d.img || []).map(String), tag: "seiseki", go: d.go === "link" || d.go === "detail" ? d.go : "" }); });
    save(); A.render(); return true;
  };
  A.seiseki.tips = function () {
    if (!Q.ready || !Q.S) return [];
    return tipList().map(d => { const t = tagOf(d.tag); return { src: "test", id: d.id, t: d.t, cls: "t-stest", tag: t ? t.n : "", href: goLink(d) ? dl(d)[0].u : "", n: dl(d).length, sortable: true,
      detail: () => '<div class="tsmv-in" style="margin-top:8px">' + (d.b.trim() ? md2h(d.b) : "") + "</div>" + (A.work && A.work.imgsH ? A.work.imgsH(d) : "") + (dl(d).length ? '<div class="wlnks">' + lnkH(d) + "</div>" : "") }; });
  };
  A.seiseki.alldocs = function () {
    if (!Q.ready || !Q.S) return [];
    return Q.S.docs.map(d => { const t = tagOf(d.tag); return { src: "test", id: d.id, t: d.t, tag: t ? t.n : "", star: !!d.tip,
      detail: () => '<div class="tsmv-in">' + (d.b.trim() ? md2h(d.b) : "") + "</div>" + (A.work && A.work.imgsH ? A.work.imgsH(d) : "") + (dl(d).length ? '<div class="wlnks">' + lnkH(d) + "</div>" : "") }; });
  };
  A.seiseki.openDoc = id => { ui.det["d" + id] = true; ui.tab = "man"; };
  const docMatch = d => { const q = ui.dq.trim().toLowerCase(); return (!ui.dtag || d.tag === ui.dtag) && (!q || (d.t + " " + d.b).toLowerCase().includes(q)); };
  function docCard(d, i) {
    const t = tagOf(d.tag), ed = ui.dedit === d.id, k = "d" + d.id;
    const sum = '<summary><span class="wdt">' + esc(d.t || "（無題）") + "</span>" + (t ? '<span class="tgchip tgx tg-' + t.c + '">' + esc(t.n) + "</span>" : "") + (d.tip ? '<span class="tsstar on tsmini">★</span>' : "") + "</summary>";
    let b;
    if (!ed) b = '<div class="tsmv">' + md2h(d.b) + "</div>" + (A.work && A.work.imgsH ? A.work.imgsH(d) : "") + (dl(d).length ? '<div class="wlnks">' + lnkH(d) + "</div>" : "") + '<div class="btns" style="margin-top:8px"><button class="btn" data-sact="doc-edit" data-id="' + d.id + '">編集する</button><button class="btn" data-sact="doc-star" data-i="' + i + '">' + (d.tip ? "★ 重要から外す" : "☆ 重要にする（ホームに出す）") + "</button></div>";
    else {
      const row = (tt, u, fn, fu, j, ph) => '<div class="wlrow"><input type="text" value="' + esc(tt) + '" placeholder="' + ph + '" data-sf="' + fn + '" data-i="' + i + '" data-j="' + j + '" aria-label="リンクの名前"><input type="url" value="' + esc(u) + '" placeholder="https://…" data-sf="' + fu + '" data-i="' + i + '" data-j="' + j + '" autocomplete="off" aria-label="リンクのURL">' + '<span class="wlbtn"><button type="button" class="btn sm" data-sact="doc-lmv" data-i="' + i + '" data-j="' + j + '" data-d="-1" aria-label="ひとつ上へ"' + (j < 0 ? " disabled" : "") + '>↑</button><button type="button" class="btn sm" data-sact="doc-lmv" data-i="' + i + '" data-j="' + j + '" data-d="1" aria-label="ひとつ下へ"' + (j + 1 >= d.ls.length ? " disabled" : "") + '>↓</button>' + (j >= 0 ? '<button class="btn sm" data-sact="doc-ldel" data-i="' + i + '" data-j="' + j + '">消す</button>' : "<span></span>") + "</span></div>";
      b = '<div class="wcard" style="border:0;padding:4px 0 8px"><label>見出し</label><input type="text" value="' + esc(d.t) + '" data-sf="doc-t" data-i="' + i + '">' +
        '<label class="tsimp">タグ： <select data-schg="doc-tag" data-i="' + i + '" style="width:auto"><option value="">なし</option>' + Q.S.tags.map(x => '<option value="' + x.id + '"' + (d.tag === x.id ? " selected" : "") + ">" + esc(x.n) + "</option>").join("") + "</select></label>" +
        '<label class="tsimp"><input type="checkbox" data-schg="doc-tip" data-i="' + i + '"' + (d.tip ? " checked" : "") + "> 重要（ホームの重要Tipsに出す）</label>" +
        '<label class="tsimp">重要Tipsのボタンを押したら： <select data-schg="doc-go" data-i="' + i + '" style="width:auto"><option value="">自動（説明が空なら資料をすぐ開く／説明があれば説明を出す）</option><option value="link"' + (d.go === "link" ? " selected" : "") + '>いつも資料をすぐ開く</option><option value="detail"' + (d.go === "detail" ? " selected" : "") + ">いつも説明を出す</option></select></label>" +
        '<div class="wlset"><b class="small">資料リンク（最大8つ。名前は、押すボタンに出ます）</b>' + row(d.ut, d.u, "doc-ut", "doc-u", -1, "リンク1の名前") + d.ls.map((x, j) => row(x.t, x.u, "doc-lt", "doc-lu", j, "リンク" + (j + 2) + "の名前")).join("") + (1 + d.ls.length < 8 ? '<button class="btn sm" data-sact="doc-ladd" data-i="' + i + '">＋ リンクを足す</button>' : "") + "</div>" +
        '<label>本文（「# 」見出し・「- 」箇条書き・「1. 」番号・「|表|」・上のボタンで 太字・赤字・青字・下線、[名前](URL) が使えます）</label>' + A.rt.bar() + '<textarea rows="24" data-sf="doc-b" data-i="' + i + '">' + esc(d.b) + "</textarea>" +
        '<div class="btns"><button class="btn on" data-sact="doc-done">編集を終える</button><button class="btn danger" data-sact="doc-del" data-i="' + i + '">このメモを削除</button></div></div>';
    }
    return '<details class="wdet wdoc" data-ph="' + k + '"' + (ui.det[k] || ed ? " open" : "") + ">" + sum + b + "</details>";
  }
  const docListHtml = () => { const l = Q.S.docs.map((d, i) => [d, i]).filter(x => docMatch(x[0])); return l.length ? A.rt.grp(Q.S.tags, l, docCard, t => '<span class="tgchip tgx tg-' + (t ? t.c : "n") + '">' + esc(t ? t.n : "タグなし") + "</span>") : empty("該当するメモがありません。"); };
  function viewMan() {
    let h = askH();
    h += A.memoHead("test");
    h += '<div class="tsbar"><input type="search" id="ts_dq" placeholder="手順・メモをさがす" value="' + esc(ui.dq) + '" autocomplete="off"><button class="btn on" data-sact="doc-add" style="white-space:nowrap">＋ 新しいメモ</button></div>';
    h += '<div class="tsseg"><button class="btn' + (ui.dtag ? "" : " on") + '" data-sact="dtag" data-v="">すべて</button>' + Q.S.tags.map(t => '<button class="btn' + (ui.dtag === t.id ? " on" : "") + '" data-sact="dtag" data-v="' + t.id + '">' + esc(t.n) + "</button>").join("") + "</div>";
    h += '<div id="ts_dl">' + docListHtml() + "</div>" + A.memoOthers("test");
    h += '<details class="wdet" data-ph="tagmgr"' + (ui.det.tagmgr ? " open" : "") + "><summary><b>タグを管理する（順番・名前・色を変える／増やす）</b></summary><div class=\"tsadd\"><p class=\"note\" style=\"margin:6px 0\">▲▼でタグの順番を変えると、メモの一覧もその順に並びます。</p>" +
      Q.S.tags.map((t, i) => '<div class="tstg"><span class="tgchip tgx tg-' + t.c + '">' + esc(t.n) + '</span><input type="text" value="' + esc(t.n) + '" data-sf="tag-n" data-i="' + i + '" aria-label="タグの名前"><select data-schg="tag-c" data-i="' + i + '" aria-label="色">' + TGN.map((n, c) => '<option value="' + c + '"' + (t.c === c ? " selected" : "") + ">" + n + "</option>").join("") + '</select>' + A.rt.mvBtns(i, Q.S.tags.length, 'data-sact="tag-mv"') + '<button class="btn sm danger" data-sact="tag-del" data-i="' + i + '">消す</button></div>').join("") +
      '<div class="tstg"><input type="text" id="tg_new" placeholder="新しいタグの名前"><select id="tg_col">' + TGN.map((n, c) => '<option value="' + c + '">' + n + "</option>").join("") + '</select><button class="btn on" data-sact="tag-add">タグを足す</button></div></div></details>';
    return h;
  }
  function viewSet() {
    let h = askH();
    h += panel("p-ts", "学期", "", (Q.S.terms.map(t => '<div class="tstr"><span><b>' + esc(t.name) + "</b>" + (t.id === Q.S.cur ? ' <span class="note">（表示中）</span>' : "") + '<br><span class="note">試験 ' + md(t.E) + "／成績提出 " + md(t.G) + "／成績会議 " + md(t.M) + '</span></span><span class="btns"><button class="btn sm" data-sact="t-sel" data-id="' + t.id + '">表示</button><button class="btn sm" data-sact="t-edit" data-id="' + t.id + '">日程変更</button><button class="btn sm danger" data-sact="t-del" data-id="' + t.id + '">削除</button></span></div>').join("") || empty("学期がありません。")) + '<div style="margin-top:10px"><button class="btn on" data-sact="t-new">＋ 新しい学期</button></div>' + (ui.form ? termForm() : ""));
    h += panel("p-ts", "今の「テスト・成績 総合ボード」から引き継ぐ", "", '<p class="note" style="margin-top:0">今のボードの「設定」タブ → 「データを表示」で出る文章を、すべてコピーして、下に貼ってください。学期・作業の進み・印刷枚数が入ります。</p><textarea id="ts_imp" rows="4" placeholder="ここに貼り付け"></textarea><div class="btns" style="margin-top:6px"><button class="btn" data-sact="import">貼った内容で読み込む</button></div>' + (ui.msg ? '<p class="note">' + esc(ui.msg) + "</p>" : ""));
    h += panel("p-ts", "バックアップ", "", '<p class="note" style="margin-top:0">テスト成績のデータを、ファイルに書き出せます。</p><button class="btn" data-sact="export">ファイルに書き出す</button>');
    return h;
  }
  A.seiseki.view = function () {
    if (!Q.ready) return '<p class="note">読み込んでいます…</p>';
    return { home: viewHome, tasks: viewTasks, print: viewPrint, links: viewLinks, man: viewMan, set: viewSet }[ui.tab]();
  };

  /* 授業の「今日」タブの下に出す、テスト成績の期限が近い作業（なければ何も出さない） */
  A.seiseki.todayPanel = function () { return ""; }; /* 今は「今日の校務」の枠の中に一緒に出す（todayItems） */
  A.seiseki.todayItems = function () {
    if (!Q.ready) return { n: 0, html: "" };
    const l = nearList(); if (!l.length) return { n: 0, html: "" };
    const more = l.length > 6 ? '<p class="note" style="margin:6px 0 0">ほか ' + (l.length - 6) + "件</p>" : "";
    return { n: l.length, html: '<h3 class="tstd">テスト・成績 <span class="note">' + l.length + "件</span></h3>" + l.slice(0, 6).map(row).join("") + more + '<p style="margin:8px 0 0"><button class="btn sm" data-sact="go">テスト成績を開く</button></p>' };
  };

  /* ---------- 操作 ---------- */
  const V = id => $(id).value;
  document.addEventListener("click", e => {
    const t = e.target.closest("[data-sact]"); if (!t) return;
    const a = t.dataset.sact, id = t.dataset.id, S0 = Q.S;
    switch (a) {
      case "go": A.ui.mode = "test"; LS.set("jd.mode", "test"); ui.tab = "home"; A.render(); root.scrollTo(0, 0); return;
      case "create": Q.needCreate = false; Q.dirty = true; save(); A.render(); return;
      case "reload": reloadRemote(); return;
      case "draft-drop": LS.del("jd.draft.seiseki"); Q.ask = false; Q.draftP = null; Q.dirty = false; Q.st = "GitHubと同期中"; A.render(); return;
      case "draft-use": Q.S = mig(Q.draftP); Q.draftP = null; Q.ask = false; Q.needCreate = false; Q.dirty = true; save(); A.render(); return;
      case "go-man": ui.tab = "man"; A.render(); root.scrollTo(0, 0); return;
      case "cl": { const d = $("wdlg"); if (d && d.open) d.close(); return; }
      case "tip": {
        const d = S0.docs.find(x => x.id === id); if (!d) return;
        $("wbody").innerHTML = '<h2 style="margin:0">' + esc(d.t) + '</h2><div class="tsmv-in" style="margin-top:8px">' + (d.b.trim() ? md2h(d.b) : "") + "</div>" + (A.work && A.work.imgsH ? A.work.imgsH(d) : "") + (dl(d).length ? '<div class="wlnks">' + lnkH(d) + "</div>" : "") + '<div class="dlg-btns"><button class="btn" data-sact="cl">閉じる</button></div>';
        if (!$("wdlg").open) $("wdlg").showModal(); return;
      }
      case "dtag": ui.dtag = t.dataset.v; A.render(); return;
      case "doc-add": { const nid = "d" + (uid++); S0.docs.unshift({ id: nid, t: "新しいメモ", b: "", u: "", ut: "", ls: [], tip: false, tag: ui.dtag || "", go: "" }); ui.det["d" + nid] = true; ui.dedit = nid; save(); A.render(); return; }
      case "doc-edit": ui.dedit = id; ui.det["d" + id] = true; A.render(); return;
      case "doc-done": ui.dedit = null; A.render(); return;
      case "doc-star": { const d = S0.docs[+t.dataset.i]; if (d) { d.tip = !d.tip; save(); A.render(); } return; }
      case "doc-del": if (root.confirm("このメモを削除しますか？")) { S0.docs.splice(+t.dataset.i, 1); ui.dedit = null; save(); A.render(); } return;
      case "doc-ladd": { const d = S0.docs[+t.dataset.i]; if (d && 1 + d.ls.length < 8) { d.ls.push({ t: "", u: "" }); save(); A.render(); } return; }
      case "doc-lmv": { const d = S0.docs[+t.dataset.i]; if (!d) return; const all = [{ t: d.ut, u: d.u }].concat(d.ls), a = +t.dataset.j + 1, b = a + (+t.dataset.d); if (b < 0 || b >= all.length) return; const x = all[a]; all[a] = all[b]; all[b] = x; d.ut = all[0].t; d.u = all[0].u; d.ls = all.slice(1); save(); A.render(); return; }
      case "doc-ldel": { const d = S0.docs[+t.dataset.i]; if (d) { d.ls.splice(+t.dataset.j, 1); save(); A.render(); } return; }
      case "tag-add": { const n = V("tg_new").trim(); if (!n) { root.alert("タグの名前を入れてください。"); return; } S0.tags.push({ id: "g" + (uid++), n, c: +V("tg_col") || 0 }); ui.det.tagmgr = true; save(); A.render(); return; }
      case "tag-mv": if (A.rt.mv(S0.tags, +t.dataset.i, +t.dataset.d)) { ui.det.tagmgr = true; save(); A.render(); } return;
      case "tag-del": { const tg = S0.tags[+t.dataset.i]; if (tg && root.confirm("タグ「" + tg.n + "」を消します。このタグが付いたメモは、タグなしになります。よろしいですか？")) { S0.docs.forEach(d => { if (d.tag === tg.id) d.tag = ""; }); S0.tags.splice(+t.dataset.i, 1); if (ui.dtag === tg.id) ui.dtag = ""; ui.det.tagmgr = true; save(); A.render(); } return; }
      case "ledit": ui.LE = !ui.LE; A.render(); return;
      case "ladd-open": ui.LA = !ui.LA; A.render(); return;
      case "lstar": { const x = S0.links[+t.dataset.g][1][+t.dataset.i]; if (x) { if (x[3]) x.length = 3; else x[3] = 1; save(); A.render(); } return; }
      case "go-links": ui.tab = "links"; A.render(); root.scrollTo(0, 0); return;
      case "ldel": S0.links[+t.dataset.g][1].splice(+t.dataset.i, 1); save(); A.render(); return;
      case "gdel": if (root.confirm("このグループとリンクをすべて削除します。よろしいですか？")) { S0.links.splice(+t.dataset.g, 1); save(); A.render(); } return;
      case "ladd": {
        const n = V("nt").trim(), u = V("nu").trim();
        if (!n || !/^https?:/.test(u)) { root.alert("表示名と、https:// で始まるURLを入れてください。"); return; }
        let g = V("ng"); if (g === "new") { const gn = V("nn").trim(); if (!gn) { root.alert("新しいグループ名を入れてください。"); return; } S0.links.push([gn, []]); g = S0.links.length - 1; }
        const row = [n, kind(u), u]; if ($("nimp") && $("nimp").checked) row.push(1);
        S0.links[+g][1].push(row); save(); A.render(); return;
      }
      case "mn": ui.OM = id; ui.ME = false; A.render(); return;
      case "mnew": { const nid = "m" + (uid++); S0.man.push({ id: nid, t: "新しいマニュアル", m: "" }); ui.OM = nid; ui.ME = true; save(); A.render(); return; }
      case "medit": ui.ME = true; A.render(); return;
      case "mcancel": ui.ME = false; A.render(); return;
      case "msave": { const m = S0.man.find(x => x.id === ui.OM); if (m) { m.t = V("mt").trim() || "無題"; m.m = V("mb"); } ui.ME = false; save(); A.render(); return; }
      case "mdel": if (root.confirm("このマニュアルを削除します。よろしいですか？")) { S0.man = S0.man.filter(x => x.id !== ui.OM); ui.OM = ""; ui.ME = false; save(); A.render(); } return;
      case "t-new": ui.form = "new"; A.render(); return;
      case "t-edit": S0.cur = id; ui.form = "edit"; A.render(); return;
      case "t-cancel": ui.form = null; A.render(); return;
      case "t-sel": S0.cur = id; save(); A.render(); return;
      case "t-del": if (!root.confirm("この学期と、作業をすべて削除します。よろしいですか？")) return; S0.tasks = S0.tasks.filter(x => x.term !== id); S0.terms = S0.terms.filter(x => x.id !== id); delete S0.pr[id]; S0.cur = S0.terms.length ? S0.terms[S0.terms.length - 1].id : null; save(); A.render(); return;
      case "t-ok": {
        const n = V("sf_n").trim(), E = V("sf_e"), G = V("sf_g"), M = V("sf_m");
        if (!n || !E || !G || !M) { root.alert("学期名と、3つの日付を入れてください。"); return; }
        if (ui.form === "edit") {
          const T = cur(); Object.assign(T, { name: n, E, G, M }); const fr = gen(T, T.subs);
          S0.tasks.filter(x => x.term === T.id && !x.done).forEach(x => { const f = fr.find(y => y.ph === x.ph && y.title === x.title && y.sub === x.sub); if (f) x.due = f.due; });
        } else {
          const subs = V("sf_s").split(/[、,，]/).map(s => s.trim()).filter(Boolean), T = { id: "T" + (uid++), name: n, E, G, M, subs };
          S0.terms.push(T); S0.cur = T.id; S0.tasks = S0.tasks.concat(gen(T, subs));
        }
        ui.form = null; save(); A.render(); return;
      }
      case "task-add": { const n = V("ta_n").trim(); if (!n || !V("ta_d")) return; S0.tasks.push({ id: "t" + (uid++), term: S0.cur, ph: +V("ta_p"), title: n, sub: "", due: V("ta_d"), done: false, url: "" }); save(); A.render(); return; }
      case "task-del": if (root.confirm("この作業を消しますか？")) { S0.tasks = S0.tasks.filter(x => x.id !== id); save(); A.render(); } return;
      case "pr-add": prd().cl.push({ id: "c" + (uid++), n: "新クラス", en: 0, ry: 0, sp: 3 }); save(); A.render(); return;
      case "pr-del": if (root.confirm("このクラスを消しますか？")) { prd().cl.splice(+t.dataset.i, 1); save(); A.render(); } return;
      case "import": {
        let o; try { o = JSON.parse(V("ts_imp")); } catch (x) { o = null; }
        if (!o || !Array.isArray(o.terms) || !Array.isArray(o.tasks)) { ui.msg = "読み込めませんでした。今のボードの「データを表示」の全文を、そのまま貼ってください。"; A.render(); return; }
        if (S0.tasks.length && !root.confirm("いまのテスト成績のデータは、読み込んだ内容に置き換わります。よろしいですか？")) return;
        Q.S = mig(o); ui.msg = "読み込みました（学期 " + Q.S.terms.length + "件・作業 " + Q.S.tasks.length + "件）。"; save(); A.render(); return;
      }
      case "export": {
        const url = URL.createObjectURL(new Blob([J.toJSON(Q.S)], { type: "application/json" })), el = document.createElement("a");
        el.href = url; el.download = "seiseki.json"; document.body.appendChild(el); el.click(); el.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); return;
      }
    }
  });
  document.addEventListener("change", e => {
    const t = e.target, f = t.dataset && t.dataset.schg; if (!f) return;
    const S0 = Q.S, id = t.dataset.id, tk = id && S0.tasks.find(x => x.id === id);
    switch (f) {
      case "sel": S0.cur = t.value; save(); break;
      case "tg": if (tk) { tk.done = t.checked; save(); } break;
      case "due": if (tk && t.value) { tk.due = t.value; save(); } break;
      case "url": if (tk) { tk.url = t.value.trim(); save(); } break;
      case "pc": { const [i, k] = t.dataset.k.split("."), c = prd().cl[+i]; if (c) { c[k] = k === "n" ? t.value : Math.max(0, parseInt(t.value) || 0); save(); } break; }
      case "pk": prd().ck[t.dataset.k] = t.checked; save(); break;
      case "doc-tag": { const d = S0.docs[+t.dataset.i]; if (d) { d.tag = t.value; save(); } break; }
      case "doc-go": { const d = S0.docs[+t.dataset.i]; if (d) { d.go = t.value; save(); } return; }
      case "doc-tip": { const d = S0.docs[+t.dataset.i]; if (d) { d.tip = t.checked; save(); } return; }
      case "tag-c": { const tg = S0.tags[+t.dataset.i]; if (tg) { tg.c = +t.value || 0; ui.det.tagmgr = true; save(); } break; }
      case "gn": S0.links[+t.dataset.k][0] = t.value; save(); return;
      case "lt": { const [g, i] = t.dataset.k.split("."); S0.links[+g][1][+i][0] = t.value; save(); return; }
      case "lu": { const [g, i] = t.dataset.k.split("."), u = t.value.trim(), x = S0.links[+g][1][+i]; x[2] = u; x[1] = kind(u); save(); return; }
    }
    if (f === "due" || f === "url") return; /* 日付やURLを続けて直せるよう、画面は作り直さない */
    A.render();
  });
  document.addEventListener("input", e => {
    const t = e.target, f = t.dataset && t.dataset.sf;
    if (t.id === "ts_dq") { ui.dq = t.value; const r = $("ts_dl"); if (r) r.innerHTML = docListHtml(); return; }
    if (!f || !Q.S) return;
    const i = +t.dataset.i;
    if (f === "tag-n") { const tg = Q.S.tags[i]; if (tg) { tg.n = t.value; save(); } return; }
    const d = Q.S.docs[i]; if (!d) return;
    if (f === "doc-t") { d.t = t.value; const sm = t.closest(".wdoc"); if (sm) sm.querySelector(".wdt").textContent = t.value || "（無題）"; }
    else if (f === "doc-b") d.b = t.value; else if (f === "doc-u") d.u = t.value.trim(); else if (f === "doc-ut") d.ut = t.value;
    else if (f === "doc-lt") d.ls[+t.dataset.j].t = t.value; else if (f === "doc-lu") d.ls[+t.dataset.j].u = t.value.trim();
    save();
  });
  document.addEventListener("input", e => { if (e.target.id === "ts_lq") { ui.LQ = e.target.value; const r = $("ts_ll"); if (r) r.innerHTML = linksHtml(); } });
  /* 開いた・閉じたは、自分で押したときだけ変わる（直したあとに勝手に閉じない） */
  document.addEventListener("toggle", e => { const d = e.target; if (d && d.dataset && d.dataset.ph !== undefined && d.classList.contains("wdet")) ui.det[d.dataset.ph] = d.open; }, true);
  A.seiseki.load = load;
  load();
})(window);
