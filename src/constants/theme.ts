import '@/global.css';

// Spacing steps. `gutter` is the one side margin every screen shares, so the band's title and the
// cards on the sheet start on the same line.
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  gutter: 20,
  xl: 24,
  xxl: 32,
} as const;

// Brand palette. Leaf green comes from the team's Figma; forest and mango are drawn from the
// BAMX logo so the app reads as the food bank's own tool, not a generic template.
export const Brand = {
  primary: '#2E7D32',
  primaryPressed: '#256B29',
  primaryLight: '#E6F2E7',
  forest: '#183B24',
  forestText: '#E4EFE6',
  forestMuted: '#9DB8A3',
  forestPressed: 'rgba(255, 255, 255, 0.12)',
  accent: '#E9A23B',
  accentLight: '#FDF3E3',
  accentText: '#8A5A12',
  text: '#15211A',
  textSecondary: '#5A6B60',
  textTertiary: '#8A978E',
  border: '#D5DDD7',
  divider: '#E6EBE7',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF2EF',
  background: '#F4F6F3',
  danger: '#C0392B',
  dangerText: '#A93226',
  dangerBorder: '#E27D72',
  dangerLight: '#FCEDEB',
  warning: '#B45309',
  warningLight: '#FFFBEB',
  success: '#2E7D32',
  successLight: '#E6F2E7',
  // Dims the screen behind a dialog.
  scrim: 'rgba(21, 33, 26, 0.45)',
} as const;

// Radius follows hierarchy: sheets are softest, grouped sections next, controls tightest.
export const Radius = {
  sheet: 28,
  card: 16,
  button: 14,
  input: 14,
  // Inline alerts, date tiles and large icon wells.
  tile: 12,
  // The small square behind a row's icon.
  well: 10,
  pill: 999,
} as const;

// Depth, after Shopify's mobile admin: controls stay flat with a border, and only surfaces that
// hold content (cards) or float over it (FAB, sheets) cast a shadow. Tinted with forest instead of
// gray so shadows read as part of the palette. Needs Android 9+ (boxShadow).
export const Elevation = {
  card: '0px 1px 2px 0px rgba(24, 59, 36, 0.06), 0px 4px 12px -4px rgba(24, 59, 36, 0.12)',
  raised: '0px 8px 16px -4px rgba(24, 59, 36, 0.28), 0px 2px 4px 0px rgba(24, 59, 36, 0.10)',
} as const;

// One duration and one curve for every UI animation, like Polaris: feedback should feel immediate,
// not animated for show. Helpers that apply them (and fall back to a fade under Reduce Motion) live in
// `src/utils/motion.ts`; screens never pick their own timings.
export const Motion = {
  duration: 200,
  // Ease-out: most of the change happens at once, then it settles.
  easeOut: [0.19, 0.91, 0.38, 1] as const,
  // Releases (a pressed card coming back) spring instead of easing, so they feel physical. Critically
  // damped enough to settle in about the same 200 ms without a visible wobble.
  spring: { damping: 20, stiffness: 340, mass: 0.6 },
  pressedScale: 0.97,
  // Blocks entering one after another, and digits of a rolling number.
  stagger: 50,
  // The only long animations: loading shimmer, the finalize celebration, the login background.
  shimmer: 1300,
  celebration: 1100,
  ambient: 14000,
  // How long a toast stays before it slides away.
  toast: 3200,
} as const;

// Soft glows that drift behind the login header: leaf green, a lighter leaf, a touch of mango.
export const AmbientGlows = ['rgba(46, 125, 50, 0.55)', 'rgba(111, 191, 115, 0.28)', 'rgba(233, 162, 59, 0.18)'] as const;

// The finalize celebration: BAMX leaf and forest greens, with a little mango from the logo.
export const CelebrationColors = [Brand.primary, Brand.forest, '#6FBF73', '#A5D6A7', Brand.accent] as const;

// Background/text pairs for initials avatars. Picked per name, so a person keeps their color.
export const AvatarTones = [
  { background: '#DCEFDD', text: '#1F5A23' },
  { background: '#FDEBCB', text: '#8A5A12' },
  { background: '#D8ECEA', text: '#1D5C57' },
  { background: '#E7E3F3', text: '#4A3F7A' },
  { background: '#F6DFD8', text: '#8C3B26' },
] as const;

export const AppFonts = {
  heading: 'Outfit_700Bold',
  headingSemiBold: 'Outfit_600SemiBold',
  body: 'Geist_400Regular',
  bodySemiBold: 'Geist_600SemiBold',
} as const;

// The type scale: every text style spreads one of these and adds only its color. Outfit carries
// titles and numbers, Geist everything read in a sentence.
export const Type = {
  // Large band titles.
  display: { fontFamily: AppFonts.heading, fontSize: 32, lineHeight: 38, letterSpacing: -0.6 },
  // Login heading, report headline numbers.
  title: { fontFamily: AppFonts.heading, fontSize: 26, lineHeight: 32, letterSpacing: -0.4 },
  // Compact band title, card and chart titles.
  headline: { fontFamily: AppFonts.headingSemiBold, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: AppFonts.body, fontSize: 16, lineHeight: 22 },
  bodyStrong: { fontFamily: AppFonts.bodySemiBold, fontSize: 16, lineHeight: 22 },
  // Secondary lines in rows, alerts, help text.
  callout: { fontFamily: AppFonts.body, fontSize: 14, lineHeight: 20 },
  calloutStrong: { fontFamily: AppFonts.bodySemiBold, fontSize: 14, lineHeight: 20 },
  // Section footers, field hints, row notes.
  footnote: { fontFamily: AppFonts.body, fontSize: 13, lineHeight: 18 },
  // Pills, tile months, the smallest labels.
  caption: { fontFamily: AppFonts.bodySemiBold, fontSize: 12, lineHeight: 16 },
} as const;

export const MaxContentWidth = 800;
