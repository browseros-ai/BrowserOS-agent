#!/usr/bin/env node

/**
 * CLI script to disable evaluation mode
 * 
 * This script safely disables data collection, ensuring any
 * pending events are flushed before shutting down. This prevents
 * data loss when turning off evaluation.
 * 
 * Usage: npm run eval:disable
 * 
 * What this does:
 * 1. Flushes any buffered events to Braintrust
 * 2. Shuts down the event collector gracefully
 * 3. Disables the tracking flag in settings
 * 4. Clears the runtime cache
 */

import { EvalSettingsManager } from './EvalSettings'
import { BraintrustEventCollector } from './BraintrustEventCollector'

async function disableEvalMode() {
  console.log('🔧 Disabling evaluation mode...')
  
  try {
    // Gracefully shutdown the collector
    const collector = BraintrustEventCollector.getInstance()
    if (collector.isEnabled()) {
      console.log('📤 Flushing remaining events...')
      await collector.flush()     // Send any buffered events
      await collector.shutdown()  // Clean shutdown
    }
    
    // Update settings to disable tracking
    await EvalSettingsManager.disable()
    
    console.log('✅ Evaluation mode disabled')
    console.log('📊 No data will be collected until re-enabled')
  } catch (error) {
    console.error('❌ Failed to disable evaluation mode:', error.message)
    process.exit(1)
  }
}

// Execute when run directly from command line
if (require.main === module) {
  disableEvalMode()
    .then(() => process.exit(0))  // Success
    .catch(err => {
      console.error(err)
      process.exit(1)  // Failure
    })
}

// Also export for programmatic use
export { disableEvalMode }
