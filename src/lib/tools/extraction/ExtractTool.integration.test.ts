import { describe, it, expect, vi } from 'vitest'
import { createExtractTool } from './ExtractTool'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { MessageManager } from '@/lib/runtime/MessageManager'
import { BrowserContext } from '@/lib/browser/BrowserContext'
import { EventBus } from '@/lib/events'

/**
 * Simple integration test for ExtractTool
 */
describe('ExtractTool Integration Test', () => {
  it.skipIf(!process.env.LITELLM_API_KEY || process.env.LITELLM_API_KEY === 'nokey')(
    'should extract product links from a page',
    async () => {
      // Setup
      const messageManager = new MessageManager()
      const browserContext = new BrowserContext()
      const abortController = new AbortController()
      
      const eventBus = new EventBus()
      const executionContext = new ExecutionContext({
        browserContext,
        messageManager,
        abortController,
        debugMode: false,
        eventBus
      })
      
      // Mock the browser page to return sample HTML
      const mockPage = {
        getLinksSnapshot: vi.fn().mockResolvedValue({
          tree: SAMPLE_LINKS_CONTENT
        }),
        url: vi.fn().mockResolvedValue('https://example.com/products'),
        title: vi.fn().mockResolvedValue('Example shop - Products')
      }
      
      browserContext.getPages = vi.fn().mockResolvedValue([mockPage])
      
      const extractTool = createExtractTool(executionContext)
      
      // Execute extraction
      const result = await extractTool.func({
        task: 'Extract all product links from this page',
        tab_id: 1,
        extract_type: 'links'
      })
      
      // Verify extraction was successful
      const parsed = JSON.parse(result)
      expect(parsed.ok).toBe(true)
      expect(parsed.output).toBeDefined()
      expect(parsed.output.content).toBeDefined()
      expect(parsed.output.reasoning).toBeDefined()
      expect(typeof parsed.output.content).toBe('string')
      expect(typeof parsed.output.reasoning).toBe('string')
      
      // Check for specific product links
      expect(parsed.output.content).toContain('widget-premium')
      expect(parsed.output.content).toContain('widget-standard')
      expect(parsed.output.content).toContain('gadget-deluxe')
      
      console.log('✅ Test passed - ExtractTool extracted product links with real LLM')
    },
    30000
  )

  it.skipIf(!process.env.LITELLM_API_KEY || process.env.LITELLM_API_KEY === 'nokey')(
    'should extract prices from a page',
    async () => {
      // Setup
      const messageManager = new MessageManager()
      const browserContext = new BrowserContext()
      const abortController = new AbortController()
      
      const eventBus = new EventBus()
      const executionContext = new ExecutionContext({
        browserContext,
        messageManager,
        abortController,
        debugMode: false,
        eventBus
      })
      
      // Mock the browser page to return sample HTML
      const mockPage = {
        getTextSnapshot: vi.fn().mockResolvedValue({
          tree: SAMPLE_TEXT_CONTENT
        }),
        url: vi.fn().mockResolvedValue('https://example-shop.com/products'),
        title: vi.fn().mockResolvedValue('Example Shop - Products')
      }
      
      browserContext.getPages = vi.fn().mockResolvedValue([mockPage])
      
      const extractTool = createExtractTool(executionContext)
      
      // Execute extraction
      const result = await extractTool.func({
        task: 'Extract all product prices from this page',
        tab_id: 1,
        extract_type: 'text'
      })
      
      // Verify extraction was successful
      const parsed = JSON.parse(result)
      expect(parsed.ok).toBe(true)
      expect(parsed.output).toBeDefined()
      expect(parsed.output.content).toBeDefined()
      expect(parsed.output.reasoning).toBeDefined()
      expect(typeof parsed.output.content).toBe('string')
      expect(typeof parsed.output.reasoning).toBe('string')
      
      // Check for specific prices
      expect(parsed.output.content).toContain('$49.99')
      expect(parsed.output.content).toContain('$29.99')
      expect(parsed.output.content).toContain('$14.99')
      
      console.log('✅ Test passed - ExtractTool extracted prices with real LLM')
    },
    30000
  )
})

// Sample HTML content simulating a simple e-commerce page
const SAMPLE_LINKS_CONTENT = `
Navigation:
- Home [/]
- Products [/products]
- About [/about]
- Contact [/contact]

Product Listings:
- Product 1 - Premium Widget [https://sample.com/products/widget-premium]
- Product 2 - Standard Widget [https://sample.com/products/widget-standard]
- Product 3 - Budget Widget [https://sample.com/products/widget-budget]
- Product 4 - Deluxe Gadget [https://sample.com/products/gadget-deluxe]
- Product 5 - Mini Gadget [https://sample.com/products/gadget-mini]

Footer:
- Privacy Policy [/privacy]
- Terms of Service [/terms]
- Sitemap [/sitemap]
- Support [/support]
`

const SAMPLE_TEXT_CONTENT = `
Example Shop - Products

Navigation: Home | Products | About | Contact

Featured Products:

Product 1 - Premium Widget
High-quality widget with advanced features
Price: $49.99
In Stock

Product 2 - Standard Widget  
Our most popular widget model
Price: $29.99
In Stock

Product 3 - Budget Widget
Affordable widget for everyday use
Price: $14.99
Limited Stock

Product 4 - Deluxe Gadget
Top-of-the-line gadget with all bells and whistles
Price: $99.99
Pre-order

Product 5 - Mini Gadget
Compact version of our popular gadget
Price: $39.99
In Stock

Footer:
© 2024 Example Shop | Privacy Policy | Terms of Service | Support
`
