import AsyncStorage from '@react-native-async-storage/async-storage';

// One-time UI hints (coach marks). A hint is shown until the player has done
// the thing it teaches once; then it is marked here and never shown again.
const PREFIX = 'squigglepig.hint.';

export async function hintLearned(name: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(PREFIX + name)) === '1';
  } catch {
    return false;
  }
}

export async function markHintLearned(name: string) {
  try {
    await AsyncStorage.setItem(PREFIX + name, '1');
  } catch {}
}
