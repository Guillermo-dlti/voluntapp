import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { roleCan } from '@/constants/roles';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';

// Real native tab bar (iOS/Android system chrome).
//
// Each icon carries an `sf` (SF Symbol, iOS) and an `md` (Material glyph,
// Android) name — no icon assets to ship, both catalogs are built into the OS.
// iOS gets a filled variant on selection, which is the platform convention.
// Tabs a role can't use are hidden; the API refuses forbidden requests regardless
// of what the bar shows.
export default function TabsLayout() {
  const { user } = useAuth();
  const showReports = user ? roleCan.viewReports(user.role) : false;
  return (
    // Android's Material bar hides labels on unselected items once there are
    // more than 3 tabs; "labeled" keeps all five readable.
    <NativeTabs labelVisibilityMode="labeled" backgroundColor={Brand.surface} tintColor={Brand.primary}
      iconColor={Brand.textSecondary} indicatorColor={Brand.primaryLight} rippleColor={Brand.surfaceMuted}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="dashboard" />
        <NativeTabs.Trigger.Label>Inicio</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="voluntarios">
        <NativeTabs.Trigger.Icon sf={{ default: 'person.2', selected: 'person.2.fill' }} md="group" />
        <NativeTabs.Trigger.Label>Voluntarios</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="actividades">
        <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
        <NativeTabs.Trigger.Label>Actividades</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="reportes" hidden={!showReports}>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'chart.bar', selected: 'chart.bar.fill' }}
          md="bar_chart"
        />
        <NativeTabs.Trigger.Label>Reportes</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="ajustes">
        <NativeTabs.Trigger.Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} md="settings" />
        <NativeTabs.Trigger.Label>Ajustes</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
