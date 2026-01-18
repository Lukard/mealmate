# Generate Extension Icons

This document provides instructions to generate PNG icons from the SVG source for Chrome Web Store submission.

## Required Icon Sizes

| File | Size | Purpose |
|------|------|---------|
| `icon16.png` | 16x16 | Toolbar icon |
| `icon48.png` | 48x48 | Extension management page |
| `icon128.png` | 128x128 | Chrome Web Store listing |

## Method 1: ImageMagick (Recommended)

```bash
# Install ImageMagick
# macOS: brew install imagemagick
# Ubuntu: sudo apt install imagemagick

# Navigate to assets directory
cd src/extension/assets

# Generate all icon sizes
convert -background none icon.svg -resize 16x16 icon16.png
convert -background none icon.svg -resize 48x48 icon48.png
convert -background none icon.svg -resize 128x128 icon128.png
```

## Method 2: Inkscape

```bash
# Install Inkscape
# macOS: brew install inkscape
# Ubuntu: sudo apt install inkscape

# Generate icons
inkscape icon.svg -w 16 -h 16 -o icon16.png
inkscape icon.svg -w 48 -h 48 -o icon48.png
inkscape icon.svg -w 128 -h 128 -o icon128.png
```

## Method 3: Node.js with Sharp

If you have Node.js installed, you can use sharp:

```bash
npm install sharp

node -e "
const sharp = require('sharp');
const sizes = [16, 48, 128];
sizes.forEach(size => {
  sharp('icon.svg')
    .resize(size, size)
    .png()
    .toFile(\`icon\${size}.png\`);
});
"
```

## Method 4: Online Tools

Use these online converters:

1. **SVG to PNG Converter**: https://svgtopng.com/
2. **CloudConvert**: https://cloudconvert.com/svg-to-png
3. **Convertio**: https://convertio.co/svg-png/

Upload `icon.svg` and export at each required resolution (16x16, 48x48, 128x128).

## Method 5: Using Plasmo Build

Plasmo can automatically generate icons during build if you have a `icon.svg` file. The build process will create the necessary PNG files:

```bash
npm run build
```

Check `build/chrome-mv3-prod` for generated icons.

## Verification

After generating icons, verify:

1. All three files exist (`icon16.png`, `icon48.png`, `icon128.png`)
2. Each file has the correct dimensions
3. Icons have transparent backgrounds
4. Icons are sharp and readable at small sizes

```bash
# Verify with ImageMagick
identify icon16.png icon48.png icon128.png
```

Expected output:
```
icon16.png PNG 16x16 ...
icon48.png PNG 48x48 ...
icon128.png PNG 128x128 ...
```
