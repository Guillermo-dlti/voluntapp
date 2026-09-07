import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppFonts, Brand, Radius } from '@/constants/theme';

export default function SignUp() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function handleSignUp() {
    // TODO: real account creation once the backend is built 
    // For now this only proves the navigation flow: sign-up -> tabs.
    router.replace('/(tabs)');
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Crear Cuenta</Text>

      <TextInput
        style={styles.input}
        placeholder="Nombre"
        placeholderTextColor={Brand.textSecondary}
        value={name}
        onChangeText={setName}
      />
      <TextInput
        style={styles.input}
        placeholder="Correo electrónico"
        placeholderTextColor={Brand.textSecondary}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        placeholderTextColor={Brand.textSecondary}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <Pressable style={styles.button} onPress={handleSignUp}>
        <Text style={styles.buttonText}>Registrarse</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  title: {
    fontFamily: AppFonts.heading,
    fontSize: 20,
    color: Brand.text,
    marginBottom: 24,
  },
  input: {
    fontFamily: AppFonts.body,
    borderWidth: 1.5,
    borderColor: Brand.border,
    borderRadius: Radius.button,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: Brand.text,
  },
  button: {
    backgroundColor: Brand.primary,
    borderRadius: Radius.button,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: {
    fontFamily: AppFonts.bodySemiBold,
    color: '#fff',
    fontSize: 16,
  },
});