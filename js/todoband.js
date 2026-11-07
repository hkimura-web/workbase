/* THE WORKBASE: 校務・テスト成績のホームに出す、共通の「やること・見通し」
 *  - 校務の「今月・来月の準備」と、テストの「いまやること・来月までの見通し」を1つにまとめる
 *  - 校務は緑、テストはピンクのラベルと線。いま開いているページのものを先に出す */
(function (root) {
  "use strict";
  const A = root.A, LS = root.JDStore.LS;
  const SRC = [["work", "校務", "work"], ["test", "テスト", "seiseki"]];
  const BK = [["late", "期限切れ・繰越", "tdh-late"], ["now", "いまやること", ""], ["soon", "来月までの見通し（前倒しOK）", ""]];
  const ui = { all: false, f: (function () { try { const v = LS.get("jd.tdf"); return v === "work" || v === "test" ? v : "all"; } catch (e) { return "all"; } })() };
  A.todoBand = function (scope) {
    const data = {}; SRC.forEach(([k, n, m]) => { let d = { late: [], now: [], soon: [] }; try { d = (A[m] && A[m].todo && A[m].todo()) || d; } catch (e) { /* 出せないときは空 */ } data[k] = d; });
    const order = SRC.slice().sort((a, b) => (a[0] === scope ? -1 : 0) - (b[0] === scope ? -1 : 0));
    const cnt = k => data[k].late.length + data[k].now.length + data[k].soon.length;
    const show = k => ui.f === "all" || ui.f === k;
    let body = "";
    BK.forEach(([b, title, cls]) => {
      const list = [];
      order.forEach(([k, name]) => { if (!show(k)) return; data[k][b].forEach(r => list.push('<div class="tdr tdr-' + k + '"><span class="tdl tdl-' + k + '">' + name + '</span><div class="tdc">' + r.html + "</div></div>")); });
      const n = list.length, lim = b === "late" && !ui.all && n > 6;
      if (n) body += '<h3 class="tdh ' + cls + '">' + title + ' <span class="note">' + n + "件</span></h3>" + (lim ? list.slice(0, 5) : list).join("") + (lim ? '<p style="margin:6px 0 0"><button class="btn sm" data-tdf="more">残り ' + (n - 5) + "件も表示する</button></p>" : (b === "late" && ui.all && n > 6 ? '<p style="margin:6px 0 0"><button class="btn sm" data-tdf="less">たたむ</button></p>' : ""));
    });
    if (!body) body = '<p class="note" style="margin:0">いまやること・1か月以内に控えていることは、ありません。</p>';
    const seg = [["all", "すべて"], ["work", "校務"], ["test", "テスト"]].map(([v, n]) => '<button class="btn sm' + (ui.f === v ? " on" : "") + '" data-tdf="' + v + '">' + n + "</button>").join("");
    return '<section class="panel p-todo"><header class="panel-h"><h2>やること・見通し</h2><span class="panel-n"><span class="tdcnt"><i class="tdd tdd-work"></i>校務 ' + cnt("work") + '<i class="tdd tdd-test"></i>テスト ' + cnt("test") + "</span> " + seg + '</span></header><div class="panel-b">' + body + "</div></section>";
  };
  document.addEventListener("click", e => {
    const t = e.target.closest && e.target.closest("[data-tdf]"); if (!t) return;
    const v = t.dataset.tdf; if (v === "more" || v === "less") { ui.all = v === "more"; A.render(); return; }
    ui.f = v; try { LS.set("jd.tdf", ui.f); } catch (x) { /* 保存できなくても切り替わる */ } A.render();
  });
})(window);
