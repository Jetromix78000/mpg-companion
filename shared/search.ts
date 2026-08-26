/**
 * Utility functions for optimizing and repairing player searches
 */

/**
 * Normalizes text by removing accents, diacritics, and converting to lowercase.
 * This ensures that queries like "mbappe" match "Mbappé", "zaire" matches "Zaïre-Emery",
 * and "odegaard" matches "Ødegaard".
 */
export function normalizeText(text: string): string {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove standard accents
    .toLowerCase()
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/œ/g, "oe")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9\s]/g, " ") // Clean up special characters to space
    .replace(/\s+/g, " ") // Collapse spaces
    .trim();
}

/** Dernier mot d'un nom normalisé : l'API Football abrège en "Initiale. Nom". */
export function lastNameToken(name: string): string {
  const tokens = normalizeText(name).split(" ").filter(Boolean);
  return tokens[tokens.length - 1] ?? "";
}

/**
 * Checks if a player matches a search query based on multiple fields.
 * Performs a smart check against normalized full name, short name, and team name.
 */
export function matchPlayer(
  player: { fullName: string; name?: string; team?: string },
  query: string,
): boolean {
  if (!query) return false;

  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return false;

  const normalizedFullName = normalizeText(player.fullName);
  const normalizedName = player.name ? normalizeText(player.name) : "";
  const normalizedTeam = player.team ? normalizeText(player.team) : "";

  // Split query into terms for multi-word search (e.g. "kylian mbappe" or "psg mbappe")
  const queryTerms = normalizedQuery.split(" ").filter(Boolean);

  // All terms must match either the name, full name, or team
  return queryTerms.every(
    (term) =>
      normalizedFullName.includes(term) ||
      normalizedName.includes(term) ||
      normalizedTeam.includes(term),
  );
}
