import type { ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { AppFonts, Brand, Radius } from '@/constants/theme';

interface ScreenProps {
  testID: string;
  title: string;
  titleTestID?: string;
  // Small line above the title, such as today's date.
  eyebrow?: string;
  subtitle?: string;
  // Pushed screens (detail, form) show a back button above the title.
  onBack?: () => void;
  // Top-right of the band, for a secondary action.
  action?: ReactNode;
  // Extra content inside the band under the title (role chip, search field, filters).
  band?: ReactNode;
  // Rendered above the sheet, not inside its scroll view: a Fab goes here.
  floating?: ReactNode;
  // false when the screen brings its own list (FlatList), so lists aren't nested in a ScrollView.
  scroll?: boolean;
  // Pull to refresh.
  refreshing?: boolean;
  onRefresh?: () => void;
  // Called when the content is scrolled near its end, to load the next page.
  onEndReached?: () => void;
  children: ReactNode;
}

// Every tab: a forest band with a large left-aligned title, and the content on a rounded sheet
// that overlaps it. The contrast between band and sheet is what gives the app its depth.
export function Screen({ testID, title, titleTestID, onBack, eyebrow, subtitle, action, band, floating, scroll = true, refreshing = false, onRefresh, onEndReached, children }: ScreenProps) {
  return (
    <View testID={testID} style={styles.root}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.band}>
        {onBack ? (
          <Pressable testID={`${testID}-back`} accessibilityRole="button" accessibilityLabel="Regresar" hitSlop={8} onPress={onBack}
            style={({ pressed }) => [styles.back, pressed && styles.backPressed]}>
            <Icon name={{ ios: 'chevron.left', android: 'arrow_back' }} size={22} color={Brand.forestText} />
          </Pressable>
        ) : null}
        <View style={styles.titleRow}>
          <View style={styles.titleText}>
            {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
            <Text testID={titleTestID} accessibilityRole="header" style={styles.title}>{title}</Text>
          </View>
          {action}
        </View>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {band ? <View style={styles.bandExtra}>{band}</View> : null}
      </SafeAreaView>
      <View style={styles.sheet}>
        {scroll ? (
          <ScrollView contentContainerStyle={[styles.content, floating ? styles.roomForFab : null]} showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled" scrollEventThrottle={200}
            refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Brand.primary]} tintColor={Brand.primary} /> : undefined}
            onScroll={onEndReached ? ({ nativeEvent: { layoutMeasurement, contentOffset, contentSize } }) => {
              if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 400) onEndReached();
            } : undefined}>
            {children}
          </ScrollView>
        ) : children}
        {floating}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.forest },
  band: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32, gap: 6 },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginLeft: -8, marginBottom: 4 },
  backPressed: { backgroundColor: Brand.forestPressed },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  titleText: { flex: 1, gap: 4 },
  eyebrow: { fontFamily: AppFonts.bodySemiBold, fontSize: 15, color: Brand.forestMuted },
  title: { fontFamily: AppFonts.heading, fontSize: 32, color: Brand.forestText, letterSpacing: -0.6, lineHeight: 38 },
  subtitle: { fontFamily: AppFonts.body, fontSize: 15, color: Brand.forestMuted, lineHeight: 21 },
  bandExtra: { marginTop: 12, gap: 12 },
  sheet: { flex: 1, backgroundColor: Brand.background, borderTopLeftRadius: Radius.sheet, borderTopRightRadius: Radius.sheet, overflow: 'hidden' },
  content: { padding: 20, paddingTop: 24, paddingBottom: 40, gap: 28 },
  // Keeps the last row reachable above a floating button.
  roomForFab: { paddingBottom: 110 },
});
