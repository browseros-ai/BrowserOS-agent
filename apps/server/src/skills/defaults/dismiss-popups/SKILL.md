---
name: dismiss-popups
description: Detect and dismiss cookie consent banners, newsletter popups, overlay dialogs, and chat widgets that block page interaction. Use when popups or overlays are interfering with a task.
metadata:
  display-name: Dismiss Popups
  enabled: "true"
  version: "1.0"
---

# Dismiss Popups

## When to Use

Activate when cookie banners, newsletter signup popups, age verification gates, chat widgets, or other overlay dialogs are blocking interaction with the page. Also use proactively before other tasks if the page is likely to have obstructing overlays.

## Steps

1. **Take a snapshot** using `take_snapshot` to identify visible popups and overlays.

2. **Identify the popup type** and apply the appropriate dismissal strategy:

### Cookie Consent Banners
- Look for buttons labeled: "Accept", "Accept All", "Agree", "OK", "Got it", "Allow All"
- Use `click` on the accept/dismiss button

### Newsletter/Email Popups
- Look for close buttons: "X", "Close", "No thanks", "Maybe later"
- Use `click` on the close/dismiss element
- If no close button is visible, try pressing Escape using `press_key`

### Chat Widgets
- Look for minimize or close buttons on chat bubbles
- Use `click` to minimize the widget

### General Overlay Dialogs
- Try `press_key` with Escape first — many modals close on Escape
- Look for close buttons in the top-right corner
- Some modals close when clicking the backdrop overlay

3. **Verify dismissal.** Take another `take_snapshot` to confirm the popup is gone and the page content is accessible.

4. **Handle persistent popups.** If a popup returns after dismissal, use `evaluate_script` to remove the overlay element from the DOM and restore page scrolling.

## Tips

- Always try the Escape key first — it's the fastest universal dismiss method.
- Some popups have a delay before appearing. If a task is interrupted by a popup mid-flow, dismiss it and continue.
- Do not dismiss security-critical dialogs (2FA prompts, payment confirmations) without user consent.
