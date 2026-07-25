// Shared helpers for the post + edit listing forms so both screens stay
// consistent. `condition` is stored BOTH in the real `listings.condition`
// column (has a DB check constraint) AND in attributes.condition, because
// applyBrowseFilters reads attributes.condition when filtering.

export type ListingCondition = "new" | "like-new" | "used" | "refurbished";

export const CONDITION_OPTIONS: { value: ListingCondition; label: string }[] = [
  { value: "new", label: "New" },
  { value: "like-new", label: "Like New" },
  { value: "used", label: "Used" },
  { value: "refurbished", label: "Refurbished" },
];

// Categories that represent physical goods where a condition selector makes
// sense. Services / property / rooms / jobs don't get one.
const NON_PHYSICAL = new Set(["services", "property", "rooms", "jobs"]);

export function categoryHasCondition(category: string | null | undefined): boolean {
  if (!category) return false;
  return !NON_PHYSICAL.has(category);
}
