#!/usr/bin/env python3
"""Download Overture Wuhan buildings in tiles, merge to a single GeoJSON."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT = REPO_ROOT / "web" / "public" / "geo" / "wuhan" / "buildings.geojson"
TILE_DIR = REPO_ROOT / "web" / "public" / "geo" / "wuhan" / "_building_tiles"

DEFAULT_BBOX = (113.95, 30.40, 114.55, 30.75)  # west, south, east, north
WIDE_BBOX = (113.88, 30.22, 114.58, 30.78)

TILE_ATTEMPTS = 5


def utf8_env() -> dict[str, str]:
    env = os.environ.copy()
    env["PYTHONUTF8"] = "1"
    env["PYTHONIOENCODING"] = "utf-8"
    return env


def tile_bboxes(bbox: tuple[float, float, float, float], cols: int, rows: int) -> list[tuple[str, tuple[float, float, float, float]]]:
    west, south, east, north = bbox
    dx = (east - west) / cols
    dy = (north - south) / rows
    tiles: list[tuple[str, tuple[float, float, float, float]]] = []
    for row in range(rows):
        for col in range(cols):
            w = west + col * dx
            e = west + (col + 1) * dx
            s = south + row * dy
            n = south + (row + 1) * dy
            tiles.append((f"tile_{row}_{col}", (w, s, e, n)))
    return tiles


def run_download(bbox: tuple[float, float, float, float], output: Path) -> None:
    west, south, east, north = bbox
    bbox_str = f"{west:.4f},{south:.4f},{east:.4f},{north:.4f}"
    cmd = [
        sys.executable,
        "-m",
        "overturemaps",
        "download",
        f"--bbox={bbox_str}",
        "-f",
        "geoparquet",
        "--type=building",
        "-o",
        str(output),
        "--connect_timeout",
        "120",
        "--request_timeout",
        "900",
    ]
    print("[cmd]", " ".join(cmd))
    subprocess.check_call(cmd, env=utf8_env())


def download_tile(name: str, bbox: tuple[float, float, float, float], out_dir: Path) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    target = out_dir / f"{name}.parquet"
    if target.exists() and target.stat().st_size > 1000:
        print(f"[skip] {name} already exists ({target.stat().st_size // 1024} KB)")
        return target

    temp = out_dir / f"{name}.parquet.part"
    last_err: Exception | None = None
    for attempt in range(1, TILE_ATTEMPTS + 1):
        try:
            print(f"[tile] {name} attempt {attempt}/{TILE_ATTEMPTS}")
            if temp.exists():
                try:
                    temp.unlink()
                except OSError:
                    pass
            run_download(bbox, temp)
            if not temp.is_file() or temp.stat().st_size <= 100:
                raise RuntimeError("empty tile output")
            if target.exists():
                target.unlink()
            temp.replace(target)
            return target
        except Exception as err:  # noqa: BLE001
            last_err = err
            print(f"[warn] {name} failed: {err}")
            for p in (temp,):
                if p.exists():
                    try:
                        p.unlink()
                    except OSError:
                        pass
            time.sleep(min(60, 10 * attempt))
    raise RuntimeError(f"tile {name} failed") from last_err


def geometry_to_geojson(geom) -> dict | None:
    if geom is None:
        return None
    if isinstance(geom, dict) and geom.get("type"):
        return geom
    if isinstance(geom, (bytes, memoryview)):
        from shapely import wkb
        from shapely.geometry import mapping

        return mapping(wkb.loads(bytes(geom)))
    if hasattr(geom, "__geo_interface__"):
        return geom.__geo_interface__
    return None


def parquet_to_features(path: Path) -> list[dict]:
    import pyarrow.parquet as pq

    table = pq.read_table(path)
    rows = table.to_pylist()
    features: list[dict] = []
    for row in rows:
        geom = geometry_to_geojson(row.get("geometry"))
        if geom is None:
            continue
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
    return features


def merge_tiles(tile_dir: Path, output: Path) -> int:
    output.parent.mkdir(parents=True, exist_ok=True)
    tmp = output.with_suffix(".geojson.tmp")
    total = 0
    first = True
    with tmp.open("w", encoding="utf-8") as fp:
        fp.write('{"type":"FeatureCollection","features":[')
        for pq_path in sorted(tile_dir.glob("*.parquet")):
            tile_count = 0
            for feat in parquet_to_features(pq_path):
                if not first:
                    fp.write(",")
                json.dump(feat, fp, ensure_ascii=False, separators=(",", ":"))
                first = False
                tile_count += 1
                total += 1
            print(f"[merge] {pq_path.name}: +{tile_count} features (total {total})")
        fp.write("]}")
    tmp.replace(output)
    return total


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--wide", action="store_true")
    parser.add_argument("--cols", type=int, default=3)
    parser.add_argument("--rows", type=int, default=3)
    parser.add_argument("--merge-only", action="store_true", help="merge existing parquet tiles only")
    parser.add_argument("-o", "--output", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()

    if args.merge_only:
        total = merge_tiles(TILE_DIR, args.output)
        size_mb = args.output.stat().st_size / (1024 * 1024)
        print(f"[done] {args.output} · {total} features · {size_mb:.1f} MB")
        return 0

    bbox = WIDE_BBOX if args.wide else DEFAULT_BBOX
    tiles = tile_bboxes(bbox, args.cols, args.rows)
    print(f"[plan] {len(tiles)} tiles for bbox {bbox}")

    for name, tb in tiles:
        download_tile(name, tb, TILE_DIR)

    total = merge_tiles(TILE_DIR, args.output)
    size_mb = args.output.stat().st_size / (1024 * 1024)
    print(f"[done] {args.output} · {total} features · {size_mb:.1f} MB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
