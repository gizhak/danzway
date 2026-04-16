# Plan 004: High-End Mobile App UI Overhaul
Status: Complete

Reference: `appImage/ex_app.jpg`

---

## What the reference image shows

- **Navbar**: Centered script logo "DanzWay" + dancer icon. Minimal. No links visible.
- **Style Filter Row**: Horizontal scroll of circular image-bubbles with dance style labels (סלסה, באצ'טה, זוק…)
- **Feed Card**: Full-width social post — venue avatar + name, large rounded image with amber date badge pinned to corner, play-button overlay, action row (Interested / Share), full-width WhatsApp RSVP button, hashtag description.
- **Bottom Nav**: Floating, detached, rounded pill shape, 4 tabs: FEED · MAP · POST · PROFILE.

---

## Atomic Steps

- [ ] 1. Decide card layout style (Option A below) ← **main decision**
- [ ] 2. Decide bottom nav shape (Option B below)
- [ ] 3. Update global styles (font, background gradient)
- [ ] 4. Rebuild Navbar (centered logo, glass surface)
- [ ] 5. Build StyleFilterRow component (horizontal scroll bubbles)
- [ ] 6. Rebuild EventCard per chosen option
- [ ] 7. Rebuild BottomNav (floating, rounded)
- [ ] 8. Update Navbar glass + BottomNav glass to new spec
- [ ] 9. Verify build is clean

---

## Architectural Decisions

---

### Option A — EventCard Layout (THE main decision)

**A1: Social Feed Card (closest to reference image)**
- [ *] Full-width card, no grid.
- Top row: small venue avatar circle + venue name + date text + `···` menu.
- Large rounded image (16:9) with amber date badge pinned top-right corner.
- Action row below image: `♥ INTERESTED` · `➤ SHARE` (two equal amber outline buttons).
- Full-width amber gradient `WHATSAPP RSVP` button.
- Collapsed description + hashtags in amber below.
- Cards stacked vertically in a single-column feed — exactly like the reference.

**A2: Tall Hero Card with Glass Overlay (premium grid variant)**
- [ ] 2-column grid on desktop, single column on mobile.
- Card is tall (aspect ratio ~3:4). Image fills the entire card.
- Text (title, date, location, price) overlaid at bottom on a glass layer
  (`backdrop-filter: blur(20px)` + dark gradient).
- Amber price tag badge floats in the top-right corner of the image.
- Dance style badges across the bottom edge of the image.
- Hover: lift + amber glow (already started in plan 003 style).

**A3: Horizontal Scroll "Story" Cards + Detail Feed (hybrid)**
- [ ] Top section: horizontally scrollable compact cards (like Instagram Stories).
- Below: featured event displayed full-width (similar to A1 feed).
- More complex, two-zone layout; best for when there are many events.

---

### Option B — Floating Bottom Nav Shape

**B1: Rounded Pill (full pill shape)**
- [* ] `border-radius: 9999px`. Floats above the bottom edge with `margin: 0 1rem 1.25rem`.
- Exactly matches the reference — modern iOS/Android style.

**B2: Rounded Rectangle**
- [ ] `border-radius: 20px`. Floats with margin from bottom + sides.
- Slightly more structured; fits wider screens better.

---

## Global Style Changes (no decision needed — will apply regardless)

| Target | Current | New |
|--------|---------|-----|
| Body background | `radial-gradient(circle at top, #1a1a1c, #0f0f12)` | `radial-gradient(ellipse at top, #1c1c1f 0%, #080809 100%)` |
| Font | `system-ui, Segoe UI` | `'Inter'` loaded from Google Fonts (weights 400/600/700/800) |
| Navbar | Left-aligned logo, sticky | Centered logo, glass surface, minimal height |
| Glass spec | `blur(12px)` + `rgba(255,255,255,0.03)` | `blur(20px)` + `rgba(255,255,255,0.06)` border `1px solid rgba(255,255,255,0.1)` |

---

## New Component: StyleFilterRow

A horizontally scrollable row of circular bubble buttons, one per dance style.
Each bubble: circular image (or colored placeholder) + label below.
Active style: amber ring border.
Will sit between the Navbar and the event feed on HomePage.

No decision needed — will build this as part of the overhaul.

---

**Check one box for Option A and one for Option B, then tell me to proceed.**
