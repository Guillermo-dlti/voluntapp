import { StyleSheet, Text } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { Brand, Elevation, MaxContentWidth, Radius, Type } from '@/constants/theme';
import { useMotion } from '@/utils/motion';

export type ToastTone = 'success' | 'info';

// A short confirmation that drops in from the top edge, white so it stands out on the forest band, and leaves on its own. Tapping it dismisses
// it early. Screen readers hear it through the live region.
export function Toast({ message, tone, onDismiss }: { message: string; tone: ToastTone; onDismiss: () => void }) {
  const insets = useSafeAreaInsets();
  const motion = useMotion();
  return (
    <Animated.View entering={motion.toastIn()} exiting={motion.toastOut()} style={[styles.wrap, { top: insets.top + 8 }]}>
      <PressableScale testID="toast" accessibilityRole="alert" accessibilityLiveRegion="polite" accessibilityLabel={message}
        accessibilityHint="Toca para cerrar" onPress={onDismiss} style={styles.toast}>
        <Icon name={tone === 'success' ? { ios: 'checkmark.circle.fill', android: 'check_circle' } : { ios: 'info.circle.fill', android: 'info' }}
          size={22} color={Brand.primary} />
        <Text style={styles.text}>{message}</Text>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  toast: {
    width: '100%',
    maxWidth: MaxContentWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Brand.border,
    backgroundColor: Brand.surface,
    boxShadow: Elevation.raised,
  },
  text: { flex: 1, ...Type.bodyStrong, color: Brand.text },
});
