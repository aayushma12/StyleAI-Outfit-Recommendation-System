# -*- coding: utf-8 -*-
"""
calibration_analysis.py — Is the confidence StyleAI shows users honest?

Two distinct questions, both real, both reported separately (never conflated):

1. Is the RAW acceptance model's predict_proba() well-calibrated? Evaluated
   via k-fold out-of-fold predictions (cross_val_predict) rather than the
   single small train/test split already used for headline accuracy metrics —
   a held-out split that size would make for a noisy reliability diagram.
   acceptance_trainer.py's own code comments already assert Logistic
   Regression's predict_proba() is "properly calibrated by construction" —
   this script actually tests that assumption instead of trusting it.

2. Is the DISPLAYED confidence (the 85% rule-score + 15% ML-probability blend
   users actually see — see scoringService.finalizeScore) honest? i.e. "if we
   show 80%, do about 80% of those recommendations actually get accepted?"
   Answered directly from real historical Recommendation documents already in
   MongoDB — no synthetic data, no re-scoring needed, since `confidence` and
   `status` are both already persisted per recommendation.

Usage: python calibration_analysis.py
Writes calibration_report.json (bin-level data for plotting in the thesis)
and prints a plain-language verdict for each question.
"""
import os
import sys
import json

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

import numpy as np
from sklearn.calibration import calibration_curve
from sklearn.metrics import brier_score_loss
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from pymongo import MongoClient

import acceptance_trainer as trainer

N_BINS = 10
# A model that always predicted the base rate would score ~0.25 Brier on a
# roughly-balanced binary target — meaningfully uninformative. This threshold
# is deliberately generous (well below "uninformative", not a tight bar) so a
# correction is only recommended when the raw model's calibration is a real,
# not marginal, problem.
MISCALIBRATION_BRIER_THRESHOLD = 0.20


def evaluate_raw_model_calibration(df):
    """Out-of-fold calibration_curve + Brier score for the raw acceptance model."""
    X, y = df[trainer.ALL_FEATURES], df[trainer.TARGET_COLUMN]
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=trainer.RANDOM_STATE)
    oof_proba = cross_val_predict(trainer.build_pipeline(), X, y, cv=cv, method="predict_proba", n_jobs=-1)[:, 1]

    brier = float(brier_score_loss(y, oof_proba))
    frac_pos, mean_pred = calibration_curve(y, oof_proba, n_bins=N_BINS, strategy="quantile")

    return {
        "brierScore": round(brier, 4),
        "bins": [{"meanPredicted": round(float(p), 4), "actualFraction": round(float(f), 4)}
                  for p, f in zip(mean_pred, frac_pos)],
        "sampleSize": int(len(y)),
        "wellCalibrated": brier < MISCALIBRATION_BRIER_THRESHOLD,
    }


def evaluate_displayed_confidence_calibration(db):
    """
    Buckets the REAL, already-displayed (rule+ML blended) confidence values
    against real accept/reject outcomes, pulled directly from MongoDB —
    exactly what a user actually saw, not a recomputed value.
    """
    pipeline = [
        {"$unwind": "$recommendations"},
        {"$match": {"recommendations.status": {"$ne": "pending"}}},
        {"$project": {
            "_id": 0,
            "confidence": "$recommendations.confidence",
            "status":     "$recommendations.status",
        }},
    ]
    confidences, outcomes = [], []
    for doc in db.recommendations.aggregate(pipeline):
        status = doc.get("status")
        if status in ("worn", "saved", "liked"):
            outcomes.append(1)
        elif status in ("disliked", "skipped"):
            outcomes.append(0)
        else:
            continue
        confidences.append(doc.get("confidence", 50) / 100.0)

    if len(confidences) < 20:
        return {"available": False, "reason": f"Only {len(confidences)} actioned recommendations found — need >= 20 for a meaningful bucket analysis."}

    confidences, outcomes = np.array(confidences), np.array(outcomes)
    brier = float(brier_score_loss(outcomes, confidences))

    # Fixed-width deciles (not quantile bins) — deliberately so an empty or
    # sparse bucket is visible in the report rather than silently merged away.
    bin_edges = np.linspace(0, 1, N_BINS + 1)
    bins = []
    for i in range(N_BINS):
        lo, hi = bin_edges[i], bin_edges[i + 1]
        mask = (confidences >= lo) & (confidences < hi if i < N_BINS - 1 else confidences <= hi)
        n = int(mask.sum())
        bins.append({
            "range": f"{int(lo*100)}-{int(hi*100)}%",
            "n": n,
            "meanPredicted": round(float(confidences[mask].mean()), 4) if n else None,
            "actualAcceptanceRate": round(float(outcomes[mask].mean()), 4) if n else None,
        })

    return {
        "available": True,
        "brierScore": round(brier, 4),
        "bins": bins,
        "sampleSize": int(len(confidences)),
        "wellCalibrated": brier < MISCALIBRATION_BRIER_THRESHOLD,
    }


def main():
    print("\n" + "=" * 60)
    print("  StyleAI — Confidence Calibration Analysis")
    print("=" * 60 + "\n")

    mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/outfit_recommendation")
    client = MongoClient(mongo_uri)
    try:
        db = client.get_default_database()
        df = trainer.load_training_data(db)

        print(f"Training rows available for raw-model out-of-fold evaluation: {len(df)}")
        if len(df) < trainer.MIN_SAMPLES:
            print(f"[SKIPPED] Need >= {trainer.MIN_SAMPLES} samples for a meaningful calibration curve.")
            raw_result = {"available": False, "reason": f"Only {len(df)} samples, need >= {trainer.MIN_SAMPLES}."}
        else:
            raw_result = evaluate_raw_model_calibration(df)
            raw_result["available"] = True
            verdict = "well-calibrated" if raw_result["wellCalibrated"] else "MISCALIBRATED — correction recommended"
            print(f"\n1. Raw model (out-of-fold): Brier score = {raw_result['brierScore']} -> {verdict}")
            print("   Reliability bins (mean predicted vs. actual accepted fraction):")
            for b in raw_result["bins"]:
                print(f"     predicted={b['meanPredicted']:.2f}  actual={b['actualFraction']:.2f}")

        displayed_result = evaluate_displayed_confidence_calibration(db)
        if displayed_result["available"]:
            verdict = "well-calibrated" if displayed_result["wellCalibrated"] else "MISCALIBRATED"
            print(f"\n2. Displayed (blended) confidence: Brier score = {displayed_result['brierScore']} -> {verdict}, n={displayed_result['sampleSize']}")
            print("   Bucket breakdown (range | n | mean predicted | actual acceptance rate):")
            for b in displayed_result["bins"]:
                if b["n"]:
                    print(f"     {b['range']:>8}  n={b['n']:<5} predicted={b['meanPredicted']:.2f}  actual={b['actualAcceptanceRate']:.2f}")
        else:
            print(f"\n2. Displayed confidence: [SKIPPED] {displayed_result['reason']}")

        report = {"rawModel": raw_result, "displayedConfidence": displayed_result}
        report_path = os.path.join(os.path.dirname(__file__), "calibration_report.json")
        with open(report_path, "w") as f:
            json.dump(report, f, indent=2)
        print(f"\nFull report written to {report_path}\n")
        return report
    finally:
        client.close()


if __name__ == "__main__":
    main()
