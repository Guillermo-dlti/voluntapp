import { Children, Fragment, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { Brand, Radius, Spacing, Type } from '@/constants/theme';

// Row anatomy, shared with rows built elsewhere (ActivityRow, RollCallRow) so their dividers line up.
export const RowMetrics = { padding: Spacing.lg, gap: 14, iconWell: 34, avatar: 40, tile: 48 } as const;

// Where the hairline between rows starts: under the text, not under the icon, avatar or date tile
// (after iOS and Shopify lists), so the leading column reads as one clean edge.
const insets = {
  none: RowMetrics.padding,
  icon: RowMetrics.padding + RowMetrics.iconWell + RowMetrics.gap,
  avatar: RowMetrics.padding + RowMetrics.avatar + RowMetrics.gap,
  tile: RowMetrics.padding + RowMetrics.tile + RowMetrics.gap,
} as const;

interface SectionProps {
  title?: string;
  // Quiet count after the title ("11"), after Revolut's "All · 2".
  count?: string;
  footer?: string;
  // Keeps the title and footer but skips the rounded container, for content that draws its own
  // surface (such as an empty state).
  bare?: boolean;
  // What leads the rows, so the dividers start where their text does.
  inset?: keyof typeof insets;
  children: ReactNode;
}

// Native-style grouped list: one rounded container per section with inset hairlines between
// rows, instead of a separate card per item.
export function Section({ title, count, footer, bare, inset = 'none', children }: SectionProps) {
  const rows = Children.toArray(children);
  return (
    <View style={styles.section}>
      {title ? (
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          {title}{count ? <Text style={styles.count}>{`  ·  ${count}`}</Text> : null}
        </Text>
      ) : null}
      {bare ? children : <Card padded={false}>
        {rows.map((row, index) => (
          <Fragment key={index}>
            {index > 0 ? <View style={[styles.hairline, { marginLeft: insets[inset] }]} /> : null}
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
  // 'value' for a record's fields (Horario, Lugar): the label becomes a small caption and the value
  // reads first, like Luma's and Outlook's event details.
  emphasis?: 'label' | 'value';
  // A trailing note such as "Próximamente", rendered quieter than a value.
  note?: string;
  icon?: Parameters<typeof Icon>[0]['name'];
  // Custom leading element (an Avatar) in place of the icon, and a trailing one (a StatusBadge).
  leading?: ReactNode;
  trailing?: ReactNode;
  destructive?: boolean;
  // 'link' for "Ver todas": tinted like Apple Health's "Show All", since it leads to more of the same list.
  tone?: 'default' | 'link';
  onPress?: () => void;
  disabled?: boolean;
  // false for rows that are a choice (a radio), not a way to another screen.
  chevron?: boolean;
  testID?: string;
}

export function Row({ label, value, emphasis = 'label', note, icon, leading, trailing, destructive, tone = 'default', onPress, disabled, chevron = true, testID }: RowProps) {
  const color = destructive ? Brand.danger : tone === 'link' ? Brand.primary : Brand.text;
  const content = (
    <>
      {icon ? (
        <View style={[styles.iconWell, destructive && { backgroundColor: Brand.dangerLight }]}>
          <Icon name={icon} size={18} color={destructive ? Brand.danger : Brand.primary} />
        </View>
      ) : leading}
      <View style={styles.rowText}>
        {emphasis === 'value' && value ? (
          <>
            <Text style={styles.caption}>{label}</Text>
            <Text style={styles.fieldValue} selectable>{value}</Text>
          </>
        ) : (
          <>
            <Text style={[tone === 'link' ? styles.linkLabel : styles.label, { color }]}>{label}</Text>
            {value ? <Text style={styles.value} selectable>{value}</Text> : null}
          </>
        )}
      </View>
      {note ? <Text style={styles.note}>{note}</Text> : null}
      {trailing}
      {onPress && !destructive && chevron ? (
        <Icon name={{ ios: 'chevron.right', android: 'chevron_right' }} size={18}
          color={tone === 'link' ? Brand.primary : Brand.textTertiary} />
      ) : null}
    </>
  );
  // A disabled row without an action ("Próximamente") is dimmed too, so it doesn't look like a dead link.
  if (!onPress) return <View testID={testID} style={[styles.row, disabled && styles.disabled]}>{content}</View>;
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      android_ripple={{ color: Brand.surfaceMuted }}
      style={[styles.row, disabled && styles.disabled]}>
      {content}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.sm },
  sectionTitle: { ...Type.calloutStrong, color: Brand.textSecondary, paddingHorizontal: Spacing.xs },
  count: { ...Type.callout, color: Brand.textTertiary },
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: Brand.border },
  row: {
    minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: RowMetrics.gap,
    paddingHorizontal: RowMetrics.padding, paddingVertical: Spacing.md,
  },
  disabled: { opacity: 0.6 },
  iconWell: {
    width: RowMetrics.iconWell, height: RowMetrics.iconWell, borderRadius: Radius.well,
    backgroundColor: Brand.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  label: { ...Type.body },
  linkLabel: { ...Type.bodyStrong },
  value: { ...Type.callout, color: Brand.textSecondary },
  caption: { ...Type.footnote, color: Brand.textSecondary },
  fieldValue: { ...Type.body, color: Brand.text },
  note: { ...Type.footnote, color: Brand.textTertiary },
  footer: { ...Type.footnote, color: Brand.textSecondary, paddingHorizontal: Spacing.xs },
});
