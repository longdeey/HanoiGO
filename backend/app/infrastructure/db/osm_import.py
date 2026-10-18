"""Import named Hanoi points of interest from OpenStreetMap through Overpass.

The importer enriches the hand-curated catalog with hundreds of additional
places across all of Hanoi's districts, including the outskirts (Ba Vì, Sơn
Tây, Sóc Sơn, Mỹ Đức, Gia Lâm ...). Prices, visit durations and, where no
``opening_hours`` tag exists, opening hours are category estimates; every
imported record keeps its OpenStreetMap element URL as ``source`` so the UI
continues to label these values as estimates.

Usage (from ``backend/``)::

    python -m app.infrastructure.db.osm_import fetch      # Overpass -> data/osm_hanoi_raw.json + snapshot
    python -m app.infrastructure.db.osm_import remap      # raw cache -> data/osm_hanoi_places.json (offline)
    python -m app.infrastructure.db.osm_import            # snapshot -> database (idempotent)
    python -m app.infrastructure.db.osm_import fetch --import

Data © OpenStreetMap contributors, ODbL: https://www.openstreetmap.org/copyright
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import unicodedata
from collections import Counter
from dataclasses import asdict, dataclass, field, replace
from functools import lru_cache
from pathlib import Path
from typing import Any

import httpx
from geoalchemy2.elements import WKTElement
from sqlalchemy import select

from app.core.config import get_settings
from app.domain.planner.constraints import distance_km
from app.infrastructure.db.models import Place
from app.infrastructure.db.session import SessionLocal

OpeningHours = dict[str, list[list[str]]]

HANOI_RELATION_ID = 1903516  # OSM relation "Thành phố Hà Nội"
# Public Overpass instances differ in load and in area support, so the importer
# queries a bounding box (fast everywhere) and clips to the city boundary itself.
OVERPASS_ENDPOINTS = (
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
)
NOMINATIM_LOOKUP_URL = "https://nominatim.openstreetmap.org/lookup"
DATA_DIR = Path(__file__).resolve().parents[3] / "data"
SNAPSHOT_PATH = DATA_DIR / "osm_hanoi_places.json"
RAW_PATH = DATA_DIR / "osm_hanoi_raw.json"
BOUNDARY_PATH = DATA_DIR / "hanoi_boundary.geojson"
# (south, west, north, east) of the Hanoi boundary; refreshed from the boundary file.
DEFAULT_HANOI_BBOX = (20.5634, 105.2853, 21.3853, 106.0198)
Ring = list[tuple[float, float]]  # (longitude, latitude)
HOAN_KIEM = (21.0287, 105.8522)
OUTSKIRTS_FROM_CENTRE_KM = 12.0
DUPLICATE_DISTANCE_KM = 0.08
# Same-category rows this close to a curated place are the same venue.
CURATED_DUPLICATE_DISTANCE_KM = 0.03
MAX_LOCAL_SCORE = 84

# Overpass selectors grouped so each request stays well inside the public
# quota. Every group requires a ``name`` tag.
QUERY_GROUPS: dict[str, str] = {
    "attractions": 'nwr["tourism"~"^(attraction|museum|gallery|viewpoint|theme_park|zoo|aquarium|camp_site|picnic_site)$"]["name"]',
    "leisure": 'nwr["leisure"~"^(water_park|resort|amusement_arcade)$"]["name"]',
    "historic": 'nwr["historic"]["name"]',
    "worship": 'nwr["amenity"="place_of_worship"]["name"]',
    "parks": 'nwr["leisure"~"^(park|garden|nature_reserve)$"]["name"]',
    "nature": 'nwr["natural"~"^(peak|waterfall|cave_entrance|spring)$"]["name"]',
    "lakes": 'nwr["natural"="water"]["water"~"^(lake|reservoir)$"]["name"]',
    "markets": 'nwr["amenity"~"^(marketplace|food_court)$"]["name"]',
    "malls": 'nwr["shop"~"^(mall|department_store)$"]["name"]',
    "restaurants": 'nwr["amenity"="restaurant"]["name"]',
    "street_food": 'nwr["amenity"~"^(fast_food|ice_cream)$"]["name"]',
    "cafes": 'nwr["amenity"="cafe"]["name"]',
    "lodging": 'nwr["tourism"~"^(hotel|guest_house|hostel|resort)$"]["name"]',
}
CATEGORY_CAPS = {
    "food": 1500, "coffee": 600, "accommodation": 300, "history": 900, "shopping": 250,
    "park": 300, "nature": 300,
}
# Every commune keeps its best places even when a category cap is reached, so a
# trip starting anywhere in Hanoi finds nearby stops.
COMMUNE_QUOTA = {"attraction": 4, "food": 4}
COMMUNES_PATH = DATA_DIR / "hanoi_communes.json"

# Words that only say what a place is ("phở", "chùa", "quán"...). A name made of
# nothing else ("Bánh cuốn nóng gia truyền", "Chợ đêm", "Đình làng") does not
# identify one venue, so it is skipped. Compared with diacritics, so "Láng"
# (a proper name) is not confused with "làng" (village).
GENERIC_WORDS = frozenset("""
quán ăn nhà hàng tiệm bếp cơm phở bún miến mì cháo bánh cuốn nóng gia truyền xôi chè kem lẩu
nướng bia hơi tươi dê gà vịt ngan cá ốc hải sản nhậu buffet restaurant food quê bình dân
đặc ngon sạch chay thịt bò lợn heo trộn riêu thang kho xào rang luộc hấp chiên trà sữa
coffee cafe café cà phê caphe juice sinh tố giò đậu phụ mắm tôm cua ếch lươn chim món việt
nam vietnam vietnamese and the of shop store tạp hóa mini mart bakery tea milk vặt uống
quầy ki ốt kiot điểm số nhỏ lớn mới cũ ngõ phố đường chợ đêm siêu thị trung tâm thương mại
chùa đền đình miếu nghè phủ điện am tự thờ họ từ văn chỉ làng thôn xóm xã phường
công viên vườn hoa hồ ao khu du lịch sinh thái nghỉ dưỡng vui chơi giải trí bảo tàng tượng
đài niệm tưởng liệt sĩ nghĩa trang di tích lịch sử hóa mỳ thực thưc đơn menu ẩm
hiệu quan com pho bun banh mi ca phe nha hang an lau nuong che kem xoi chao mien
""".split())  # noqa: SIM905 - readable word list
DISH_WORDS = frozenset("phở bún miến bánh chả nem xôi lẩu cơm cháo chè ốc bia riêu".split())  # noqa: SIM905
LIFECYCLE_PREFIXES = ("disused:", "abandoned:", "was:", "demolished:", "removed:", "razed:", "destroyed:")
CLOSED_NAME = re.compile(
    r"(đã đóng cửa|ngừng hoạt động|ngừng kinh doanh|permanently closed|\bclosed\b)", re.IGNORECASE,
)
# Local war memorials and family shrines are real but not visitor destinations.
NOT_A_DESTINATION = re.compile(
    r"(liệt sĩ|nghĩa trang|nghĩa địa|nhà thờ họ|từ đường|ubnd|ủy ban|công ty|\bcty\b|ngân hàng|"
    r"bệnh viện|trạm y tế|trường (mầm non|tiểu học|thcs|thpt|trung học)|văn phòng)", re.IGNORECASE,
)
# Linear infrastructure occasionally carries tourism tags (a railway line, a
# highway viewpoint); it is not a place a traveler can visit as a stop.
INFRASTRUCTURE_KEYS = ("railway", "route", "highway", "waterway", "power", "aeroway")
DETAIL_TAGS = (
    "cuisine", "opening_hours", "website", "contact:website", "phone", "contact:phone",
    "wikidata", "wikipedia", "brand", "description", "addr:street",
)

DEFAULT_HOURS: dict[str, OpeningHours] = {
    "museum": {str(day): [] if day == 0 else [["08:00", "17:00"]] for day in range(7)},
    "history": {str(day): [["07:00", "18:00"]] for day in range(7)},
    "park": {str(day): [["05:00", "21:00"]] for day in range(7)},
    "nature": {str(day): [["06:00", "18:00"]] for day in range(7)},
    "hiking": {str(day): [["06:00", "17:00"]] for day in range(7)},
    "local_experience": {str(day): [["08:00", "18:00"]] for day in range(7)},
    "shopping": {str(day): [["08:00", "21:00"]] for day in range(7)},
    "food": {str(day): [["07:00", "21:30"]] for day in range(7)},
    "coffee": {str(day): [["07:00", "22:00"]] for day in range(7)},
    "accommodation": {str(day): [["07:00", "22:00"]] for day in range(7)},
}

DAY_CODES = {"mo": 0, "tu": 1, "we": 2, "th": 3, "fr": 4, "sa": 5, "su": 6}
TIME_RANGE = re.compile(r"^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$")
CRAFT_NAME = re.compile(r"làng\s+(nghề|gốm|lụa|mộc|tranh|hoa|nón|đúc|quạt)", re.IGNORECASE)
PREMIUM_CUISINE = {"french", "japanese", "italian", "steak_house", "fine_dining", "sushi", "korean"}
STREET_FOOD_CUISINE = {
    "pho", "noodle", "noodles", "banh_mi", "bun_cha", "street_food", "snack", "bubble_tea",
    "ice_cream", "dessert", "bakery", "sandwich",
}
VIETNAMESE_CUISINE = {
    "vietnamese", "pho", "bun_cha", "bun", "banh_mi", "banh_cuon", "bun_bo", "bun_bo_hue", "com",
    "com_tam", "cha_ca", "lau", "hot_pot", "nem", "xoi", "che", "banh_xeo", "mien", "chao",
    "regional", "local", "street_food", "seafood", "noodle", "noodles",
}
FOREIGN_CUISINE = {
    "pizza", "italian", "burger", "american", "korean", "japanese", "sushi", "ramen", "indian",
    "thai", "chinese", "french", "mexican", "steak_house", "kebab", "western", "fast_food",
    "chicken", "fried_chicken", "spanish", "german", "russian", "turkish", "greek",
    "mediterranean", "international", "tex-mex", "lebanese", "malaysian", "singaporean",
}
# Franchise outlets are real places but never the "local culture" a
# traveler asks for, and one brand can have dozens of near-identical branches.
CHAIN_NAME = re.compile(
    r"\b(pizza hut|kfc|mcdonald|lotteria|jollibee|burger king|starbucks|domino|popeyes|"
    r"texas chicken|the pizza company|gogi house|kichi[- ]?kichi|haidilao|paris baguette|"
    r"tous les jours|dunkin|subway|highlands coffee|the coffee house|phuc long|phúc long|"
    r"trung nguyên|trung nguyen|cong ca ?phe|cộng cà ?phê|aha cafe|bonchon|mixue|isushi|sumo bbq|"
    r"manwah|dookki|tocotoco|ding tea|gong cha|koi th[eé]|phê la|katinat|pizza 4p|al fresco)\b",
    re.IGNORECASE,
)


def _cuisine(tags: dict[str, str]) -> set[str]:
    return {item.strip().lower() for item in tags.get("cuisine", "").split(";") if item}


def _chain_or_foreign(tags: dict[str, str], name: str) -> bool:
    cuisine = _cuisine(tags)
    foreign = bool(cuisine & FOREIGN_CUISINE) and not cuisine & VIETNAMESE_CUISINE
    return foreign or CHAIN_NAME.search(name) is not None or CHAIN_NAME.search(tags.get("brand", "")) is not None


@dataclass(frozen=True)
class ImportedPlace:
    slug: str
    osm_id: str
    name_en: str
    name_vi: str
    latitude: float
    longitude: float
    category: str
    tags: list[str]
    average_cost: int
    entrance_fee: int
    average_visit_minutes: int
    indoor: bool
    outdoor: bool
    local_score: int
    opening_hours: OpeningHours
    hours_from_osm: bool
    description_en: str
    description_vi: str
    source: str
    detail_count: int = 0
    signals: list[str] = field(default_factory=list)
    commune: str | None = None


class OverpassUnavailable(Exception):
    pass


# --- Overpass ---------------------------------------------------------------


def overpass_query(
    selector: str, bbox: tuple[float, float, float, float] = DEFAULT_HANOI_BBOX,
    timeout_seconds: int = 120,
) -> str:
    south, west, north, east = bbox
    return (
        f"[out:json][timeout:{timeout_seconds}];"
        f"({selector}({south:.4f},{west:.4f},{north:.4f},{east:.4f}););out center tags;"
    )


def fetch_elements(
    selector: str, *, bbox: tuple[float, float, float, float] = DEFAULT_HANOI_BBOX,
    endpoints: tuple[str, ...] = OVERPASS_ENDPOINTS, attempts: int = 3,
    transport: httpx.BaseTransport | None = None, pause_seconds: float = 3.0,
) -> list[dict[str, Any]]:
    """Run one Overpass query with retries and mirror fallback."""
    user_agent = get_settings().geocoding_user_agent
    last_error: Exception | None = None
    for attempt in range(attempts):
        for endpoint in endpoints:
            try:
                with httpx.Client(timeout=200, transport=transport) as client:
                    response = client.post(
                        endpoint, data={"data": overpass_query(selector, bbox)},
                        headers={"User-Agent": user_agent},
                    )
                if response.status_code in {429, 504}:
                    raise httpx.HTTPStatusError(
                        f"Overpass busy ({response.status_code})", request=response.request,
                        response=response,
                    )
                response.raise_for_status()
                payload = response.json()
                return list(payload.get("elements", []))
            except (httpx.HTTPError, ValueError) as exc:
                last_error = exc
                time.sleep(pause_seconds * (attempt + 1))
    raise OverpassUnavailable(f"Overpass query failed after {attempts} attempts: {last_error}")


# --- City boundary ------------------------------------------------------------


def fetch_boundary(
    path: Path = BOUNDARY_PATH, transport: httpx.BaseTransport | None = None,
) -> dict[str, Any]:
    """Return the simplified Hanoi boundary GeoJSON, downloading it once from Nominatim."""
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    with httpx.Client(timeout=60, transport=transport) as client:
        response = client.get(
            NOMINATIM_LOOKUP_URL,
            params={"osm_ids": f"R{HANOI_RELATION_ID}", "format": "json",
                    "polygon_geojson": 1, "polygon_threshold": 0.001},
            headers={"User-Agent": get_settings().geocoding_user_agent},
        )
        response.raise_for_status()
    rows = response.json()
    if not rows or "geojson" not in rows[0]:
        raise OverpassUnavailable("Nominatim did not return the Hanoi boundary")
    boundary = {"geojson": rows[0]["geojson"], "boundingbox": rows[0]["boundingbox"],
                "display_name": rows[0].get("display_name", "")}
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(boundary, ensure_ascii=False), encoding="utf-8")
    return boundary


def boundary_rings(boundary: dict[str, Any]) -> list[Ring]:
    geometry = boundary["geojson"]
    if geometry["type"] == "Polygon":
        polygons = [geometry["coordinates"]]
    elif geometry["type"] == "MultiPolygon":
        polygons = geometry["coordinates"]
    else:
        raise ValueError(f"Unsupported boundary geometry {geometry['type']}")
    # Outer rings only; Hanoi has no enclaves that matter for POI filtering.
    return [[(float(lon), float(lat)) for lon, lat in polygon[0]] for polygon in polygons]


def boundary_bbox(boundary: dict[str, Any]) -> tuple[float, float, float, float]:
    south, north, west, east = (float(value) for value in boundary["boundingbox"])
    return south, west, north, east


def point_in_rings(latitude: float, longitude: float, rings: list[Ring]) -> bool:
    """Ray-casting point-in-polygon test over one or more outer rings."""
    for ring in rings:
        inside = False
        count = len(ring)
        for index in range(count):
            x1, y1 = ring[index]
            x2, y2 = ring[(index + 1) % count]
            if (y1 > latitude) != (y2 > latitude):
                crossing = x1 + (latitude - y1) * (x2 - x1) / (y2 - y1)
                if longitude < crossing:
                    inside = not inside
        if inside:
            return True
    return False


# --- Opening hours ------------------------------------------------------------


def _minutes_to_text(minutes: int) -> str:
    minutes = max(0, min(minutes, 23 * 60 + 59))
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def _parse_days(spec: str) -> list[int] | None:
    days: list[int] = []
    for part in spec.replace(" ", "").split(","):
        if not part:
            continue
        if "-" in part:
            start, end = part.split("-", 1)
            if start.lower() not in DAY_CODES or end.lower() not in DAY_CODES:
                return None
            first, last = DAY_CODES[start.lower()], DAY_CODES[end.lower()]
            span = list(range(first, last + 1)) if first <= last else (
                list(range(first, 7)) + list(range(last + 1))
            )
            days.extend(span)
        elif part.lower() in DAY_CODES:
            days.append(DAY_CODES[part.lower()])
        else:
            return None
    return sorted(set(days))


def _parse_time_ranges(spec: str) -> list[list[str]] | None:
    windows: list[list[str]] = []
    for chunk in spec.split(","):
        match = TIME_RANGE.match(chunk.strip())
        if not match:
            return None
        open_minute = int(match.group(1)) * 60 + int(match.group(2))
        close_minute = int(match.group(3)) * 60 + int(match.group(4))
        if close_minute <= open_minute:
            close_minute = 23 * 60 + 59  # overnight venue: clip to the same day
        if open_minute >= 24 * 60:
            return None
        windows.append([_minutes_to_text(open_minute), _minutes_to_text(close_minute)])
    return windows


def parse_opening_hours(value: str | None) -> OpeningHours | None:
    """Translate the common subset of OSM ``opening_hours`` into weekday windows.

    Supports ``24/7``, ``08:00-17:00``, ``Mo-Fr 08:00-12:00,13:30-17:00; Sa,Su
    09:00-18:00`` and ``Mo off``. Anything else returns ``None`` so the caller
    can fall back to a category default.
    """
    if not value:
        return None
    text = value.strip()
    if text == "24/7":
        return {str(day): [["00:00", "23:59"]] for day in range(7)}
    hours: OpeningHours = {str(day): [] for day in range(7)}
    touched = False
    for rule in text.split(";"):
        rule = rule.strip()
        if not rule or rule.upper().startswith("PH"):
            continue
        match = re.match(r"^([A-Za-z,\- ]+?)\s+(.+)$", rule)
        if match and _parse_days(match.group(1)) is not None:
            days = _parse_days(match.group(1))
            remainder = match.group(2).strip()
        else:
            days = list(range(7))
            remainder = rule
        assert days is not None
        if remainder.lower() in {"off", "closed"}:
            for day in days:
                hours[str(day)] = []
            touched = True
            continue
        windows = _parse_time_ranges(remainder)
        if windows is None:
            return None
        for day in days:
            hours[str(day)] = [list(window) for window in windows]
        touched = True
    if not touched or all(not windows for windows in hours.values()):
        return None
    return hours


# --- Mapping ------------------------------------------------------------------


def slugify(text: str) -> str:
    normalized = unicodedata.normalize("NFD", text.replace("đ", "d").replace("Đ", "D"))
    ascii_text = "".join(char for char in normalized if unicodedata.category(char) != "Mn")
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_text.lower()).strip("-")
    return slug[:80] or "place"


def name_words(name: str) -> list[str]:
    return re.findall(r"[^\W_]+", unicodedata.normalize("NFC", name).lower())


def is_generic_name(name: str, tags: dict[str, str] | None = None) -> bool:
    """True when a name only describes a kind of place rather than one venue."""
    words = name_words(name)
    if any(word not in GENERIC_WORDS and not word.isdigit() for word in words):
        return False
    # "Bánh Mì 25" is identified by its house number when the address backs it up.
    tags = tags or {}
    return not (any(word.isdigit() for word in words)
                and (tags.get("addr:street") or tags.get("addr:housenumber")))


def is_closed(tags: dict[str, str], name: str) -> bool:
    """OpenStreetMap lifecycle tags or a name saying the venue has shut."""
    if any(key.startswith(LIFECYCLE_PREFIXES) for key in tags):
        return True
    if tags.get("disused") == "yes" or tags.get("abandoned") == "yes":
        return True
    if (tags.get("opening_hours") or "").strip().lower() in {"closed", "off"}:
        return True
    return CLOSED_NAME.search(name) is not None


def has_local_dish(name: str) -> bool:
    return any(word in DISH_WORDS for word in name_words(name))


def _classify(tags: dict[str, str], name: str) -> tuple[str, list[str], bool, bool] | None:
    """Return (category, tags, indoor, outdoor) or None when the element is not usable."""
    tourism = tags.get("tourism", "")
    historic = tags.get("historic", "")
    amenity = tags.get("amenity", "")
    leisure = tags.get("leisure", "")
    natural = tags.get("natural", "")
    shop = tags.get("shop", "")
    if any(key in tags for key in INFRASTRUCTURE_KEYS):
        return None
    if is_closed(tags, name) or is_generic_name(name, tags) or NOT_A_DESTINATION.search(name):
        return None
    if CRAFT_NAME.search(name) or tags.get("craft"):
        return "local_experience", ["craft", "local_culture", "shopping"], True, True
    if tourism in {"museum", "gallery"}:
        art = tourism == "gallery" or "art" in tags.get("name:en", "").lower()
        return "museum", ["museum", "art" if art else "history", "local_culture"], True, False
    if historic:
        indoor = historic in {"house", "building", "manor", "monastery"}
        extra = ["local_culture"] + (["checkin"] if historic in {"monument", "memorial", "citadel"} else [])
        return "history", ["history", *extra], indoor, not indoor
    if amenity == "place_of_worship":
        return "history", ["history", "local_culture"], True, True
    if tourism in {"theme_park", "zoo", "aquarium"} or leisure == "water_park":
        return "park", ["park", "family", "checkin"], tourism == "aquarium", tourism != "aquarium"
    if leisure == "amusement_arcade":
        return "local_experience", ["family", "checkin"], True, False
    if leisure == "resort" or tourism in {"camp_site", "picnic_site"}:
        return "nature", ["nature", "family", "checkin"], False, True
    if tourism == "viewpoint":
        return "nature", ["nature", "checkin", "hidden_gem"], False, True
    if tourism == "attraction":
        return "local_experience", ["local_culture", "checkin"], False, True
    if leisure in {"park", "garden"}:
        return "park", ["park", "nature", "local_culture"], False, True
    if leisure == "nature_reserve":
        return "nature", ["nature", "park", "hiking"], False, True
    if natural == "peak":
        return "hiking", ["hiking", "nature", "checkin"], False, True
    if natural in {"waterfall", "cave_entrance", "spring"}:
        return "nature", ["nature", "hiking", "checkin"], False, True
    if natural == "water":
        return "nature", ["nature", "park", "local_culture"], False, True
    if amenity == "food_court":
        return "shopping", ["shopping", "food", "local_culture"], True, False
    if amenity == "marketplace":
        return "shopping", ["shopping", "local_culture", "food"], True, True
    if shop in {"mall", "department_store"}:
        return "shopping", ["shopping", "food", "family"], True, False
    if amenity in {"restaurant", "cafe", "fast_food", "ice_cream"}:
        chain_or_foreign = _chain_or_foreign(tags, name)
        if CHAIN_NAME.search(name) or CHAIN_NAME.search(tags.get("brand", "")):
            return None  # franchise outlets are not the local food this planner is about
        if amenity == "fast_food" and chain_or_foreign:
            return None  # international burger and fried-chicken outlets are not local food
        # A named quán serving a Vietnamese dish is the core of a local food trip,
        # even when the mapper added no further detail tags.
        if not (any(key in tags for key in DETAIL_TAGS) or has_local_dish(name)):
            return None
        extra = [] if chain_or_foreign else ["local_culture"]
        if amenity == "cafe":
            return "coffee", ["coffee", *extra], True, False
        return "food", ["food", *extra], True, False
    if tourism in {"hotel", "guest_house", "hostel", "resort"}:
        return "accommodation", ["accommodation", "rest"], True, tourism == "resort"
    return None


def _cost_and_duration(category: str, tags: dict[str, str]) -> tuple[int, int, int]:
    """Return (average_cost, entrance_fee, visit_minutes) as per-person estimates in VND."""
    tourism = tags.get("tourism", "")
    historic = tags.get("historic", "")
    cuisine = {item.strip().lower() for item in tags.get("cuisine", "").split(";") if item}
    if category == "museum":
        return 0, 40_000, 75
    if category == "history":
        if historic in {"citadel", "castle", "fort", "archaeological_site"}:
            return 0, 30_000, 90
        if tags.get("amenity") == "place_of_worship":
            return 0, 0, 40
        return 0, 0, 45
    if category == "park":
        if tags.get("leisure") == "water_park":
            return 0, 180_000, 180
        return (0, 150_000, 150) if tourism in {"theme_park", "zoo", "aquarium"} else (0, 0, 60)
    if category == "nature":
        if tags.get("leisure") == "nature_reserve":
            return 0, 30_000, 120
        if tags.get("leisure") == "resort" or tourism in {"camp_site", "picnic_site"}:
            return 50_000, 100_000, 180
        if tags.get("natural") == "water":
            return 0, 0, 45
        return (0, 0, 30) if tourism == "viewpoint" else (0, 0, 90)
    if category == "hiking":
        return 0, 0, 180
    if category == "local_experience":
        return (50_000, 0, 90) if "craft" in tags or CRAFT_NAME.search(tags.get("name", "")) else (0, 0, 60)
    if category == "shopping":
        return (150_000, 0, 90) if tags.get("shop") else (50_000, 0, 60)
    if category == "coffee":
        return 55_000, 0, 45
    if category == "food":
        if cuisine & PREMIUM_CUISINE:
            return 350_000, 0, 90
        if cuisine & STREET_FOOD_CUISINE or tags.get("amenity") in {"fast_food", "ice_cream"}:
            return 70_000, 0, 40
        return 120_000, 0, 60
    if category == "accommodation":
        stars = tags.get("stars", "")
        nightly = {"5": 3_500_000, "4": 1_800_000, "3": 900_000}.get(stars[:1], 0)
        if not nightly:
            nightly = 350_000 if tourism in {"guest_house", "hostel"} else 800_000
        return nightly, 0, 30
    return 0, 0, 60


def _local_score(category: str, tags: dict[str, str]) -> tuple[int, list[str]]:
    base = {
        "history": 72, "museum": 74, "park": 70, "nature": 74, "hiking": 74,
        "local_experience": 72, "shopping": 62, "food": 66, "coffee": 64, "accommodation": 60,
    }[category]
    signals: list[str] = []
    if tags.get("amenity") == "marketplace":
        base -= 6  # everyday neighbourhood markets rank below curated experiences
    if tags.get("amenity") == "place_of_worship" and not any(
        key in tags for key in ("wikidata", "wikipedia", "heritage", "tourism")
    ):
        base -= 8  # a village pagoda is worth a stop, but below listed heritage
    if tags.get("natural") == "water":
        base -= 6
    if "wikidata" in tags or "wikipedia" in tags:
        base += 10
        signals.append("wikipedia")
    if "heritage" in tags:
        base += 6
        signals.append("heritage")
    if "website" in tags or "contact:website" in tags:
        base += 3
        signals.append("website")
    if "opening_hours" in tags:
        base += 3
        signals.append("opening_hours")
    if "cuisine" in tags:
        base += 2
    if category in {"food", "coffee"}:
        if _chain_or_foreign(tags, tags.get("name", "")):
            base -= 6  # franchises and foreign kitchens rank below local ones
            signals.append("chain_or_foreign")
        elif (_cuisine(tags) & (VIETNAMESE_CUISINE | STREET_FOOD_CUISINE)
              or has_local_dish(tags.get("name", ""))):
            base += 8  # a named Vietnamese speciality is what travelers come for
            signals.append("vietnamese_cuisine")
    if tags.get("tourism") and category not in {"accommodation"}:
        base += 2
    if category == "accommodation" and tags.get("stars", "")[:1].isdigit():
        base += 2 * int(tags["stars"][0])
    return min(MAX_LOCAL_SCORE, base), signals


def map_element(element: dict[str, Any]) -> ImportedPlace | None:
    tags = element.get("tags") or {}
    name = (tags.get("name") or "").strip()
    if len(name) < 3:
        return None
    if element.get("type") == "node":
        latitude, longitude = element.get("lat"), element.get("lon")
    else:
        centre = element.get("center") or {}
        latitude, longitude = centre.get("lat"), centre.get("lon")
    if latitude is None or longitude is None:
        return None
    classified = _classify(tags, name)
    if classified is None:
        return None
    category, place_tags, indoor, outdoor = classified
    name_en = (tags.get("name:en") or name).strip()
    name_vi = (tags.get("name:vi") or name).strip()
    if is_generic_name(name_vi, tags):
        name_vi = name  # "Công viên Trung tâm" says less than the main name tag
    average_cost, entrance_fee, visit_minutes = _cost_and_duration(category, tags)
    parsed_hours = parse_opening_hours(tags.get("opening_hours"))
    opening_hours = parsed_hours or DEFAULT_HOURS[category]
    local_score, signals = _local_score(category, tags)
    from_centre = distance_km(HOAN_KIEM[0], HOAN_KIEM[1], float(latitude), float(longitude))
    if from_centre > OUTSKIRTS_FROM_CENTRE_KM:
        place_tags = [*place_tags, "outskirts"]
        if category in {"history", "park", "nature", "hiking", "local_experience"}:
            place_tags.append("hidden_gem")
    osm_id = f"{element['type']}/{element['id']}"
    address = ", ".join(
        part for part in (tags.get("addr:housenumber"), tags.get("addr:street"),
                          tags.get("addr:district") or tags.get("addr:suburb")) if part
    )
    description_en = tags.get("description:en") or tags.get("description") or f"Explore {name_en} in Hanoi."
    description_vi = tags.get("description:vi") or tags.get("description") or f"Khám phá {name_vi} tại Hà Nội."
    if address:
        description_en = f"{description_en} Address: {address}."
        description_vi = f"{description_vi} Địa chỉ: {address}."
    return ImportedPlace(
        slug=f"{slugify(name_en)}-osm-{element['id']}", osm_id=osm_id,
        name_en=name_en, name_vi=name_vi, latitude=float(latitude), longitude=float(longitude),
        category=category, tags=sorted(set(place_tags)), average_cost=average_cost,
        entrance_fee=entrance_fee, average_visit_minutes=visit_minutes, indoor=indoor,
        outdoor=outdoor, local_score=local_score, opening_hours=opening_hours,
        hours_from_osm=parsed_hours is not None, description_en=description_en,
        description_vi=description_vi, source=f"https://www.openstreetmap.org/{osm_id}",
        detail_count=sum(key in tags for key in DETAIL_TAGS), signals=signals,
    )


def _normalized_name(text: str) -> str:
    return slugify(text)


def deduplicate(
    places: list[ImportedPlace], existing: list[tuple[str, str, float, float]] = (),
) -> list[ImportedPlace]:
    """Drop imported places that duplicate curated ones or each other.

    ``existing`` holds (name_en, name_vi, latitude, longitude) of catalog rows
    that must win. Within the import, the richer record (more detail tags,
    higher score) wins when two elements share a name nearby.
    """
    ranked = sorted(places, key=lambda item: (-item.detail_count, -item.local_score, item.slug))
    kept: list[ImportedPlace] = []
    existing_names = {_normalized_name(name) for names in existing for name in names[:2]}
    for place in ranked:
        names = {_normalized_name(place.name_en), _normalized_name(place.name_vi)}
        if names & existing_names:
            continue
        if any(
            distance_km(lat, lon, place.latitude, place.longitude) <= DUPLICATE_DISTANCE_KM
            for _, _, lat, lon in existing
        ):
            continue
        if any(
            (names & {_normalized_name(other.name_en), _normalized_name(other.name_vi)})
            and distance_km(other.latitude, other.longitude, place.latitude, place.longitude) <= 0.5
            for other in kept
        ):
            continue
        kept.append(place)
    return kept


def drop_curated_duplicates(places: list[ImportedPlace]) -> list[ImportedPlace]:
    """Drop snapshot rows that duplicate a place in data/curated_places.json.

    The curated file may gain famous places after the snapshot was built, so
    the check runs on every import, not only when the snapshot is rebuilt.
    """
    from app.infrastructure.db.seed import load_curated

    curated = [data for data in load_curated()["places"] if data["category"] != "festival"]
    sources = {data["source"] for data in curated}
    names = {_normalized_name(data[key]) for data in curated for key in ("name_en", "name_vi")}
    return [
        place for place in places
        if place.source not in sources
        and not ({_normalized_name(place.name_en), _normalized_name(place.name_vi)} & names)
        and not any(
            data["category"] == place.category
            and distance_km(data["latitude"], data["longitude"], place.latitude, place.longitude)
            <= CURATED_DUPLICATE_DISTANCE_KM
            for data in curated
        )
    ]


@lru_cache(maxsize=1)
def load_communes(path: Path = COMMUNES_PATH) -> tuple[tuple[str, tuple[float, float, float, float], list[Ring]], ...]:
    """(name, (min_lon, min_lat, max_lon, max_lat), rings) for Hanoi's 126 communes and wards."""
    if not path.exists():
        return ()
    communes = []
    for row in json.loads(path.read_text(encoding="utf-8"))["communes"]:
        rings = [[(lon, lat) for lon, lat in ring] for ring in row["rings"]]
        points = [point for ring in rings for point in ring]
        box = (min(x for x, _ in points), min(y for _, y in points),
               max(x for x, _ in points), max(y for _, y in points))
        communes.append((row["name"], box, rings))
    return tuple(communes)


def commune_of(latitude: float, longitude: float) -> str | None:
    for name, (min_lon, min_lat, max_lon, max_lat), rings in load_communes():
        if (min_lon <= longitude <= max_lon and min_lat <= latitude <= max_lat
                and point_in_rings(latitude, longitude, rings)):
            return name
    return None


def with_commune(place: ImportedPlace) -> ImportedPlace:
    commune = commune_of(place.latitude, place.longitude)
    if commune is None:
        return place
    return replace(
        place, commune=commune,
        description_en=f"{place.description_en} Commune/ward: {commune}.",
        description_vi=f"{place.description_vi} Đơn vị hành chính: {commune}.",
    )


def _coverage_kind(place: ImportedPlace) -> str | None:
    # A market is where a commune's local food is, so it fills the food quota.
    if place.category in {"food", "coffee"} or (place.category == "shopping" and "food" in place.tags):
        return "food"
    return None if place.category == "accommodation" else "attraction"


def select_with_coverage(places: list[ImportedPlace]) -> list[ImportedPlace]:
    """Keep each commune's best places first, then fill the city-wide category caps."""
    ranked = sorted(places, key=lambda item: (-item.local_score, -item.detail_count, item.slug))
    chosen: dict[str, ImportedPlace] = {}
    per_commune: Counter[tuple[str, str]] = Counter()
    for place in ranked:
        kind = _coverage_kind(place)
        if kind and place.commune and per_commune[(place.commune, kind)] < COMMUNE_QUOTA[kind]:
            per_commune[(place.commune, kind)] += 1
            chosen[place.slug] = place
    counts: Counter[str] = Counter()  # commune picks come on top of the city-wide caps
    for place in ranked:
        if place.slug in chosen:
            continue
        cap = CATEGORY_CAPS.get(place.category)
        if cap is not None and counts[place.category] >= cap:
            continue
        counts[place.category] += 1
        chosen[place.slug] = place
    return sorted(chosen.values(), key=lambda item: item.slug)


def apply_category_caps(places: list[ImportedPlace]) -> list[ImportedPlace]:
    counts: dict[str, int] = {}
    result: list[ImportedPlace] = []
    for place in sorted(places, key=lambda item: (-item.local_score, -item.detail_count, item.slug)):
        cap = CATEGORY_CAPS.get(place.category)
        if cap is not None and counts.get(place.category, 0) >= cap:
            continue
        counts[place.category] = counts.get(place.category, 0) + 1
        result.append(place)
    return sorted(result, key=lambda item: item.slug)


# --- Snapshot and database ----------------------------------------------------


def fetch_snapshot(
    path: Path = SNAPSHOT_PATH, raw_path: Path = RAW_PATH, *, log=print,
) -> list[ImportedPlace]:
    """Query Overpass group by group, cache the raw elements, then build the snapshot."""
    boundary = fetch_boundary()
    bbox = boundary_bbox(boundary)
    log(f"boundary: {boundary.get('display_name', 'Hà Nội')} bbox={bbox}")
    raw: dict[str, list[dict[str, Any]]] = {}
    for group, selector in QUERY_GROUPS.items():
        started = time.monotonic()
        raw[group] = fetch_elements(selector, bbox=bbox)
        log(f"{group:<12} {len(raw[group]):>5} elements ({time.monotonic() - started:.0f}s)", flush=True)
        time.sleep(2)
    raw_path.parent.mkdir(parents=True, exist_ok=True)
    raw_path.write_text(json.dumps(raw, ensure_ascii=False), encoding="utf-8")
    log(f"cached raw elements in {raw_path}")
    return build_snapshot(raw, boundary, path, log=log)


def build_snapshot(
    raw: dict[str, list[dict[str, Any]]], boundary: dict[str, Any],
    path: Path = SNAPSHOT_PATH, *, log=print,
) -> list[ImportedPlace]:
    """Map cached Overpass elements to places, clip to Hanoi, deduplicate and cap."""
    rings = boundary_rings(boundary)
    mapped: list[ImportedPlace] = []
    for group, elements in raw.items():
        usable = [place for place in map(map_element, elements) if place is not None]
        inside = [place for place in usable
                  if point_in_rings(place.latitude, place.longitude, rings)]
        log(f"{group:<12} {len(elements):>5} elements -> {len(usable):>5} usable -> "
            f"{len(inside):>5} inside Hanoi")
        mapped.extend(inside)
    with SessionLocal() as session:
        existing = [
            (place.name_en, place.name_vi, place.latitude, place.longitude)
            for place in session.scalars(select(Place).where(~Place.slug.contains("-osm-")))
        ]
    places = select_with_coverage([with_commune(place) for place in deduplicate(mapped, existing)])
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps([asdict(place) for place in places], ensure_ascii=False, indent=0),
        encoding="utf-8",
    )
    log(f"wrote {len(places)} places to {path}")
    return places


def remap_snapshot(
    raw_path: Path = RAW_PATH, path: Path = SNAPSHOT_PATH, *, log=print,
) -> list[ImportedPlace]:
    raw = json.loads(raw_path.read_text(encoding="utf-8"))
    return build_snapshot(raw, fetch_boundary(), path, log=log)


def load_snapshot(path: Path = SNAPSHOT_PATH) -> list[ImportedPlace]:
    rows = json.loads(path.read_text(encoding="utf-8"))
    return [ImportedPlace(**row) for row in rows]


def import_places(
    places: list[ImportedPlace], *, deactivate_missing: bool = False,
) -> tuple[int, int, int]:
    """Upsert imported places by slug. Returns (inserted, updated, deactivated).

    With ``deactivate_missing`` (the CLI default for a full snapshot import),
    OpenStreetMap rows that are no longer in the snapshot are deactivated rather
    than deleted so saved itineraries keep their foreign keys.
    """
    inserted = updated = deactivated = 0
    with SessionLocal.begin() as session:
        existing = {
            place.slug: place
            for place in session.scalars(select(Place).where(Place.slug.contains("-osm-")))
        }
        wanted = {item.slug for item in places} if deactivate_missing else set(existing)
        for slug, stale in existing.items():
            if slug not in wanted and stale.is_active:
                stale.is_active = False
                deactivated += 1
        for item in places:
            place = existing.get(item.slug)
            if place is None:
                place = Place(slug=item.slug)
                session.add(place)
                inserted += 1
            else:
                updated += 1
            place.name_en = item.name_en
            place.name_vi = item.name_vi
            place.latitude = item.latitude
            place.longitude = item.longitude
            place.location = WKTElement(f"POINT({item.longitude} {item.latitude})", srid=4326)
            place.category = item.category
            place.tags = item.tags
            place.description_en = item.description_en
            place.description_vi = item.description_vi
            place.average_cost = item.average_cost
            place.entrance_fee = item.entrance_fee
            place.average_visit_minutes = item.average_visit_minutes
            place.indoor = item.indoor
            place.outdoor = item.outdoor
            place.experience_type = "local" if item.local_score >= 80 else "popular"
            place.crowd_level = "medium"
            place.local_score = item.local_score
            place.opening_hours = item.opening_hours
            place.best_time_slots = ["morning", "afternoon"]
            place.suitable_for = ["solo", "couple", "friends", "family"]
            place.verified = False
            place.price_verified = False
            place.hours_verified = False
            place.price_source = None
            place.hours_source = item.source if item.hours_from_osm else None
            place.source = item.source
            place.highlight_level = "standard"
            place.is_active = True
    return inserted, updated, deactivated


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", nargs="?", choices=("fetch", "remap", "import"), default="import")
    parser.add_argument("--import", dest="also_import", action="store_true",
                        help="after fetch, import the new snapshot")
    parser.add_argument("--snapshot", type=Path, default=SNAPSHOT_PATH)
    args = parser.parse_args(argv)
    if args.command == "fetch":
        places = fetch_snapshot(args.snapshot)
        if not args.also_import:
            return 0
    elif args.command == "remap":
        if not RAW_PATH.exists():
            print(f"Raw cache {RAW_PATH} not found. Run the fetch command first.", file=sys.stderr)
            return 1
        places = remap_snapshot(path=args.snapshot)
        if not args.also_import:
            return 0
    else:
        if not args.snapshot.exists():
            print(f"Snapshot {args.snapshot} not found. Run the fetch command first.", file=sys.stderr)
            return 1
        places = load_snapshot(args.snapshot)
    places = drop_curated_duplicates(places)
    inserted, updated, deactivated = import_places(places, deactivate_missing=True)
    print(f"Imported {inserted} new, refreshed {updated} and deactivated {deactivated} "
          "OpenStreetMap places")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
