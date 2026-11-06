/* 授業ダイアリー: 日付と計画のロジック（画面に依存しない部分）
 * ブラウザでは window.JD、Node では module.exports として使える。 */
(function (root) {
  "use strict";
  const DOW = "日月火水木金土";
  const pad = n => String(n).padStart(2, "0");
  const ds = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const pd = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const md = s => { const d = pd(s); return (d.getMonth() + 1) + "/" + (d.getDate()); };
  const dw = s => DOW[pd(s).getDay()];
  const addDays = (s, n) => { const d = pd(s); d.setDate(d.getDate() + n); return ds(d); };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clone = o => JSON.parse(JSON.stringify(o));
  /* クラス名「S1-1 現代の国語」から科目名（空白より後ろ）を取り出す */
  const subjectOf = c => { const n = (c && c.name) || "", i = n.indexOf(" "); return i < 0 ? n : n.slice(i + 1).trim(); };
  /* 単元に「科目」を持たせる。古いデータ（科目名が単元名の頭に付いている）は、科目を切り出して移行する */
  function migrateUnits(st) {
    const subs = []; st.classes.forEach(c => { const x = subjectOf(c); if (x && subs.indexOf(x) < 0) subs.push(x); });
    Object.keys(st.units).forEach(u => {
      const un = st.units[u];
      if (typeof un.subj === "string") return;
      const hit = subs.find(x => un.name.indexOf(x + " ") === 0 || un.name.indexOf(x + "　") === 0);
      if (hit) { un.subj = hit; un.name = un.name.slice(hit.length).trim() || un.name; return; }
      const used = {}; st.classes.forEach(c => { if ((st.plans[c.id] || []).some(b => b.u === u)) used[subjectOf(c)] = 1; });
      const ks = Object.keys(used);
      un.subj = ks.length === 1 ? ks[0] : "";
    });
  }
  /* 古いデータ（2時間続きを1コマとして記録していた）を、1時限ごとのコマに移す。記録・授業なし・しるしを各時限にコピーする */
  function migrateSlots(st) {
    ["rec", "off", "flags"].forEach(m => {
      const map = st[m]; if (!map) return;
      Object.keys(map).forEach(k => {
        const a = k.split("|"); if (a.length !== 2) return;
        const cls = st.classes.find(c => c.id === a[0]); if (!cls) return;
        const w = pd(a[1]).getDay(), pers = cls.tt.filter(t => t[0] === w).map(t => t[1]).sort((x, y) => x - y);
        if (pers.length < 2) return;
        const v = map[k]; delete map[k];
        pers.forEach((p, i) => {
          const nk = k + "|" + p; if (map[nk] != null) return;
          if (m === "rec" && v && typeof v === "object") {
            const r = Object.assign({}, v);
            if (r.s === "part" && i < pers.length - 1) r.s = "done";   /* 「途中まで」は最後の時限だけ */
            if (i > 0) delete r.n;                                      /* 記録メモは最初の時限だけ */
            map[nk] = r;
          } else map[nk] = v;
        });
      });
    });
  }
  /* 特別日課（短縮授業・模試・行事の日）：st.days = [{id, from, to, name, off:[時限…]|"all", why, bell:{s,len,brk}|null}] */
  function dayOf(st, d) { return ((st && st.days) || []).find(x => x && x.from && d >= x.from && d <= (x.to || x.from)) || null; }
  function dayOff(st, d, p) { const e = dayOf(st, d); if (!e) return null; return e.off === "all" || (Array.isArray(e.off) && e.off.indexOf(p) >= 0) ? (e.why || e.name || "授業なし") : null; }
  /* その日の授業時間表。日課に「時間を変える」があれば、1限の開始・1コマの長さ・休み時間から作る。なければ普通の時間表 */
  function bellFor(st, d, base) {
    const e = dayOf(st, d); if (!e || !e.bell || !(e.bell.len > 0)) return base;
    const o = {}; for (let i = 1; i <= 7; i++) { const s = e.bell.s + (i - 1) * (e.bell.len + (e.bell.brk || 0)); o[i] = [s, s + e.bell.len]; }
    return o;
  }
  const hrsOf = b => (b && b.h) || 1;

  /* 学期内の各日について、その授業の時間割に当たる日を「コマ」にする（1日1コマ、hrs=その日の時数）。 */
  function buildSlots(st, cls) {
    const out = [];
    for (let d = st.term.start; d <= st.term.end; d = addDays(d, 1)) {
      const w = pd(d).getDay();
      const pers = cls.tt.filter(t => t[0] === w).map(t => t[1]).sort((a, b) => a - b), hrs = pers.length;
      if (!hrs) continue;
      /* 2時間続きなど、1日に複数の時限がある授業は、1時限ごとに別のコマにする（キーは「クラス|日付|時限」）。1時限だけの日は今までどおり「クラス|日付」 */
      const multi = hrs > 1;
      (multi ? pers : [null]).forEach(p => {
        const key = cls.id + "|" + d + (multi ? "|" + p : "");
        out.push({ key, date: d, hrs: 1, periods: multi ? [p] : pers, off: (st.off && st.off[key]) || dayOff(st, d, (multi ? p : pers[0])) || null, ev: (st.events && st.events[d]) || (api.evExtra ? api.evExtra(d) : "") || "" });
      });
    }
    return out;
  }

  /* 計画ブロックを、休講・授業なし・別内容のコマを飛ばしながら順番にコマへ割り当てる。
   * 「途中まで」のコマでは最後のブロックが次のコマに続く。 */
  function project(st, cls) {
    const blocks = st.plans[cls.id] || [];
    let p = 0, contFrom = -1, rem = 0, cur = null;
    const rows = buildSlots(st, cls).map(s => {
      if (s.off) return Object.assign({}, s, { kind: "off", blocks: [], used: 0, rec: {} });
      const rec = st.rec[s.key] || {}, stt = rec.s || "plan";
      if (stt === "cancel" || stt === "free") return Object.assign({}, s, { kind: stt, blocks: [], used: 0, rec });
      const assigned = [];
      let cont = false, b2 = false;
      if (rem > 0 && cur) { assigned.push(cur); rem--; b2 = true; }          /* 2時間ぶんのブロックの、2時間目以降 */
      else if (p < blocks.length) {
        cont = contFrom === p;
        cur = blocks[p]; assigned.push(cur); rem = hrsOf(cur) - 1; p++;
      }
      if (stt === "part" && assigned.length) { p--; contFrom = p; rem = 0; cur = null; } else contFrom = -1;
      const kind = assigned.length || stt !== "plan" ? stt : "empty";
      return Object.assign({}, s, { kind, blocks: assigned, used: assigned.length, cont, b2, rec });
    });
    return { rows, left: blocks.slice(p), rem };
  }

  function classStats(st, cls, asof) {
    const pj = project(st, cls);
    const fut = pj.rows.filter(r => r.date >= asof && (r.kind === "plan" || r.kind === "empty"));
    const remain = fut.reduce((a, r) => a + r.hrs, 0);
    const blank = r => r.blocks.filter(b => !(b.t || "").trim()).reduce((x, b) => x + hrsOf(b), 0);
    const spare = fut.reduce((a, r) => a + Math.max(0, r.hrs - r.used) + Math.min(r.hrs, blank(r)), 0);
    const needed = pj.left.reduce((a, b) => a + hrsOf(b), 0) + (pj.rem || 0);
    return { pj, remain, needed, spare };
  }

  function unitStats(st, cls, u) {
    const pj = project(st, cls);
    const blocks = st.plans[cls.id] || [];
    const planned = blocks.filter(b => b.u === u).reduce((a, b) => a + hrsOf(b), 0);
    let actual = 0, slotsU = 0, start = null, end = null;
    pj.rows.forEach(r => r.blocks.forEach(b => {
      if (b.u !== u) return;
      slotsU += 1;
      if (r.kind === "done" || r.kind === "part") actual += 1;
      if (!start) start = r.date;
      end = r.date;
    }));
    const leftU = pj.left.filter(b => b.u === u).reduce((a, b) => a + hrsOf(b), 0);
    /* 「別の内容」で、この単元を実施したコマ（他の科目への入れ替えなど）も実績に数える */
    let swapped = 0;
    pj.rows.forEach(r => {
      if (r.kind !== "free" || !r.rec || r.rec.fu !== u) return;
      swapped += r.hrs;
      if (!start || r.date < start) start = r.date;
      if (!end || r.date > end) end = r.date;
    });
    actual += swapped;
    return { planned, actual, slotsU, leftU, start, end, swapped };
  }

  /* 画面で見せる最初の（これからの）計画ブロックの位置 */
  function firstPendingIndex(st, cls, asof) {
    const pj = project(st, cls), blocks = st.plans[cls.id] || [];
    for (const r of pj.rows) if (r.date >= asof && r.blocks.length) return blocks.indexOf(r.blocks[0]);
    return pj.left.length ? blocks.length - pj.left.length : blocks.length;
  }

  /* 保存用: キー順を固定して差分が読みやすいJSONにする */
  function stable(v) {
    if (Array.isArray(v)) return v.map(stable);
    if (v && typeof v === "object") { const o = {}; Object.keys(v).sort().forEach(k => { o[k] = stable(v[k]); }); return o; }
    return v;
  }
  const toJSON = st => JSON.stringify(stable(st), null, 1) + "\n";

  const api = { dayOf, dayOff, bellFor, subjectOf, migrateUnits, migrateSlots, DOW, pad, ds, pd, md, dw, addDays, esc, clone, hrsOf, buildSlots, project, classStats, unitStats, firstPendingIndex, toJSON };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.JD = api;
})(typeof window !== "undefined" ? window : globalThis);
