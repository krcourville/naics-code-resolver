# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "scikit-learn"]
# ///
"""Fit BeaconModel from the beacon submodule and export its fitted params to JSON."""

import argparse
import json
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
BEACON_DIR = REPO_ROOT / "beacon"


def _sparsify(props_by_sector: dict, naics_by_sector: dict) -> dict:
    # dict_ncombs_props_/dict_ems_props_ are dense per-sector arrays (one float per
    # NAICS code in the sector) but ~98.8% zero — BEACON's purity weights concentrate
    # each n-gram on ~1 code. Sparse {naicsCode: proportion} keeps only nonzero entries.
    return {
        sector: {
            nc: {naics_by_sector[sector][i]: round(v, 6) for i, v in enumerate(arr) if v != 0.0}
            for nc, arr in props.items()
        }
        for sector, props in props_by_sector.items()
    }


def export_model(mod) -> dict:
    naics_by_sector = {sector: list(idx.keys()) for sector, idx in mod.naics_indices_.items()}
    return {
        "freq_thresh": mod.freq_thresh,
        "wt_umb": mod.wt_umb,
        "wt_exact": mod.wt_exact,
        "naics": mod.naics_,
        "sectors": mod.sectors_,
        "sample_sizes": mod.sample_sizes_,
        "sector_naics": naics_by_sector,
        "dict_ncombs_props": _sparsify(mod.dict_ncombs_props_, naics_by_sector),
        "dict_ncombs_weights": mod.dict_ncombs_weights_,
        "dict_ems_props": _sparsify(mod.dict_ems_props_, naics_by_sector),
        "dict_ems_weights": mod.dict_ems_weights_,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--vintage", default="2022", choices=["2017", "2022"])
    parser.add_argument("--data-dir", default=str(BEACON_DIR))
    parser.add_argument(
        "--out",
        default=str(REPO_ROOT / "packages" / "naics-search" / "src" / "data" / "naics-model.json"),
    )
    parser.add_argument("--freq-thresh", type=int, default=1)
    parser.add_argument("--wt-umb", type=float, default=0.6)
    parser.add_argument("--wt-exact", type=float, default=0.3)
    args = parser.parse_args()

    sys.path.insert(0, args.data_dir)
    import beacon

    data_file = Path(args.data_dir) / f"example_data_{args.vintage}.txt"
    if not data_file.exists():
        sys.exit(
            f"missing {data_file} — run beacon/create_example_data.py first "
            "(needs census.gov NAICS Index/6-digit-code xlsx files downloaded manually)"
        )

    os.chdir(args.data_dir)
    X, y, sample_weight = beacon.load_naics_data(vintage=args.vintage)

    mod = beacon.BeaconModel(
        freq_thresh=args.freq_thresh, wt_umb=args.wt_umb, wt_exact=args.wt_exact, verbose=1
    )
    mod.fit(X, y, sample_weight)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(export_model(mod), separators=(",", ":")))
    print(f"wrote {out_path}")


if __name__ == "__main__":
    main()
