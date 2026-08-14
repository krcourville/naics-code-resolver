# /// script
# requires-python = ">=3.10"
# ///
"""Self-check for build-hierarchy.py's parse_rows()/build_tree() against a
synthetic fragment shaped like the real xlsx (header + a merged sector range)."""

import importlib.util
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("build_hierarchy", REPO_ROOT / "scripts" / "build-hierarchy.py")
build_hierarchy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build_hierarchy)

assert build_hierarchy.clean_title("Wheat FarmingT") == "Wheat Farming"
assert build_hierarchy.clean_title("Oilseed (except Soybean) FarmingT ") == "Oilseed (except Soybean) Farming"
assert build_hierarchy.clean_title("International Affairs") == "International Affairs"

raw_rows = [
    ("2022 NAICS Structure", None, None),
    ("legend...", None, None),
    ("Change Indicator", "2022 NAICS Code", "2022 NAICS Title"),
    (None, "31-33", "ManufacturingT"),
    (None, 311, "Food ManufacturingT"),
    (None, 3111, "Animal Food ManufacturingT"),
    (None, 31111, "Animal Food ManufacturingT"),
    (None, 311111, "Dog and Cat Food Manufacturing"),
    (None, 312, "Beverage and Tobacco Product ManufacturingT"),
    (None, 11, "Agriculture, Forestry, Fishing and HuntingT"),
]

parsed = build_hierarchy.parse_rows(raw_rows)
assert parsed == [
    ("31-33", "Manufacturing"),
    ("311", "Food Manufacturing"),
    ("3111", "Animal Food Manufacturing"),
    ("31111", "Animal Food Manufacturing"),
    ("311111", "Dog and Cat Food Manufacturing"),
    ("312", "Beverage and Tobacco Product Manufacturing"),
    ("11", "Agriculture, Forestry, Fishing and Hunting"),
], parsed

tree = build_hierarchy.build_tree(parsed)
assert set(tree.keys()) == {"31-33", "11"}
mfg = tree["31-33"]
assert mfg["title"] == "Manufacturing"
assert set(mfg["children"].keys()) == {"311", "312"}
food = mfg["children"]["311"]
assert set(food["children"].keys()) == {"3111"}
leaf = food["children"]["3111"]["children"]["31111"]["children"]["311111"]
assert leaf == {"code": "311111", "title": "Dog and Cat Food Manufacturing", "children": {}}
assert tree["11"]["children"] == {}

print("OK")
