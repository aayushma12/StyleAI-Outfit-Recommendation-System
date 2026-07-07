# -*- coding: utf-8 -*-
"""
AI Outfit Recommendation System - Acceptance Prediction Model
Author  : Aayushma Acharya
Project : StyleAI - Final Year Thesis
College : Softwarica College of IT & E-Commerce

This supersedes the earlier outfit_recommender_ml.py (Random Forest, trained
on a small static CSV, multi-class outfit-label prediction). That model is
kept in the repo as documented prior work but is no longer used in the live
pipeline — it was never actually retrained/evaluated in production
(model_meta.json showed accuracy: null).

This model answers a different, more useful question for a *deterministic*
recommendation pipeline: given the same 9 rule-based compatibility scores the
Node scoring engine already computes for a candidate outfit (style match,
color harmony, occasion fit, weather fit, ...), how likely is a real user to
accept it (wear/save/like it, or rate it >=4)? Its output becomes one more
signal blended into the final ranking — not the sole source of truth.

Algorithm : Logistic Regression (binary classification)
Encoding  : OneHotEncoder for the one categorical feature (weatherTier),
            passthrough for the rest (already 0-1 scores / small ordinals)
Framework : scikit-learn Pipeline
Data      : real Recommendation documents from MongoDB (this app's own
            usage history) — not a static file, so quality/size grows with
            real usage.

THESIS EXPLANATION — Why Logistic Regression over Random Forest here?
─────────────────────────────────────────────────────────────────────────
1. This is a binary accept/reject decision, not multi-class outfit labeling
   — logistic regression is the standard, most defensible baseline choice.
2. Coefficients are directly interpretable ("occasionFit contributes +0.34
   log-odds to acceptance"), which is exactly the kind of explainability a
   thesis viva expects, without extra work (RF feature_importances_ does not
   give direction, only magnitude).
3. LogisticRegression's predict_proba() is a properly calibrated probability
   by construction; a RandomForestClassifier's predict_proba() is only a
   naive vote fraction and would need CalibratedClassifierCV to be honest
   about probabilities — unnecessary complexity at this dataset size.
"""

import os
import sys
import json
import warnings
from datetime import datetime

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

import numpy as np
import pandas as pd
import joblib

from sklearn.linear_model    import LogisticRegression
from sklearn.ensemble        import GradientBoostingClassifier
from sklearn.calibration     import CalibratedClassifierCV
from sklearn.preprocessing   import OneHotEncoder
from sklearn.compose         import ColumnTransformer
from sklearn.pipeline        import Pipeline
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_validate
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, confusion_matrix, classification_report,
)

warnings.filterwarnings("ignore")

MODEL_PATH   = os.path.join(os.path.dirname(__file__), "acceptance_model.pkl")
RANDOM_STATE = 42
TEST_SIZE    = 0.20
MIN_SAMPLES  = 50   # cold-start guard — refuse to train on too little real data
MIN_CLASSES  = 2

# ── Feature schema — mirrors backend/services/rankingService.js's featureBatch exactly ──
SCORE_FEATURES       = ["styleMatch", "colorHarmony", "colorPref", "occasionFit",
                         "weatherFit", "behaviorSignal", "bodyTypeMatch", "fabricMatch", "trendScore"]
NUMERICAL_FEATURES   = SCORE_FEATURES + ["occasionFormality", "isWardrobeOnly"]
CATEGORICAL_FEATURES = ["weatherTier"]
ALL_FEATURES         = NUMERICAL_FEATURES + CATEGORICAL_FEATURES
TARGET_COLUMN        = "label"

# Mirrors backend/services/fashionRulesEngine.js's OCCASION_META formality scale.
OCCASION_FORMALITY = {
    "daily": 1, "college": 1, "home": 0, "travel": 1, "gym": 0, "cafe": 1,
    "shopping": 1, "date": 2, "party": 2, "office": 3, "formal": 4,
    "festival": 3, "wedding": 4, "pooja": 3, "trekking": 0,
}

# Mirrors backend/services/fashionRulesEngine.js's WEATHER_TIERS temperature bands.
def weather_tier_from_temp(temp):
    if temp is None:
        return "mild"
    if temp < 5:   return "freezing"
    if temp < 14:  return "cold"
    if temp < 20:  return "cool"
    if temp < 26:  return "mild"
    if temp < 32:  return "warm"
    return "hot"

# Stored Recommendation.scores field names (0-100 ints) -> live feature names (0-1 floats).
# 'colorPreference' is the schema field name; 'colorPref' is what Node's live
# scoring/ranking code calls the same dimension — kept distinct on purpose,
# see scoringService.js's computeSubScores.
STORED_SCORE_TO_FEATURE = {
    "styleMatch": "styleMatch", "colorHarmony": "colorHarmony",
    "colorPreference": "colorPref", "occasionFit": "occasionFit",
    "weatherFit": "weatherFit", "behaviorSignal": "behaviorSignal",
    "bodyTypeMatch": "bodyTypeMatch", "fabricMatch": "fabricMatch",
    "trendScore": "trendScore",
}


# ===========================================================================
# DATA LOADING — real usage data from MongoDB, not a static file
# ===========================================================================

def load_training_data(db) -> pd.DataFrame:
    """
    Pulls every actioned (non-pending) ranked recommendation across all
    sessions and turns it into one labeled training row. label=1 when the
    user accepted the outfit (worn/saved/liked, or rated it >=4); label=0
    when they rejected it (disliked/skipped, or rated it <=2). Ambiguous
    3-star ratings with no clear status are excluded rather than guessed.
    """
    pipeline = [
        {"$unwind": "$recommendations"},
        {"$match": {"recommendations.status": {"$ne": "pending"}}},
        {"$project": {
            "_id": 0,
            "scores":       "$recommendations.scores",
            "status":       "$recommendations.status",
            "userRating":   "$recommendations.userRating",
            "occasion":     "$context.occasion",
            "wardrobeOnly": "$context.wardrobeOnly",
            "weatherTemp":  "$context.weather.temp",
            # Provenance — reporting-only columns, never used as model features
            # (dropped before X = df[ALL_FEATURES] in train_and_evaluate). Lets
            # the training run honestly report how much of its data is
            # synthetic vs. real, and from how many distinct personas.
            "synthetic":        {"$ifNull": ["$synthetic", False]},
            "personaArchetype": {"$ifNull": ["$syntheticMeta.personaArchetype", ""]},
        }},
    ]

    rows = []
    for doc in db.recommendations.aggregate(pipeline):
        status = doc.get("status")
        rating = doc.get("userRating")

        if status in ("worn", "saved", "liked"):
            label = 1
        elif status in ("disliked", "skipped"):
            label = 0
        elif rating is not None and rating >= 4:
            label = 1
        elif rating is not None and rating <= 2:
            label = 0
        else:
            continue  # ambiguous — skip rather than guess

        scores = doc.get("scores") or {}
        row = {}
        for stored_key, feature_key in STORED_SCORE_TO_FEATURE.items():
            row[feature_key] = (scores.get(stored_key, 70) or 70) / 100.0

        occasion = (doc.get("occasion") or "daily").lower()
        row["occasionFormality"] = OCCASION_FORMALITY.get(occasion, 1)
        row["isWardrobeOnly"]    = int(bool(doc.get("wardrobeOnly")))
        row["weatherTier"]       = weather_tier_from_temp(doc.get("weatherTemp"))
        row[TARGET_COLUMN]       = label
        row["synthetic"]         = bool(doc.get("synthetic", False))
        row["personaArchetype"]  = doc.get("personaArchetype") or ""

        rows.append(row)

    return pd.DataFrame(rows)


def inspect_dataset(df: pd.DataFrame) -> None:
    print("\n" + "=" * 60)
    print("ACCEPTANCE MODEL — DATASET OVERVIEW")
    print("=" * 60)
    print(f"  Rows (labeled samples): {len(df)}")
    if len(df):
        print(f"  Label distribution:\n{df[TARGET_COLUMN].value_counts().to_string()}")
    print("=" * 60 + "\n")


# ===========================================================================
# PIPELINE
# ===========================================================================

def build_pipeline() -> Pipeline:
    preprocessor = ColumnTransformer(transformers=[
        ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CATEGORICAL_FEATURES),
        ("num", "passthrough", NUMERICAL_FEATURES),
    ])
    return Pipeline(steps=[
        ("preprocessor", preprocessor),
        ("classifier", LogisticRegression(max_iter=1000, class_weight="balanced", random_state=RANDOM_STATE)),
    ])


def build_pipeline_calibrated(method: str = None) -> Pipeline:
    """
    Same Logistic Regression as build_pipeline(), wrapped in
    CalibratedClassifierCV. Not the default (see calibration_analysis.py's
    real, measured verdict: raw-model Brier score 0.183, below the 0.20
    "meaningfully miscalibrated" threshold used there — an honest finding of
    "adequate, not broken"). Kept available and fully tested because the
    reliability diagram does show a real, visible underconfidence pattern in
    the low-to-mid probability range, even though the aggregate Brier score
    doesn't cross the threshold — opt in via CALIBRATE_MODEL=true.

    method='sigmoid' (Platt scaling) is the default rather than 'isotonic' —
    isotonic regression is non-parametric and needs more data to avoid
    overfitting than this project's ~200 real samples provide; Platt's
    2-parameter logistic fit is the safer choice at this dataset size.
    """
    method = method or os.getenv("CALIBRATION_METHOD", "sigmoid")
    preprocessor = ColumnTransformer(transformers=[
        ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CATEGORICAL_FEATURES),
        ("num", "passthrough", NUMERICAL_FEATURES),
    ])
    base = LogisticRegression(max_iter=1000, class_weight="balanced", random_state=RANDOM_STATE)
    calibrated = CalibratedClassifierCV(base, method=method, cv=3)
    return Pipeline(steps=[
        ("preprocessor", preprocessor),
        ("classifier", calibrated),
    ])


def build_pipeline_gb() -> Pipeline:
    """
    Second candidate algorithm for the documented LR-vs-GB comparison (see
    compare_algorithms). No new dependency — GradientBoostingClassifier ships
    in the already-pinned scikit-learn==1.4.2.
    """
    preprocessor = ColumnTransformer(transformers=[
        ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CATEGORICAL_FEATURES),
        ("num", "passthrough", NUMERICAL_FEATURES),
    ])
    return Pipeline(steps=[
        ("preprocessor", preprocessor),
        ("classifier", GradientBoostingClassifier(
            n_estimators=150, max_depth=3, learning_rate=0.05, random_state=RANDOM_STATE)),
    ])


# Mean CV ROC-AUC margin Gradient Boosting must beat Logistic Regression by
# before it's worth deploying instead — a small, noise-level edge doesn't
# justify losing LR's directly-signed, explainable coefficients (the whole
# basis of get_feature_importance() and the XAI panel's transparency claim).
GB_ADOPTION_MARGIN = 0.03


def cross_validate_model(df: pd.DataFrame, pipeline_builder, n_splits: int = 5) -> dict:
    """
    K-fold (default 5) stratified cross-validation for a given pipeline
    builder — reports mean +/- std per metric across folds, rather than the
    single train/test split's single-number estimate that train_and_evaluate
    uses for the deployed model's headline metrics.
    """
    X, y = df[ALL_FEATURES], df[TARGET_COLUMN]
    cv = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=RANDOM_STATE)
    scoring = ["accuracy", "precision", "recall", "f1", "roc_auc"]
    scores = cross_validate(pipeline_builder(), X, y, cv=cv, scoring=scoring, n_jobs=-1)
    return {
        metric: {"mean": round(float(scores[f"test_{metric}"].mean()), 4),
                 "std":  round(float(scores[f"test_{metric}"].std()), 4)}
        for metric in scoring
    }


def compare_algorithms(df: pd.DataFrame, n_splits: int = 5) -> dict:
    """
    Documented, honest algorithm comparison — Logistic Regression (current
    production default) vs. Gradient Boosting — via k-fold CV on the same
    data. Guarded against starving a fold on a still-small dataset; degrades
    to a clean "not enough data yet" result rather than crashing, matching
    the existing cold-start philosophy of train_and_evaluate.
    """
    min_required = MIN_SAMPLES * n_splits
    if len(df) < min_required:
        return {"available": False, "reason": f"Need >= {min_required} samples for {n_splits}-fold CV, have {len(df)}."}

    lr_scores = cross_validate_model(df, build_pipeline, n_splits)
    gb_scores = cross_validate_model(df, build_pipeline_gb, n_splits)
    margin = gb_scores["roc_auc"]["mean"] - lr_scores["roc_auc"]["mean"]
    recommended = "gradient_boosting" if margin > GB_ADOPTION_MARGIN else "logistic_regression"

    return {
        "available": True,
        "logistic_regression": lr_scores,
        "gradient_boosting":   gb_scores,
        "rocAucMargin":        round(float(margin), 4),
        "adoptionThreshold":   GB_ADOPTION_MARGIN,
        "recommended":         recommended,
    }


def train_and_evaluate(df: pd.DataFrame, pipeline_builder=build_pipeline) -> tuple:
    """
    Trains and evaluates the acceptance model. Raises ValueError if there
    isn't enough labeled data yet — callers (ml_engine.retrain) treat this
    as the documented cold-start case, not a crash.

    `pipeline_builder` defaults to the Logistic Regression pipeline (backward
    compatible with every existing caller) but can be swapped to
    build_pipeline_gb when ML_ALGORITHM=gradient_boosting is set — see
    ml_engine.retrain().
    """
    if len(df) < MIN_SAMPLES:
        raise ValueError(f"Insufficient data: need >= {MIN_SAMPLES} labeled samples, have {len(df)}.")
    if df[TARGET_COLUMN].nunique() < MIN_CLASSES:
        raise ValueError("Insufficient data: need both accepted and rejected examples to train.")

    X = df[ALL_FEATURES]
    y = df[TARGET_COLUMN]

    # Stratify only if every class has enough members to appear in both
    # splits — falls back to a plain random split for very small/imbalanced
    # early datasets rather than crashing.
    can_stratify = y.value_counts().min() >= 2
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE,
        stratify=y if can_stratify else None,
    )

    pipeline = pipeline_builder()
    pipeline.fit(X_train, y_train)

    y_pred  = pipeline.predict(X_test)
    y_proba = pipeline.predict_proba(X_test)[:, 1]

    metrics = {
        "accuracy":  accuracy_score(y_test, y_pred),
        "precision": precision_score(y_test, y_pred, zero_division=0),
        "recall":    recall_score(y_test, y_pred, zero_division=0),
        "f1":        f1_score(y_test, y_pred, zero_division=0),
        "roc_auc":   roc_auc_score(y_test, y_proba) if y_test.nunique() > 1 else None,
        "confusion_matrix": confusion_matrix(y_test, y_pred).tolist(),
        "training_size": len(df),
        "positive_rate": float(y.mean()),
        "classification_report": classification_report(y_test, y_pred, zero_division=0),
        # Provenance transparency — see load_training_data's $project comment.
        "synthetic_fraction": float(df["synthetic"].mean()) if "synthetic" in df.columns else None,
        "real_sample_count":  int((~df["synthetic"]).sum()) if "synthetic" in df.columns else None,
        "persona_count":      int(df.loc[df["synthetic"], "personaArchetype"].nunique()) if "synthetic" in df.columns else None,
    }
    return pipeline, metrics


def print_evaluation(metrics: dict) -> None:
    print("=" * 60)
    print("ACCEPTANCE MODEL — EVALUATION")
    print("=" * 60)
    print(f"  Accuracy  : {metrics['accuracy']:.4f}")
    print(f"  Precision : {metrics['precision']:.4f}")
    print(f"  Recall    : {metrics['recall']:.4f}")
    print(f"  F1 Score  : {metrics['f1']:.4f}")
    if metrics["roc_auc"] is not None:
        print(f"  ROC-AUC   : {metrics['roc_auc']:.4f}")
    print(f"  Confusion Matrix (rows=actual, cols=predicted [reject, accept]):")
    for row in metrics["confusion_matrix"]:
        print(f"    {row}")
    print()
    print(metrics["classification_report"])
    print("=" * 60 + "\n")


def get_feature_importance(pipeline: Pipeline, top_n: int = 20) -> list:
    """
    Logistic regression coefficients as signed feature importances — the
    sign tells you WHICH DIRECTION a feature pushes acceptance, unlike a
    Random Forest's magnitude-only feature_importances_.

    Handles both a raw LogisticRegression (has .coef_ directly) and a
    CalibratedClassifierCV-wrapped one (build_pipeline_calibrated) — the
    latter fits several fold-cloned copies of the base estimator internally
    (.calibrated_classifiers_), so their coefficients are averaged for one
    stable, representative report rather than picking one fold arbitrarily.
    Returns [] for an estimator with neither (e.g. a tree ensemble) rather
    than raising — this endpoint degrades gracefully, it doesn't 500.
    """
    preprocessor = pipeline.named_steps["preprocessor"]
    classifier   = pipeline.named_steps["classifier"]

    cat_names = preprocessor.named_transformers_["cat"].get_feature_names_out(CATEGORICAL_FEATURES).tolist()
    all_names = cat_names + NUMERICAL_FEATURES

    if hasattr(classifier, "coef_"):
        coefs = classifier.coef_[0]
    elif hasattr(classifier, "calibrated_classifiers_"):
        fold_coefs = [cc.estimator.coef_[0] for cc in classifier.calibrated_classifiers_ if hasattr(cc.estimator, "coef_")]
        if not fold_coefs:
            return []
        coefs = np.mean(fold_coefs, axis=0)
    else:
        return []

    order = np.argsort(np.abs(coefs))[::-1][:top_n]
    return [
        {"feature": all_names[i], "coefficient": round(float(coefs[i]), 4),
         "direction": "increases acceptance" if coefs[i] > 0 else "decreases acceptance"}
        for i in order
    ]


def save_model(pipeline: Pipeline, path: str) -> None:
    joblib.dump(pipeline, path)


def load_model(path: str) -> Pipeline:
    return joblib.load(path)


# ===========================================================================
# CLI entry point — standalone training/evaluation without starting Flask.
# Mirrors the old `npm run train:ml` workflow, now against live Mongo data.
# ===========================================================================

def main() -> None:
    # Deferred import — ml_engine imports this module at top level, so this
    # must stay a function-local import to avoid a circular import at load time.
    import ml_engine

    print("\n" + "=" * 60)
    print("  StyleAI — Acceptance Prediction Model Training")
    print("  Final Year Thesis  |  Softwarica College")
    print("=" * 60 + "\n")

    # Delegate to ml_engine.retrain() rather than duplicating its logic here —
    # this guarantees model_meta.json (which the admin panel reads) is updated
    # identically whether training is triggered via this CLI or the /retrain
    # HTTP endpoint.
    success, result = ml_engine.retrain()
    if success:
        print("Training complete. Metrics saved to model_meta.json:")
        print(json.dumps(result, indent=2))
    else:
        print(f"\n[TRAINING FAILED] {result}")
        print("If this is a cold-start message, generate more real usage (or run")
        print("seedSyntheticTrainingBehavior.js) before retraining.\n")


if __name__ == "__main__":
    main()
