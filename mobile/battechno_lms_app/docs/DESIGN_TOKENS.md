# Mobile design token mapping (MOBILE-FLUTTER-FOUNDATION-001)

Source: `frontend/src/assets/styles/abstracts/_variables.scss`

| Web token | Hex | Flutter token | Mobile use |
|-----------|-----|---------------|------------|
| `--color-primary` | `#132d4a` | `BatColors.primary` | AppBar, primary buttons, headings |
| `--color-secondary` | `#0c1f35` | `BatColors.secondary` | Dense nav, secondary emphasis |
| `--color-accent` | `#c9a227` | `BatColors.accent` | CTAs, focus ring, progress accents |
| `--color-bg` | `#f6f7f5` | `BatColors.background` | Scaffold background |
| `--color-cream` | `#f7f1e7` | `BatColors.cream` | Auth header wash / campus motif |
| `--color-card` | `#ffffff` | `BatColors.surface` | Cards, inputs |
| `--color-text` | `#243241` | `BatColors.onSurface` | Body text |
| `--color-text-muted` | `#5c6675` | `BatColors.muted` | Captions, subtitles |
| `--color-success` | `#2d8a54` | `BatColors.success` | Status chips |
| `--color-warning` | `#c27803` | `BatColors.warning` | Network/error banners |
| `--color-danger` | `#c41e1e` | `BatColors.danger` | Form errors |
| `--radius-md` | 6px | `BatRadii.md` | Inputs, buttons |
| `--radius-lg` | 8px | `BatRadii.lg` | Cards |
| `--radius-xl` | 14px | `BatRadii.xl` | Progress cards |
| Logo PNG | asset | `assets/images/battechno_lms_logo.png` | Splash, login |

Typography: **Tajawal** (Arabic primary) + **Inter** via Google Fonts — mirrors web stack.

Default locale: **Arabic (RTL)**. English strings provided in ARB files.
