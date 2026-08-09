import type {
  SpecCategory,
  SpecResource,
  SpecTier,
  StarterPackDefinition,
  StarterPackWithStatus,
} from '../../types/collections.js'

export const CURATED_STARTER_PACKS: StarterPackDefinition[] = [
  {
    id: 'medical',
    name: 'Medical',
    description: 'First aid, medicines, military medicine, and public-health references.',
    icon: 'IconStethoscope',
    selections: [{ categorySlug: 'medicine', tierSlug: 'medicine-essential' }],
  },
  {
    id: 'homestead',
    name: 'Homestead',
    description: 'Food, gardening, winter preparedness, and practical repair references.',
    icon: 'IconPlant',
    selections: [
      { categorySlug: 'agriculture', tierSlug: 'agriculture-standard' },
      { categorySlug: 'survival', tierSlug: 'survival-essential' },
      { categorySlug: 'diy', tierSlug: 'diy-essential' },
    ],
  },
  {
    id: 'maker',
    name: 'Maker',
    description: 'Programming, microcomputers, electronics, woodworking, and vehicle repair.',
    icon: 'IconTool',
    selections: [
      { categorySlug: 'computing', tierSlug: 'computing-standard' },
      { categorySlug: 'diy', tierSlug: 'diy-essential' },
    ],
  },
  {
    id: 'k12',
    name: 'K-12',
    description: 'A broad offline school reference library for core subjects and learning.',
    icon: 'IconSchool',
    selections: [{ categorySlug: 'education', tierSlug: 'education-standard' }],
  },
  {
    id: 'ham-radio',
    name: 'HAM Radio',
    description:
      'Electronics, computing, and repair references for building a field radio station.',
    icon: 'IconWorld',
    selections: [
      { categorySlug: 'computing', tierSlug: 'computing-comprehensive' },
      { categorySlug: 'diy', tierSlug: 'diy-essential' },
    ],
  },
]

function resolveTierResources(
  tier: SpecTier,
  tiers: SpecTier[],
  visited = new Set<string>()
): SpecResource[] {
  if (visited.has(tier.slug)) return []
  visited.add(tier.slug)

  const resources = tier.includesTier
    ? (() => {
        const included = tiers.find((candidate) => candidate.slug === tier.includesTier)
        return included ? resolveTierResources(included, tiers, visited) : []
      })()
    : []

  return [...resources, ...tier.resources]
}

export function getStarterPack(id: string): StarterPackDefinition | undefined {
  return CURATED_STARTER_PACKS.find((pack) => pack.id === id)
}

export function buildStarterPackStatuses(
  categories: SpecCategory[],
  installedResourceIds: Set<string>,
  packs: StarterPackDefinition[] = CURATED_STARTER_PACKS
): StarterPackWithStatus[] {
  return packs.map((pack) => {
    const resources = new Map<string, SpecResource>()
    let available = true

    for (const selection of pack.selections) {
      const category = categories.find((candidate) => candidate.slug === selection.categorySlug)
      const tier = category?.tiers.find((candidate) => candidate.slug === selection.tierSlug)

      if (!category || !tier) {
        available = false
        continue
      }

      for (const resource of resolveTierResources(tier, category.tiers)) {
        resources.set(resource.id, resource)
      }
    }

    const resourceList = [...resources.values()]
    return {
      ...pack,
      available,
      resource_count: resourceList.length,
      installed_count: resourceList.filter((resource) => installedResourceIds.has(resource.id))
        .length,
      size_mb: resourceList.reduce((total, resource) => total + (resource.size_mb ?? 0), 0),
    }
  })
}
