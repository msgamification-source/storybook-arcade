#!/usr/bin/env python3
"""Cut a sheet of separate pictures (on a white background) into one transparent PNG each.

    python3 tools/split-sheet.py sheet.png assets/icons coin flame flag --cols 3

Names are given in reading order: left to right, then top to bottom.
Options:
  --cols N        pictures per row (default: all in one row)
  --size PX       size of each finished square picture (default 256)
  --merge PX      pieces closer than this count as ONE picture, e.g. confetti around a star (default 8)
  --same-scale    keep every picture at the same scale (use for a set of poses of one character)
  --align bottom  stand pictures on one baseline (default: center)
Needs: pip install pillow numpy
"""
import argparse
import os
from collections import deque

import numpy as np

from artlib import cut_out, dilate, place, tight_bbox

F = 4  # grouping works on a shrunk copy of the sheet, this many pixels per cell


def groups(alpha, merge):
    h, w = alpha.shape
    gh, gw = -(-h // F), -(-w // F)
    pad = np.zeros((gh * F, gw * F), bool)
    pad[:h, :w] = alpha > 20
    cells = pad.reshape(gh, F, gw, F).any(axis=(1, 3))
    cells = dilate(cells, max(1, round(merge / F)))
    label = np.zeros((gh, gw), int)
    n = 0
    for y in range(gh):
        for x in range(gw):
            if cells[y, x] and not label[y, x]:
                n += 1
                label[y, x] = n
                q = deque([(y, x)])
                while q:
                    cy, cx = q.popleft()
                    for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                        if 0 <= ny < gh and 0 <= nx < gw and cells[ny, nx] and not label[ny, nx]:
                            label[ny, nx] = n
                            q.append((ny, nx))
    return np.kron(label, np.ones((F, F), int))[:h, :w], n


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('sheet'); ap.add_argument('outdir'); ap.add_argument('names', nargs='+')
    ap.add_argument('--cols', type=int, default=0); ap.add_argument('--size', type=int, default=256)
    ap.add_argument('--merge', type=int, default=8); ap.add_argument('--margin', type=int, default=6)
    ap.add_argument('--same-scale', action='store_true'); ap.add_argument('--align', default='center', choices=['center', 'bottom'])
    a = ap.parse_args()

    from PIL import Image
    sheet = cut_out(a.sheet)
    arr = np.array(sheet)
    lab, n = groups(arr[:, :, 3], a.merge)
    pieces = []
    for k in range(1, n + 1):
        m = (lab == k) & (arr[:, :, 3] > 0)
        if m.sum() < 400:
            continue  # ignore specks
        piece = arr.copy()
        piece[~m] = 0
        im = Image.fromarray(piece, 'RGBA')
        box = tight_bbox(im)
        pieces.append((box, im.crop(box)))
    if len(pieces) != len(a.names):
        print(f'Found {len(pieces)} pictures but you gave {len(a.names)} names. Found (left, top, right, bottom):')
        for box, _ in pieces: print('  ', box)
        raise SystemExit(1)
    # reading order
    cols = a.cols or len(pieces)
    pieces.sort(key=lambda p: (p[0][1] + p[0][3]) / 2)
    rows = [sorted(pieces[i:i + cols], key=lambda p: (p[0][0] + p[0][2]) / 2) for i in range(0, len(pieces), cols)]
    ordered = [p for r in rows for p in r]
    biggest = max(max(im.size) for _, im in ordered)
    os.makedirs(a.outdir, exist_ok=True)
    for name, (box, im) in zip(a.names, ordered):
        scale = (a.size - 2 * a.margin) / (biggest if a.same_scale else max(im.size))
        dest = os.path.join(a.outdir, name + '.png')
        place(im, a.size, a.margin, scale, a.align).save(dest, optimize=True)
        print(f'wrote {dest} ({os.path.getsize(dest) // 1024} KB)')


if __name__ == '__main__':
    main()
