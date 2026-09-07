import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { AppFonts, Brand } from '@/constants/theme';


export function BackButton() {
  function handlePress() {

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(auth)/welcome');
    }
  }

  return (
    <Pressable
      style={styles.button}
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
