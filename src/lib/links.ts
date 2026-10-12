// Shareable room links. The https form opens the app directly where the OS has
// verified that squigglepig.app belongs to it (Android App Links today, iOS
// Universal Links once associatedDomains is set up); everywhere else it lands on
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
// TODO: the App Store listing, once the Apple developer account exists. While
// it's null, iOS hides "Rate this app".
export const APP_STORE_URL: string | null = null;
export const HELP_URL = `${LINK_ORIGIN}/help`;
export const PRIVACY_URL = 'https://sites.google.com/view/squigglepig-privacy-policy/home';
export const TERMS_URL = `${LINK_ORIGIN}/terms`;
export const DEVELOPER_URL = 'https://ralanwilliams.com';

// The snout secret's reward (src/components/SnoutSecret.tsx).
export const CV_URL = 'https://ralanwilliams.com/cv/en.pdf';
