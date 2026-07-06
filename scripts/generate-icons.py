#!/usr/bin/env python3
"""Generate Tabby extension icons from the Lottie companion shapes."""

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

# Match scripts/generate-scaffold-animations.mjs (adult stage).
CANVAS = 220
HEAD_R = 50
BODY_W = 54
BODY_H = 42
TAIL_LEN = 38

PEACH_LIGHT = (255, 250, 245)
PEACH_MID = (255, 235, 216)
CORAL = (224, 122, 95)


def lottie_rgb(values: tuple[float, float, float]) -> tuple[int, int, int]:
    return tuple(int(round(channel * 255)) for channel in values)


COLORS = {
    "body": lottie_rgb((0.97, 0.62, 0.28)),
    "body_dark": lottie_rgb((0.84, 0.46, 0.16)),
    "belly": lottie_rgb((0.99, 0.78, 0.48)),
    "blush": lottie_rgb((0.99, 0.72, 0.42)),
    "outline": lottie_rgb((0.28, 0.16, 0.08)),
    "eye": lottie_rgb((0.99, 0.82, 0.18)),
    "pupil": lottie_rgb((0.14, 0.09, 0.06)),
    "white": (255, 255, 255),
    "pink": lottie_rgb((0.94, 0.55, 0.64)),
    "collar": lottie_rgb((0.5, 0.3, 0.7)),
    "charm": lottie_rgb((0.9, 0.82, 1)),
}


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


def cat_layout(size: int) -> dict[str, float]:
    scale = size / CANVAS
    foot_y = size * 0.9
    torso_y = foot_y - BODY_H * 0.52 * scale
    head_y = torso_y - (BODY_H * 0.12 + HEAD_R * 0.9) * scale
    return {
        "scale": scale,
        "cx": size / 2,
        "foot_y": foot_y,
        "torso_y": torso_y,
        "head_y": head_y,
        "head_r": HEAD_R * scale,
        "body_w": BODY_W * scale,
        "body_h": BODY_H * scale,
        "stroke": max(1, round(4 * scale)),
    }


def draw_stroked_ellipse(
    draw: ImageDraw.ImageDraw,
    box: tuple[float, float, float, float],
    fill: tuple[int, int, int],
    outline: tuple[int, int, int],
    width: int,
) -> None:
    draw.ellipse(box, fill=fill, outline=outline, width=width)


def draw_tail(draw: ImageDraw.ImageDraw, layout: dict[str, float]) -> None:
    s = layout["scale"]
    mount_x = layout["cx"] - layout["body_w"] * 0.34
    mount_y = layout["torso_y"] - layout["body_h"] * 0.02
    tail_len = TAIL_LEN * s
    stroke = max(2, int(layout["stroke"] * 2.2))
    inner = max(1, int(stroke * 0.82))

    base_points = [
        (mount_x, mount_y),
        (mount_x + tail_len * 0.2, mount_y - tail_len * 0.08),
        (mount_x + tail_len * 0.45, mount_y - tail_len * 0.22),
        (mount_x + tail_len * 0.55, mount_y - tail_len * 0.45),
    ]
    tip_points = [
        base_points[-1],
        (base_points[-1][0] + tail_len * 0.15, base_points[-1][1] - tail_len * 0.12),
        (base_points[-1][0] + tail_len * 0.22, base_points[-1][1] - tail_len * 0.28),
        (base_points[-1][0] + tail_len * 0.12, base_points[-1][1] - tail_len * 0.42),
    ]

    draw.line(base_points, fill=COLORS["body_dark"], width=stroke, joint="curve")
    draw.line(base_points, fill=COLORS["body"], width=inner, joint="curve")
    draw.line(tip_points, fill=COLORS["body_dark"], width=stroke, joint="curve")
    draw.line(tip_points, fill=COLORS["body"], width=inner, joint="curve")


def draw_ear(
    draw: ImageDraw.ImageDraw,
    layout: dict[str, float],
    side: int,
) -> None:
    head_x = layout["cx"]
    head_y = layout["head_y"]
    r = layout["head_r"]
    stroke = layout["stroke"]
    sign = -1 if side < 0 else 1
    ear_x = head_x + sign * r * 0.62
    ear_y = head_y - r * 0.86

    outer = [
        (ear_x + sign * -15 * layout["scale"], ear_y + 5 * layout["scale"]),
        (ear_x + sign * -7 * layout["scale"], ear_y - 10 * layout["scale"]),
        (ear_x, ear_y - 26 * layout["scale"]),
        (ear_x + sign * 7 * layout["scale"], ear_y - 10 * layout["scale"]),
        (ear_x + sign * 15 * layout["scale"], ear_y + 5 * layout["scale"]),
    ]
    inner = [
        (ear_x + sign * -8 * layout["scale"], ear_y + 3 * layout["scale"]),
        (ear_x + sign * -3 * layout["scale"], ear_y - 6 * layout["scale"]),
        (ear_x, ear_y - 14 * layout["scale"]),
        (ear_x + sign * 3 * layout["scale"], ear_y - 6 * layout["scale"]),
        (ear_x + sign * 8 * layout["scale"], ear_y + 3 * layout["scale"]),
    ]
    draw.polygon(outer, fill=COLORS["body"], outline=COLORS["outline"])
    draw.polygon(inner, fill=COLORS["pink"], outline=COLORS["outline"], width=max(1, stroke // 3))


def draw_eye(
    draw: ImageDraw.ImageDraw,
    layout: dict[str, float],
    side: int,
    *,
    tiny: bool,
) -> None:
    head_x = layout["cx"]
    head_y = layout["head_y"]
    r = layout["head_r"]
    stroke = layout["stroke"]
    gap = r * 0.3
    eye_x = head_x + side * gap
    eye_y = head_y + r * 0.06
    eye_w = r * 0.5
    eye_h = r * 0.58

    if tiny:
        dot = max(2, int(r * 0.16))
        draw.ellipse(
            (eye_x - dot, eye_y - dot, eye_x + dot, eye_y + dot),
            fill=COLORS["eye"],
            outline=COLORS["outline"],
            width=1,
        )
        return

    box = (eye_x - eye_w / 2, eye_y - eye_h / 2, eye_x + eye_w / 2, eye_y + eye_h / 2)
    draw_stroked_ellipse(draw, box, COLORS["eye"], COLORS["outline"], max(1, stroke // 2))

    pupil_w = eye_w * 0.78
    pupil_h = eye_h * 0.82
    pupil_box = (
        eye_x - pupil_w / 2,
        eye_y - pupil_h / 2,
        eye_x + pupil_w / 2,
        eye_y + pupil_h / 2,
    )
    draw.ellipse(pupil_box, fill=COLORS["pupil"])

    shine_big = max(1, int(r * 0.09))
    shine_small = max(1, int(r * 0.04))
    draw.ellipse(
        (
            eye_x - eye_w * 0.16 - shine_big,
            eye_y - eye_h * 0.2 - shine_big,
            eye_x - eye_w * 0.16 + shine_big,
            eye_y - eye_h * 0.2 + shine_big,
        ),
        fill=COLORS["white"],
    )
    draw.ellipse(
        (
            eye_x + eye_w * 0.14 - shine_small,
            eye_y + eye_h * 0.08 - shine_small,
            eye_x + eye_w * 0.14 + shine_small,
            eye_y + eye_h * 0.08 + shine_small,
        ),
        fill=COLORS["white"],
    )


def draw_cat(draw: ImageDraw.ImageDraw, size: int) -> None:
    layout = cat_layout(size)
    stroke = layout["stroke"]
    tiny = size <= 24
    show_blush = size >= 48
    show_whiskers = size >= 64

    draw_tail(draw, layout)

    body_box = (
        layout["cx"] - layout["body_w"] * 0.54,
        layout["torso_y"] - layout["body_h"] * 0.52,
        layout["cx"] + layout["body_w"] * 0.54,
        layout["torso_y"] + layout["body_h"] * 0.52,
    )
    draw_stroked_ellipse(draw, body_box, COLORS["body"], COLORS["outline"], stroke)

    belly_box = (
        layout["cx"] - layout["body_w"] * 0.28,
        layout["torso_y"] - layout["body_h"] * 0.22,
        layout["cx"] + layout["body_w"] * 0.28,
        layout["torso_y"] + layout["body_h"] * 0.22,
    )
    draw_stroked_ellipse(draw, belly_box, COLORS["belly"], COLORS["outline"], max(1, stroke // 4))

    paw_w = layout["body_w"] * 0.22
    paw_h = layout["body_h"] * 0.24
    for side in (-1, 1):
        paw_x = layout["cx"] + side * layout["body_w"] * 0.2
        paw_y = layout["torso_y"] + layout["body_h"] * 0.34
        draw_stroked_ellipse(
            draw,
            (paw_x - paw_w / 2, paw_y - paw_h / 2, paw_x + paw_w / 2, paw_y + paw_h / 2),
            COLORS["body_dark"],
            COLORS["outline"],
            max(1, stroke // 2),
        )

    collar_w = layout["body_w"] * 0.78
    collar_h = layout["head_r"] * 0.14
    collar_y = layout["torso_y"] - layout["body_h"] * 0.42
    draw.rounded_rectangle(
        (
            layout["cx"] - collar_w / 2,
            collar_y - collar_h / 2,
            layout["cx"] + collar_w / 2,
            collar_y + collar_h / 2,
        ),
        radius=max(1, int(collar_h / 2)),
        fill=COLORS["collar"],
        outline=COLORS["outline"],
        width=max(1, stroke // 3),
    )
    if not tiny:
        charm = layout["head_r"] * 0.16
        draw.ellipse(
            (
                layout["cx"] - charm / 2,
                collar_y - charm / 2,
                layout["cx"] + charm / 2,
                collar_y + charm / 2,
            ),
            fill=COLORS["charm"],
            outline=COLORS["outline"],
            width=max(1, stroke // 4),
        )

    head_box = (
        layout["cx"] - layout["head_r"],
        layout["head_y"] - layout["head_r"],
        layout["cx"] + layout["head_r"],
        layout["head_y"] + layout["head_r"],
    )
    draw_stroked_ellipse(draw, head_box, COLORS["body"], COLORS["outline"], stroke)

    draw_ear(draw, layout, -1)
    draw_ear(draw, layout, 1)

    if show_blush:
        blush_w = layout["head_r"] * 0.28
        blush_h = layout["head_r"] * 0.2
        for side in (-1, 1):
            cheek_x = layout["cx"] + side * layout["head_r"] * 0.62
            cheek_y = layout["head_y"] + layout["head_r"] * 0.2
            draw.ellipse(
                (
                    cheek_x - blush_w / 2,
                    cheek_y - blush_h / 2,
                    cheek_x + blush_w / 2,
                    cheek_y + blush_h / 2,
                ),
                fill=COLORS["blush"],
            )

    draw_eye(draw, layout, -1, tiny=tiny)
    draw_eye(draw, layout, 1, tiny=tiny)

    mouth_y = layout["head_y"] + layout["head_r"] * 0.36
    if tiny:
        draw.arc(
            (
                layout["cx"] - layout["head_r"] * 0.12,
                mouth_y - layout["head_r"] * 0.05,
                layout["cx"] + layout["head_r"] * 0.12,
                mouth_y + layout["head_r"] * 0.08,
            ),
            start=200,
            end=340,
            fill=COLORS["outline"],
            width=1,
        )
    else:
        draw.arc(
            (
                layout["cx"] - layout["head_r"] * 0.1,
                mouth_y - layout["head_r"] * 0.02,
                layout["cx"] + layout["head_r"] * 0.1,
                mouth_y + layout["head_r"] * 0.12,
            ),
            start=200,
            end=340,
            fill=COLORS["outline"],
            width=max(1, int(stroke * 0.9)),
        )

    if show_whiskers:
        whisker_y = layout["head_y"] + layout["head_r"] * 0.34
        whisker_len = layout["head_r"] * 0.42
        for side in (-1, 1):
            start_x = layout["cx"] + side * layout["head_r"] * 0.54
            end_x = layout["cx"] + side * (layout["head_r"] * 0.54 + whisker_len)
            draw.line(
                [(start_x, whisker_y), (end_x, whisker_y - layout["head_r"] * 0.02)],
                fill=COLORS["outline"],
                width=max(1, int(stroke * 0.72)),
            )


def render_tabby(size: int, *, flat: bool = False) -> Image.Image:
    canvas = draw_background(size, flat=flat)
    draw = ImageDraw.Draw(canvas)
    draw_cat(draw, size)
    return canvas


def make_icon(size: int) -> Image.Image:
    if size <= 16:
        return render_tabby(64, flat=True).resize((16, 16), Image.Resampling.LANCZOS)
    if size <= 32:
        return render_tabby(size, flat=True)
    return render_tabby(size)


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
