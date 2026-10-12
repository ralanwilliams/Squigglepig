import AsyncStorage from '@react-native-async-storage/async-storage';

// Whether this install has finished (or skipped) the first-run walkthrough
// (src/components/Walkthrough.tsx). Until it has, Home opens the walkthrough on
// every launch. The flag lives in app storage, so an app update keeps it and
// only uninstalling (or clearing the app's data) brings the walkthrough back.
const KEY = 'squigglepig.tutorial.done';

export async function tutorialDone(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return true; // storage unavailable: don't trap the player in the walkthrough
  }
}

export function markTutorialDone() {
  AsyncStorage.setItem(KEY, '1').catch(() => {});
}
