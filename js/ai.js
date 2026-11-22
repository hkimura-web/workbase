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
  const ui = { v: "acct", q: "", f: "", ed: null, na: null, ea: null, ns: null, sa: null };
  A.ai = { ui };
  const M = () => A.work && A.work.mm;
  const D = () => {
    const S = M() && M().S(); if (!S) return null;
    if (!S.ai || !Array.isArray(S.ai.accts)) { S.ai = JSON.parse(JSON.stringify(root.AISEED || { v: 1, accts: [], jobs: [], cats: [], seq: 0 })); M().save(); }
    const d = S.ai; d.jobs = d.jobs || []; d.cats = d.cats || [];
    if ((d.cv || 0) < 2) {   /* 一度だけ: 最初の仮の名前のままの種類を、使い方に合わせた名前にする */
      const rn = { "🔵": ["進路・面談・校務", "クラス関係"], "🟢": ["アプリ・シート", "国語科・教科"], "🟣": ["部活・事務", "部活"] };
      d.cats.forEach(c => { const r = rn[c.e]; if (r && c.n === r[0]) c.n = r[1]; });
      d.cats.forEach(c => { if (c.e === "🟦" && c.n === "総合型選抜") c.n = "総合型選抜"; }); d.cv = 2;
    }
    d.jobs.forEach(j => { j.e = fx(j.e); }); d.cats.forEach(c => { c.e = fx(c.e); }); d.seq = d.seq || d.jobs.length; return d;
  };
  const save = () => { M().save(); A.render(); };
  const nid = (d, p) => p + (++d.seq).toString(36) + Math.random().toString(36).slice(2, 4);
  const now = () => Date.now();
  const avail = a => !a.lim || a.lim <= now();
  const hm = t => { const x = new Date(t); return x.getHours() + ":" + String(x.getMinutes()).padStart(2, "0"); };
  const dkey = t => { const x = new Date(t); return x.getFullYear() * 400 + x.getMonth() * 31 + x.getDate(); };
  const when = t => { const x = new Date(t), dd = dkey(t) - dkey(now()); return (dd === 0 ? "" : dd === 1 ? "明日 " : (x.getMonth() + 1) + "/" + x.getDate() + " ") + hm(t); };
  const left = t => { const m = Math.max(1, Math.ceil((t - now()) / 60000)); return m >= 60 ? Math.floor(m / 60) + "時間" + (m % 60 ? m % 60 + "分" : "") : m + "分"; };
  const prOf = (d, id) => (d.prompts || []).find(x => x.id === id);
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
    let o = '<option value="">（なし）</option>';
    (d.prompts || []).slice().sort((a, b) => (a.t < b.t ? -1 : 1)).forEach(x => { const v = "p:" + x.id; o += '<option value="' + esc(v) + '"' + (v === cur ? " selected" : "") + ">" + esc(x.t || "（無題）") + "</option>"; });
    if (cur && cur.indexOf("p:") !== 0) {   /* 前につないだ「手順・メモ」は、そのまま残す */
      const S = M().S(), k = cur.split(":"), doc = k[0] === "work" ? S.docs.find(x => x.id === k.slice(1).join(":")) : null;
      o += '<option value="' + esc(cur) + '" selected>手順メモ：' + esc(doc ? doc.t : "（つないだメモ）") + "</option>";
    }
    return o;
  }
  function docOptsOld(d, cur) {
    const S = M().S(); let o = '<option value="">（なし）</option>';
    const l = S.docs.map(x => ["work", x.id, x.t]).concat(A.memo && A.memo.otherDocs ? A.memo.otherDocs().map(x => [x.cat === "授業" ? "class" : "test", x.id, x.t]) : []);
    l.forEach(x => { const v = x[0] + ":" + x[1]; o += '<option value="' + esc(v) + '"' + (v === cur ? " selected" : "") + ">" + esc(x[2] || "（無題）") + "</option>"; });
    return o;
  }
  function acctOpts(d, cur) { return d.accts.map(a => '<option value="' + a.id + '"' + (a.id === cur ? " selected" : "") + ">" + esc(SVN(a.s)[1] + "・" + a.n) + "</option>").join(""); }
  function jobForm(d, j, isNew) {
    return '<div class="aiform" data-aiform="' + (isNew ? "new" : j.id) + '"><div class="aifh"><b>' + (isNew ? "作業を追加" : "作業を編集中") + '</b><button class="btn sm" data-ai="job-no" aria-label="閉じる">✕ 閉じる</button></div><div class="aigrid">' +
      '<label>作業の種類<select id="ai_e">' + (d.cats.some(c => c.e === j.e) ? "" : '<option value="' + esc(j.e) + '" selected>' + esc(j.e + " その他") + "</option>") + d.cats.map(c => '<option value="' + esc(c.e) + '"' + (c.e === j.e ? " selected" : "") + ">" + esc(c.e + " " + c.n) + "</option>").join("") + "</select></label>" +
      '<label>状態<select id="ai_st">' + ST.map(s => '<option value="' + s[0] + '"' + (s[0] === j.st ? " selected" : "") + ">" + s[1] + "</option>").join("") + "</select></label>" +
      '<label class="w2">作業名<input type="text" id="ai_t" value="' + esc(j.t) + '" placeholder="例：定期試験（古典）問題作成（白波）"></label>' +
      '<label>アカウント<select id="ai_a">' + acctOpts(d, j.a) + "</select></label>" +
      '<label>プロンプト（プロンプト集から選ぶ）<select id="ai_d">' + docOpts(d, j.pr ? "p:" + j.pr : (j.d || "")) + "</select></label>" +
      '<label class="w2">ひとこと<input type="text" id="ai_n" value="' + esc(j.n) + '" placeholder="例：2027ルビチェック"></label></div>' +
      '<div class="aibtns"><button class="btn" data-ai="job-ok" data-id="' + (isNew ? "" : j.id) + '">保存</button><button class="btn" data-ai="job-no">閉じる（保存しない）</button>' +
      (isNew ? "" : '<span class="aisp"></span><select id="ai_cp" aria-label="別のアカウントにも作る"><option value="">別のアカウントにも作る…</option>' + acctOpts(d, "").replace(/<option value="/, '<option value="') + '</select><button class="btn" data-ai="job-cp" data-id="' + j.id + '">コピーを作る</button><button class="btn danger" data-ai="job-del" data-id="' + j.id + '">削除</button>') + "</div></div>";
  }
  function jobRow(d, j, i, byAcct) {
    if (ui.ed === j.id) return '<div class="aijob editing">' + jobForm(d, j, false) + "</div>";
    const a = acctOf(d, j.a), dd = j.d ? j.d.split(":") : null;
    return '<div class="aijob s-' + (j.st || "n") + '"><span class="aie">' + esc(j.e) + '</span><div class="aijt"><b>' + esc(j.t) + "</b> " + stChip(j.st) + (j.n ? '<span class="ainote">' + esc(j.n) + "</span>" : "") +
      (j.pr && prOf(d, j.pr) ? ' <button class="btn sm" data-ai="pr-go" data-id="' + j.pr + '">📄 プロンプト</button><button class="btn sm" data-ai="pr-copy" data-id="' + j.pr + '">コピー</button>' : "") + (dd ? ' <button class="btn sm" data-ai="doc" data-s="' + esc(dd[0]) + '" data-id="' + esc(dd.slice(1).join(":")) + '">📄 プロンプト</button>' : "") +
      (byAcct ? "" : ' <span class="aiwho' + (a && !avail(a) ? " wait" : "") + '">' + (a ? chipS(a) : "") + "</span>") + "</div>" +
      '<span class="aimv">' + (byAcct ? '<button class="btn sm" data-ai="up" data-id="' + j.id + '" aria-label="上へ">▲</button><button class="btn sm" data-ai="dn" data-id="' + j.id + '" aria-label="下へ">▼</button>' : "") + '<button class="btn sm" data-ai="ed" data-id="' + j.id + '" aria-label="編集">編集</button></span></div>';
  }
  function acctCard(d, a) {
    const jobs = d.jobs.filter(j => j.a === a.id), shown = jobs.filter(j => jobMatch(d, j)), ok = avail(a);
    if ((ui.q || ui.f) && !shown.length) return "";
    const act = jobs.filter(j => j.st === "making").length;
    const col = !!ui.cl[a.id] && ui.ea !== a.id && ui.sa !== a.id;
    let h = '<div class="aicard' + (ok ? "" : " wait") + (col ? " col" : "") + '" data-aid="' + a.id + '"><div class="aich' + (ui.ea === a.id || ui.sa === a.id ? "" : " aitog") + '"' + (ui.ea === a.id || ui.sa === a.id ? "" : ' data-ai="cl" data-id="' + a.id + '" role="button" tabindex="0" aria-expanded="' + !col + '"') + ">";
    if (ui.sa === a.id) {
      const dv = new Date(ok ? now() + (a.h || 5) * 3600000 : a.lim);
      h += '<b class="ain">' + esc(a.n) + '</b><label class="small">次に使える時刻<input type="time" id="ai_stt" value="' + String(dv.getHours()).padStart(2, "0") + ":" + String(dv.getMinutes()).padStart(2, "0") + '"></label><button class="btn" data-ai="stop-ok" data-id="' + a.id + '">この時刻に決定</button><button class="btn" data-ai="stop-no">✕ 閉じる</button><span class="note">いまより前の時刻は、明日の時刻になります</span>';
    } else if (ui.ea === a.id) {
      h += '<input type="text" id="ai_an" value="' + esc(a.n) + '" aria-label="呼び名"><label class="small">止まったとき、時刻の初めの案（何時間後）<input type="number" id="ai_ah" min="1" max="72" value="' + (a.h || 5) + '" style="width:60px"> 時間</label><button class="btn" data-ai="acct-ok" data-id="' + a.id + '">保存</button><button class="btn" data-ai="acct-no">✕ 閉じる</button><button class="btn danger" data-ai="acct-del" data-id="' + a.id + '">このアカウントを消す</button>';
    } else {
      h += '<span class="aichev">' + (col ? "▸" : "▾") + '</span><b class="ain">' + esc(a.n) + '</b><span class="aistat ' + (ok ? "ok" : "wait") + '">' + (ok ? "● 使える" : "◌ " + when(a.lim) + " から使える（あと" + left(a.lim) + "）") + "</span>" +
        (act ? '<span class="aicnt">作成中 ' + act + "</span>" : "") + (col ? '<span class="note">作業 ' + jobs.length + "件</span>" : "") + '<span class="aisp"></span>' +
        (ok ? '<button class="btn sm" data-ai="stop" data-id="' + a.id + '" title="無料枠が止まったとき。使える時刻を決めます">止まった</button>' : '<button class="btn sm" data-ai="stop" data-id="' + a.id + '">時刻を変える</button><button class="btn sm" data-ai="go" data-id="' + a.id + '">使えるに戻す</button>') +
        '<button class="btn sm" data-ai="acct-ed" data-id="' + a.id + '">設定</button>';
    }
    h += "</div>";
    if (col) return h + "</div>";
    h += shown.map((j, i) => jobRow(d, j, i, true)).join("") || '<p class="note" style="margin:4px 8px">作業はまだありません。</p>';
    if (ui.na === a.id) h += '<div class="aijob editing">' + jobForm(d, { e: d.cats[0] ? d.cats[0].e : "📍", st: "making", t: "", a: a.id, n: "" }, true) + "</div>";
    else h += '<div class="aiadd"><button class="btn sm" data-ai="job-new" data-id="' + a.id + '">＋ 作業を追加</button></div>';
    return h + "</div>";
  }
  function nowStrip(d) {
    return '<div class="ainow"><div class="ainh"><b>アカウントの状態</b><span class="note"><span class="aip ok">● 使える</span> <span class="aip wait">◌ 待ち（再開時刻〜）</span>　名前を押すと、そのアカウントの場所に移ります</span></div>' + SV.map(s => {
      const l = d.accts.filter(a => a.s === s[0]); if (!l.length) return "";
      return '<div class="ainr"><b style="color:' + s[2] + '">' + s[1] + "</b>" + l.map(a => avail(a) ? '<button class="aip ok" data-ai="jump" data-id="' + a.id + '" title="このアカウントの場所へ">● ' + esc(a.n) + "</button>" : '<button class="aip wait" data-ai="jump" data-id="' + a.id + '" title="このアカウントの場所へ">◌ ' + esc(a.n) + "（" + when(a.lim) + "〜）</button>").join("") + "</div>";
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
    return keys.concat(["_"]).filter(k => g[k]).map(k => { const id = "j:" + k, col = !!ui.cl[id];
      return '<div class="aicard' + (col ? " col" : "") + '"><div class="aich aitog" data-ai="cl" data-id="' + esc(id) + '" role="button" tabindex="0" aria-expanded="' + !col + '"><span class="aichev">' + (col ? "▸" : "▾") + '</span><span class="aie">' + (k === "_" ? "・" : esc(k)) + '</span><b class="ain">' + esc(k === "_" ? "その他" : catN(d, k)) + '</b><span class="note">' + g[k].length + "件</span></div>" +
        (col ? "" : g[k].slice().sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0)).map((j, i) => jobRow(d, j, i, false)).join("")) + "</div>"; }).join("");
  }
  const EMOJIS = ["🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "⚫", "⚪", "🟥", "🟧", "🟨", "🟩", "🟦", "🟪", "⬛", "⬜", "✏️", "📍", "✂️", "📱", "💛", "🐽", "📝", "📚", "💻", "📊", "🎓", "🏃", "📌", "⭐", "🔥", "💡", "📧", "🗂️", "🏫", "👥", "📅", "🔍", "🎯", "🧪"];
  const palette = (id) => '<div class="aipal" data-pal="' + id + '"><span class="note">マークを選んでください</span><div class="aipg">' + EMOJIS.map(e => '<button type="button" class="aipb" data-ai="cat-set" data-i="' + id + '" data-e="' + e + '">' + e + "</button>").join("") + '</div><label class="small">一覧にないマーク：<input type="text" class="aice" data-aice-free="' + id + '" maxlength="8" placeholder="貼り付け" style="width:70px"> <button type="button" class="btn sm" data-ai="cat-free" data-i="' + id + '">これにする</button></label><button type="button" class="btn sm" data-ai="cat-pk" data-i="-1">閉じる</button></div>';
  /* 作業の種類の設定画面（ページの上に開く） */
  function catMgr(d) {
    if (!ui.cm) return "";
    const n = d.cats.length;
    let h = '<section class="aiset"><div class="aifh"><b>作業の種類の設定</b><button class="btn sm" data-ai="cm-tog">✕ 閉じる</button></div>' +
      '<p class="note" style="margin:0 0 8px">作業を分けるグループを、「マーク」と「名前」のセットで決めます。マークを押すと選べます。名前の欄に、そのまま書いて直せます。</p>' +
      '<div class="aicl"><div class="aicr aich2"><span class="aice">マーク</span><span class="aicn">名前（ここを書き換え）</span><span class="aicnt2">作業数</span><span class="aimv">並び順・削除</span></div>';
    d.cats.forEach((c, i) => {
      h += '<div class="aicr"><button type="button" class="aice aipick" data-ai="cat-pk" data-i="' + i + '" title="押してマークを選ぶ">' + esc(c.e) + '</button><input type="text" class="aicn" data-aicn="' + i + '" value="' + esc(c.n) + '" aria-label="名前"><span class="aicnt2">' + d.jobs.filter(j => j.e === c.e).length + '件</span><span class="aimv"><button class="btn sm" data-ai="cat-up" data-i="' + i + '"' + (i === 0 ? " disabled" : "") + ' aria-label="上へ">▲</button><button class="btn sm" data-ai="cat-dn" data-i="' + i + '"' + (i >= n - 1 ? " disabled" : "") + ' aria-label="下へ">▼</button><button class="btn sm danger" data-ai="cat-del" data-i="' + i + '">削除</button></span></div>';
      if (ui.cp === String(i)) h += palette(i);
    });
    h += '<div class="aicr aicadd"><button type="button" class="aice aipick" data-ai="cat-pk" data-i="new" title="押してマークを選ぶ">' + esc(ui.ne || "＋") + '</button><input type="text" class="aicn" id="ai_nn2" value="' + esc(ui.nn || "") + '" placeholder="新しい種類の名前（例：クラス関係）"><button class="btn" data-ai="cat-add">＋ 種類を追加</button></div>';
    if (ui.cp === "new") h += palette("new");
    return h + '</div><p class="note" style="margin:6px 0 0">マークを変えると、その種類の作業も新しいマークに変わります。種類を削除した作業は「その他」に入ります（作業は消えません）。</p></section>';
  }
  /* ---------- プロンプト集 ---------- */
  const htmlText = h => { const e = document.createElement("div"); e.innerHTML = String(h || "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h\d)>/gi, "\n"); return e.textContent.replace(/\n{3,}/g, "\n\n").trim(); };
  const dstr = t => { if (!t) return ""; const x = new Date(t); return x.getFullYear() + "/" + (x.getMonth() + 1) + "/" + x.getDate(); };
  function copyText(text) {
    const ok = () => A.toast && A.toast("コピーしました");
    if (root.navigator && navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, () => fallback());
    else fallback();
    function fallback() { const t = document.createElement("textarea"); t.value = text; t.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); ok(); } catch (e) { A.toast && A.toast("コピーできませんでした"); } t.remove(); }
  }
  function prForm(d, p, isNew) {
    const docs = M().S().docs.map(x => '<option value="' + esc(x.id) + '">' + esc(x.t || "（無題）") + "</option>").join("");
    return '<div class="aiform aiprf"><div class="aifh"><b>' + (isNew ? "新しいプロンプト" : "プロンプトを編集中") + '</b><button class="btn sm" data-ai="pr-no">✕ 閉じる</button></div>' +
      '<div class="aigrid"><label class="w2">題名<input type="text" id="pr_t" value="' + esc(p.t) + '" placeholder="例：定期試験（古典）問題作成"></label>' +
      '<label>作業の種類<select id="pr_e">' + (d.cats.some(c => c.e === p.e) ? "" : '<option value="' + esc(p.e) + '" selected>' + esc(p.e + " その他") + "</option>") + d.cats.map(c => '<option value="' + esc(c.e) + '"' + (c.e === p.e ? " selected" : "") + ">" + esc(c.e + " " + c.n) + "</option>").join("") + "</select></label></div>" +
      '<label class="small" style="display:block;margin-top:8px">説明（使い方・添付するファイルなど。AIには貼りません）<textarea id="pr_m" rows="7" class="aipta aipm" placeholder="例：このプロンプトは、教科書本文のPDFと、前回の問題のWordを添付して使います。">' + esc(p.m || "") + "</textarea></label>" +
      '<label class="small" style="display:block;margin-top:8px">本文（AIに貼る文章）<textarea id="pr_b" rows="14" class="aipta" placeholder="ここにプロンプトを貼り付けます">' + esc(p.b) + "</textarea></label>" +
      '<div class="aibtns"><button class="btn" data-ai="pr-ok" data-id="' + (isNew ? "" : p.id) + '">保存</button><button class="btn" data-ai="pr-no">閉じる（保存しない）</button>' +
      (isNew ? '<span class="aisp"></span><select id="pr_imp" aria-label="手順・メモから取り込む"><option value="">手順・メモから取り込む…</option>' + docs + '</select><button class="btn" data-ai="pr-imp">取り込む</button>' : '<span class="aisp"></span><button class="btn danger" data-ai="pr-del" data-id="' + p.id + '">削除</button>') + "</div></div>";
  }
  function viewPr(d) {
    d.prompts = d.prompts || [];
    const q = nfkc(ui.q).split(/\s+/).filter(Boolean), l = d.prompts.filter(p => (!ui.pf || p.e === ui.pf) && q.every(t => nfkc(p.t + " " + p.b + " " + (p.m || "")).indexOf(t) >= 0));
    let h = '<div class="aihead" style="margin-top:-2px"><button class="btn" data-ai="pr-new">＋ 新しいプロンプト</button><button class="btn" data-ai="pr-all" data-v="1">すべて開く</button><button class="btn" data-ai="pr-all" data-v="0">すべて閉じる</button><select id="aipf" aria-label="種類で絞る"><option value="">種類：すべて</option>' + d.cats.map(c => '<option value="' + esc(c.e) + '"' + (ui.pf === c.e ? " selected" : "") + ">" + esc(c.e + " " + c.n) + "</option>").join("") + "</select></div>";
    if (ui.pe === "new") h += '<div class="aicard aipc">' + prForm(d, ui.pd || { t: "", b: "", e: d.cats[0] ? d.cats[0].e : "📍" }, true) + "</div>";
    if (!l.length && ui.pe !== "new") return h + '<p class="note">' + (d.prompts.length ? "見つかりません。" : "まだプロンプトがありません。「＋ 新しいプロンプト」から入れてください。") + "</p>";
    const card = p => {
      if (ui.pe === p.id) return '<div class="aicard aipc" data-pid="' + p.id + '">' + prForm(d, p, false) + "</div>";
      const used = d.jobs.filter(j => j.pr === p.id).length, open = !!(ui.po && ui.po[p.id]);
      return '<div class="aicard aipc' + (open ? "" : " col") + (ui.pj === p.id ? " flash" : "") + '" data-pid="' + p.id + '"><div class="aich aitog" data-ai="pr-tog" data-id="' + p.id + '" role="button" tabindex="0" aria-expanded="' + open + '"><span class="aichev">' + (open ? "▾" : "▸") + '</span><span class="aie">' + esc(p.e) + '</span><b class="ain">' + esc(p.t || "（無題）") + "</b>" + (used ? '<span class="aicnt">使っている作業 ' + used + "件</span>" : "") + '<span class="note">' + (p.u ? "更新 " + dstr(p.u) : "") + '</span><span class="aisp"></span><button class="btn sm" data-ai="pr-copy" data-id="' + p.id + '">コピー</button><button class="btn sm" data-ai="pr-ed" data-id="' + p.id + '">編集</button></div>' +
        (open ? (p.m ? '<div class="aipm-v">' + esc(p.m) + "</div>" : "") + '<pre class="aipre open">' + esc(p.b) + "</pre>" : "") + "</div>";
    };
    /* 作業の種類ごと（種類の設定の順）に分けて、種類ごとに閉じられる */
    const keys = d.cats.map(c => c.e), g = {};
    l.forEach(p => { const k = keys.includes(p.e) ? p.e : "_"; (g[k] = g[k] || []).push(p); });
    return h + keys.concat(["_"]).filter(k => g[k]).map(k => {
      const id = "pg:" + k, col = !!ui.cl[id] && !g[k].some(p => ui.pe === p.id);
      return '<div class="aicard aigrp' + (col ? " col" : "") + '"><div class="aich aitog" data-ai="cl" data-id="' + esc(id) + '" role="button" tabindex="0" aria-expanded="' + !col + '"><span class="aichev">' + (col ? "▸" : "▾") + '</span><span class="aie">' + (k === "_" ? "・" : esc(k)) + '</span><b class="ain">' + esc(k === "_" ? "その他" : catN(d, k)) + '</b><span class="note">' + g[k].length + "件</span></div>" +
        (col ? "" : '<div class="aigb">' + g[k].slice().sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0)).map(card).join("") + "</div>") + "</div>";
    }).join("");
  }
  const bodyOf = d => (ui.v === "acct" ? viewAcct(d) : ui.v === "job" ? viewJob(d) : viewPr(d));
  /* 折りたたみ（アカウント・作業の種類）。この端末に覚える */
  const CLK = "jd.aicl";
  try { ui.cl = JSON.parse(localStorage.getItem(CLK) || "{}") || {}; } catch (e) { ui.cl = {}; }
  const clSave = () => { try { localStorage.setItem(CLK, JSON.stringify(ui.cl)); } catch (e) { /* 覚えられなくても動く */ } };
  A.ai.view = function () {
    const d = D(); if (!d) return '<p class="note">読み込んでいます…</p>';
    const nWait = d.accts.filter(a => !avail(a)).length;
    return '<div class="aihead"><div class="seg"><button data-ai="v" data-v="acct" aria-pressed="' + (ui.v === "acct") + '">アカウントごと</button><button data-ai="v" data-v="job" aria-pressed="' + (ui.v === "job") + '">作業ごと</button><button data-ai="v" data-v="pr" aria-pressed="' + (ui.v === "pr") + '">プロンプト集</button></div>' +
      '<input type="search" id="aiq" class="lq" placeholder="' + (ui.v === "pr" ? "さがす（題名・本文）" : "さがす（作業名・アカウント）") + '" value="' + esc(ui.q) + '" autocomplete="off"><button class="btn" data-ai="cm-tog" title="作業のマークと名前を決める">⚙ 作業の種類を設定</button>' + (ui.v === "pr" ? "" : '<select id="aif" aria-label="状態で絞る"><option value="">状態：すべて</option>' + ST.slice(0, 4).map(s => '<option value="' + s[0] + '"' + (ui.f === s[0] ? " selected" : "") + ">" + s[1] + "</option>").join("") + "</select>") + '</div>' +
      (ui.v === "pr" ? "" : nowStrip(d)) + catMgr(d) + '<div id="aibody">' + bodyOf(d) + "</div>" +
      '<p class="note">メールアドレスは入れず、呼び名だけで管理します（このデータは公開のGitHubに入るため）。待ち時間はアカウントごとに「設定」で変えられます。' + (nWait ? "いま待ちのアカウント：" + nWait : "") + "</p>";
  };
  /* トップページの細い帯（重要Tipsと今朝のまとめの間）。押すとAIのページが開く */
  A.ai.band = function () {
    const d = D(); if (!d || !d.accts.length) return "";
    const mk = d.jobs.filter(j => j.st === "making").length;
    const chips = l => l.map(a => avail(a) ? '<span class="aip ok">● ' + esc(a.n) + "</span>" : '<span class="aip wait">◌ ' + esc(a.n) + "（" + when(a.lim) + "〜）</span>").join("");
    const lab = k => '<b style="color:' + SVN(k)[2] + '">' + SVN(k)[1] + "</b>", by = k => d.accts.filter(a => a.s === k);
    const rows = [["claude"], ["gpt"], ["gem", "nb"]].map(g => {
      const parts = g.filter(k => by(k).length).map((k, i) => (i ? '<span class="ainb">' : "") + lab(k) + chips(by(k)) + (i ? "</span>" : "")); if (!parts.length) return "";
      return '<div class="ainr">' + parts.join("") + "</div>";
    }).join("");
    return '<section class="panel p-ai"><header class="panel-h"><h2>AI</h2><span class="panel-n">' + (mk ? "作成中 " + mk + "件" : "") + '</span></header><div class="panel-b aibandb" data-side="work:ai" title="AI使い分けを開く" role="link" tabindex="0">' + rows + "</div></section>";
  };
  A.ai.counts = () => { const d = D(); return d ? { making: d.jobs.filter(j => j.st === "making").length, ok: d.accts.filter(avail).length, all: d.accts.length } : null; };

  const val = id => { const e = document.getElementById(id); return e ? e.value : ""; };
  document.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest("[data-ai]"); if (!b) return;
    const d = D(); if (!d) return; const a = b.dataset.ai, id = b.dataset.id, jobAt = () => d.jobs.findIndex(j => j.id === id);
    if (a === "cl") { if (e.target.closest("button,input,select,a,label")) return; ui.cl[id] ? delete ui.cl[id] : (ui.cl[id] = 1); clSave(); return A.render(); }
    if (a === "jump") {
      if (ui.cl[id]) { delete ui.cl[id]; clSave(); }
      const go = () => { const el = document.querySelector('[data-aid="' + id + '"]'); if (!el) return false; el.scrollIntoView({ behavior: "smooth", block: "start" }); el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); return true; };
      if (ui.v !== "acct" || !document.querySelector('[data-aid="' + id + '"]')) { ui.v = "acct"; ui.q = ""; ui.f = ""; A.render(); }
      setTimeout(go, 60); return;
    }
    if (a === "v") { ui.v = b.dataset.v; ui.pe = null; return A.render(); }
    if (a === "ed") { ui.ed = id; ui.na = null; return A.render(); }
    if (a === "job-no") { ui.ed = null; ui.na = null; return A.render(); }
    if (a === "job-new") { ui.na = id; ui.ed = null; return A.render(); }
    if (a === "job-ok") {
      const t = val("ai_t").trim(); if (!t) { A.toast && A.toast("作業名を入れてください"); return; }
      const f = { e: val("ai_e"), st: val("ai_st"), t, a: val("ai_a"), n: val("ai_n").trim() }, dv = val("ai_d");
      if (dv.indexOf("p:") === 0) f.pr = dv.slice(2); else if (dv) f.d = dv;
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
    if (a === "stop") { ui.sa = id; ui.ea = null; return A.render(); }
    if (a === "stop-no") { ui.sa = null; return A.render(); }
    if (a === "stop-ok") {
      const x = acctOf(d, id), m = /^(\d{1,2}):(\d{2})$/.exec(val("ai_stt")); if (!x || !m) { A.toast && A.toast("時刻を入れてください"); return; }
      const t = new Date(); t.setHours(+m[1], +m[2], 0, 0); if (t.getTime() <= now()) t.setDate(t.getDate() + 1);
      x.lim = t.getTime(); ui.sa = null; return save();
    }
    if (a === "go") { const x = acctOf(d, id); if (x) { x.lim = 0; save(); } return; }
    if (a === "acct-ed") { ui.ea = id; ui.sa = null; return A.render(); }
    if (a === "acct-no") { ui.ea = null; ui.ns = null; return A.render(); }
    if (a === "acct-ok") { const x = acctOf(d, id); if (x) { const n = val("ai_an").trim(); if (n) x.n = n; x.h = Math.max(1, Math.min(72, +val("ai_ah") || 5)); } ui.ea = null; return save(); }
    if (a === "acct-del") { const x = acctOf(d, id), n = d.jobs.filter(j => j.a === id).length; if (x && root.confirm("アカウント「" + x.n + "」を消します。" + (n ? "中の作業 " + n + " 件も消えます。" : "") + "よろしいですか？")) { d.accts = d.accts.filter(y => y.id !== id); d.jobs = d.jobs.filter(j => j.a !== id); ui.ea = null; save(); } return; }
    if (a === "acct-new") { ui.ns = b.dataset.s; return A.render(); }
    if (a === "acct-add") { const n = val("ai_nn").trim(); if (!n) return; d.accts.push({ id: nid(d, "a"), s: b.dataset.s, n, h: b.dataset.s === "claude" || b.dataset.s === "gpt" ? 5 : 24, lim: 0 }); ui.ns = null; return save(); }
    if (a === "cm-tog") { ui.cm = !ui.cm; ui.cp = null; return A.render(); }
    if (a === "cat-pk") { ui.cp = b.dataset.i === "-1" || ui.cp === b.dataset.i ? null : b.dataset.i; ui.nn = val("ai_nn2") || ui.nn; return A.render(); }
    if (a === "cat-set" || a === "cat-free") {
      const e = fx(a === "cat-set" ? b.dataset.e : (document.querySelector('[data-aice-free="' + b.dataset.i + '"]') || {}).value.trim());
      if (!e) return;
      if (b.dataset.i === "new") { ui.ne = e; ui.cp = null; ui.nn = val("ai_nn2") || ui.nn; return A.render(); }
      const c = d.cats[+b.dataset.i]; if (!c) return;
      if (d.cats.some((x, i) => i !== +b.dataset.i && x.e === e)) { A.toast && A.toast("そのマークはもう使われています"); return; }
      d.jobs.forEach(j => { if (j.e === c.e) j.e = e; }); c.e = e; ui.cp = null; return save();
    }
    if (a === "cat-add") {
      const e = ui.ne, n = val("ai_nn2").trim(); if (!e || !n) { A.toast && A.toast("マークを選んで、名前を入れてください"); ui.nn = n; return; }
      if (d.cats.some(c => c.e === e)) { A.toast && A.toast("そのマークはもう使われています"); return; }
      d.cats.push({ e, n }); ui.ne = ""; ui.nn = ""; return save();
    }
    if (a === "cat-up" || a === "cat-dn") { const i = +b.dataset.i, k = i + (a === "cat-up" ? -1 : 1); if (k < 0 || k >= d.cats.length) return; const t = d.cats[i]; d.cats[i] = d.cats[k]; d.cats[k] = t; return save(); }
    if (a === "cat-del") { const c = d.cats[+b.dataset.i], n = c ? d.jobs.filter(j => j.e === c.e).length : 0; if (c && root.confirm("作業の種類「" + c.e + " " + c.n + "」を削除します。" + (n ? "この種類の作業 " + n + " 件は「その他」に入ります。" : "") + "よろしいですか？")) { d.cats.splice(+b.dataset.i, 1); save(); } return; }
    if (a === "pr-new") { ui.pe = "new"; ui.pd = null; return A.render(); }
    if (a === "pr-no") { ui.pe = null; ui.pd = null; return A.render(); }
    if (a === "pr-ed") { ui.pe = id; return A.render(); }
    if (a === "pr-all") { ui.po = {}; if (b.dataset.v === "1") d.prompts.forEach(x => { ui.po[x.id] = 1; }); return A.render(); }
    if (a === "pr-tog") { if (e.target.closest("button,input,select,a,label")) return; ui.po = ui.po || {}; if (ui.po[id]) delete ui.po[id]; else ui.po[id] = 1; return A.render(); }
    if (a === "pr-copy") { const p = prOf(d, id); if (p) copyText(p.b || ""); return; }
    if (a === "pr-go") { ui.v = "pr"; ui.pe = null; ui.q = ""; ui.pf = ""; ui.pj = id; ui.po = ui.po || {}; ui.po[id] = 1; { const pp = prOf(d, id); if (pp) { const kk = d.cats.some(c => c.e === pp.e) ? pp.e : "_"; if (ui.cl["pg:" + kk]) { delete ui.cl["pg:" + kk]; clSave(); } } } A.render(); setTimeout(() => { const el = document.querySelector('[data-pid="' + id + '"]'); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); ui.pj = null; }, 60); return; }
    if (a === "pr-imp") {
      const dd = M().S().docs.find(x => x.id === val("pr_imp")); if (!dd) { A.toast && A.toast("取り込む手順・メモを選んでください"); return; }
      ui.pd = { t: dd.t || "", m: val("pr_m"), b: htmlText(dd.b), e: val("pr_e") || (d.cats[0] ? d.cats[0].e : "📍") }; return A.render();
    }
    if (a === "pr-ok") {
      const t = val("pr_t").trim(), body = val("pr_b").replace(/\r\n/g, "\n"), memo = val("pr_m").replace(/\r\n/g, "\n").trim(); if (!t) { A.toast && A.toast("題名を入れてください"); return; }
      d.prompts = d.prompts || [];
      if (id) { const p = prOf(d, id); if (p) { p.t = t; p.b = body; p.m = memo; p.e = val("pr_e"); p.u = now(); } } else d.prompts.push({ id: nid(d, "p"), t, b: body, m: memo, e: val("pr_e"), u: now() });
      ui.pe = null; ui.pd = null; return save();
    }
    if (a === "pr-del") { const p = prOf(d, id), n = d.jobs.filter(j => j.pr === id).length; if (p && root.confirm("プロンプト「" + p.t + "」を削除します。" + (n ? "使っている作業 " + n + " 件のつなぎは外れます（作業は消えません）。" : "") + "よろしいですか？")) { d.prompts = d.prompts.filter(x => x.id !== id); d.jobs.forEach(j => { if (j.pr === id) delete j.pr; }); ui.pe = null; save(); } return; }
    if (a === "doc") { if (A.memo && A.memo.openDoc) A.memo.openDoc(b.dataset.s, id, false); return; }
  });
  document.addEventListener("keydown", e => {
    const h = e.target && e.target.closest && e.target.closest('[data-ai="cl"]');
    if (h && (e.key === "Enter" || e.key === " ") && e.target === h) { e.preventDefault(); h.click(); return; }
    if (e.key === "Escape" && (ui.ed || ui.na || ui.ea || ui.ns || ui.sa) && A.ui.mode === "work" && A.ui.work.tab === "ai") { ui.ed = ui.na = ui.ea = ui.ns = ui.sa = null; A.render(); }
  });
  function liveBody() { const d = D(), el = document.getElementById("aibody"); if (d && el) el.innerHTML = bodyOf(d); }
  document.addEventListener("compositionend", e => { if (e.target && e.target.id === "aiq") { ui.q = e.target.value; liveBody(); } });
  document.addEventListener("input", e => {
    const t = e.target; if (!t || !t.id) return;
    if (t.id === "ai_nn2") { ui.nn = t.value; return; }
    if (t.id === "aiq") { if (e.isComposing) return; ui.q = t.value; liveBody(); return; }
  });
  document.addEventListener("change", e => {
    const t = e.target; if (!t) return;
    if (t.id === "aipf") { ui.pf = t.value; A.render(); return; }
    if (t.id === "aif") { ui.f = t.value; A.render(); return; }
    if (t.dataset && t.dataset.aicn !== undefined) { const d = D(), c = d && d.cats[+t.dataset.aicn]; if (c && t.value.trim()) { c.n = t.value.trim(); save(); } return; }
    });
  setInterval(() => {
    if (document.hidden || !A.ui || A.ui.mode !== "work" || A.ui.work.tab !== "ai") return;
    if (ui.ed || ui.na || ui.ea || ui.ns || ui.sa || ui.pe || document.querySelector("dialog[open]") || (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) return;
    A.render();
  }, 60000);
})(window);
