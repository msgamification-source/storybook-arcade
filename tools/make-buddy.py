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

from artlib import cut_out, place, tight_bbox

SIZE = 256           # final image is SIZE x SIZE
MARGIN = 6


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    src, name = sys.argv[1], sys.argv[2]
    im = cut_out(src)
    im = im.crop(tight_bbox(im))
    scale = (SIZE - 2 * MARGIN) / max(im.size)
    canvas = place(im, SIZE, MARGIN, scale, 'bottom')   # feet on the same baseline for every character
    out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'buddies')
    os.makedirs(out_dir, exist_ok=True)
    dest = os.path.normpath(os.path.join(out_dir, name + '.png'))
    canvas.save(dest, optimize=True)
    print(f'wrote {dest} ({os.path.getsize(dest) // 1024} KB)')


if __name__ == '__main__':
    main()
