#!/usr/bin/env python3
"""Turn a character picture on a white background into a clean, transparent game avatar.

    pip install pillow numpy
    python3 tools/make-buddy.py my-picture.png fox

That writes assets/buddies/fox.png. Then add one line for it in js/buddies.js.
The picture needs a plain white (or near white) background and a closed dark outline
around the character, so white parts of the character (a white bear, say) stay filled in.
"""
import os
import sys
from collections import deque

import numpy as np
from PIL import Image

INK = (20, 24, 31)   # the game's outline color
SIZE = 256           # final image is SIZE x SIZE
MARGIN = 6


def dilate(mask, n):
    out = mask.copy()
    for _ in range(n):
        m = out.copy()
        m[1:] |= out[:-1]; m[:-1] |= out[1:]
        m[:, 1:] |= out[:, :-1]; m[:, :-1] |= out[:, 1:]
        out = m
    return out


def cut_out(path):
    rgb = np.array(Image.open(path).convert('RGB')).astype(np.int16)
    h, w = rgb.shape[:2]
    light = rgb.min(axis=2) > 235
    # Flood fill the white background in from the edges. White inside the outline is left alone.
    bg = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if light[y, x] and not bg[y, x]: bg[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if light[y, x] and not bg[y, x]: bg[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w and light[ny, nx] and not bg[ny, nx]:
                bg[ny, nx] = True; q.append((ny, nx))
    # Clean the edge: the soft gray pixels just outside the outline become outline colored and
    # partly transparent, so there is no light halo on a colored background.
    band = dilate(bg, 4) & ~bg
    lum = rgb.mean(axis=2)
    alpha = np.where(bg, 0, 255).astype(np.float32)
    soft = np.clip((255 - lum) / (255 - 30), 0, 1) * 255
    alpha[band] = soft[band]
    out = rgb.copy()
    out[band] = INK
    rgba = np.dstack([out.astype(np.uint8), alpha.astype(np.uint8)])
    return Image.fromarray(rgba, 'RGBA')


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    src, name = sys.argv[1], sys.argv[2]
    im = cut_out(src)
    x0, y0, x1, y1 = im.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox()
    im = im.crop((x0, y0, x1, y1))
    scale = (SIZE - 2 * MARGIN) / max(im.size)
    im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    canvas = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    # centered sideways, feet on the same baseline for every character
    canvas.paste(im, ((SIZE - im.width) // 2, SIZE - MARGIN - im.height), im)
    out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'buddies')
    os.makedirs(out_dir, exist_ok=True)
    dest = os.path.normpath(os.path.join(out_dir, name + '.png'))
    canvas.save(dest, optimize=True)
    print(f'wrote {dest} ({os.path.getsize(dest) // 1024} KB)')


if __name__ == '__main__':
    main()
