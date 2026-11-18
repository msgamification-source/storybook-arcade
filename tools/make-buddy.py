#!/usr/bin/env python3
"""Turn a character picture on a white background into a clean, transparent game avatar.

    pip install pillow numpy
    python3 tools/make-buddy.py my-picture.png fox

That writes assets/buddies/fox.png. Then add one line for it in js/buddies.js.

For a boss, add the folder and a bigger size, then add it to js/bosses.js:

    python3 tools/make-buddy.py my-boss.png gobbler bosses 512
The picture needs a plain white (or near white) background and a closed dark outline
around the character, so white parts of the character (a white bear, say) stay filled in.
"""
import os
import sys

from artlib import cut_out, place, tight_bbox

SIZE = 256           # final image is SIZE x SIZE
MARGIN = 6


def main():
    if len(sys.argv) not in (3, 4, 5):
        sys.exit(__doc__)
    src, name = sys.argv[1], sys.argv[2]
    folder = sys.argv[3] if len(sys.argv) > 3 else 'buddies'
    size = int(sys.argv[4]) if len(sys.argv) > 4 else SIZE
    im = cut_out(src)
    im = im.crop(tight_bbox(im))
    scale = (size - 2 * MARGIN) / max(im.size)
    canvas = place(im, size, MARGIN, scale, 'bottom')   # feet on the same baseline for every character
    out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', folder)
    os.makedirs(out_dir, exist_ok=True)
    dest = os.path.normpath(os.path.join(out_dir, name + '.png'))
    canvas.save(dest, optimize=True)
    print(f'wrote {dest} ({os.path.getsize(dest) // 1024} KB)')


if __name__ == '__main__':
    main()
