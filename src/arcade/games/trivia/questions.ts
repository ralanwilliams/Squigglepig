// The trivia game's questions, as plain data: reading the Open Trivia
// Database's answers, and choosing a run's ten. No storage or network here
// (store.ts does that), so it can be checked on its own.

export type Difficulty = 'easy' | 'medium' | 'hard';

export type Question = {
  text: string;
  correct: string;
  wrong: string[]; // three
  difficulty: Difficulty;
  category: string; // shown over the question
  pack?: true; // one of ours (pack.ts), not OpenTDB's
};

// A run's questions, easiest first: rounds 1–4 easy, 5–7 medium, 8–10 hard.
export const PLAN: Difficulty[] = ['easy', 'easy', 'easy', 'easy', 'medium', 'medium', 'medium', 'hard', 'hard', 'hard'];

// OpenTDB categories to keep, by name. The rest (video games, anime, comics,
// cartoons, board games, musicals, celebrities, gadgets, politics) are either
// niche for a party of all ages or not family-friendly enough to trust
// unread.
const KEEP = new Set([
  'General Knowledge',
  'Entertainment: Books',
  'Entertainment: Film',
  'Entertainment: Music',
  'Entertainment: Television',
  'Science & Nature',
  'Science: Computers',
  'Science: Mathematics',
  'Mythology',
  'Sports',
  'Geography',
  'History',
  'Art',
  'Animals',
  'Vehicles',
]);

// The label shown over a question: OpenTDB's category without its
// "Entertainment: " / "Science: " prefix.
const shortCategory = (name: string) => name.replace(/^(Entertainment|Science): /, '');

// Longer than this won't fit the screen comfortably (the question) or a
// two-line answer button (an answer).
const MAX_TEXT = 180;
const MAX_ANSWER = 60;

// Questions from one OpenTDB response (api.php with type=multiple and
// encode=url3986), decoded, from the kept categories, and short enough to show.
// Anything malformed is dropped rather than trusted.
export function fromOpenTdb(body: unknown): Question[] {
  const results = (body as { response_code?: number; results?: unknown[] })?.results;
  if ((body as { response_code?: number })?.response_code !== 0 || !Array.isArray(results)) return [];
  const out: Question[] = [];
  for (const r of results as Record<string, unknown>[]) {
    try {
      const category = decodeURIComponent(String(r.category));
      const difficulty = String(r.difficulty) as Difficulty;
      const text = decodeURIComponent(String(r.question)).trim();
      const correct = decodeURIComponent(String(r.correct_answer)).trim();
      const wrong = Array.isArray(r.incorrect_answers) ? r.incorrect_answers.map((a) => decodeURIComponent(String(a)).trim()) : [];
      const ok =
        KEEP.has(category) &&
        (difficulty === 'easy' || difficulty === 'medium' || difficulty === 'hard') &&
        r.type === 'multiple' &&
        wrong.length === 3 &&
        text.length > 0 &&
        text.length <= MAX_TEXT &&
        [correct, ...wrong].every((a) => a.length > 0 && a.length <= MAX_ANSWER);
      if (ok) out.push({ text, correct, wrong, difficulty, category: shortCategory(category) });
    } catch {
      // a malformed escape: skip the question
    }
  }
  return out;
}

// A short, stable key for a question, to remember which have been asked.
export function questionKey(q: Pick<Question, 'text'>): string {
  let h = 5381;
  for (let i = 0; i < q.text.length; i++) h = ((h << 5) + h + q.text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// Whether `pool` holds enough of each difficulty for a whole run.
export function covers(pool: Question[]): boolean {
  return (['easy', 'medium', 'hard'] as Difficulty[]).every(
    (d) => pool.filter((q) => q.difficulty === d).length >= PLAN.filter((p) => p === d).length
  );
}

// A run's questions, in PLAN order: each taken at random from `pool` (and
// removed from it), or from `pack` when the pool has none of that difficulty
// left. Returns the run and what's left of the pool.
export function pickRun(pool: Question[], pack: Question[], rand: () => number = Math.random): { run: Question[]; rest: Question[] } {
  const rest = [...pool];
  const spare = [...pack];
  const run: Question[] = [];
  for (const difficulty of PLAN) {
    const from = rest.some((q) => q.difficulty === difficulty) ? rest : spare;
    const choices = from.map((q, i) => [q, i] as const).filter(([q]) => q.difficulty === difficulty);
    if (!choices.length) continue;
    const [q, i] = choices[Math.floor(rand() * choices.length)];
    from.splice(i, 1);
    run.push(q);
  }
  return { run, rest };
}

// The four answers in a random order, and where the right one landed.
export function shuffleAnswers(q: Question, rand: () => number = Math.random): { answers: string[]; correct: number } {
  const answers = [q.correct, ...q.wrong];
  for (let i = answers.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [answers[i], answers[j]] = [answers[j], answers[i]];
  }
  return { answers, correct: answers.indexOf(q.correct) };
}
