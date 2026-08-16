# -*- coding: utf-8 -*-
"""
Unit tests for polyvore_compat_trainer.py's pure functions — color
extraction, outfit cleaning, feature engineering, type-aware negative
sampling, and the cold-start guard. No real dataset files or MongoDB needed;
everything here runs against small in-memory fixtures, same style as
test_acceptance_trainer.py's FakeDB-less approach.
"""
import random
import sys
import os
import pytest
import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import polyvore_compat_trainer as pct


# ── extract_item_color ──────────────────────────────────────────────────────

@pytest.mark.parametrize('name,expected', [
    ('Navy blue silk blouse', 'navy'),
    ('mock neck embroidery suede sweatshirt', None),
    ('Cream cashmere sweater', 'cream'),
    ('Denim high rise jeans', 'denim'),
    ('', None),
    (None, None),
])
def test_extract_item_color(name, expected):
    assert pct.extract_item_color(name) == expected


def test_extract_item_color_uses_word_boundaries():
    # "tan" must not match inside "instant" — regression guard for the
    # word-boundary regex, not a hypothetical concern given free-text names.
    assert pct.extract_item_color('Instant classic trench coat') is None


# ── clean_outfit ─────────────────────────────────────────────────────────────

CATEGORY_ID_MAP = {
    17: 'Blouses',       # -> blouses_shirts / tops
    27: 'Jeans',         # -> denim_bottoms / bottoms
    41: 'Shoes',         # -> general_shoes / footwear
    93: 'Makeup',        # -> excluded (non-fashion)
    9999: 'Nonexistent Category XYZ',  # -> unmapped (None, None)
}


def make_outfit(items):
    return {'items': items}


def test_clean_outfit_drops_empty_names():
    outfit = make_outfit([
        {'name': 'blue blouse', 'categoryid': 17},
        {'name': '', 'categoryid': 27},
        {'name': '  ', 'categoryid': 41},
    ])
    cleaned = pct.clean_outfit(outfit, CATEGORY_ID_MAP)
    assert cleaned == []  # only 1 real item left, below MIN_ITEMS=2


def test_clean_outfit_drops_excluded_and_unmapped_categories():
    outfit = make_outfit([
        {'name': 'blue blouse', 'categoryid': 17},
        {'name': 'red lipstick', 'categoryid': 93},       # excluded
        {'name': 'mystery item', 'categoryid': 9999},     # unmapped
        {'name': 'black jeans', 'categoryid': 27},
    ])
    cleaned = pct.clean_outfit(outfit, CATEGORY_ID_MAP)
    names = {it['name'] for it in cleaned}
    assert names == {'blue blouse', 'black jeans'}


def test_clean_outfit_below_min_items_returns_empty():
    outfit = make_outfit([{'name': 'blue blouse', 'categoryid': 17}])
    assert pct.clean_outfit(outfit, CATEGORY_ID_MAP) == []


def test_clean_outfit_meeting_min_items_is_kept():
    outfit = make_outfit([
        {'name': 'blue blouse', 'categoryid': 17},
        {'name': 'black jeans', 'categoryid': 27},
    ])
    cleaned = pct.clean_outfit(outfit, CATEGORY_ID_MAP)
    assert len(cleaned) == 2
    assert {it['subgroup'] for it in cleaned} == {'blouses_shirts', 'denim_bottoms'}
    assert {it['bucket'] for it in cleaned} == {'tops', 'bottoms'}


# ── build_outfit_features ───────────────────────────────────────────────────

def test_build_outfit_features_bucket_counts_and_diversity():
    items = [
        {'name': 'navy blouse', 'subgroup': 'blouses_shirts', 'bucket': 'tops'},
        {'name': 'black jeans', 'subgroup': 'denim_bottoms', 'bucket': 'bottoms'},
        {'name': 'white sneakers', 'subgroup': 'sneakers_athletic', 'bucket': 'footwear'},
    ]
    feats = pct.build_outfit_features(items)
    assert feats['numItems'] == 3
    assert feats['numTops'] == 1
    assert feats['numBottoms'] == 1
    assert feats['numFootwear'] == 1
    assert feats['numDresses'] == 0
    assert feats['categoryDiversity'] == 3
    assert feats['hasDressAndBottom'] == 0


def test_build_outfit_features_dress_and_bottom_flag():
    items = [
        {'name': 'red dress', 'subgroup': 'dresses', 'bucket': 'dresses'},
        {'name': 'black skirt', 'subgroup': 'skirts', 'bucket': 'bottoms'},
    ]
    feats = pct.build_outfit_features(items)
    assert feats['hasDressAndBottom'] == 1


def test_build_outfit_features_color_and_hue_distance():
    # navy=220, red=0 -> circular distance = min(220, 140) = 140
    items = [
        {'name': 'navy blouse', 'subgroup': 'blouses_shirts', 'bucket': 'tops'},
        {'name': 'red skirt', 'subgroup': 'skirts', 'bucket': 'bottoms'},
    ]
    feats = pct.build_outfit_features(items)
    assert feats['numColorsDetected'] == 2
    assert feats['numNeutralColors'] == 0
    assert feats['numNonNeutralColors'] == 2
    assert feats['hasMultipleHues'] == 1
    assert feats['avgPairwiseHueDistance'] == pytest.approx(140.0)
    assert feats['minPairwiseHueDistance'] == pytest.approx(140.0)


def test_build_outfit_features_single_color_has_no_hue_distance():
    items = [
        {'name': 'navy blouse', 'subgroup': 'blouses_shirts', 'bucket': 'tops'},
        {'name': 'plain jeans', 'subgroup': 'denim_bottoms', 'bucket': 'bottoms'},
    ]
    feats = pct.build_outfit_features(items)
    assert feats['hasMultipleHues'] == 0
    assert feats['avgPairwiseHueDistance'] == 0.0
    assert feats['minPairwiseHueDistance'] == 0.0


def test_build_outfit_features_neutral_colors_excluded_from_hue_count():
    items = [
        {'name': 'black blouse', 'subgroup': 'blouses_shirts', 'bucket': 'tops'},
        {'name': 'white jeans', 'subgroup': 'denim_bottoms', 'bucket': 'bottoms'},
    ]
    feats = pct.build_outfit_features(items)
    assert feats['numNeutralColors'] == 2
    assert feats['numNonNeutralColors'] == 0
    assert feats['hasMultipleHues'] == 0


# ── build_type_aware_negative — the leakage-risk regression guard ──────────

def test_type_aware_negative_preserves_composition_and_size():
    items = [
        {'name': 'navy blouse', 'subgroup': 'blouses_shirts', 'bucket': 'tops'},
        {'name': 'black jeans', 'subgroup': 'denim_bottoms', 'bucket': 'bottoms'},
        {'name': 'white sneakers', 'subgroup': 'sneakers_athletic', 'bucket': 'footwear'},
    ]
    pool = {
        'blouses_shirts':     ['red blouse', 'green blouse', 'navy blouse'],
        'denim_bottoms':      ['blue jeans', 'grey jeans'],
        'sneakers_athletic':  ['pink sneakers'],
    }
    rng = random.Random(1)
    negative = pct.build_type_aware_negative(items, pool, rng)

    assert len(negative) == len(items)
    assert [it['subgroup'] for it in negative] == [it['subgroup'] for it in items]
    assert [it['bucket'] for it in negative] == [it['bucket'] for it in items]
    # Every substituted name actually came from the matching subgroup's pool.
    for orig, neg in zip(items, negative):
        assert neg['name'] in pool[orig['subgroup']]


def test_type_aware_negative_falls_back_to_original_when_pool_empty():
    items = [{'name': 'unique hat', 'subgroup': 'hats', 'bucket': 'accessories'}]
    negative = pct.build_type_aware_negative(items, pool={}, rng=random.Random(1))
    assert negative == items


# ── select_model_on_valid — cold-start guard ────────────────────────────────

def test_select_model_on_valid_raises_on_insufficient_data():
    tiny_df = pd.DataFrame([
        {**{f: 0 for f in pct.ALL_FEATURES}, 'label': 1},
        {**{f: 0 for f in pct.ALL_FEATURES}, 'label': 0},
    ])
    with pytest.raises(ValueError):
        pct.select_model_on_valid(tiny_df, tiny_df)
