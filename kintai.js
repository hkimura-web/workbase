/* THE WORKBASE: 「勤怠」モード（有給・超過勤務・振替時間休・振替休日・行事予定）
 *  - データ: data/kintai.json（トークンがあれば GitHub に自動保存。なければこの端末の下書き）
 *  - 行事予定は、授業側の行事と1つにまとまります（勤怠の行事予定に入れたものは、授業の今日・計画表にも出ます）
 *  - 授業のコマ数を見ながら、振替日や有給の日を選べます */
(function (root) {
  "use strict";
  const J = root.JD, S = root.JDStore, A = root.A, LS = S.LS, esc = J.esc;
  const $ = id => document.getElementById(id);
  const WD = "日月火水木金土", pad = n => String(n).padStart(2, "0");
  const P = s => s.split("-").map(Number);
  const wd = s => { const [a, b, c] = P(s); return WD[new Date(a, b - 1, c).getDay()]; };
  const fy = s => { const [y, m] = P(s); return y - (m < 4 ? 1 : 0); };
  const fm = s => s ? s.slice(0, 4) + "/" + +s.slice(5, 7) + "/" + +s.slice(8) + "(" + wd(s) + ")" : "";
  const now = () => J.ds(new Date());
  const R = n => +(+n).toFixed(2);
  const okd = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const uid = () => Math.random().toString(36).slice(2, 9);
  const DEF = () => ({ v: 1, set: { base: 20, carry: {}, cap: 20, hpd: 8, halfMax: 20, hourMax: 40, duty: 5 }, yk: [], ot: [], tu: [], fh: [], ev: [], upd: 0 });
  const Q = { S: null, sha: null, dirty: false, saving: false, timer: null, token: false, conflict: false, ask: false, needCreate: false, draftP: null, canSave: true, st: "読み込み中…", ready: false };
  const ui = { tab: "home", Y: Math.max(2026, fy(now())), ed: null, cm: null, pk: null, msg: "" };
  A.kintai = {}; A.ui.kin = ui;
  const CK = ["高校大会", "中学大会", "中高大会", "練習なし", "釜利谷練習", "学校練習", "合宿"];
  const KT = { home: "ダッシュボード", cal: "カレンダー", yk: "有給", ot: "超過勤務", fh: "振替休日", ev: "行事予定", set: "設定" };

  /* ---------- データ ---------- */
  function mig(s) {
    s = s && typeof s === "object" && !Array.isArray(s) ? s : {};
    const d = DEF(); s.v = 1;
    s.set = Object.assign(d.set, s.set && typeof s.set === "object" ? s.set : {}); s.set.carry = s.set.carry && typeof s.set.carry === "object" ? s.set.carry : {};
    const arr = (k, dk) => { s[k] = (Array.isArray(s[k]) ? s[k] : []).filter(r => r && typeof r === "object" && okd(r[dk])).map(r => Object.assign({}, r, { id: String(r.id || uid()) })); };
    arr("yk", "date"); arr("ot", "date"); arr("tu", "date"); arr("ev", "date");
    s.fh = (Array.isArray(s.fh) ? s.fh : []).filter(r => r && typeof r === "object").map(r => Object.assign({}, r, { id: String(r.id || uid()) }));
    s.upd = s.upd || 0;
    return s;
  }
  const fresh = () => mig({});

  /* ---------- 読み込み・保存（他のモードと同じ安全のしくみ） ---------- */
  const ghOn = () => { const s = S.getSettings(); return !!(s.token && s.owner && s.repo); };
  async function load() {
    const s = S.getSettings(); Q.token = ghOn();
    let text = null;
    if (Q.token) {
      try { const r = await S.remoteGet(s, "data/kintai.json"); text = r.text; Q.sha = r.sha; Q.st = "GitHubと同期中"; }
      catch (e) { if (e.status !== 404) { Q.canSave = false; Q.st = "⚠ " + S.explain(e) + "（GitHubへの保存は止めています）"; } else { Q.needCreate = true; Q.st = "GitHubに kintai.json がまだありません"; } }
    } else {
      try { const r = await fetch("data/kintai.json?t=" + Date.now(), { cache: "no-store" }); if (r.ok) text = await r.text(); } catch (e) { text = null; }
      Q.st = "この端末のみ保存（右上の「設定」でGitHubを接続できます）";
    }
    let p = null; try { p = text ? JSON.parse(text) : null; } catch (e) { p = null; }
    let dr = null; try { const raw = LS.get("jd.draft.kintai"); dr = raw ? JSON.parse(raw) : null; } catch (e) { dr = null; }
    if (dr && dr.dirty && dr.p) {
      if (Q.token && Q.sha && dr.base !== Q.sha) { Q.ask = true; Q.draftP = dr.p; }
      else { p = dr.p; Q.dirty = true; }
    }
    Q.S = mig(p);
    Q.ready = true;
    if (Q.dirty && Q.token && Q.canSave && !Q.ask && !Q.needCreate) flush(); else if (Q.dirty) LS.set("jd.draft.kintai", JSON.stringify({ p: Q.S, dirty: true, base: Q.sha }));
    A.render && A.render();
  }
  function save() {
    Q.S.upd = Date.now(); Q.dirty = true; LS.set("jd.draft.kintai", JSON.stringify({ p: Q.S, dirty: true, base: Q.sha }));
    clearTimeout(Q.timer); Q.timer = setTimeout(flush, 900); setStatus();
  }
  async function flush() {
    if (!Q.dirty || !Q.token || !Q.canSave || Q.conflict || Q.ask || Q.needCreate) { setStatus(); return; }
    if (Q.saving) { clearTimeout(Q.timer); Q.timer = setTimeout(flush, 600); return; }
    Q.saving = true; Q.st = "GitHubに保存中…"; setStatus();
    const snap = JSON.stringify(Q.S), body = J.toJSON(Q.S);
    try {
      const r = await S.remotePut(S.getSettings(), "data/kintai.json", body, Q.sha, "勤怠を更新");
      Q.sha = r.sha; Q.st = "GitHubに保存済み";
      if (JSON.stringify(Q.S) === snap) { Q.dirty = false; LS.del("jd.draft.kintai"); } else { clearTimeout(Q.timer); Q.timer = setTimeout(flush, 300); }
    } catch (e) {
      if (e.status === 409 || e.status === 422) Q.conflict = true;
      Q.st = "⚠ " + S.explain(e);
    }
    Q.saving = false; setStatus(); if (Q.conflict && A.ui.mode === "kin") A.render();
  }
  const setStatus = () => { if (A.ui.mode === "kin" && A.renderStatus) A.renderStatus(); };
  async function reloadRemote() {
    try { const r = await S.remoteGet(S.getSettings(), "data/kintai.json"); Q.sha = r.sha; Q.S = mig(JSON.parse(r.text)); Q.conflict = false; Q.canSave = true; Q.dirty = false; LS.del("jd.draft.kintai"); Q.st = "GitHubと同期中"; A.render(); }
    catch (e) { root.alert(S.explain(e)); }
  }
  async function refreshKin() {
    if (document.hidden || !Q.ready || !Q.token || Q.saving || Q.dirty || Q.conflict || Q.ask || Q.needCreate || !Q.canSave) return;
    if (document.querySelector("dialog[open]") || (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) return;
    try { const r = await S.remoteGet(S.getSettings(), "data/kintai.json"); if (r.sha !== Q.sha && !Q.dirty && !Q.saving) { Q.sha = r.sha; Q.S = mig(JSON.parse(r.text)); A.render(); } } catch (e) { /* 次の機会に */ }
  }
  document.addEventListener("visibilitychange", refreshKin);
  window.addEventListener("focus", refreshKin);
  setInterval(refreshKin, 120000);
  function askH() {
    if (Q.needCreate) return '<div class="banner"><div>GitHubに data/kintai.json がまだありません。はじめて使うときは、下のボタンで作ってください。前に作ったことがあるのにこの表示が出るときは、押さずに、右上の「設定」のブランチ名などを確かめてください。</div><div class="btns"><button class="btn" data-kact="create">新しく作る</button></div></div>';
    if (Q.ask) return '<div class="banner err"><div>この端末に、GitHubにまだ保存していない変更があります。GitHubは別の端末で更新されているかもしれません。どちらを使いますか？</div><div class="btns"><button class="btn" data-kact="draft-drop">GitHubの最新を使う（この端末の変更は破棄）</button><button class="btn" data-kact="draft-use">この端末の変更で上書き保存</button></div></div>';
    if (Q.conflict) return '<div class="banner err"><div>別の端末で先に更新されています。</div><div class="btns"><button class="btn" data-kact="reload">最新を読み込み直す</button></div></div>';
    return "";
  }

  /* ---------- 計算（「勤怠管理」アプリと同じ） ---------- */
  const set = () => Q.S.set;
  const days = r => r.kind === "全休" ? 1 : r.kind === "半休" ? .5 : (+r.hours || 0) / set().hpd;
  const ykY = y => Q.S.yk.filter(r => fy(r.date) === y);
  const taken = y => ykY(y).reduce((a, r) => a + days(r), 0);
  const carry = y => set().carry[y] != null && set().carry[y] !== "" ? +set().carry[y] : (y <= 2026 ? 0 : Math.min(set().cap, remain(y - 1)));
  const remain = y => set().base + carry(y) - taken(y);
  const fhSt = r => {
    if (!r.d1 || (r.method === "半日×2" && !r.d2)) return "振替日未定";
    const l = [r.d1, r.d2].filter(Boolean).sort().pop(), ok = r.status === "申請済";
    return l < now() ? (ok ? "取得済" : "要確認") : (ok ? "取得前" : "未申請");
  };
  const fhY = y => Q.S.fh.filter(r => r.work && fy(r.work) === y);
  function otRem() {
    const o = {};
    [...new Set(Q.S.ot.map(r => fy(r.date)))].forEach(y => {
      let u = Q.S.tu.filter(r => fy(r.date) === y).reduce((a, r) => a + (+r.hours || 0), 0);
      Q.S.ot.filter(r => fy(r.date) === y).sort((a, b) => a.date < b.date ? -1 : 1).forEach(r => { const x = Math.min(u, +r.hours || 0); u -= x; o[r.id] = (+r.hours || 0) - x; });
    });
    return o;
  }
  function alloc() {
    const o = {}, cmp = (a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    [...new Set(Q.S.tu.map(r => fy(r.date)))].forEach(y => {
      const q = Q.S.ot.filter(r => fy(r.date) === y).sort(cmp).map(r => ({ r, h: +r.hours || 0 }));
      Q.S.tu.filter(r => fy(r.date) === y).sort(cmp).forEach(u => {
        let n = +u.hours || 0; o[u.id] = [];
        for (const x of q) {
          if (n <= 0) break; if (x.h <= 0) continue;
          const t = Math.min(n, x.h); x.h -= t; n -= t;
          o[u.id].push(+x.r.date.slice(5, 7) + "/" + +x.r.date.slice(8) + " " + (x.r.what || "") + " " + R(t) + "h");
        }
        if (n > 0) o[u.id].push("不足 " + R(n) + "h");
      });
    });
    return o;
  }
  /* 日ごとの勤怠の印: [表示名, 短い表示, 色] */
  function marks() {
    const m = {}, a = (d, t, s, c) => { if (d) (m[d] = m[d] || []).push([t, s, c]); };
    Q.S.yk.forEach(r => { const t = r.kind === "全休" ? "有給" : r.kind === "半休" ? "半休" : "時間休"; a(r.date, t, t, r.kind === "全休" ? "c1" : "c2"); });
    Q.S.tu.forEach(r => a(r.date, "振替" + r.hours + "h", "振" + r.hours + "h", "c5"));
    Q.S.fh.forEach(r => {
      a(r.work, "休日出勤", "休日出勤", "c6"); const h = r.method === "半日×2";
      [r.d1, r.d2].forEach(d => a(d, r.kind === "振替休業" ? "振替休業" : h ? "振替半日" : "振替休日", r.kind === "振替休業" ? "振替休業" : h ? "振替半日" : "振替休日", h ? "c4" : "c3"));
    });
    return m;
  }

  /* ---------- 授業側とのつながり ---------- */
  const kinEv = d => { const e = Q.ready && Q.S.ev.find(x => x.date === d); return e ? e.text : ""; };
  A.evOf = d => (A.st && A.st.events && A.st.events[d]) || kinEv(d) || "";
  A.evList = (from, to) => {
    const ds = new Set(); if (A.st && A.st.events) Object.keys(A.st.events).forEach(d => { if (A.st.events[d]) ds.add(d); });
    if (Q.ready) Q.S.ev.forEach(e => { if (e.text) ds.add(e.date); });
    return [...ds].filter(d => d >= from && d <= to).sort();
  };
  J.evExtra = kinEv;
  function lessonMap() {
    const m = {}; if (!A.st) return m;
    A.st.classes.forEach(c => J.project(A.st, c).rows.forEach(r => { if (!r.off) m[r.date] = (m[r.date] || 0) + (r.hrs || 1); }));
    return m;
  }
  /* その日の勤怠の予定（有給・振替など）。授業の今日の画面に出す */
  A.kintai.dayNote = d => {
    if (!Q.ready) return "";
    const k = (marks()[d] || []).filter(x => x[0] !== "休日出勤").map(x => x[0]);
    return k.length ? "勤怠：" + k.join("・") + "の日です。授業が入っているときは、手配は済んでいますか？" : "";
  };

  /* ---------- 画面の部品 ---------- */
  const empty = m => '<p class="note" style="margin:0">' + m + "</p>";
  const chip = s => '<span class="kst' + (s === "申請済" ? " s2" : "") + '">' + esc(s) + "</span>";
  const SPEC = {
    yk: { n: "有給", h: ["日付", "種類", "時間数", "申請状況", "備考"], f: [["date", "日付", "date"], ["kind", "種類", ["全休", "半休", "時間休"]], ["hours", "時間数（時間休のみ）", "number"], ["status", "申請状況", ["未申請", "申請済"]], ["note", "備考", "text"]], row: r => [esc(fm(r.date)), esc(r.kind), r.kind === "時間休" ? esc(r.hours) + "h" : "", chip(r.status), esc(r.note)], req: "date", dt: "date", list: () => ykY(ui.Y) },
    ot: { n: "超過勤務", h: ["勤務日", "超過(h)", "要件", "申請状況", "備考", "未完済(h)"], f: [["date", "勤務日", "date"], ["hours", "超過時間（h）", "number"], ["what", "要件", "text"], ["status", "申請状況", ["未申請", "申請済"]], ["note", "備考", "text"]], row: (r, x) => [esc(fm(r.date)), esc(r.hours), esc(r.what), chip(r.status), esc(r.note), x[r.id] > 0 ? '<b class="bad">' + R(x[r.id]) + "</b>" : "0"], req: "date", dt: "date", list: () => Q.S.ot.filter(r => fy(r.date) === ui.Y) },
    tu: { n: "振替時間休", h: ["使用日", "使用(h)", "充当元（古い超過分から自動）", "備考"], f: [["date", "使用日", "date"], ["hours", "使用時間（h）", "number"], ["note", "備考", "text"]], row: (r, x) => [esc(fm(r.date)), esc(r.hours), esc((x[r.id] || []).join(" ＋ ")), esc(r.note)], req: "date", dt: "date", list: () => Q.S.tu.filter(r => fy(r.date) === ui.Y) },
    fh: { n: "振替休日", h: ["種類", "勤務日", "要件", "振替方法", "振替日", "振替日2", "仮申請日", "申請状況", "状況", "備考"], f: [["kind", "種類", ["振替休日", "振替休業"]], ["work", "勤務日", "date"], ["what", "要件", "text"], ["method", "振替方法", ["1日", "半日×2"]], ["d1", "振替日（半日は1日目）", "date"], ["d2", "振替日2（半日の2日目）", "date"], ["tmp", "仮申請日", "date"], ["status", "申請状況", ["未申請", "申請済"]], ["note", "備考", "text"]], row: r => { const s = fhSt(r), c = { "取得前": "s5", "取得済": "s3", "振替日未定": "s4", "要確認": "s4" }[s] || ""; return [esc(r.kind), esc(fm(r.work)), esc(r.what), esc(r.method), esc(fm(r.d1)), esc(fm(r.d2)), esc(fm(r.tmp)), chip(r.status), '<span class="kst ' + c + '">' + s + "</span>", esc(r.note)]; }, req: "work", dt: "work", list: () => fhY(ui.Y) },
    ev: { n: "行事予定", h: ["日付", "行事・内容", "部活区分", "休日"], f: [["date", "日付", "date"], ["text", "行事・内容", "text"], ["cat", "部活区分", ["", ...CK]], ["hol", "休日表示（祝日・休校など）", ["", "○"]]], row: r => [esc(fm(r.date)), esc(r.text), esc(r.cat), esc(r.hol)], req: "date", dt: "date", list: () => Q.S.ev.filter(r => fy(r.date) === ui.Y) }
  };
  function listView(k) {
    const sp = SPEC[k], x = k === "ot" ? otRem() : k === "tu" ? alloc() : {}, rec = ui.ed && ui.ed.k === k ? (Q.S[k].find(r => r.id === ui.ed.id) || {}) : {};
    const fld = sp.f.map(([n, l, t]) => {
      const v = rec[n] != null ? rec[n] : (n === "status" ? "未申請" : n === "method" ? "1日" : "");
      return "<label>" + l + (Array.isArray(t) ? '<select name="' + n + '">' + t.map(o => "<option" + (o === v ? " selected" : "") + ">" + o + "</option>").join("") + "</select>" : '<input name="' + n + '" type="' + t + '"' + (t === "number" ? ' step="0.5" style="width:90px"' : "") + ' value="' + esc(v) + '">') + "</label>";
    }).join("");
    const rows = sp.list().sort((a, b) => a[sp.dt] < b[sp.dt] ? -1 : 1).map(r => "<tr>" + sp.row(r, x).map(c => "<td>" + c + "</td>").join("") + '<td><button class="btn sm" data-kact="e" data-k="' + k + '" data-id="' + r.id + '">編集</button> <button class="btn sm danger" data-kact="d" data-k="' + k + '" data-id="' + r.id + '">削除</button></td></tr>').join("");
    return '<section class="panel p-kin"><header class="panel-h"><h2>' + sp.n + "（" + ui.Y + "年度）</h2></header><div class=\"panel-b\"><form class=\"kform\" data-kform=\"" + k + '">' + fld + '<button class="btn on">' + (rec.id ? "更新" : "追加") + "</button>" + (rec.id ? '<button type="button" class="btn" data-kact="c">取消</button>' : "") + '</form><div class="kwrap"><table class="ktb"><tr>' + sp.h.map(h => "<th>" + h + "</th>").join("") + "<th></th></tr>" + (rows || '<tr><td colspan="12" class="note">まだ記録がありません</td></tr>') + "</table></div></div></section>";
  }
  const yearSel = () => '<select id="k_y" data-kchg="y" style="width:auto;margin:0 0 12px">' + [...new Set([2026, 2027, 2028, 2029, 2030, ui.Y])].sort().map(y => "<option" + (y === ui.Y ? " selected" : "") + ">" + y + "</option>").join("") + "</select> 年度";
  const hdr = t => '<div class="pghd"><div><h2 class="pgt">KINTAI</h2><p class="pgs">' + t + "</p></div></div>";

  function todos(y) {
    const f = fhY(y), cnt = s => f.filter(r => fhSt(r) === s).length;
    return [["有給の未申請", ykY(y).filter(r => r.status !== "申請済").length, "yk"], ["超過勤務の未申請", Q.S.ot.filter(r => fy(r.date) === y && r.status !== "申請済").length, "ot"], ["振替休日の未申請", cnt("未申請"), "fh"], ["振替日が未定", cnt("振替日未定"), "fh"], ["要確認の振替休日", cnt("要確認"), "fh"]];
  }
  function viewHome() {
    const y = ui.Y, b = set(), t = taken(y), rm = remain(y), duty = ykY(y).filter(r => r.kind !== "時間休").reduce((a, r) => a + days(r), 0);
    const hf = ykY(y).filter(r => r.kind === "半休").length, hh = ykY(y).filter(r => r.kind === "時間休").reduce((a, r) => a + (+r.hours || 0), 0);
    const oe = Q.S.ot.filter(r => fy(r.date) === y).reduce((a, r) => a + (+r.hours || 0), 0), ou = Q.S.tu.filter(r => fy(r.date) === y).reduce((a, r) => a + (+r.hours || 0), 0);
    const f = fhY(y), cnt = s => f.filter(r => fhSt(r) === s).length, td = todos(y), n = now();
    const nx = a => a.filter(d => d >= n).sort()[0], nk = nx(Q.S.yk.map(r => r.date)), nf = nx(Q.S.fh.filter(r => r.kind === "振替休日").flatMap(r => [r.d1, r.d2]).filter(Boolean));
    let h = askH() + hdr("有給・超過勤務・振替休日") + yearSel();
    h += '<div class="kgrid">' +
      '<div class="kcard"><h3>残有給</h3><div class="kbig">' + R(rm) + '日</div><div class="note">総枠 ' + R(b.base + carry(y)) + "日（付与" + b.base + "＋繰越" + R(carry(y)) + "）／取得 " + R(t) + "日</div></div>" +
      '<div class="kcard"><h3>取るべき有給（繰越上限' + b.cap + '日超過分）</h3><div class="kbig' + (rm > b.cap ? " bad" : "") + '">' + R(Math.max(0, rm - b.cap)) + "日</div></div>" +
      '<div class="kcard"><h3>5日義務（全休＋半休）</h3><div class="kbig' + (duty >= b.duty ? " ok" : "") + '">' + R(duty) + '日</div><div class="note">' + (duty >= b.duty ? "達成" : "あと" + R(b.duty - duty) + "日") + "（時間休は含めない）</div></div>" +
      '<div class="kcard"><h3>半休・時間休</h3><div>半休 ' + hf + " / " + b.halfMax + "回</div><div>時間休 " + R(hh) + " / " + b.hourMax + "時間</div></div>" +
      '<div class="kcard"><h3>超過勤務（時間振替）</h3><div class="kbig' + (oe - ou > 0 ? " bad" : "") + '">残 ' + R(oe - ou) + 'h</div><div class="note">超過 ' + R(oe) + "h／使用 " + R(ou) + "h</div></div>" +
      '<div class="kcard"><h3>振替休日（' + f.length + "件）</h3><div>取得前 " + cnt("取得前") + "／取得済 " + cnt("取得済") + "／未申請 " + cnt("未申請") + "</div></div>" +
      '<div class="kcard"><h3>やること</h3>' + td.map(([l, c, tb]) => '<div class="ktodo"><span>' + l + '</span><button class="kcnt ' + (c ? "bad" : "ok") + '" data-ktab="' + tb + '">' + c + "件</button></div>").join("") + "</div>" +
      '<div class="kcard"><h3>次の予定</h3><div>有給：' + (nk ? fm(nk) : "なし") + "</div><div>振替休日：" + (nf ? fm(nf) : "なし") + "</div></div></div>";
    return h;
  }
  const PRI = ["c1", "c3", "c4", "c2", "c5", "c6"], MS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
  const evObj = d => { const e = Q.S.ev.find(x => x.date === d); return e || { text: (A.st && A.st.events && A.st.events[d]) || "", cat: "", hol: "" }; };
  function viewCal() {
    let h = askH() + hdr("カレンダー") + yearSel();
    const m = marks(), n = now();
    h += '<div class="kmbar"><button class="btn sm' + (ui.cm ? "" : " on") + '" data-kact="m" data-m="0">年間</button>' + MS.map(x => '<button class="btn sm' + (ui.cm === x ? " on" : "") + '" data-kact="m" data-m="' + x + '">' + x + "月</button>").join("") + "</div>";
    if (!ui.cm) {
      h += '<div class="kwrap"><table class="kcal"><tr>' + MS.map(x => "<th>" + x + "月</th>").join("") + "</tr>";
      for (let d = 1; d <= 31; d++) {
        h += "<tr>";
        MS.forEach(mo => {
          const yy = mo >= 4 ? ui.Y : ui.Y + 1, dt = new Date(yy, mo - 1, d);
          if (dt.getMonth() !== mo - 1) { h += '<td class="na"></td>'; return; }
          const s = yy + "-" + pad(mo) + "-" + pad(d), k = m[s] || [], e = evObj(s), w = dt.getDay(), off = w === 0 || e.hol === "○", c = PRI.find(x => k.some(a => a[2] === x)) || "";
          h += '<td class="' + c + (s === n ? " td" : "") + (!c && w === 6 ? " sa" : "") + (!c && off ? " su" : "") + '" title="' + esc([...k.map(a => a[0]), e.text].filter(Boolean).join(" / ")) + '">' + d + WD[w] + " " + esc(k.map(a => a[1]).join(" ")) + "</td>";
        });
        h += "</tr>";
      }
      return h + '</table></div><p class="note">赤い日は日曜・休日表示の日。月のボタンを押すと、行事と授業のコマ数を見ながら、振替日を決められます。</p>';
    }
    const mo = ui.cm, yy = mo >= 4 ? ui.Y : ui.Y + 1, len = new Date(yy, mo, 0).getDate(), lm = lessonMap();
    const pd = Q.S.fh.filter(r => !r.d1 || (r.method === "半日×2" && !r.d2)); if (!pd.find(r => r.id === ui.pk)) ui.pk = pd[0] && pd[0].id;
    const ts = A.st ? A.st.term : null;
    h += '<div class="kcard" style="margin-bottom:8px">振替日を決める振替休日：' + (pd.length ? '<select id="k_pk" data-kchg="pk" style="width:auto">' + pd.map(r => '<option value="' + r.id + '"' + (r.id === ui.pk ? " selected" : "") + ">" + esc(fm(r.work)) + " " + esc(r.what || "") + (r.method === "半日×2" ? "（半日）" : "") + "</option>").join("") + '</select> <span class="note">日付の行の「ここを振替日に」を押すと入ります。授業のコマ数も見て選べます。</span>' : '<span class="note">振替日が未定のものはありません</span>') + '</div><div class="kwrap"><table class="ktb"><tr><th>日付</th><th>授業</th><th>勤怠</th><th>区分</th><th>行事・内容</th><th></th></tr>';
    for (let d = 1; d <= len; d++) {
      const s = yy + "-" + pad(mo) + "-" + pad(d), k = m[s] || [], e = evObj(s), w = new Date(yy, mo - 1, d).getDay(), off = w === 0 || w === 6 || e.hol === "○", ci = CK.indexOf(e.cat), c = PRI.find(x => k.some(a => a[2] === x)) || "";
      const inTerm = ts && s >= ts.start && s <= ts.end, ln = lm[s] || 0;
      const lt = inTerm ? (ln ? '<b>' + ln + "コマ</b>" : (off ? "" : '<span class="ok">授業なし</span>')) : '<span class="note">－</span>';
      h += '<tr class="' + (s === n ? "td" : "") + '"><td class="' + (w === 6 ? "sa" : off ? "su" : "") + '">' + mo + "/" + d + "(" + WD[w] + ")" + (e.hol === "○" ? " 休" : "") + "</td><td>" + lt + '</td><td class="' + c + '">' + esc(k.map(a => a[0]).join(" ")) + '</td><td class="' + (ci >= 0 ? "k" + (ci + 1) : "") + '">' + esc(e.cat || "") + '</td><td class="' + (/閉鎖|休校|休業/.test(e.text || "") ? "hl" : "") + '" style="white-space:normal">' + esc(e.text || "") + "</td><td>" + (!off && ui.pk && !k.length ? '<button class="btn sm" data-kact="assign" data-d="' + s + '">ここを振替日に</button>' : "") + "</td></tr>";
    }
    return h + "</table></div>" + (ts ? '<p class="note">授業のコマ数は、いま開いている学期（' + esc(ts.name) + "）の分だけです。</p>" : "");
  }
  const viewYk = () => askH() + hdr("有給") + yearSel() + listView("yk");
  const viewOt = () => askH() + hdr("超過勤務と振替時間休") + yearSel() + listView("ot") + listView("tu");
  const viewFh = () => askH() + hdr("振替休日") + yearSel() + listView("fh");
  function viewEv() {
    const nn = A.st ? Object.keys(A.st.events || {}).filter(d => A.st.events[d] && !Q.S.ev.some(e => e.date === d)).length : 0;
    return askH() + hdr("行事予定（授業側とも共通）") + yearSel() + '<p class="note" style="margin-top:0">ここに入れた行事は、授業の「今日」「計画表」「一覧」にも出ます。授業側の行事は、日付が同じなら授業側が優先です。</p>' + (nn ? '<p><button class="btn" data-kact="evimport">いまの学期の授業側の行事 ' + nn + "件を、ここに取り込む</button></p>" : "") + listView("ev");
  }
  function viewSet() {
    const b = set(), y = ui.Y, num = (k, l) => "<label>" + l + '<input type="number" step="0.5" data-kset="' + k + '" value="' + b[k] + '"></label>';
    let h = askH() + hdr("設定");
    h += '<section class="panel p-kin"><header class="panel-h"><h2>有給などの基準</h2></header><div class="panel-b"><div class="ksetg">' + num("base", "年間の付与日数") + num("cap", "繰越の上限（日）") + num("hpd", "1日の時間数") + num("halfMax", "半休の上限（回）") + num("hourMax", "時間休の上限（時間）") + num("duty", "取得義務（日）") + '</div><label>' + y + '年度の繰越日数（空欄のときは、前の年度の残りから自動で計算）</label><input type="number" step="0.5" data-kset="carry" value="' + (b.carry[y] != null && b.carry[y] !== "" ? b.carry[y] : "") + '" style="max-width:160px"><div style="margin-top:8px">' + yearSel() + "</div></div></section>";
    h += '<section class="panel p-kin"><header class="panel-h"><h2>今の「勤怠管理」アプリから引き継ぐ</h2></header><div class="panel-b"><p class="note" style="margin-top:0">今のアプリの「バックアップ書き出し」で出るファイルを開き、中の文章をすべてコピーして、下に貼ってください。（行事予定だけの文章でも読み込めます。）</p><textarea id="k_imp" rows="4" placeholder="ここに貼り付け"></textarea><div class="btns" style="margin-top:6px"><button class="btn" data-kact="import">貼った内容で読み込む</button></div>' + (ui.msg ? '<p class="note">' + esc(ui.msg) + "</p>" : "") + "</div></section>";
    h += '<section class="panel p-kin"><header class="panel-h"><h2>バックアップ</h2></header><div class="panel-b"><button class="btn" data-kact="export">ファイルに書き出す</button></div></section>';
    return h;
  }
  A.kintai.view = function () {
    if (!Q.ready) return '<p class="note">読み込んでいます…</p>';
    return { home: viewHome, cal: viewCal, yk: viewYk, ot: viewOt, fh: viewFh, ev: viewEv, set: viewSet }[ui.tab]();
  };
  A.kintai.sub = () => "勤怠" + (Q.ready ? " ・ " + ui.Y + "年度" : "");
  A.kintai.statusText = () => Q.st;
  A.kintai.dueCount = () => (Q.ready ? todos(Math.max(2026, fy(now()))).reduce((a, x) => a + x[1], 0) : 0);

  /* 「今日の校務」の枠に一緒に出す: やること＋1週間以内の有給・振替 */
  A.kintai.todayItems = function () {
    if (!Q.ready) return { n: 0, html: "" };
    const y = fy(now()), td = todos(y).filter(x => x[1] > 0), n0 = now(), lim = J.addDays(n0, 7), up = [];
    const mk = marks(); Object.keys(mk).filter(d => d >= n0 && d <= lim).sort().forEach(d => mk[d].filter(x => x[0] !== "休日出勤").forEach(x => up.push([d, x[0]])));
    if (!td.length && !up.length) return { n: 0, html: "" };
    const n = td.length + up.length;
    return { n, html: '<h3 class="tstd ktd">勤怠 <span class="note">' + n + "件</span></h3>" + up.map(([d, t]) => '<div class="ktodo"><span>' + J.md(d) + "（" + wd(d) + "）" + t + '</span><span class="note">' + (d === n0 ? "今日" : "あと" + Math.round((J.pd(d) - J.pd(n0)) / 864e5) + "日") + "</span></div>").join("") + td.map(([l, c]) => '<div class="ktodo"><span>' + l + '</span><b class="bad">' + c + "件</b></div>").join("") + '<p style="margin:8px 0 0"><button class="btn sm" data-kact="go">勤怠を開く</button></p>' };
  };

  /* ---------- 操作 ---------- */
  document.addEventListener("click", e => {
    const t = e.target.closest("[data-kact]"); if (!t) return;
    const a = t.dataset.kact, S0 = Q.S, k = t.dataset.k, id = t.dataset.id;
    switch (a) {
      case "go": A.ui.mode = "kin"; LS.set("jd.mode", "kin"); ui.tab = "home"; A.render(); root.scrollTo(0, 0); return;
      case "create": Q.needCreate = false; Q.dirty = true; save(); A.render(); return;
      case "reload": reloadRemote(); return;
      case "draft-drop": LS.del("jd.draft.kintai"); Q.ask = false; Q.draftP = null; Q.dirty = false; Q.st = "GitHubと同期中"; A.render(); return;
      case "draft-use": Q.S = mig(Q.draftP); Q.draftP = null; Q.ask = false; Q.needCreate = false; Q.dirty = true; save(); A.render(); return;
      case "m": ui.cm = +t.dataset.m || null; A.render(); return;
      case "e": ui.ed = { k, id }; A.render(); return;
      case "c": ui.ed = null; A.render(); return;
      case "d": if (root.confirm("この記録を削除しますか？")) { S0[k] = S0[k].filter(r => r.id !== id); save(); A.render(); } return;
      case "assign": {
        const r = S0.fh.find(x => x.id === ui.pk), d = t.dataset.d;
        if (!r || !root.confirm(fm(d) + " を振替日にしますか？")) return;
        if (!r.d1) r.d1 = d; else r.d2 = d; save(); A.render(); return;
      }
      case "evimport": {
        const add = Object.keys(A.st.events || {}).filter(d => A.st.events[d] && !S0.ev.some(x => x.date === d));
        if (!add.length || !root.confirm("授業側の行事 " + add.length + "件を、行事予定に取り込みます。よろしいですか？")) return;
        add.forEach(d => S0.ev.push({ id: uid(), date: d, text: A.st.events[d], cat: "", hol: "" })); save(); A.render(); return;
      }
      case "import": {
        let o; try { o = JSON.parse($("k_imp").value); } catch (x) { o = null; }
        const isEv = Array.isArray(o), isObj = o && !isEv && (Array.isArray(o.yk) || Array.isArray(o.fh) || Array.isArray(o.ot));
        if (!isEv && !isObj) { ui.msg = "読み込めませんでした。今のアプリのバックアップの全文を、そのまま貼ってください。"; A.render(); return; }
        if (!root.confirm(isEv ? "行事予定が、貼った内容に置き換わります。よろしいですか？" : "いまの勤怠のデータは、貼った内容に置き換わります。よろしいですか？")) return;
        if (isEv) { S0.ev = mig({ ev: o }).ev; ui.msg = "行事予定を " + S0.ev.length + "件、読み込みました。"; }
        else { Q.S = mig(o); ui.msg = "読み込みました（有給 " + Q.S.yk.length + "件・超過勤務 " + Q.S.ot.length + "件・振替時間休 " + Q.S.tu.length + "件・振替休日 " + Q.S.fh.length + "件・行事 " + Q.S.ev.length + "件）。"; }
        save(); A.render(); return;
      }
      case "export": {
        const url = URL.createObjectURL(new Blob([J.toJSON(Q.S)], { type: "application/json" })), el = document.createElement("a");
        el.href = url; el.download = "kintai-" + now() + ".json"; document.body.appendChild(el); el.click(); el.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); return;
      }
    }
  });
  document.addEventListener("change", e => {
    const t = e.target;
    if (t.dataset && t.dataset.kchg) {
      if (t.dataset.kchg === "y") { ui.Y = +t.value; ui.ed = null; A.render(); } else if (t.dataset.kchg === "pk") ui.pk = t.value;
      return;
    }
    if (t.dataset && t.dataset.kset) {
      const k = t.dataset.kset, b = Q.S.set;
      if (k === "carry") { if (t.value === "") delete b.carry[ui.Y]; else b.carry[ui.Y] = +t.value; } else b[k] = +t.value || 0;
      save();
    }
  });
  document.addEventListener("submit", e => {
    const f = e.target.closest && e.target.closest("form[data-kform]"); if (!f) return;
    e.preventDefault();
    const k = f.dataset.kform, sp = SPEC[k], r = {};
    new FormData(f).forEach((v, n) => { r[n] = v; });
    if (!r[sp.req]) { root.alert("日付を入力してください"); return; }
    if (k === "fh" && r.method !== "半日×2") r.d2 = "";
    if (ui.ed && ui.ed.k === k) { const i = Q.S[k].findIndex(x => x.id === ui.ed.id); if (i >= 0) Q.S[k][i] = Object.assign({}, Q.S[k][i], r); } else Q.S[k].push(Object.assign({ id: uid() }, r));
    ui.ed = null; save(); A.render();
  });
  A.kintai.load = load;
  load();
})(window);
