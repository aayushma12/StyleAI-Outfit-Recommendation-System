# -*- coding: utf-8 -*-
"""
Unit tests for category_mapping.py's keyword-based Polyvore-category ->
subgroup/bucket mapping. The full-dataset coverage test needs the real
downloaded category_id.txt (`npm run fetch:polyvore`) and is skipped, not
failed, when it isn't present — same cold-start-guard philosophy as
acceptance_trainer.py's MIN_SAMPLES guard: a missing precondition is a clean
skip, not a crash.
"""
import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import category_mapping as cm

CATEGORY_ID_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'polyvore', 'category_id.txt')


# ── map_category_name — representative fashion categories ──────────────────

@pytest.mark.parametrize('name,expected_bucket', [
    ('Dresses', 'dresses'),
    ('Cocktail Dresses', 'dresses'),
    ('Jumpsuits', 'dresses'),
    ('Skirts', 'bottoms'),
    ('Jeans', 'bottoms'),
    ('Skinny Jeans', 'bottoms'),
    ('Shorts', 'bottoms'),
    ('Leggings', 'bottoms'),
    ('Pants', 'bottoms'),
    ('Sweaters', 'tops'),
    ('Cardigans', 'tops'),
    ('Hoodies', 'tops'),
    ('Jackets', 'tops'),
    ('Coats', 'tops'),
    ('Blazers', 'tops'),
    ('Suits', 'tops'),
    ('T-Shirts', 'tops'),
    ('Blouses', 'tops'),
    ("Men's Polos", 'tops'),
    ('Boots', 'footwear'),
    ('Sneakers', 'footwear'),
    ('Sandals', 'footwear'),
    ('Shoes', 'footwear'),
    ('Bags', 'accessories'),
    ('Handbags', 'accessories'),
    ('Jewelry', 'accessories'),
    ('Necklaces', 'accessories'),
    ('Watches', 'accessories'),
    ('Scarves', 'accessories'),
    ('Hats', 'accessories'),
    ('Belts', 'accessories'),
    ('Sunglasses', 'accessories'),
    ('Socks', 'accessories'),
])
def test_maps_fashion_categories_to_expected_bucket(name, expected_bucket):
    subgroup, bucket = cm.map_category_name(name)
    assert bucket == expected_bucket, f'{name!r} -> {(subgroup, bucket)}, expected bucket {expected_bucket!r}'


# ── map_category_name — non-fashion noise must be excluded, not mismapped ──

@pytest.mark.parametrize('name', [
    'Makeup', 'Skincare', 'Fragrance', 'Blush', 'Cheek Bronzer',
    'Furniture', 'Sofas', 'Ceiling Lights', 'Floor Lamps', 'Kitchen & Dining',
    'Electronics', 'Food & Drink', 'Books', 'Pets', 'Toys',
    'Kids', 'Baby', 'Maternity',
    'Sleepwear', 'Bras', 'Panties & Thongs', 'Bikinis', 'Hosiery',
    'Clothing', 'Tops', 'Accessories', 'Activewear', "Men's Activewear",
    'Beach Towels',
])
def test_excludes_non_fashion_noise(name):
    subgroup, bucket = cm.map_category_name(name)
    assert subgroup == 'excluded', f'{name!r} -> {(subgroup, bucket)}, expected excluded'
    assert bucket is None


# ── The specific edge case that motivated EXACT_EXCLUDED_NAMES / the "bras"
#    (not "bra") substring fix — regression tests for real bugs caught during
#    development, not hypothetical ones ─────────────────────────────────────

def test_bracelets_are_not_excluded_as_bras():
    # "bra" is a substring of "bracelet" — an earlier version of the keyword
    # list used "bra" and wrongly excluded this real jewelry category.
    subgroup, bucket = cm.map_category_name('Bracelets & Bangles')
    assert (subgroup, bucket) == ('jewelry', 'accessories')


def test_bare_tops_excluded_but_activewear_tops_still_maps():
    # A substring-only exclusion for "tops" would wrongly swallow the more
    # specific "Activewear Tops" sibling too — must be an exact match.
    assert cm.map_category_name('Tops') == ('excluded', None)
    subgroup, bucket = cm.map_category_name('Activewear Tops')
    assert bucket == 'tops'


def test_unrecognized_name_returns_none_not_a_silent_default():
    subgroup, bucket = cm.map_category_name('Something Entirely Unrecognized Xyz')
    assert subgroup is None and bucket is None


def test_empty_or_missing_name_returns_none():
    assert cm.map_category_name('') == (None, None)
    assert cm.map_category_name(None) == (None, None)


# ── Full real-dataset coverage — the guard against silent coverage gaps ────

@pytest.mark.skipif(not os.path.exists(CATEGORY_ID_PATH),
                     reason='Real category_id.txt not downloaded — run `npm run fetch:polyvore` first.')
def test_full_dataset_coverage():
    """
    Every category in the real downloaded category_id.txt must be either
    mapped to a subgroup or explicitly excluded — never silently unmapped.
    This is the test that would catch the next new unmapped category if the
    dataset is ever re-downloaded/updated.
    """
    cat_map = cm.load_category_id_map(CATEGORY_ID_PATH)
    assert len(cat_map) > 0

    uncovered = []
    for cat_id, name in cat_map.items():
        subgroup, _ = cm.map_category_name(name)
        if subgroup is None:
            uncovered.append((cat_id, name))

    assert not uncovered, f'Uncovered categories (neither mapped nor excluded): {uncovered}'
