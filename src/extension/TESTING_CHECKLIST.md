# MealMate Extension - Testing Checklist

This checklist ensures the extension is ready for Chrome Web Store submission.

## Pre-Submission Testing

### Installation

- [ ] Extension loads from unpacked (chrome://extensions > Developer mode > Load unpacked)
- [ ] No console errors on load
- [ ] Extension icon appears in toolbar
- [ ] Popup opens when clicking extension icon
- [ ] All UI elements render correctly

### Authentication & Sync

- [ ] Extension detects when backend is not configured
- [ ] Can configure backend URL in settings
- [ ] Can authenticate with backend API
- [ ] Grocery list syncs from backend
- [ ] Sync button works correctly
- [ ] Handles network errors gracefully
- [ ] Shows appropriate error messages

### DIA (www.dia.es)

- [ ] Content script injects on DIA website
- [ ] Detects when user is logged in
- [ ] Detects when user is NOT logged in (shows warning)
- [ ] Can search for products
- [ ] Can add single product to cart
- [ ] Can add multiple products to cart
- [ ] Handles out-of-stock products
- [ ] Finds alternatives for unavailable products
- [ ] Progress updates show in popup
- [ ] Can pause automation
- [ ] Can resume automation
- [ ] Can cancel automation
- [ ] Cart count updates correctly on website

### Mercadona (tienda.mercadona.es)

- [ ] Content script injects on Mercadona website
- [ ] Detects when user is logged in
- [ ] Detects when user is NOT logged in (shows warning)
- [ ] Handles postal code selection modal
- [ ] Can search for products
- [ ] Can add single product to cart
- [ ] Can add multiple products to cart
- [ ] Handles out-of-stock products
- [ ] Finds alternatives for unavailable products
- [ ] Progress updates show in popup
- [ ] Can pause automation
- [ ] Can resume automation
- [ ] Can cancel automation
- [ ] Cart count updates correctly on website

### Carrefour (www.carrefour.es)

- [ ] Content script injects on Carrefour website
- [ ] Detects when user is logged in
- [ ] Detects when user is NOT logged in (shows warning)
- [ ] Can search for products
- [ ] Can add single product to cart
- [ ] Can add multiple products to cart
- [ ] Handles out-of-stock products
- [ ] Finds alternatives for unavailable products
- [ ] Progress updates show in popup
- [ ] Can pause automation
- [ ] Can resume automation
- [ ] Can cancel automation
- [ ] Cart count updates correctly on website

### Popup UI

- [ ] List tab shows grocery items correctly
- [ ] Items grouped by category
- [ ] Category names display in Spanish
- [ ] Can check/uncheck items
- [ ] Item count updates correctly
- [ ] Estimated total displays correctly
- [ ] Supermarket selector works
- [ ] Status tab shows automation progress
- [ ] Progress bar animates smoothly
- [ ] Success/failure icons appear correctly
- [ ] Settings tab loads
- [ ] Can change default supermarket
- [ ] Can toggle notifications
- [ ] Settings persist after popup close
- [ ] Settings persist after browser restart

### Error Handling

- [ ] Network timeout shows error message
- [ ] Backend unavailable shows error message
- [ ] Invalid API key shows error message
- [ ] Product not found handles gracefully
- [ ] Cart full/limit reached handles gracefully
- [ ] Session expired handles gracefully
- [ ] Extension recovers from errors without crash

### Performance

- [ ] Popup opens in < 500ms
- [ ] List renders quickly with 50+ items
- [ ] Automation doesn't freeze the page
- [ ] Memory usage stays reasonable
- [ ] No memory leaks after extended use

### Localization

- [ ] All UI text in Spanish
- [ ] No hardcoded English strings visible
- [ ] Prices display in EUR format
- [ ] Dates display in Spanish format

### Privacy & Security

- [ ] Extension doesn't store supermarket credentials
- [ ] Chrome storage cleared when extension removed
- [ ] No data sent to unexpected domains
- [ ] API calls use HTTPS only
- [ ] No sensitive data in console logs

### Edge Cases

- [ ] Empty grocery list shows appropriate message
- [ ] Very long product names truncate correctly
- [ ] Very long grocery list scrolls correctly
- [ ] Special characters in product names handled
- [ ] Works with browser zoom (100%, 125%, 150%)
- [ ] Works in Chrome incognito mode (if permissions allow)

## Automated Tests (if applicable)

- [ ] Unit tests pass (`npm test`)
- [ ] Type checking passes (`npm run type-check`)
- [ ] Linting passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)

## Final Checks

- [ ] manifest.json has correct version (1.0.0)
- [ ] manifest.json has correct name and description
- [ ] Icons are present and correct sizes
- [ ] No development/debug code in production
- [ ] No console.log statements (or behind debug flag)
- [ ] ZIP file is under 2MB limit
- [ ] ZIP file doesn't include source maps

## Store Listing Ready

- [ ] 5 screenshots prepared
- [ ] Promotional images prepared (if submitting)
- [ ] Privacy policy published online
- [ ] Store description finalized
- [ ] Support email configured
- [ ] Website ready for traffic

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | | | |
| QA Tester | | | |
| Product Owner | | | |

## Notes

_Add any testing notes, known issues, or observations here:_

```
```

---

**Tested on:**
- Chrome Version: ___
- OS: ___
- Date: ___
