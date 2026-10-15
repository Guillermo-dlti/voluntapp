import { useWindowDimensions } from 'react-native';

// True when the system text size is set well above default (Android "Font size" or iOS Larger Text).
// Layouts that put two things side by side stack them instead, and rows stop cutting text short.
export function useLargeText(): boolean {
  return useWindowDimensions().fontScale >= 1.5;
}
