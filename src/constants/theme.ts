/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
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

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
