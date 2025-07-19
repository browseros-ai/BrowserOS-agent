import { z } from 'zod';
import { NxtscapeTool } from '../base/NxtscapeTool';
import { ToolConfig } from '../base/ToolConfig';
import { ExecutionContext } from '@/lib/runtime/ExecutionContext';
import { Logging } from '@/lib/utils/Logging';
import BrowserPage from '@/lib/browser/BrowserPage';
import type { SnapshotContext, SectionType, Snapshot, LinkInfo } from '@/lib/browser/BrowserOSAdapter';

/**
 * Enum for extraction types
 */
export const ExtractTypeEnum = z.enum([
  'text',  // Extract text content
  'links'  // Extract all links
]);

export type ExtractType = z.infer<typeof ExtractTypeEnum>;

/**
 * Schema for link information
 */
export const LinkSchema = z.object({
  text: z.string(),  // Link text
  url: z.string()  // Link URL
});

export type Link = z.infer<typeof LinkSchema>;

/**
 * Schema for snapshot context options
 */
export const SnapshotContextSchema = z.enum(['visible', 'full']);

/**
 * Schema for section types based on ARIA landmarks
 */
export const SectionTypeSchema = z.enum([
  'main',
  'navigation', 
  'footer',
  'header',
  'article',
  'aside',
  'complementary',
  'contentinfo',
  'form',
  'search',
  'region',
  'other'
]);

/**
 * Schema for a single extraction result
 */
export const ExtractionResultSchema = z.object({
  tab_id: z.number(),  // Tab ID
  url: z.string(),  // Page URL
  title: z.string(),  // Page title
  content: z.string().optional(),  // Extracted text content
  links: z.array(LinkSchema).optional()  // Extracted links
});

export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

/**
 * Schema for extract tool input
 */
export const ExtractInputSchema = z.object({
  tab_ids: z.array(z.number()),  // Array of tab IDs to extract from
  extract_type: ExtractTypeEnum,  // What to extract (text or links)
  context: SnapshotContextSchema.default('visible').optional(),  // Context: visible or full page (default: visible)
  sections: z.array(SectionTypeSchema).optional(),  // Which sections to include (default: all)
  include_metadata: z.boolean().default(true),  // Include URL and title (default: true)
  max_length: z.number().optional()  // Maximum content length per tab (applies to text extraction only)
});

export type ExtractInput = z.input<typeof ExtractInputSchema>;

/**
 * Schema for extract tool output
 */
export const ExtractOutputSchema = z.object({
  success: z.boolean(),  // Whether the operation succeeded
  extractions: z.array(ExtractionResultSchema),  // Array of extraction results
  message: z.string()  // Human-readable status message
});

export type ExtractOutput = z.infer<typeof ExtractOutputSchema>;

/**
 * Unified tool for extracting content from one or multiple tabs
 */
export class ExtractTool extends NxtscapeTool<ExtractInput, ExtractOutput> {
  constructor(executionContext: ExecutionContext) {
    const config: ToolConfig<ExtractInput, ExtractOutput> = {
      name: 'extract',
      description: 'Extract content from one or multiple browser tabs. Supports extracting text or links from specific page sections. Always pass tab_ids as an array of tab IDs.',
      category: 'observation',
      version: '2.0.0',
      inputSchema: ExtractInputSchema,
      outputSchema: ExtractOutputSchema,
      examples: [
        {
          description: 'Extract text from a single tab',
          input: { 
            tab_ids: [12345],
            extract_type: 'text',
            context: 'visible'
          },
          output: {
            success: true,
            extractions: [{
              tab_id: 12345,
              url: 'https://example.com',
              title: 'Example Page',
              content: 'Welcome to our website. We offer the best products and services...'
            }],
            message: 'Successfully extracted content from 1 tab'
          }
        },
        {
          description: 'Extract links from navigation sections',
          input: { 
            tab_ids: [12345],
            extract_type: 'links',
            sections: ['navigation', 'header']
          },
          output: {
            success: true,
            extractions: [{
              tab_id: 12345,
              url: 'https://example.com',
              title: 'Example Page',
              links: [
                { text: 'Home', url: 'https://example.com/' },
                { text: 'About', url: 'https://example.com/about' },
                { text: 'Contact', url: 'https://example.com/contact' }
              ]
            }],
            message: 'Successfully extracted content from 1 tab'
          }
        },
        {
          description: 'Extract main content from full page',
          input: { 
            tab_ids: [12345],
            extract_type: 'text',
            context: 'full',
            sections: ['main', 'article'],
            max_length: 1000
          },
          output: {
            success: true,
            extractions: [{
              tab_id: 12345,
              url: 'https://example.com',
              title: 'Example Page',
              content: 'Welcome to our website. We offer the best products and services...'
            }],
            message: 'Successfully extracted content from 1 tab'
          }
        }
      ],
      streamingConfig: {
        displayName: 'Extract Content',
        icon: '📄',
        progressMessage: 'Extracting content...'
      }
    };

    super(config, executionContext);
  }

  /**
   * Override: Generate contextual display message
   */
  getProgressMessage(args: ExtractInput): string {
    try {
      // Note: args should already be parsed by StreamEventProcessor

      const tabCount = args?.tab_ids?.length || 0;
      const extractType = args?.extract_type || 'content';
      const context = args?.context || 'visible';
      const sections = args?.sections;

      let message = `Extracting ${extractType}`;
      
      if (sections && sections.length > 0) {
        message += ` from ${sections.join(', ')} sections`;
      }
      
      if (context === 'full') {
        message += ' (full page)';
      }
      
      if (tabCount === 1) {
        message += ` from tab ${args.tab_ids[0]}`;
      } else if (tabCount > 1) {
        message += ` from ${tabCount} tabs`;
      }
      
      return message + '...';
    } catch {
      return 'Extracting content...';
    }
  }

  /**
   * Override: Format extraction result for display
   */
  FormatResultForUI(output: ExtractOutput): string {
    if (!output.success) {
      return `❌ ${output.message}`;
    }
    
    const extractionCount = output.extractions.length;
    if (extractionCount === 0) {
      return '📄 No content extracted';
    }
    
    let result = `📄 **Extracted from ${extractionCount} tab${extractionCount > 1 ? 's' : ''}**\n\n`;
    
    output.extractions.forEach((extraction, index) => {
      result += `**${index + 1}. ${extraction.title}**\n`;
      result += `🔗 ${extraction.url}\n`;
      
      if (extraction.content) {
        const wordCount = extraction.content.split(/\s+/).filter(word => word.length > 0).length;
        const preview = extraction.content.slice(0, 100).trim();
        const hasMore = extraction.content.length > 100;
        result += `📝 "${preview}${hasMore ? '...' : ''}"\n`;
        result += `📊 ${wordCount} words\n`;
      }
      
      if (extraction.links) {
        const linkCount = extraction.links.length;
        result += `🔗 ${linkCount} link${linkCount !== 1 ? 's' : ''} found\n`;
        if (linkCount > 0 && linkCount <= 3) {
          extraction.links.forEach(link => {
            const text = link.text.length > 30 ? link.text.substring(0, 30) + '...' : link.text;
            result += `  - ${text}\n`;
          });
        }
      }
      
      if (index < extractionCount - 1) {
        result += '\n';
      }
    });
    
    return result.trim();
  }

  protected async execute(input: ExtractInput): Promise<ExtractOutput> {
    try {
      // Validate input
      if (!input.tab_ids || input.tab_ids.length === 0) {
        return {
          success: false,
          extractions: [],
          message: 'No tab IDs provided'
        };
      }

      // Get pages for the specified tab IDs directly
      const pages = await this.browserContext.getPages(input.tab_ids);
      
      if (!pages || pages.length === 0) {
        return {
          success: false,
          extractions: [],
          message: `No tabs found with IDs: ${input.tab_ids.join(', ')}`
        };
      }

      // Extract content from each page
      const extractions: ExtractionResult[] = [];
      
      for (const page of pages) {
        // Get the tab ID from the page state
        const pageState = await page.getBrowserState();
        const tabId = pageState.tabId;
        
        const extraction = await this.extractFromPage(page, tabId, input);
        if (extraction) {
          extractions.push(extraction);
        }
      }

      return {
        success: true,
        extractions,
        message: `Successfully extracted content from ${extractions.length} tab${extractions.length !== 1 ? 's' : ''}`
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        extractions: [],
        message: `Extraction failed: ${errorMessage}`
      };
    }
  }


  /**
   * Extract content from a single page
   */
  private async extractFromPage(
    page: BrowserPage, 
    tabId: number,
    input: ExtractInput
  ): Promise<ExtractionResult | null> {
    try {
      // Build snapshot options
      // const snapshotOptions = {
      //   context: input.context as SnapshotContext || 'visible',
      //   includeSections: input.sections as SectionType[]
      // };
      // TODO: fix the snapshot to use seciton and context. Today, override it to get full all all sections
      const snapshotOptions = {
        context: 'full' as SnapshotContext, // Force full context for now
        // all sections are included today
      };

      // Get URL and title first
      const url = page.url();
      const title = await page.title();
      
      // Build the result
      const result: ExtractionResult = {
        tab_id: tabId,
        url: url,
        title: title || 'Untitled'
      };

      // Extract based on type
      if (input.extract_type === 'text') {
        const snapshot = await page.getTextSnapshot(snapshotOptions);
        
        // Combine text from all sections
        let allText = '';
        for (const section of snapshot.sections) {
          if (section.textResult) {
            allText += section.textResult.text + '\n\n';
          }
        }
        
        // Apply max_length if specified
        let finalText = allText.trim();
        if (input.max_length && finalText.length > input.max_length) {
          finalText = finalText.substring(0, input.max_length) + '...';
        }
        
        if (finalText) {
          result.content = finalText;
        }
        
      } else if (input.extract_type === 'links') {
        const snapshot = await page.getLinksSnapshot(snapshotOptions);
        
        // Combine links from all sections
        const allLinks: Link[] = [];
        for (const section of snapshot.sections) {
          if (section.linksResult) {
            for (const linkInfo of section.linksResult.links) {
              allLinks.push({
                text: linkInfo.text,
                url: linkInfo.url
              });
            }
          }
        }
        
        if (allLinks.length > 0) {
          result.links = allLinks;
        }
      }

      return result;
      
    } catch (error) {
      Logging.log('ExtractTool', `Failed to extract from tab ${tabId}: ${error}`, 'warning');
      return null;
    }
  }

  // Link extraction is now handled by the new snapshot APIs
}
