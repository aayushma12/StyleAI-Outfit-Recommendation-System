# Polyvore Real-Data Compatibility Model

## What this is, and why it exists

An audit of this project's existing ML component (`acceptance_trainer.py`)
found that its trained acceptance-probability model, while genuinely built
with real scikit-learn training/evaluation, learns from data that is
**99.77% synthetic** — of 8,990 training rows, only 21 came from real user
interactions (see `model_meta.json`'s `realSampleCount`/`syntheticFraction`).
That is honest and disclosed in that model's own metadata, but it is a real
limitation for a thesis whose stated aim is to demonstrate ML trained on
real data.

This is a second, **independent** model trained entirely on a real public
dataset of human-curated outfits, added specifically to address that gap —
not to replace the acceptance model (which answers a different, still
valuable question: "will *this* user accept *this* outfit, based on this
app's own usage"). This model answers a narrower question: **does this
outfit's category composition and color combination resemble a real,
human-assembled outfit, or an incoherent one?**

## Dataset

**Source**: Han, Wu, Jiang & Davis, ["Learning Fashion Compatibility with
Bidirectional LSTMs,"](https://arxiv.org/abs/1707.05691) ACM Multimedia
2017. Mirror used: [`xthan/polyvore-dataset`](https://github.com/xthan/polyvore-dataset)
on GitHub — `polyvore.tar.gz` (JSON metadata only, ~8.4MB; no images, since
this app's own vision/text pipeline already handles color/category from user
photos independently, so item images add nothing this pipeline needs).

**License/provenance**: polyvore.com (the original site) is defunct. This
dataset survives only via third-party academic mirrors of the original
research release; there is no separate license file specifying commercial
terms. Use here is research/thesis-only, consistent with how the dataset has
been used in the academic literature it originates from.

**Splits** (used as provided, not re-derived — more rigorous and more
comparable to published work than re-shuffling): `train_no_dup.json`
(17,316 outfits), `valid_no_dup.json` (1,497), `test_no_dup.json` (3,076).
Each outfit item carries a free-text `name`, a numeric `categoryid`, and
(unused here) `price`/`likes`/a now-dead image URL.

**Reproducing**: `npm run fetch:polyvore` (downloads + sha256-verifies the
archive, see `scripts/download_polyvore.py`) then `npm run train:compat`
(see `polyvore_compat_trainer.py`). Neither the raw dataset nor the trained
model is committed to git — both are regenerable, same convention as the
acceptance model's `acceptance_model.pkl`.

## Cleaning and category mapping

The raw dataset is not pure clothing — Polyvore covered general "get the
look" boards including furniture, beauty products, electronics, and food.
`category_id.txt` lists 380 categories; `category_mapping.py` classifies
every one of them into either a fashion subgroup or an explicit exclusion
list (232 of the 380 are non-fashion noise — beauty, home decor, kitchenware,
electronics, age/gender meta-categories, sleepwear/intimates/swimwear judged
out of this app's 5-bucket wardrobe scope). Coverage is enforced by a test
(`tests/test_category_mapping.py::test_full_dataset_coverage`) that fails if
any real category in the downloaded vocabulary is neither mapped nor
explicitly excluded — nothing is silently dropped.

The 148 fashion-relevant categories are grouped into ~26 intermediate
subgroups (jackets, knitwear, denim bottoms, skirts, sneakers, heels/flats,
bags, jewelry, ...) rather than collapsed directly to this app's 5-bucket
`WardrobeItem.category` enum (tops/bottoms/dresses/footwear/accessories).
Collapsing straight to 5 buckets would destroy almost all category-
composition signal — most real outfits and most shuffled negatives would
look like nearly the same multiset (`{tops: 2-3, bottoms: 1, footwear: 1,
accessories: 1-2}`). The subgroup level is used for negative sampling
(below); the 5-bucket level is what actually reaches the feature vector.

Outfits with fewer than 2 usable fashion items after cleaning are dropped
entirely (no composition signal left).

## Negative sampling

Positive examples are the real, human-curated outfits as-is. Negative
examples use **type-aware negative sampling** (Vasileva et al.,
["Learning Type-Aware Embeddings for Fashion Compatibility,"](https://arxiv.org/abs/1803.09196)
ECCV 2018): each negative has the *same category composition and size* as
its positive counterpart, but every item is swapped in from a different,
randomly chosen outfit of the matching subgroup. This is deliberately not
plain whole-outfit shuffling — a shuffled outfit can end up with, say, 2 tops
and 0 bottoms, which would let a classifier win almost entirely by detecting
"does this multiset have coherent slot structure at all," a trivial dataset
artifact rather than real compatibility signal. Regression-tested in
`tests/test_polyvore_compat_trainer.py::test_type_aware_negative_preserves_composition_and_size`.

This produces a deliberately balanced 1:1 dataset (33,674 train rows / 2,546
valid / 5,304 test — half positive, half negative in every split), so **50%
is the honest majority-baseline any real signal has to beat.**

## Features

Category + color only — no images, consistent with this app's own
`WardrobeItem` data model (text/metadata-driven, not vision-embedding-driven
at the compatibility-scoring stage):

- Per-bucket item counts (`numTops`, `numBottoms`, `numDresses`,
  `numFootwear`, `numAccessories`) and `numItems`, `categoryDiversity`
  (distinct buckets present), `hasDressAndBottom` (an unusual combination
  worth its own explicit flag).
- Color features: color keywords extracted from item name text via a word
  list **ported line-for-line from `backend/services/fashionRulesEngine.js`'s
  `COLOR_HUE`/`NEUTRAL_COLORS`** (see `polyvore_compat_trainer.py`'s module
  docstring), so both the Python training side and the Node serving side
  (`rankingService.js`'s `buildCompatFeatures`) share one color vocabulary.
  From these: counts of neutral vs. non-neutral colors detected, and the
  average/minimum pairwise circular hue distance among detected colors
  (a numeric proxy for hue harmony/clash — deliberately not a reimplementation
  of `fashionRulesEngine.js`'s full qualitative complementary/analogous/
  triadic labeling logic, to avoid a second, potentially drifting copy of
  that reasoning).

## Model selection and real results

Logistic Regression and Gradient Boosting were both trained on the train
split and compared on the **validation** split (not a fresh k-fold — the
dataset already ships a valid/test split, so reusing it is both more
rigorous and more comparable to published results). Gradient Boosting won on
validation ROC-AUC and was selected; the **test split was touched exactly
once**, for the numbers below.

**These are the actual numbers from the real training run in this
repository (`compat_model_meta.json`) — nothing here is simulated or
projected:**

| Metric | Validation (model selection) | Test (final, touched once) |
|---|---|---|
| Accuracy | 0.5813 | 0.5843 |
| Precision | 0.5979 | 0.6020 |
| Recall | 0.4965 | 0.4974 |
| F1 | 0.5425 | 0.5447 |
| **ROC-AUC** | **0.6101** | **0.6089** |

Majority baseline on this balanced 1:1 dataset is 0.50 accuracy / 0.50
ROC-AUC. A test ROC-AUC of 0.609 is a real, modest, above-chance signal —
category composition and simple color-keyword features alone can partially
distinguish a real curated outfit from a type-aware-shuffled one, but far
from perfectly.

**Algorithm comparison on validation** (both trained on the same data):

| Algorithm | ROC-AUC |
|---|---|
| Logistic Regression | 0.5638 |
| Gradient Boosting (selected) | 0.6101 |

## Honest limitations

- **Not comparable to the original paper's numbers.** Han et al. (2017) use
  a bidirectional LSTM over CNN image embeddings and report much stronger
  compatibility discrimination. This baseline deliberately uses only
  category composition and free-text color keywords — no images — so a
  lower ROC-AUC than the original paper is expected, not a bug or a
  regression to fix.
- **Generic Western fashion-retail data, not Kathmandu-specific.** Polyvore
  reflects a 2010s Western online-fashion userbase. It says nothing about
  Nepali dress conventions, traditional wear (kurta/sari/dhaka), or local
  climate/occasion norms — those remain the domain of this app's own
  hand-built `fashionRulesEngine.js`/`kathmanduIntelligence.js`, which this
  model does not touch or replace.
- **Color signal depends on free-text item names containing a recognizable
  color word.** Roughly 1% of Polyvore item names are empty, and many more
  don't mention a color at all — those items simply contribute no color
  signal (not a guessed default), same "no forced guess" convention already
  used throughout `scoringService.js`.
- **Type-aware negatives are still synthetic negatives.** They preserve real
  category structure, but a swapped-in item was never actually chosen by a
  human to go with the rest of the outfit — the model is learning "does this
  category+color combination look like the kind of thing a curator would
  assemble," not literally "would a specific human accept this specific
  outfit."

## Integration status — Phase 1: visible, not blended

This model is wired end-to-end (`ml-service/compat_engine.py` →
`POST /predict-compat-batch` → `backend/services/mlBridgeService.js`'s
`predictCompat()` with its **own** circuit breaker, independent of the
acceptance model's → `rankingService.js` → `Recommendation.datasetCompatProbability`
→ `XAIPanel.jsx`'s "Real-Data Compatibility Check" badge) but is
**deliberately not blended into the confidence score** computed by
`scoringService.finalizeScore`. It is shown to the user as an independent,
labeled validation signal ("does a model trained on real curated human
outfits agree with our own ranking?"), not folded into the existing 85%
rule-based / 15% acceptance-model blend.

Reasons: there is no evidence yet for what blend weight would be correct —
the existing 85/15 split is itself an unvalidated fixed constant, and
stacking a second unvalidated constant on top would compound exactly the
"unjustified precision" problem this whole addition is meant to move away
from. Folding `datasetCompatProbability` into `finalizeScore` is left as a
concrete future phase, gated on backtesting it against real
`Recommendation.status`/`userRating` outcomes (the same data source
`acceptance_trainer.py` already reads) to justify a specific weight —
`datasetCompatProbability` is already persisted on every `Recommendation`
document specifically so that backtest is possible once enough real outcome
data accumulates.

## No retrain endpoint, by design

Unlike the acceptance model (which legitimately needs periodic retraining as
real usage grows, hence `POST /retrain`), the Polyvore dataset is static —
retraining is an occasional offline step (`npm run train:compat`), not a
live, admin-triggerable action. `compat_engine.py` intentionally exposes
only `load()`/predict/model-info, no retrain/backup machinery.
