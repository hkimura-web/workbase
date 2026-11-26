/* GitHubのトップに散らばった余分なファイルを、一覧で選んで消す（設定・保存 → 「GitHubのトップを整理…」） */
(function (root) {
  "use strict";
  const KEEP = new Set(["index.html", "README.md", "favicon.svg", "apple-touch-icon.png", "icon-192.png"]);   /* トップに置くファイル */
  const SUB = ["css", "js", "data", "tools", "library", "work"];                                          /* 本来の置き場所 */
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let dlg = null, st = { list: [], busy: false };
  const base = s => "https://api.github.com/repos/" + encodeURIComponent(s.owner) + "/" + encodeURIComponent(s.repo) + "/contents/";
  const hd = s => ({ "Authorization": "Bearer " + s.token, "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" });
  async function ls(s, path) {
    const r = await fetch(base(s) + path.split("/").filter(Boolean).map(encodeURIComponent).join("/") + "?ref=" + encodeURIComponent(s.branch) + "&t=" + Date.now(), { headers: hd(s), cache: "no-store" });
    if (r.status === 404) return [];
    if (!r.ok) throw Object.assign(new Error("HTTP " + r.status), { status: r.status });
    const j = await r.json(); return Array.isArray(j) ? j : [];
  }
  const cfg = () => { const s = root.JDStore.getSettings(); return s && s.owner && s.repo && s.token ? Object.assign({ branch: "main" }, s) : null; };
  function ensure() {
    if (dlg) return dlg;
    dlg = document.createElement("dialog"); dlg.id = "tdlg"; dlg.className = "tdlg";
    document.body.appendChild(dlg);
    dlg.addEventListener("click", e => {
      const b = e.target.closest("[data-tidy]"); if (!b) return;
      const a = b.dataset.tidy;
      if (a === "close") dlg.close(); else if (a === "go") run(); else if (a === "all") dlg.querySelectorAll("input[data-n]").forEach(x => { x.checked = true; });
      else if (a === "none") dlg.querySelectorAll("input[data-n]").forEach(x => { x.checked = false; });
      else if (a === "reload") open();
    });
    return dlg;
  }
  const show = html => { ensure().innerHTML = '<div class="tdh"><b>GitHubのトップの整理</b><button class="btn sm" data-tidy="close">✕ 閉じる</button></div>' + html; };
  async function open() {
    ensure(); if (!dlg.open) dlg.showModal();
    const s = cfg();
    if (!s) { show('<p>先に、「設定・保存」で、ユーザー名・リポジトリ名・トークンを入れてください。</p>'); return; }
    show("<p>GitHubのトップを調べています…</p>");
    try {
      const top = await ls(s, ""), where = {};
      for (const d of SUB) (await ls(s, d)).forEach(f => { (where[f.name] = where[f.name] || []).push(d); });
      const files = top.filter(f => f.type === "file" && !KEEP.has(f.name) && f.name[0] !== "."), dirs = top.filter(f => f.type === "dir" && !SUB.includes(f.name) && f.name[0] !== ".");
      st.list = files;
      let h = '<p class="note">トップに置くのは index.html と、css・js・data などのフォルダです。次のファイルは、トップに置く必要がないものです。消すものにチェックを入れてください。</p>';
      if (!files.length) h += '<p><b>トップに余分なファイルはありません。</b></p>';
      else {
        h += '<div class="tdbar"><button class="btn sm" data-tidy="all">すべてチェック</button><button class="btn sm" data-tidy="none">すべてはずす</button></div><div class="tdl">' +
          files.map(f => { const w = where[f.name]; return '<label class="tdi"><input type="checkbox" data-n="' + esc(f.name) + '" data-sha="' + f.sha + '"' + (w ? " checked" : "") + "><span>" + esc(f.name) + "</span><small>" + (w ? w.join("・") + " フォルダにも同じ名前があります" : "同じ名前がどこにもありません（中身を確かめてから）") + "</small></label>"; }).join("") + "</div>" +
          '<div class="tdbar"><button class="btn danger" data-tidy="go">チェックしたファイルを消す</button></div><p class="note">消してもGitHubに履歴が残るので、あとで戻せます。</p>';
      }
      if (dirs.length) h += '<p class="note">そのほかのフォルダ（ここでは消しません）：' + dirs.map(d => esc(d.name)).join("、") + "</p>";
      show(h);
    } catch (e) { show("<p>調べられませんでした：" + esc(root.JDStore.explain(e)) + "</p>"); }
  }
  async function run() {
    const s = cfg(); if (!s || st.busy) return;
    const sel = [...dlg.querySelectorAll("input[data-n]:checked")]; if (!sel.length) return;
    if (!root.confirm(sel.length + "個のファイルを、GitHubのトップから消します。よろしいですか？")) return;
    st.busy = true; let ok = 0, ng = [];
    for (const x of sel) {
      show("<p>消しています… " + (ok + ng.length + 1) + " / " + sel.length + "（" + esc(x.dataset.n) + "）</p>");
      try {
        const r = await fetch(base(s) + encodeURIComponent(x.dataset.n), { method: "DELETE", headers: Object.assign({ "Content-Type": "application/json" }, hd(s)), body: JSON.stringify({ message: "トップの余分なファイルを整理：" + x.dataset.n, sha: x.dataset.sha, branch: s.branch }) });
        if (!r.ok) throw new Error("HTTP " + r.status); ok++;
      } catch (e) { ng.push(x.dataset.n); }
    }
    st.busy = false;
    show("<p><b>" + ok + "個を消しました。</b>" + (ng.length ? "<br>消せなかったもの：" + esc(ng.join("、")) : "") + '</p><div class="tdbar"><button class="btn" data-tidy="reload">もう一度調べる</button></div>');
  }
  document.addEventListener("click", e => { if (e.target.closest("[data-tidy-open]")) open(); });
})(window);
