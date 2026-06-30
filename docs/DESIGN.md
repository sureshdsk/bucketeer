---
name: Cloud-Native Infrastructure OS
colors:
  surface: '#131314'
  surface-dim: '#131314'
  surface-bright: '#3a393a'
  surface-container-lowest: '#0e0e0f'
  surface-container-low: '#1c1b1c'
  surface-container: '#201f20'
  surface-container-high: '#2a2a2b'
  surface-container-highest: '#353436'
  on-surface: '#e5e2e3'
  on-surface-variant: '#c1c6d7'
  inverse-surface: '#e5e2e3'
  inverse-on-surface: '#313031'
  outline: '#8b90a0'
  outline-variant: '#414755'
  surface-tint: '#adc6ff'
  primary: '#adc6ff'
  on-primary: '#002e69'
  primary-container: '#4b8eff'
  on-primary-container: '#00285c'
  inverse-primary: '#005bc1'
  secondary: '#7dffa2'
  on-secondary: '#003918'
  secondary-container: '#05e777'
  on-secondary-container: '#00622e'
  tertiary: '#ffb4aa'
  on-tertiary: '#690003'
  tertiary-container: '#ff5545'
  on-tertiary-container: '#5c0002'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a41'
  on-primary-fixed-variant: '#004493'
  secondary-fixed: '#62ff96'
  secondary-fixed-dim: '#00e475'
  on-secondary-fixed: '#00210b'
  on-secondary-fixed-variant: '#005226'
  tertiary-fixed: '#ffdad5'
  tertiary-fixed-dim: '#ffb4aa'
  on-tertiary-fixed: '#410001'
  on-tertiary-fixed-variant: '#930005'
  background: '#131314'
  on-background: '#e5e2e3'
  surface-variant: '#353436'
typography:
  display-sm:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  data-mono:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '450'
    lineHeight: 18px
  label-xs:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  sidebar_width: 260px
  drawer_width: 400px
  gutter: 1px
  padding_tight: 8px
  padding_base: 16px
---

## Brand & Style

This design system is built on the principles of **Technical Reliability** and **Infrastructure Clarity**. It adopts a "Cloud-Native Operating System" aesthetic, prioritizing high-performance data density over decorative elements. The visual language is inspired by professional developer tools and cloud consoles, blending **Minimalism** with **Geist-like Technical Precision**. 

The target audience consists of DevOps engineers, S3 architects, and security administrators who require a tool that feels like a native extension of their workstation. The UI evokes a sense of "Absolute Control"—surfacing critical security states and bucket metrics with surgical accuracy. It utilizes high-contrast indicators for risk management while maintaining a calm, dark-ambient environment for deep focus tasks.

## Colors

The palette is optimized for long-duration technical work in dark environments.
- **Obsidian (#0A0A0B):** The primary canvas color, used for the main object explorer and deep backgrounds.
- **Slate (#1C1C1E):** Used for elevated surfaces like the sidebar and contextual drawers to create structural separation.
- **Azure (#007AFF):** Reserved exclusively for primary actions, selection states, and active focus indicators.
- **Electric Green (#00E676):** Indicates "Healthy," "Encrypted," or "Public Access Blocked" states.
- **Emergency Red (#FF3B30):** High-impact color for "Public" badges, deletion actions, and IAM policy violations.
- **Neutral Grays:** A ramp of cool-toned slates is used for secondary text and structural borders to maintain a low-distraction environment.

## Typography

Typography is used as a functional tool for data parsing. 
- **Inter** is utilized for the primary interface, providing high legibility for navigation and UI controls.
- **JetBrains Mono** is mandatory for all technical data, including S3 Object Keys, ARNs, ETag values, and Policy JSON. The monospaced nature ensures that vertical alignment is maintained in dense list views, allowing engineers to quickly scan for naming patterns or version IDs.
- **Data Density:** Line heights are kept tight (approx 1.4x) to maximize the amount of information visible on-screen without sacrificing readability.

## Layout & Spacing

This design system employs a **3-Column Fixed-Fluid Architecture**:
1. **Navigation Sidebar (Left):** Fixed at 260px. Contains bucket hierarchy and account switching.
2. **Main Object Explorer (Center):** Fluid. A high-density grid or list view for S3 objects.
3. **Contextual Drawer (Right):** Fixed at 400px. Slides over or pushes content to show object metadata, permissions, and version history.

**Spacing Rhythm:**
- A base unit of **4px** is used for all internal component spacing.
- **Gutter Strategy:** Instead of wide gaps, use 1px "Slate" borders to separate regions, mimicking the look of a code editor or IDE.
- **Interactive Breadcrumbs:** Positioned at the top of the Main Explorer, allowing for deep-path navigation with click-to-copy functionality on individual path segments.

## Elevation & Depth

To maintain the "Technical OS" aesthetic, this design system avoids soft ambient shadows. Instead, depth is communicated through **Tonal Layering** and **Low-Contrast Outlines**:
- **Level 0 (Base):** Obsidian background for the main workspace.
- **Level 1 (Surface):** Slate background for Sidebars and Drawers, separated by a 1px solid border (#2C2C2E).
- **Level 2 (Popovers):** Tooltips and dropdown menus use a slightly lighter slate with a 1px Azure border when active to indicate focus.
- **Active State:** Elements do not "lift" off the page; instead, they change border color or background saturation to indicate selection.

## Shapes

The shape language is **Precision-Oriented**. 
- **Soft (4px):** Used for buttons, input fields, and object cards. This creates a modern, slightly refined feel without appearing "playful."
- **Square (0px):** Used for the primary layout containers (Sidebar, Drawer) and table headers to emphasize the structural rigidity of the application.
- **Pill (Full):** Reserved exclusively for "Status Badges" (e.g., Public, Private, Encrypted) to distinguish them from interactive buttons.

## Components

- **Buttons:** Primary buttons use the Azure background with white text. Secondary buttons are ghost-style with Slate borders. 
- **Security Badges:** 
    - *Public:* Emergency Red background, bold white JetBrains Mono text.
    - *Private:* Subtle Slate border, white text.
    - *Encrypted:* Electric Green glow (low opacity) with Green icon.
- **Object Lists:** Use a Zebra-striping pattern (Obsidian/Slate) for high-density rows. Hovering a row highlights it in a subtle Azure tint.
- **Visual Policy Builder:** Uses "Block-based" components—logic gates (Allow/Deny) are color-coded (Green/Red) and connect via technical paths.
- **Lifecycle Timelines:** A horizontal track showing object transitions (Standard -> IA -> Glacier) using color-coded nodes and duration labels in JetBrains Mono.
- **Input Fields:** Dark backgrounds with 1px borders. Focus state uses a 1px Azure glow. Use monospaced font for Prefix/S3-URI inputs.