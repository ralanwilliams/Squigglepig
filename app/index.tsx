import React, { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Stage } from '../src/components/Stage';
import { Logo } from '../src/components/Logo';
import { Heading } from '../src/components/Heading';
import { PigButton } from '../src/components/PigButton';
import { HowToModal } from '../src/components/HowToModal';
import { SnoutSecret } from '../src/components/SnoutSecret';
import { IMAGES } from '../src/assets/assets';
import { useGame } from '../src/state/GameContext';
import { loadSession } from '../src/lib/session';

// Home screen (was pages/Home.js). On launch it checks for a saved session and
// auto-rejoins that room, so a returning player skips the username/room entry.
export default function Home() {
  const { enterRoom } = useGame();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    loadSession().then((s) => {
      if (!active) return;
      if (s) enterRoom(s.room, s.username); // rejoins + syncs into the live round
      else setChecking(false);
    });
    return () => {
      active = false;
    };
  }, []);

  // Same Stage as the real home screen so the pig doesn't jump when the buttons
  // swap in.
  if (checking) {
    return (
      <Stage focus={<Logo source={IMAGES.home} />} actions={<Heading>Reconnecting…</Heading>} />
    );
  }

  return (
    <Stage
      focus={
        <Logo source={IMAGES.home}>
          <SnoutSecret />
        </Logo>
      }
      actions={
        <>
          <PigButton name="Join Game" onPress={() => router.push('/join')} />
          <PigButton name="Create Game" onPress={() => router.push('/create')} />
          <HowToModal />
        </>
      }
    />
  );
}
