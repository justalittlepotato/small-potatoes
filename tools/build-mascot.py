"""Build the mascot file and the app icons rendered from it.

The mascot is the house potato, unchanged: no hat, no arms, nothing tucked
behind the sprout. This script exists so the sprite can be loaded as its own
file by <img> (it needs the svg namespace declared, which the inline version
in the style skill does not carry) and so the icons are rendered from the
same bytes rather than drawn twice.

House rule: never edit a base pixel. Every base rect must survive byte for
byte, and nothing is appended.

The icons are written straight out as PNGs with zlib and a hand-rolled chunk
writer, so this stays a no-dependency repo: no pillow, no cairo, no node.

    python3 tools/build-mascot.py
"""
import pathlib
import re
import struct
import zlib

BASE = pathlib.Path.home() / ".claude/skills/potato-html-style/mascot-potato.svg"
OUT = pathlib.Path("icons/mascot-small.svg")

GRID = 28
GRID_H = 33


def parse(svg):
    return [
        (int(m[0]), int(m[1]), int(m[2]), m[3])
        for m in re.findall(
            r'<rect x="(\d+)" y="(\d+)" width="(\d+)" height="1" fill="(#[0-9a-f]{6})"/>',
            svg,
        )
    ]


base = BASE.read_text()
assert base.endswith("</svg>"), "base sprite is not a single <svg> element"
assert base.startswith("<svg "), "unexpected root element"
base_rects = parse(base)
assert base_rects, "no rects found in the base sprite — has it been rewritten?"
assert all(x + w <= GRID and y < GRID_H for (x, y, w, _) in base_rects), \
    "the base sprite does not fit the grid this script assumes"

mascot = base.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ', 1)

# Only the root element gained an attribute. The rects are untouched.
surviving = base[base.index("<rect"):]
assert mascot.endswith(surviving), "base rects were altered"

OUT.parent.mkdir(exist_ok=True)
OUT.write_text(mascot)
print(f"wrote {OUT} — {len(base_rects)} rects, nothing added")


# ---------- icons ----------

CANVAS = 40                     # square, with room around the sprite for ios masking
OFFSET_X = (CANVAS - GRID) // 2
OFFSET_Y = (CANVAS - GRID_H) // 2
BACKDROP = "#14111d"            # --bg, so the icon matches the app behind it
ICON_SIZES = [180, 192, 512]    # apple touch icon, then the two android sizes


def rgb(hex_colour):
    return tuple(int(hex_colour[i:i + 2], 16) for i in (1, 3, 5))


def rasterise(rects):
    """Paint the rects onto a square canvas, in document order."""
    canvas = [[rgb(BACKDROP)] * CANVAS for _ in range(CANVAS)]
    for x, y, w, fill in rects:
        for i in range(w):
            canvas[y + OFFSET_Y][x + i + OFFSET_X] = rgb(fill)
    return canvas


def scale(canvas, size):
    """Nearest neighbour, so the pixels stay hard-edged at any size."""
    return [
        [canvas[y * CANVAS // size][x * CANVAS // size] for x in range(size)]
        for y in range(size)
    ]


def write_png(path, pixels):
    size = len(pixels)

    def chunk(kind, data):
        return (
            struct.pack(">I", len(data))
            + kind
            + data
            + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
        )

    raw = b"".join(
        b"\x00" + b"".join(bytes(px) for px in row) for row in pixels
    )

    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


sprite = rasterise(base_rects)
for size in ICON_SIZES:
    icon = OUT.parent / f"icon-{size}.png"
    write_png(icon, scale(sprite, size))
    print(f"wrote {icon}")
