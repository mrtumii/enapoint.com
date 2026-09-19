#!/usr/bin/env python3
"""Resizes the supplied product photography into web assets.

Crops are expressed as fractions of the source so they survive if a source file
is ever re-exported at a different size.

Run: python3 tools/build-photos.py
"""

from PIL import Image
import os

SRC = ".netlify/assets/6aae5b4fcf22df8ab964b7d7"
OUT = "public/assets/img/product"
os.makedirs(OUT, exist_ok=True)

# name -> (source file, crop as (left, top, right, bottom) fractions or None, max width)
JOBS = {
    # The campaign poster, cropped to the product and the solar array so the
    # marketing typography underneath is not baked into a site image.
    "portable-hero": ("PHOTO-2026-03-12-22-24-00.jpg", (0.0, 0.212, 1.0, 0.546), 1400),
    "lit-li-views":  ("PHOTO-2026-03-11-23-54-07.jpg", (0.0, 0.0, 1.0, 0.885), 1400),
    "lit-li-front":  ("PHOTO-2026-03-11-23-54-07.jpg", (0.015, 0.01, 0.325, 0.375), 900),
    "lit-li-back":   ("PHOTO-2026-03-11-23-54-07.jpg", (0.675, 0.45, 0.99, 0.855), 900),
    "inverter-vehicle": ("Untitled design.jpg", (0.0, 0.10, 1.0, 1.0), 1400),
    "pops-front":    ("IMG_3358.jpg", None, 1400),
    "pops-snow":     ("IMG_3360.jpg", (0.0, 0.45, 1.0, 1.0), 1200),
    "pops-marine":   ("IMG_3361.jpg", (0.0, 0.05, 1.0, 0.75), 1400),
}


def build(name, source, crop, width):
    im = Image.open(os.path.join(SRC, source)).convert("RGB")
    if crop:
        w, h = im.size
        im = im.crop((round(crop[0] * w), round(crop[1] * h),
                      round(crop[2] * w), round(crop[3] * h)))
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    # WebP at this quality is visually indistinguishable from JPEG q82 here and
    # about half the bytes, which matters on pages that carry three photographs.
    path = os.path.join(OUT, f"{name}.webp")
    im.save(path, "WEBP", quality=82, method=6)
    print(f"  {path}  {im.width}x{im.height}  {os.path.getsize(path) // 1024} KB")


print("product photography:")
for name, (source, crop, width) in JOBS.items():
    build(name, source, crop, width)
