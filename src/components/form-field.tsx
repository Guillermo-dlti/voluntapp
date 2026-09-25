import { forwardRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { AppFonts, Brand, Radius } from '@/constants/theme';

interface FormFieldProps extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
}

export const FormField = forwardRef<TextInput, FormFieldProps>(function FormField(
  { label, error, hint, style, onFocus, onBlur, ...props }, ref,
) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={ref}
        {...props}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        placeholderTextColor={Brand.textTertiary}
        selectionColor={Brand.primary}
        onFocus={(event) => { setFocused(true); onFocus?.(event); }}
        onBlur={(event) => { setFocused(false); onBlur?.(event); }}
        style={[styles.input, focused && styles.focused, error ? styles.invalid : undefined, style]}
      />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
        : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { gap: 8 },
  label: { fontFamily: AppFonts.bodySemiBold, fontSize: 14, color: Brand.text },
  input: {
    fontFamily: AppFonts.body,
    minHeight: 54,
    borderWidth: 1.5,
    borderColor: Brand.border,
    borderRadius: Radius.input,
    paddingHorizontal: 16,
    fontSize: 16,
    color: Brand.text,
    backgroundColor: Brand.surfaceMuted,
  },
  focused: { borderColor: Brand.primary, backgroundColor: Brand.surface },
  invalid: { borderColor: Brand.danger, backgroundColor: Brand.dangerLight },
  error: { fontFamily: AppFonts.body, color: Brand.dangerText, fontSize: 13 },
  hint: { fontFamily: AppFonts.body, color: Brand.textSecondary, fontSize: 13 },
});
