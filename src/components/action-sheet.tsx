import { useRef } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { Brand, Elevation, Radius, Type } from '@/constants/theme';
import { useMotion } from '@/utils/motion';

export interface SheetAction {
  label: string;
  icon: Parameters<typeof Icon>[0]['name'];
  onPress: () => void;
  // Cancel or deactivate: shown in the danger color.
  critical?: boolean;
  // A second, quieter line under the label.
  detail?: string;
  // Shown but not pressable (such as a file with no rows).
  disabled?: boolean;
  // Runs without closing the sheet, for a row that only changes what the sheet lists next.
  keepOpen?: boolean;
  testID?: string;
}

interface ActionSheetProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  actions: SheetAction[];
  onClose: () => void;
  testID?: string;
}

// A menu that slides up from the bottom. Android's Alert fits at most three buttons, and the
// activity menu can need four plus "Volver".
export function ActionSheet({ visible, title, subtitle, actions, onClose, testID }: ActionSheetProps) {
  const insets = useSafeAreaInsets();
  const motion = useMotion();
  // iOS can't present a picker or share sheet while this modal is still closing: the call never
  // settles. There the action waits for onDismiss; Android runs it right away.
  const pending = useRef<(() => void) | null>(null);

  function choose(action: SheetAction) {
    if (action.keepOpen) { action.onPress(); return; }
    if (Platform.OS === 'ios') pending.current = action.onPress;
    onClose();
    if (Platform.OS !== 'ios') action.onPress();
  }

  function dismissed() {
    const run = pending.current;
    pending.current = null;
    run?.();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} onDismiss={dismissed}
      statusBarTranslucent navigationBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable accessibilityLabel="Cerrar menú" style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View testID={testID} entering={motion.sheetIn()}
          style={[styles.sheet, { paddingBottom: 16 + insets.bottom }]}>
          <View style={styles.handle} />
          <View style={styles.heading}>
            <Text accessibilityRole="header" style={styles.title} numberOfLines={2}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          <View style={styles.list}>
            {actions.map((action, index) => (
              <View key={action.label}>
                {index > 0 ? <View style={styles.hairline} /> : null}
                <PressableScale testID={action.testID} accessibilityRole="button" android_ripple={{ color: Brand.surfaceMuted }}
                  accessibilityState={{ disabled: !!action.disabled }} disabled={action.disabled}
                  onPress={() => { choose(action); }}
                  style={[styles.row, action.disabled && styles.disabled]}>
                  <View style={[styles.iconWell, action.critical && styles.iconWellCritical]}>
                    <Icon name={action.icon} size={18} color={action.critical ? Brand.danger : Brand.primary} />
                  </View>
                  <View style={styles.text}>
                    <Text style={[styles.label, action.critical && styles.labelCritical]}>{action.label}</Text>
                    {action.detail ? <Text style={styles.detail}>{action.detail}</Text> : null}
                  </View>
                </PressableScale>
              </View>
            ))}
          </View>
          <Button testID={testID ? `${testID}-close` : undefined} label="Volver" variant="secondary" onPress={onClose} />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: Brand.scrim },
  sheet: {
    gap: 16,
    paddingTop: 10,
    paddingHorizontal: 20,
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    backgroundColor: Brand.surface,
    boxShadow: Elevation.raised,
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: Brand.border },
  heading: { gap: 4, paddingHorizontal: 4 },
  title: { ...Type.headline, color: Brand.text },
  subtitle: { ...Type.callout, color: Brand.textSecondary },
  list: { borderRadius: Radius.card, borderWidth: 1, borderColor: Brand.border, overflow: 'hidden' },
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: Brand.border, marginLeft: 64 },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 10 },
  iconWell: { width: 34, height: 34, borderRadius: Radius.well, backgroundColor: Brand.primaryLight, alignItems: 'center', justifyContent: 'center' },
  iconWellCritical: { backgroundColor: Brand.dangerLight },
  disabled: { opacity: 0.5 },
  text: { flex: 1, gap: 2 },
  detail: { ...Type.footnote, color: Brand.textSecondary },
  label: { ...Type.body, color: Brand.text },
  labelCritical: { color: Brand.danger },
});
