---
name: WorkDesk Production System
colors:
  surface: '#10141a'
  surface-dim: '#10141a'
  surface-bright: '#353940'
  surface-container-lowest: '#0a0e14'
  surface-container-low: '#181c22'
  surface-container: '#1c2026'
  surface-container-high: '#262a31'
  surface-container-highest: '#31353c'
  on-surface: '#dfe2eb'
  on-surface-variant: '#c0c7d4'
  inverse-surface: '#dfe2eb'
  inverse-on-surface: '#2d3137'
  outline: '#8b919d'
  outline-variant: '#414752'
  surface-tint: '#a2c9ff'
  primary: '#a2c9ff'
  on-primary: '#00315c'
  primary-container: '#58a6ff'
  on-primary-container: '#003a6b'
  inverse-primary: '#0060aa'
  secondary: '#c2c7d0'
  on-secondary: '#2c3138'
  secondary-container: '#42474f'
  on-secondary-container: '#b1b5bf'
  tertiary: '#ffba42'
  on-tertiary: '#432c00'
  tertiary-container: '#da9600'
  on-tertiary-container: '#4f3400'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d3e4ff'
  primary-fixed-dim: '#a2c9ff'
  on-primary-fixed: '#001c38'
  on-primary-fixed-variant: '#004882'
  secondary-fixed: '#dee2ec'
  secondary-fixed-dim: '#c2c7d0'
  on-secondary-fixed: '#171c23'
  on-secondary-fixed-variant: '#42474f'
  tertiary-fixed: '#ffddaf'
  tertiary-fixed-dim: '#ffba42'
  on-tertiary-fixed: '#281800'
  on-tertiary-fixed-variant: '#614000'
  background: '#10141a'
  on-background: '#dfe2eb'
  surface-variant: '#31353c'
  surface-primary: '#0D1117'
  surface-secondary: '#161B22'
  surface-elevated: '#1C2128'
  border-default: '#30363D'
  text-primary: '#E6EDF3'
  text-secondary: '#8B949E'
  status-success: '#3FB950'
  status-warning: '#D29922'
  status-danger: '#F85149'
typography:
  page-title:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  section-title:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  card-title:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  caption:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 14px
  mono:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  container-margin: 24px
  gutter: 16px
  sidebar-width: 260px
  context-panel-width: 300px
  input-height: 32px
  touch-target: 40px
---

## Brand & Style

This design system is engineered for high-utility productivity, functioning as an "organizational operating system." The brand personality is **utilitarian, precise, and authoritative**, designed to disappear and let the user's data take center stage. It targets technical and creative professionals who require a high-density, low-friction environment for institutional memory and collaboration.

The visual style is a refined **Modern Corporate** aesthetic with a focus on structural integrity. It rejects ephemeral trends like glassmorphism or neumorphism in favor of a "Information-First" approach. Depth is communicated through subtle tonal shifting rather than heavy shadows, ensuring the UI remains fast and legible during long-duration work sessions. The emotional goal is to evoke a sense of **stability and professional focus**.

## Colors

The palette is strictly dark-mode, optimized for reduced eye strain in professional environments. 

- **Foundational Neutrals:** The background layers use a three-tier depth system (`#0D1117` for base, `#161B22` for sidebars/secondary areas, and `#1C2128` for cards and overlays).
- **Accents & Semantics:** The primary accent (`#58A6FF`) is used sparingly for interactive cues and focus states. Semantic colors (Success, Warning, Danger) are desaturated to maintain harmony with the dark theme while remaining clear indicators of state.
- **Contrast:** Borders (`#30363D`) are essential for defining structure in a dark environment where shadows are less effective. Text hierarchy is enforced through a stark contrast between Primary and Secondary text tokens.

## Typography

This design system utilizes **Inter** exclusively to ensure maximum legibility and a systematic, utilitarian feel. The scale is intentionally compact to support high-density layouts common in complex data applications.

- **Scale:** Large, oversized headings are avoided. The `page-title` is capped at 24px to preserve vertical space.
- **Density:** Body text defaults to 14px for standard reading and 13px for dense data environments (like the sidebar or table cells).
- **Hierarchy:** Weight is used as the primary differentiator rather than size. Section headers use semi-bold (`600`) weights at smaller sizes to maintain structural clarity without breaking the flow of content.

## Layout & Spacing

The layout is a **Fixed Shell with Fluid Content**. The application structure consists of a persistent left sidebar (260px) and a main content area that expands. A secondary right context panel is used for metadata and version control.

- **Rhythm:** A strict 4px base unit drives all spacing (4, 8, 12, 16, 24, 32, 48).
- **Density:** The system prioritizes vertical density. Elements like table rows and list items are compact (32px or 40px height) to maximize information visibility.
- **Breakpoints:**
    - **Desktop (1280px+):** Full three-pane view (Sidebar + Editor + Metadata).
    - **Tablet (768px - 1279px):** Sidebar becomes collapsible; Metadata panel moves to an overlay or bottom sheet.
    - **Mobile (<768px):** Single-column focus; Sidebar and Metadata panels accessed via drawer menus.

## Elevation & Depth

In this design system, depth is primarily conveyed through **Tonal Layering** and **Low-Contrast Outlines** rather than physical shadows.

- **Level 0 (Base):** Primary Background (`#0D1117`) used for the main workspace background.
- **Level 1 (In-set):** Secondary Background (`#161B22`) used for sidebars and navigation footers.
- **Level 2 (Surface):** Elevated Surfaces (`#1C2128`) used for cards, list items, and interactive modules.
- **Level 3 (Overlay):** Used for Modals and Dropdowns. These use a subtle 1px border (`#30363D`) and a minimal, highly diffused shadow (0px 8px 24px rgba(0,0,0,0.5)) to separate them from the workspace.

No blurs or translucency are permitted. All layers must be opaque to ensure performance and clarity.

## Shapes

The shape language is **Soft-Sharp**. It uses small corner radii to avoid the aggressive feel of 90-degree corners while maintaining a professional, "engineered" aesthetic.

- **Default (4px):** Used for buttons, input fields, and small UI components.
- **Large (6px):** Used for cards, modals, and container elements.
- **Full (999px):** Used exclusively for status badges and presence indicators.

Avoid overly rounded or "bubbly" shapes. Rectilinear forms should dominate to emphasize the grid-based architecture of the system.

## Components

### Buttons
- **Primary:** Background `Accent`, Text `Surface-Primary`. Solid fill, no gradient.
- **Secondary:** Background `Elevated-Surface`, Border `Default`, Text `Primary`.
- **Ghost:** Transparent background, visible text only. Background becomes `Secondary-Background` on hover.
- **Danger:** Transparent background with `Status-Danger` text/border, or solid `Status-Danger` for destructive actions.

### Form Elements
- **Input Fields:** 32px height. `Secondary-Background` fill with `Default` border. Focus state uses 1px `Accent` border with a subtle outer glow.
- **Toggles:** Minimalist switch design. `Accent` for ON, `Default-Border` for OFF.

### Data Display
- **Tables:** High-density. 32px row height. `Default` border only on the bottom of rows (no vertical grid lines). Hover state highlights the entire row in `Elevated-Surface`.
- **Chips/Badges:** Small (12px label), 2px radius. Low-saturation background tints derived from semantic colors.

### Overlays
- **Modals:** Centered, 6px radius, `Elevated-Surface` background. Must include a clear "X" close action and a dimming backdrop (`#000000` at 50% opacity).
- **Context Menus:** 4px radius, tight vertical padding. Item hover uses `Accent` background with white text or a subtle grey highlight.

### Navigation
- **Tabs:** Underline style for page-level navigation; pill-style for sub-filters. Active state uses `Accent` color for the indicator.
- **Sidebar Items:** 32px height, 8px horizontal padding. Icons should be 16x16px and use `Secondary-Text` color unless active.