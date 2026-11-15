/* THE WORKBASE: ホーム「今朝のまとめ」
 *  data/morning.json（毎朝、GASが作ってGitHubに書き込む）を読んで、「今日」画面に小さく出す。
 *  ファイルが無いとき（まだ設定していないとき）は、何も出さない。 ?demo=morning で、見本（tools/morning.sample.json）を表示。
 *  形: {date, made, mode:"ai"|"rule", top:[{lv:"hi"|"md", t}], sec:[{id, n, items:[文]}], week:[{d, ev:[文], out, me:[印を付ける行の番号]}]} */
(function (root) {
  "use strict";
  const A = root.A, S = root.JDStore, esc = root.JD.esc, FILE = "data/morning.json";
  const Q = { d: null, st: "wait", at: 0 }, LS = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* 覚えられなくても動く */ } } };
  const demo = /[?&]demo=morning\b/.test(location.search);
  A.morning = {};
  const pd = s => { const m = /^(\d+)-(\d+)-(\d+)/.exec(s || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  const ymd = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const WD = "日月火水木金土";
  const md = s => { const d = pd(s); return d ? (d.getMonth() + 1) + "/" + d.getDate() + "（" + WD[d.getDay()] + "）" : ""; };

  async function load(force) {
    if (Q.st === "ing" || (!force && Q.st === "done" && Date.now() - Q.at < 600000)) return;
    Q.st = "ing"; let text = null;
    try {
      const s = S.getSettings();
      if (demo) { const r = await fetch("tools/morning.sample.json?t=" + Date.now(), { cache: "no-store" }); if (r.ok) text = await r.text(); }
      else if (s && s.token) { try { text = (await S.remoteGet(s, FILE)).text; } catch (e) { text = null; } }
      else { const r = await fetch(FILE + "?t=" + Date.now(), { cache: "no-store" }); if (r.ok) text = await r.text(); }
    } catch (e) { text = null; }
    let d = null; try { d = text ? JSON.parse(text) : null; } catch (e) { d = null; }
    const before = JSON.stringify(Q.d); Q.d = d && Array.isArray(d.sec) ? d : null; Q.st = "done"; Q.at = Date.now();
    if (JSON.stringify(Q.d) !== before && A.render && A.ui && A.ui.mode === "class" && A.ui.tab === "today") A.render();
  }
  setTimeout(() => load(true), 1500);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) load(false); });

  const age = d => { const m = pd(d.date); if (!m) return 99; const t = pd(ymd(new Date())); return Math.round((t - m) / 86400000); };
  const mk = d => { const t = new Date(d.made); return isNaN(t) ? "" : (t.getMonth() + 1) + "/" + t.getDate() + " " + t.getHours() + ":" + String(t.getMinutes()).padStart(2, "0"); };
  const on = () => LS.get("jd.mb.open") !== "0", wk = () => LS.get("jd.mb.wk") === "1";

  A.morning.band = function () {
    const d = Q.d; if (!d) return "";
    const ag = demo ? 0 : age(d), open = on();
    const tops = (d.top || []).filter(x => x && x.t), secs = d.sec || [];
    const has = secs.filter(s => s.items && s.items.length), none = secs.filter(s => !s.items || !s.items.length).map(s => s.n);
    let h = '<section class="panel mb" id="p-mb"><header class="panel-h mb-h"><h2>今朝のまとめ</h2><span class="panel-n">' + esc(mk(d)) + (mk(d) ? " 作成" : "") + '</span><button class="mb-t" data-mbact="tog" aria-expanded="' + open + '">' + (open ? "たたむ" : "ひらく") + "</button></header>";
    if (ag > 0) h += '<div class="mb-old' + (ag > 1 ? " mb-old2" : "") + '">' + (ag === 1 ? "昨日" : ag + "日前") + "（" + md(d.date) + "）のまとめです。今朝の分はまだ届いていません。</div>";
    if (open) {
      h += '<div class="mb-b">';
      if (tops.length) h += '<ul class="mb-top">' + tops.map(x => '<li class="' + (x.lv === "hi" ? "hi" : "md") + '"><span class="mb-lv">' + (x.lv === "hi" ? "要対応" : "確認") + "</span>" + esc(x.t) + "</li>").join("") + "</ul>";
      else h += '<p class="mb-none">今日これだけは、というものはありません。</p>';
      if (has.length) h += '<div class="mb-sec">' + has.map(s => '<div class="mb-s"><b>' + esc(s.n) + "</b>" + s.items.map(t => "<p>" + esc(t) + "</p>").join("") + "</div>").join("") + "</div>";
      if (none.length) h += '<p class="mb-nl">連絡なし：' + esc(none.join("・")) + "</p>";
      const w = (d.week || []).filter(x => x && x.d);
      if (w.length) {
        const td = ymd(new Date()), tm = ymd(new Date(Date.now() + 86400000)), line = x => esc(md(x.d)) + "：" + (x.ev && x.ev.length ? esc(x.ev.slice(0, 2).join("・")) + (x.ev.length > 2 ? "…" : "") : "—");
        const t1 = w.find(x => x.d === (demo ? d.date : td)), t2 = w.find(x => x.d === (demo ? ymd(new Date(pd(d.date).getTime() + 86400000)) : tm));
        h += '<details class="mb-wk"' + (wk() ? " open" : "") + '><summary>学校の予定（今週）<span>' + [t1, t2].filter(Boolean).map(line).join("　") + '</span></summary><div class="mb-days">' +
          w.map(x => '<div class="mb-d"><b>' + esc(md(x.d)) + "</b>" + (x.ev || []).map((e, i) => '<span class="' + ((x.me || []).indexOf(i) >= 0 ? "me" : "") + '">' + esc(e) + "</span>").join("") + (x.out ? '<small>最終退勤 ' + esc(x.out) + "</small>" : "") + "</div>").join("") + "</div></details>";
      }
      h += "</div>";
    }
    return h + "</section>";
  };
  document.addEventListener("click", e => {
    const t = e.target.closest && e.target.closest("[data-mbact]"); if (!t) return;
    LS.set("jd.mb.open", on() ? "0" : "1"); A.render();
  });
  document.addEventListener("toggle", e => { const t = e.target; if (t && t.classList && t.classList.contains("mb-wk")) LS.set("jd.mb.wk", t.open ? "1" : "0"); }, true);
})(window);
