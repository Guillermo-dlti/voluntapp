import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { AppFonts, Brand } from '@/constants/theme';

interface EmptyStateProps {
  icon: Parameters<typeof Icon>[0]['name'];
  title: string;
  body: string;
  testID?: string;
}

export function EmptyState({ icon, title, body, testID }: EmptyStateProps) {
  return (
    <Card testID={testID}>
      <View style={styles.container}>
        <View style={styles.halo}>
          <View style={styles.badge}>
            <Icon name={icon} size={26} color={Brand.primary} />
          </View>
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 8, paddingVertical: 20, paddingHorizontal: 8 },
  // Soft ring around the icon, so the empty state has a focal point instead of a lone glyph.
  halo: { padding: 8, borderRadius: 26, backgroundColor: Brand.background, marginBottom: 6 },
  badge: { width: 56, height: 56, borderRadius: 18, backgroundColor: Brand.primaryLight, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: AppFonts.headingSemiBold, fontSize: 18, color: Brand.text, textAlign: 'center' },
  body: { fontFamily: AppFonts.body, fontSize: 14, color: Brand.textSecondary, textAlign: 'center', lineHeight: 20, maxWidth: 300 },
});
