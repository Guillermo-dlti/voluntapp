import { type Href, router } from 'expo-router';
import { type StyleProp, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { AppFonts, Brand } from '@/constants/theme';

interface BackButtonProps {
  fallback?: Href;
  inline?: boolean;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}

export function BackButton({ fallback = '/(auth)/welcome', inline = false, style, onPress }: BackButtonProps) {
  function handlePress() {
    if (onPress) {
      onPress();
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(fallback);
    }
  }

  return (
    <Pressable
      style={[inline ? styles.inlineButton : styles.button, style]}
      onPress={handlePress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Regresar">
      <Text style={styles.icon}>←</Text>
      <Text style={styles.label}>Regresar</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    top: 55,
    left: 17,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 10,
  },
  inlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  icon: {
    fontFamily: AppFonts.body,
    fontSize: 20,
    lineHeight: 22,
    color: Brand.primary,
  },
  label: {
    fontFamily: AppFonts.bodySemiBold,
    fontSize: 15,
    color: Brand.primary,
  },
});
