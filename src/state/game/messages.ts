import { IDLE_MINUTES, type ClosedReason } from '../../lib/rooms';
import { NAME_MAX, ROOM_CODE_LENGTH } from '../../lib/text';
import { MAX_PLAYERS } from '../rules';
import type { EntryStatus } from './types';

// What to tell the player when enterRoom didn't go through. The room code
// messages also say where a code comes from: someone who opens Join Game
// first (an app reviewer, say) can take the code box for a login, when all it
// wants is the code from whoever tapped Create Game.
const CODE_HELP = 'Get it from the player who created the room, or go back and tap Create Game to start your own.';
export function entryMessage(status: EntryStatus, code = ''): string {
  switch (status) {
    case 'ok':
      return '';
    case 'no_name':
      return 'Type a player name first.';
    case 'no_code':
      return `You need a room code to join a game. ${CODE_HELP}`;
    case 'bad_code':
      return `Room codes are ${ROOM_CODE_LENGTH} letters and numbers. ${CODE_HELP}`;
    case 'bad_name':
      return `Names can be up to ${NAME_MAX} characters.`;
    case 'not_found':
      return code
        ? `There's no room ${code}. Check the code with the player who created the room, or go back and tap Create Game to start your own.`
        : 'That room has closed.';
    case 'in_progress':
      return 'That game has already started. Try again when it ends.';
    case 'room_full':
      return `That room is full: it has the most players a room can hold (${MAX_PLAYERS}). Try again if someone leaves, or go back and tap Create Game to start your own.`;
    case 'name_taken':
      return 'Someone in that room already has that name. Pick another.';
    case 'no_keys':
      return '⚠ Supabase keys not loaded — check .env, then: npx expo start -c';
    default:
      return 'Couldn’t reach the game server. Check your connection and try again.';
  }
}

// Why the room closed under the player (rooms.ts ClosedReason): nobody did
// anything in it for a while, or too few players were left in its game to
// play on (then everyone still in it is out, and starts again).
export const closedMessage = (code: string, reason: ClosedReason = 'idle') =>
  reason === 'players'
    ? "There aren't enough players left to keep playing. Create a new game to play again."
    : `Room ${code} closed after ${IDLE_MINUTES} minutes of inactivity.`;
