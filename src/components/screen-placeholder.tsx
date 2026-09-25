import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppFonts, Brand, Radius } from '@/constants/theme';

interface ScreenPlaceholderProps {
  testID: string;
  title: string;
  subtitle: string;
  // What this screen will hold once its scope feature is built, shown so the demo reads clearly.
  upcoming: string[];
  children?: ReactNode;
}

export function ScreenPlaceholder({ testID, title, subtitle, upcoming, children }: ScreenPlaceholderProps) {
  return (
    <SafeAreaView testID={testID} style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        {children}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Próximamente</Text>
          {upcoming.map((item) => (
            <Text key={item} style={styles.item}>• {item}</Text>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Brand.background },
  container: { padding: 24, paddingBottom: 40, gap: 20 },
  header: { gap: 4 },
  title: { fontFamily: AppFonts.heading, fontSize: 26, color: Brand.text },
  subtitle: { fontFamily: AppFonts.body, fontSize: 15, color: Brand.textSecondary },
  card: {
    backgroundColor: Brand.surface,
    borderWidth: 1.5,
    borderColor: Brand.border,
    borderRadius: Radius.card,
    padding: 16,
    gap: 8,
  },
  cardTitle: { fontFamily: AppFonts.headingSemiBold, fontSize: 16, color: Brand.text },
  item: { fontFamily: AppFonts.body, fontSize: 14, color: Brand.textSecondary, lineHeight: 20 },
});
