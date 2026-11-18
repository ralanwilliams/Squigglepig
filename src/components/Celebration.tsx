import React from 'react';
import { FireworksLayer } from './Fireworks';
import { DiscoLayer } from './Disco';
import { RaveLayer } from './Rave';
import { BalloonLayer } from './Balloon';
import { DovesLayer } from './Doves';
import { BALLOON, DISCO, DOVES, FIREWORKS, RAVE } from '../rewards/catalog';

// A winner's celebration (catalog.ts CELEBRATIONS) over the whole screen, from
// `from` (epoch ms): for Stage's `overlay`. On the scoreboard (the game won
// outright) it goes on until the screen does (the balloon and the doves go
// once and away); as Your pig's `preview`, once and briefly, to see it. `say` is
// the winner's words for a celebration that has some (the balloon's: the
// avatar's `cheer`). An id this app has no drawing for shows nothing.
const PREVIEW_MS = 5000; // the disco's or rave's taste on Your pig

export function CelebrationLayer({ id, from, say = '', preview }: { id: string | null | undefined; from: number; say?: string; preview?: boolean }) {
  if (id === FIREWORKS) return preview ? <FireworksLayer from={from} /> : <FireworksLayer from={from} encore />;
  if (id === DISCO) return <DiscoLayer from={from} until={preview ? PREVIEW_MS : undefined} />;
  if (id === RAVE) return <RaveLayer from={from} until={preview ? PREVIEW_MS : undefined} />;
  if (id === BALLOON) return <BalloonLayer from={from} text={say} />;
  if (id === DOVES) return <DovesLayer from={from} />;
  return null;
}
