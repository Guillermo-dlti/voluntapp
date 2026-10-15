import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { Motion } from '@/constants/theme';
import { timing, useMotion } from '@/utils/motion';

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

// One digit: a column of 0–9 behind a window one line tall, slid to the right digit. Starts at 0, so
// on first load each digit rolls up to its value. The window's size comes from laying out the real
// digit, so it follows the font and the system text size exactly.
function DigitColumn({ digit, delay, style }: { digit: number; delay: number; style: StyleProp<TextStyle> }) {
  const [height, setHeight] = useState(0);
  const offset = useSharedValue(0);
  useEffect(() => {
    if (height > 0) offset.set(withDelay(delay, withTiming(-digit * height, timing)));
  }, [digit, height, delay, offset]);
  const animated = useAnimatedStyle(() => ({ transform: [{ translateY: offset.get() }] }));
  return (
    <View style={styles.window}>
      {/* Sizes the window; invisible once the column is measured and showing. */}
      <Text style={[style, height > 0 && styles.hidden]} onLayout={(event) => setHeight(event.nativeEvent.layout.height)}>
        {DIGITS[digit]}
      </Text>
      {height > 0 ? (
        <Animated.View style={[styles.column, animated]}>
          {DIGITS.map((char) => <Text key={char} style={[style, { height }]}>{char}</Text>)}
        </Animated.View>
      ) : null}
    </View>
  );
}

interface RollingNumberProps {
  // Already formatted for es-MX ("1,234", "59.5"); digits roll, separators stay put.
  value: string;
  style: StyleProp<TextStyle>;
  testID?: string;
}

// A number that rolls digit by digit when it appears or changes, like an odometer. Columns are keyed
// from the right, so going from 99 to 100 rolls the existing digits and adds one on the left. Under
// Reduce Motion it fades to the new value instead.
export function RollingNumber({ value, style, testID }: RollingNumberProps) {
  const { reduced, fadeIn } = useMotion();
  if (reduced) {
    return <Animated.Text key={value} entering={fadeIn()} testID={testID} style={style}>{value}</Animated.Text>;
  }
  const chars = [...value];
  return (
    <View testID={testID} accessible accessibilityRole="text" accessibilityLabel={value} style={styles.row}>
      {chars.map((char, index) => {
        const fromRight = chars.length - index;
        const digit = DIGITS.indexOf(char as (typeof DIGITS)[number]);
        // Left digits start first, so the number reads as rolling in from its leading digit.
        return digit === -1
          ? <Text key={`s${fromRight}`} style={style}>{char}</Text>
          : <DigitColumn key={`d${fromRight}`} digit={digit} delay={index * (Motion.stagger / 2)} style={style} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  window: { overflow: 'hidden' },
  column: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' },
  hidden: { opacity: 0 },
});
