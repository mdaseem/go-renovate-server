// Escapes regex metacharacters in free text before it is used to build a RegExp or a Mongo $regex,
// so a query like "A/C (window)" cannot throw, match unintended text, or be used to build a pattern
// that runs for ages (ReDoS).
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const MAX_SEARCH_TEXT_LENGTH = 100;

// Turns untrusted search text (for example what the AI model passes to a tool) into a safe,
// case-insensitive literal-match filter value, or null if there is nothing usable. Non-strings
// (objects like { "$ne": "" }) are rejected rather than coerced.
export function safeContainsFilter(value: unknown): { $regex: string; $options: "i" } | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, MAX_SEARCH_TEXT_LENGTH);
  if (!trimmed) return null;
  return { $regex: escapeRegExp(trimmed), $options: "i" };
}
