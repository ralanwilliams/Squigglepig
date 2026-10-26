import React from 'react';
import { router } from 'expo-router';
import { Stage } from '../../src/components/Stage';
import { Logo } from '../../src/components/Logo';
import { Heading } from '../../src/components/Heading';
import { PigButton } from '../../src/components/PigButton';
import { IMAGES } from '../../src/assets/assets';
import { PLAYABLE } from '../../src/arcade/games';

// Solo, from Home's Play Solo button: one button per game this build offers
// (src/arcade/games PLAYABLE). Each game runs at /arcade/<id> (./[game].tsx).
// Home shows the button only while there's a game to play. No title and no
// back arrow (the system back goes Home); the rewards they win and the pig are
// in the menu, under Rewards.
export default function Arcade() {
  return (
    <Stage
      focus={<Logo source={IMAGES.home} />}
      actions={
        <>
          <Heading>Win rounds in a row to fill the pot, then bank it for a reward.</Heading>
          {PLAYABLE.map((g) => (
            <PigButton key={g.id} name={g.label} onPress={() => router.push(`/arcade/${g.id}`)} />
          ))}
        </>
      }
    />
  );
}
