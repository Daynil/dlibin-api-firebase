/**
 * Find an item in an array
 * @return the item or null if not found
 */
export function arrContains<T>(arr: T[], searchItem: T): T | null {
  const itemIdx = arr.indexOf(searchItem);
  if (itemIdx < 0) return null;
  else return arr[itemIdx];
}
