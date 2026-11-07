import React, { useEffect, useRef, useState } from 'react';
import { router, useIsFocused } from 'expo-router';
import { Stage } from '../src/components/Stage';
import { Logo } from '../src/components/Logo';
import { Heading } from '../src/components/Heading';
import { PigButton } from '../src/components/PigButton';
import { SnoutSecret } from '../src/components/SnoutSecret';
import { showToast } from '../src/components/Toast';
import { IMAGES } from '../src/assets/assets';
import { entryMessage, useGame } from '../src/state/GameContext';
import { PLAYABLE } from '../src/arcade/games';
import { clearSession, loadSession } from '../src/lib/session';
import { showWalkthrough, tutorialDone } from '../src/lib/tutorial';

// The saved room is gone back into once per launch (a second home screen, or
// coming back to this one, doesn't try again).
let launchChecked = false;

// Home screen (was pages/Home.js). On launch it checks for a saved session and
// goes back into that room — the player is still in it until they tap Leave
// game or it closes — so a returning player skips the username/room entry. If
// the room has gone, it says so and stays here. Otherwise, until the player
// has finished or skipped it once, the first-run walkthrough opens over it
// (src/lib/tutorial.ts). Play Solo (app/arcade) shows whenever there's a solo
// game this build offers (src/arcade/games). The menu's ☰ shows once the
// check is done.
//
// The room's lobby sits over this screen, so Back from the lobby (or the
// scoreboard) comes here with the player still in the room: Back to room
// takes them back, and the game brings them back by itself when it starts.
//
// It's always at the bottom of the stack (app/_layout.tsx), so it can be put
// there under another screen: the app opening on a room link (Join). Then the
// link is what the player came for (joining takes them out of any other
// room), so the saved room isn't gone back into, and the walkthrough waits
// until home is on screen. (It's the app's one walkthrough, the menu's How to
// play too: showWalkthrough. If going elsewhere closes it before it's
// finished or skipped, it opens again the next time home is on screen.)
export default function Home() {
  const { enterRoom, room, returnToRoom } = useGame();
  const focused = useIsFocused();
  const [checking, setChecking] = useState(!launchChecked && focused);
  const rejoined = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!launchChecked) {
        launchChecked = true;
        const s = focused ? await loadSession() : null;
        if (s) {
          const status = await enterRoom(s.room, s.username, true); // rejoins + syncs into the live round
          if (status === 'ok') {
            // In the room (its screen is over this one now): this is the home
            // screen to come back to, no walkthrough over it.
            rejoined.current = true;
            if (active) setChecking(false);
            return;
          }
          // Gone (closed, or left from another screen): forget it. Offline: keep
          // it, so the next launch tries again.
          if (status !== 'offline') clearSession();
          showToast(entryMessage(status), 4000);
        }
      }
      if (active) setChecking(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  // The first-run walkthrough, whenever home is on screen until it's been
  // finished or skipped (not over a home the launch went back into a room from).
  useEffect(() => {
    if (checking || !focused || rejoined.current) return;
    let active = true;
    tutorialDone().then((done) => {
      if (active && !done) showWalkthrough();
    });
    return () => {
      active = false;
    };
  }, [checking, focused]);

  // Same Stage as the real home screen so the pig doesn't jump when the buttons
  // swap in.
  if (checking) {
    return (
      <Stage focus={<Logo source={IMAGES.home} />} actions={<Heading>Reconnecting…</Heading>} />
    );
  }

  return (
    <Stage
      menu
      focus={
        <Logo source={IMAGES.home}>
          <SnoutSecret />
        </Logo>
      }
      actions={
        <>
          {room ? <PigButton name={`Back to room ${room}`} onPress={returnToRoom} /> : null}
          <PigButton name="Create Game" onPress={() => router.push('/create')} />
          <PigButton name="Join Game" onPress={() => router.push('/join')} />
          {PLAYABLE.length ? <PigButton name="Play Solo" onPress={() => router.push('/arcade')} /> : null}
        </>
      }
    />
  );
}
