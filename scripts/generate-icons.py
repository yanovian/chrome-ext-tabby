#!/usr/bin/env python3
"""Generate Tabby extension icons at 16, 32, 48, and 128 px."""

from __future__ import annotations

import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("Install Pillow: pip install pillow", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
ICON_DIR = ROOT / "public" / "icon"
ASSETS_DIR = ROOT / "assets"
SPRITES = ROOT / "public" / "sprites"

# Sitting adult reads better at toolbar sizes; playful kitten for store icons.
SOURCE_SMALL = SPRITES / "adult" / "content.png"
SOURCE_LARGE = SPRITES / "playful" / "happy.png"

PEACH_LIGHT = (255, 250, 245)
PEACH_MID = (255, 235, 216)
CORAL = (224, 122, 95)


def lerp(a: int, b: int, t: float) -> int:
    return int(a + (b - a) * t)


def blend(c1: tuple[int, ...], c2: tuple[int, ...], t: float) -> tuple[int, int, int]:
    return (lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t))


def rounded_gradient(size: int, box: tuple[int, int, int, int], radius: int) -> tuple[Image.Image, Image.Image]:
    x0, y0, x1, y1 = box
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    height = max(y1 - y0, 1)

    for y in range(y0, y1 + 1):
        t = (y - y0) / height
        if t < 0.5:
            color = blend(PEACH_LIGHT, PEACH_MID, t / 0.5)
        else:
            color = blend(PEACH_MID, CORAL, (t - 0.5) / 0.5)
        draw.line([(x0, y), (x1, y)], fill=(*color, 255))

    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(box, radius=radius, fill=255)

    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(layer, mask=mask)
    return out, mask


def draw_background(size: int, *, flat: bool = False) -> Image.Image:
    if flat and size <= 64:
        img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        radius = max(3, size // 5)
        draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=PEACH_MID)
        draw.line([(2, 2), (size - 3, 2)], fill=PEACH_LIGHT, width=max(1, size // 16))
        return img

    inset = max(1, size // 20)
    radius = max(3, int(size // 4.5))
    box = (inset, inset, size - inset - 1, size - inset - 1)

    img, mask = rounded_gradient(size, box, radius)

    shine = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shine)
    shine_box = (
        box[0] + max(1, size // 50),
        box[1] + max(1, size // 50),
        box[2] - max(1, size // 50),
        box[1] + int((box[3] - box[1]) * 0.4),
    )
    sdraw.rounded_rectangle(
        shine_box,
        radius=max(2, int(radius * 0.9)),
        fill=(255, 255, 255, 34),
    )
    return Image.alpha_composite(
        img,
        Image.composite(shine, Image.new("RGBA", (size, size), (0, 0, 0, 0)), mask),
    )


def fit_sprite(source: Path, size: int, *, fill: float, flat: bool = False) -> Image.Image:
    if not source.exists():
        raise FileNotFoundError(f"Missing sprite source: {source}")

    canvas = draw_background(size, flat=flat)
    with Image.open(source) as raw:
        sprite = raw.convert("RGBA")
        bbox = sprite.getbbox()
        if bbox:
            sprite = sprite.crop(bbox)

        max_dim = int(size * fill)
        width, height = sprite.size
        scale = min(max_dim / width, max_dim / height)
        new_w = max(1, int(round(width * scale)))
        new_h = max(1, int(round(height * scale)))
        resample = Image.Resampling.LANCZOS if scale != 1 else Image.Resampling.NEAREST
        sprite = sprite.resize((new_w, new_h), resample)

        x = (size - new_w) // 2
        y = size - new_h - max(1, int(size * 0.05))
        canvas.paste(sprite, (x, y), sprite)

    return canvas


def make_icon(size: int) -> Image.Image:
    if size <= 16:
        return fit_sprite(SOURCE_SMALL, 64, fill=0.9, flat=True).resize(
            (16, 16),
            Image.Resampling.LANCZOS,
        )
    if size <= 32:
        return fit_sprite(SOURCE_SMALL, size, fill=0.88)
    return fit_sprite(SOURCE_LARGE, size, fill=0.84 if size >= 128 else 0.86)


def main() -> None:
    ICON_DIR.mkdir(parents=True, exist_ok=True)
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)

    for icon_size in (16, 32, 48, 128):
        path = ICON_DIR / f"{icon_size}.png"
        make_icon(icon_size).save(path, "PNG", optimize=True)
        print(f"wrote {path} ({icon_size}x{icon_size})")

    make_icon(128).save(ASSETS_DIR / "logo.png", "PNG", optimize=True)
    print(f"wrote {ASSETS_DIR / 'logo.png'}")


if __name__ == "__main__":
    main()
