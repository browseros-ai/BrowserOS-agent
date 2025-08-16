#!/usr/bin/env node

/**
 * CLI script to enable evaluation mode
 * 
 * This script configures the extension for data collection with
 * sensible defaults. It prioritizes privacy while ensuring we
 * collect enough data for meaningful analysis.
 * 
 * Usage: npm run eval:enable
 * 
 * What this does:
 * 1. Enables the master tracking switch
 * 2. Sets up 100% sampling (can be reduced for high traffic)
 * 3. Configures privacy settings (anonymization, redaction)
 * 4. Sets performance parameters for production use
 */

import { EvalSettingsManager } from './EvalSettings'

async function enableEvalMode() {
  console.log('🔧 Enabling evaluation mode...')
  
  try {
    // Enable with production-ready settings
    await EvalSettingsManager.enable({
      sampleRate: 1.0,  // 100% sampling - reduce if needed for scale
      
      // Performance settings optimized for browser environment
      performance: {
        bufferSize: 20,           // Batch 20 events before sending
        flushIntervalMs: 5000,    // Auto-flush every 5 seconds
        maxEventSize: 1000        // Truncate large events to 1KB
      },
      
      // Privacy-first defaults
      privacy: {
        anonymizeUrls: true,      // Replace URLs with patterns
        redactSelectors: true,    // Remove CSS selectors
        hashUserId: true          // Hash user IDs
      }
    })
    
    // Provide feedback on what was configured
    console.log('✅ Evaluation mode enabled')
    console.log('📊 Settings:')
    console.log('  - Sample rate: 100%')
    console.log('  - Buffer size: 20 events')
    console.log('  - Flush interval: 5 seconds')
    console.log('  - Privacy: URLs anonymized, selectors redacted')
    console.log('')
    console.log('⚠️  Remember to set your Braintrust API key:')
    console.log('    npm run eval:set-api-key YOUR_API_KEY')
  } catch (error) {
    console.error('❌ Failed to enable evaluation mode:', error.message)
    process.exit(1)
  }
}

// Execute when run directly from command line
if (require.main === module) {
  enableEvalMode()
    .then(() => process.exit(0))  // Success
    .catch(err => {
      console.error(err)
      process.exit(1)  // Failure
    })
}

// Also export for programmatic use
export { enableEvalMode }
