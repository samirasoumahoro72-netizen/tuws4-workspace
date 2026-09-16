---
name: Deep Tech Intelligence Workspace
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#43474d'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#74777e'
  outline-variant: '#c3c6ce'
  surface-tint: '#49607c'
  primary: '#001428'
  on-primary: '#ffffff'
  primary-container: '#0f2942'
  on-primary-container: '#7991af'
  inverse-primary: '#b0c9e8'
  secondary: '#545f73'
  on-secondary: '#ffffff'
  secondary-container: '#d5e0f8'
  on-secondary-container: '#586377'
  tertiary: '#260b00'
  on-tertiary: '#ffffff'
  tertiary-container: '#471a00'
  on-tertiary-container: '#ea6803'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d1e4ff'
  primary-fixed-dim: '#b0c9e8'
  on-primary-fixed: '#011d35'
  on-primary-fixed-variant: '#314863'
  secondary-fixed: '#d8e3fb'
  secondary-fixed-dim: '#bcc7de'
  on-secondary-fixed: '#111c2d'
  on-secondary-fixed-variant: '#3c475a'
  tertiary-fixed: '#ffdbca'
  tertiary-fixed-dim: '#ffb690'
  on-tertiary-fixed: '#341100'
  on-tertiary-fixed-variant: '#783200'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
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
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
  data-mono:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: -0.01em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  space-2xs: 0.125rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
  space-2xl: 2rem
  space-3xl: 3rem
  gutter-desktop: 1.5rem
  gutter-mobile: 1rem
  sidebar-width: 16.25rem
  sidebar-collapsed: 4.5rem
  header-height: 4rem
---

## Brand & Style

This design system establishes a high-trust, mission-critical SaaS enterprise interface tailored for artificial intelligence and digital services orchestration. The visual language balances institutional enterprise authority with sharp technological precision. 

The design combines **Corporate Modern** rigor with **Tactile Functionalism**:
- **Clarity and Density**: High information throughput without cognitive friction. Spacing, typography, and line work are orchestrated for dashboards, analytics suites, workflow pipelines, and audit logs.
- **Precision Engineering**: Micro-borders, controlled depth, and crisp structural grids evoke the feel of an advanced command console rather than a generic consumer application.
- **Controlled Accenting**: Restraint is central. Vivid color is deployed strictly for intent-driven interactions, real-time alert vectors, and definitive workflow transitions.

## Colors

The system uses a strict semantic color hierarchy configured for clarity, executive presentation, and high visual endurance across extended workstation sessions.

### Primary Spectrum: Deep Tech & Executive Navy
- **Deep Navy `#0F2942`**: Primary brand surface, enterprise dark sidebars, primary table headers, and high-impact structural panels.
- **Cobalt Anchor `#1E40AF`**: Selected states, focused navigation elements, active telemetry tabs.
- **Tech Blue `#2563EB`**: Interactive brand highlights, secondary CTA outlines, informational status badges, and link focus.
- **Electric Soft `#3B82F6`**: Chart metrics, real-time pulse indicators, selected toggle switches.
- **Atmospheric Blue Tint `#EFF6FF`**: Light mode container fill for selected table rows, active filters, and informational message containers.

### Neutral Spectrum: Modern Slate Matrix
- **Base Canvas `#F8FAFC`**: Universal workspace background offering soft contrast without stark ocular fatigue.
- **Sub-surface `#F1F5F9`**: Input well fills, secondary card layers, data grid header rows.
- **Structural Border `#E2E8F0`**: Structural hair-thin separation, card boundaries, and container framing.
- **Muted Neutral `#94A3B8`**: Placeholder typography, inactive icons, auxiliary timeline lines.
- **Secondary Body `#64748B`**: Metadata labels, column headers, timestamps, contextual hints.
- **Graphite Solid `#1E293B`**: Primary reading typography, dominant iconography, top bar title locks.

### Action & Alert Spectrum: Calibrated Energetic Amber
- **Action Orange `#F97316`**: Primary system actions (`+ Nouveau projet`, `Valider l'itération`, `Déployer`).
- **Deep Burn `#EA580C`**: Hover and pressed interaction states for primary conversion triggers.
- **Amber Glow Surface `#FFF7ED`**: Alert backdrops, critical task warning containers, highlight badges.

### Semantic Status Ensembles
- **Validé (Success)**: Surface `#ECFDF5`, Border `#A7F3D0`, Text `#065F46`.
- **En cours (Info / Processing)**: Surface `#EFF6FF`, Border `#BFDBFE`, Text `#1E40AF`.
- **En retard / Bloquant (Destructive / Critical)**: Surface `#FEF2F2`, Border `#FECACA`, Text `#991B1B`.
- **Modification demandée (Review / Warning)**: Surface `#FFF7ED`, Border `#FED7AA`, Text `#C2410C`.

## Typography

The typographic pairing pairs geometric character with hyper-legible tabular performance.

- **Headings (Plus Jakarta Sans)**: Delivers a clean, authoritative edge for strategic executive titles, modal headers, and KPI numerals.
- **Body & Tabular Data (Inter)**: Handles complex data density, nested task structures, and continuous reading without distraction. Numeric sequences use `tnum` (tabular numbers) to keep financial values, operational latency, and AI confidence scores aligned across rows.
- **Micro-Labels & Metadata (Inter Upper/Medium)**: Form field headers, state pills, and telemetry trackers rely on 11px to 12px scales with slight letter-spacing (`0.02em` to `0.04em`) to ensure instant legibility against neutral backgrounds.

## Layout & Spacing

The workspace uses an asymmetric split-screen layout anchored by an enterprise navigation framework.

### Spatial Architecture
- **Navigation Shell**: Primary navigation resides in a fixed left panel (`16.25rem` / 260px width) in deep `#0F2942`. A persistent top operational bar (`4rem` / 64px height) contains search, project selectors, real-time notification streams, and profile actions.
- **12-Column Responsive Matrix**: The central workspace utilizes a fluid 12-column grid with dynamic gutters:
  - **Desktop (>= 1280px)**: 24px gutters, max-width fluid with 32px safe horizontal frame margins.
  - **Tablet (768px – 1279px)**: 16px gutters, collapsible sidebar (converts to 72px icon strip), fluid content layout.
  - **Mobile (< 768px)**: 4-column flow, 16px lateral padding, sidebar collapses to off-canvas slide-out sheet.

### Spacing Cadence
All spatial distribution follows an 8px grid cadence, with 4px intervals for internal component alignments (chips, icon-to-label gaps, and pill tags). High-density data tables compress to 32px or 40px row heights, while strategic dashboard summaries breathe with 24px internal card padding.

## Elevation & Depth

This system avoids exaggerated blur shadows in favor of a crisp architectural hierarchy combining fine border delineation with subtle ambient diffusion.

### Depth Hierarchy
1. **Level 0 (Flat Ground)**: Color `#F8FAFC`. The foundational canvas across all work modules.
2. **Level 1 (Card & Module Layer)**: Color `#FFFFFF` bounded by a strict `1px solid #E2E8F0` hairline stroke. Grounded by a subtle ambient drop shadow: `0px 1px 3px rgba(15, 41, 66, 0.04), 0px 1px 2px rgba(15, 41, 66, 0.02)`.
3. **Level 2 (Hovered Cards & Interactive Controls)**: `1px solid #CBD5E1` outline with lifted elevation: `0px 4px 6px -1px rgba(15, 41, 66, 0.06), 0px 2px 4px -2px rgba(15, 41, 66, 0.04)`.
4. **Level 3 (Flyouts, Menus & Dropdowns)**: Background `#FFFFFF`, border `1px solid #E2E8F0`, deep cast shadow: `0px 10px 15px -3px rgba(15, 41, 66, 0.08), 0px 4px 6px -4px rgba(15, 41, 66, 0.03)`.
5. **Level 4 (Modal Dialogs & Command Bar)**: Full containment framed with a translucent overlay `rgba(15, 41, 66, 0.45)` with `backdrop-filter: blur(4px)`. The elevated window uses `0px 20px 25px -5px rgba(15, 41, 66, 0.12), 0px 8px 10px -6px rgba(15, 41, 66, 0.05)`.

## Shapes

The interface balances sharp corporate professionalism with modern accessibility through controlled curvature.

- **Primary Cards & Panels (`rounded-xl` / 12px - 16px)**: Exterior analytical cards, table containers, and workflow stages use a distinct 12px or 16px radius, presenting crisp containment without blunt corners.
- **Controls & Form Elements (`rounded-md` / 6px - 8px)**: Interactive controls, inputs, buttons, and dropdown triggers utilize an 8px radius to convey tactile responsiveness.
- **Status Badges & Micro-tags (`rounded-full` / Pill)**: Workflow state chips, live user tags, and activity counter badges use full pill rounding to contrast cleanly against rectangular cards and table columns.

## Components

### Buttons
- **Primary CTA**: Background `#F97316`, text `#FFFFFF`, border none, 8px border radius, font `Inter` 14px Semibold. States: Hover `#EA580C`, Active scale down (0.98), Focus ring `2px #F97316` offset by `2px`. Used exclusively for key triggers (e.g., `+ Nouveau projet`, `Valider`, `Sauvegarder`).
- **Secondary (Corporate)**: Background `#0F2942`, text `#FFFFFF`, border none, 8px radius. Hover `#1E40AF`.
- **Tertiary / Outline**: Background `#FFFFFF`, text `#1E293B`, border `1px solid #E2E8F0`, 8px radius. Hover background `#F8FAFC`, border `#CBD5E1`.
- **Destructive**: Background `#FEF2F2`, text `#991B1B`, border `1px solid #FECACA`. Hover background `#FEE2E2`.

### Micro-Badges de Statut (Workflow Indicators)
All status badges are styled as compact pills (`height: 22px`, `padding: 2px 8px`, font `11px`, weight `600`, tracking `0.02em`):
- **Validé**: Background `#ECFDF5`, border `1px solid #A7F3D0`, text `#065F46`. Leading dot `#059669`.
- **En cours**: Background `#EFF6FF`, border `1px solid #BFDBFE`, text `#1E40AF`. Leading pulsing dot `#2563EB`.
- **En retard / Bloqué**: Background `#FEF2F2`, border `1px solid #FECACA`, text `#991B1B`. Leading dot `#DC2626`.
- **Modification demandée**: Background `#FFF7ED`, border `1px solid #FED7AA`, text `#C2410C`. Leading dot `#F97316`.

### Cards & Analytical Containers
- Built on a pure white `#FFFFFF` surface with an exact `1px solid #E2E8F0` boundary and 12px/16px outer radius.
- **Header**: Separated by a `1px solid #F1F5F9` bottom divider, containing section titles in Plus Jakarta Sans 16px/600 and contextual action icons or filter toggles.
- **Body Padding**: Consistent 20px padding (16px on mobile).

### Input Fields & Select Controls
- Background `#FFFFFF` (resting) or `#F8FAFC` (subtle read-only fields). Border `1px solid #CBD5E1`, border-radius 8px, height 40px, padding `0 12px`.
- **Focus**: Border color shifts to `#2563EB` with a soft outer glow ring (`0 0 0 3px rgba(37, 99, 235, 0.15)`).
- **Labeling**: Placed strictly above inputs in Inter 12px, weight 600, color `#64748B`.

### Checkboxes & Radio Elements
- Size 16px × 16px. Resting border `1.5px solid #94A3B8`, radius 4px (checkbox) or 50% (radio).
- Active state uses `#0F2942` fill with white check/dot icon; hover shows an ambient blue shadow halo (`rgba(37, 99, 235, 0.1)`).

### Activity Stream & Audit Dots
- Vertical timeline tracks rendered in `2px solid #E2E8F0`.
- Event nodes feature an 8px circular indicator:
  - System AI activities: `#2563EB` with light blue `#EFF6FF` halo ring.
  - Critical validation alerts: `#F97316` with `#FFF7ED` halo ring.
  - Completed deliveries: `#059669` solid.