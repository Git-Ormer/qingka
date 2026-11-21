"""从 Open Food Facts 官方 CSV dump 生成条码包。

用法：
    python tools/build_pack.py --csv .tmp-data/off.csv.gz --country new-zealand \
        --out js/packs/nz.js --var NZ_PACK --title "新西兰包装食品" --limit 2500

注意事项：
- 数据来自 Open Food Facts，ODbL 许可，分发时必须保留署名。
- 只读取需要的列，适合流式处理 1.5 GB 的 gzip CSV。
"""
from __future__ import annotations

import argparse
import csv
import gzip
import json
import re
import sys
from datetime import date
from pathlib import Path


def num(value) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def clean(value, max_len: int) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    text = "".join(ch for ch in text if ch >= " ")
    return text[:max_len]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", required=True)
    ap.add_argument("--country", default="new-zealand")
    ap.add_argument("--limit", type=int, default=2500)
    ap.add_argument("--out", required=True)
    ap.add_argument("--var", default="NZ_PACK")
    ap.add_argument("--title", default="新西兰包装食品")
    args = ap.parse_args()

    tag = "en:" + args.country
    rows: list[dict] = []
    seen: set[str] = set()
    scanned = 0

    with gzip.open(args.csv, "rt", encoding="utf-8", errors="replace") as fh:
        reader = csv.reader(fh, delimiter="\t")
        header = next(reader)
        idx = {name: i for i, name in enumerate(header)}
        required = [
            "code", "product_name", "brands", "countries_tags", "quantity",
            "unique_scans_n", "energy-kcal_100g", "energy_100g",
            "carbohydrates_100g", "proteins_100g", "fat_100g",
        ]
        missing = [c for c in required if c not in idx]
        if missing:
            raise SystemExit("CSV 缺少列: " + ", ".join(missing))

        for row in reader:
            scanned += 1
            if scanned % 500000 == 0:
                print(f"  scanned {scanned:,} rows, {len(rows):,} matched", file=sys.stderr)

            if tag not in row[idx["countries_tags"]]:
                continue

            code = row[idx["code"]].strip()
            if not code.isdigit() or not (8 <= len(code) <= 14) or code in seen:
                continue

            name = clean(row[idx["product_name"]], 80)
            if not name:
                continue

            kcal = num(row[idx["energy-kcal_100g"]])
            if not kcal:
                kj = num(row[idx["energy_100g"]])
                if kj:
                    kcal = kj / 4.184
            carb = max(0.0, num(row[idx["carbohydrates_100g"]]))
            protein = max(0.0, num(row[idx["proteins_100g"]]))
            fat = max(0.0, num(row[idx["fat_100g"]]))
            if kcal <= 0 or kcal > 900:
                continue
            if carb + protein + fat > 100.5:
                continue
            if not (carb or protein or fat):
                continue

            qty = row[idx["quantity"]] or ""
            unit = "ml" if re.search(r"\d\s*(ml|cl|l)\b", qty, re.I) else "g"
            brand = clean((row[idx["brands"]] or "").split(",")[0], 40)
            scans = int(num(row[idx["unique_scans_n"]]))

            rows.append({
                "code": code,
                "name": name,
                "brand": brand,
                "kcal": round(kcal),
                "carb": round(carb, 1),
                "protein": round(protein, 1),
                "fat": round(fat, 1),
                "unit": unit,
                "scans": scans,
            })
            seen.add(code)

    rows.sort(key=lambda r: r["scans"], reverse=True)
    selected = rows[: args.limit]
    items = [
        [r["code"], r["name"], r["brand"], r["kcal"], r["carb"], r["protein"], r["fat"], r["unit"]]
        for r in selected
    ]

    payload = {
        "meta": {
            "name": args.title,
            "source": "Open Food Facts",
            "sourceUrl": "https://world.openfoodfacts.org",
            "license": "ODbL",
            "country": args.country,
            "updated": date.today().isoformat(),
            "count": len(items),
        },
        "items": items,
    }

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    out.write_text(
        "/* 自动生成，请勿手改。数据来自 Open Food Facts（ODbL 1.0），"
        "署名：Contains data from Open Food Facts, available under the Open Database License. */\n"
        f"window.{args.var} = {body};\n",
        encoding="utf-8",
    )

    print(f"matched={len(rows):,} selected={len(selected):,} file={out} size={out.stat().st_size:,}B")


if __name__ == "__main__":
    main()
