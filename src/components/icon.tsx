import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { useWindowDimensions, type ColorValue } from 'react-native';

type SymbolName = ComponentProps<typeof SymbolView>['name'];

interface IconProps {
  // SF Symbol on iOS, Material Symbol on Android; both ship with the OS, so there are no icon assets.
  name: Exclude<SymbolName, string>;
  size?: number;
  color: ColorValue;
}

export function Icon({ name, size = 22, color }: IconProps) {
  const { fontScale } = useWindowDimensions();
  // On Android and web the symbol is a font glyph that grows with the system text size inside a box
  // that doesn't, so at large text it was clipped to a sliver. Shrinking the glyph by the font scale
  // and pinning the box keeps every icon at its designed size.
  const glyph = process.env.EXPO_OS === 'ios' ? size : size / fontScale;
  return (
    <SymbolView name={name} size={glyph} style={{ width: size, height: size }} tintColor={color}
      accessibilityElementsHidden importantForAccessibility="no" />
  );
}
