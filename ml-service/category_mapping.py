# -*- coding: utf-8 -*-
"""
category_mapping.py — maps Polyvore's ~380 category_id.txt entries down to a
taxonomy usable for compatibility feature engineering.

Two-level mapping, not a direct collapse straight to WardrobeItem.js's 5-bucket
`category` enum (tops/bottoms/dresses/footwear/accessories): collapsing "jacket",
"sweater", "blouse", "cardigan", "coat" all straight to `tops` destroys almost
all category-composition signal a compatibility model could learn from — most
real outfits and most category-shuffled negatives would look like nearly the
same multiset. So:

  1. SUBGROUP_KEYWORDS — ~30 fine-grained subgroups (jackets, knitwear,
     denim_bottoms, skirts, sneakers, heels_flats, bags, jewelry, ...),
     matched by keyword against the Polyvore category *name text* (not the
     numeric id — ids aren't a stable contract across dataset re-releases,
     and keyword matching on name text is the same technique that would be
     needed to match WardrobeItem.subcategory free text later).
  2. SUBGROUP_TO_BUCKET — subgroup -> the app's 5-bucket enum, used only
     when a WardrobeItem.category-shaped output is actually needed.

EXCLUDED_KEYWORDS catches non-fashion noise the raw dataset still contains
(home furniture, beauty/makeup, electronics, food, kitchenware, etc. — Polyvore
started as a general "get the look" board, not a pure clothing catalog).
Checked BEFORE subgroup matching so a category like "Men's Grooming Bags"
(contains "bag" but is a beauty-grooming item) is excluded rather than
misfiled into the bags subgroup.

map_category_name() never silently falls through: any name that matches
neither list returns None and the caller is expected to surface that as an
uncovered category, not drop it quietly (see
tests/test_category_mapping.py::test_full_dataset_coverage, which asserts
zero uncovered categories against the real downloaded category_id.txt).
"""

# Bare/coarse category names with zero garment-type signal on their own —
# matched by EXACT string equality, not substring, so excluding them doesn't
# also swallow a more specific sibling category that happens to contain the
# same word (e.g. "Tops" is excluded but "Activewear Tops" must still map).
EXACT_EXCLUDED_NAMES = {
    "clothing", "tops", "accessories", "activewear", "men's activewear",
}

# ── Non-fashion noise present in the raw dataset (Polyvore covered home decor,
# beauty, and general lifestyle boards, not just clothing) ──────────────────
EXCLUDED_KEYWORDS = [
    # Beauty / grooming
    "makeup", "beauty", "skincare", "fragrance", "grooming", "cosmetic",
    "manicure", "nail ", "haircare", "hair care", "hair color", "hair shampoo",
    "hair conditioner", "styling product", "hair styling", "blow dryer",
    "deodorant", "shaving", "eyeshadow", "eyeliner", "lipstick", "lip gloss",
    "lip pencil", "lip stain", "lip treatment", "mascara", "eyelash",
    "concealer", "foundation", "face powder", "tinted moisturizer",
    "face cleanser", "face toner", "face moisturizer", "face mask", "face care",
    "body cleanser", "body moisturizer", "hair removal", "sun care",
    "tweezers", "brow tool", "sharpener", "brush", "comb", "bath",
    "eye care", "blush", "bronzer", "cheek", "towel",
    # Home / furniture / kitchen / decor
    "furniture", "sofa", "chair", "table", "ottoman", "bed", "dresser",
    "storage", "shelves", "bookcase", "entertainment unit", "lighting",
    "light", "lamp", "rug", "vase", "candle", "frame", "mirror", "throw pillow",
    "fabric", "flooring", "wallpaper", "decor", "decoration", "hammock",
    "hardware", "outdoor loung", "patio", "garden", "fountain", "bedding",
    "sheet", "pillowcase", "blanket", "duvet", "bed pillow", "cookware",
    "bakeware", "cutlery", "appliance", "kitchen", "drinkware", "flatware",
    "serveware", "table linen", "panel screen", "curtain", "office chair",
    "office accessor", "desk", "file cabinet", "fireplace", "comforter",
    "window", "sideboard", "armoire", "nightstand", "quilt", "bar tool",
    "bar cabinet", "napkin", "stool", "apron", "bedspread", "nursery",
    "dining", "cabinet", "cookbook", "clock", "fan", "food storage", "teapot",
    "cleaning", "bench", "media", "party suppl", "loung", "day bed",
    "home improvement", "paint", "outdoors",
    # Electronics / misc lifestyle noise
    "electronics", "font", "food & drink", "tech accessor", "book",
    "dinnerware", "gift card", "gift set", "body art", "costume", "pet",
    "health", "oral care", "supplement", "toy", "stationery", "luggage",
    "jewelry storage",
    # Age/gender meta-categories too coarse to be a garment type
    "kids", "juniors", "boys", "girls", "baby", "maternity", "children",
    # Sleep / intimates / swimwear — outside this app's 5-bucket wardrobe scope.
    # "bras" (not "bra") deliberately — "bra" is a substring of "bracelet" and
    # would wrongly exclude the jewelry category "Bracelets & Bangles".
    "sleepwear", "pajama", "robe", "chemise", "bras", "panties", "intimates",
    "underwear", "shapewear", "bikini", "swimsuit", "cover-up", "swimwear",
    "hosiery", "tights",
    # Vague top-level parents with no garment-type signal on their own
    "men's fashion", "men's clothing", "men's accessor", "sports & outdoor",
    "sports accessor",
]

# Ordered: first matching subgroup wins. Each entry is (subgroup, [keywords]).
SUBGROUP_KEYWORDS = [
    # ── dresses bucket ──
    ("dresses",          ["dress", "gown", "jumpsuit", "romper"]),
    # ── bottoms bucket ──
    ("skirts",           ["skirt"]),
    ("denim_bottoms",    ["jean"]),
    ("shorts",           ["short"]),
    ("leggings",         ["legging"]),
    ("pants",            ["pant", "trouser", "capri", "cropped pant"]),
    # ── tops bucket ──
    ("knitwear",         ["sweater", "cardigan", "sweatshirt", "hoodie"]),
    ("outerwear",        ["outerwear", "coat", "jacket", "vest", "blazer", "sportcoat"]),
    ("suits",            ["suit"]),
    ("tshirts_tanks",    ["t-shirt", "tank top", "camisole", "activewear top"]),
    ("blouses_shirts",   ["blouse", "tunic", "shirt", "polo"]),
    # ── footwear bucket ──
    ("boots",            ["boot", "bootie"]),
    ("sneakers_athletic",["sneaker", "athletic shoe"]),
    ("heels_flats",      ["pump", "flat", "sandal", "flip flop", "loafer",
                           "moccasin", "oxford", "clog", "dress shoe"]),
    ("slippers",         ["slipper"]),
    ("general_shoes",    ["shoe"]),
    # ── accessories bucket ──
    ("bags",             ["bag", "tote", "clutch", "handbag", "backpack",
                           "briefcase", "messenger"]),
    ("jewelry",          ["jewelry", "necklace", "earring", "ring", "bracelet",
                           "bangle", "charm", "pendant", "brooch"]),
    ("watches",          ["watch"]),
    ("scarves",          ["scarf", "scarves"]),
    ("hats",             ["hat"]),
    ("belts",            ["belt", "suspender"]),
    ("sunglasses_eyewear", ["sunglass", "eyewear", "eyeglass"]),
    ("hair_accessories", ["hair accessor"]),
    ("gloves",           ["glove"]),
    ("small_accessories", ["wallet", "tie", "umbrella", "key ring", "money clip",
                            "cuff link", "handkerchief", "sock"]),
]

SUBGROUP_TO_BUCKET = {
    "dresses":            "dresses",
    "skirts":             "bottoms",
    "denim_bottoms":      "bottoms",
    "shorts":             "bottoms",
    "leggings":           "bottoms",
    "pants":              "bottoms",
    "knitwear":           "tops",
    "outerwear":          "tops",
    "suits":              "tops",
    "tshirts_tanks":      "tops",
    "blouses_shirts":     "tops",
    "boots":              "footwear",
    "sneakers_athletic":  "footwear",
    "heels_flats":        "footwear",
    "slippers":           "footwear",
    "general_shoes":      "footwear",
    "bags":                "accessories",
    "jewelry":             "accessories",
    "watches":             "accessories",
    "scarves":             "accessories",
    "hats":                "accessories",
    "belts":               "accessories",
    "sunglasses_eyewear":  "accessories",
    "hair_accessories":    "accessories",
    "gloves":              "accessories",
    "small_accessories":   "accessories",
}


def map_category_name(name: str):
    """
    Returns (subgroup, bucket) for a fashion category, ('excluded', None) for
    recognized non-fashion noise, or (None, None) if the name matched
    neither list — callers must treat that last case as a real coverage gap,
    not silently drop it (see the coverage test referenced in the module docstring).
    """
    if not name:
        return (None, None)
    text = name.lower().strip()

    # Exact-match first: bare parents like "Tops"/"Accessories"/"Activewear"
    # are too coarse to assign a subgroup, but more specific siblings
    # ("Activewear Tops", "Men's Activewear Tops") must still map normally —
    # a substring check here would wrongly exclude those too.
    if text in EXACT_EXCLUDED_NAMES:
        return ("excluded", None)

    for kw in EXCLUDED_KEYWORDS:
        if kw in text:
            return ("excluded", None)

    for subgroup, keywords in SUBGROUP_KEYWORDS:
        if any(kw in text for kw in keywords):
            return (subgroup, SUBGROUP_TO_BUCKET[subgroup])

    return (None, None)


def load_category_id_map(path: str) -> dict:
    """Parses category_id.txt ('<id> <name>' per line) into {id: name}."""
    result = {}
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            parts = line.split(None, 1)
            if len(parts) != 2:
                continue
            cat_id, name = parts
            result[int(cat_id)] = name
    return result
