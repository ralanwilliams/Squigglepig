import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { RunShell } from '../../src/arcade/RunShell';
import { gameById } from '../../src/arcade/games';

// One game's solo run (src/arcade/RunShell.tsx), at /arcade/<id>. An id this
// build doesn't offer (a dev game in a release build, an old link) goes back
// to the game list.
export default function ArcadeGame() {
  const { game } = useLocalSearchParams<{ game: string }>();
  const found = gameById(game);
  if (!found) return <Redirect href="/arcade" />;
  return <RunShell key={found.id} game={found} />;
}
