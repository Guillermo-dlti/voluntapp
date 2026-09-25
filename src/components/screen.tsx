import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppFonts, Brand } from '@/constants/theme';

interface ScreenProps {
  testID: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}

// Standard tab screen: large left-aligned title, then scrolling content on the app background.
export function Screen({ testID, title, subtitle, children }: ScreenProps) {
  return (
    <SafeAreaView testID={testID} style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Brand.background },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40, gap: 24 },
  header: { gap: 4, paddingHorizontal: 4 },
  title: { fontFamily: AppFonts.heading, fontSize: 32, color: Brand.text, letterSpacing: -0.5 },
  subtitle: { fontFamily: AppFonts.body, fontSize: 15, color: Brand.textSecondary, lineHeight: 21 },
});
