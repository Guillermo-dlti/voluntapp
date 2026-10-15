import { StyleSheet, Text, View } from 'react-native';

import { Button, type ButtonProps } from '@/components/button';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { Brand, Radius, Spacing, Type } from '@/constants/theme';

interface EmptyStateProps {
  icon: Parameters<typeof Icon>[0]['name'];
  title: string;
  body: string;
  // The way out, right under the words that explain it ("Reintentar"), instead of a loose button below.
  // Secondary unless it's the screen's main action ("Iniciar asistencia").
  action?: ButtonProps;
  // No card: for a screen whose whole list is empty, where the message sits on the sheet itself
  // (after Medium and Apple's empty lists). Inside a section, keep the card.
  bare?: boolean;
  testID?: string;
}

export function EmptyState({ icon, title, body, action, bare = false, testID }: EmptyStateProps) {
  const content = (
    <View testID={bare ? testID : undefined} style={[styles.container, bare && styles.bare]}>
      <View style={styles.badge}>
        <Icon name={icon} size={26} color={Brand.primary} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
      {action ? (
        <View style={styles.action}>
          <Button variant="secondary" {...action} />
        </View>
      ) : null}
    </View>
  );
  return bare ? content : <Card testID={testID}>{content}</Card>;
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.lg, paddingHorizontal: Spacing.sm },
  bare: { paddingVertical: Spacing.xxl },
  badge: { width: 56, height: 56, borderRadius: Radius.tile, backgroundColor: Brand.primaryLight, alignItems: 'center', justifyContent: 'center' },
  text: { alignItems: 'center', gap: Spacing.xs },
  title: { ...Type.headline, color: Brand.text, textAlign: 'center' },
  body: { ...Type.callout, color: Brand.textSecondary, textAlign: 'center', maxWidth: 300 },
  action: { alignSelf: 'stretch', marginTop: Spacing.xs },
});
