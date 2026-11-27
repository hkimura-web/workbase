/* THE WORKBASE: 校務「学校資料」— 学校の資料一覧（各種資料・事務の届出・学内サイト）を検索して開く
 *  元データ: work/shiryo.json（tools/xlsx_to_shiryo.py で資料一覧のxlsxから作る。アプリでは読むだけ）
 *  公開されるリポジトリに入るので、パスワード・名簿・鍵番号などは元データの段階で除いてある。 */
(function (root) {
  "use strict";
  const A = root.A, esc = root.JD.esc;
  const Q = { d: null, st: "wait" };
  const ui = { q: "", sec: "", cat: "" };
  const nf = s => (s || "").normalize("NFKC").toLowerCase();
  A.shiryo = {};

  async function load() {
    if (Q.st !== "wait") return; Q.st = "ing";
    try { const r = await fetch("work/shiryo.json?t=" + Date.now(), { cache: "no-store" }); Q.d = r.ok ? await r.json() : null; } catch (e) { Q.d = null; }
    Q.st = "done"; if (A.ui.mode === "work" && A.ui.work.tab === "shiryo") A.render();
  }

  const badge = n => { const m = /新規|改訂|廃止|毎月更新|更新/.exec(n || ""); return m ? '<span class="shb sh-' + (/廃止/.test(m[0]) ? "x" : /毎月/.test(m[0]) ? "m" : "n") + '">' + esc(n) + "</span>" : (n ? '<span class="shnote">' + esc(n) + "</span>" : ""); };
  const lk = (lab, f, cls) => f && f.u ? '<a class="btn wlnk shl ' + cls + '" href="' + esc(f.u) + '" target="_blank" rel="noopener noreferrer" title="' + esc(f.t || "") + '">' + esc(lab) + " ↗</a>" : (f && f.t ? '<span class="shnote" title="リンクはありません">' + esc(lab) + "：" + esc(f.t.length > 24 ? f.t.slice(0, 23) + "…" : f.t) + "</span>" : "");
  function row(it, yr) {
    let b = "";
    if (it.files) b = it.files.map(f => lk(f.t, f, "shl-c")).join("");
    else b = lk(yr, it.cur, "shl-c") + lk(yr - 1, it.prev, "shl-p");
    return '<div class="shr"><div class="shn"><b>' + esc(it.t) + "</b>" + (it.dept ? '<span class="shd">' + esc(it.dept) + "</span>" : "") + badge(it.note) + '</div><div class="shbt">' + (b || '<span class="shnote">リンクなし</span>') + "</div></div>";
  }
  function match(it, c, q) {
    const hay = nf([it.t, it.dept, it.note, c, (it.cur || {}).t, (it.prev || {}).t, (it.files || []).map(f => f.t).join(" ")].join(" "));
    return q.every(w => hay.indexOf(w) >= 0);
  }
  function results() {
    const d = Q.d, q = nf(ui.q).split(/\s+/).filter(Boolean); let h = "", n = 0;
    d.sections.forEach(s => {
      if (ui.sec && ui.sec !== s.id) return;
      let sh = "";
      s.cats.forEach(c => {
        if (ui.cat && ui.cat !== s.id + ":" + c.c) return;
        const l = c.items.filter(it => match(it, c.c, q)); if (!l.length) return; n += l.length;
        sh += '<div class="tgh"><span class="shcat">' + esc(c.c) + '</span><span class="tgn">' + l.length + "件</span></div>" + l.map(it => row(it, d.year)).join("");
      });
      if (sh) h += (ui.sec ? "" : '<h3 class="shsec">' + esc(s.title) + "</h3>") + sh;
    });
    return h || '<p class="note">見つかりません。</p>';
  }
  A.shiryo.view = function () {
    load();
    if (Q.st !== "done") return '<p class="note">読み込んでいます…</p>';
    if (!Q.d) return '<p class="note">学校資料のデータ（work/shiryo.json）が見つかりません。</p>';
    const d = Q.d;
    let h = '<div class="pghd"><div><h2 class="pgt">学校資料</h2><p class="pgs">学校の資料一覧です。「' + d.year + '」が今年度、「' + (d.year - 1) + '」が前年度の資料です。</p></div></div>';
    h += '<div class="tsbar"><input type="search" id="sh_q" placeholder="資料をさがす（例：避難　時間割　出張）" value="' + esc(ui.q) + '" autocomplete="off"></div>';
    h += '<div class="tsseg"><button class="btn' + (ui.sec ? "" : " on") + '" data-shact="sec" data-v="">すべて</button>' + d.sections.map(s => '<button class="btn' + (ui.sec === s.id ? " on" : "") + '" data-shact="sec" data-v="' + s.id + '">' + esc(s.title) + "</button>").join("") + "</div>";
    const cs = []; d.sections.forEach(s => { if (!ui.sec || ui.sec === s.id) s.cats.forEach(c => { if (s.cats.length > 1) cs.push([s.id + ":" + c.c, c.c]); }); });
    if (cs.length > 1) h += '<div class="tsseg shcats"><button class="btn sm' + (ui.cat ? "" : " on") + '" data-shact="cat" data-v="">全部の分類</button>' + cs.map(x => '<button class="btn sm' + (ui.cat === x[0] ? " on" : "") + '" data-shact="cat" data-v="' + esc(x[0]) + '">' + esc(x[1]) + "</button>").join("") + "</div>";
    h += '<div id="sh_res">' + results() + "</div>";
    return h + '<p class="note">一覧の作成日：' + esc(d.built || "—") + "。パスワード・名簿・鍵番号などは、ここには入れていません。</p>";
  };
  document.addEventListener("input", e => { if (e.target && e.target.id === "sh_q") { ui.q = e.target.value; const r = document.getElementById("sh_res"); if (r && Q.d) r.innerHTML = results(); } });
  document.addEventListener("click", e => {
    const t = e.target.closest && e.target.closest("[data-shact]"); if (!t) return;
    if (t.dataset.shact === "sec") { ui.sec = t.dataset.v; ui.cat = ""; } else ui.cat = t.dataset.v;
    A.render();
  });
})(window);
