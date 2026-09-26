import { StyleSheet, Text } from 'react-native';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { AppFonts, Brand, Elevation, Radius } from '@/constants/theme';

interface FabProps {
  label: string;
  icon: Parameters<typeof Icon>[0]['name'];
  onPress: () => void;
  testID?: string;
}

// Extended floating button for a screen's main action ("Nuevo voluntario"). The label stays
// visible so the action is never an unexplained icon.
export function Fab({ label, icon, onPress, testID }: FabProps) {
  return (
    <PressableScale testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.fab}>
      <Icon name={icon} size={22} color={Brand.surface} />
      <Text style={styles.label}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 18,
    paddingRight: 22,
    borderRadius: Radius.pill,
    backgroundColor: Brand.primary,
    boxShadow: Elevation.raised,
  },
  label: { fontFamily: AppFonts.bodySemiBold, fontSize: 16, color: Brand.surface },
});
