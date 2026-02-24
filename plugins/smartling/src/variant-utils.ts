// Define Query interface locally to avoid dependency issues
export type QueryOperator =
  | 'is'
  | 'isNot'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'greaterThan'
  | 'lessThan'
  | 'greaterThanOrEqualTo'
  | 'lessThanOrEqualTo';

export type QueryValue = string | number | boolean | Array<string | number | boolean>;

export interface Query {
  property: string;
  operator: QueryOperator;
  value: QueryValue;
}

export interface VariantInfo {
  index: number;
  name?: string;
  query: Query[];
  blocks: any[];
  targetLocales: string[];
}

export interface PersonalizationContainer {
  containerBlockId: string;
  variants: VariantInfo[];
}

/**
 * Detect PersonalizationContainer blocks in content
 * Fetches full content from API and recursively traverses content.data.blocks to find PersonalizationContainer components
 */
export async function detectPersonalizationContainers(
  content: any,
  apiKey: string
): Promise<PersonalizationContainer[]> {
  const containers: PersonalizationContainer[] = [];

  console.log('log2', content);

  // Fetch the full content from the API to ensure we have all blocks
  let fullContent: any;
  try {
    const modelName = content.modelName || content.modelId || 'page';
    const contentId = content.id;

    const response = await fetch(
      `https://cdn.builder.io/api/v3/content/${modelName}/${contentId}?apiKey=${apiKey}&cachebust=true`
    );

    if (!response.ok) {
      console.error('Failed to fetch full content for PersonalizationContainer detection');
      return containers;
    }

    fullContent = await response.json();
  } catch (error) {
    console.error('Error fetching full content:', error);
    return containers;
  }

  // Parse blocks if they are stored as a string
  let blocks = fullContent.data?.blocks;
  console.log('log3', JSON.stringify(blocks, null, 2));
  if (typeof blocks === 'string') {
    try {
      blocks = JSON.parse(blocks);
    } catch (e) {
      console.error('Failed to parse blocks:', e);
      return containers;
    }
  }

  if (!blocks || !Array.isArray(blocks)) {
    return containers;
  }

  function traverseBlocks(blocks: any[]): void {
    if (!Array.isArray(blocks)) {
      return;
    }

    blocks.forEach((block: any) => {
      // Check if this block is a PersonalizationContainer
      if (block?.component?.name === 'PersonalizationContainer') {
        const variants = block?.component?.options?.variants || [];

        if (Array.isArray(variants) && variants.length > 0) {
          const containerVariants: VariantInfo[] = variants.map(
            (variant: any, index: number) => ({
              index,
              name: variant.name,
              query: variant.query || [],
              blocks: variant.blocks || [],
              targetLocales: extractTargetLocalesFromQuery(variant.query || []),
            })
          );

          console.log('log4', containerVariants);

          containers.push({
            containerBlockId: block.id,
            variants: containerVariants,
          });
        }
      }

      // Recursively check children blocks
      if (block?.children && Array.isArray(block.children)) {
        traverseBlocks(block.children);
      }
    });
  }

  traverseBlocks(blocks);
  return containers;
}

/**
 * Extract target locales from variant query conditions
 * Looks for property === 'locale' and extracts values based on operator
 */
export function extractTargetLocalesFromQuery(query: Query[]): string[] {
  if (!Array.isArray(query)) {
    return [];
  }

  const locales = new Set<string>();

  query.forEach((condition: Query) => {
    if (condition.property === 'locale') {
      const value = condition.value;

      // Handle array values
      if (Array.isArray(value)) {
        value.forEach((v) => {
          if (typeof v === 'string') {
            locales.add(v);
          }
        });
      }
      // Handle single string values
      else if (typeof value === 'string') {
        locales.add(value);
      }
    }
  });

  return Array.from(locales);
}

/**
 * Generate job name for a variant
 * Uses variant name if available, otherwise uses contentId-variant-{index}
 */
export function generateVariantJobName(
  contentId: string,
  variantName?: string,
  variantIndex?: number
): string {
  if (variantName && variantName.trim()) {
    // Replace spaces and special characters with hyphens for safe job naming
    const sanitizedName = variantName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

    return `${contentId}-${sanitizedName}`;
  }

  return `${contentId}-variant-${variantIndex}`;
}

/**
 * Extract variant-specific content structure
 * Creates a content object with only the variant's blocks
 */
export function createVariantContent(
  contentItem: any,
  variantIndex: number,
  variant: VariantInfo
): any {
  // Create a new content object with variant-specific blocks
  return {
    ...contentItem,
    data: {
      ...contentItem.data,
      blocks: variant.blocks,
    },
    // Store metadata about which variant this is
    meta: {
      ...contentItem.meta,
      variantMetadata: {
        originalContentId: contentItem.id,
        variantIndex,
        variantName: variant.name,
        targetLocales: variant.targetLocales,
      },
    },
  };
}

/**
 * Check if content has PersonalizationContainer variants
 */
export async function hasPersonalizationContainers(content: any, apiKey: string): Promise<boolean> {
  const containers = await detectPersonalizationContainers(content, apiKey);
  return containers.length > 0;
}
