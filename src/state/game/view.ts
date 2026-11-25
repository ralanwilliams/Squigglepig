import type { Member } from '../../lib/rooms';
import {
  chainOwner,
  effectiveLeader,
  isTurnPhase,
  outdatedPlayers,
  roomHost,
  stillToGo,
  type Chain,
  type Phase,
} from '../rules';
import type { ConnStatus } from './types';

// What the screens see that's worked out from the game rather than kept:
// who's here and who's away, the host, who judges. Pure, so it's tested on
// its own (tests/game-view.test.ts).
export type ViewInput = {
  username: string;
  members: Member[];
  presentIds: string[];
  status: ConnStatus;
  gameNames: string[];
  phase: Phase;
  stage: number;
  chains: Chain[];
  revealIndex: number;
  judgeWait: string;
  roster: string[]; // this round's
  skip: Set<string>; // out of this round's rotation
  versions: Map<string, number>; // which scoring rules each phone knows
  leader: string; // this round's leader
};

export type View = {
  players: string[];
  away: string[];
  departed: string[];
  stillWorking: string[];
  host: string;
  canStart: boolean;
  outdated: string[];
  leader: string;
  judge: string;
  isJudge: boolean;
};

export function deriveView(v: ViewInput): View {
  const here = new Set(v.presentIds);
  const active = v.members.filter((m) => m.leftAt == null);
  const players = active.map((m) => m.name);
  const present = active.filter((m) => here.has(m.id)).map((m) => m.name);
  // Nobody is away until presence has reported at least once (this phone is
  // always in it), or the whole room would flash AWAY on the way in.
  const away =
    v.status === 'connected' && v.presentIds.length ? active.filter((m) => !here.has(m.id)).map((m) => m.name) : [];
  const departed = v.members.length ? v.gameNames.filter((n) => !players.includes(n)) : [];
  // Who's still at this stage's turn (`chains` moves as each turn comes in).
  const stillWorking = isTurnPhase(v.phase) ? stillToGo(v.roster, v.chains, v.stage, v.skip, v.username) : [];

  // The host is the longest in, away or not; while they're away, anyone here
  // can start the game.
  const host = roomHost(v.members);
  const isHost = v.username !== '' && v.username === host;
  const canStart = isHost || (present.includes(v.username) && !present.includes(host));
  // Read with presence, which every version change comes in on (presentIds).
  const outdated = outdatedPlayers(v.members, v.versions);

  // The round leader judges the reveal, but if they don't have the app open
  // the role falls to the first one here (the longest in) so it never stalls.
  const leader = effectiveLeader(v.leader, present);
  const judge = (() => {
    const owner = chainOwner(v.chains[v.revealIndex]);
    if (owner && present.includes(owner)) return owner;
    if (v.judgeWait) return ''; // waiting for the owner to come back
    return leader;
  })();
  return {
    players,
    away,
    departed,
    stillWorking,
    host,
    canStart,
    outdated,
    leader,
    judge,
    isJudge: v.username !== '' && v.username === judge,
  };
}
