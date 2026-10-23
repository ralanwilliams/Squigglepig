import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Stage } from '../src/components/Stage';
import { Logo } from '../src/components/Logo';
import { Heading } from '../src/components/Heading';
import { PigButton } from '../src/components/PigButton';
import { MenuButton } from '../src/components/MenuDrawer';
import { SnoutSecret } from '../src/components/SnoutSecret';
import { Walkthrough } from '../src/components/Walkthrough';
import { IMAGES } from '../src/assets/assets';
import { useGame } from '../src/state/GameContext';
import { PLAYABLE } from '../src/arcade/games';
import { loadSession } from '../src/lib/session';
import { markTutorialDone, tutorialDone } from '../src/lib/tutorial';

// Home screen (was pages/Home.js). On launch it checks for a saved session and
// auto-rejoins that room, so a returning player skips the username/room entry.
// Otherwise, until the player has finished or skipped it once, the first-run
// walkthrough opens over it (src/lib/tutorial.ts). Play Solo (app/arcade)
// shows once there's a solo game this build offers: in development builds
// only, until the first real game is in src/arcade/games.
export default function Home() {
  const { enterRoom } = useGame();
  const [checking, setChecking] = useState(true);
  const [walkthrough, setWalkthrough] = useState(false);

  useEffect(() => {
    let active = true;
    loadSession().then(async (s) => {
      if (!active) return;
      if (s) return enterRoom(s.room, s.username); // rejoins + syncs into the live round
      const done = await tutorialDone();
      if (!active) return;
      setWalkthrough(!done);
      setChecking(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const finishWalkthrough = () => {
    markTutorialDone();
    setWalkthrough(false);
  };

  // Same Stage as the real home screen so the pig doesn't jump when the buttons
  // swap in.
  if (checking) {
    return (
      <Stage focus={<Logo source={IMAGES.home} />} actions={<Heading>Reconnecting…</Heading>} />
    );
  }

  return (
    <View style={styles.fill}>
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
            {PLAYABLE.length ? <PigButton name="Play Solo" onPress={() => router.push('/arcade')} /> : null}
          </>
        }
      />
      <MenuButton onHowToPlay={() => setWalkthrough(true)} />
      <Walkthrough visible={walkthrough} onDone={finishWalkthrough} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
