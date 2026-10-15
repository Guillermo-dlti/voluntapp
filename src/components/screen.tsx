import { useCallback, useLayoutEffect, useRef, type ReactNode } from 'react';
import { Platform, RefreshControl, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Extrapolation, interpolate, scrollTo, useAnimatedRef, useAnimatedScrollHandler, useAnimatedStyle, useDerivedValue, useSharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { Brand, Radius, Spacing, Type } from '@/constants/theme';
import { useTabBarInset } from '@/hooks/use-tab-bar-inset';
import { useMotion } from '@/utils/motion';

interface ScreenProps {
  testID: string;
  title: string;
  titleTestID?: string;
  // Small line above the title, such as today's date.
  eyebrow?: string;
  subtitle?: string;
  // Pushed screens (detail, form) show a back button above the title.
  onBack?: () => void;
  // Top-right of the band, next to the back button, for a secondary action.
  action?: ReactNode;
  // Extra content inside the band under the title (role chip, search field, filters). It stays when
  // the title collapses, so search and filters are always at hand.
  band?: ReactNode;
  // Rendered above the sheet, not inside its scroll view: a Fab goes here.
  floating?: ReactNode;
  // A bar fixed at the bottom of the sheet, under the scrolling content, for a sticky action.
  footer?: ReactNode;
  // false when the screen brings its own list (FlatList), so lists aren't nested in a ScrollView.
  scroll?: boolean;
  // Pull to refresh.
  refreshing?: boolean;
  onRefresh?: () => void;
  // Called when the content is scrolled near its end, to load the next page.
  onEndReached?: () => void;
  children: ReactNode;
}

// The height the large title keeps when folded on a tab screen: one line of compact title.
const COMPACT = Type.headline.lineHeight;
// No cap: the large title at its natural height.
const OPEN = 10_000;
// The row with the back button and the action on pushed screens.
const TOP_ROW = 44;
// Space under the band's content, trimmed once the title collapses.
const BAND_BOTTOM = { open: Spacing.xxl, collapsed: Spacing.lg };
// Space under the last item, and the larger space that keeps it reachable above a floating button.
const CONTENT_END = 40;
const FAB_ROOM = 110;
// How close to the end of the content `onEndReached` fires.
const END_THRESHOLD = 400;

// Every tab: a forest band with a large left-aligned title, and the content on a rounded sheet
// that overlaps it. The contrast between band and sheet is what gives the app its depth.
// Scrolling folds the large title into a compact one (after iOS large titles and Shopify), giving the
// content the room back. It follows the finger, so it isn't motion for show; under Reduce Motion the
// band simply stays as it is.
export function Screen({ testID, title, titleTestID, onBack, eyebrow, subtitle, action, band, floating, footer, scroll = true, refreshing = false, onRefresh, onEndReached, children }: ScreenProps) {
  const { reduced } = useMotion();
  const bottomInset = useTabBarInset();
  const topRow = Boolean(onBack || action);
  const scrollY = useSharedValue(0);
  // The large block's natural height, and whether the content is long enough to fold it: on a short
  // page, folding would grow the sheet past its content and bounce the title open again. The viewport
  // is measured with the band open, since folding it grows the sheet.
  const largeHeight = useSharedValue(0);
  const viewport = useSharedValue(0);
  const contentHeight = useSharedValue(0);
  const collapsible = scroll && !reduced;
  // The latest callback, read from the UI thread's scroll handler without re-creating the handler.
  const endReached = useRef(onEndReached);
  useLayoutEffect(() => { endReached.current = onEndReached; });
  const callEndReached = useCallback(() => { endReached.current?.(); }, []);
  const hasEndReached = Boolean(onEndReached);

  // Fires once each time the end comes near, not on every frame spent there.
  const nearEnd = useSharedValue(false);

  // How far the title folds, or 0 when it shouldn't (Reduce Motion, short page). Reads stay inline so
  // Reanimated tracks them.
  // Folding fully takes a scroll of `room`, and the folded band hands the sheet `room` more viewport, so
  // the page must be at least two rooms taller than the open viewport. Any shorter and the scroll can't
  // reach the folded point: the title and the scroll fight, and the page jitters and sticks.
  const foldRoom = useDerivedValue(() => {
    const room = largeHeight.get() - (topRow ? 0 : COMPACT);
    return !collapsible || room <= 0 || contentHeight.get() < viewport.get() + 2 * room ? 0 : room;
  });
  // 0 while the large title shows, 1 once it's folded.
  const progress = useDerivedValue(() => {
    const room = foldRoom.get();
    return room > 0 ? interpolate(scrollY.get(), [0, room], [0, 1], Extrapolation.CLAMP) : 0;
  });

  const scrollRef = useAnimatedRef<Animated.ScrollView>();

  // A scroll that stops halfway through the fold finishes it, open or folded, so the title is never
  // left cut in half.
  const settle = (y: number) => {
    'worklet';
    const room = foldRoom.get();
    if (room <= 0 || y <= 0 || y >= room) return;
    scrollTo(scrollRef, 0, y < room / 2 ? 0 : room, true);
  };

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.set(event.contentOffset.y);
      if (!hasEndReached) return;
      const near = event.layoutMeasurement.height + event.contentOffset.y >= event.contentSize.height - END_THRESHOLD;
      if (near && !nearEnd.get()) scheduleOnRN(callEndReached);
      nearEnd.set(near);
    },
    onEndDrag: (event) => {
      if (Math.abs(event.velocity?.y ?? 0) < 0.1) settle(event.contentOffset.y);
    },
    onMomentumEnd: (event) => { settle(event.contentOffset.y); },
  });

  // A cap rather than a height: while open there is no cap at all, so a title that changes (the
  // skeleton's "Actividad" becoming a two-line name) always gets its natural height.
  const largeStyle = useAnimatedStyle(() => {
    const p = progress.get();
    if (p <= 0 || largeHeight.get() === 0) return { maxHeight: OPEN };
    const folded = topRow ? 0 : COMPACT;
    return { maxHeight: largeHeight.get() - (largeHeight.get() - folded) * p };
  });
  const largeContentStyle = useAnimatedStyle(() => ({ opacity: interpolate(progress.get(), [0, 0.4], [1, 0], Extrapolation.CLAMP) }));
  const compactStyle = useAnimatedStyle(() => ({ opacity: interpolate(progress.get(), [0.6, 1], [0, 1], Extrapolation.CLAMP) }));
  const bottomStyle = useAnimatedStyle(() => ({
    height: interpolate(progress.get(), [0, 1], [BAND_BOTTOM.open, BAND_BOTTOM.collapsed]),
  }));

  // Measured only while the band is open: once folding starts, the clipped block would report its
  // folded height and the fold would lock there.
  const measureLarge = (event: LayoutChangeEvent) => {
    if (scrollY.get() <= 0 || largeHeight.get() === 0) largeHeight.set(event.nativeEvent.layout.height);
  };
  const compactTitle = (
    <Animated.Text numberOfLines={1} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[styles.compactTitle, compactStyle]}>
      {title}
    </Animated.Text>
  );

  return (
    <View testID={testID} style={styles.root}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.band}>
        {topRow ? (
          <View style={styles.topRow}>
            {onBack ? (
              <PressableScale testID={`${testID}-back`} accessibilityRole="button" accessibilityLabel="Regresar" hitSlop={8} onPress={onBack}
                android_ripple={{ color: Brand.forestPressed, borderless: true }} style={styles.back}>
                <Icon name={{ ios: 'chevron.left', android: 'arrow_back' }} size={22} color={Brand.forestText} />
              </PressableScale>
            ) : null}
            <View style={styles.compactSlot}>{compactTitle}</View>
            {action}
          </View>
        ) : null}
        <Animated.View style={[styles.large, largeStyle]}>
          <Animated.View onLayout={measureLarge} style={[styles.largeContent, largeContentStyle]}>
            {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
            <Text testID={titleTestID} accessibilityRole="header" style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </Animated.View>
          {topRow ? null : <View style={styles.compactOverlay} pointerEvents="none">{compactTitle}</View>}
        </Animated.View>
        {band ? <View style={styles.bandExtra}>{band}</View> : null}
        <Animated.View style={bottomStyle} />
      </SafeAreaView>
      <View style={styles.sheet}>
        {scroll ? (
          <Animated.ScrollView ref={scrollRef} contentContainerStyle={[styles.content, { paddingBottom: (floating ? FAB_ROOM : CONTENT_END) + (footer ? 0 : bottomInset) }]}
            // The inset is added by hand above, so iOS mustn't add the tab bar a second time.
            contentInsetAdjustmentBehavior="never" showsVerticalScrollIndicator={false}
            // Scrolling down closes the keyboard; on iOS the content also scrolls clear of it while typing.
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} automaticallyAdjustKeyboardInsets
            keyboardShouldPersistTaps="handled" scrollEventThrottle={16} onScroll={onScroll}
            onLayout={(event) => { if (scrollY.get() <= 0) viewport.set(event.nativeEvent.layout.height); }}
            onContentSizeChange={(_, height) => { contentHeight.set(height); }}
            refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Brand.primary]} tintColor={Brand.primary} /> : undefined}>
            {children}
          </Animated.ScrollView>
        ) : children}
        {footer ? <View style={[styles.footer, { paddingBottom: Spacing.lg + bottomInset }]}>{footer}</View> : null}
        {floating}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.forest },
  band: { paddingHorizontal: Spacing.gutter, paddingTop: Spacing.lg },
  topRow: { minHeight: TOP_ROW, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
  back: { width: 40, height: 40, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center', marginLeft: -Spacing.sm },
  compactSlot: { flex: 1 },
  compactTitle: { ...Type.headline, color: Brand.forestText },
  // Clips the large title while it folds; its content keeps its natural height inside.
  large: { overflow: 'hidden' },
  largeContent: { gap: Spacing.xs, flexShrink: 0 },
  compactOverlay: { position: 'absolute', top: 0, left: 0, right: 0, height: COMPACT, justifyContent: 'center' },
  eyebrow: { ...Type.calloutStrong, color: Brand.forestMuted },
  title: { ...Type.display, color: Brand.forestText },
  subtitle: { ...Type.callout, color: Brand.forestMuted },
  bandExtra: { marginTop: Spacing.lg, gap: Spacing.md },
  sheet: { flex: 1, backgroundColor: Brand.background, borderTopLeftRadius: Radius.sheet, borderTopRightRadius: Radius.sheet, overflow: 'hidden' },
  content: { paddingHorizontal: Spacing.gutter, paddingTop: Spacing.xl, gap: 28 },
  footer: {
    gap: Spacing.sm, paddingHorizontal: Spacing.gutter, paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Brand.border, backgroundColor: Brand.surface,
  },
});
