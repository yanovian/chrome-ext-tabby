#!/usr/bin/env python3
"""Strip backgrounds from cat sprites and optimize PNG size."""

from __future__ import annotations

import sys
from collections import deque
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Install Pillow: pip install pillow", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
SPRITES = ROOT / "public" / "sprites"
STAGES = ("newborn", "playful", "adult")
MOODS = (
    "content",
    "happy",
    "curious",
    "hungry",
    "starving",
    "stressed",
    "sleepy",
)


def saturation(red: int, green: int, blue: int) -> int:
    return max(red, green, blue) - min(red, green, blue)


def average(red: int, green: int, blue: int) -> float:
    return (red + green + blue) / 3


def is_background_like(
    red: int,
    green: int,
    blue: int,
    alpha: int,
    *,
    avg_threshold: float = 200,
    sat_threshold: int = 42,
) -> bool:
    if alpha == 0:
        return True

    avg = average(red, green, blue)
    sat = saturation(red, green, blue)

    if avg >= 245 and sat <= 18:
        return True

    if sat <= sat_threshold and avg >= avg_threshold:
        return True

    return False


def flood_clear_background(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    width, height = rgba.size
    pixels = rgba.load()
    visited = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def index(x: int, y: int) -> int:
        return y * width + x

    def try_seed(x: int, y: int) -> None:
        idx = index(x, y)
        if visited[idx]:
            return
        red, green, blue, alpha = pixels[x, y]
        if not is_background_like(red, green, blue, alpha):
            return
        visited[idx] = 1
        queue.append((x, y))

    for x in range(width):
        try_seed(x, 0)
        try_seed(x, height - 1)
    for y in range(height):
        try_seed(0, y)
        try_seed(width - 1, y)

    while queue:
        x, y = queue.popleft()
        pixels[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if nx < 0 or ny < 0 or nx >= width or ny >= height:
                continue
            idx = index(nx, ny)
            if visited[idx]:
                continue
            red, green, blue, alpha = pixels[nx, ny]
            if not is_background_like(red, green, blue, alpha):
                continue
            visited[idx] = 1
            queue.append((nx, ny))

    return rgba


def remove_fake_transparency_halo(image: Image.Image) -> Image.Image:
    """Remove gray semi-transparent halos left by older processing passes."""
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size

    for y in range(height):
        for x in range(width):
            red, green, blue, alpha = pixels[x, y]
            if alpha == 0 or alpha == 255:
                continue
            if is_background_like(red, green, blue, alpha, avg_threshold=190, sat_threshold=48):
                pixels[x, y] = (0, 0, 0, 0)

    return rgba


def crop_to_content(image: Image.Image, padding: int = 10) -> Image.Image:
    rgba = image.convert("RGBA")
    bbox = rgba.getbbox()
    if not bbox:
        return rgba

    left, top, right, bottom = bbox
    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(rgba.width, right + padding)
    bottom = min(rgba.height, bottom + padding)
    return rgba.crop((left, top, right, bottom))


def make_background_transparent(image: Image.Image) -> Image.Image:
    processed = flood_clear_background(image)
    processed = remove_fake_transparency_halo(processed)
    return crop_to_content(processed)


def optimize(path: Path) -> None:
    with Image.open(path) as source:
        processed = make_background_transparent(source)
        processed.save(path, format="PNG", optimize=True)
    print(f"Processed {path.relative_to(ROOT)}")


def main() -> None:
    for stage in STAGES:
        stage_dir = SPRITES / stage
        stage_dir.mkdir(parents=True, exist_ok=True)
        for mood in MOODS:
            target = stage_dir / f"{mood}.png"
            if not target.exists():
                print(f"Skip missing {target.relative_to(ROOT)}")
                continue
            optimize(target)


if __name__ == "__main__":
    main()
