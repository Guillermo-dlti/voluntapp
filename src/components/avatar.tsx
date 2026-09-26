import { StyleSheet, Text, View } from 'react-native';

import { AppFonts, AvatarTones } from '@/constants/theme';
import { initials } from '@/utils/time';

// Same name, same color, so people are easier to spot in a long list.
function toneFor(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AvatarTones[hash % AvatarTones.length];
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const tone = toneFor(name);
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: tone.background }]}>
      <Text style={[styles.text, { color: tone.text, fontSize: Math.round(size * 0.38) }]}>{initials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  text: { fontFamily: AppFonts.headingSemiBold },
});
