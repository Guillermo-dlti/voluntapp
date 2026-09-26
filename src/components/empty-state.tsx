import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { AppFonts, Brand, Radius } from '@/constants/theme';

interface EmptyStateProps {
  icon: Parameters<typeof Icon>[0]['name'];
  title: string;
  body: string;
  testID?: string;
}

export function EmptyState({ icon, title, body, testID }: EmptyStateProps) {
  return (
    <View testID={testID} style={styles.container}>
      <View style={styles.badge}>
        <Icon name={icon} size={26} color={Brand.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 32,
    paddingHorizontal: 24,
    backgroundColor: Brand.surface,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Brand.divider,
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: Brand.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  title: { fontFamily: AppFonts.headingSemiBold, fontSize: 17, color: Brand.text, textAlign: 'center' },
  body: { fontFamily: AppFonts.body, fontSize: 14, color: Brand.textSecondary, textAlign: 'center', lineHeight: 20, maxWidth: 300 },
});
