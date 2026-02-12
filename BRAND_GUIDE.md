# AssetFlow Brand Guide

## Professional Enterprise Design System

**Brand Name:** AssetFlow  
**Tagline:** Enterprise Asset Intelligence  
**Mission:** Empower IT teams with intelligent asset tracking and management  
**Core Values:** Trust, Intelligence, Efficiency, Security

---

## 🎨 Color Palette

### Primary Brand Colors

#### Enterprise Blue (#1B5E9B)
- **Usage:** Primary buttons, headings, navigation, brand elements
- **Represents:** Trust, technology, professionalism
- **Inspired by:** IBM, Microsoft, Dell corporate colors
- **CSS:** `bg-blue-700`, `text-blue-700`

#### Professional Sky Blue (#2E7BB4)
- **Usage:** Secondary elements, accents, hover states
- **Represents:** Clarity, intelligence, accessibility
- **CSS:** `bg-blue-600`

#### Security Teal (#00897B)
- **Usage:** Security features, locks, verification, trust elements
- **Represents:** Security, integrity, stability
- **CSS:** `bg-teal-700`

#### Deep Enterprise Blue (#0F2050)
- **Usage:** Dark backgrounds, footer, deep elements
- **Represents:** Depth, sophistication, authority
- **CSS:** `bg-blue-900`

### Status Colors

#### Success Green (#2E7D32)
- **Active Assets** - Applied to devices in use
- **Approved** - Status confirmations
- **Verified** - Validation indicators

#### Warning Orange (#F57C00)
- **Maintenance** - Assets needing attention
- **Pending** - Awaiting action
- **Caution** - Potential issues

#### Error Red (#C62828)
- **Critical** - Immediate attention required
- **Failures** - System errors
- **Deprecated** - No longer supported

#### Info Teal (#00897B)
- **Information** - Neutral notifications
- **Updates** - News/announcements
- **Helpful hints** - User guidance

### Neutral Palette

- **900 (#212121):** Text, headings
- **700 (#616161):** Secondary text, borders
- **500 (#9E9E9E):** Disabled states, placeholders
- **100 (#F5F5F5):** Backgrounds, surfaces
- **50 (#FAFAFA):** Light backgrounds

---

## 🖼️ Brand Logo

### Main Logo - AssetFlow
Represents interconnected asset network with nodes and flows.

**Specifications:**
- Primary: Enterprise Blue (#1B5E9B)
- Secondary: Security Teal (#00897B)
- Accent: Sky Blue (#2E7BB4)
- Minimum size: 120px
- Clear space: 20px on all sides

**Usage:**
- Header/navigation
- Documents
- Email signatures
- Social media

### Icon Logo - Compact
Simplified version for favicons and small spaces.

**Specifications:**
- Minimum size: 32px
- Works at all sizes
- Maintains brand colors
- High contrast

**Usage:**
- Favicon
- App icon
- Small badges
- Buttons

---

## 🎯 Professional Icons

### Asset Type Icons

All icons are professional SVGs with consistent stroke weight (2px).

#### Device Icons
- **Laptop** - Primary work devices
- **Server** - Infrastructure
- **Smartphone** - Mobile devices
- **Monitor** - Display devices
- **Printer** - Peripherals
- **Router** - Network equipment

### Status Icons

- **Active (✓)** - Check mark, green
- **Maintenance (⚙)** - Wrench/gear, orange
- **Deprecated (!)** - Warning symbol, purple
- **Archived (📦)** - Archive box, gray

### Action Icons

- **Add (+)** - Create new
- **Edit (✏)** - Modify
- **Delete (🗑)** - Remove
- **Search (🔍)** - Find

---

## 🌈 Color Usage Examples

### Buttons

```
Primary Button: Blue (#1B5E9B) on white
Secondary Button: Outline teal (#00897B)
Success Button: Green (#2E7D32) for confirmations
Danger Button: Red (#C62828) for destructive actions
```

### Status Indicators

```
✓ Active: Green (#2E7D32) with check icon
⚙ Maintenance: Orange (#F57C00) with wrench icon
! Deprecated: Purple (#7E57C2) with warning icon
📦 Archived: Gray (#616161) with box icon
```

### Alerts

```
Success: Green background, green border, green text
Warning: Orange background, orange border, orange text
Error: Red background, red border, red text
Info: Teal background, teal border, teal text
```

---

## 📝 Typography

### Font Family
**Primary:** Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif  
**Monospace:** JetBrains Mono, Monaco, Courier New, monospace

### Type Scale

| Level | Size | Weight | Usage |
|-------|------|--------|-------|
| H1 | 2.75rem | 700 | Page titles |
| H2 | 2.25rem | 700 | Section headers |
| H3 | 1.75rem | 600 | Subsections |
| H4 | 1.35rem | 600 | Small headers |
| Body | 1rem | 400 | Regular text |
| Small | 0.875rem | 400 | Captions |
| Tiny | 0.75rem | 500 | Metadata |
| Label | 0.875rem | 600 | Form labels |

### Text Colors
- **Primary text:** #212121 (H1-H4, body)
- **Secondary text:** #616161 (small, captions)
- **Tertiary text:** #757575 (metadata, hints)
- **Disabled text:** #BDBDBD (inactive elements)

---

## 🎨 Gradients

### Brand Gradients

**Primary Gradient**
```
linear-gradient(135deg, #0F2050 0%, #1B5E9B 50%, #00796B 100%)
```
*Usage: Hero sections, page backgrounds, premium elements*

**Secondary Gradient**
```
linear-gradient(135deg, #1B5E9B 0%, #2E7BB4 100%)
```
*Usage: Buttons, cards, accents*

**Teal Accent Gradient**
```
linear-gradient(135deg, #00897B 0%, #4DB6AC 100%)
```
*Usage: Security features, secondary buttons*

**Success Gradient**
```
linear-gradient(135deg, #2E7D32 0%, #66BB6A 100%)
```
*Usage: Success states, confirmations*

---

## 🎭 Component Styling

### Buttons

**Primary Button**
- Background: #1B5E9B
- Text: White
- Hover: #0F3D6E (darker)
- Border-radius: 0.5rem
- Font-weight: 600

**Secondary Button**
- Background: Transparent
- Border: 2px solid #00897B
- Text: #00897B
- Hover: Background #F1F8F8
- Border-radius: 0.5rem

### Input Fields

- Border: 1px solid #E0E0E0
- Focus border: 2px solid #1B5E9B
- Background: White
- Placeholder: #BDBDBD
- Border-radius: 0.5rem
- Font: Inter 1rem regular

### Cards

- Background: White
- Border: 1px solid #E0E0E0
- Shadow: elevation2 (professional subtle shadow)
- Border-radius: 0.75rem
- Padding: 1.5rem

---

## 💫 Animations & Transitions

- **Fast:** 150ms (quick feedback)
- **Base:** 300ms (standard transitions)
- **Slow:** 500ms (emphasis)
- **Smooth:** 400ms (polished feel)

**Easing:** cubic-bezier(0.4, 0, 0.2, 1)

---

## 🔧 Implementation

### Color System in Code

```javascript
// Using the professional color palette
import { professionalColors } from '@/config/brandIdentity';

// Primary brand blue
const primaryColor = "#1B5E9B"; // or use color reference
const secondaryColor = "#00897B"; // Teal

// Status colors
const statusColors = {
  active: "#2E7D32",
  maintenance: "#F57C00",
  error: "#C62828",
  deprecated: "#7E57C2",
};
```

### Icon System

```jsx
// Using professional icons instead of emoji
import { ProfessionalIcon, StatusBadge, AssetTypeLabel } from '@/components/ProfessionalIcons';

// Asset type icon
<AssetTypeLabel category="Laptop" size="md" />

// Status badge
<StatusBadge status="active" />

// Single icon
<ProfessionalIcon type="laptop" size="lg" color="primary" />
```

### Brand Header

```jsx
import { BrandHeader } from '@/components/ProfessionalIcons';

<BrandHeader showText={true} />
```

---

## ✨ Design Principles

1. **Professional First** - Enterprise-grade quality in every pixel
2. **Consistent** - Same colors, fonts, spacing across all pages
3. **Accessible** - High contrast, readable text, intuitive icons
4. **Efficient** - Clear information hierarchy, reduced clutter
5. **Trustworthy** - Secure aesthetics, confident colors
6. **Modern** - Current design trends, smooth interactions
7. **Unique** - Distinctive brand identity, recognizable elements

---

## 🎯 Asset Tracking Theme

The design reflects the core mission of IT Asset Tracking:

- **Blue:** Trust in data management, corporate stability
- **Teal:** Security and vault protection
- **Network Design:** Interconnected assets flowing through system
- **Icons:** Specific device types (laptop, server, phone, etc.)
- **Status Colors:** Quick visual recognition of asset state

---

## 📱 Responsive Design

The professional design scales beautifully:

- **Mobile:** Compact, touch-friendly, clear hierarchy
- **Tablet:** Optimized spacing, readable typography
- **Desktop:** Full feature set, detailed information architecture

---

## 🚀 Getting Started

1. **Import brand colors** in component files
2. **Replace emoji icons** with ProfessionalIcon component
3. **Use BrandIdentity** for consistent styling
4. **Apply gradients** for premium look
5. **Follow typography** scale for consistent headings/text
6. **Use status colors** for asset states

---

## 📞 Design Questions?

For consistency, refer to:
- Brand Colors: `brandIdentity.js` → `professionalColors`
- Icons: `ProfessionalIcons.jsx` → Component library
- Theme: `theme.js` → Design tokens
- This Guide: Reference for usage examples

---

**Professional Design System**  
AssetFlow - Enterprise Asset Intelligence  
Created: February 12, 2026  
Status: ✅ Production Ready
