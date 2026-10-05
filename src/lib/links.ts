// Shareable room links. The https form opens the app directly where the OS has
// verified that squigglepig.app belongs to it (Android App Links today, iOS
// Universal Links once associatedDomains is set up); everywhere else it lands on
// the small fallback page in site/join.html, which shows the code and offers the
// squigglepig:// scheme as an "open in app" button. expo-router maps the
// /join?room=ABCD path straight onto app/join.tsx, so no extra route is needed.
export const LINK_ORIGIN = 'https://squigglepig.app';

export function roomLink(room: string) {
  return `${LINK_ORIGIN}/join?room=${encodeURIComponent(room)}`;
}
