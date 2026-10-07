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
