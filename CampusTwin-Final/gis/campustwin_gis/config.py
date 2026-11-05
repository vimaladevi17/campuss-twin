"""Extraction settings. The point and radius are approximate extraction parameters,
NOT an official campus boundary."""
REF_LAT = 9.5743
REF_LON = 77.6761
RADIUS_M = 1500
CRS = "EPSG:4326"
METRIC_CRS = "EPSG:32643"  # UTM zone 43N, used only for metre-based measurements near Krishnankoil

OSM_TAGS = {
    "building": True,
    "amenity": [
        "university", "college", "school", "library", "laboratory", "research_institute",
        "canteen", "restaurant", "cafe", "parking", "bus_station", "shelter", "hospital",
        "clinic", "toilets", "bank", "atm", "place_of_worship", "classroom",
    ],
    "shop": True,
    "leisure": ["sports_centre", "pitch", "swimming_pool", "park", "playground", "stadium"],
    "public_transport": True,
    "highway": ["bus_stop"],
    "tourism": ["information"],
}

# Data provenance labels written into every feature.
SRC_OSM = "OSM-derived"
SRC_DEMO = "Demo"
SRC_ESTIMATED = "Estimated"
SRC_ADMIN = "Admin-verified"

# Floor height used ONLY when OSM has no height; always labelled "estimated".
ESTIMATED_FLOOR_HEIGHT_M = 3.5
