# -*- coding: utf-8 -*-
"""
polyvore_compat_trainer.py — real-data fashion-compatibility model.
Author  : Aayushma Acharya
Project : StyleAI - Final Year Thesis
College : Softwarica College of IT & E-Commerce

Second, independent signal alongside acceptance_trainer.py's behavior-based
acceptance model. Where that model answers "will THIS user accept THIS
outfit" from this app's own (still mostly synthetic) usage history, this one
answers a narrower, dataset-grounded question: "does this outfit's category
composition and color combination resemble a REAL human-curated outfit, or a
random assembly of items?" — trained entirely on the public Polyvore Outfits
dataset (Han et al., "Learning Fashion Compatibility with Bidirectional
LSTMs," ACM Multimedia 2017; download via `npm run fetch:polyvore`, see
POLYVORE_COMPAT.md), not this app's own Mongo data.

Positive examples : real curated Polyvore outfits.
Negative examples : type-aware negatives (Vasileva et al., "Learning
                     Type-Aware Embeddings for Fashion Compatibility," ECCV
                     2018) — same category composition and size as a real
                     outfit, but each slot's item swapped in from a
                     *different* random outfit of the same category. Plain
                     whole-outfit shuffling (mismatched slot counts) would let
                     a classifier win almost entirely by detecting "does this
                     multiset have coherent slot structure", not real
                     compatibility — a dataset artifact, not signal.

Algorithm : Logistic Regression vs. Gradient Boosting, selected on the
            dataset's own validation split (not a fresh random split — more
            comparable to published results, avoids re-deriving a split the
            dataset already provides). Final metrics reported from the held-
            out test split, touched exactly once.

Feature engineering (category + color only — no images, matching this app's
own text/metadata-driven wardrobe model, WardrobeItem.js): category-bucket
counts/diversity from category_mapping.py, plus color-keyword hue features
ported from backend/services/fashionRulesEngine.js's COLOR_HUE/NEUTRAL_COLORS
(cited inline below) so both sides of the stack share one color vocabulary.

Deliberately NOT wired into the live scoring blend yet — see POLYVORE_COMPAT.md
and rankingService.js/scoringService.js's `datasetCompatProbability` field,
which is Phase 1: a visible, independent signal, not folded into
finalizeScore's confidence number until backtested against real
Recommendation outcomes.
"""

import json
import os
import random
import re
import sys
import warnings
from collections import defaultdict

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

import numpy as np
import pandas as pd
import joblib

from sklearn.linear_model    import LogisticRegression
from sklearn.ensemble        import GradientBoostingClassifier
from sklearn.pipeline        import Pipeline
from sklearn.preprocessing   import StandardScaler
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, confusion_matrix, classification_report,
)

from category_mapping import load_category_id_map, map_category_name

warnings.filterwarnings("ignore")

DATA_DIR       = os.path.join(os.path.dirname(__file__), "data", "polyvore")
MODEL_PATH     = os.path.join(os.path.dirname(__file__), "compat_model.pkl")
META_PATH      = os.path.join(os.path.dirname(__file__), "compat_model_meta.json")
RANDOM_STATE   = 42
MIN_SAMPLES    = 50   # cold-start guard, same threshold/philosophy as acceptance_trainer.py
MIN_ITEMS      = 2    # outfits thinner than this after cleaning carry no composition signal
TARGET_COLUMN  = "label"

# Buckets mirror WardrobeItem.js's `category` enum exactly (see category_mapping.py).
BUCKETS = ["tops", "bottoms", "dresses", "footwear", "accessories"]

NUMERICAL_FEATURES = [
    "numItems", "numTops", "numBottoms", "numDresses", "numFootwear", "numAccessories",
    "categoryDiversity", "hasDressAndBottom",
    "numColorsDetected", "numNeutralColors", "numNonNeutralColors", "hasMultipleHues",
    "avgPairwiseHueDistance", "minPairwiseHueDistance",
]
ALL_FEATURES = NUMERICAL_FEATURES


# ===========================================================================
# COLOR VOCABULARY — ported from backend/services/fashionRulesEngine.js:6-21
# (COLOR_HUE, NEUTRAL_COLORS). Kept as a direct line-for-line port rather than
# a shared file across languages, same as acceptance_trainer.py's
# OCCASION_FORMALITY/weather_tier_from_temp mirroring fashionRulesEngine.js —
# this project has no cross-language shared-config mechanism, so "mirrors X,
# keep in sync manually" is the existing, established pattern.
# ===========================================================================
COLOR_HUE = {
    "red": 0, "crimson": 0, "maroon": 0, "burgundy": 330,
    "coral": 16, "salmon": 15, "peach": 25,
    "orange": 30, "rust": 15, "terracotta": 20,
    "yellow": 60, "gold": 45, "mustard": 50, "amber": 38,
    "lime": 80,
    "green": 120, "olive": 80, "emerald": 145, "mint": 155, "sage": 130,
    "teal": 178, "cyan": 190, "turquoise": 174, "aqua": 180,
    "blue": 220, "navy": 220, "royal": 230, "cobalt": 215, "denim": 220,
    "purple": 270, "violet": 280, "lavender": 260, "plum": 290, "lilac": 265,
    "pink": 330, "rose": 340, "blush": 340, "fuchsia": 310, "magenta": 300,
}
NEUTRAL_COLORS = {
    "black", "white", "grey", "gray", "beige", "cream", "ivory",
    "tan", "nude", "brown", "camel", "khaki", "off-white", "charcoal",
    "taupe", "sand", "ecru", "champagne",
}
_COLOR_WORDS = sorted(set(COLOR_HUE) | NEUTRAL_COLORS, key=len, reverse=True)
_COLOR_PATTERN = re.compile(r"\b(" + "|".join(re.escape(w) for w in _COLOR_WORDS) + r")\b")


def extract_item_color(name: str):
    """First color keyword found in an item's free-text name, or None."""
    if not name:
        return None
    match = _COLOR_PATTERN.search(name.lower())
    return match.group(1) if match else None


def _circular_hue_distance(a: float, b: float) -> float:
    d = abs(a - b) % 360
    return min(d, 360 - d)


# ===========================================================================
# DATA LOADING
# ===========================================================================

def load_split(name: str) -> list:
    """Loads one of train/valid/test_no_dup.json from ml-service/data/polyvore/."""
    path = os.path.join(DATA_DIR, f"{name}_no_dup.json")
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"{path} not found. Run `npm run fetch:polyvore` first (see POLYVORE_COMPAT.md)."
        )
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def clean_outfit(outfit: dict, category_id_map: dict) -> list:
    """
    Drops items with empty names or non-fashion/unmapped categories.
    Returns a list of {name, subgroup, bucket} dicts, or [] if the outfit
    doesn't have enough real fashion items left to be meaningful.
    """
    cleaned = []
    for item in outfit.get("items", []):
        name = (item.get("name") or "").strip()
        if not name:
            continue
        # category_id.txt entries are looked up by name text (see
        # category_mapping.py's module docstring for why name text, not id).
        cat_name = category_id_map.get(item.get("categoryid"))
        if not cat_name:
            continue
        subgroup, bucket = map_category_name(cat_name)
        if subgroup is None or subgroup == "excluded":
            continue
        cleaned.append({"name": name, "subgroup": subgroup, "bucket": bucket})
    return cleaned if len(cleaned) >= MIN_ITEMS else []


def build_subgroup_pool(cleaned_outfits: list) -> dict:
    """subgroup -> list of item names seen anywhere in this split (for type-aware negatives)."""
    pool = defaultdict(list)
    for items in cleaned_outfits:
        for it in items:
            pool[it["subgroup"]].append(it["name"])
    return pool


def build_type_aware_negative(items: list, pool: dict, rng: random.Random) -> list:
    """
    Same category composition and size as `items`, but each slot's item name
    is swapped in from a random *different* outfit's item of the same
    subgroup. See module docstring for why this — not whole-outfit shuffling.
    """
    negative = []
    for it in items:
        candidates = pool.get(it["subgroup"], [])
        if not candidates:
            negative.append(it)  # no alternative available — keep original (rare)
            continue
        # A few resample attempts to avoid trivially picking the same item
        # back; not guaranteed distinct (small pools), which is fine — the
        # *category structure* being real-but-uncurated is what matters here.
        pick = it["name"]
        for _ in range(5):
            pick = rng.choice(candidates)
            if pick != it["name"]:
                break
        negative.append({"name": pick, "subgroup": it["subgroup"], "bucket": it["bucket"]})
    return negative


# ===========================================================================
# FEATURE ENGINEERING
# ===========================================================================

def build_outfit_features(items: list) -> dict:
    buckets_present = [it["bucket"] for it in items]
    names            = [it["name"] for it in items]

    colors = [extract_item_color(n) for n in names]
    colors = [c for c in colors if c]
    neutral_colors     = [c for c in colors if c in NEUTRAL_COLORS]
    non_neutral_colors = [c for c in colors if c not in NEUTRAL_COLORS]
    hues = [COLOR_HUE[c] for c in non_neutral_colors]

    if len(hues) >= 2:
        pair_dists = [_circular_hue_distance(a, b)
                      for i, a in enumerate(hues) for b in hues[i + 1:]]
        avg_hue_dist = float(np.mean(pair_dists))
        min_hue_dist = float(np.min(pair_dists))
        has_multiple_hues = 1
    else:
        avg_hue_dist = 0.0
        min_hue_dist = 0.0
        has_multiple_hues = 0

    bucket_counts = {b: buckets_present.count(b) for b in BUCKETS}

    return {
        "numItems":            len(items),
        "numTops":              bucket_counts["tops"],
        "numBottoms":           bucket_counts["bottoms"],
        "numDresses":           bucket_counts["dresses"],
        "numFootwear":          bucket_counts["footwear"],
        "numAccessories":       bucket_counts["accessories"],
        "categoryDiversity":    len({b for b in buckets_present}),
        "hasDressAndBottom":    int(bucket_counts["dresses"] > 0 and bucket_counts["bottoms"] > 0),
        "numColorsDetected":    len(colors),
        "numNeutralColors":     len(neutral_colors),
        "numNonNeutralColors":  len(non_neutral_colors),
        "hasMultipleHues":      has_multiple_hues,
        "avgPairwiseHueDistance": avg_hue_dist,
        "minPairwiseHueDistance": min_hue_dist,
    }


def build_dataset(outfits: list, category_id_map: dict, rng_seed: int = RANDOM_STATE) -> pd.DataFrame:
    """
    One positive (label=1, real curated outfit) + one type-aware negative
    (label=0) row per usable outfit — a deliberately balanced 1:1 dataset,
    so 50% is the honest majority-baseline to beat (see print_evaluation).
    """
    rng = random.Random(rng_seed)
    cleaned_outfits = [clean_outfit(o, category_id_map) for o in outfits]
    cleaned_outfits = [c for c in cleaned_outfits if c]
    pool = build_subgroup_pool(cleaned_outfits)

    rows = []
    for items in cleaned_outfits:
        pos_features = build_outfit_features(items)
        pos_features[TARGET_COLUMN] = 1
        rows.append(pos_features)

        negative_items = build_type_aware_negative(items, pool, rng)
        neg_features = build_outfit_features(negative_items)
        neg_features[TARGET_COLUMN] = 0
        rows.append(neg_features)

    return pd.DataFrame(rows)


def inspect_dataset(df: pd.DataFrame, split_name: str) -> None:
    print("\n" + "=" * 60)
    print(f"POLYVORE COMPAT MODEL — {split_name.upper()} SET OVERVIEW")
    print("=" * 60)
    print(f"  Rows: {len(df)}")
    if len(df):
        print(f"  Label distribution:\n{df[TARGET_COLUMN].value_counts().to_string()}")
    print("=" * 60 + "\n")


# ===========================================================================
# PIPELINE
# ===========================================================================

def build_pipeline() -> Pipeline:
    return Pipeline(steps=[
        ("scaler", StandardScaler()),
        ("classifier", LogisticRegression(max_iter=1000, class_weight="balanced", random_state=RANDOM_STATE)),
    ])


def build_pipeline_gb() -> Pipeline:
    return Pipeline(steps=[
        ("classifier", GradientBoostingClassifier(
            n_estimators=150, max_depth=3, learning_rate=0.05, random_state=RANDOM_STATE)),
    ])


def _evaluate(pipeline: Pipeline, X: pd.DataFrame, y: pd.Series) -> dict:
    y_pred  = pipeline.predict(X)
    y_proba = pipeline.predict_proba(X)[:, 1]
    return {
        "accuracy":  float(accuracy_score(y, y_pred)),
        "precision": float(precision_score(y, y_pred, zero_division=0)),
        "recall":    float(recall_score(y, y_pred, zero_division=0)),
        "f1":        float(f1_score(y, y_pred, zero_division=0)),
        "roc_auc":   float(roc_auc_score(y, y_proba)) if y.nunique() > 1 else None,
        "confusion_matrix": confusion_matrix(y, y_pred).tolist(),
        "classification_report": classification_report(y, y_pred, zero_division=0),
        "n": len(y),
    }


def select_model_on_valid(train_df: pd.DataFrame, valid_df: pd.DataFrame) -> tuple:
    """
    Trains LR and GB on the train split, picks whichever scores higher
    ROC-AUC on the *validation* split (not a fresh k-fold — the dataset
    already ships a valid/test split, so reusing it is both more rigorous
    and more comparable to published results than re-deriving one).
    """
    if len(train_df) < MIN_SAMPLES or train_df[TARGET_COLUMN].nunique() < 2:
        raise ValueError(f"Insufficient training data: need >= {MIN_SAMPLES} samples and both classes.")

    X_train, y_train = train_df[ALL_FEATURES], train_df[TARGET_COLUMN]
    X_valid, y_valid = valid_df[ALL_FEATURES], valid_df[TARGET_COLUMN]

    lr = build_pipeline().fit(X_train, y_train)
    gb = build_pipeline_gb().fit(X_train, y_train)

    lr_valid_metrics = _evaluate(lr, X_valid, y_valid)
    gb_valid_metrics = _evaluate(gb, X_valid, y_valid)

    if (gb_valid_metrics["roc_auc"] or 0) > (lr_valid_metrics["roc_auc"] or 0):
        return gb, "gradient_boosting", {"logistic_regression": lr_valid_metrics, "gradient_boosting": gb_valid_metrics}
    return lr, "logistic_regression", {"logistic_regression": lr_valid_metrics, "gradient_boosting": gb_valid_metrics}


def evaluate_on_test(pipeline: Pipeline, test_df: pd.DataFrame) -> dict:
    """Touches the test split exactly once — for final reported numbers only."""
    X_test, y_test = test_df[ALL_FEATURES], test_df[TARGET_COLUMN]
    return _evaluate(pipeline, X_test, y_test)


def print_evaluation(label: str, metrics: dict) -> None:
    print("=" * 60)
    print(f"POLYVORE COMPAT MODEL — {label}")
    print("=" * 60)
    print(f"  N          : {metrics['n']}")
    print(f"  Accuracy   : {metrics['accuracy']:.4f}  (majority baseline: 0.5000 — balanced 1:1 dataset)")
    print(f"  Precision  : {metrics['precision']:.4f}")
    print(f"  Recall     : {metrics['recall']:.4f}")
    print(f"  F1 Score   : {metrics['f1']:.4f}")
    if metrics["roc_auc"] is not None:
        print(f"  ROC-AUC    : {metrics['roc_auc']:.4f}  (0.5 = no better than random)")
    print("  Confusion Matrix (rows=actual, cols=predicted [not-compatible, compatible]):")
    for row in metrics["confusion_matrix"]:
        print(f"    {row}")
    print()
    print(metrics["classification_report"])
    print("=" * 60 + "\n")


def save_model(pipeline: Pipeline, path: str = MODEL_PATH) -> None:
    joblib.dump(pipeline, path)


def load_model(path: str = MODEL_PATH) -> Pipeline:
    return joblib.load(path)


# ===========================================================================
# CLI entry point
# ===========================================================================

def main() -> None:
    print("\n" + "=" * 60)
    print("  StyleAI — Polyvore Real-Data Compatibility Model Training")
    print("  Final Year Thesis  |  Softwarica College")
    print("=" * 60 + "\n")

    category_id_path = os.path.join(DATA_DIR, "category_id.txt")
    if not os.path.exists(category_id_path):
        print(f"[TRAINING FAILED] {category_id_path} not found. Run `npm run fetch:polyvore` first.")
        sys.exit(1)
    category_id_map = load_category_id_map(category_id_path)

    print("Loading dataset splits...")
    train_outfits = load_split("train")
    valid_outfits = load_split("valid")
    test_outfits  = load_split("test")

    print("Building features (this cleans + generates type-aware negatives)...")
    train_df = build_dataset(train_outfits, category_id_map, rng_seed=RANDOM_STATE)
    valid_df = build_dataset(valid_outfits, category_id_map, rng_seed=RANDOM_STATE + 1)
    test_df  = build_dataset(test_outfits,  category_id_map, rng_seed=RANDOM_STATE + 2)

    inspect_dataset(train_df, "train")
    inspect_dataset(valid_df, "valid")
    inspect_dataset(test_df, "test")

    try:
        pipeline, algorithm, valid_comparison = select_model_on_valid(train_df, valid_df)
    except ValueError as e:
        print(f"\n[TRAINING FAILED] {e}")
        sys.exit(1)

    print(f"Selected algorithm (by validation ROC-AUC): {algorithm}")
    print_evaluation("VALIDATION (model selection)", valid_comparison[algorithm])

    test_metrics = evaluate_on_test(pipeline, test_df)
    print_evaluation("TEST (final, touched once)", test_metrics)

    save_model(pipeline, MODEL_PATH)

    meta = {
        "version":     "1.0.0",
        "algorithm":   algorithm,
        "features":    ALL_FEATURES,
        "trainingSize": len(train_df),
        "validationSize": len(valid_df),
        "testSize":    len(test_df),
        "validationComparison": {
            "logistic_regression": {k: v for k, v in valid_comparison["logistic_regression"].items() if k != "classification_report"},
            "gradient_boosting":   {k: v for k, v in valid_comparison["gradient_boosting"].items() if k != "classification_report"},
        },
        "testMetrics": {k: v for k, v in test_metrics.items() if k != "classification_report"},
        "testClassificationReport": test_metrics["classification_report"],
        "datasetSource": "Han et al. 2017, Polyvore Outfits (xthan/polyvore-dataset)",
        "negativeSamplingMethod": "type-aware (Vasileva et al. 2018) — same category composition/size, items swapped from other outfits of matching subgroup",
    }
    with open(META_PATH, "w") as f:
        json.dump(meta, f, indent=2)

    print(f"Model saved to {MODEL_PATH}")
    print(f"Metadata saved to {META_PATH}")


if __name__ == "__main__":
    main()
