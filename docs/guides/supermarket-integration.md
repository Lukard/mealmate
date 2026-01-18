# Supermarket Integration Guide

Learn how Meal Automation connects with Spanish supermarkets to provide real-time pricing and automated shopping.

## Supported Supermarkets

### Currently Available

| Supermarket | Product Data | Price Updates | Cart Automation |
|-------------|--------------|---------------|-----------------|
| Mercadona | Yes | Daily | Yes |

### Coming Soon

| Supermarket | Expected | Status |
|-------------|----------|--------|
| Carrefour | Q2 2026 | In Development |
| Lidl | Q2 2026 | In Development |
| Dia | Q3 2026 | Planned |
| Alcampo | Q3 2026 | Planned |

### Future Roadmap

- El Corte Ingles Supermercado
- Eroski
- Consum
- Hipercor
- Aldi

## How Integration Works

### Product Data Collection

We regularly update our product database with:

1. **Product Information**
   - Name and description
   - Brand and manufacturer
   - Package size and units
   - Category and subcategory

2. **Pricing Data**
   - Regular price
   - Promotional price
   - Price per unit (kg, liter)
   - Price history

3. **Availability**
   - In-stock status
   - Store availability
   - Online availability

### Price Freshness

| Data Type | Update Frequency |
|-----------|------------------|
| Prices | Daily |
| Availability | Hourly (peak times) |
| New products | Weekly |
| Promotions | Real-time when detected |

## Setting Up Your Supermarket

### Selecting Preferred Stores

1. Go to **Settings > Supermarkets**
2. Select your primary supermarket
3. Optionally add backup supermarkets
4. Set your delivery postal code

### Store-Specific Settings

For each supermarket, configure:

- **Delivery vs. Pickup**: Your preference
- **Store Location**: For pickup orders
- **Delivery Time**: Preferred slots
- **Minimum Order**: Awareness setting

## Price Comparison

### How It Works

When you generate a grocery list:

1. Ingredients are matched to products
2. Prices fetched from all your supermarkets
3. Comparison shown per item and total
4. Recommendations based on best value

### Comparison View

```
Item: Whole Milk 1L
┌─────────────┬─────────┬──────────┐
│ Supermarket │  Price  │  Status  │
├─────────────┼─────────┼──────────┤
│ Mercadona   │  €0.89  │ In Stock │
│ Carrefour   │  €0.95  │ In Stock │
│ Lidl        │  €0.79  │ In Stock │
└─────────────┴─────────┴──────────┘
Best Price: Lidl (€0.79)
```

### Smart Recommendations

We consider:
- Total basket price (not just per item)
- Delivery costs
- Minimum order thresholds
- Item availability
- Your store preferences

## Product Matching

### How We Match Ingredients to Products

1. **Ingredient Normalization**
   - "tomatoes" → standardized ingredient entity
   - Account for regional variations

2. **Product Search**
   - Search supermarket catalog
   - Filter by category
   - Rank by relevance

3. **Quantity Calculation**
   - Recipe needs 200g chicken
   - Store sells 500g packs
   - System selects appropriate pack

4. **Quality Selection**
   - Respect your brand preferences
   - Consider budget settings
   - Match quality tier

### Handling Variations

| Ingredient | Possible Matches |
|------------|------------------|
| Tomatoes | Fresh tomatoes, Cherry tomatoes, Canned tomatoes |
| Olive Oil | Extra virgin, Virgin, Regular, Spray |
| Chicken | Breast, Thigh, Whole, Minced |

You can set preferences for:
- Preferred brands
- Quality tier (budget/standard/premium)
- Package sizes
- Organic preference

## Troubleshooting

### "Product not found"

Possible causes:
- Product out of stock
- Seasonal item
- Store-specific item

Solutions:
- Check alternative stores
- Accept suggested substitutes
- Add manually to list

### "Price seems wrong"

- Prices update daily
- Check for active promotions
- Report incorrect pricing via app

### "Store not available"

- Check your postal code settings
- Verify store delivery zone
- Try nearby store location

## Privacy & Data

### What We Access

- Public product listings
- Public pricing information
- Your saved preferences (local)

### What We Don't Access

- Your supermarket account
- Your payment information
- Your order history (unless you share)

### Data Storage

- Product data cached locally
- Preferences stored encrypted
- No personal data shared with supermarkets

## Tips for Best Results

### 1. Keep Preferences Updated

Update your supermarket preferences when:
- You move to a new area
- A new store opens nearby
- Your shopping habits change

### 2. Check Promotions

- Enable promotion notifications
- Review weekly deals
- Adjust meal plans for savings

### 3. Combine Orders

- Meet minimum order thresholds
- Reduce delivery fees
- Plan for the full week

## Next Steps

- [Browser Extension Setup](./browser-extension.md) - Enable cart automation
- [Getting Started](./getting-started.md) - Return to basics
- [FAQ](./faq.md) - Common questions
