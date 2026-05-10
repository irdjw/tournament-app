import { generateSlug } from '../../src/lib/slug'

// ─── Basic slugification ──────────────────────────────────────────────────────

describe('generateSlug — basic transformation', () => {
  it('lowercases the input', () => {
    expect(generateSlug('The Southfield')).toBe('the-southfield')
  })

  it('replaces spaces with hyphens', () => {
    expect(generateSlug('My Venue Name')).toBe('my-venue-name')
  })

  it('removes non-alphanumeric characters (except hyphens)', () => {
    expect(generateSlug("O'Brien's Bar")).toBe('obriens-bar')
    expect(generateSlug('Café & Bistro')).toBe('caf-bistro')
  })

  it('preserves existing hyphens', () => {
    expect(generateSlug('Ye Olde-Inn')).toBe('ye-olde-inn')
  })

  it('collapses consecutive hyphens', () => {
    expect(generateSlug('A  B')).toBe('a-b')
    expect(generateSlug('A - B')).toBe('a-b')
  })

  it('strips leading and trailing hyphens', () => {
    expect(generateSlug('-Leading')).toBe('leading')
    expect(generateSlug('Trailing-')).toBe('trailing')
  })

  it('handles numbers in names', () => {
    expect(generateSlug('Bar 42')).toBe('bar-42')
    expect(generateSlug('Route 66 Diner')).toBe('route-66-diner')
  })
})

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('generateSlug — edge cases', () => {
  it('throws on an empty string', () => {
    expect(() => generateSlug('')).toThrow('Venue name cannot be empty')
  })

  it('throws on a whitespace-only string', () => {
    expect(() => generateSlug('   ')).toThrow('Venue name cannot be empty')
  })

  it('throws when no valid characters remain after cleaning', () => {
    expect(() => generateSlug('!!!')).toThrow(/Cannot generate a slug/)
    expect(() => generateSlug('@#$%')).toThrow(/Cannot generate a slug/)
  })

  it('truncates at 50 characters', () => {
    const long = 'A'.repeat(60)
    const result = generateSlug(long)
    expect(result.length).toBeLessThanOrEqual(50)
  })

  it('truncates a real 60-char name to 50 chars', () => {
    const name = 'The Very Long Venue Name That Goes On And On And On Forever'
    const result = generateSlug(name)
    expect(result.length).toBeLessThanOrEqual(50)
  })
})

// ─── Deduplication ───────────────────────────────────────────────────────────

describe('generateSlug — deduplication', () => {
  it('returns the base slug when existing list is empty', () => {
    expect(generateSlug('Southfield', [])).toBe('southfield')
  })

  it('returns the base slug when not in existing list', () => {
    expect(generateSlug('Southfield', ['other-venue'])).toBe('southfield')
  })

  it('appends -2 when the base slug is taken', () => {
    expect(generateSlug('Southfield', ['southfield'])).toBe('southfield-2')
  })

  it('appends -3 when -2 is also taken', () => {
    expect(generateSlug('Southfield', ['southfield', 'southfield-2'])).toBe('southfield-3')
  })

  it('continues incrementing until a unique suffix is found', () => {
    const taken = ['southfield', 'southfield-2', 'southfield-3', 'southfield-4']
    expect(generateSlug('Southfield', taken)).toBe('southfield-5')
  })

  it('treats existing list as a set (no duplicate checking issues)', () => {
    const existing = ['venue', 'venue', 'venue-2']
    expect(generateSlug('Venue', existing)).toBe('venue-3')
  })
})

// ─── Real-world venue names ───────────────────────────────────────────────────

describe('generateSlug — real-world examples', () => {
  it.each([
    ['The Southfield',     'the-southfield'],
    ['Rose & Crown',       'rose-crown'],
    ['The Red Lion',       'the-red-lion'],
    ["Wetherspoon's",      'wetherspoons'],
    ['123 Sports Bar',     '123-sports-bar'],
    ['UPPER CASE BAR',     'upper-case-bar'],
  ])('"%s" → "%s"', (input, expected) => {
    expect(generateSlug(input)).toBe(expected)
  })
})
