/**
 * In-repo tablature used by the `local` provider.
 *
 * These are short, public-domain / traditional pieces written out by hand so the
 * app has real content to render without depending on a third-party source.
 * Add entries here (or swap this module for a database) as the library grows.
 */

export type SeedTab = {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  type: "tab" | "chords" | "bass" | "drums" | "ukulele" | "pro";
  tuning: string[] | null;
  capo: number | null;
  difficulty: "beginner" | "intermediate" | "advanced" | null;
  content: string;
};

/** Low string first, matching how tunings are read aloud. */
const STANDARD = ["E", "A", "D", "G", "B", "E"];

export const seedTabs: SeedTab[] = [
  {
    id: "greensleeves",
    title: "Greensleeves",
    artist: "Traditional",
    album: null,
    type: "tab",
    tuning: STANDARD,
    capo: 0,
    difficulty: "beginner",
    content: `[Intro]
e|-----------------|-----------------|
B|-----0-----------|-----3-----------|
G|---0---0---2-----|---0---0---0-----|
D|-2-------2-------|-0-------0-------|
A|-----------------|-----------------|
E|-----------------|-----------------|

[Verse]
e|-----------------|-----------------|
B|-----1-----3-----|-----0-----------|
G|---2---2---0---0-|---0---0---2-----|
D|-0-------0-------|-2-------2-------|
A|-----------------|-----------------|
E|-----------------|-----------------|`,
  },
  {
    id: "house-of-the-rising-sun",
    title: "House of the Rising Sun",
    artist: "Traditional",
    album: null,
    type: "chords",
    tuning: STANDARD,
    capo: 0,
    difficulty: "beginner",
    content: `[Chords]
Am     C      D      F      E
x02210 x32010 xx0232 133211 022100

[Verse 1]
Am        C          D            F
There is a house in New Orleans
Am        C       E
They call the Rising Sun
Am         C        D          F
And it's been the ruin of many a poor boy
Am      E        Am
And God I know I'm one

[Picking pattern]
e|-------0-------0-|-------0-------0-|
B|-----1---1-----1-|-----1---1-----1-|
G|---2-------2---2-|---0-------0---0-|
D|-2---------------|-2---------------|
A|-0---------------|-3---------------|
E|-----------------|-----------------|`,
  },
  {
    id: "scarborough-fair",
    title: "Scarborough Fair",
    artist: "Traditional",
    album: null,
    type: "tab",
    tuning: STANDARD,
    capo: 7,
    difficulty: "intermediate",
    content: `[Capo 7 — play in Am shapes, sounds in Em]

[Intro]
e|---------------0-|-----------------|
B|-------1---1-----|-------1---------|
G|-----2---2-------|-----2---2-------|
D|---2-------------|---2-------------|
A|-0---------------|-0---------------|
E|-----------------|-----------------|

[Verse]
e|-----------------|-----------------|
B|-----1-----1-----|-----0-----1-----|
G|---2---2---0---0-|---0---0---2---2-|
D|-2-------2-------|-2-------0-------|
A|-0---------------|-----------------|
E|-----------------|-3---------------|`,
  },
  {
    id: "ode-to-joy",
    title: "Ode to Joy",
    artist: "Ludwig van Beethoven",
    album: "Symphony No. 9",
    type: "tab",
    tuning: STANDARD,
    capo: 0,
    difficulty: "beginner",
    content: `[Melody]
e|-----------------|-----------------|
B|-0-0-1-3-3-1-0---|---0-0-1-3-3-1-0-|
G|---------------0-|-0---------------|
D|-----------------|-----------------|
A|-----------------|-----------------|
E|-----------------|-----------------|

e|-----------------|-----------------|
B|-0-------0-0-----|-0-0-1-3-3-1-0---|
G|---0-0-2-----2-0-|---------------0-|
D|-----------------|-0---------------|
A|-----------------|-----------------|
E|-----------------|-----------------|`,
  },
  {
    id: "canon-in-d-bass",
    title: "Canon in D",
    artist: "Johann Pachelbel",
    album: null,
    type: "bass",
    tuning: ["E", "A", "D", "G"],
    capo: 0,
    difficulty: "beginner",
    content: `[Bass line — the eight-chord loop]
G|-----------------------------------|
D|-----------------------------------|
A|-5-------0-------2-------------0---|
E|-----------------------3-----------|
   D       A       Bm      F#m     G

G|-----------------------------------|
D|-----------------------------------|
A|-------0-------5-------------------|
E|-3-------------------------5-------|
   G       D       G       A`,
  },
];
