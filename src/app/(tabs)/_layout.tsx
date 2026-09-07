import { NativeTabs } from 'expo-router/unstable-native-tabs';

// Real native tab bar (iOS/Android system chrome)
// bar like Figma's mock
//
// Each icon carries an `sf` (SF Symbol, iOS) and an `md` (Material glyph,
// Android) name — no icon assets to ship, both catalogs are built into the OS.
// iOS gets a filled variant on selection, which is the platform convention.
export default function TabsLayout() {
  return (
    // Android's Material bar hides labels on unselected items once there are
    // more than 3 tabs; "labeled" keeps all five readable.
    <NativeTabs labelVisibilityMode="labeled">
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
        <NativeTabs.Trigger.Label>Inicio</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="ofertas">
        <NativeTabs.Trigger.Icon sf="list.bullet" md="list" />
        <NativeTabs.Trigger.Label>Ofertas</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="mis-actividades">
        <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
        <NativeTabs.Trigger.Label>Mis Act.</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="impacto">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'chart.bar', selected: 'chart.bar.fill' }}
          md="insights"
        />
        <NativeTabs.Trigger.Label>Impacto</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="perfil">
        <NativeTabs.Trigger.Icon sf={{ default: 'person', selected: 'person.fill' }} md="person" />
        <NativeTabs.Trigger.Label>Perfil</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
