/* 授業ダイアリー: 保存まわり（この端末のブラウザ内 / GitHub のリポジトリ） */
(function (root) {
  "use strict";
  const LS = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* 使えない環境では何もしない */ } }
  };

  /* https://<owner>.github.io/<repo>/ で開いていれば、リポジトリを自動で推定する */
  function guess() {
    const h = location.hostname, parts = location.pathname.split("/").filter(Boolean);
    let owner = "", repo = "";
    if (h.endsWith(".github.io")) { owner = h.split(".")[0]; repo = parts[0] && !/\.html?$/.test(parts[0]) ? parts[0] : owner + ".github.io"; }
    return { owner, repo, branch: "main", token: "" };
  }
  function getSettings() {
    let s = {};
    try { s = JSON.parse(LS.get("jd.settings") || "{}"); } catch (e) { s = {}; }
    return Object.assign(guess(), s);
  }
  function saveSettings(s) { return LS.set("jd.settings", JSON.stringify(s)); }

  const enc = new TextEncoder(), dec = new TextDecoder();
  function b64e(str) {
    const b = enc.encode(str); let bin = "";
    for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function b64d(b64) {
    const bin = atob(b64.replace(/\s/g, "")), b = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    return dec.decode(b);
  }

  function ghUrl(s, path) {
    return "https://api.github.com/repos/" + encodeURIComponent(s.owner) + "/" + encodeURIComponent(s.repo) +
      "/contents/" + path.split("/").map(encodeURIComponent).join("/");
  }
  const headers = s => ({ "Authorization": "Bearer " + s.token, "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" });

  async function fail(res) {
    let msg = "";
    try { msg = (await res.json()).message || ""; } catch (e) { /* 本文なし */ }
    const e = new Error(msg || ("HTTP " + res.status));
    e.status = res.status;
    throw e;
  }
  async function remoteGet(s, path) {
    const res = await fetch(ghUrl(s, path) + "?ref=" + encodeURIComponent(s.branch) + "&t=" + Date.now(), { headers: headers(s), cache: "no-store" });
    if (!res.ok) await fail(res);
    const j = await res.json();
    return { text: b64d(j.content || ""), sha: j.sha };
  }
  /* ---------- 古い画面で保存して、新しい項目を消してしまうのを防ぐ ----------
   * data/app.json に「いちばん新しい版の番号」を書いておき、それより古い画面からの保存は止める。
   * 番号は index.html の wb-build。読めないときは止めない（保存できなくなるのを避ける）。 */
  const STAMP = "data/app.json", MINE = ((document.querySelector('meta[name="wb-build"]') || {}).content || "");
  const G = { at: 0, old: false, ing: null, shown: false };
  function oldMsg() { return "この画面は古い版です。新しい版で保存されたデータを壊さないよう、保存を止めました。Ctrl+Shift+R（Macは Cmd+Shift+R）で読み込み直してください。"; }
  function oldBanner() {
    if (G.shown || !document.body) return; G.shown = true;
    const b = document.createElement("div");
    b.setAttribute("style", "position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#fde8e8;color:#7a1c1c;border-top:2px solid #d66;padding:10px 14px;font-size:14px;text-align:center");
    b.textContent = "この画面は古い版です。保存は止めてあります。Ctrl+Shift+R（Macは Cmd+Shift+R）で読み込み直してください。";
    document.body.appendChild(b);
  }
  async function guard(s) {
    if (!MINE || !s || !s.token) return;
    if (G.old) throw Object.assign(new Error(oldMsg()), { oldBuild: true });
    if (Date.now() - G.at < 60000) return;
    if (G.ing) return G.ing;
    G.ing = (async () => {
      let r = null, miss = false;
      try { r = await remoteGet(s, STAMP); } catch (e) { if (e.status === 404) miss = true; else return; }   /* 読めないときは止めない */
      let b = ""; if (r) { try { b = String(JSON.parse(r.text).build || ""); } catch (e) { b = ""; } }
      if (b && b > MINE) { G.old = true; oldBanner(); throw Object.assign(new Error(oldMsg()), { oldBuild: true }); }
      G.at = Date.now();
      if (b !== MINE) {
        try { const body = { message: "最新の版の番号を記録（" + MINE + "）", content: b64e(JSON.stringify({ build: MINE }, null, 1) + "\n"), branch: s.branch }; if (r) body.sha = r.sha;
          await fetch(ghUrl(s, STAMP), { method: "PUT", headers: Object.assign({ "Content-Type": "application/json" }, headers(s)), body: JSON.stringify(body) }); } catch (e) { /* 記録できなくても保存は続ける */ }
      }
    })();
    try { await G.ing; } finally { G.ing = null; }
  }
  /* 開いたときにも一度確かめて、古い画面なら先に知らせる */
  setTimeout(() => { try { const s = getSettings(); if (s.token) guard(s).catch(() => {}); } catch (e) { /* 何もしない */ } }, 2500);
  async function remotePut(s, path, text, sha, message) {
    if (path !== STAMP) await guard(s);
    const body = { message, content: b64e(text), branch: s.branch };
    if (sha) body.sha = sha;
    const res = await fetch(ghUrl(s, path), { method: "PUT", headers: Object.assign({ "Content-Type": "application/json" }, headers(s)), body: JSON.stringify(body) });
    if (!res.ok) await fail(res);
    const j = await res.json();
    return { sha: j.content.sha };
  }
  function explain(e) {
    if (e.status === 401) return "トークンが正しくないか、期限が切れています。";
    if (e.status === 403) return "このトークンに書き込み権限がありません（Contents: Read and write が必要です）。";
    if (e.status === 404) return "リポジトリまたはファイルが見つかりません。ユーザー名・リポジトリ名・ブランチ名とトークンの対象リポジトリを確認してください。";
    if (e.status === 409 || e.status === 422) return "別の端末で先に更新されています。最新を読み込み直してください。";
    return e.message || "接続できませんでした。";
  }

  root.JDStore = { LS, getSettings, saveSettings, remoteGet, remotePut, explain };
})(window);
