"""Pull floor plans and front elevations out of Clayton CrossMod PDFs.

The elevation crop is the reference for an exterior rendering. This script does
not invent the rendering itself. It writes:

  <output>/<slug>-layout.png     marketing floor plan
  <output>/<slug>-elevation.png  exterior elevation sheet
  <output>/<slug>-front.png      cropped front elevation

Usage:
  python scripts/extract_crossmod_sheets.py plans/crossmod web-3d/public/building-assets
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

import fitz
from PIL import Image


def page_text(page: fitz.Page) -> str:
    return re.sub(r"\s+", " ", page.get_text("text").upper())


def is_elevation_sheet(page: fitz.Page) -> bool:
    text = page_text(page)
    return "FRONT ELEVATION" in text and "REAR" in text and "LEFT SIDE" in text


def is_base_floor_plan(page: fitz.Page) -> bool:
    short_side = min(page.rect.width, page.rect.height)
    text = page_text(page)
    return short_side < 700 and "PRIMARY BEDROOM" in text and ("ON-SITE" in text or "ON SITE" in text)


def slug_from_name(path: Path) -> str:
    stem = path.stem
    if "_R" in stem:
        stem = stem.split("_R")[0]
    name = stem.split("_")[-1]
    return name.lower().replace(" ", "-")


def render_page(page: fitz.Page, dest: Path, zoom: float) -> Image.Image:
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
    dest.parent.mkdir(parents=True, exist_ok=True)
    pix.save(dest)
    return Image.open(dest).convert("RGB")


def crop_front_elevation(sheet: Image.Image, dest: Path) -> None:
    """Keep the leftmost upper elevation cluster, which is the front on these sheets."""
    gray = sheet.convert("L")
    width, height = gray.size
    pixels = gray.load()
    top = int(height * 0.07)
    bottom = int(height * 0.36)
    title_x = int(width * 0.86)

    gaps = []
    run_start = None
    run = 0
    for x in range(title_x):
        ink = 0
        for y in range(top, bottom, 2):
            if pixels[x, y] < 140:
                ink += 1
        if ink < 2:
            if run_start is None:
                run_start = x
            run += 1
        else:
            if run > 25:
                gaps.append((run_start, x))
            run_start = None
            run = 0

    edges = [0]
    for start, end in gaps:
        edges.extend((start, end))
    edges.append(title_x)

    clusters = []
    for left, right in zip(edges[0::2], edges[1::2]):
        if right - left > 400:
            clusters.append((left, right))
    if not clusters:
        raise RuntimeError(f"No front elevation cluster in {dest.name}")

    x0, x1 = clusters[0]
    y_hits = []
    for y in range(0, int(height * 0.6)):
        ink = 0
        for x in range(x0, x1, 2):
            if pixels[x, y] < 140:
                ink += 1
        if ink > 3:
            y_hits.append(y)
    if not y_hits:
        raise RuntimeError(f"Front elevation has no ink in {dest.name}")

    y0 = y_hits[0]
    y1 = y_hits[-1]
    previous = y_hits[0]
    for y in y_hits:
        if y - previous > 15 and previous > y0 + 80:
            y1 = previous
            break
        previous = y

    pad = 24
    crop = sheet.crop((max(0, x0 - 8), max(0, y0 - 8), min(width, x1 + 8), min(height, y1 + 12)))
    canvas = Image.new("RGB", (crop.width + pad * 2, crop.height + pad * 2), (255, 255, 255))
    canvas.paste(crop, (pad, pad))
    canvas.save(dest, optimize=True)


def extract_pdf(pdf_path: Path, output_dir: Path) -> str:
    slug = slug_from_name(pdf_path)
    doc = fitz.open(pdf_path)
    elevation = next((page for page in doc if is_elevation_sheet(page)), None)
    floor_plan = next((page for page in doc if is_base_floor_plan(page)), None)
    if elevation is None or floor_plan is None:
        doc.close()
        raise RuntimeError(f"{pdf_path.name}: missing elevation or floor plan")

    layout_path = output_dir / f"crossmod-{slug}-layout.png"
    elevation_path = output_dir / f"crossmod-{slug}-elevation.png"
    front_path = output_dir / f"crossmod-{slug}-front.png"
    render_page(floor_plan, layout_path, 2.2)
    sheet = render_page(elevation, elevation_path, 1.7)
    crop_front_elevation(sheet, front_path)
    doc.close()
    return f"{slug}: layout {layout_path.name}, front {front_path.name}"


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 1
    source = Path(sys.argv[1])
    output = Path(sys.argv[2])
    pdfs = sorted(source.glob("*.pdf"))
    if not pdfs:
        print(f"No PDFs in {source}")
        return 1
    output.mkdir(parents=True, exist_ok=True)
    for pdf_path in pdfs:
        print(extract_pdf(pdf_path, output))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
