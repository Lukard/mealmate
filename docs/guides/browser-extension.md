# Browser Extension Guide

The Meal Automation browser extension enables one-click grocery shopping by automatically adding your grocery list to supermarket carts.

## Installation

### Chrome Web Store

1. Open Chrome browser
2. Visit the [Meal Automation Extension](chrome-web-store-link) page
3. Click "Add to Chrome"
4. Confirm by clicking "Add extension"
5. The Meal Automation icon appears in your toolbar

### Manual Installation (Developer Mode)

For testing or development:

1. Download the extension package
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (top right toggle)
4. Click "Load unpacked"
5. Select the extension folder
6. The extension is now active

## Setup

### Connecting to Your Account

1. Click the Meal Automation icon in your toolbar
2. Click "Sign In"
3. Enter your Meal Automation credentials
4. Grant necessary permissions
5. You're connected!

### Configuring Supermarkets

In the extension popup:

1. Click "Settings"
2. Select your primary supermarket
3. Configure login preferences:
   - **Auto-login**: Opens login page for you to enter credentials
   - **Session persistence**: Remember login between sessions

## Using the Extension

### Sending Your Grocery List to Cart

**From the Meal Automation web app:**

1. Review your grocery list
2. Select your preferred supermarket
3. Click "Send to Cart"
4. The extension activates automatically

**What happens next:**

1. Extension opens supermarket website
2. Logs in (if needed)
3. Searches for each product
4. Adds products to cart
5. Shows progress and results

### Progress Tracking

During cart population:

```
Adding items to cart...
✓ Whole milk 1L - Added
✓ Fresh chicken breast - Added
⚠ Organic eggs - Not found (alternative suggested)
✓ Olive oil 1L - Added
○ Tomatoes 500g - Searching...

Progress: 4/10 items added
```

### Handling Issues

**Product not found:**
- Extension suggests alternatives
- You can skip or manually add later
- Report missing product to improve matching

**Out of stock:**
- Alternative products shown
- Can skip or substitute
- Will be marked in your list

**Login required:**
- Extension opens login page
- Enter credentials securely on store site
- Resume cart filling after login

## Features

### One-Click Cart Fill

The main feature - convert your grocery list to a supermarket cart automatically.

### Product Verification

Before checkout, the extension shows:
- All products added successfully
- Items with substitutions
- Missing items (if any)
- Total cart value

### Smart Search

When exact products aren't found:
- Searches by ingredient name
- Considers package sizes
- Respects brand preferences
- Suggests closest matches

### Cart Management

From the extension popup:
- View current cart contents
- Remove incorrect items
- Add items manually
- Clear and start over

## Supermarket Support

### Mercadona

| Feature | Status |
|---------|--------|
| Product search | Working |
| Add to cart | Working |
| Price display | Working |
| Stock check | Working |

**Notes:**
- Works with mercadona.es online store
- Requires account for checkout
- Some products may be location-specific

### Carrefour (Coming Soon)

| Feature | Status |
|---------|--------|
| Product search | In Development |
| Add to cart | In Development |
| Price display | Planned |
| Stock check | Planned |

### Lidl (Coming Soon)

| Feature | Status |
|---------|--------|
| Product search | In Development |
| Add to cart | Planned |
| Price display | Planned |
| Stock check | Planned |

## Permissions Explained

The extension requests these permissions:

| Permission | Why Needed |
|------------|------------|
| Read/change site data on supermarket sites | To add products to your cart |
| Storage | Save your preferences locally |
| Tabs | Open supermarket websites |
| Cookies | Maintain supermarket login sessions |

### Privacy

- Credentials entered on supermarket sites (not our servers)
- No payment information ever stored
- Session data stored locally only
- Can clear all data anytime

## Troubleshooting

### Extension Not Working

1. **Check if enabled**: Go to `chrome://extensions/` and ensure it's on
2. **Update extension**: Check for updates in extension settings
3. **Clear cache**: Try clearing extension storage
4. **Reinstall**: Remove and reinstall the extension

### Cart Not Filling

1. **Check login**: Ensure you're logged into the supermarket
2. **Disable blockers**: Ad blockers may interfere
3. **Try manual mode**: Add items one by one
4. **Check internet**: Ensure stable connection

### Products Not Matching

1. **Update preferences**: Refine brand preferences
2. **Report issue**: Flag mismatched products
3. **Manual override**: Select correct product manually
4. **Check availability**: Product may be store-specific

### Slow Performance

1. **Reduce list size**: Try adding in batches
2. **Close other tabs**: Free up browser resources
3. **Check connection**: Slow internet affects speed
4. **Wait for updates**: Performance improvements ongoing

## Security Best Practices

### Protecting Your Data

1. **Use strong passwords** on supermarket accounts
2. **Log out** when using shared computers
3. **Keep extension updated** for security patches
4. **Review permissions** periodically

### What We Never Do

- Store your supermarket passwords
- Access your payment methods
- Make purchases without your confirmation
- Share your data with third parties

## Tips for Best Results

### 1. Verify Before Checkout

Always review your cart on the supermarket website before completing purchase.

### 2. Keep Lists Reasonable

- 20-30 items works best
- Very large lists may time out
- Split big shops into batches

### 3. Time Your Shopping

- Avoid peak hours (evenings, weekends)
- Better availability in mornings
- More delivery slots early in week

### 4. Prepare Your Account

- Have supermarket account ready
- Set delivery address in advance
- Add payment method beforehand

## FAQ

**Q: Is my supermarket login secure?**
A: Yes, you enter credentials directly on the supermarket website. We never see or store your password.

**Q: Why can't I find some products?**
A: Product catalogs vary by store and location. Some items may be exclusive or out of stock.

**Q: Can I use the extension on mobile?**
A: Currently Chrome desktop only. Mobile support is planned.

**Q: What happens if the extension crashes mid-cart?**
A: Your partially-filled cart remains on the supermarket site. Restart the extension to continue.

## Support

Having issues? Try:
1. Check this troubleshooting guide
2. Visit our [FAQ](./faq.md)
3. Contact support through the app
4. Report bugs via the extension menu

## Next Steps

- [Getting Started](./getting-started.md) - Start planning meals
- [Supermarket Integration](./supermarket-integration.md) - Learn about our data
- [FAQ](./faq.md) - Common questions
