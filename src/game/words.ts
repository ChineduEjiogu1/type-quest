// Word pools (common / punctuation / code) and generateWords(pack, count, weakness?).
const wordPool: string[] = [
    "javascript", "typescript", "react", "function", "variable",
  "loop", "object", "array", "string", "boolean"
];

export function generateWords(count: number): string[] {
    const accumulator: string[] = [];

    for (let i = 0; i < count; i++) {
        const randomIndex = Math.floor(Math.random() * wordPool.length);
        accumulator.push(wordPool[randomIndex]);
    }

    return accumulator;
}