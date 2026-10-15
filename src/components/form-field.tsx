import { forwardRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Brand, Radius, Spacing, Type } from '@/constants/theme';

interface FormFieldProps extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
  // Inside the box, after the text: a show/hide password button.
  trailing?: ReactNode;
}

// White input with the same 1 px border as every other control, so it reads as a place to type
// rather than a gray block inside a white card.
export const FormField = forwardRef<TextInput, FormFieldProps>(function FormField(
  { label, error, hint, trailing, style, onFocus, onBlur, ...props }, ref,
) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.box, focused && styles.focused, error ? styles.invalid : undefined]}>
        <TextInput
          ref={ref}
          {...props}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          placeholderTextColor={Brand.textTertiary}
          selectionColor={Brand.primary}
          onFocus={(event) => { setFocused(true); onFocus?.(event); }}
          onBlur={(event) => { setFocused(false); onBlur?.(event); }}
          style={[styles.input, style]}
        />
        {trailing}
      </View>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
        : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
});

// A titled group of fields. The fields sit straight on the sheet, without a card around them: white
// inputs on the light green background read as places to type (after LinkedIn's event form),
// instead of boxes inside a box.
export function FieldGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Text accessibilityRole="header" style={styles.groupTitle}>{title}</Text>
      <View style={styles.groupBody}>{children}</View>
    </View>
  );
}

// Shared with DateField and TimeField so every field box looks the same.
export const fieldBox = {
  box: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: Radius.input,
    backgroundColor: Brand.surface,
  },
  // The 1 px border turns green and gains a second pixel by outline, so focus is clear without the
  // box shifting its content.
  focused: { borderColor: Brand.primary, outlineWidth: 1, outlineColor: Brand.primary },
  invalid: { borderColor: Brand.danger, backgroundColor: Brand.dangerLight },
  // Words around a box sit 4 dp in from its edge, like section titles over a card.
  label: { ...Type.calloutStrong, color: Brand.text, paddingHorizontal: Spacing.xs },
  error: { ...Type.footnote, color: Brand.dangerText, paddingHorizontal: Spacing.xs },
  hint: { ...Type.footnote, color: Brand.textSecondary, paddingHorizontal: Spacing.xs },
} as const;

const styles = StyleSheet.create({
  container: { gap: Spacing.sm },
  group: { gap: Spacing.sm },
  groupTitle: { ...Type.calloutStrong, color: Brand.textSecondary, paddingHorizontal: Spacing.xs },
  groupBody: { gap: Spacing.lg },
  ...fieldBox,
  input: { flex: 1, fontFamily: Type.body.fontFamily, fontSize: Type.body.fontSize, minHeight: 52, paddingHorizontal: Spacing.lg, color: Brand.text },
});
