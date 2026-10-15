import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { Motion } from '@/constants/theme';
import { timing, useMotion } from '@/utils/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
// Under Reduce Motion the press dims instead of shrinking.
const pressedOpacity = 0.7;

interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
}

// Every button, chip, card and row that can be tapped goes through this: it shrinks a little while
// held and springs back on release, so the app answers the finger instead of only changing color.
export function PressableScale({ style, onPressIn, onPressOut, disabled, ...props }: PressableScaleProps) {
  const { reduced } = useMotion();
  const progress = useSharedValue(1);
  // Multiplied in, so a dimmed (disabled) style keeps its own opacity at rest.
  const flatOpacity = StyleSheet.flatten(style)?.opacity;
  const baseOpacity = typeof flatOpacity === 'number' ? flatOpacity : 1;
  const animated = useAnimatedStyle(() => (reduced
    ? { opacity: baseOpacity * progress.get() }
    : { transform: [{ scale: progress.get() }] }));
  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      onPressIn={(event) => {
        progress.set(withTiming(reduced ? pressedOpacity : Motion.pressedScale, timing));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        progress.set(reduced ? withTiming(1, timing) : withSpring(1, Motion.spring));
        onPressOut?.(event);
      }}
      style={[style, animated]}
    />
  );
}
