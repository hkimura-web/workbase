#!/usr/bin/env python3
"""学校の資料一覧(xlsx) → work/shiryo.json に変換する。

使い方:  python3 tools/xlsx_to_shiryo.py 資料一覧.xlsx work/shiryo.json [年度=2026]

- 「各種資料一覧」「事務関係資料一覧」「HPリンク集」の3シートを読む。
- このアプリのデータは公開リポジトリに入るので、次は取り込まない:
  ・ログインID等の列、パスワード・鍵番号らしい文字、アカウント一覧
  ・名簿類（分類「名簿」全部、生徒の氏名が並ぶ一覧：アルバイト許可・自転車通学・留学生徒・参加者名簿など）
- ハイパーリンクのないセルの文字は、リンクなしの文字（「作成・確認中」など）として残す。
"""
import sys, re, json, datetime, unicodedata
import openpyxl

SECRET = re.compile(r"パスワード|password|ID・?Pass|ユーザー名|pass\d{4}|^[A-Za-z]:\\|鍵番号|アカウント", re.I)
SKIP_CAT = {"名簿"}
SKIP_ITEM = re.compile(r"アルバイト許可|自転車通学|異服装|Olive Junior.*受講者|留学生徒一覧|留学生一覧|参加者名簿|在籍生徒|公欠認定|名簿|名列")


def n(s): return unicodedata.normalize("NFKC", s or "")
def txt(c): return re.sub(r"\s+", " ", str(c.value).strip()) if c.value is not None else ""
def url(c):
    u = c.hyperlink.target if c.hyperlink and c.hyperlink.target else ""
    return u if u.startswith("http") else ""


def flabel(text, u):
    t = n(text).lower()
    if not text or text.startswith("http"): return "開く"
    if re.search(r"\.xlsx?\b|ｘｌｓ", t): return "Excel"
    if re.search(r"\.docx?\b", t): return "Word"
    if ".pdf" in t: return "PDF"
    return text if len(text) <= 18 else text[:17] + "…"


def main(src, dst, year="2026"):
    wb = openpyxl.load_workbook(src)
    out = {"built": datetime.date.today().isoformat(), "year": int(year), "sections": []}
    skipped = []

    # 各種資料一覧: C分類 D項目 E管轄 F今年度 G前年度 H備考
    cats, cur = [], {"c": "全般", "items": []}
    cats.append(cur)
    for r in wb["各種資料一覧"].iter_rows(min_row=1):
        t = txt(r[3])
        if not t or t == "項目": continue
        if txt(r[2]): cur = {"c": txt(r[2]), "items": []}; cats.append(cur)
        if cur is None: continue
        if cur["c"] in SKIP_CAT or SKIP_ITEM.search(t) or SECRET.search(n(t)):
            skipped.append(cur["c"] + "／" + t); continue
        it = {"t": t, "dept": txt(r[4]), "note": txt(r[7])}
        for k, c in (("cur", r[5]), ("prev", r[6])):
            x = txt(c)
            if SECRET.search(n(x)): continue
            if x or url(c): it[k] = {"t": x, "u": url(c)}
        cur["items"].append(it)
    out["sections"].append({"id": "gen", "title": "学校の資料", "cats": [c for c in cats if c["items"]]})

    # 事務関係資料一覧: C分類 D項目 Eファイル F備考
    cats, cur = [], None
    for r in wb["事務関係資料一覧"].iter_rows(min_row=1):
        t = txt(r[3])
        if not t or t == "項目": continue
        if txt(r[2]): cur = {"c": txt(r[2]), "items": []}; cats.append(cur)
        if cur is None or SECRET.search(n(t)): continue
        files, note = [], ""
        for c in (r[4], r[5]):
            x = txt(c); u = url(c)
            if u: files.append({"t": flabel(x, u), "u": u})
            elif x and c is r[5]: note = x
            elif x: note = (note + " " + x).strip()
        cur["items"].append({"t": t, "files": files, "note": "" if SECRET.search(n(note)) else note})
    out["sections"].append({"id": "jimu", "title": "事務・届出", "cats": [c for c in cats if c["items"]]})

    # HPリンク集: C項目 D URL（E ログインID等 は取り込まない）
    items = []
    for r in wb["HPリンク集"].iter_rows(min_row=3):
        t = txt(r[2]); u = url(r[3]) or (txt(r[3]) if txt(r[3]).startswith("http") else "")
        if t and u: items.append({"t": t, "files": [{"t": "開く", "u": u}], "note": ""})
    out["sections"].append({"id": "hp", "title": "学内サイト", "cats": [{"c": "サイト", "items": items}]})

    json.dump(out, open(dst, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("OK", dst, [(s["title"], sum(len(c["items"]) for c in s["cats"])) for s in out["sections"]])
    print("取り込まなかった:", len(skipped)); [print("  -", s) for s in skipped]


if __name__ == "__main__":
    if len(sys.argv) < 3: sys.exit(__doc__)
    main(*sys.argv[1:4])
