export function buildClusterResourceKey(resourceId: string, resourceType: string): string {
  return `${resourceType}:${resourceId}`
}
