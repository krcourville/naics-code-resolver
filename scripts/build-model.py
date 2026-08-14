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


def export_model(mod) -> dict:
    return {
        "freq_thresh": mod.freq_thresh,
        "wt_umb": mod.wt_umb,
        "wt_exact": mod.wt_exact,
        "naics": mod.naics_,
        "sectors": mod.sectors_,
        "sample_sizes": mod.sample_sizes_,
        "naics_indices": mod.naics_indices_,
        "dict_ncombs_props": mod.dict_ncombs_props_,
        "dict_ncombs_weights": mod.dict_ncombs_weights_,
        "dict_ems_props": mod.dict_ems_props_,
        "dict_ems_weights": mod.dict_ems_weights_,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--vintage", default="2022", choices=["2017", "2022"])
    parser.add_argument("--data-dir", default=str(BEACON_DIR))
    parser.add_argument("--out", default=str(REPO_ROOT / "public" / "naics-model.json"))
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
    out_path.write_text(json.dumps(export_model(mod)))
    print(f"wrote {out_path}")


if __name__ == "__main__":
    main()
