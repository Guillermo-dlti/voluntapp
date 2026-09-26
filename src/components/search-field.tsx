import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Icon } from '@/components/icon';
import { AppFonts, Brand, Radius } from '@/constants/theme';

interface SearchFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  maxLength?: number;
  testID?: string;
}

// Live search box: results follow what's typed, and the clear button empties it in one tap.
export function SearchField({ value, onChangeText, placeholder, maxLength = 100, testID }: SearchFieldProps) {
  return (
    <View style={styles.field}>
      <Icon name={{ ios: 'magnifyingglass', android: 'search' }} size={20} color={Brand.textTertiary} />
      <TextInput testID={testID} value={value} onChangeText={onChangeText} placeholder={placeholder}
        accessibilityLabel={placeholder} placeholderTextColor={Brand.textTertiary} selectionColor={Brand.primary}
        autoCapitalize="none" autoCorrect={false} returnKeyType="search" maxLength={maxLength} style={styles.input} />
      {value ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Borrar búsqueda" hitSlop={10} onPress={() => onChangeText('')}>
          <Icon name={{ ios: 'xmark.circle.fill', android: 'cancel' }} size={20} color={Brand.textTertiary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: Radius.input,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  input: { flex: 1, fontFamily: AppFonts.body, fontSize: 16, color: Brand.text, paddingVertical: 10 },
});
