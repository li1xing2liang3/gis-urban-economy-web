#!/usr/bin/env python3
"""Export Wuhan building parquet tiles to web GeoJSON with zoom detail levels."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import pyarrow.parquet as pq
from shapely import wkb
from shapely.geometry import mapping

REPO_ROOT = Path(__file__).resolve().parents[1]
PARQUET_DIR = REPO_ROOT / "web/public/geo/wuhan/_building_tiles"
OUT_DIR = REPO_ROOT / "web/public/geo/wuhan/buildings"

DEFAULT_BBOX = (113.95, 30.40, 114.55, 30.75)
COLS = 3
ROWS = 3

LEVELS: dict[str, float | None] = {
    "low": 0.00018,
    "mid": 0.00006,
    "high": None,
}


def tile_meta(bbox: tuple[float, float, float, float]) -> list[dict]:
    west, south, east, north = bbox
    dx = (east - west) / COLS
    dy = (north - south) / ROWS
    tiles: list[dict] = []
    for row in range(ROWS):
        for col in range(COLS):
            w = west + col * dx
            e = west + (col + 1) * dx
            s = south + row * dy
            n = south + (row + 1) * dy
            tiles.append(
                {
                    "id": f"tile_{row}_{col}",
                    "row": row,
                    "col": col,
                    "bounds": [[s, w], [n, e]],
                }
            )
    return tiles


def geom_to_geojson(raw) -> dict | None:
    if raw is None:
        return None
    if isinstance(raw, dict) and raw.get("type"):
        return raw
    if isinstance(raw, (bytes, memoryview)):
        return mapping(wkb.loads(bytes(raw)))
    if hasattr(raw, "__geo_interface__"):
        return raw.__geo_interface__
    return None


def simplify_geom(geom: dict, tolerance: float | None) -> dict:
    if tolerance is None:
        return geom
    from shapely.geometry import shape

    shp = shape(geom).simplify(tolerance, preserve_topology=True)
    if shp.is_empty:
        return geom
    return mapping(shp)


def export_tile(parquet: Path, out: Path, tolerance: float | None) -> int:
    table = pq.read_table(parquet)
    rows = table.to_pylist()
    features: list[dict] = []
    for row in rows:
        geom = geom_to_geojson(row.get("geometry"))
        if geom is None:
            continue
        geom = simplify_geom(geom, tolerance)
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "id": row.get("id"),
                    "height": row.get("height"),
                    "num_floors": row.get("num_floors"),
                    "class": row.get("class"),
                },
                "geometry": geom,
            }
        )
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8") as fp:
        json.dump({"type": "FeatureCollection", "features": features}, fp, ensure_ascii=False, separators=(",", ":"))
    return len(features)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--bbox", default=",".join(map(str, DEFAULT_BBOX)))
    args = parser.parse_args()
    bbox = tuple(float(x) for x in args.bbox.split(","))  # type: ignore[assignment]

    manifest_tiles = tile_meta(bbox)
    stats: dict[str, dict[str, int]] = {}

    for level, tol in LEVELS.items():
        level_dir = OUT_DIR / level
        stats[level] = {}
        for tile in manifest_tiles:
            tid = tile["id"]
            parquet = PARQUET_DIR / f"{tid}.parquet"
            if not parquet.is_file():
                print(f"[skip] missing {parquet}")
                continue
            out = level_dir / f"{tid}.geojson"
            count = export_tile(parquet, out, tol)
            stats[level][tid] = count
            mb = out.stat().st_size / (1024 * 1024)
            print(f"[{level}] {tid}: {count} features, {mb:.1f} MB")

    manifest = {
        "bbox": list(bbox),
        "cols": COLS,
        "rows": ROWS,
        "levels": {
            "low": {"minZoom": 12, "maxZoom": 13, "toleranceDeg": LEVELS["low"]},
            "mid": {"minZoom": 14, "maxZoom": 15, "toleranceDeg": LEVELS["mid"]},
            "high": {"minZoom": 16, "maxZoom": 22, "toleranceDeg": None},
        },
        "tiles": manifest_tiles,
        "stats": stats,
    }
    manifest_path = OUT_DIR / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"[done] manifest -> {manifest_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
