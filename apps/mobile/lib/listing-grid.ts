// Shared fix for every numColumns={2} ListingCard grid (institutions/index,
// institutions/[id]) -- ListingCard's "fluid" grid style is flex:1, which
// correctly splits a full row of 2 but stretches a lone item in an
// incomplete last row (an odd listing count) to fill the whole row instead
// of staying at half-width. Appending an invisible null filler pads that
// last row back out to a full 2, so the real card never has to guess a
// fixed width that might overflow on a different screen/padding
// combination -- see components/ListingCard.tsx's fluid style comment.
export function padGridFiller<T>(items: T[], numColumns: number): (T | null)[] {
  const remainder = items.length % numColumns;
  if (remainder === 0) return items;
  return [...items, ...Array(numColumns - remainder).fill(null)];
}
