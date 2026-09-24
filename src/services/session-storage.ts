import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const key = 'voluntapp.session';
let webToken: string | null = null;

export async function readSession(): Promise<string | null> {
  return Platform.OS === 'web' ? webToken : SecureStore.getItemAsync(key);
}

export async function saveSession(token: string): Promise<void> {
  if (Platform.OS === 'web') { webToken = token; return; }
  await SecureStore.setItemAsync(key, token, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
}

export async function removeSession(): Promise<void> {
  if (Platform.OS === 'web') { webToken = null; return; }
  await SecureStore.deleteItemAsync(key);
}
