# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "scikit-learn"]
# ///
"""Self-check for build-model.py's export_model() against a tiny synthetic fit."""

import importlib.util
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "beacon"))
import beacon

spec = importlib.util.spec_from_file_location("build_model", REPO_ROOT / "scripts" / "build-model.py")
build_model = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build_model)

X = [
    "corn farm", "wheat farm", "soybean farm", "corn farm",
    "convenience store", "grocery store", "gas station convenience store", "grocery store",
]
y = ["111150", "111150", "111110", "111110", "445120", "445110", "445120", "445110"]

mod = beacon.BeaconModel(freq_thresh=1)
mod.fit(X, y)

data = build_model.export_model(mod)

expected_keys = {
    "freq_thresh", "wt_umb", "wt_exact", "naics", "sectors", "sample_sizes",
    "naics_indices", "dict_ncombs_props", "dict_ncombs_weights",
    "dict_ems_props", "dict_ems_weights",
}
assert set(data.keys()) == expected_keys, data.keys()
assert set(data["naics"]) == {"111150", "111110", "445120", "445110"}
assert set(data["sectors"]) == {"11", "44"}
assert set(data["dict_ncombs_props"].keys()) == {"00", "11", "44"}
for sector in data["dict_ncombs_props"]:
    assert sector in data["naics_indices"]
    assert sector in data["dict_ncombs_props"]
    assert sector in data["dict_ncombs_weights"]
    for nc, props in data["dict_ncombs_props"][sector].items():
        assert isinstance(props, list) and all(isinstance(p, float) for p in props)
        assert nc in data["dict_ncombs_weights"][sector]
        assert isinstance(data["dict_ncombs_weights"][sector][nc], float)

print("OK")
