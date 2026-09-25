import { Children, Fragment, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { AppFonts, Brand, Radius } from '@/constants/theme';

// Native-style grouped list: one rounded container per section with inset hairlines between
// rows, instead of a separate card per item.
// `bare` keeps the title and footer but skips the rounded container, for content that draws its own
// surface (such as an empty state).
export function Section({ title, footer, bare, children }: { title?: string; footer?: string; bare?: boolean; children: ReactNode }) {
  const rows = Children.toArray(children);
  return (
    <View style={styles.section}>
      {title ? <Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text> : null}
      {bare ? children : <View style={styles.group}>
        {rows.map((row, index) => (
          <Fragment key={index}>
            {index > 0 ? <View style={styles.hairline} /> : null}
            {row}
          </Fragment>
        ))}
      </View>}
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
  destructive?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
}

export function Row({ label, value, note, icon, destructive, onPress, disabled, testID }: RowProps) {
  const color = destructive ? Brand.danger : Brand.text;
  const content = (
    <>
      {icon ? (
        <View style={[styles.iconWell, destructive && { backgroundColor: Brand.dangerLight }]}>
          <Icon name={icon} size={18} color={destructive ? Brand.danger : Brand.primary} />
        </View>
      ) : null}
      <View style={styles.rowText}>
        <Text style={[styles.label, { color }]}>{label}</Text>
        {value ? <Text style={styles.value} selectable>{value}</Text> : null}
      </View>
      {note ? <Text style={styles.note}>{note}</Text> : null}
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
      style={({ pressed }) => [styles.row, pressed && styles.pressed, disabled && styles.disabled]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  sectionTitle: { fontFamily: AppFonts.bodySemiBold, fontSize: 14, color: Brand.textSecondary, paddingHorizontal: 4 },
  group: { backgroundColor: Brand.surface, borderRadius: Radius.card, borderWidth: 1, borderColor: Brand.divider, overflow: 'hidden' },
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
