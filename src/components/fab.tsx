import { StyleSheet, Text } from 'react-native';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { Brand, Elevation, Radius, Type } from '@/constants/theme';
import { useTabBarInset } from '@/hooks/use-tab-bar-inset';

interface FabProps {
  label: string;
  icon: Parameters<typeof Icon>[0]['name'];
  onPress: () => void;
  testID?: string;
}

// Extended floating button for a screen's main action ("Nuevo voluntario"). The label stays
// visible so the action is never an unexplained icon.
export function Fab({ label, icon, onPress, testID }: FabProps) {
  const bottomInset = useTabBarInset();
  return (
    <PressableScale testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={[styles.fab, { bottom: 20 + bottomInset }]}>
      <Icon name={icon} size={22} color={Brand.surface} />
      <Text style={styles.label}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
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
  label: { ...Type.bodyStrong, color: Brand.surface },
});
