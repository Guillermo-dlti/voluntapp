import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { CelebrationColors, Motion } from '@/constants/theme';

export interface ConfettiPiece {
  // Launch velocity in points per second; negative y is up.
  vx: number;
  vy: number;
  spin: number;
  color: string;
  width: number;
  height: number;
  round: boolean;
}

const GRAVITY = 2400;
const SECONDS = Motion.celebration / 1000;

// Built when the burst is asked for (an event), not while rendering, so renders stay pure.
export function makeConfetti(count = 44): ConfettiPiece[] {
  return Array.from({ length: count }, () => {
    // A fan pointing up, about 110° wide.
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.9;
    const speed = 900 + Math.random() * 800;
    const round = Math.random() < 0.25;
    const size = 7 + Math.random() * 5;
    return {
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      spin: (Math.random() - 0.5) * 1440,
      color: CelebrationColors[Math.floor(Math.random() * CelebrationColors.length)],
      width: size,
      height: round ? size : size * 1.6,
      round,
    };
  });
}

function Piece({ piece, progress }: { piece: ConfettiPiece; progress: SharedValue<number> }) {
  const animated = useAnimatedStyle(() => {
    const p = progress.get();
    const t = p * SECONDS;
    return {
      // Solid for most of the flight, then gone by the end.
      opacity: p < 0.65 ? 1 : (1 - p) / 0.35,
      transform: [
        { translateX: piece.vx * t },
        { translateY: piece.vy * t + 0.5 * GRAVITY * t * t },
        { rotate: `${piece.spin * t}deg` },
      ],
    };
  });
  return (
    <Animated.View style={[styles.piece, {
      width: piece.width, height: piece.height, backgroundColor: piece.color,
      borderRadius: piece.round ? piece.width / 2 : 2,
      marginLeft: -piece.width / 2,
    }, animated]} />
  );
}

// One short burst from the bottom of the screen, where the finalize button sits. Draws over
// everything without catching touches, then removes itself.
export function Confetti({ pieces, onDone }: { pieces: ConfettiPiece[]; onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(withTiming(1, { duration: Motion.celebration, easing: Easing.linear }, (finished) => {
      if (finished) scheduleOnRN(onDone);
    }));
  }, [progress, onDone]);
  return (
    <View style={styles.layer} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <View style={[styles.origin, { left: width / 2, top: height * 0.82 }]}>
        {pieces.map((piece, index) => <Piece key={index} piece={piece} progress={progress} />)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, pointerEvents: 'none', overflow: 'hidden' },
  origin: { position: 'absolute', width: 0, height: 0 },
  piece: { position: 'absolute' },
});
