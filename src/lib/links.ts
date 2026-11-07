// Shareable room links. The https form opens the app directly where the OS has
// verified that squigglepig.app belongs to it (Android App Links and iOS
// Universal Links, from the files in site/.well-known); everywhere else it lands on
// the small fallback page in site/join.html, which shows the code and offers the
// squigglepig:// scheme as an "open in app" button, a store link, and the same
// room in the web build (play.squigglepig.app/join?room=…). The link always
// points at squigglepig.app, never the web build, so a player with the app
// installed gets the app wherever the link was shared from. expo-router maps the
// /join?room=ABCD path straight onto app/join.tsx, so no extra route is needed.
export const LINK_ORIGIN = 'https://squigglepig.app';

export function roomLink(room: string) {
  return `${LINK_ORIGIN}/join?room=${encodeURIComponent(room)}`;
}

// The menu drawer's links (src/components/MenuDrawer.tsx).
export const CONTACT_EMAIL = 'alan@ralanwilliams.com';
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.squigglepig.app';
export const PLAY_STORE_APP_URL = 'market://details?id=com.squigglepig.app'; // opens the Play Store app itself
export const APP_STORE_URL = 'https://apps.apple.com/app/id6822231355';
// Opens the App Store app itself, on the listing's Write a Review sheet.
export const APP_STORE_REVIEW_URL = 'itms-apps://apps.apple.com/app/id6822231355?action=write-review';
export const HELP_URL = `${LINK_ORIGIN}/help`;
export const PRIVACY_URL = 'https://squigglepig.app/privacy';
export const TERMS_URL = `${LINK_ORIGIN}/terms`;
export const DEVELOPER_URL = 'https://ralanwilliams.com';

// The app's own pages the menu drawer opens: Your pig, Rewards (Art supplies
// or Themes) and Licenses. Opened from another one of these, the new page
// takes the old one's place (MenuDrawer.tsx), so they don't pile up. (When
// the game moves on, it takes the player from any of them: src/state/nav.ts.)
export const MENU_PAGES: ReadonlySet<string> = new Set(['/pig', '/rewards', '/licenses']);

// The snout secret's reward (src/components/SnoutSecret.tsx).
export const CV_URL = 'https://ralanwilliams.com/cv/en.pdf';
