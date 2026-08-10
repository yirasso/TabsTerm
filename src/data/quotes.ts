/**
 * Short, widely-attributed aphorisms on music and on learning it, shown on the
 * idle prompt. Kept brief and always attributed.
 */
export type Quote = { text: string; author: string };

export const QUOTES: Quote[] = [
  { text: "Music is the universal language of mankind.", author: "Henry Wadsworth Longfellow" },
  { text: "Where words fail, music speaks.", author: "Hans Christian Andersen" },
  {
    text: "To play a wrong note is insignificant; to play without passion is inexcusable.",
    author: "Ludwig van Beethoven",
  },
  { text: "Music is the arithmetic of sounds.", author: "Claude Debussy" },
  {
    text: "I have learned throughout my life as a composer chiefly through my mistakes.",
    author: "Igor Stravinsky",
  },
  {
    text: "The beautiful thing about learning is that nobody can take it away from you.",
    author: "B. B. King",
  },
  { text: "Learning never exhausts the mind.", author: "Leonardo da Vinci" },
  {
    text: "Music produces a kind of pleasure which human nature cannot do without.",
    author: "Confucius",
  },
  {
    text: "If I miss one day of practice, I notice it. If I miss two, the critics notice it.",
    author: "Ignacy Jan Paderewski",
  },
  { text: "Talent is a pursued interest.", author: "Bob Ross" },
  { text: "Nothing is more difficult than talking about music.", author: "Camille Saint-Saëns" },
  // Nietzsche's "without music, life would be a mistake" is deliberately absent:
  // it is the house quote in /man, and seeing it twice cheapens both.
  {
    text: "An amateur practises until he can play it right; a professional until he cannot play it wrong.",
    author: "Percy C. Buck",
  },
  { text: "The only truth is music.", author: "Jack Kerouac" },
];

const DAY_MS = 86_400_000;

/**
 * The same quote for everyone for a whole UTC day. Derived from the date rather
 * than randomised so it never changes under the reader mid-session.
 */
export function quoteForDay(date: Date): Quote {
  const day = Math.floor(date.getTime() / DAY_MS);
  const index = ((day % QUOTES.length) + QUOTES.length) % QUOTES.length;
  return QUOTES[index] ?? QUOTES[0] ?? { text: "", author: "" };
}
