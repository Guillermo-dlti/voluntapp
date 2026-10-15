import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Room to leave at the bottom so content and sticky actions clear the tab bar. iOS draws its tab bar
// over the screen and reports it (plus the home indicator) as the bottom safe area; Android lays the
// screen out above its bar already, so there is nothing to add there.
export function useTabBarInset(): number {
  const { bottom } = useSafeAreaInsets();
  return Platform.OS === 'ios' ? bottom : 0;
}
