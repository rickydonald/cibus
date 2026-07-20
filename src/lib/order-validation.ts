export function hasDuplicateItemIds(items: ReadonlyArray<{ id: number }>): boolean {
  const itemIds = new Set<number>();

  return items.some((item) => {
    if (itemIds.has(item.id)) return true;
    itemIds.add(item.id);
    return false;
  });
}
