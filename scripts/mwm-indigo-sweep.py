#!/usr/bin/env python3
"""Phase 3: replace indigo/emerald Tailwind classes with MWM tokens (Tailwind v4 syntax)."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCAN_DIRS = ["app", "components", "lib"]
EXTENSIONS = {".tsx", ".ts"}

# Order matters: longer / more specific patterns first
REPLACEMENTS: list[tuple[str, str]] = [
    # bg-[color: regressions
    ("bg-[color:var(--sage-light)]", "bg-[var(--mwm-sage-light)]"),
    ("bg-[color:var(--gold-pale)]", "bg-[var(--mwm-gold-pale)]"),
    ("bg-[color:var(--gold-light)]", "bg-[var(--mwm-gold-light)]"),
    ("bg-[color:var(--mwm-", "bg-[var(--mwm-"),  # catch-all strip color: on bg
    # Hardcoded hex in class strings
    ("#1B2A4A", "var(--mwm-navy)"),
    ("#2E4270", "var(--mwm-navy-light)"),
    ("#1a3460", "var(--mwm-navy-light)"),
    # Page shells only (not table rows)
    ("min-h-screen bg-neutral-50", "min-h-screen bg-[var(--mwm-off-white)]"),
    # Focus / ring with opacity
    ("focus-visible:ring-indigo-500/20", "focus-visible:ring-[color:var(--mwm-navy)]/20"),
    ("focus-visible:ring-indigo-400/25", "focus-visible:ring-[color:var(--mwm-navy)]/25"),
    ("focus-visible:ring-indigo-500", "focus-visible:ring-[color:var(--mwm-navy)]"),
    ("focus-visible:ring-indigo-600", "focus-visible:ring-[color:var(--mwm-navy)]"),
    ("focus:ring-indigo-500/20", "focus:ring-[color:var(--mwm-navy)]/20"),
    ("focus:ring-indigo-400/25", "focus:ring-[color:var(--mwm-navy)]/25"),
    ("focus:ring-indigo-500", "focus:ring-[color:var(--mwm-navy)]"),
    ("focus:ring-indigo-600", "focus:ring-[color:var(--mwm-navy)]"),
    ("focus:border-indigo-500", "focus:border-[color:var(--mwm-navy)]"),
    ("focus:border-indigo-400", "focus:border-[color:var(--mwm-navy)]"),
    ("ring-indigo-500", "ring-[color:var(--mwm-navy)]"),
    ("ring-indigo-600", "ring-[color:var(--mwm-navy)]"),
    ("ring-indigo-300", "ring-[color:var(--mwm-navy)]/30"),
    ("focus:ring-indigo-300", "focus:ring-[color:var(--mwm-navy)]/30"),
    ("border-t-indigo-600", "border-t-[color:var(--mwm-navy)]"),
    ("accent-indigo-600", "accent-[var(--mwm-navy)]"),
    # Hover
    ("hover:bg-indigo-50/80", "hover:bg-[var(--mwm-gold-pale)]/80"),
    ("hover:bg-indigo-50/60", "hover:bg-[var(--mwm-gold-pale)]/60"),
    ("hover:bg-indigo-50/50", "hover:bg-[var(--mwm-gold-pale)]/50"),
    ("hover:bg-indigo-50/40", "hover:bg-[var(--mwm-gold-pale)]/40"),
    ("hover:bg-indigo-50", "hover:bg-[var(--mwm-gold-pale)]"),
    ("hover:bg-indigo-700", "hover:bg-[var(--mwm-navy-light)]"),
    ("hover:bg-indigo-600", "hover:bg-[var(--mwm-navy-light)]"),
    ("hover:bg-emerald-50", "hover:bg-[var(--mwm-sage-pale)]"),
    ("hover:border-indigo-500", "hover:border-[color:var(--mwm-navy)]"),
    ("hover:border-indigo-300", "hover:border-[color:var(--mwm-navy)]"),
    ("hover:border-indigo-200", "hover:border-[color:var(--mwm-border)]"),
    ("hover:text-indigo-950", "hover:text-[color:var(--mwm-navy)]"),
    ("hover:text-indigo-900", "hover:text-[color:var(--mwm-navy)]"),
    ("hover:text-indigo-800", "hover:text-[color:var(--mwm-navy)]"),
    ("hover:text-indigo-700", "hover:text-[color:var(--mwm-navy)]"),
    ("hover:text-indigo-600", "hover:text-[color:var(--mwm-navy)]"),
    ("hover:text-indigo-500", "hover:text-[color:var(--mwm-navy)]"),
    ("hover:text-indigo-400", "hover:text-[color:var(--mwm-navy)]"),
    ("hover:text-emerald-800", "hover:text-[color:var(--mwm-sage)]"),
    ("hover:text-emerald-700", "hover:text-[color:var(--mwm-sage)]"),
    ("hover:text-emerald-600", "hover:text-[color:var(--mwm-sage)]"),
    # Backgrounds
    ("bg-indigo-950", "bg-[var(--mwm-navy)]"),
    ("bg-indigo-900", "bg-[var(--mwm-navy)]"),
    ("bg-indigo-800", "bg-[var(--mwm-navy)]"),
    ("bg-indigo-700", "bg-[var(--mwm-navy-light)]"),
    ("bg-indigo-600", "bg-[var(--mwm-navy)]"),
    ("bg-indigo-500", "bg-[var(--mwm-navy)]"),
    ("bg-indigo-400", "bg-[var(--mwm-navy-light)]"),
    ("bg-indigo-300", "bg-[var(--mwm-gold-pale)]"),
    ("bg-indigo-200", "bg-[var(--mwm-gold-pale)]"),
    ("bg-indigo-100", "bg-[var(--mwm-gold-pale)]"),
    ("bg-indigo-50/80", "bg-[var(--mwm-gold-pale)]/80"),
    ("bg-indigo-50/60", "bg-[var(--mwm-gold-pale)]/60"),
    ("bg-indigo-50/50", "bg-[var(--mwm-gold-pale)]/50"),
    ("bg-indigo-50/40", "bg-[var(--mwm-gold-pale)]/40"),
    ("bg-indigo-50", "bg-[var(--mwm-gold-pale)]"),
    ("bg-emerald-950", "bg-[var(--mwm-sage)]"),
    ("bg-emerald-900", "bg-[var(--mwm-sage)]"),
    ("bg-emerald-800", "bg-[var(--mwm-sage)]"),
    ("bg-emerald-700", "bg-[var(--mwm-sage-light)]"),
    ("bg-emerald-600", "bg-[var(--mwm-sage)]"),
    ("bg-emerald-500", "bg-[var(--mwm-sage)]"),
    ("bg-emerald-400", "bg-[var(--mwm-sage-light)]"),
    ("bg-emerald-200", "bg-[var(--mwm-sage-pale)]"),
    ("bg-emerald-100", "bg-[var(--mwm-sage-pale)]"),
    ("bg-emerald-50", "bg-[var(--mwm-sage-pale)]"),
    # Text
    ("text-indigo-950", "text-[color:var(--mwm-navy)]"),
    ("text-indigo-900", "text-[color:var(--mwm-navy)]"),
    ("text-indigo-800/90", "text-[color:var(--mwm-navy)]/90"),
    ("text-indigo-800", "text-[color:var(--mwm-navy)]"),
    ("text-indigo-700", "text-[color:var(--mwm-navy)]"),
    ("text-indigo-600", "text-[color:var(--mwm-navy)]"),
    ("text-indigo-500", "text-[color:var(--mwm-navy)]"),
    ("text-indigo-400", "text-[color:var(--mwm-text-muted)]"),
    ("text-emerald-950", "text-[color:var(--mwm-sage)]"),
    ("text-emerald-900", "text-[color:var(--mwm-sage)]"),
    ("text-emerald-800", "text-[color:var(--mwm-sage)]"),
    ("text-emerald-700", "text-[color:var(--mwm-sage)]"),
    ("text-emerald-600", "text-[color:var(--mwm-sage)]"),
    ("text-emerald-500", "text-[color:var(--mwm-sage)]"),
    ("text-emerald-400", "text-[color:var(--mwm-sage-light)]"),
    # Borders
    ("border-indigo-600", "border-[color:var(--mwm-navy)]"),
    ("border-indigo-500", "border-[color:var(--mwm-navy)]"),
    ("border-indigo-400", "border-[color:var(--mwm-navy)]"),
    ("border-indigo-300", "border-[color:var(--mwm-border)]"),
    ("border-indigo-200", "border-[color:var(--mwm-border)]"),
    ("border-indigo-100", "border-[color:var(--mwm-border)]"),
    ("border-emerald-500", "border-[color:var(--mwm-sage)]"),
    ("border-emerald-200", "border-[color:var(--mwm-sage-pale)]"),
    ("border-emerald-100", "border-[color:var(--mwm-sage-pale)]"),
    # Checkbox / accent (text- on form controls)
    ("text-indigo-600 focus:ring-indigo-500", "text-[color:var(--mwm-navy)] focus:ring-[color:var(--mwm-navy)]"),
    ("text-indigo-600", "text-[color:var(--mwm-navy)]"),
    # Ring on cards
    ("ring-indigo-400", "ring-[color:var(--mwm-navy)]"),
    ("ring-1 ring-indigo-400", "ring-1 ring-[color:var(--mwm-navy)]"),
    # Purple (titling badges) -> sage pale for GST
    ("bg-purple-100", "bg-[var(--mwm-sage-pale)]"),
    ("text-purple-700", "text-[color:var(--mwm-sage)]"),
    ("border-purple-200", "border-[color:var(--mwm-sage-pale)]"),
    ("bg-purple-50", "bg-[var(--mwm-sage-pale)]"),
    ("text-purple-900", "text-[color:var(--mwm-sage)]"),
    # Violet (retirement summary) -> sage
    ("bg-violet-50", "bg-[var(--mwm-sage-pale)]"),
    ("border-violet-100", "border-[color:var(--mwm-sage-pale)]"),
    ("border-violet-200", "border-[color:var(--mwm-sage-pale)]"),
    ("text-violet-800", "text-[color:var(--mwm-sage)]"),
    ("text-violet-500", "text-[color:var(--mwm-sage)]"),
    ("text-violet-400", "text-[color:var(--mwm-sage-light)]"),
    ("bg-violet-500", "bg-[var(--mwm-sage)]"),
]


def iter_source_files() -> list[Path]:
    files: list[Path] = []
    for name in SCAN_DIRS:
        base = ROOT / name
        if not base.exists():
            continue
        for path in base.rglob("*"):
            if path.suffix in EXTENSIONS and path.is_file():
                files.append(path)
    return files


def transform(content: str) -> str:
    for old, new in REPLACEMENTS:
        content = content.replace(old, new)
    return content


def main() -> None:
    changed: list[Path] = []
    for path in iter_source_files():
        text = path.read_text(encoding="utf-8")
        if "indigo-" not in text and "emerald-" not in text and "bg-[color:" not in text:
            if not any(
                x in text
                for x in ("bg-purple-", "text-purple-", "bg-violet-", "text-violet-", "border-violet-", "border-purple-")
            ):
                continue
        new_text = transform(text)
        if new_text != text:
            path.write_text(new_text, encoding="utf-8")
            changed.append(path)
    print(f"Updated {len(changed)} files")
    for p in sorted(changed):
        print(f"  {p.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
