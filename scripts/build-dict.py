#!/usr/bin/env python3
import json
import re
from pathlib import Path

from wordfreq import top_n_list, zipf_frequency


DICTIONARY_SIZES = (1000, 5000, 25000)
OUTPUT_DIR = Path("public/dict")
WORD_RE = re.compile(r"^[a-z]{1,16}$")


def main() -> None:
    entries = build_entries(max(DICTIONARY_SIZES))
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    for size in DICTIONARY_SIZES:
        output_path = OUTPUT_DIR / f"words-{size // 1000}k.json"
        write_json(output_path, entries[:size])
        print(f"Wrote {size} words to {output_path}")


def build_entries(target_size: int) -> list[list[float | str]]:
    raw_words = top_n_list("en", target_size * 4, ascii_only=True)
    entries: list[list[float | str]] = []
    seen: set[str] = set()

    for raw_word in raw_words:
        word = raw_word.lower()
        if word in seen or WORD_RE.fullmatch(word) is None:
            continue

        seen.add(word)
        entries.append([word, round(zipf_frequency(word, "en"), 4)])

        if len(entries) >= target_size:
            return entries

    raise RuntimeError(
        f"wordfreq produced {len(entries)} usable words, expected {target_size}"
    )


def write_json(path: Path, entries: list[list[float | str]]) -> None:
    path.write_text(json.dumps(entries, ensure_ascii=True, indent=2) + "\n")


if __name__ == "__main__":
    main()
