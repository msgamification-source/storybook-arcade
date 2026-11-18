"""Shared picture helpers for the tools in this folder (background removal and sizing)."""
from collections import deque

import numpy as np
from PIL import Image

INK = (20, 24, 31)   # the game's outline color


def dilate(mask, n):
    out = mask.copy()
    for _ in range(n):
        m = out.copy()
        m[1:] |= out[:-1]; m[:-1] |= out[1:]
        m[:, 1:] |= out[:, :-1]; m[:, :-1] |= out[:, 1:]
        out = m
    return out


def cut_out(path):
    """Remove a plain white background. White inside the outline is left alone. Returns RGBA."""
    rgb = np.array(Image.open(path).convert('RGB')).astype(np.int16)
    h, w = rgb.shape[:2]
    light = rgb.min(axis=2) > 235
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
    # Clean the edge: soft gray pixels just outside the outline become outline colored and partly
    # transparent, so there is no light halo on a colored background.
    band = dilate(bg, 4) & ~bg
    lum = rgb.mean(axis=2)
    alpha = np.where(bg, 0, 255).astype(np.float32)
    soft = np.clip((255 - lum) / (255 - 30), 0, 1) * 255
    alpha[band] = soft[band]
    out = rgb.copy()
    out[band] = INK
    return Image.fromarray(np.dstack([out.astype(np.uint8), alpha.astype(np.uint8)]), 'RGBA')


def tight_bbox(im, threshold=20):
    return im.getchannel('A').point(lambda v: 255 if v > threshold else 0).getbbox()


def place(im, size, margin, scale, align):
    """Scale a cropped picture and put it on a transparent size x size canvas."""
    im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    x = (size - im.width) // 2
    y = size - margin - im.height if align == 'bottom' else (size - im.height) // 2
    canvas.paste(im, (x, y), im)
    return canvas
