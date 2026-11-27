export function canCreateFirstAdmin(adminCount: number | null | undefined): boolean {
  return adminCount === 0;
}
