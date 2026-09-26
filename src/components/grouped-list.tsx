import { Children, Fragment, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { AppFonts, Brand } from '@/constants/theme';

// Native-style grouped list: one rounded container per section with inset hairlines between
// rows, instead of a separate card per item.
// `bare` keeps the title and footer but skips the rounded container, for content that draws its own
// surface (such as an empty state).
export function Section({ title, footer, bare, children }: { title?: string; footer?: string; bare?: boolean; children: ReactNode }) {
  const rows = Children.toArray(children);
  return (
    <View style={styles.section}>
      {title ? <Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text> : null}
      {bare ? children : <Card padded={false}>
        {rows.map((row, index) => (
          <Fragment key={index}>
            {index > 0 ? <View style={styles.hairline} /> : null}
            {row}
          </Fragment>
        ))}
      </Card>}
      {footer ? <Text style={styles.footer}>{footer}</Text> : null}
    </View>
  );
}

interface RowProps {
  label: string;
  value?: string;
  // A trailing note such as "Próximamente", rendered quieter than a value.
  note?: string;
  icon?: Parameters<typeof Icon>[0]['name'];
  // Custom leading element (an Avatar) in place of the icon, and a trailing one (a StatusBadge).
  leading?: ReactNode;
  trailing?: ReactNode;
  destructive?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
}

export function Row({ label, value, note, icon, leading, trailing, destructive, onPress, disabled, testID }: RowProps) {
  const color = destructive ? Brand.danger : Brand.text;
  const content = (
    <>
      {icon ? (
        <View style={[styles.iconWell, destructive && { backgroundColor: Brand.dangerLight }]}>
          <Icon name={icon} size={18} color={destructive ? Brand.danger : Brand.primary} />
        </View>
      ) : leading}
      <View style={styles.rowText}>
        <Text style={[styles.label, { color }]}>{label}</Text>
        {value ? <Text style={styles.value} selectable>{value}</Text> : null}
      </View>
      {note ? <Text style={styles.note}>{note}</Text> : null}
      {trailing}
      {onPress && !destructive ? <Icon name={{ ios: 'chevron.right', android: 'chevron_right' }} size={18} color={Brand.textTertiary} /> : null}
    </>
  );
  if (!onPress) return <View testID={testID} style={styles.row}>{content}</View>;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      android_ripple={{ color: Brand.surfaceMuted }}
      style={({ pressed }) => [styles.row, pressed && process.env.EXPO_OS !== 'android' && styles.pressed, disabled && styles.disabled]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  sectionTitle: { fontFamily: AppFonts.bodySemiBold, fontSize: 14, color: Brand.textSecondary, paddingHorizontal: 4 },
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: Brand.border, marginLeft: 16 },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 12 },
  pressed: { backgroundColor: Brand.surfaceMuted },
  disabled: { opacity: 0.6 },
  iconWell: { width: 34, height: 34, borderRadius: 10, backgroundColor: Brand.primaryLight, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  label: { fontFamily: AppFonts.body, fontSize: 16 },
  value: { fontFamily: AppFonts.body, fontSize: 14, color: Brand.textSecondary },
  note: { fontFamily: AppFonts.body, fontSize: 13, color: Brand.textTertiary },
  footer: { fontFamily: AppFonts.body, fontSize: 13, color: Brand.textSecondary, paddingHorizontal: 4, lineHeight: 18 },
});
