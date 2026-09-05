# Where to put your files

Nothing here is required — the site renders without any of it and falls back
gracefully. Drop files in and they appear automatically.

## `products/`

Photographs of your pieces. Any web format (`.jpg`, `.webp`, `.png`).

Square-ish images look best; they are cropped to 4:3. Aim for roughly
1000×750 px and keep each file under about 300 KB so the page stays quick.

Then point at them from `data/products.json`:

```json
{ "id": "p1", "name": "Plain Round Kada", "image": "/assets/products/kada.jpg", ... }
```

Once your own pieces are in that file, set `"status": "live"` at the top of it
and the "these are sample pieces" banner disappears from the website.

## `qr/`

Two optional QR codes, shown at the bottom of every page:

| File | Points at |
|---|---|
| `qr/instagram.png` | your Instagram page |
| `qr/website.png` | this website, once it is live |

Use `.png` with those exact names. Roughly 600×600 px, plain black on white,
with a little white margin around the edge. Whichever file is missing is simply
not shown — you can add just one.

## `video/`

`video/hero.mp4` replaces the animated gold background at the top of the page.
Silent, roughly 8–15 seconds, and ideally under 4 MB. Without it the page draws
its own looping animation, which costs no bandwidth at all.
