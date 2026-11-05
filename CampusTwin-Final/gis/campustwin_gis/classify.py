"""Category rules. Order matters: the explicit amenity tag wins over the generic building tag."""
import pandas as pd

CATEGORIES = ["academic", "laboratory", "hostel", "food", "parking", "transport", "healthcare",
              "sports", "religious", "shop", "other_amenity", "building"]


def _s(v):
    return "" if v is None or (isinstance(v, float) and pd.isna(v)) else str(v).strip().lower()


def classify(row) -> str:
    g = lambda k: _s(row.get(k))
    amenity, building, leisure, highway, pt, shop = g("amenity"), g("building"), g("leisure"), g("highway"), g("public_transport"), g("shop")
    if highway == "bus_stop" or pt in ("platform", "stop_position", "station") or amenity == "bus_station":
        return "transport"
    if amenity in ("canteen", "restaurant", "cafe"):
        return "food"
    if amenity == "parking" or building == "parking":
        return "parking"
    if "hostel" in building or building in ("dormitory", "residential") and "hostel" in g("name"):
        return "hostel"
    if "hostel" in g("name"):
        return "hostel"
    if amenity == "laboratory" or "laboratory" in g("name") or " lab" in " " + g("name"):
        return "laboratory"
    if amenity in ("university", "college", "school", "classroom", "library", "research_institute") \
            or building in ("university", "college", "school", "university_building"):
        return "academic"
    if amenity in ("hospital", "clinic"):
        return "healthcare"
    if leisure in ("sports_centre", "pitch", "swimming_pool", "stadium"):
        return "sports"
    if amenity == "place_of_worship":
        return "religious"
    if shop:
        return "shop"
    if amenity or leisure or g("tourism"):
        return "other_amenity"
    if building and building not in ("no",):
        return "building"
    return "other_amenity"


# Mapping to the categories the CampusTwin database accepts (server/utils/constants.js).
DB_FACILITY_CATEGORY = {
    "academic": "academic", "laboratory": "academic", "hostel": "hostel", "food": "food",
    "parking": "transport_parking", "transport": "transport_parking", "healthcare": "healthcare",
    "sports": "sports", "religious": "amenity", "shop": "shop", "other_amenity": "amenity", "building": "other",
}
