from __future__ import annotations

import json
import math
from pathlib import Path
from statistics import mean

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
DEM_DIR = ROOT / "data" / "WuHanDEM"
WEB_DEM_DIR = ROOT / "web" / "public" / "data" / "dem" / "wuhan"
WEB_MOCK_DIR = ROOT / "web" / "public" / "data" / "mock" / "wuhan"
BACKEND_MOCK_DIR = ROOT / "database" / "mock" / "backend-sim"


def read_world_file(path: Path) -> dict[str, float]:
    values = [float(line.strip()) for line in path.read_text(encoding="utf8").splitlines() if line.strip()]
    if len(values) != 6:
        raise ValueError(f"World file must contain 6 values: {path}")
    return {
        "pixel_x": values[0],
        "rotation_y": values[1],
        "rotation_x": values[2],
        "pixel_y": values[3],
        "origin_x": values[4],
        "origin_y": values[5],
    }


def image_bounds(image: Image.Image, world: dict[str, float]) -> dict[str, float]:
    width, height = image.size
    west = world["origin_x"]
    north = world["origin_y"]
    east = west + world["pixel_x"] * width
    south = north + world["pixel_y"] * height
    return {
        "west": round(min(west, east), 10),
        "south": round(min(south, north), 10),
        "east": round(max(west, east), 10),
        "north": round(max(south, north), 10),
    }


def normalize_to_gray(image: Image.Image) -> Image.Image:
    if image.mode in ("L", "RGB", "RGBA"):
        return image.convert("L")
    converted = image.convert("F")
    extrema = converted.getextrema()
    low, high = float(extrema[0]), float(extrema[1])
    if not math.isfinite(low) or not math.isfinite(high) or high <= low:
        return Image.new("L", image.size, 128)
    scale = 255 / (high - low)
    return converted.point(lambda value: (value - low) * scale).convert("L")


def sample_raster(image: Image.Image, world: dict[str, float], lng: float, lat: float) -> float | None:
    x = int(round((lng - world["origin_x"]) / world["pixel_x"]))
    y = int(round((lat - world["origin_y"]) / world["pixel_y"]))
    width, height = image.size
    if x < 0 or y < 0 or x >= width or y >= height:
        return None
    value = image.getpixel((x, y))
    if isinstance(value, tuple):
        value = value[0]
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(number):
        return None
    return number


def sample_line(points: list[list[float]], samples: int) -> list[tuple[float, float, float]]:
    if len(points) < 2:
        return []
    segments: list[tuple[list[float], list[float], float]] = []
    total = 0.0
    for start, end in zip(points, points[1:]):
        lon1, lat1 = start
        lon2, lat2 = end
        x = (lon2 - lon1) * math.cos(math.radians((lat1 + lat2) / 2)) * 111
        y = (lat2 - lat1) * 111
        dist = math.hypot(x, y)
        segments.append((start, end, dist))
        total += dist
    if total <= 0:
        return []

    result: list[tuple[float, float, float]] = []
    for index in range(samples):
        target = total * (index / max(1, samples - 1))
        walked = 0.0
        for start, end, dist in segments:
            if walked + dist >= target or dist == 0:
                local = 0 if dist == 0 else (target - walked) / dist
                lon = start[0] + (end[0] - start[0]) * local
                lat = start[1] + (end[1] - start[1]) * local
                result.append((round(lon, 6), round(lat, 6), round(index / max(1, samples - 1), 4)))
                break
            walked += dist
    return result


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf8")


def merge_by_id(items: list[dict], additions: list[dict]) -> list[dict]:
    addition_ids = {item["id"] for item in additions}
    merged = [item for item in items if item.get("id") not in addition_ids]
    merged.extend(additions)
    return merged


def build_assets() -> None:
    WEB_DEM_DIR.mkdir(parents=True, exist_ok=True)
    WEB_MOCK_DIR.mkdir(parents=True, exist_ok=True)
    BACKEND_MOCK_DIR.mkdir(parents=True, exist_ok=True)

    hillshade_path = DEM_DIR / "HillShadeWH.tif"
    dem_path = DEM_DIR / "WuhanDEM84.tif"
    projected_dem_path = DEM_DIR / "WuHanDEM.tif"
    hillshade = Image.open(hillshade_path)
    dem = Image.open(dem_path)
    projected_dem = Image.open(projected_dem_path)
    hillshade_world = read_world_file(DEM_DIR / "HillShadeWH.tfw")
    dem_world = read_world_file(DEM_DIR / "WuhanDEM84.tfw")
    projected_world = read_world_file(DEM_DIR / "WuHanDEM.tfw")

    hillshade_png = normalize_to_gray(hillshade)
    hillshade_png.save(WEB_DEM_DIR / "hillshade-wh.png", optimize=True)

    dem_gray = normalize_to_gray(dem)
    dem_gray.thumbnail((900, 900))
    dem_gray.save(WEB_DEM_DIR / "dem-preview.png", optimize=True)

    route_file = WEB_MOCK_DIR / "uav-routes.geojson"
    routes = json.loads(route_file.read_text(encoding="utf8"))
    route_profiles = []
    all_values: list[float] = []
    for feature in routes.get("features", []):
        coords = feature.get("geometry", {}).get("coordinates", [])
        route_samples = []
        values = []
        for lng, lat, progress in sample_line(coords, 18):
            ground = sample_raster(dem, dem_world, lng, lat)
            if ground is None:
                continue
            ground_m = round(ground, 1)
            values.append(ground_m)
            all_values.append(ground_m)
            altitude = float(feature.get("properties", {}).get("altitude", 120))
            route_samples.append(
                {
                    "lng": lng,
                    "lat": lat,
                    "progress": progress,
                    "groundElevationM": ground_m,
                    "flightAltitudeM": altitude,
                    "clearanceM": round(altitude - ground_m, 1),
                }
            )
        route_profiles.append(
            {
                "routeId": feature.get("properties", {}).get("id"),
                "routeName": feature.get("properties", {}).get("name"),
                "samples": route_samples,
                "summary": {
                    "minGroundM": min(values) if values else None,
                    "maxGroundM": max(values) if values else None,
                    "avgGroundM": round(mean(values), 1) if values else None,
                    "minClearanceM": min((sample["clearanceM"] for sample in route_samples), default=None),
                    "maxClearanceM": max((sample["clearanceM"] for sample in route_samples), default=None),
                },
            }
        )

    metadata = {
        "id": "wuhan-dem",
        "name": "武汉 DEM 地形数据",
        "scope": "武汉市",
        "sourceDir": "data/WuHanDEM",
        "crs": "WGS84 for WuhanDEM84 and HillShadeWH; projected meters for WuHanDEM",
        "assets": {
            "hillshadePng": "/data/dem/wuhan/hillshade-wh.png",
            "demPreviewPng": "/data/dem/wuhan/dem-preview.png",
        },
        "rasters": [
            {
                "id": "hillshade-wh",
                "file": "HillShadeWH.tif",
                "webAsset": "/data/dem/wuhan/hillshade-wh.png",
                "width": hillshade.size[0],
                "height": hillshade.size[1],
                "bounds": image_bounds(hillshade, hillshade_world),
                "worldFile": hillshade_world,
                "usage": "二维地图与低空页面地形阴影叠加",
            },
            {
                "id": "wuhan-dem-84",
                "file": "WuhanDEM84.tif",
                "webAsset": "/data/dem/wuhan/dem-preview.png",
                "width": dem.size[0],
                "height": dem.size[1],
                "bounds": image_bounds(dem, dem_world),
                "worldFile": dem_world,
                "usage": "航线地形采样、高程概览与净空校核",
            },
            {
                "id": "wuhan-dem-projected",
                "file": "WuHanDEM.tif",
                "width": projected_dem.size[0],
                "height": projected_dem.size[1],
                "worldFile": projected_world,
                "usage": "原始投影 DEM，保留给后端/GIS 工具进一步处理",
            },
        ],
        "summary": {
            "sampledRouteCount": len(route_profiles),
            "sampleElevationMinM": min(all_values) if all_values else None,
            "sampleElevationMaxM": max(all_values) if all_values else None,
            "sampleElevationAvgM": round(mean(all_values), 1) if all_values else None,
        },
        "note": "由 data/WuHanDEM 原始 GeoTIFF 转换。前端展示 PNG 和采样结果，不直接读取 GeoTIFF。",
    }

    route_profile_file = {
        "routes": route_profiles,
        "meta": {
            "scope": "武汉市",
            "source": "data/WuHanDEM/WuhanDEM84.tif",
            "version": "dem-wuhan-2026",
        },
    }

    for target_dir in [WEB_MOCK_DIR, BACKEND_MOCK_DIR]:
        write_json(target_dir / "dem-metadata.json", metadata)
        write_json(target_dir / "uav-route-terrain-profiles.json", route_profile_file)

    dem_source = {
        "id": "dem-wuhan-2026",
        "label": "武汉 DEM 地形数据",
        "description": "由 data/WuHanDEM 原始 GeoTIFF 转换的地形阴影、DEM 元数据与无人机航线高程采样。",
        "isActive": True,
    }
    dem_layers = [
        {
            "id": "wuhan-dem-hillshade",
            "name": "武汉 DEM 地形阴影",
            "dataSource": "基础地理",
            "tableName": "dem_hillshade_wh",
            "geomType": "Raster",
            "metric": "地形阴影、地貌起伏",
            "ruleText": "由 HillShadeWH.tif 转为前端 PNG 叠加",
            "unit": "灰度",
            "sortOrder": 6,
        },
        {
            "id": "uav-route-terrain-profiles",
            "name": "无人机航线地形剖面",
            "dataSource": "基础地理",
            "tableName": "uav_route_terrain_profiles",
            "geomType": "None",
            "metric": "地面高程、相对净空",
            "ruleText": "由 WuhanDEM84.tif 对航线采样生成",
            "unit": "米",
            "sortOrder": 27,
        },
    ]
    endpoint_map = {
        "GET /api/v1/wuhan/terrain/dem?ds=dem-wuhan-2026": metadata,
        "GET /api/v1/wuhan/terrain/uav-profiles?ds=dem-wuhan-2026": route_profile_file,
    }

    for target_dir in [WEB_MOCK_DIR, BACKEND_MOCK_DIR]:
        data_sources_file = target_dir / "data-sources.json"
        if data_sources_file.exists():
            data_sources = json.loads(data_sources_file.read_text(encoding="utf8"))
            write_json(data_sources_file, merge_by_id(data_sources, [dem_source]))

        layer_catalog_file = target_dir / "layer-catalog.json"
        if layer_catalog_file.exists():
            layers = json.loads(layer_catalog_file.read_text(encoding="utf8"))
            merged_layers = merge_by_id(layers, dem_layers)
            merged_layers.sort(key=lambda item: item.get("sortOrder", 0))
            write_json(layer_catalog_file, merged_layers)

        fixtures_file = target_dir / "api-fixtures.json"
        if fixtures_file.exists():
            fixtures = json.loads(fixtures_file.read_text(encoding="utf8"))
            fixtures.setdefault("endpoints", {}).update(endpoint_map)
            if data_sources_file.exists():
                fixtures["endpoints"]["GET /api/v1/wuhan/metadata/data-sources"] = json.loads(
                    data_sources_file.read_text(encoding="utf8")
                )
            if layer_catalog_file.exists():
                fixtures["endpoints"]["GET /api/v1/wuhan/metadata/layers"] = json.loads(
                    layer_catalog_file.read_text(encoding="utf8")
                )
            write_json(fixtures_file, fixtures)

    write_json(WEB_DEM_DIR / "dem-metadata.json", metadata)
    write_json(WEB_DEM_DIR / "uav-route-terrain-profiles.json", route_profile_file)

    print(f"Generated DEM assets in {WEB_DEM_DIR}")


if __name__ == "__main__":
    build_assets()
