---
name: Sydney Horizon
colors:
  surface: '#f9f9fc'
  surface-dim: '#dadadc'
  surface-bright: '#f9f9fc'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f6'
  surface-container: '#eeeef0'
  surface-container-high: '#e8e8ea'
  surface-container-highest: '#e2e2e5'
  on-surface: '#1a1c1e'
  on-surface-variant: '#414750'
  inverse-surface: '#2f3133'
  inverse-on-surface: '#f0f0f3'
  outline: '#717881'
  outline-variant: '#c1c7d1'
  surface-tint: '#13629b'
  primary: '#00436f'
  on-primary: '#ffffff'
  primary-container: '#005b94'
  on-primary-container: '#a9d2ff'
  inverse-primary: '#9acbff'
  secondary: '#7c5800'
  on-secondary: '#ffffff'
  secondary-container: '#feb700'
  on-secondary-container: '#6b4b00'
  tertiary: '#41413d'
  on-tertiary: '#ffffff'
  tertiary-container: '#595853'
  on-tertiary-container: '#d0cec8'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d0e4ff'
  primary-fixed-dim: '#9acbff'
  on-primary-fixed: '#001d34'
  on-primary-fixed-variant: '#004a79'
  secondary-fixed: '#ffdea8'
  secondary-fixed-dim: '#ffba20'
  on-secondary-fixed: '#271900'
  on-secondary-fixed-variant: '#5e4200'
  tertiary-fixed: '#e5e2dc'
  tertiary-fixed-dim: '#c9c6c1'
  on-tertiary-fixed: '#1c1c18'
  on-tertiary-fixed-variant: '#474743'
  background: '#f9f9fc'
  on-background: '#1a1c1e'
  surface-variant: '#e2e2e5'
typography:
  display-lg:
    fontFamily: Montserrat
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Montserrat
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Montserrat
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.2'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
---

## Brand & Style

The design system is built to capture the duality of Sydney: the structural brilliance of its landmarks and the fluid, organic energy of its coastline. The brand personality is **vibrant, adventurous, and authoritative**, positioning the app as a trusted local companion for high-energy exploration.

The visual style follows a **Modern Minimalism with Tactile Accents**. It utilizes expansive whitespace to ensure information density remains readable, while incorporating subtle glassmorphism and soft shadows to provide depth. The interface feels "airy" like a sea breeze but remains grounded through a rigorous modular grid, ensuring that complex travel itineraries and maps feel organized and manageable.

## Colors

The palette is derived from the natural and architectural icons of Sydney.
- **Primary (Pacific Blue):** A deep, reliable blue used for primary actions, navigation headers, and active states. It represents the harbor and the ocean.
- **Secondary (Solar Gold):** A vibrant yellow used sparingly for highlights, "Must See" badges, and star ratings. It injects the warmth of the Australian sun.
- **Tertiary (Opera Cream):** A sophisticated off-white used as the main background color. It is softer on the eyes than pure white and references the ceramic tiles of the Sydney Opera House.
- **Neutral (Harbor Grey):** A high-contrast charcoal for typography and borders, ensuring WCAG AA accessibility for all travel guides.
- **Accent (Teal):** Used for interactive maps and water-related activities.

## Typography

This design system uses a dual-sans-serif approach to balance personality with legibility. 
- **Montserrat** is used for headlines and display text. Its geometric nature gives a modern, bold architectural feel, perfect for city titles and major landmarks.
- **Inter** is the workhorse for all body copy, itineraries, and technical data. It provides exceptional legibility for the Korean script (Hangul) at smaller sizes.

**Weight Usage:**
- Use **Bold (700)** for primary page headers.
- Use **SemiBold (600)** for sub-section titles and button labels.
- Use **Regular (400)** for all descriptive travel content to ensure high readability during long reading sessions.

## Layout & Spacing

The layout utilizes a **12-column Fluid Grid** for desktop and a **4-column grid** for mobile. 
- **Modular Blocks:** Content is organized into "Cards" that span 3, 4, or 6 columns depending on the information type (e.g., 3 columns for quick tips, 6 columns for itinerary highlights).
- **Safe Zones:** Generous 40px margins on desktop create a premium, editorial feel, preventing the content from feeling "crowded."
- **Vertical Rhythm:** A base-8 spacing system is strictly followed. Components are separated by 32px or 48px blocks to maintain a clear visual hierarchy between different "neighborhoods" or "days" in a travel guide.

## Elevation & Depth

To maintain the "vibrant yet organized" feel, this design system uses **Tonal Layering** combined with **Ambient Shadows**.

1.  **Level 0 (Base):** Opera Cream (#F9F6F0). All main content lives here.
2.  **Level 1 (Cards):** Pure White (#FFFFFF) with a very soft, 15% opacity Pacific Blue shadow. This creates a "floating" effect for recommendations and schedules.
3.  **Level 2 (Modals/Overlays):** Use a Backdrop Blur (12px) for mobile navigation and filters to maintain the airy, transparent feel of the coastal theme.
4.  **Borders:** Use 1px solid borders in a lightened version of Pacific Blue (10% opacity) for input fields and list separators to maintain structure without visual noise.

## Shapes

The shape language is **Rounded**, reflecting the soft curves of the Sydney Opera House sails and the rolling waves of Bondi Beach.
- **Default (8px):** Used for standard buttons, input fields, and small thumbnails.
- **Large (16px):** Used for primary recommendation cards and map containers.
- **Extra Large (24px):** Used for hero sections and main "Container" wrappers for itinerary days.

## Components

- **Primary Buttons:** High-contrast Pacific Blue background with White text. Rounded (8px). Hover state shifts to a slightly darker shade with a 2px Solar Gold bottom border.
- **Recommendation Cards:** Large image-top cards with 16px corner radius. Title in Montserrat SemiBold. Include a "Solar Gold" star icon for ratings in the top right corner.
- **Itinerary Schedules:** A vertical "Timeline" component. The line is a 2px dashed Pacific Blue stroke. Each "Stop" is a Level 1 elevation white card.
- **Map Markers:** Teardrop shapes in Primary Blue for general sites; Solar Gold for "Top Picks."
- **Badges/Chips:** Used for category tags (e.g., "Beach," "Dining," "Culture"). Use low-saturation background tints of the primary blue with high-contrast text.
- **Input Fields:** Clean, white backgrounds with 1px Harbor Grey borders. On focus, the border thickens to 2px Pacific Blue.
- **Bottom Navigation (Mobile):** A blurred "Glass" effect bar with simplified icons, ensuring the vibrant imagery of the app remains visible behind the UI.