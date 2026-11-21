"""生成 PWA 图标（绿色圆环）。用法：
    python tools/make_icons.py
"""
from pathlib import Path
from PIL import Image, ImageDraw

GREEN = (46, 158, 99, 255)
WHITE = (255, 255, 255, 255)
OUT = Path(__file__).resolve().parent.parent / "icons"
OUT.mkdir(parents=True, exist_ok=True)


def draw_icon(size: int, ring_ratio: float = 0.75, ring_width: float = 0.094) -> Image.Image:
    scale = 4
    big = size * scale
    img = Image.new("RGBA", (big, big), GREEN)
    d = ImageDraw.Draw(img)

    r = big * ring_ratio / 2
    cx = cy = big / 2
    w = int(big * ring_width)
    box = (cx - r, cy - r, cx + r, cy + r)
    start, end = -90, 190
    d.arc(box, start=start, end=end, fill=WHITE, width=w)

    # 末端圆点，呼应 App 内的进度环
    import math

    angle = math.radians(end)
    px = cx + r * math.cos(angle)
    py = cy + r * math.sin(angle)
    dot = w * 0.62
    d.ellipse((px - dot, py - dot, px + dot, py + dot), fill=WHITE)

    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    sizes = {
        "icon-512.png": 512,
        "icon-192.png": 192,
        "apple-touch-icon.png": 180,
        "icon-64.png": 64,
    }
    for name, size in sizes.items():
        draw_icon(size).save(OUT / name, optimize=True)
    draw_icon(512, ring_ratio=0.58, ring_width=0.072).save(
        OUT / "icon-maskable-512.png", optimize=True
    )
    print("icons written to", OUT)


if __name__ == "__main__":
    main()
