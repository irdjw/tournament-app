const MAX_SLUG_LENGTH = 50

/**
 * Converts a venue name into a URL-safe slug.
 *
 * Rules:
 *  - Lowercase
 *  - Non-alphanumeric chars (except hyphens) are removed
 *  - Spaces become hyphens
 *  - Consecutive hyphens are collapsed
 *  - Leading/trailing hyphens are stripped
 *  - Truncated to MAX_SLUG_LENGTH (50) characters
 *  - If `existing` contains the generated slug, appends -2, -3, … until unique
 *
 * @throws if the cleaned slug would be empty (e.g., all-special-char input)
 */
export function generateSlug(name: string, existing: string[] = []): string {
  if (!name || !name.trim()) {
    throw new Error('Venue name cannot be empty')
  }

  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')   // remove non-alphanumeric (keep spaces + hyphens)
    .replace(/\s+/g, '-')           // spaces → hyphens
    .replace(/-+/g, '-')            // collapse consecutive hyphens
    .replace(/^-|-$/g, '')          // strip leading/trailing hyphens
    .slice(0, MAX_SLUG_LENGTH)

  if (!base) {
    throw new Error(`Cannot generate a slug from "${name}" — no valid characters remain`)
  }

  const existingSet = new Set(existing)
  if (!existingSet.has(base)) return base

  let counter = 2
  while (true) {
    const candidate = `${base}-${counter}`
    if (!existingSet.has(candidate)) return candidate
    counter++
  }
}
