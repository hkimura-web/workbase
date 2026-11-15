/**
 * THE WORKBASE「今朝のまとめ」を毎朝つくるGAS（Google Apps Script）
 *
 * 毎朝7:15に動いて、次のことをします。
 *   1. ミラーのスプレッドシート（シート1のA列に、朝の連絡の文字が縦に並んでいるもの）を読む
 *   2. 1週間の予定表は、AIを使わずプログラムで整える
 *   3. 連絡の文章は、無料のGeminiに「あなた向けに項目ごと・短く」まとめてもらう
 *      （うまくいかない日は、AIなしで関係する行を抜き出す形に自動で切り替える）
 *   4. できた data/morning.json をGitHubに書き込む → アプリのホームに出る
 *
 * 鍵（APIキー・GitHubトークン）は、このコードには書きません。
 * 「プロジェクトの設定 → スクリプト プロパティ」に GEMINI_API_KEY と GH_TOKEN を入れます。
 */

/* ===== 設定（ここだけ書き換える） ===== */
const CONF = {
  SHEET_ID: '',                 // ミラーのシートの「拡張機能 → Apps Script」から作ったなら、空のままでよい（別に作ったときだけ、URLの /d/ と /edit の間の文字を入れる）
  SHEET_NAME: 'シート1',
  GH_OWNER: 'hkimura-web',
  GH_REPO: 'workbase',
  GH_BRANCH: 'main',
  GH_PATH: 'data/morning.json',
  MODELS: ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-2.5-flash'],   // 上から順に試す（名前が変わったら、ここを直す）
  TZ: 'Asia/Tokyo',
  MAX_BODY: 30000,              // AIに渡す文字数の上限
  // 週の予定で、自分に関係するものに黄色の印を付ける言葉
  MARK: /（S）|\(S\)|高校|高1|S1|各学年|主任会|国語|陸上|国際|職員会議|職員研修/,
};

/* 項目（アプリのホームに出る順） */
const SECS = [
  { id: 'tannin', n: '担任（高1）', kw: /高1|高１|S1|１年|1年|学年|HR|ホームルーム|担任|面談|三者|保護者/ },
  { id: 'kokugo', n: '国語科', kw: /国語|漢字|読書|教科写真|教科会|教科/ },
  { id: 'riku', n: '陸上部', kw: /陸上|部活|大会|競技会|記録会|練習/ },
  { id: 'kokusai', n: '国際部', kw: /国際|留学|海外|インバウンド|アウトバウンド|研修旅行|姉妹校/ },
  { id: 'seikatsu', n: '生活指導', kw: /生活指導|生徒指導|服装|違反|遅刻|校則|頭髪|スマホ|携帯|指導課/ },
  { id: 'gyoji', n: '行事・役割', kw: /行事|説明会|入試|係|役割|分担|当日|実施要項|礼拝|集会|式|受付|駐車/ },
];

/* ============ 毎朝動く本体 ============ */
function main() { run_(true); }
/** 試しに動かす（GitHubには書かず、ログに結果を出す） */
function dryRun() { run_(false); }

function run_(write) {
  try {
    const lines = readLines_();
    const res = build_(lines, new Date());
    Logger.log(JSON.stringify(res, null, 1));
    if (write) putGithub_(JSON.stringify(res, null, 1) + '\n', res.date);
  } catch (e) {
    Logger.log('失敗: ' + e);
    try { MailApp.sendEmail(Session.getEffectiveUser().getEmail(), '今朝のまとめの更新に失敗しました', String(e && e.stack || e)); } catch (x) { /* メールが送れなくても続ける */ }
    throw e;
  }
}

function readLines_() {
  const ss = CONF.SHEET_ID ? SpreadsheetApp.openById(CONF.SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();   // IDが空なら、このスクリプトを開いたシートを使う
  const sh = ss.getSheetByName(CONF.SHEET_NAME);
  if (!sh) throw new Error('シートが見つかりません：' + CONF.SHEET_NAME);
  const n = sh.getLastRow(); if (n < 1) throw new Error('シートが空です');
  return sh.getRange(1, 1, n, 1).getValues().map(r => String(r[0] == null ? '' : r[0]).replace(/ /g, ' ').trim()).filter(Boolean);
}

/** 行の並びから、まとめ（morning.json の中身）をつくる。AIが使えなければ抜粋に切り替える */
function build_(lines, now) {
  const sec = splitSections_(lines);
  const date = targetDate_(lines, now);
  const week = parseWeek_(sec[2] || [], date);
  const body = bodyText_(sec);
  let out = null, mode = 'ai';
  if (body.replace(/\s/g, '').length < 20) { out = { top: [], sec: SECS.map(s => ({ id: s.id, n: s.n, items: [] })) }; mode = 'ai'; }
  else {
    try { out = validate_(askGemini_(body, week, date)); } catch (e) { Logger.log('AIが使えませんでした → 抜粋に切り替え：' + e); }
    if (!out) { out = ruleSummarize_(body); mode = 'rule'; }
  }
  return { date: date, made: Utilities.formatDate(now, CONF.TZ, "yyyy-MM-dd'T'HH:mm:ssXXX"), mode: mode, top: out.top, sec: out.sec, week: week };
}

/* ============ 読み取り ============ */
function splitSections_(lines) {
  const sec = {}; let cur = 0;
  lines.forEach(l => {
    const m = /^=+\s*【\s*(\d)\s*[\.．]/.exec(l);
    if (m) { cur = +m[1]; sec[cur] = []; return; }
    if (cur) sec[cur].push(l);
  });
  return sec;
}

/** 「対象日: 11月15日」から、yyyy-MM-dd をつくる。読めなければ今日 */
function targetDate_(lines, now) {
  const m = lines.map(l => /対象日[:：]\s*(\d{1,2})月(\d{1,2})日/.exec(l)).filter(Boolean)[0];
  const y = +Utilities.formatDate(now, CONF.TZ, 'yyyy'), mo = +Utilities.formatDate(now, CONF.TZ, 'M');
  if (!m) return Utilities.formatDate(now, CONF.TZ, 'yyyy-MM-dd');
  let yy = y; if (mo <= 2 && +m[1] >= 11) yy = y - 1; else if (mo >= 11 && +m[1] <= 2) yy = y + 1;
  return yy + '-' + pad_(+m[1]) + '-' + pad_(+m[2]);
}
function pad_(n) { return (n < 10 ? '0' : '') + n; }

/** かっこの外にある「，」「,」で区切る（「学校運営会議（16：00， 第一会議室）」は切らない） */
function splitEv_(t) {
  const out = []; let d = 0, cur = '';
  for (const ch of String(t)) {
    if (ch === '（' || ch === '(') d++; else if (ch === '）' || ch === ')') d = Math.max(0, d - 1);
    if ((ch === '，' || ch === ',') && d === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  out.push(cur.trim());
  return out.filter(Boolean);
}

/** 1週間の予定表（日付・曜日・行事・最終退勤がばらばらの行になっている）を、日ごとにまとめ直す */
function parseWeek_(sec2, date) {
  const stop = sec2.findIndex(l => /分掌・学年・部活・その他/.test(l));
  const reg = stop >= 0 ? sec2.slice(0, stop) : sec2.slice();
  const days = []; let cur = null;
  const isWd = s => /^[日月火水木金土]$/.test(s), isTime = s => /^\d{1,2}[：:]\d{2}$/.test(s) || /^[ー－\-]$/.test(s) || /勤務$/.test(s);
  for (let i = 0; i < reg.length; i++) {
    const l = reg[i];
    if (/^\d{1,2}$/.test(l) && i + 1 < reg.length && isWd(reg[i + 1])) { cur = { day: +l, wd: reg[i + 1], ev: [], out: '' }; days.push(cur); i++; continue; }
    if (!cur) continue;
    if (isTime(l)) { cur.out = /^[ー－\-]$/.test(l) ? '' : l.replace('：', ':'); continue; }
    if (/^(日付|学校行事|最終退勤時刻|行事)/.test(l)) continue;
    splitEv_(l).forEach(e => cur.ev.push(e));
  }
  let y = +date.slice(0, 4), m = +date.slice(5, 7), prev = 0;
  return days.map(d => {
    if (prev && d.day < prev) { m++; if (m > 12) { m = 1; y++; } }
    prev = d.day;
    const me = []; d.ev.forEach((e, i) => { if (CONF.MARK.test(e)) me.push(i); });
    const o = { d: y + '-' + pad_(m) + '-' + pad_(d.day), ev: d.ev, out: d.out };
    if (me.length) o.me = me;
    return o;
  });
}

/** AIに渡す本文：前日の追記・「分掌・学年・部活・その他より」以降・S1学年の連絡 */
function bodyText_(sec) {
  const part = [];
  const junk = l => /^[〇○・●\s]*$/.test(l) || /^記入例/.test(l);
  if (sec[1]) part.push('【前日の追記】\n' + sec[1].filter(l => !junk(l) && !/新たな追記はありません/.test(l)).join('\n'));
  if (sec[2]) { const k = sec[2].findIndex(l => /分掌・学年・部活・その他/.test(l)); part.push('【全体連絡】\n' + sec[2].slice(k >= 0 ? k + 1 : 0).filter(l => !junk(l)).join('\n')); }
  if (sec[3]) part.push('【S1学年の連絡】\n' + sec[3].filter(l => !junk(l) && !/^【\s*\d+月\d+日/.test(l)).join('\n'));
  return part.filter(p => p.split('\n').length > 1).join('\n\n').slice(0, CONF.MAX_BODY);
}

/* ============ AI（Gemini・無料枠） ============ */
const SYSTEM_ = [
  'あなたは、関東学院六浦中学校・高等学校の教員の、朝の連絡の整理係です。',
  '読み手は、高校1年（S1）の担任で、国語科、陸上部の顧問、国際部の校務を担当し、生活指導にも関わる先生です。',
  '渡される朝の連絡の文章から、この先生が今日知っておくべきことだけを、短く整理してJSONで返してください。',
  '',
  '【項目】 tannin=担任（高1）／kokugo=国語科／riku=陸上部／kokusai=国際部／seikatsu=生活指導／gyoji=行事・役割（学校全体の行事、入試、説明会、役割分担）',
  '【今日これだけは（top）】 今日中の対応、期限が近いもの、自分の担当や時刻・場所のあるものを最大3件。lv は、今日中に動く必要があるものは "hi"、確認しておくものは "md"。なければ空の配列。',
  '【書き方】',
  '・1つの項目は最大3文。1文は60字ほど。日付・時刻・場所・数字は残す。',
  '・文章にないことは書かない。分からないときは書かない。推測しない。',
  '・生徒の氏名は書かない。先生の名前は名字だけにする。',
  '・高1に関係しない他学年（J1〜J3、S2、S3）だけの連絡は入れない。全員が対象のものは入れる。',
  '・同じ内容は1つにまとめる。連絡がない項目は items を空の配列にする。',
  '・丁寧語にせず、体言止めか「〜。」で簡潔に。',
].join('\n');

function askGemini_(body, week, date) {
  const key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY が未設定です');
  const wk = week.filter(w => w.d >= date).slice(0, 4).map(w => w.d + '：' + (w.ev.join('、') || 'なし')).join('\n');
  const user = '今日は ' + date + ' です。\n\n【今週の学校の予定（参考。今日から3日以内で本人に関係するものは top に入れてよい）】\n' + wk + '\n\n' + body;
  const schema = {
    type: 'OBJECT', required: ['top', 'sec'],
    properties: {
      top: { type: 'ARRAY', items: { type: 'OBJECT', required: ['lv', 't'], properties: { lv: { type: 'STRING', enum: ['hi', 'md'] }, t: { type: 'STRING' } } } },
      sec: { type: 'ARRAY', items: { type: 'OBJECT', required: ['id', 'items'], properties: { id: { type: 'STRING', enum: SECS.map(s => s.id) }, items: { type: 'ARRAY', items: { type: 'STRING' } } } } },
    },
  };
  let last = '';
  for (const model of CONF.MODELS) {
    for (const withSchema of [true, false]) {
      const gc = { temperature: 0.2, responseMimeType: 'application/json' }; if (withSchema) gc.responseSchema = schema;
      const payload = { systemInstruction: { parts: [{ text: SYSTEM_ + (withSchema ? '' : '\n\n返す形：{"top":[{"lv":"hi|md","t":"…"}],"sec":[{"id":"tannin|kokugo|riku|kokusai|seikatsu|gyoji","items":["…"]}]}') }] }, contents: [{ role: 'user', parts: [{ text: user }] }], generationConfig: gc };
      for (let t = 0; t < 2; t++) {
        const r = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', { method: 'post', contentType: 'application/json', headers: { 'x-goog-api-key': key }, payload: JSON.stringify(payload), muteHttpExceptions: true });
        const code = r.getResponseCode(), txt = r.getContentText();
        if (code === 200) {
          try { const j = JSON.parse(txt); const s = j.candidates[0].content.parts.map(p => p.text || '').join(''); return JSON.parse(s.replace(/^```json\s*|```$/g, '')); } catch (e) { last = model + ' 返事を読めません'; break; }
        }
        last = model + ' ' + code + ' ' + txt.slice(0, 160);
        if (code === 429 || code >= 500) { Utilities.sleep(3000); continue; }   // 混んでいる → 1回だけやり直す
        break;                                                                  // 400など → 次の形・次のモデルへ
      }
    }
  }
  throw new Error('Geminiが使えませんでした：' + last);
}

/** AIの返事を、アプリが読める形に整える（足りない項目は空にする。長すぎる文は切る） */
function validate_(o) {
  if (!o || !Array.isArray(o.sec)) throw new Error('返事の形が違います');
  const cl = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  const top = (Array.isArray(o.top) ? o.top : []).filter(x => x && x.t).slice(0, 3).map(x => ({ lv: x.lv === 'hi' ? 'hi' : 'md', t: cl(x.t, 140) }));
  const sec = SECS.map(s => { const f = o.sec.find(x => x && x.id === s.id); return { id: s.id, n: s.n, items: ((f && f.items) || []).filter(Boolean).slice(0, 4).map(t => cl(t, 180)) }; });
  return { top: top, sec: sec };
}

/* ============ AIなし（そのまま抜粋） ============ */
function ruleSummarize_(body) {
  const lines = body.split('\n').map(l => l.trim()).filter(l => l.length >= 8 && !/^(【[^】]*】[\s，、,　]*)+$/.test(l) && !/^[〇○●・\s]*＜[^＞]*＞$/.test(l));   // 見出しだけの行は除く
  const sec = SECS.map(s => ({ id: s.id, n: s.n, items: [] })), seen = {}, top = [];
  const cl = (s, n) => s.length > n ? s.slice(0, n - 1) + '…' : s;
  lines.forEach(l => {
    if (seen[l]) return; seen[l] = 1;
    let t = SECS.find(s => s.kw.test(l)) || SECS[5];
    const o = sec.find(s => s.id === t.id);
    if (o.items.length < 3) o.items.push(cl(l, 120));
    if (top.length < 3 && /本日中|至急|必ず|期限|締切|〆切|までに/.test(l)) top.push({ lv: /本日中|至急/.test(l) ? 'hi' : 'md', t: cl(l, 120) });
  });
  return { top: top, sec: sec };
}

/* ============ GitHubへ書き込み ============ */
function putGithub_(text, date) {
  const tok = PropertiesService.getScriptProperties().getProperty('GH_TOKEN');
  if (!tok) throw new Error('GH_TOKEN が未設定です');
  const url = 'https://api.github.com/repos/' + CONF.GH_OWNER + '/' + CONF.GH_REPO + '/contents/' + CONF.GH_PATH;
  const h = { Authorization: 'Bearer ' + tok, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  let sha = null;
  const g = UrlFetchApp.fetch(url + '?ref=' + encodeURIComponent(CONF.GH_BRANCH), { headers: h, muteHttpExceptions: true });
  if (g.getResponseCode() === 200) sha = JSON.parse(g.getContentText()).sha; else if (g.getResponseCode() !== 404) throw new Error('GitHubを読めません ' + g.getResponseCode() + ' ' + g.getContentText().slice(0, 160));
  const body = { message: '今朝のまとめ ' + date, content: Utilities.base64Encode(Utilities.newBlob(text).getBytes()), branch: CONF.GH_BRANCH }; if (sha) body.sha = sha;
  const r = UrlFetchApp.fetch(url, { method: 'put', headers: h, contentType: 'application/json', payload: JSON.stringify(body), muteHttpExceptions: true });
  if (r.getResponseCode() >= 300) throw new Error('GitHubに書けません ' + r.getResponseCode() + ' ' + r.getContentText().slice(0, 200));
}

/* ============ 初期設定（最初に1回だけ手で動かす） ============ */
/** 毎朝7:15ごろに main を動かす時刻トリガーを作る（前のトリガーは消す） */
function setupTrigger() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'main').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('main').timeBased().everyDays(1).atHour(7).nearMinute(15).inTimezone(CONF.TZ).create();
  Logger.log('毎朝7:15ごろに main を動かす設定をしました');
}
/** 鍵が入っているか・Geminiが答えるかを確かめる */
function testKeys() {
  const p = PropertiesService.getScriptProperties();
  Logger.log('GEMINI_API_KEY: ' + (p.getProperty('GEMINI_API_KEY') ? 'あり' : 'ありません'));
  Logger.log('GH_TOKEN: ' + (p.getProperty('GH_TOKEN') ? 'あり' : 'ありません'));
  const r = askGemini_('【全体連絡】\n高1の学年集会は明日の朝8:30に講堂で行います。必ず出席してください。', [], Utilities.formatDate(new Date(), CONF.TZ, 'yyyy-MM-dd'));
  Logger.log('Geminiの返事：' + JSON.stringify(r));
}
