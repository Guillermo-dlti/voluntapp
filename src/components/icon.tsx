import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

type SymbolName = ComponentProps<typeof SymbolView>['name'];

interface IconProps {
  // SF Symbol on iOS, Material Symbol on Android; both ship with the OS, so there are no icon assets.
  name: Exclude<SymbolName, string>;
  size?: number;
  color: ColorValue;
}

export function Icon({ name, size = 22, color }: IconProps) {
  return <SymbolView name={name} size={size} tintColor={color} accessibilityElementsHidden importantForAccessibility="no" />;
}
