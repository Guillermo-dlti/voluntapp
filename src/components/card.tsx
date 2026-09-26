import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Brand, Elevation, Radius } from '@/constants/theme';

interface CardProps {
  children: ReactNode;
  // Inner padding; lists pass 0 so rows run edge to edge.
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

// The one elevated surface for content. The shadow sits on an outer view and the clipping on an
// inner one, because `overflow: hidden` would also clip the shadow.
export function Card({ children, padded = true, style, testID }: CardProps) {
  return (
    <View testID={testID} style={[styles.shadow, style]}>
      <View style={[styles.clip, padded && styles.padded]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: { borderRadius: Radius.card, backgroundColor: Brand.surface, boxShadow: Elevation.card },
  clip: { borderRadius: Radius.card, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: Brand.border },
  padded: { padding: 16 },
});
