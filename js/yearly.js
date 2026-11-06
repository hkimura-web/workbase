/* THE WORKBASE: 毎年のくり返しノート（校務の「くり返し」タブ）
 *  - 毎年同じ時期に起きること（面談週間・模試・短縮授業など）を、年度ごとに貯めておく
 *  - 次の年に、「去年の同じ時期にあったこと」を出して、今年に取り込める
 *  - データ: data/yearly.json（トークンがあれば GitHub に自動保存。なければこの端末の下書き） */
(function (root) {
  "use strict";
  const J = root.JD, S = root.JDStore, A = root.A, LS = S.LS, esc = J.esc;
  const $ = id => document.getElementById(id);
  const FILE = "data/yearly.json", DK = "jd.draft.yearly";
  const Q = { S: null, sha: null, dirty: false, saving: false, timer: null, token: false, conflict: false, ask: false, draftP: null, canSave: true, ready: false };
  const ui = { q: "", y: "", open: {} };
  const AG = { yes: "毎年ある", maybe: "たぶん毎年", no: "今年だけ" };
  A.yearly = {};
  let uid = Date.now();
  const W = ["日", "月", "火", "水", "木", "金", "土"];
  const md = d => { const x = J.pd(d); return (x.getMonth() + 1) + "/" + x.getDate() + "（" + W[x.getDay()] + "）"; };
  const schoolYear = d => { const x = typeof d === "string" ? J.pd(d) : d; return x.getMonth() >= 3 ? x.getFullYear() : x.getFullYear() - 1; };
  const addDays = (d, n) => { const x = J.pd(d); x.setDate(x.getDate() + n); return J.ds(x); };
  const shift = (d, yrs) => addDays(d, 364 * yrs);   /* 52週ぶん（曜日がそろう）ずらす。1日ずれることがあるので、取り込んだあとに直せる */

  const SEED = () => [{ id: "y-seed1", y: 2026, from: "2026-11-09", to: "2026-11-13", title: "面談週間（40分授業・午後は面談）＋模擬試験", again: "maybe",
    body: "11月の第2週。1時間が40分の授業（1限8:52〜）。5限以降は授業なし（面談）。\n11日（水）…国語80分・英語80分の模擬試験。12日（木）…数学100分の模擬試験とLHR（50分）。\n9・10・13日は4限まで（1限8:52〜9:32／2限9:40〜10:20／3限10:28〜11:08／4限11:16〜11:56）。", links: [],
    sp: [{ id: "z1", from: "2026-11-09", to: "2026-11-10", name: "面談週間（40分授業）", off: [5, 6, 7], why: "面談", bell: { s: 532, len: 40, brk: 8 } },
      { id: "z2", from: "2026-11-11", to: "2026-11-12", name: "模擬試験", off: "all", why: "模擬試験", bell: null },
      { id: "z3", from: "2026-11-13", to: "2026-11-13", name: "面談週間（40分授業）", off: [5, 6, 7], why: "面談", bell: { s: 532, len: 40, brk: 8 } }] }];
  function mig(s) {
    s = s && typeof s === "object" ? s : {}; s.v = 1;
    if (!s.seeded) { s.items = (Array.isArray(s.items) ? s.items : []).concat(SEED().filter(x => !(s.items || []).some(y => y.id === x.id))); s.seeded = true; }
    s.items = (Array.isArray(s.items) ? s.items : []).filter(x => x && x.id).map(x => ({ id: String(x.id), y: +x.y || schoolYear(x.from || J.ds(new Date())), from: String(x.from || ""), to: String(x.to || x.from || ""), title: String(x.title || "無題"), body: String(x.body || ""), again: AG[x.again] ? x.again : "maybe", links: (Array.isArray(x.links) ? x.links : []).slice(0, 3).map(l => ({ t: String((l && l.t) || ""), u: String((l && l.u) || "") })), sp: Array.isArray(x.sp) ? x.sp.filter(z => z && z.from) : [] }));
    s.upd = s.upd || 0; return s;
  }
  const ghOn = () => { const s = S.getSettings(); return !!(s.token && s.owner && s.repo); };
  async function load() {
    const s = S.getSettings(); Q.token = ghOn(); let text = null;
    if (Q.token) { try { const r = await S.remoteGet(s, FILE); text = r.text; Q.sha = r.sha; } catch (e) { if (e.status !== 404) Q.canSave = false; } }
    else { try { const r = await fetch(FILE + "?t=" + Date.now(), { cache: "no-store" }); if (r.ok) text = await r.text(); } catch (e) { text = null; } }
    let p = null; try { p = text ? JSON.parse(text) : null; } catch (e) { p = null; }
    let dr = null; try { const raw = LS.get(DK); dr = raw ? JSON.parse(raw) : null; } catch (e) { dr = null; }
    if (dr && dr.dirty && dr.p) { if (Q.token && Q.sha && dr.base !== Q.sha) { Q.ask = true; Q.draftP = dr.p; } else { p = dr.p; Q.dirty = true; } }
    Q.S = mig(p); Q.ready = true;
    if (Q.dirty && Q.token && Q.canSave && !Q.ask) flush();
    A.render && A.render();
  }
  function save() { Q.S.upd = Date.now(); Q.dirty = true; LS.set(DK, JSON.stringify({ p: Q.S, dirty: true, base: Q.sha })); clearTimeout(Q.timer); Q.timer = setTimeout(flush, 900); }
  async function flush() {
    if (!Q.dirty || !Q.token || !Q.canSave || Q.conflict || Q.ask) return;
    if (Q.saving) { clearTimeout(Q.timer); Q.timer = setTimeout(flush, 600); return; }
    Q.saving = true; const snap = JSON.stringify(Q.S);
    try { const r = await S.remotePut(S.getSettings(), FILE, J.toJSON(Q.S), Q.sha, "毎年のくり返しノートを更新"); Q.sha = r.sha; if (JSON.stringify(Q.S) === snap) { Q.dirty = false; LS.del(DK); } else { clearTimeout(Q.timer); Q.timer = setTimeout(flush, 300); } }
    catch (e) { if (e.status === 409 || e.status === 422) Q.conflict = true; }
    Q.saving = false; if (Q.conflict) A.render();
  }
  async function refresh() {
    if (document.hidden || !Q.ready || !Q.token || Q.saving || Q.dirty || Q.conflict || Q.ask || !Q.canSave) return;
    if (document.querySelector("dialog[open]") || (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) return;
    try { const r = await S.remoteGet(S.getSettings(), FILE); if (r.sha !== Q.sha && !Q.dirty && !Q.saving) { Q.sha = r.sha; Q.S = mig(JSON.parse(r.text)); A.render(); } } catch (e) { /* 次の機会に */ }
  }
  document.addEventListener("visibilitychange", refresh); window.addEventListener("focus", refresh); setInterval(refresh, 120000);

  /* ---------- 去年の同じ時期 ---------- */
  function suggestions() {
    const today = J.ds(new Date()), cy = schoolYear(today), lo = addDays(today, -14), hi = addDays(today, 75), out = [];
    Q.S.items.forEach(it => {
      if (it.y >= cy || it.again === "no" || !it.from) return;
      const n = cy - it.y, f = shift(it.from, n), t = shift(it.to || it.from, n);
      if (t < lo || f > hi) return;
      if (Q.S.items.some(x => x.y === cy && x.title === it.title)) return;
      out.push({ it, n, f, t });
    });
    return out.sort((a, b) => a.f < b.f ? -1 : 1);
  }
  function importIt(id) {
    const it = Q.S.items.find(x => x.id === id); if (!it) return;
    const cy = schoolYear(J.ds(new Date())), n = cy - it.y, nid = "y" + (uid++);
    Q.S.items.unshift({ id: nid, y: cy, from: shift(it.from, n), to: shift(it.to || it.from, n), title: it.title, body: "（" + it.y + "年度の内容を写しました。今年の内容に直してください）\n" + it.body, again: it.again, links: JSON.parse(JSON.stringify(it.links)), sp: it.sp.map(z => Object.assign({}, JSON.parse(JSON.stringify(z)), { id: "z" + (uid++), from: shift(z.from, n), to: shift(z.to || z.from, n) })) });
    ui.open[nid] = true; save(); A.render();
  }

  /* ---------- 画面 ---------- */
  const match = it => { const q = ui.q.trim().toLowerCase(); return (!ui.y || String(it.y) === ui.y) && (!q || (it.title + " " + it.body).toLowerCase().includes(q)); };
  function card(it, i) {
    const lk = it.links.filter(l => l.u).map(l => '<a class="btn wlnk" href="' + esc(l.u) + '" target="_blank" rel="noopener noreferrer">' + esc(l.t || "リンク") + " ↗</a>").join("");
    const row = (l, j) => '<div class="wlrow"><input type="text" value="' + esc(l.t) + '" placeholder="リンクの名前" data-yf="lt" data-i="' + i + '" data-j="' + j + '"><input type="url" value="' + esc(l.u) + '" placeholder="https://…" data-yf="lu" data-i="' + i + '" data-j="' + j + '" autocomplete="off"><span></span></div>';
    const sp = it.sp.length ? '<p class="note" style="margin:6px 0 0">特別日課つき：' + it.sp.map(z => esc(z.name) + "（" + md(z.from) + (z.to && z.to !== z.from ? "〜" + md(z.to) : "") + "）").join("、") + "</p>" : "";
    return '<details class="wdet ydet" data-ph="' + esc(it.id) + '"' + (ui.open[it.id] ? " open" : "") + "><summary><span class=\"wdt\">" + esc(it.title) + '</span> <span class="tgchip tgx tg-' + (it.again === "yes" ? 2 : it.again === "maybe" ? 3 : 7) + '">' + AG[it.again] + '</span> <span class="note">' + (it.from ? md(it.from) + (it.to && it.to !== it.from ? "〜" + md(it.to) : "") : "") + "</span></summary>" +
      '<div class="wcard" style="border:0;padding:4px 0 8px"><label>名前</label><input type="text" value="' + esc(it.title) + '" data-yf="title" data-i="' + i + '">' +
      '<div class="btns" style="margin-top:6px;align-items:center"><span class="small">年度</span><input type="number" value="' + it.y + '" min="2000" max="2100" data-yf="y" data-i="' + i + '" style="width:84px"><span class="small">期間</span><input type="date" value="' + esc(it.from) + '" data-yf="from" data-i="' + i + '" style="width:auto"><span>〜</span><input type="date" value="' + esc(it.to) + '" data-yf="to" data-i="' + i + '" style="width:auto">' +
      '<select data-ychg="again" data-i="' + i + '" style="width:auto">' + Object.keys(AG).map(k => '<option value="' + k + '"' + (it.again === k ? " selected" : "") + ">" + AG[k] + "</option>").join("") + "</select></div>" +
      '<label>内容・メモ（時間割の変更、気をつけること、決まった理由など）</label><textarea rows="6" data-yf="body" data-i="' + i + '">' + esc(it.body) + "</textarea>" +
      '<div class="wlset"><b class="small">資料リンク（時間割のお知らせなど・最大3つ）</b>' + [0, 1, 2].map(j => row(it.links[j] || { t: "", u: "" }, j)).join("") + "</div>" + sp +
      '<div class="btns" style="margin-top:8px"><button class="btn" data-ya="sp-copy" data-i="' + i + '" title="授業の「特別日課」のうち、この期間のものを、このノートに写します">授業の特別日課を写す</button>' + (it.sp.length ? '<button class="btn" data-ya="sp-apply" data-i="' + i + '" title="このノートの特別日課を、いま開いている学期の授業に入れます">授業の特別日課に入れる</button>' : "") + '<button class="btn danger" data-ya="del" data-i="' + i + '">このノートを消す</button></div></div></details>';
  }
  function listH() {
    const ys = {}; Q.S.items.map((it, i) => [it, i]).filter(x => match(x[0])).sort((a, b) => (b[0].from || "").localeCompare(a[0].from || "")).forEach(([it, i]) => { (ys[it.y] = ys[it.y] || []).push(card(it, i)); });
    return Object.keys(ys).sort((a, b) => b - a).map(y => '<h3 class="yh">' + y + "年度</h3>" + ys[y].join("")).join("") || '<p class="note">該当するノートがありません。</p>';
  }
  A.yearly.view = function () {
    if (!Q.ready) return '<p class="note">読み込み中…</p>';
    let h = "";
    if (Q.ask) h += '<div class="banner err"><div>この端末に、GitHubにまだ保存していない変更があります。どちらを使いますか？</div><div class="btns"><button class="btn" data-ya="draft-drop">GitHubの最新を使う</button><button class="btn" data-ya="draft-use">この端末の内容を使う</button></div></div>';
    else if (Q.conflict) h += '<div class="banner err"><div>別の端末で先に更新されています。</div><div class="btns"><button class="btn" data-ya="reload">最新を読み込み直す</button></div></div>';
    h += '<div class="pghd"><div><h2 class="pgt">YEARLY</h2><p class="pgs">毎年くり返すことを貯めて、来年の予定づくりに使います。</p></div></div>';
    const sg = suggestions();
    if (sg.length) h += '<section class="panel"><header class="panel-h"><h2>去年の同じ時期にあったこと</h2><span class="panel-n">' + sg.length + '件</span></header><div class="panel-b">' + sg.map(s => '<div class="ysg"><div><b>' + esc(s.it.title) + '</b> <span class="note">' + s.it.y + "年度：" + md(s.it.from) + (s.it.to !== s.it.from ? "〜" + md(s.it.to) : "") + "　→　今年の同じ週：" + md(s.f) + (s.t !== s.f ? "〜" + md(s.t) : "") + '</span><div class="note" style="margin:2px 0 0">' + esc(s.it.body.split("\n")[0]) + '</div></div><button class="btn on sm" data-ya="import" data-id="' + esc(s.it.id) + '">今年に取り込む</button></div>').join("") + "</div></section>";
    else h += '<p class="note" style="margin:0 0 8px">これから75日以内に、去年までと同じ時期のくり返しはありません。</p>';
    const years = [...new Set(Q.S.items.map(x => String(x.y)))].sort((a, b) => b - a);
    h += '<div class="tsbar"><input type="search" id="yr_q" placeholder="さがす" value="' + esc(ui.q) + '" autocomplete="off"><button class="btn on" data-ya="add" style="white-space:nowrap">＋ ノートを足す</button></div>';
    h += '<div class="tsseg"><button class="btn' + (ui.y ? "" : " on") + '" data-ya="ysel" data-v="">すべて</button>' + years.map(y => '<button class="btn' + (ui.y === y ? " on" : "") + '" data-ya="ysel" data-v="' + y + '">' + y + "年度</button>").join("") + "</div>";
    return h + '<div id="yr_l">' + listH() + "</div>";
  };
  document.addEventListener("toggle", e => { const d = e.target; if (d && d.classList && d.classList.contains("ydet")) ui.open[d.dataset.ph] = d.open; }, true);
  document.addEventListener("click", e => {
    const t = e.target.closest && e.target.closest("[data-ya]"); if (!t || !Q.S) return;
    const a = t.dataset.ya, i = +t.dataset.i, it = Q.S.items[i];
    switch (a) {
      case "draft-drop": LS.del(DK); Q.ask = false; Q.draftP = null; Q.dirty = false; load(); return;
      case "draft-use": Q.S = mig(Q.draftP); Q.draftP = null; Q.ask = false; Q.dirty = true; save(); A.render(); return;
      case "reload": S.remoteGet(S.getSettings(), FILE).then(r => { Q.sha = r.sha; Q.S = mig(JSON.parse(r.text)); Q.conflict = false; Q.dirty = false; LS.del(DK); A.render(); }).catch(x => root.alert(S.explain(x))); return;
      case "ysel": ui.y = t.dataset.v; A.render(); return;
      case "import": importIt(t.dataset.id); return;
      case "add": { const d = J.ds(new Date()), nid = "y" + (uid++); Q.S.items.unshift({ id: nid, y: schoolYear(d), from: d, to: d, title: "新しいノート", body: "", again: "maybe", links: [], sp: [] }); ui.open[nid] = true; save(); A.render(); return; }
      case "del": if (it && root.confirm("このノートを消しますか？")) { Q.S.items.splice(i, 1); save(); A.render(); } return;
      case "sp-copy": { if (!it || !A.st) return; const f = it.from, to = it.to || it.from; const got = (A.st.days || []).filter(z => z.from <= to && (z.to || z.from) >= f); if (!got.length) { root.alert("この期間に重なる授業の特別日課が、いま開いている学期にありません。"); return; } it.sp = JSON.parse(JSON.stringify(got)); save(); A.render(); return; }
      case "sp-apply": { if (!it || !A.st || !A.st.term) return; const tm = A.st.term, ok = it.sp.filter(z => z.to >= tm.start && z.from <= tm.end); if (!ok.length) { root.alert("この特別日課の日付は、いま開いている学期（" + tm.name + "）の期間にありません。学期を切り替えてから押してください。"); return; } A.st.days = A.st.days || []; ok.forEach(z => A.st.days.push(Object.assign(JSON.parse(JSON.stringify(z)), { id: "z" + (uid++) }))); A.commit && A.commit(); root.alert(ok.length + "件を、授業の特別日課に入れました。"); return; }
    }
  });
  document.addEventListener("change", e => { const t = e.target; if (!t.dataset || t.dataset.ychg !== "again" || !Q.S) return; const it = Q.S.items[+t.dataset.i]; if (it) { it.again = t.value; save(); A.render(); } });
  document.addEventListener("input", e => {
    const t = e.target;
    if (t.id === "yr_q") { ui.q = t.value; const l = $("yr_l"); if (l) l.innerHTML = listH(); return; }
    const f = t.dataset && t.dataset.yf; if (!f || !Q.S) return; const it = Q.S.items[+t.dataset.i]; if (!it) return;
    if (f === "title") it.title = t.value; else if (f === "body") it.body = t.value; else if (f === "y") it.y = +t.value || it.y;
    else if (f === "from") { it.from = t.value; if (!it.to || it.to < it.from) it.to = it.from; } else if (f === "to") it.to = t.value;
    else if (f === "lt" || f === "lu") { const j = +t.dataset.j; while (it.links.length <= j) it.links.push({ t: "", u: "" }); it.links[j][f === "lt" ? "t" : "u"] = t.value; }
    save();
  });
  A.yearly.load = load; load();
})(window);
