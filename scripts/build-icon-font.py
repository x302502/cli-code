"""Builds the small monochrome bee (an outlined round badge with a mortarboard, a visor with two
slot eyes and a mouth bar, ring wings and curled legs) for the status bar and the editor title buttons:
  images/cli-code-logo.woff  — icon font, one glyph at U+E000 (status bar, `$(cli-code-logo)`)
  images/button-light.svg    — light glyph for dark themes (editor title buttons)
  images/button-dark.svg     — dark glyph for light themes
Needs `pip install fonttools shapely`. The shapes are the design's SVG mask in a 128-unit space
(y down), painted in the same order: each step adds white (ink) or cuts black (a true cutout).
VS Code icon SVGs and fonts cannot use masks, so the result is flattened to plain outlines."""
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from shapely import affinity
from shapely.geometry import LineString, Point, Polygon, box
from shapely.geometry.polygon import orient
from shapely.ops import unary_union


def ellipse(cx, cy, rx, ry, rot=0):
    return affinity.rotate(affinity.scale(Point(cx, cy).buffer(1, 48), rx, ry), rot, origin=(cx, cy))


def rrect(x, y, w, h, r):
    x0, y0, x1, y1 = x + r, y + r, x + w - r, y + h - r
    if x0 == x1 or y0 == y1:  # a stadium: its inner box has no area, so buffer a line instead
        return LineString([(x0, y0), (x1, y1)]).buffer(r, 24)
    return box(x0, y0, x1, y1).buffer(r, 24)


def bezier(*pts, n=24):
    out = []
    for p0, p1, p2, p3 in zip(pts[0::3], pts[1::3], pts[2::3], pts[3::3]):
        out += [tuple((1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t ** 2 * c + t ** 3 * d for a, b, c, d in zip(p0, p1, p2, p3))
                for t in (i / n for i in range(n + 1))]
    return out


def mirror(g):
    return affinity.scale(g, -1, 1, origin=(64, 0))


def stroke(line, w, join=1):
    return LineString(line).buffer(w / 2, 24, cap_style=1, join_style=join)


def ring(shape, w):
    """The stroke of `shape`'s outline, `w` wide and centred on the edge."""
    return shape.boundary.buffer(w / 2, 24, join_style=1)


leg = stroke(bezier((32, 100), (22, 102), (14, 108), (14, 115), (14, 121), (22, 122), (24, 117)), 7)
head = rrect(28, 44, 72, 62, 30)
visor = rrect(38, 60, 52, 26, 13)
band = rrect(42, 30, 44, 16, 4)
cap = Polygon([(64, 10), (110, 27), (64, 44), (18, 27)])
wing = ring(ellipse(20, 64, 11, 20, -18), 8)

ink = unary_union([wing, mirror(wing), leg, mirror(leg)])
ink = ink.difference(head.buffer(11, 24))                            # gap round the head
ink = ink.union(ring(head, 10))                                      # head: an outline, open inside
ink = ink.union(visor).difference(unary_union([rrect(49, 65, 8, 15, 4), rrect(71, 65, 8, 15, 4)]))  # visor, eyes cut out
ink = ink.union(rrect(54, 94, 20, 6, 3))                             # mouth
ink = ink.union(band).difference(ring(band, 6))                      # band under the cap
ink = ink.union(cap).difference(ring(cap, 6)).union(cap.buffer(2, 8, join_style=1))  # mortarboard
ink = ink.difference(stroke([(64, 27), (104, 30), (104, 46)], 4, join=2))  # cord (the mask leaves its corner mitred)
ink = ink.union(stroke([(104, 32), (104, 46)], 5)).union(rrect(99, 44, 10, 11, 3))  # tassel
bee = ink.simplify(0.02)
X0, Y0, X1, Y1 = bee.bounds
W, H = X1 - X0, Y1 - Y0


def polys(g):
    return list(g.geoms) if g.geom_type == "MultiPolygon" else [g]


def to_cell(g, fit_w, fit_h, cx, cy):
    """Scale the bee to fit_w x fit_h (keeping aspect), centred on (cx, cy); y down."""
    s = min(fit_w / W, fit_h / H)
    g = affinity.translate(g, -(X0 + X1) / 2, -(Y0 + Y1) / 2)
    g = affinity.scale(g, s, s, origin=(0, 0))
    return affinity.translate(g, cx, cy)


def path_d(g, digits=2):
    out = []
    for p in polys(g):
        for r in [p.exterior, *p.interiors]:
            out.append("M" + " ".join(f"{x:.{digits}f} {y:.{digits}f}" for x, y in list(r.coords)[:-1]) + "Z")
    return "".join(out)


# --- editor title buttons: 16x16, the bee filling it like a built-in icon
btn = to_cell(bee, 15.2, 15.2, 8, 8).simplify(0.01)
for name, fill in (("button-light.svg", "#C5C5C5"), ("button-dark.svg", "#424242")):
    with open(f"images/{name}", "w") as f:
        f.write(f'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path fill="{fill}" fill-rule="evenodd" d="{path_d(btn, 2)}"/></svg>\n')

# --- status bar glyph: 1000 upm; Copilot's Sign In icon is ~31x28 device px, about 0.9 em tall
CENTER_Y = 355  # font units above the baseline: puts the mark level with the status bar text
fg = to_cell(bee, 900, 880, 500, 1000 - CENTER_Y)
fg = affinity.scale(fg, 1, -1, origin=(0, 500))  # font y is up
pen = TTGlyphPen(None)
for p in polys(fg):
    p = orient(p, sign=1.0)  # outer rings and holes wound opposite ways: non-zero fill leaves the holes
    for r in [p.exterior, *p.interiors]:
        pts = [(round(x), round(y)) for x, y in list(r.coords)[:-1]]
        pen.moveTo(pts[0])
        for pt in pts[1:]:
            pen.lineTo(pt)
        pen.closePath()
fb = FontBuilder(1000, isTTF=True)
fb.setupGlyphOrder([".notdef", "logo"])
fb.setupCharacterMap({0xE000: "logo"})
fb.setupGlyf({".notdef": TTGlyphPen(None).glyph(), "logo": pen.glyph()})
fb.setupHorizontalMetrics({".notdef": (1000, 0), "logo": (1000, 0)})
fb.setupHorizontalHeader(ascent=800, descent=-200)
fb.setupNameTable({"familyName": "cli-code-logo", "styleName": "Regular"})
fb.setupOS2(sTypoAscender=800, sTypoDescender=-200, usWinAscent=800, usWinDescent=200)
fb.setupPost()
fb.font.flavor = "woff"
fb.save("images/cli-code-logo.woff")
