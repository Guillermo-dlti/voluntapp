import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Motion } from '@/constants/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const easing = Easing.bezier(...Motion.easeOut);

interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
}

// Shrinks slightly while held, so buttons and cards respond to the finger instead of only
// changing color.
export function PressableScale({ style, onPressIn, onPressOut, disabled, ...props }: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      onPressIn={(event) => { scale.value = withTiming(Motion.pressedScale, { duration: Motion.fast, easing }); onPressIn?.(event); }}
      onPressOut={(event) => { scale.value = withTiming(1, { duration: Motion.fast, easing }); onPressOut?.(event); }}
      style={[style, animated]}
    />
  );
}
