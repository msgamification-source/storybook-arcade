#!/usr/bin/env python3
"""Build the faint background pattern (assets/pattern.png) from the icons in assets/icons/.

    python3 tools/make-pattern.py
"""
import math
import os
import random

from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
ICONS = ['heart', 'book', 'joystick', 'pencil', 'coin', 'controller', 'bookmark', 'trophy', 'flag', 'heart']
TILE_W, TILE_H = 700, 680
SIZE = 74           # icon size in the tile
FADE = 0.11         # how faint the icons are (0 to 1)


def main():
    random.seed(7)
    tile = Image.new('RGBA', (TILE_W, TILE_H), (0, 0, 0, 0))
    n = 0
    for row in range(4):
        for col in range(4):
            name = ICONS[n % len(ICONS)]
            n += 1
            im = Image.open(os.path.join(ROOT, 'assets', 'icons', name + '.png')).convert('RGBA').resize((SIZE, SIZE), Image.LANCZOS)
            im = im.rotate(random.choice([-16, -9, 8, 15]), expand=True, resample=Image.BICUBIC)
            cx = col * (TILE_W / 4) + (TILE_W / 8 if row % 2 else 0) + random.randint(-12, 12)
            cy = row * (TILE_H / 4) + TILE_H / 8 + random.randint(-12, 12)
            # paste with wrap-around so the tile repeats without seams
            for dx in (-TILE_W, 0, TILE_W):
                for dy in (-TILE_H, 0, TILE_H):
                    tile.alpha_composite(im, (int(cx - im.width / 2 + dx), int(cy - im.height / 2 + dy))) if (
                        -im.width < cx - im.width / 2 + dx < TILE_W and -im.height < cy - im.height / 2 + dy < TILE_H) else None
    a = tile.getchannel('A').point(lambda v: int(v * FADE))
    tile.putalpha(a)
    dest = os.path.join(ROOT, 'assets', 'pattern.png')
    tile.save(dest, optimize=True)
    print(f'wrote {os.path.normpath(dest)} ({os.path.getsize(dest) // 1024} KB)')


if __name__ == '__main__':
    main()
