"""Build a lightweight Gwangju administrative-neighborhood SVG data file.

The source is the zipped 2025 Q2 statistical boundary Shapefile stored next to
this project.  No third-party Python packages are required.
"""

from __future__ import annotations

import json
import math
import struct
import zipfile
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
BOUNDARY_DIR = PROJECT_ROOT.parent / "bnd_all_00_2025_2Q"
SOURCE_ZIP = BOUNDARY_DIR / "bnd_dong_00_2025_2Q.zip"
OUTPUT_FILE = PROJECT_ROOT / "src" / "assets" / "data" / "gwangju-neighborhood-map.json"

VIEWBOX_WIDTH = 900
VIEWBOX_HEIGHT = 560
VIEWBOX_PADDING = 22
SIMPLIFY_TOLERANCE_METERS = 24.0

DISTRICTS = {
    "24010": {"id": "dong-gu", "name": "동구", "color": "#2563EB"},
    "24020": {"id": "seo-gu", "name": "서구", "color": "#0EA5E9"},
    "24030": {"id": "nam-gu", "name": "남구", "color": "#8B5CF6"},
    "24040": {"id": "buk-gu", "name": "북구", "color": "#14B8A6"},
    "24050": {"id": "gwangsan-gu", "name": "광산구", "color": "#F59E0B"},
}


def read_dbf_rows(data: bytes) -> list[dict[str, str]]:
    record_count = struct.unpack("<I", data[4:8])[0]
    header_length, record_length = struct.unpack("<HH", data[8:12])
    fields: list[tuple[str, int]] = []
    offset = 32

    while data[offset] != 0x0D:
        descriptor = data[offset : offset + 32]
        name = descriptor[:11].split(b"\0", 1)[0].decode("ascii")
        fields.append((name, descriptor[16]))
        offset += 32

    rows: list[dict[str, str]] = []
    for index in range(record_count):
        record = data[
            header_length + index * record_length : header_length + (index + 1) * record_length
        ]
        position = 1
        row: dict[str, str] = {}
        for name, length in fields:
            raw = record[position : position + length]
            position += length
            row[name] = raw.rstrip(b" \0").decode("utf-8")
        rows.append(row)
    return rows


def perpendicular_distance(point: tuple[float, float], start: tuple[float, float], end: tuple[float, float]) -> float:
    if start == end:
        return math.dist(point, start)
    dx = end[0] - start[0]
    dy = end[1] - start[1]
    return abs(dy * point[0] - dx * point[1] + end[0] * start[1] - end[1] * start[0]) / math.hypot(dx, dy)


def rdp(points: list[tuple[float, float]], tolerance: float) -> list[tuple[float, float]]:
    if len(points) <= 2:
        return points
    maximum = 0.0
    split_index = 0
    for index in range(1, len(points) - 1):
        distance = perpendicular_distance(points[index], points[0], points[-1])
        if distance > maximum:
            maximum = distance
            split_index = index
    if maximum <= tolerance:
        return [points[0], points[-1]]
    left = rdp(points[: split_index + 1], tolerance)
    right = rdp(points[split_index:], tolerance)
    return left[:-1] + right


def simplify_ring(points: list[tuple[float, float]], tolerance: float) -> list[tuple[float, float]]:
    if len(points) < 5:
        return points
    if points[0] == points[-1]:
        points = points[:-1]
    start_index = min(range(len(points)), key=lambda index: (points[index][0], points[index][1]))
    rotated = points[start_index:] + points[:start_index]
    far_index = max(
        range(1, len(rotated)),
        key=lambda index: (rotated[index][0] - rotated[0][0]) ** 2 + (rotated[index][1] - rotated[0][1]) ** 2,
    )
    first_arc = rdp(rotated[: far_index + 1], tolerance)
    second_arc = rdp(rotated[far_index:] + [rotated[0]], tolerance)
    simplified = first_arc[:-1] + second_arc[:-1]
    if len(simplified) < 3:
        simplified = rotated
    return simplified + [simplified[0]]


def inverse_epsg_5179(x: float, y: float) -> tuple[float, float]:
    # GRS80 / Korea 2000 Unified CS (EPSG:5179)
    semi_major = 6_378_137.0
    inverse_flattening = 298.257222101
    flattening = 1.0 / inverse_flattening
    eccentricity_sq = flattening * (2.0 - flattening)
    eccentricity_prime_sq = eccentricity_sq / (1.0 - eccentricity_sq)
    scale = 0.9996
    false_easting = 1_000_000.0
    false_northing = 2_000_000.0
    origin_latitude = math.radians(38.0)
    central_meridian = math.radians(127.5)

    def meridional_arc(latitude: float) -> float:
        e2 = eccentricity_sq
        return semi_major * (
            (1 - e2 / 4 - 3 * e2**2 / 64 - 5 * e2**3 / 256) * latitude
            - (3 * e2 / 8 + 3 * e2**2 / 32 + 45 * e2**3 / 1024) * math.sin(2 * latitude)
            + (15 * e2**2 / 256 + 45 * e2**3 / 1024) * math.sin(4 * latitude)
            - (35 * e2**3 / 3072) * math.sin(6 * latitude)
        )

    m = meridional_arc(origin_latitude) + (y - false_northing) / scale
    mu = m / (
        semi_major
        * (1 - eccentricity_sq / 4 - 3 * eccentricity_sq**2 / 64 - 5 * eccentricity_sq**3 / 256)
    )
    e1 = (1 - math.sqrt(1 - eccentricity_sq)) / (1 + math.sqrt(1 - eccentricity_sq))
    phi1 = (
        mu
        + (3 * e1 / 2 - 27 * e1**3 / 32) * math.sin(2 * mu)
        + (21 * e1**2 / 16 - 55 * e1**4 / 32) * math.sin(4 * mu)
        + (151 * e1**3 / 96) * math.sin(6 * mu)
        + (1097 * e1**4 / 512) * math.sin(8 * mu)
    )

    sin_phi1 = math.sin(phi1)
    cos_phi1 = math.cos(phi1)
    tan_phi1 = math.tan(phi1)
    n1 = semi_major / math.sqrt(1 - eccentricity_sq * sin_phi1**2)
    r1 = semi_major * (1 - eccentricity_sq) / (1 - eccentricity_sq * sin_phi1**2) ** 1.5
    t1 = tan_phi1**2
    c1 = eccentricity_prime_sq * cos_phi1**2
    d = (x - false_easting) / (n1 * scale)

    latitude = phi1 - (n1 * tan_phi1 / r1) * (
        d**2 / 2
        - (5 + 3 * t1 + 10 * c1 - 4 * c1**2 - 9 * eccentricity_prime_sq) * d**4 / 24
        + (61 + 90 * t1 + 298 * c1 + 45 * t1**2 - 252 * eccentricity_prime_sq - 3 * c1**2) * d**6 / 720
    )
    longitude = central_meridian + (
        d
        - (1 + 2 * t1 + c1) * d**3 / 6
        + (5 - 2 * c1 + 28 * t1 - 3 * c1**2 + 8 * eccentricity_prime_sq + 24 * t1**2) * d**5 / 120
    ) / cos_phi1
    return math.degrees(longitude), math.degrees(latitude)


def parse_gwangju_shapes(shp_stream, selected_rows: dict[int, dict[str, str]]):
    shp_stream.read(100)
    record_index = 0
    features = []
    while True:
        record_header = shp_stream.read(8)
        if len(record_header) < 8:
            break
        _, content_length_words = struct.unpack(">ii", record_header)
        content = shp_stream.read(content_length_words * 2)
        row = selected_rows.get(record_index)
        record_index += 1
        if row is None:
            continue
        shape_type = struct.unpack("<i", content[:4])[0]
        if shape_type != 5:
            raise ValueError(f"Unsupported Shapefile shape type: {shape_type}")
        part_count, point_count = struct.unpack("<ii", content[36:44])
        part_offset = 44
        parts = list(struct.unpack(f"<{part_count}i", content[part_offset : part_offset + part_count * 4]))
        point_offset = part_offset + part_count * 4
        points = [
            struct.unpack("<dd", content[point_offset + index * 16 : point_offset + (index + 1) * 16])
            for index in range(point_count)
        ]
        rings = []
        for part_index, start in enumerate(parts):
            end = parts[part_index + 1] if part_index + 1 < len(parts) else point_count
            ring = simplify_ring(points[start:end], SIMPLIFY_TOLERANCE_METERS)
            if len(ring) >= 4:
                rings.append(ring)
        features.append({"row": row, "rings": rings})
    return features


def main() -> None:
    if not SOURCE_ZIP.exists():
        raise FileNotFoundError(f"Boundary ZIP not found: {SOURCE_ZIP}")

    with zipfile.ZipFile(SOURCE_ZIP) as archive:
        stem = SOURCE_ZIP.stem
        rows = read_dbf_rows(archive.read(f"{stem}.dbf"))
        selected_rows = {
            index: row for index, row in enumerate(rows) if row["ADM_CD"].startswith("24")
        }
        with archive.open(f"{stem}.shp") as shp_stream:
            features = parse_gwangju_shapes(shp_stream, selected_rows)

    geographic_features = []
    all_geo_points: list[tuple[float, float]] = []
    for feature in features:
        geo_rings = []
        for ring in feature["rings"]:
            geo_ring = [inverse_epsg_5179(x, y) for x, y in ring]
            geo_rings.append(geo_ring)
            all_geo_points.extend(geo_ring)
        geographic_features.append({"row": feature["row"], "rings": geo_rings})

    mean_latitude = sum(point[1] for point in all_geo_points) / len(all_geo_points)
    longitude_scale = math.cos(math.radians(mean_latitude))
    planar_points = [(longitude * longitude_scale, latitude) for longitude, latitude in all_geo_points]
    min_x = min(point[0] for point in planar_points)
    max_x = max(point[0] for point in planar_points)
    min_y = min(point[1] for point in planar_points)
    max_y = max(point[1] for point in planar_points)
    drawable_width = VIEWBOX_WIDTH - VIEWBOX_PADDING * 2
    drawable_height = VIEWBOX_HEIGHT - VIEWBOX_PADDING * 2
    scale = min(drawable_width / (max_x - min_x), drawable_height / (max_y - min_y))
    rendered_width = (max_x - min_x) * scale
    rendered_height = (max_y - min_y) * scale
    x_offset = (VIEWBOX_WIDTH - rendered_width) / 2
    y_offset = (VIEWBOX_HEIGHT - rendered_height) / 2

    def project(longitude: float, latitude: float) -> tuple[float, float]:
        x = x_offset + (longitude * longitude_scale - min_x) * scale
        y = y_offset + (max_y - latitude) * scale
        return x, y

    neighborhood_data = []
    district_points: dict[str, list[tuple[float, float]]] = {code: [] for code in DISTRICTS}
    for feature in geographic_features:
        row = feature["row"]
        district_code = row["ADM_CD"][:5]
        projected_rings = [[project(lon, lat) for lon, lat in ring] for ring in feature["rings"]]
        path_parts = []
        feature_points = []
        for ring in projected_rings:
            if not ring:
                continue
            path_parts.append(
                "M" + "L".join(f"{x:.2f},{y:.2f}" for x, y in ring[:-1]) + "Z"
            )
            feature_points.extend(ring[:-1])
            district_points[district_code].extend(ring[:-1])
        center_x = (min(x for x, _ in feature_points) + max(x for x, _ in feature_points)) / 2
        center_y = (min(y for _, y in feature_points) + max(y for _, y in feature_points)) / 2
        neighborhood_data.append(
            {
                "code": row["ADM_CD"],
                "name": row["ADM_NM"],
                "districtCode": district_code,
                "districtId": DISTRICTS[district_code]["id"],
                "districtName": DISTRICTS[district_code]["name"],
                "path": "".join(path_parts),
                "center": [round(center_x, 2), round(center_y, 2)],
            }
        )

    district_data = []
    for code, district in DISTRICTS.items():
        points = district_points[code]
        district_data.append(
            {
                "code": code,
                **district,
                "center": [
                    round((min(x for x, _ in points) + max(x for x, _ in points)) / 2, 2),
                    round((min(y for _, y in points) + max(y for _, y in points)) / 2, 2),
                ],
                "neighborhoodCount": sum(1 for item in neighborhood_data if item["districtCode"] == code),
            }
        )

    output = {
        "sourceDate": "20250630",
        "sourceCrs": "EPSG:5179",
        "viewBox": [0, 0, VIEWBOX_WIDTH, VIEWBOX_HEIGHT],
        "projection": {
            "longitudeScale": longitude_scale,
            "minX": min_x,
            "maxY": max_y,
            "scale": scale,
            "xOffset": x_offset,
            "yOffset": y_offset,
        },
        "districts": district_data,
        "neighborhoods": neighborhood_data,
    }
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {len(neighborhood_data)} neighborhoods to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
