#!/usr/bin/env python3
"""Turns the supplied brand and product source files into web assets.

The logo arrives as artwork on a flat white background. Keying that white out
by luminance and un-premultiplying the edges keeps the original artwork exactly
as drawn -- nothing is redrawn or re-traced -- while making it sit seamlessly on
any background, in either theme.

Run: python3 tools/build-brand.py
"""

from PIL import Image
import numpy as np
import os

SRC = ".netlify/assets/6aae5b4fcf22df8ab964b7d7"
OUT = "public/assets/img"
BRAND = os.path.join(OUT, "brand")
os.makedirs(BRAND, exist_ok=True)

LOGO = os.path.join(SRC, "PHOTO-2025-10-24-10-49-08.jpg")

# Vertical split between the flame mark and the ENA wordmark, measured from the
# only blank row-run inside the artwork's bounding box.
MARK_ROWS = (262, 528)
WORD_ROWS = (598, 720)
CREAM = np.array([255, 244, 236], dtype=np.float32)  # night-theme ink


def _box3(a: np.ndarray) -> np.ndarray:
    """3x3 mean, edge-replicated. Small images, so a plain shift-and-add is fine."""
    pad = np.pad(a, ((1, 1), (1, 1)) + ((0, 0),) * (a.ndim - 2), mode="edge")
    acc = np.zeros_like(a, dtype=np.float32)
    for dy in (0, 1, 2):
        for dx in (0, 1, 2):
            acc += pad[dy:dy + a.shape[0], dx:dx + a.shape[1]]
    return acc / 9.0


def key_white(rgb: np.ndarray, cut: int = 26, feather: float = 0.75) -> np.ndarray:
    """Key a flat white background out of opaque artwork, without a halo.

    Keying on "distance from white" alone fails here: JPEG ringing leaves a
    near-white halo around every edge, which survives as bright low-alpha
    pixels and reads as a glow on a dark background. So instead the shape is
    resolved to a hard matte, the matte is feathered to get clean antialiasing,
    and the artwork's own colour is bled outward so edge pixels carry logo
    colour rather than a mix of logo and background. Nothing is re-traced --
    every solid pixel keeps the colour it has in the supplied artwork.
    """
    c = rgb.astype(np.float32)
    solid = (255.0 - c.min(axis=2)) > cut

    # Bleed colour outward from the solid region so the feathered edge has
    # something to sample that is not white.
    filled = c * solid[..., None]
    weight = solid.astype(np.float32)
    for _ in range(4):
        num, den = _box3(filled), _box3(weight)
        grow = (den > 0) & (weight == 0)
        filled[grow] = (num[grow] / den[grow][..., None])
        weight[grow] = 1.0

    # Feather the hard matte into an antialiased alpha channel.
    alpha = solid.astype(np.float32)
    for _ in range(2):
        alpha = _box3(alpha)
    alpha = np.clip((alpha - 0.5) / feather + 0.5, 0.0, 1.0)
    alpha[solid] = 1.0

    out = np.concatenate([np.clip(filled, 0, 255), (alpha * 255.0)[..., None]], axis=2)
    return out.astype(np.uint8)


def trim(im: Image.Image, pad: int = 0) -> Image.Image:
    bbox = im.split()[-1].getbbox()
    if not bbox:
        return im
    l, t, r, b = bbox
    return im.crop((max(l - pad, 0), max(t - pad, 0),
                    min(r + pad, im.width), min(b + pad, im.height)))


def fit(im: Image.Image, width: int) -> Image.Image:
    if im.width <= width:
        return im
    h = round(im.height * width / im.width)
    return im.resize((width, h), Image.LANCZOS)


def _report(path: str, im: Image.Image):
    print(f"  {path}  {im.width}x{im.height}  {os.path.getsize(path) // 1024} KB")


def save_webp(im: Image.Image, name: str):
    """Lossless WebP for anything the pages load: identical pixels to the PNG,
    roughly 45% of the bytes."""
    path = os.path.join(BRAND, name)
    im.save(path, "WEBP", lossless=True, method=6)
    _report(path, im)


def save_png(im: Image.Image, name: str):
    """PNG only where broad format support outranks size -- favicons, and the
    og:image that link scrapers fetch."""
    path = os.path.join(BRAND, name)
    im.save(path, optimize=True)
    _report(path, im)


src = np.asarray(Image.open(LOGO).convert("RGB"))
keyed = Image.fromarray(key_white(src), "RGBA")

print("logo:")
lockup = trim(keyed, pad=2)
save_webp(fit(lockup, 420), "ena-lockup.webp")
save_png(fit(lockup, 420), "ena-lockup.png")  # og:image

mark = trim(Image.fromarray(key_white(src[MARK_ROWS[0]:MARK_ROWS[1]]), "RGBA"), pad=2)
save_webp(fit(mark, 256), "ena-mark.webp")
save_webp(fit(mark, 128), "ena-mark-sm.webp")


# Dark-background lockup: the wordmark's deep maroon is recoloured to the
# night-theme cream -- the same treatment ENA's own dark artwork uses -- while
# the flame mark's gradient is left untouched.
def to_cream(im: Image.Image) -> Image.Image:
    a = np.asarray(im).astype(np.float32)
    rgb, alpha = a[..., :3], a[..., 3:]
    # luminance drives the blend so the letterform's shading survives
    lum = (rgb.max(axis=2, keepdims=True) / 255.0)
    out = CREAM * (0.80 + 0.20 * lum)
    return Image.fromarray(np.concatenate([np.clip(out, 0, 255), alpha], axis=2).astype(np.uint8), "RGBA")

# The mark and the wordmark keep their proportions through the trim, so the
# boundary between them maps across at the same fraction of the height.
on_dark = lockup.copy()
split = round(lockup.height * (WORD_ROWS[0] - MARK_ROWS[0]) / (WORD_ROWS[1] - MARK_ROWS[0]))
on_dark.paste(to_cream(on_dark.crop((0, split, on_dark.width, on_dark.height))), (0, split))
save_webp(fit(on_dark, 420), "ena-lockup-on-dark.webp")

# Favicon and touch icon, from the mark alone.
print("icons:")
for size, name in ((32, "favicon-32.png"), (180, "apple-touch-icon.png"), (512, "icon-512.png")):
    side = max(mark.size)
    sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    sq.paste(mark, ((side - mark.width) // 2, (side - mark.height) // 2))
    icon = sq.resize((size, size), Image.LANCZOS)
    path = os.path.join("public", name)
    icon.save(path, optimize=True)
    print(f"  {path}  {size}x{size}  {os.path.getsize(path) // 1024} KB")
