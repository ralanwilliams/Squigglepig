import React from 'react';
import { Logo } from '../components/Logo';
import { IMAGES } from '../assets/assets';
import type { Avatar } from './avatar';

// The winner art, dressed in a player's avatar (avatar.ts): their outfit,
// and their speech bubble saying what they wrote. Fills its pane like any
// Logo; the season's props stay, but for a hat under theirs and the sky under
// their bubble.
export function WinnerPig({ avatar }: { avatar: Avatar }) {
  return <Logo source={IMAGES.winner} avatar={avatar} />;
}
