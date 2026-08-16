# -*- coding: utf-8 -*-
"""
download_polyvore.py — fetches the public Polyvore Outfits dataset metadata
used by polyvore_compat_trainer.py.

Dataset  : Han, Wu, Jiang & Davis, "Learning Fashion Compatibility with
           Bidirectional LSTMs," ACM Multimedia 2017.
Source   : https://github.com/xthan/polyvore-dataset (polyvore.tar.gz —
           JSON metadata only, ~8.4MB; item images are not needed here since
           this app's own vision pipeline already extracts color/category
           from user photos independently — see ml-service/POLYVORE_COMPAT.md).
License  : Research use; polyvore.com itself is defunct, this is the
           standard third-party academic mirror of the original release.

Run: `npm run fetch:polyvore` (from repo root) or
     `python ml-service/scripts/download_polyvore.py` directly.

The sha256 below is pinned against the exact archive this project was built
and evaluated against — a mismatch means the upstream mirror served
something different, which would silently invalidate every metric in
POLYVORE_COMPAT.md if not caught here. Fails loudly rather than proceeding
with unverified data, matching acceptance_trainer.py's cold-start-guard
philosophy of refusing bad input rather than degrading silently.
"""

import hashlib
import io
import os
import sys
import tarfile
import urllib.request

DATASET_URL      = "https://raw.githubusercontent.com/xthan/polyvore-dataset/master/polyvore.tar.gz"
EXPECTED_SHA256   = "37c36efc67cabdaa58f2d73cbc1c5143d87f9918ff3d4da20e271e40c89e902b"
DEST_DIR          = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "polyvore")
CATEGORY_ID_URL   = "https://raw.githubusercontent.com/xthan/polyvore-dataset/master/category_id.txt"
MEMBERS_TO_EXTRACT = ("train_no_dup.json", "valid_no_dup.json", "test_no_dup.json")


def _download(url: str) -> bytes:
    with urllib.request.urlopen(url, timeout=30) as resp:
        return resp.read()


def download_and_extract(url: str = DATASET_URL, dest_dir: str = DEST_DIR,
                          expected_sha256: str = EXPECTED_SHA256) -> None:
    print(f"Downloading {url} ...")
    raw = _download(url)

    digest = hashlib.sha256(raw).hexdigest()
    if digest != expected_sha256:
        raise ValueError(
            f"sha256 mismatch for polyvore.tar.gz — expected {expected_sha256}, got {digest}. "
            "Refusing to extract unverified data; the upstream mirror may have changed."
        )
    print(f"  sha256 verified ({digest[:12]}...).")

    os.makedirs(dest_dir, exist_ok=True)
    with tarfile.open(fileobj=io.BytesIO(raw), mode="r:gz") as tar:
        for member_name in MEMBERS_TO_EXTRACT:
            member = tar.getmember(member_name)
            tar.extract(member, path=dest_dir, filter="data")
            print(f"  extracted {member_name} -> {os.path.join(dest_dir, member_name)}")

    print(f"Downloading {CATEGORY_ID_URL} ...")
    category_id_bytes = _download(CATEGORY_ID_URL)
    category_id_path = os.path.join(dest_dir, "category_id.txt")
    with open(category_id_path, "wb") as f:
        f.write(category_id_bytes)
    print(f"  saved -> {category_id_path}")

    print("\nDone. Run `npm run train:compat` next.")


def main() -> None:
    try:
        download_and_extract()
    except Exception as e:
        print(f"\n[DOWNLOAD FAILED] {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
