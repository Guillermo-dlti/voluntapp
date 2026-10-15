import { useEffect } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';

import { AmbientGlows, Motion } from '@/constants/theme';
import { useMotion } from '@/utils/motion';

// Where each glow sits and how far (and how fast, relative to Motion.ambient) it wanders.
const glows = [
  { color: AmbientGlows[0], top: -40, right: -30, size: 180, dx: -50, dy: 40, pace: 1 },
  { color: AmbientGlows[1], top: 120, left: -60, size: 160, dx: 60, dy: -30, pace: 1.3 },
  { color: AmbientGlows[2], top: 20, left: 120, size: 120, dx: 40, dy: 50, pace: 0.8 },
] as const;

function Glow({ glow, progress }: { glow: (typeof glows)[number]; progress: SharedValue<number> }) {
  const animated = useAnimatedStyle(() => ({
    transform: [{ translateX: glow.dx * progress.get() }, { translateY: glow.dy * progress.get() }],
  }));
  const { color, size, top, dx: _dx, dy: _dy, pace: _pace, ...side } = glow;
  return (
    <Animated.View style={[styles.glow, side, {
      top, width: size, height: size, borderRadius: size / 2, backgroundColor: color,
      // A wide blurred shadow of the same color is what makes the circle read as light, not a disc.
      boxShadow: `0px 0px ${size}px ${size / 2}px ${color}`,
    }, animated]} />
  );
}

// A slow, barely there drift of light behind the login header, so the first screen feels alive. It
// never moves under Reduce Motion, and it stops whenever the app is in the background.
export function AmbientBackground() {
  const { reduced } = useMotion();
  const first = useSharedValue(0);
  const second = useSharedValue(0);
  const third = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    const values = [first, second, third];
    const start = () => values.forEach((value, index) => {
      value.set(withRepeat(withTiming(1, { duration: Motion.ambient * glows[index].pace, easing: Easing.inOut(Easing.sin) }), -1, true));
    });
    const stop = () => values.forEach((value) => cancelAnimation(value));
    start();
    const subscription = AppState.addEventListener('change', (state) => (state === 'active' ? start() : stop()));
    return () => { subscription.remove(); stop(); };
  }, [reduced, first, second, third]);

  return (
    <View style={styles.layer} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Glow glow={glows[0]} progress={first} />
      <Glow glow={glows[1]} progress={second} />
      <Glow glow={glows[2]} progress={third} />
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, overflow: 'hidden', pointerEvents: 'none' },
  glow: { position: 'absolute' },
});
