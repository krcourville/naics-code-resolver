# /// script
# requires-python = ">=3.10"
# dependencies = ["openpyxl"]
# ///
"""Convert the official Census NAICS structure file into naics-hierarchy.json.

Not in the beacon submodule (checked, absent) -> fetched separately per §C.
Source: https://www.census.gov/naics/2022NAICS/2022_NAICS_Structure.xlsx
"""

import argparse
import json
import re
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_URL = "https://www.census.gov/naics/2022NAICS/2022_NAICS_Structure.xlsx"
HEADER_MARKER = "2022 NAICS Code"

# Trilateral-agreement marker "T" is appended directly to the title with no
# separator (e.g. "Wheat FarmingT"). Strip it only when preceded by a
# lowercase letter, so a title that genuinely ends in a capital T survives.
_TRAILING_T = re.compile(r"(?<=[a-z])T$")


def clean_title(title: str) -> str:
    title = title.strip()
    return _TRAILING_T.sub("", title)


def parse_rows(raw_rows) -> list[tuple[str, str]]:
    """raw_rows: iterable of openpyxl row tuples. Returns [(code, title), ...] in file order."""
    rows = iter(raw_rows)
    for row in rows:
        if row and row[1] == HEADER_MARKER:
            break
    parsed = []
    for row in rows:
        code, title = row[1], row[2]
        if code is None or title is None:
            continue
        parsed.append((str(code), clean_title(str(title))))
    return parsed


def build_tree(parsed: list[tuple[str, str]]) -> dict:
    root: dict = {}
    level_stack: dict[int, dict] = {}
    for code, title in parsed:
        level = 2 if "-" in code else len(code)
        node = {"code": code, "title": title, "children": {}}
        parent = level_stack.get(level - 1)
        (parent["children"] if parent else root)[code] = node
        level_stack[level] = node
    return root


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--file", help="local xlsx path; skips the network fetch")
    parser.add_argument("--url", default=DEFAULT_URL)
    parser.add_argument("--out", default=str(REPO_ROOT / "public" / "naics-hierarchy.json"))
    args = parser.parse_args()

    import openpyxl

    if args.file:
        xlsx_path = Path(args.file)
    else:
        xlsx_path = REPO_ROOT / "scripts" / ".naics_structure.xlsx"
        urllib.request.urlretrieve(args.url, xlsx_path)

    wb = openpyxl.load_workbook(xlsx_path, read_only=True, data_only=True)
    parsed = parse_rows(wb.active.iter_rows(values_only=True))
    tree = build_tree(parsed)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(tree))
    print(f"wrote {out_path} ({len(parsed)} codes)")


if __name__ == "__main__":
    main()
