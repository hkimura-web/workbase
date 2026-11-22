/* THE WORKBASE: 「AI使い分け」（校務 → AI使い分け）
 *  どのアカウントで何の作業をしているかを、「アカウントごと」と「作業ごと」の2つの見方で見る。
 *  無料枠が止まったアカウントは「止まった」を押すと、再開できる時刻まで「待ち」にして、いま使えるものを上に出す。
 *  データは校務のデータ（data/work.json の ai）に入る。メールアドレスは入れず、呼び名だけで管理する */
(function (root) {
  "use strict";
  const J = root.JD, A = root.A, esc = J.esc;
  const SV = [["claude", "Claude", "#d9824f"], ["gpt", "ChatGPT", "#3f9f78"], ["gem", "Gemini", "#4a82d8"], ["nb", "Gemini Notebook", "#8a6cc9"]];
  const SVN = k => (SV.find(s => s[0] === k) || SV[0]);
  const ST = [["making", "作成中"], ["using", "使用中"], ["done", "完成運用中"], ["unused", "未使用"], ["", "（なし）"]];
  const STN = k => (ST.find(s => s[0] === k) || ST[4])[1];
  const ui = { v: "acct", q: "", f: "", ed: null, na: null, ea: null, ns: null };
  A.ai = { ui };
  const M = () => A.work && A.work.mm;
  const D = () => {
    const S = M() && M().S(); if (!S) return null;
    if (!S.ai || !Array.isArray(S.ai.accts)) { S.ai = JSON.parse(JSON.stringify(root.AISEED || { v: 1, accts: [], jobs: [], cats: [], seq: 0 })); M().save(); }
    const d = S.ai; d.jobs = d.jobs || []; d.cats = d.cats || [];
    d.jobs.forEach(j => { j.e = fx(j.e); }); d.cats.forEach(c => { c.e = fx(c.e); }); d.seq = d.seq || d.jobs.length; return d;
  };
  const save = () => { M().save(); A.render(); };
  const nid = (d, p) => p + (++d.seq).toString(36) + Math.random().toString(36).slice(2, 4);
  const now = () => Date.now();
  const avail = a => !a.lim || a.lim <= now();
  const hm = t => { const x = new Date(t); return x.getHours() + ":" + String(x.getMinutes()).padStart(2, "0"); };
  const left = t => { const m = Math.max(1, Math.ceil((t - now()) / 60000)); return m >= 60 ? Math.floor(m / 60) + "時間" + (m % 60 ? m % 60 + "分" : "") : m + "分"; };
  const acctOf = (d, id) => d.accts.find(a => a.id === id);
  const catN = (d, e) => { const c = d.cats.find(x => x.e === e); return c ? c.n : "その他"; };
  const fx = e => (e === "\u270f" || e === "\u2702" ? e + "\ufe0f" : e);   /* ✏ ✂ は、絵（色つき）で出す */
  const nfkc = s => String(s || "").normalize("NFKC").toLowerCase();
  const chipS = (a) => { const s = SVN(a.s); return '<span class="aichip" style="--sc:' + s[2] + '">' + esc(s[1]) + "・" + esc(a.n) + "</span>"; };

  function jobMatch(d, j) {
    if (ui.f && j.st !== ui.f) return false;
    const q = nfkc(ui.q).split(/\s+/).filter(Boolean); if (!q.length) return true;
    const a = acctOf(d, j.a), hay = nfkc(j.t + " " + j.n + " " + (a ? SVN(a.s)[1] + a.n : ""));
    return q.every(t => hay.indexOf(t) >= 0);
  }
  const stChip = st => st ? '<span class="aist s-' + st + '">' + STN(st) + "</span>" : "";
  function docOpts(d, cur) {
    const S = M().S(); let o = '<option value="">（なし）</option>';
    const l = S.docs.map(x => ["work", x.id, x.t]).concat(A.memo && A.memo.otherDocs ? A.memo.otherDocs().map(x => [x.cat === "授業" ? "class" : "test", x.id, x.t]) : []);
    l.forEach(x => { const v = x[0] + ":" + x[1]; o += '<option value="' + esc(v) + '"' + (v === cur ? " selected" : "") + ">" + esc(x[2] || "（無題）") + "</option>"; });
    return o;
  }
  function acctOpts(d, cur) { return d.accts.map(a => '<option value="' + a.id + '"' + (a.id === cur ? " selected" : "") + ">" + esc(SVN(a.s)[1] + "・" + a.n) + "</option>").join(""); }
  function jobForm(d, j, isNew) {
    return '<div class="aiform" data-aiform="' + (isNew ? "new" : j.id) + '"><div class="aifh"><b>' + (isNew ? "作業を追加" : "作業を編集中") + '</b><button class="btn sm" data-ai="job-no" aria-label="閉じる">✕ 閉じる</button></div><div class="aigrid">' +
      '<label>分類<select id="ai_e">' + (d.cats.some(c => c.e === j.e) ? "" : '<option value="' + esc(j.e) + '" selected>' + esc(j.e + " その他") + "</option>") + d.cats.map(c => '<option value="' + esc(c.e) + '"' + (c.e === j.e ? " selected" : "") + ">" + esc(c.e + " " + c.n) + "</option>").join("") + "</select></label>" +
      '<label>状態<select id="ai_st">' + ST.map(s => '<option value="' + s[0] + '"' + (s[0] === j.st ? " selected" : "") + ">" + s[1] + "</option>").join("") + "</select></label>" +
      '<label class="w2">作業名<input type="text" id="ai_t" value="' + esc(j.t) + '" placeholder="例：定期試験（古典）問題作成（白波）"></label>' +
      '<label>アカウント<select id="ai_a">' + acctOpts(d, j.a) + "</select></label>" +
      '<label>プロンプト（手順・メモ）<select id="ai_d">' + docOpts(d, j.d || "") + "</select></label>" +
      '<label class="w2">ひとこと<input type="text" id="ai_n" value="' + esc(j.n) + '" placeholder="例：2027ルビチェック"></label></div>' +
      '<div class="aibtns"><button class="btn" data-ai="job-ok" data-id="' + (isNew ? "" : j.id) + '">保存</button><button class="btn" data-ai="job-no">閉じる（保存しない）</button>' +
      (isNew ? "" : '<span class="aisp"></span><select id="ai_cp" aria-label="別のアカウントにも作る"><option value="">別のアカウントにも作る…</option>' + acctOpts(d, "").replace(/<option value="/, '<option value="') + '</select><button class="btn" data-ai="job-cp" data-id="' + j.id + '">コピーを作る</button><button class="btn danger" data-ai="job-del" data-id="' + j.id + '">削除</button>') + "</div></div>";
  }
  function jobRow(d, j, i, byAcct) {
    if (ui.ed === j.id) return '<div class="aijob editing">' + jobForm(d, j, false) + "</div>";
    const a = acctOf(d, j.a), dd = j.d ? j.d.split(":") : null;
    return '<div class="aijob s-' + (j.st || "n") + '"><span class="aie">' + esc(j.e) + '</span><div class="aijt"><b>' + esc(j.t) + "</b> " + stChip(j.st) + (j.n ? '<span class="ainote">' + esc(j.n) + "</span>" : "") +
      (dd ? ' <button class="btn sm" data-ai="doc" data-s="' + esc(dd[0]) + '" data-id="' + esc(dd.slice(1).join(":")) + '">📄 プロンプト</button>' : "") +
      (byAcct ? "" : ' <span class="aiwho' + (a && !avail(a) ? " wait" : "") + '">' + (a ? chipS(a) : "") + "</span>") + "</div>" +
      '<span class="aimv">' + (byAcct ? '<button class="btn sm" data-ai="up" data-id="' + j.id + '" aria-label="上へ">▲</button><button class="btn sm" data-ai="dn" data-id="' + j.id + '" aria-label="下へ">▼</button>' : "") + '<button class="btn sm" data-ai="ed" data-id="' + j.id + '" aria-label="編集">編集</button></span></div>';
  }
  function acctCard(d, a) {
    const jobs = d.jobs.filter(j => j.a === a.id), shown = jobs.filter(j => jobMatch(d, j)), ok = avail(a);
    if ((ui.q || ui.f) && !shown.length) return "";
    const act = jobs.filter(j => j.st === "making").length;
    let h = '<div class="aicard' + (ok ? "" : " wait") + '" data-aid="' + a.id + '"><div class="aich">';
    if (ui.ea === a.id) {
      h += '<input type="text" id="ai_an" value="' + esc(a.n) + '" aria-label="呼び名"><label class="small">止まったときの待ち時間<input type="number" id="ai_ah" min="1" max="72" value="' + (a.h || 5) + '" style="width:60px"> 時間</label><button class="btn" data-ai="acct-ok" data-id="' + a.id + '">保存</button><button class="btn" data-ai="acct-no">✕ 閉じる</button><button class="btn danger" data-ai="acct-del" data-id="' + a.id + '">このアカウントを消す</button>';
    } else {
      h += '<b class="ain">' + esc(a.n) + '</b><span class="aistat ' + (ok ? "ok" : "wait") + '">' + (ok ? "● 使える" : "◌ 待ち　あと" + left(a.lim) + "（" + hm(a.lim) + "に再開）") + "</span>" +
        (act ? '<span class="aicnt">作成中 ' + act + "</span>" : "") + '<span class="aisp"></span>' +
        (ok ? '<button class="btn sm" data-ai="stop" data-id="' + a.id + '" title="無料枠が止まったとき。' + (a.h || 5) + '時間後に再開します">止まった（' + (a.h || 5) + "時間）</button>" : '<button class="btn sm" data-ai="go" data-id="' + a.id + '">使えるに戻す</button>') +
        '<button class="btn sm" data-ai="acct-ed" data-id="' + a.id + '">設定</button>';
    }
    h += "</div>";
    h += shown.map((j, i) => jobRow(d, j, i, true)).join("") || '<p class="note" style="margin:4px 8px">作業はまだありません。</p>';
    if (ui.na === a.id) h += '<div class="aijob editing">' + jobForm(d, { e: d.cats[0] ? d.cats[0].e : "📍", st: "making", t: "", a: a.id, n: "" }, true) + "</div>";
    else h += '<div class="aiadd"><button class="btn sm" data-ai="job-new" data-id="' + a.id + '">＋ 作業を追加</button></div>';
    return h + "</div>";
  }
  function nowStrip(d) {
    return '<div class="ainow"><div class="ainh"><b>アカウントの状態</b><span class="note"><span class="aip ok">● 使える</span> <span class="aip wait">◌ 待ち（再開時刻〜）</span>　止まったアカウントは、下の各アカウントの「止まった」で切り替えます</span></div>' + SV.map(s => {
      const l = d.accts.filter(a => a.s === s[0]); if (!l.length) return "";
      return '<div class="ainr"><b style="color:' + s[2] + '">' + s[1] + "</b>" + l.map(a => avail(a) ? '<span class="aip ok">● ' + esc(a.n) + "</span>" : '<span class="aip wait">◌ ' + esc(a.n) + "（" + hm(a.lim) + "〜）</span>").join("") + "</div>";
    }).join("") + "</div>";
  }
  function viewAcct(d) {
    return SV.map(s => {
      const l = d.accts.filter(a => a.s === s[0]); if (!l.length && s[0] === "nb") return "";
      const cards = l.map(a => acctCard(d, a)).join("");
      return '<section class="aisec"><h3 style="--sc:' + s[2] + '"><span class="aidot"></span>' + s[1] + '</h3>' + cards +
        (ui.ns === s[0] ? '<div class="aiform"><input type="text" id="ai_nn" placeholder="呼び名（例：学校、予備1）"><button class="btn" data-ai="acct-add" data-s="' + s[0] + '">追加</button><button class="btn ghost" data-ai="acct-no">やめる</button></div>' : '<button class="btn sm ghost" data-ai="acct-new" data-s="' + s[0] + '">＋ ' + s[1] + "のアカウントを追加</button>") + "</section>";
    }).join("");
  }
  function viewJob(d) {
    const l = d.jobs.filter(j => jobMatch(d, j)); if (!l.length) return '<p class="note">見つかりません。</p>';
    const keys = d.cats.map(c => c.e), g = {}; l.forEach(j => { const k = keys.includes(j.e) ? j.e : "_"; (g[k] = g[k] || []).push(j); });
    return keys.concat(["_"]).filter(k => g[k]).map(k => '<section class="aisec"><h3><span class="aie">' + (k === "_" ? "・" : esc(k)) + "</span>" + esc(k === "_" ? "その他" : catN(d, k)) + ' <span class="note">' + g[k].length + "件</span></h3>" +
      g[k].slice().sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0)).map((j, i) => jobRow(d, j, i, false)).join("") + "</section>").join("");
  }
  const EMOJIS = ["🔴", "🟥", "🟠", "🟡", "🟢", "🔵", "🟣", "🟦", "🟪", "⚫", "✏️", "📍", "✂️", "📱", "💛", "🐽", "📝", "📚", "💻", "📊", "🎓", "🏃", "📌", "⭐", "🔥", "💡", "📧", "🗂️"];
  function catMgr(d) {
    const n = d.cats.length;
    return '<details class="wdet aicm" id="aicm"' + (ui.cmo ? " open" : "") + '><summary><b>分類を編集する（マーク・名前・並び順・追加・削除）</b></summary><datalist id="ai_emo">' + EMOJIS.map(e => '<option value="' + e + '"></option>').join("") + "</datalist>" +
      '<div class="aicl">' + d.cats.map((c, i) => '<div class="aicr"><input type="text" class="aice" data-aice="' + i + '" value="' + esc(c.e) + '" list="ai_emo" maxlength="8" aria-label="マーク" title="マーク（絵文字）。入力するか、候補から選べます"><input type="text" class="aicn" data-aicn="' + i + '" value="' + esc(c.n) + '" aria-label="分類の名前"><span class="aimv"><button class="btn sm" data-ai="cat-up" data-i="' + i + '"' + (i === 0 ? " disabled" : "") + ' aria-label="上へ">▲</button><button class="btn sm" data-ai="cat-dn" data-i="' + i + '"' + (i >= n - 1 ? " disabled" : "") + ' aria-label="下へ">▼</button><button class="btn sm danger" data-ai="cat-del" data-i="' + i + '">削除</button></span></div>').join("") + "</div>" +
      '<div class="aicr aicadd"><input type="text" class="aice" id="ai_ne" list="ai_emo" maxlength="8" placeholder="マーク" aria-label="新しい分類のマーク"><input type="text" class="aicn" id="ai_nn2" placeholder="新しい分類の名前"><button class="btn" data-ai="cat-add">＋ 分類を追加</button></div>' +
      '<p class="note" style="margin:6px 0 0">マークを変えると、その分類の作業も新しいマークに変わります。分類を削除した作業は「その他」に入ります（作業は消えません）。</p></details>';
  }
  A.ai.view = function () {
    const d = D(); if (!d) return '<p class="note">読み込んでいます…</p>';
    const nWait = d.accts.filter(a => !avail(a)).length;
    return '<div class="aihead"><div class="seg"><button data-ai="v" data-v="acct" aria-pressed="' + (ui.v === "acct") + '">アカウントごと</button><button data-ai="v" data-v="job" aria-pressed="' + (ui.v === "job") + '">作業ごと</button></div>' +
      '<input type="search" id="aiq" class="lq" placeholder="さがす（作業名・アカウント）" value="' + esc(ui.q) + '" autocomplete="off"><select id="aif" aria-label="状態で絞る"><option value="">状態：すべて</option>' + ST.slice(0, 4).map(s => '<option value="' + s[0] + '"' + (ui.f === s[0] ? " selected" : "") + ">" + s[1] + "</option>").join("") + "</select></div>" +
      nowStrip(d) + (ui.v === "acct" ? viewAcct(d) : viewJob(d)) + catMgr(d) +
      '<p class="note">メールアドレスは入れず、呼び名だけで管理します（このデータは公開のGitHubに入るため）。待ち時間はアカウントごとに「設定」で変えられます。' + (nWait ? "いま待ちのアカウント：" + nWait : "") + "</p>";
  };
  /* トップページの細い帯（重要Tipsと今朝のまとめの間）。押すとAIのページが開く */
  A.ai.band = function () {
    const d = D(); if (!d || !d.accts.length) return "";
    const mk = d.jobs.filter(j => j.st === "making").length;
    const rows = SV.map(s => {
      const l = d.accts.filter(a => a.s === s[0]); if (!l.length) return "";
      return '<div class="ainr"><b style="color:' + s[2] + '">' + s[1] + "</b>" + l.map(a => avail(a) ? '<span class="aip ok">● ' + esc(a.n) + "</span>" : '<span class="aip wait">◌ ' + esc(a.n) + "（" + hm(a.lim) + "〜）</span>").join("") + "</div>";
    }).join("");
    return '<section class="panel p-ai"><header class="panel-h"><h2>AIアカウント</h2><span class="panel-n">' + (mk ? "作成中 " + mk + "件" : "") + '</span></header><div class="panel-b aibandb" data-side="work:ai" title="AI使い分けを開く" role="link" tabindex="0">' + rows + "</div></section>";
  };
  A.ai.counts = () => { const d = D(); return d ? { making: d.jobs.filter(j => j.st === "making").length, ok: d.accts.filter(avail).length, all: d.accts.length } : null; };

  const val = id => { const e = document.getElementById(id); return e ? e.value : ""; };
  document.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest("[data-ai]"); if (!b) return;
    const d = D(); if (!d) return; const a = b.dataset.ai, id = b.dataset.id, jobAt = () => d.jobs.findIndex(j => j.id === id);
    if (a === "v") { ui.v = b.dataset.v; return A.render(); }
    if (a === "ed") { ui.ed = id; ui.na = null; return A.render(); }
    if (a === "job-no") { ui.ed = null; ui.na = null; return A.render(); }
    if (a === "job-new") { ui.na = id; ui.ed = null; return A.render(); }
    if (a === "job-ok") {
      const t = val("ai_t").trim(); if (!t) { A.toast && A.toast("作業名を入れてください"); return; }
      const f = { e: val("ai_e"), st: val("ai_st"), t, a: val("ai_a"), n: val("ai_n").trim(), d: val("ai_d") };
      if (!f.d) delete f.d;
      if (id) { const j = d.jobs[jobAt()]; if (j) { Object.keys(j).forEach(k => { if (k !== "id") delete j[k]; }); Object.assign(j, f); } } else d.jobs.push(Object.assign({ id: nid(d, "j") }, f));
      ui.ed = null; ui.na = null; return save();
    }
    if (a === "job-del") { const i = jobAt(); if (i >= 0 && root.confirm("「" + d.jobs[i].t + "」を削除しますか？")) { d.jobs.splice(i, 1); ui.ed = null; save(); } return; }
    if (a === "job-cp") {
      const to = val("ai_cp"), j = d.jobs[jobAt()]; if (!to || !j) { A.toast && A.toast("コピー先のアカウントを選んでください"); return; }
      const c = Object.assign({}, j, { id: nid(d, "j"), a: to, st: "making" }); d.jobs.splice(jobAt() + 1, 0, c); ui.ed = null; A.toast && A.toast("コピーを作りました（状態は「作成中」）"); return save();
    }
    if (a === "up" || a === "dn") {
      const i = jobAt(); if (i < 0) return; const aid = d.jobs[i].a, step = a === "up" ? -1 : 1;
      let k = i + step; while (k >= 0 && k < d.jobs.length && d.jobs[k].a !== aid) k += step;
      if (k < 0 || k >= d.jobs.length) return; const t = d.jobs[i]; d.jobs[i] = d.jobs[k]; d.jobs[k] = t; return save();
    }
    if (a === "stop") { const x = acctOf(d, id); if (x) { x.lim = now() + (x.h || 5) * 3600000; save(); } return; }
    if (a === "go") { const x = acctOf(d, id); if (x) { x.lim = 0; save(); } return; }
    if (a === "acct-ed") { ui.ea = id; return A.render(); }
    if (a === "acct-no") { ui.ea = null; ui.ns = null; return A.render(); }
    if (a === "acct-ok") { const x = acctOf(d, id); if (x) { const n = val("ai_an").trim(); if (n) x.n = n; x.h = Math.max(1, Math.min(72, +val("ai_ah") || 5)); } ui.ea = null; return save(); }
    if (a === "acct-del") { const x = acctOf(d, id), n = d.jobs.filter(j => j.a === id).length; if (x && root.confirm("アカウント「" + x.n + "」を消します。" + (n ? "中の作業 " + n + " 件も消えます。" : "") + "よろしいですか？")) { d.accts = d.accts.filter(y => y.id !== id); d.jobs = d.jobs.filter(j => j.a !== id); ui.ea = null; save(); } return; }
    if (a === "acct-new") { ui.ns = b.dataset.s; return A.render(); }
    if (a === "acct-add") { const n = val("ai_nn").trim(); if (!n) return; d.accts.push({ id: nid(d, "a"), s: b.dataset.s, n, h: b.dataset.s === "claude" || b.dataset.s === "gpt" ? 5 : 24, lim: 0 }); ui.ns = null; return save(); }
    if (a === "cat-add") {
      const e = fx(val("ai_ne").trim()), n = val("ai_nn2").trim(); if (!e || !n) { A.toast && A.toast("マークと名前を入れてください"); return; }
      if (d.cats.some(c => c.e === e)) { A.toast && A.toast("そのマークはもう使われています"); return; }
      d.cats.push({ e, n }); ui.cmo = true; return save();
    }
    if (a === "cat-up" || a === "cat-dn") { const i = +b.dataset.i, k = i + (a === "cat-up" ? -1 : 1); if (k < 0 || k >= d.cats.length) return; const t = d.cats[i]; d.cats[i] = d.cats[k]; d.cats[k] = t; ui.cmo = true; return save(); }
    if (a === "cat-del") { const c = d.cats[+b.dataset.i], n = c ? d.jobs.filter(j => j.e === c.e).length : 0; if (c && root.confirm("分類「" + c.e + " " + c.n + "」を削除します。" + (n ? "この分類の作業 " + n + " 件は「その他」に入ります。" : "") + "よろしいですか？")) { d.cats.splice(+b.dataset.i, 1); ui.cmo = true; save(); } return; }
    if (a === "doc") { if (A.memo && A.memo.openDoc) A.memo.openDoc(b.dataset.s, id, false); return; }
  });
  document.addEventListener("toggle", e => { if (e.target && e.target.id === "aicm") ui.cmo = e.target.open; }, true);
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && (ui.ed || ui.na || ui.ea || ui.ns) && A.ui.mode === "work" && A.ui.work.tab === "ai") { ui.ed = ui.na = ui.ea = ui.ns = null; A.render(); }
  });
  document.addEventListener("input", e => {
    const t = e.target; if (!t || !t.id) return;
    if (t.id === "aiq") { ui.q = t.value; const p = t.selectionStart; A.render(); const n = document.getElementById("aiq"); if (n) { n.focus(); try { n.setSelectionRange(p, p); } catch (x) { /* 位置は戻せなくてもよい */ } } }
  });
  document.addEventListener("change", e => {
    const t = e.target; if (!t) return;
    if (t.id === "aif") { ui.f = t.value; A.render(); return; }
    if (t.dataset && t.dataset.aicn !== undefined) { const d = D(), c = d && d.cats[+t.dataset.aicn]; if (c && t.value.trim()) { c.n = t.value.trim(); ui.cmo = true; save(); } return; }
    if (t.dataset && t.dataset.aice !== undefined) {
      const d = D(), c = d && d.cats[+t.dataset.aice], e = fx(t.value.trim()); if (!c) return;
      if (!e || d.cats.some((x, i) => i !== +t.dataset.aice && x.e === e)) { A.toast && A.toast(e ? "そのマークはもう使われています" : "マークを入れてください"); ui.cmo = true; A.render(); return; }
      d.jobs.forEach(j => { if (j.e === c.e) j.e = e; }); c.e = e; ui.cmo = true; save();
    }
  });
  setInterval(() => {
    if (document.hidden || !A.ui || A.ui.mode !== "work" || A.ui.work.tab !== "ai") return;
    if (ui.ed || ui.na || ui.ea || ui.ns || document.querySelector("dialog[open]") || (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) return;
    A.render();
  }, 60000);
})(window);
