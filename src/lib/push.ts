import { useSyncExternalStore } from 'react';
import { Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { setPushToken } from './rooms';

// Push notifications for a room the player is in but doesn't have open: who
// came and went in the lobby ("Sam has entered - 4 players in the room."),
// who left a game, and, once away, that the game has started, it's their
// turn, their chain is up for judging, or the game is over. The server sends
// them (supabase/rooms.sql) through Expo's push service to the token this
// file registers.
//
// Permission is asked the first time the player reaches a lobby, not at
// launch, and the menu has an on/off switch (MenuDrawer). Off deletes the
// token from the server, so nothing is sent at all. Not on the web, and not
// on a simulator or emulator (they have no push token).
export const pushSupported = Platform.OS !== 'web';

// The Android channel every room notification goes out on (the server names
// it: 'channelId' in public.push).
const CHANNEL = 'rooms';

// A notification that arrives while the app is open isn't shown: the player
// can see the room for themselves.
if (pushSupported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

// A room has one notification, each new one replacing the last on the phone
// (the server gives them all the room's tag: public.push). Opening the app
// clears it: the player can see the room for themselves.
export function clearRoomNotifications() {
  if (!pushSupported) return;
  Notifications.dismissAllNotificationsAsync().catch(() => {});
}

// The player's own on/off choice, saved like the sound switch (src/lib/sound.ts).
// On unless they turn it off; the phone's permission is a separate matter.
const KEY = 'squigglepig.notifications';
let notifyOn = true;
let notifyLoaded = false;
const watchers = new Set<() => void>();
const loaded = AsyncStorage.getItem(KEY)
  .then((v) => {
    if (!notifyLoaded) notifyOn = v !== 'off';
  })
  .catch(() => {})
  .finally(() => {
    notifyLoaded = true;
    watchers.forEach((w) => w());
  });

const watch = (w: () => void) => {
  watchers.add(w);
  return () => {
    watchers.delete(w);
  };
};
// Whether notifications are on; null until the saved choice has loaded.
export const useNotificationsOn = () => useSyncExternalStore(watch, () => (notifyLoaded ? notifyOn : null));

// Get this phone's push token to the server. `ask` shows the system's
// permission prompt if it hasn't been answered yet; without it, only a phone
// that already said yes registers (each launch, so the server's copy stays
// fresh). Never throws: no permission, Expo Go, or a build without push
// credentials just means no notifications.
export async function registerForPush(ask: boolean): Promise<boolean> {
  if (!pushSupported || !Device.isDevice) return false;
  await loaded;
  if (!notifyOn) return false;
  try {
    let perm = await Notifications.getPermissionsAsync();
    // Nothing more at launch (`ask` false) for a phone that hasn't said yes:
    // the question belongs in the lobby.
    if (!perm.granted && !(ask && perm.canAskAgain)) return false;
    // Android 13+ only shows the prompt once the app has a channel.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: 'Game rooms',
        description: 'Players coming and going, the game starting, and your turn',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    if (!perm.granted) perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted) return false;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return await setPushToken(data);
  } catch (e) {
    console.warn('[push] not available:', String(e));
    return false;
  }
}

// The menu's switch. Turning it on asks for permission if it can; if the
// player said no to the system prompt before, only the phone's Settings can
// change that, so it opens them and says 'settings'.
export async function setNotificationsOn(on: boolean): Promise<'ok' | 'settings'> {
  notifyLoaded = true;
  notifyOn = on;
  AsyncStorage.setItem(KEY, on ? 'on' : 'off').catch(() => {});
  watchers.forEach((w) => w());
  if (!on) {
    setPushToken(null);
    return 'ok';
  }
  if (!pushSupported) return 'ok';
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted && !perm.canAskAgain) {
      Linking.openSettings().catch(() => {});
      return 'settings';
    }
  } catch {}
  registerForPush(true);
  return 'ok';
}
