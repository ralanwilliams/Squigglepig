import React from 'react';
import { Image } from 'expo-image';
import { IMAGES } from '../assets/assets';

// The pig's face from the app icon (logo-192X192.png, the same picture as the
// website's logo, site/logo.png), `size` dp square. `rounded` rounds its
// corners like an app icon (the menu drawer's header); without, it's the bare
// face on the background, as at the top of the website's pages (the
// open-source licenses screen, after the Help & FAQ page). `label` is what a
// screen reader says for it; without one it's skipped, as beside the app's
// name in the drawer.
export function AppMark({ size, rounded = false, label }: { size: number; rounded?: boolean; label?: string }) {
  return (
    <Image
      source={IMAGES.icon}
      style={{ width: size, height: size, borderRadius: rounded ? Math.round(size * 0.22) : 0 }}
      accessible={!!label}
      accessibilityLabel={label}
      accessibilityRole={label ? 'image' : undefined}
    />
  );
}
