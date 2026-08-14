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

# split_description: definition + illustrative examples, cross-references dropped
assert build_hierarchy.split_description(
    "This industry comprises establishments primarily engaged in providing skilled "
    "nursing services in the home.\n\nIllustrative Examples:\n\nHome health care agencies\n"
    "Visiting nurse associations\n\n\nCross-References."
) == (
    "This industry comprises establishments primarily engaged in providing skilled "
    "nursing services in the home.",
    ["Home health care agencies", "Visiting nurse associations"],
)

# no Illustrative Examples section -> definition only, still drops cross-references
assert build_hierarchy.split_description(
    "This industry comprises establishments primarily engaged in growing wheat.\n\n"
    "Cross-References. Establishments primarily engaged in--"
) == ("This industry comprises establishments primarily engaged in growing wheat.", [])

# stub row (5-digit alias to the real 6-digit industry) carries no content of its own
assert build_hierarchy.split_description("See industry description for 111110.") is None

desc_rows = [
    ("Code", "Title", "Description"),
    (11, "Agriculture, Forestry, Fishing and HuntingT", "The Sector as a Whole\n\nSector text.\n"),
    (11111, "Soybean FarmingT", "See industry description for 111110."),
    (
        111110,
        "Soybean Farming",
        "This industry comprises establishments primarily engaged in growing soybeans.\n\n"
        "Illustrative Examples:\n\nSoybean farms\n\n\nCross-References.",
    ),
    (None, None, None),  # trailing blank row, must not crash
]
descriptions = build_hierarchy.parse_descriptions(desc_rows)
assert set(descriptions.keys()) == {"11", "111110"}, descriptions
assert descriptions["111110"] == (
    "This industry comprises establishments primarily engaged in growing soybeans.",
    ["Soybean farms"],
)

merge_tree = {
    "11": {
        "code": "11",
        "title": "Agriculture",
        "children": {
            "111110": {"code": "111110", "title": "Soybean Farming", "children": {}},
        },
    },
}
build_hierarchy.merge_descriptions(merge_tree, descriptions)
assert merge_tree["11"]["definition"] == "The Sector as a Whole\n\nSector text."
assert "examples" not in merge_tree["11"]  # no Illustrative Examples section for this code
leaf = merge_tree["11"]["children"]["111110"]
assert leaf["definition"] == "This industry comprises establishments primarily engaged in growing soybeans."
assert leaf["examples"] == ["Soybean farms"]

print("OK")
