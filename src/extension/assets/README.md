# Extension Assets

This directory contains the extension icons and visual assets.

## Icon Files

| File | Size | Purpose |
|------|------|---------|
| `icon.svg` | Source | Vector source for generating PNG icons |
| `icon16.png` | 16x16 | Toolbar icon |
| `icon48.png` | 48x48 | Extension management page |
| `icon128.png` | 128x128 | Chrome Web Store listing |

## Generate PNG Icons

See `generate-icons.md` for detailed instructions on generating PNG icons from the SVG source.

### Quick Start (ImageMagick)

```bash
# macOS
brew install imagemagick

# Generate all icons
convert -background none icon.svg -resize 16x16 icon16.png
convert -background none icon.svg -resize 48x48 icon48.png
convert -background none icon.svg -resize 128x128 icon128.png
```

### Quick Start (Inkscape)

```bash
inkscape icon.svg -w 16 -h 16 -o icon16.png
inkscape icon.svg -w 48 -h 48 -o icon48.png
inkscape icon.svg -w 128 -h 128 -o icon128.png
```

## Chrome Web Store Assets

For Chrome Web Store submission, you also need:

- **Screenshots** (1280x800 or 640x400) - See `STORE_LISTING.md`
- **Small promo tile** (440x280) - Optional
- **Large promo tile** (920x680) - Optional
- **Marquee** (1400x560) - Optional

These should be saved in a separate `store-assets/` directory (not included in extension package).
