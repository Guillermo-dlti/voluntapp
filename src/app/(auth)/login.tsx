import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppFonts, Brand, Radius } from '@/constants/theme';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function handleLogin() {
    // TODO: wire to real auth once backend is decided 
    // For now this just proves the navigation flow: login success -> tabs.
    router.replace('/(tabs)');
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Iniciar Sesión</Text>

      <View style={styles.form}>
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
      </View>

      <Pressable style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>Ingresar</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontFamily: AppFonts.heading,
    fontSize: 20,
    color: Brand.text,
    marginBottom: 32,
  },
  form: {
    gap: 12,
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
  },
  buttonText: {
    fontFamily: AppFonts.bodySemiBold,
    color: '#fff',
    fontSize: 16,
  },
});