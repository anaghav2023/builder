# Variant-Specific Translation Jobs Implementation Plan (REFINED)

## Overview
When content with PersonalizationContainer blocks is added to a translation job, create **separate translation jobs for each variant**, with each job targeting the locales specified in that variant's targeting query.

## Key Decisions

1. **Job Naming**: `{contentId}-{variantName}` if variant has a name, otherwise `{contentId}-variant-{index}`
2. **Multiple Locales**: Create ONE job per variant with all target locales included
3. **New Function**: Create `createVariantTranslationJobs()` instead of modifying existing `createTranslationJob()`

---

## Implementation Steps

### Step 1: Create Helper Functions
**File**: `plugins/smartling/src/variant-utils.ts`

```typescript
// Function 1: Detect PersonalizationContainer blocks
export function detectPersonalizationContainers(content: any): Array<{
  containerBlockId: string;
  variants: Array<{
    index: number;
    name?: string;
    query: Query[];
    blocks: any[];
    targetLocales: string[];
  }>;
}> {
  // Traverse content.data.blocks
  // Find components with name 'PersonalizationContainer'
  // Extract variants array with query conditions
}

// Function 2: Extract locales from variant query
export function extractTargetLocalesFromQuery(query: Query[]): string[] {
  // Parse query array
  // Look for property === 'locale'
  // Extract values based on operator
  // Return array of locale codes
  
  // Example: 
  // Input: [{ property: 'locale', operator: 'is', value: 'fr-FR' }]
  // Output: ['fr-FR']
  
  // Example:
  // Input: [{ property: 'locale', operator: 'contains', value: ['fr-FR', 'es-ES'] }]
  // Output: ['fr-FR', 'es-ES']
}

// Function 3: Generate job name
export function generateVariantJobName(contentId: string, variantName?: string, variantIndex?: number): string {
  if (variantName) {
    return `${contentId}-${variantName}`;
  }
  return `${contentId}-variant-${variantIndex}`;
}

// Function 4: Extract variant-specific content
export function createVariantContent(contentItem: any, variantIndex: number): any {
  // Return content with variant's blocks
  // Maintain the overall structure but only include variant blocks
}
```

### Step 2: Create New Function in smartling.ts
**File**: `plugins/smartling/src/smartling.ts`

**NEW METHOD**: `createVariantTranslationJobs()`

```typescript
async createVariantTranslationJobs(
  contentId: string,
  variants: Array<{
    index: number;
    name?: string;
    targetLocales: string[];
    blocks: any[];
  }>,
  jobDetails?: any
): Promise<Array<{ variantIndex: number; jobId: string; jobName: string }>> {
  // Loop through each variant
  // For each variant:
  //   1. Generate job name using generateVariantJobName()
  //   2. Create variant content
  //   3. If v2 API available:
  //      - Create batch translation with targetLocales
  //   4. Otherwise:
  //      - Create local job with v1 flow
  //   5. Store variant metadata in job
  //   6. Return job info { variantIndex, jobId, jobName }
  // 
  // Return array of all created jobs
}
```

**Keep existing**: `createTranslationJob()` remains unchanged for single-job flow

---

## Data Flow

### Input Content
```
Content {
  id: "page-123",
  data: {
    blocks: [
      {
        component: { name: "PersonalizationContainer" },
        options: {
          variants: [
            {
              name: "French",  // Optional name
              query: [{ property: 'locale', operator: 'is', value: 'fr-FR' }],
              blocks: [{ text: "Bonjour" }]
            },
            {
              name: "Spanish",  // Optional name
              query: [{ property: 'locale', operator: 'contains', value: ['es-ES', 'es-MX'] }],
              blocks: [{ text: "Hola" }]
            }
          ]
        }
      }
    ]
  }
}
```

### Output
Two separate translation jobs created:
- Job 1: `page-123-French` targeting locale `fr-FR`
- Job 2: `page-123-Spanish` targeting locales `es-ES, es-MX`

---

## Updated plugin.tsx Flow

**In registerBulkAction and registerContentAction** (around line 561):

```
When user creates/adds to translation job:

1. Get selected content
2. For each content item:
   a. Call detectPersonalizationContainers(content)
   b. If variants found:
      - Call api.createVariantTranslationJobs(contentId, variants, jobDetails)
      - Returns: [{variantIndex, jobId, jobName}, ...]
      - Update content metadata to reference variant jobs
   c. If NO variants found:
      - Use existing flow: api.createTranslationJob(name, [content])
      - Update content metadata normally
```

---

## Variant Metadata Storage

For variant jobs, store in job's data section:

```typescript
{
  variantMetadata: {
    originalContentId: "page-123",
    variantIndex: 0,
    variantName: "French",
    targetLocales: ["fr-FR"]
  }
}
```

This allows us to:
- Track which variant this job represents
- Identify the source content
- Know which locales were targeted

---

## Edge Cases Handled

| Case | Handling |
|------|----------|
| Variant without name | Use index: `page-123-variant-0` |
| Variant with multiple locales | Single job with all locales in targetLocales array |
| Content without variants | Use existing single-job flow (no change) |
| Multiple PersonalizationContainers | Create separate job sets for each container |
| Variant with no locale query | Either skip or create job with empty targetLocales |

---

## Testing Checklist

- [ ] Content without PersonalizationContainer → single job (existing behavior)
- [ ] Content with named variant → job named `{contentId}-{variantName}`
- [ ] Content with unnamed variant → job named `{contentId}-variant-{index}`
- [ ] Variant with multiple locales → single job with all locales
- [ ] Variant jobs contain correct targetLocales metadata
- [ ] Published jobs can be viewed/managed normally in Builder and Smartling

---

## Implementation Order

1. Create `variant-utils.ts` with helper functions
2. Create `createVariantTranslationJobs()` in `smartling.ts`
3. Update `plugin.tsx` to detect variants and route to new function
4. Test with sample content containing variants
5. Verify jobs in Builder UI and Smartling dashboard
