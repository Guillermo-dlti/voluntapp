// The one place that turns the Motion tokens into Reanimated animations, so every screen moves the
// same way. Under the system's Reduce Motion setting, anything that slides, rises or scales becomes a
// plain fade of the same length: the change is still visible, nothing travels across the screen.
import {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  FadeOutUp,
  ReduceMotion,
  SlideInDown,
  useReducedMotion,
} from 'react-native-reanimated';

import { Motion } from '@/constants/theme';

export const motionEasing = Easing.bezier(...Motion.easeOut);
export const timing = { duration: Motion.duration, easing: motionEasing } as const;

// Fades keep playing under Reduce Motion (Reanimated would otherwise skip them), since a fade is the
// replacement for movement, not movement itself.
const fadeIn = (delay = 0) => FadeIn.duration(Motion.duration).delay(delay).reduceMotion(ReduceMotion.Never);
const fadeOut = () => FadeOut.duration(Motion.duration).reduceMotion(ReduceMotion.Never);

export function useMotion() {
  const reduced = useReducedMotion();
  return {
    reduced,
    // The n-th block of a screen rises in a little after the one above it.
    enter: (index = 0) => (reduced
      ? fadeIn(index * Motion.stagger)
      : FadeInDown.duration(Motion.duration).delay(index * Motion.stagger).easing(motionEasing)),
    // A bottom sheet coming up.
    sheetIn: () => (reduced ? fadeIn() : SlideInDown.duration(Motion.duration).easing(motionEasing)),
    // A toast dropping in from the top edge, and leaving the same way.
    toastIn: () => (reduced ? fadeIn() : FadeInUp.duration(Motion.duration).easing(motionEasing)),
    toastOut: () => (reduced ? fadeOut() : FadeOutUp.duration(Motion.duration).easing(motionEasing)),
    fadeIn,
    fadeOut,
  };
}
