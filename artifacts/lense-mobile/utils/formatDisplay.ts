/**
 * Converts a string to title case (e.g. "running shoes" → "Running Shoes").
 * Used to display raw DB values like sport/level in a human-readable format.
 */
export function toTitleCase(value: string): string {
  return value
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
