import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { AppFonts, Brand, Radius } from '@/constants/theme';

interface FormFieldProps extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
}

export function FormField({ label, error, hint, style, ...props }: FormFieldProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        placeholderTextColor={Brand.textSecondary}
        style={[styles.input, error ? styles.invalid : undefined, style]}
      />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
        : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: { fontFamily: AppFonts.bodySemiBold, fontSize: 14, color: Brand.text },
  input: {
    fontFamily: AppFonts.body,
    borderWidth: 1.5,
    borderColor: Brand.border,
    borderRadius: Radius.button,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: Brand.text,
    backgroundColor: '#fff',
  },
  invalid: { borderColor: '#B91C1C' },
  error: { fontFamily: AppFonts.body, color: '#B91C1C', fontSize: 13 },
  hint: { fontFamily: AppFonts.body, color: Brand.textSecondary, fontSize: 13 },
});
