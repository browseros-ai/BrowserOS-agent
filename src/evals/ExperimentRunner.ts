/**
 * ExperimentRunner - Helper functions for running experiments
 * 
 * This module provides utilities for running experiments that compare
 * baseline logs against new prompt versions.
 */

import { BRAINTRUST_PROJECT_UUID } from '@/config'

export const EXPERIMENT_CONFIG = {
  DEFAULT_MAX_LOGS: 20,
  DEFAULT_LOGS_TAG: 'v1', 
  DEFAULT_EXPERIMENT_TAG: 'v2'
}

export class ExperimentHelper {
  /**
   * Build experiment names with proper formatting
   */
  static buildExperimentNames(logsTag: string) {
    const timestamp = new Date().toISOString().slice(0, 16).replace('T', '-')
    return {
      v1ExperimentName: `${logsTag}(baseline)--${timestamp}`,
      v2ExperimentName: `${logsTag}(new)--${timestamp}`,  // New version for comparison
      timestamp
    }
  }

  /**
   * Build Braintrust API headers
   * @param apiKey - The Braintrust API key (passed from background script)
   */
  static buildBraintrustHeaders(apiKey?: string) {
    // API key is passed in from the background script which imports it from config
    return {
      'Content-Type': 'application/json',
      'Authorization': apiKey ? `Bearer ${apiKey}` : ''
    }
  }

  /**
   * Build BTQL query to fetch logs by tag
   * BTQL uses filter/sort syntax, not SQL where/order by
   */
  static buildLogQuery(tag: string, maxLogs: number) {
    // Check if UUID is configured
    if (!BRAINTRUST_PROJECT_UUID) {
      throw new Error('BRAINTRUST_PROJECT_UUID not configured in config.ts')
    }
    
    // Query for root spans that have the specified tag
    // Root spans contain the actual input task
    const query = `select: *
from: project_logs('${BRAINTRUST_PROJECT_UUID}')
filter:
  is_root
  and tags INCLUDES '${tag}'
sort: created desc
limit: ${maxLogs}`
    
    // console.log('🔍 BTQL Query details:', {
    //   projectUUID: BRAINTRUST_PROJECT_UUID,
    //   tag: tag,
    //   maxLogs: maxLogs,
    //   fullQuery: query,
    //   dashboardUrl: `https://braintrust.dev/app/Felafax/p/browseros-agent-online/logs`,
    //   note: 'Fetching root spans with input tasks'
    // })
    
    return {
      query: query,
      fmt: "json"
    }
  }

  /**
   * Build BTQL query to test if project has any logs at all
   * Useful for debugging when no tagged logs are found
   */
  static buildTestQuery() {
    // Look for root spans
    const query = `select: *
from: project_logs('${BRAINTRUST_PROJECT_UUID}')
filter:
  is_root
limit: 1`
    
    console.log('🔍 Test query (checking for root spans):', query)
    
    return {
      query: query,
      fmt: "json"
    }
  }
  
  /**
   * Build BTQL query for root spans without tag filter
   * Used as fallback when no tagged spans exist
   */
  static buildUntaggedDecisionPointQuery(maxLogs: number) {
    const query = `select: *
from: project_logs('${BRAINTRUST_PROJECT_UUID}')
filter:
  is_root
sort: created desc
limit: ${maxLogs}`
    
    console.log('🔍 Fetching untagged decision point spans as fallback')
    
    return {
      query: query,
      fmt: "json"
    }
  }

  /**
   * Build BTQL query to see what tags exist in the project
   */
  static buildTagsQuery() {
    // Get some recent logs to see their tags
    const query = `select: tags, created, is_root, input
from: project_logs('${BRAINTRUST_PROJECT_UUID}')
filter: is_root
sort: created desc  
limit: 5`
    
    console.log('🔍 Tags query (checking what tags exist):', query)
    
    return {
      query: query,
      fmt: "json"
    }
  }

  /**
   * Build BTQL query to fetch child spans
   */
  static buildChildSpanQuery(spanId: string) {
    // Check if UUID is configured
    if (!BRAINTRUST_PROJECT_UUID) {
      throw new Error('BRAINTRUST_PROJECT_UUID not configured in config.ts')
    }
    
    // BTQL query for child spans using filter/sort syntax
    const query = `select: *
from: project_logs('${BRAINTRUST_PROJECT_UUID}')
filter:
  root_span_id = '${spanId}'
  and not is_root
sort: created asc`
    
    return {
      query: query,
      fmt: "json"
    }
  }

  /**
   * Find the decision point span from child spans
   */
  static findDecisionSpan(childSpans: any[]) {
    // Log all child span names and whether they have scores for debugging
    // console.log('  Child spans found:')
    // childSpans.forEach((span, i) => {
    //   const hasScores = !!(span.scores && Object.keys(span.scores).length > 0)
    //   const scoreKeys = hasScores ? Object.keys(span.scores).join(', ') : 'none'
    //   const spanType = span.metadata?.type || span.span_attributes?.type || 'no-type'
    //   console.log(`    [${i}] ${span.name || 'unnamed'} (type: ${spanType}) - has scores: ${hasScores} (${scoreKeys})`)
    // })
    
    // Look for decision point spans created by NxtScape._finalizeTask()
    // These have names like: task_1_success, task_2_paused, task_3_error
    // IMPORTANT: Skip task_*_start spans which have no scores
    let decisionSpan = childSpans.find(span => {
      // SKIP any start events - these have no scores
      if (span.name?.endsWith('_start')) {
        return false
      }
      
      // Check name pattern: task_<number>_<outcome>
      const nameMatch = span.name?.match(/^task_\d+_(success|paused|error)$/)
      if (nameMatch) {
        // console.log(`    ✓ Found task completion span: ${span.name}`)
        return true
      }
      
      // For unnamed spans, check if it's a decision_point WITH scores
      // This handles historical data that might not have names
      const isDecisionPoint = (span.metadata?.type === 'decision_point' || 
                               span.span_attributes?.type === 'decision_point')
      if (isDecisionPoint && span.scores && Object.keys(span.scores).length > 0) {
        // console.log(`    ✓ Found decision_point with scores: ${span.name || 'unnamed'}`)
        return true
      }
      
      // Check for session_end (from BraintrustEventCollector.endSession)
      if (span.name === 'session_end') {
        // console.log(`    ✓ Found session_end span`)
        return true
      }
      
      return false
    })
    
    // If not found by name/type, look for any span with multi-dimensional scores
    if (!decisionSpan) {
      decisionSpan = childSpans.find(span => {
        // Check for LLM Judge multi-dimensional scores
        const hasMultiDimensionalScores = span.scores && 
          (span.scores.goal_achievement !== undefined ||
           span.scores.execution_quality !== undefined ||
           span.scores.weighted_total !== undefined)
        
        if (hasMultiDimensionalScores) {
          // console.log(`    ✓ Found span with multi-dimensional scores: ${span.name}`)
          return true
        }
        return false
      })
    }
    
    // Last resort: any span with any scores
    if (!decisionSpan) {
      decisionSpan = childSpans.find(span => 
        span.scores && Object.keys(span.scores).length > 0
      )
      if (decisionSpan) {
        // console.log(`    ✓ Found span with scores (fallback): ${decisionSpan.name}`)
      }
    }
    
    if (!decisionSpan) {
      // console.log('    ⚠️ No decision span found - historical data may predate scoring implementation')
    }
    
    return decisionSpan
  }

  /**
   * Extract V1 scores from a decision point span
   * Looks for all possible score dimensions from LLM scorer
   */
  static extractV1Scores(decisionSpan: any) {
    // If no decision span found, return defaults
    if (!decisionSpan) {
      console.log('⚠️ No decision span found, using default scores')
      return {
        // Main scores (must be between 0 and 1)
        task_completion: 0,
        weighted_total: 0,
        
        // Multi-dimensional scores from LLM Judge
        goal_achievement: 0,
        execution_quality: 0,
        execution_precision: 0,
        progress_made: 0,
        plan_coherence: 0,
        error_handling: 0
      }
    }
    
    // Extract scores from the decision span
    const scores = decisionSpan.scores || {}
    const metadata = decisionSpan.metadata || {}
    const scoringDetails = metadata.scoring_details || {}
    
    // Log what we found for debugging
    // console.log('📊 Found scores in decision span:', {
    //   spanName: decisionSpan.name,
    //   spanId: decisionSpan.span_id,
    //   hasScores: !!decisionSpan.scores,
    //   scoreKeys: Object.keys(scores),
    //   hasScoringDetails: !!scoringDetails.parsedScores
    // })
    
    return {
      // Main scores (must be between 0 and 1)
      task_completion: scores.task_completion ?? scores.task_completed ?? scores.success ?? 0,
      weighted_total: scores.weighted_total ?? scores.avg_weighted_total ?? 0,
      
      // Multi-dimensional scores from LLM Judge (check both direct scores and scoring_details)
      goal_achievement: scores.goal_achievement ?? scoringDetails.parsedScores?.goal_achievement ?? 0,
      execution_quality: scores.execution_quality ?? scoringDetails.parsedScores?.execution_quality ?? 0,
      execution_precision: scores.execution_precision ?? scoringDetails.parsedScores?.execution_precision ?? 0,
      progress_made: scores.progress_made ?? scoringDetails.parsedScores?.progress_made ?? 0,
      plan_coherence: scores.plan_coherence ?? scoringDetails.parsedScores?.plan_coherence ?? 0,
      error_handling: scores.error_handling ?? scoringDetails.parsedScores?.error_handling ?? 0
    }
  }

  /**
   * Fetch child spans for a root span and extract scores
   * @param rootSpan - The root span to fetch children for
   * @param apiKey - Braintrust API key for fetching
   * @returns The decision span with scores, or null if not found
   */
  static async fetchDecisionSpan(rootSpan: any, apiKey?: string): Promise<any> {
    try {
      const childQuery = this.buildChildSpanQuery(rootSpan.span_id)
      
      // console.log(`🔍 Fetching child spans for root span ${rootSpan.span_id}`)
      
      const childResponse = await fetch('https://api.braintrust.dev/btql', {
        method: 'POST',
        headers: this.buildBraintrustHeaders(apiKey),
        body: JSON.stringify(childQuery)
      })
      
      if (!childResponse.ok) {
        console.error('Failed to fetch child spans:', childResponse.statusText)
        return null
      }
      
      const childData = await childResponse.json()
      const childSpans = childData.data || []
      
      // console.log(`  Found ${childSpans.length} child spans`)
      
      // Find the decision point span that contains scores
      const decisionSpan = this.findDecisionSpan(childSpans)
      
      // if (decisionSpan) {
      //   console.log(`  ✓ Found decision span: ${decisionSpan.name}`)
      // } else {
      //   console.log(`  ⚠️ No decision span found among child spans`)
      // }
      
      return decisionSpan
    } catch (error) {
      console.error('Error fetching child spans:', error)
      return null
    }
  }
  
  /**
   * Format V1 event data for Braintrust
   * Include span linkage for trace visualization
   */
  static formatV1EventData(log: any, decisionSpan: any, v1Scores: any) {
    // Use decision span's output if available, otherwise root span's output
    const output = decisionSpan?.output || log.output || ''
    const durationMs = decisionSpan?.metrics?.duration_ms ?? log.metrics?.duration_ms ?? 0
    
    return {
      id: `v1_${log.id}`,
      input: log.input || '',  // Root spans have input directly
      output: output,
      expected: output, // V1 output becomes expected for comparison
      scores: v1Scores,  // Now contains all multi-dimensional scores
      tags: ['baseline'],  // Tag this as baseline/v1 for filtering
      // Add span linkage fields for trace tree
      span_id: log.span_id,
      root_span_id: log.root_span_id || log.span_id,
      span_parents: log.span_parents || [],
      span_attributes: log.span_attributes,
      // Omit metrics to avoid INT32 overflow issues in Braintrust
      // Original metrics in milliseconds exceed INT32 max (2,147,483,647)
      metadata: {
        type: 'baseline',
        originalLogId: log.id,
        decisionSpanId: decisionSpan?.span_id,
        sessionId: log.metadata?.sessionId || decisionSpan?.metadata?.sessionId,
        timestamp: log.created || new Date().toISOString(),
        // Include metrics as metadata, not scores
        duration_ms: durationMs,
        tool_calls: decisionSpan?.metadata?.totalToolCalls ?? log.metadata?.totalToolCalls ?? 0,
        failed_tool_calls: decisionSpan?.metadata?.failedToolCalls ?? log.metadata?.failedToolCalls ?? 0,
        // Include scoring details if available
        scoring_details: decisionSpan?.metadata?.scoring_details,
        ...(log.metadata || {}),
        ...(decisionSpan?.metadata || {})
      }
    }
  }

  /**
   * Format V2 event data for Braintrust
   * Include span linkage and omit expected (base_exp_id auto-fills it)
   */
  static formatV2EventData(log: any, output: string, scores: any, startTimeMs: number) {
    const endTimeMs = Date.now()  // Use Date.now() consistently (epoch ms)
    const durationMs = endTimeMs - startTimeMs
    
    // Log the scores being passed for debugging
    // console.log('📊 V2 scores being formatted:', {
    //   hasScores: !!scores,
    //   scoreKeys: scores ? Object.keys(scores) : [],
    //   scores: scores
    // })
    
    return {
      id: `v2_${log.id}`,
      input: log.input || log.metadata?.task || '',
      output: output || '',
      // OMIT expected - Braintrust auto-fills from baseline via base_exp_id
      scores: {
        // Use v2 scores if available, otherwise default (all must be 0-1)
        task_completion: scores?.task_completion ?? scores?.task_completed ?? 0,
        weighted_total: scores?.weighted_total ?? scores?.success ?? 0,
        
        // Dimension scores (already 0-1)
        goal_achievement: scores?.goal_achievement ?? 0,
        execution_quality: scores?.execution_quality ?? 0,
        execution_precision: scores?.execution_precision ?? 0,
        progress_made: scores?.progress_made ?? 0,
        plan_coherence: scores?.plan_coherence ?? 0,
        error_handling: scores?.error_handling ?? 0
        
        // Note: Removed duration_ms, tool_calls, failed_tool_calls from scores
        // Braintrust scores must be between 0 and 1
      },
      tags: ['new'],  // Tag this as new/v2 for filtering
      // Add span linkage (if available from v2 execution)
      span_id: `v2_span_${log.id}`,  // Generate a v2 span ID
      root_span_id: `v2_span_${log.id}`,  // Same for root since it's a single execution
      span_parents: [],  // No parents for root span
      // Omit metrics to avoid INT32 overflow issues in Braintrust
      // Timestamps in milliseconds exceed INT32 max (2,147,483,647)
      metadata: {
        type: 'new',
        originalLogId: log.id,
        sessionId: log.metadata?.sessionId,
        timestamp: new Date().toISOString(),
        // Include metrics as metadata, not scores
        executionTime: durationMs,
        duration_ms: durationMs,
        tool_calls: scores?.tool_calls ?? 0,
        failed_tool_calls: scores?.failed_tool_calls ?? 0,
        scoringDetails: scores?.scoringDetails
      }
    }
  }

  /**
   * Build v1 baseline experiment body
   */
  static buildV1ExperimentBody(name: string, tag: string) {
    return {
      name,
      project_id: BRAINTRUST_PROJECT_UUID,  // Must be UUID, not project name
      ensure_new: true,  // Avoid reusing old experiment names
      description: `Baseline experiment from ${tag} tagged logs`,
      metadata: {
        type: 'baseline',
        createdAt: new Date().toISOString()
      }
    }
  }

  /**
   * Build v2 new experiment body
   */
  static buildV2ExperimentBody(name: string, v1Name: string, v1Id: string) {
    return {
      name,
      project_id: BRAINTRUST_PROJECT_UUID,  // Must be UUID, not project name
      base_exp_id: v1Id,  // Link to baseline for comparison (auto-fills expected)
      ensure_new: true,  // Avoid reusing old experiment names
      description: `New experiment comparing against ${v1Name}`,
      metadata: {
        type: 'new',
        baselineExperiment: v1Name,
        baselineExperimentId: v1Id,
        createdAt: new Date().toISOString()
      }
    }
  }

  /**
   * Build experiment URLs
   */
  static buildExperimentUrls(v1Name: string, v2Name: string, v1Id: string, v2Id: string) {
    const baseUrl = 'https://braintrust.dev'
    const organization = 'Felafax'
    const projectSlug = 'browseros-agent-online'
    
    // Experiment names already have timestamps from buildExperimentNames
    // Just URL-encode them properly
    const v1NameEncoded = encodeURIComponent(v1Name)
    const v2NameEncoded = encodeURIComponent(v2Name)
    
    return {
      v1ExperimentUrl: `${baseUrl}/app/${organization}/p/${projectSlug}/experiments/${v1NameEncoded}`,
      v2ExperimentUrl: `${baseUrl}/app/${organization}/p/${projectSlug}/experiments/${v2NameEncoded}`, 
      compareUrl: `${baseUrl}/app/${organization}/p/${projectSlug}/experiments/${v2NameEncoded}?c=${v1NameEncoded}`
    }
  }

  /**
   * Fetch available tags from Braintrust logs
   * @param apiKey - Braintrust API key
   * @returns Array of tags with their occurrence counts
   */
  static async fetchAvailableTags(apiKey?: string): Promise<{ tag: string; count: number }[]> {
    // Check if UUID is configured
    if (!BRAINTRUST_PROJECT_UUID) {
      throw new Error('BRAINTRUST_PROJECT_UUID not configured in config.ts')
    }
    
    // Query to get all root spans and their tags
    const query = `select: *
from: project_logs('${BRAINTRUST_PROJECT_UUID}')
filter: is_root
sort: created desc
limit: 500`
    
    console.log('🔍 Fetching available tags from Braintrust logs')
    
    const response = await fetch('https://api.braintrust.dev/btql', {
      method: 'POST',
      headers: this.buildBraintrustHeaders(apiKey),
      body: JSON.stringify({
        query: query,
        fmt: "json"
      })
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch tags: ${await response.text()}`)
    }
    
    const data = await response.json()
    const logs = data.rows || data.data || []
    
    console.log(`📊 Fetched ${logs.length} logs to extract tags from`)
    
    // Count occurrences of each tag
    const tagCounts = new Map<string, number>()
    let logsWithTags = 0
    let logsWithoutTags = 0
    
    logs.forEach((log: any) => {
      if (log.tags && Array.isArray(log.tags) && log.tags.length > 0) {
        logsWithTags++
        log.tags.forEach((tag: string) => {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
        })
      } else {
        logsWithoutTags++
      }
    })
    
    // console.log(`🏷️ Tag summary: ${logsWithTags} logs with tags, ${logsWithoutTags} without tags`)
    // console.log(`🏷️ Found ${tagCounts.size} unique tags:`, Array.from(tagCounts.keys()))
    
    // Convert to array and sort by count (highest first)
    const tagsWithCounts = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
    
    return tagsWithCounts
  }

  /**
   * Fetch logs and validate they exist for the given tag
   * @param tag - The tag to search for
   * @param maxLogs - Maximum number of logs to fetch
   * @param apiKey - Braintrust API key
   * @returns The fetched logs
   * @throws Error if no logs found with the tag
   */
  static async fetchAndValidateLogs(tag: string, maxLogs: number, apiKey?: string): Promise<any[]> {
    const queryBody = this.buildLogQuery(tag, maxLogs)
    // console.log('📤 Fetching logs with query:', JSON.stringify(queryBody, null, 2))
    
    const logsResponse = await fetch('https://api.braintrust.dev/btql', {
      method: 'POST',
      headers: this.buildBraintrustHeaders(apiKey),
      body: JSON.stringify(queryBody)
    })
    
    const responseText = await logsResponse.text()
    let data
    try {
      data = JSON.parse(responseText)
    } catch (e) {
      console.error('Failed to parse response:', responseText)
      throw new Error('Invalid response from Braintrust API')
    }
    
    // Check for API errors
    if (!logsResponse.ok || data.error) {
      console.error('❌ Braintrust API error:', {
        status: logsResponse.status,
        error: data.error || data.message || 'Unknown error'
      })
      throw new Error(`Braintrust API error: ${data.error || data.message || logsResponse.status}`)
    }
    
    // BTQL can return either 'rows' or 'data'
    const logs = data.rows || data.data || []
    
    // console.log('📥 Braintrust response:', {
    //   ok: logsResponse.ok,
    //   status: logsResponse.status,
    //   rowCount: logs.length,
    //   error: data.error,
    //   firstLogTags: logs[0]?.tags || 'No logs'
    // })
    
    if (logs.length === 0) {
      // Get available tags for error message
      const availableTags = await this.getAvailableTagsForError(apiKey)
      
      let errorMsg = `No logs found with exact tag "${tag}".`
      if (availableTags.size > 0) {
        errorMsg += `\n\nAvailable tags found:\n\n- ${Array.from(availableTags).join('\n- ')}`
        errorMsg += `\n\nPlease use one of the available tags or create logs with tag "${tag}".`
      } else {
        errorMsg += `\n\nNo tags found in recent logs.`
        errorMsg += `\n\nPlease tag your logs in Braintrust or run new sessions with the tag "${tag}".`
      }
      
      throw new Error(errorMsg)
    }
    
    // Note: Root spans don't have scores - they're in child decision point spans
    // Scores will be properly fetched in runSingleTest() via fetchDecisionSpan()
    
    console.log(`📥 Using ${logs.length} tagged logs (scores will be fetched from child spans)`)
    return logs
  }

  /**
   * Helper to get available tags for error messages
   */
  private static async getAvailableTagsForError(apiKey?: string): Promise<Set<string>> {
    const fallbackQuery = this.buildUntaggedDecisionPointQuery(100)
    const fallbackResponse = await fetch('https://api.braintrust.dev/btql', {
      method: 'POST',
      headers: this.buildBraintrustHeaders(apiKey),
      body: JSON.stringify(fallbackQuery)
    })
    
    const fallbackData = await fallbackResponse.json()
    const fallbackLogs = fallbackData.rows || fallbackData.data || []
    
    const availableTags = new Set<string>()
    fallbackLogs.forEach((log: any) => {
      if (log.tags && Array.isArray(log.tags)) {
        log.tags.forEach((tag: string) => availableTags.add(tag))
      }
    })
    
    return availableTags
  }

  /**
   * Create baseline and new experiments in Braintrust
   * @param logsTag - The tag used for the baseline logs
   * @param apiKey - Braintrust API key
   * @returns Object with experiment IDs, names, and URLs
   */
  static async createExperiments(logsTag: string, apiKey?: string): Promise<{
    v1ExperimentId: string
    v2ExperimentId: string
    v1ExperimentName: string
    v2ExperimentName: string
    urls: ReturnType<typeof ExperimentHelper.buildExperimentUrls>
  }> {
    const names = this.buildExperimentNames(logsTag)
    
    // Create v1 (baseline) experiment
    const v1Response = await fetch('https://api.braintrust.dev/v1/experiment', {
      method: 'POST',
      headers: this.buildBraintrustHeaders(apiKey),
      body: JSON.stringify(this.buildV1ExperimentBody(names.v1ExperimentName, logsTag))
    })
    
    if (!v1Response.ok) {
      throw new Error(`Failed to create v1 experiment: ${await v1Response.text()}`)
    }
    
    const v1Experiment = await v1Response.json()
    const v1ExperimentId = v1Experiment.id
    
    console.log('Created v1 baseline experiment:', { 
      id: v1ExperimentId, 
      name: names.v1ExperimentName
    })
    
    // Create v2 (new) experiment
    const v2Response = await fetch('https://api.braintrust.dev/v1/experiment', {
      method: 'POST',
      headers: this.buildBraintrustHeaders(apiKey),
      body: JSON.stringify(this.buildV2ExperimentBody(
        names.v2ExperimentName, 
        names.v1ExperimentName, 
        v1ExperimentId
      ))
    })
    
    if (!v2Response.ok) {
      throw new Error(`Failed to create v2 experiment: ${await v2Response.text()}`)
    }
    
    const v2Experiment = await v2Response.json()
    const v2ExperimentId = v2Experiment.id
    
    console.log('Created v2 new experiment:', { 
      id: v2ExperimentId, 
      name: names.v2ExperimentName
    })
    
    // Build URLs
    const urls = this.buildExperimentUrls(
      names.v1ExperimentName,
      names.v2ExperimentName,
      v1ExperimentId,
      v2ExperimentId
    )
    
    return {
      v1ExperimentId,
      v2ExperimentId,
      v1ExperimentName: names.v1ExperimentName,
      v2ExperimentName: names.v2ExperimentName,
      urls
    }
  }

  /**
   * Performs cleanup between experiment tests
   * Ensures test isolation by clearing persistent state
   */
  private static async performCompleteCleanup(): Promise<void> {
    console.log('%c🧹 Cleaning up test environment...', 'color: #ff9800; font-weight: bold; font-size: 11px')
    
    try {
      // 1. Clear ALL Chrome Storage (critical for test isolation)
      console.log('  📦 Clearing Chrome storage...')
      try {
        // Clear local storage
        await chrome.storage.local.clear()
        console.log('    ✓ Local storage cleared')
        
        // Clear session storage
        await chrome.storage.session.clear()
        console.log('    ✓ Session storage cleared')
        
        // Clear sync storage (if used)
        try {
          await chrome.storage.sync.clear()
          console.log('    ✓ Sync storage cleared')
        } catch (e) {
          // Sync storage might not be available
        }
      } catch (e) {
        console.warn('    ⚠ Storage clear error:', e)
      }
      
      // 2. Reset singleton instances
      console.log('  🔄 Resetting singleton instances...')
      
      // Reset BraintrustEventCollector
      try {
        const { BraintrustEventCollector } = await import('@/evals/BraintrustEventCollector')
        const telemetry = BraintrustEventCollector.getInstance()
        if (telemetry) {
          // Clear all internal state
          if ((telemetry as any).toolErrorCounts) {
            (telemetry as any).toolErrorCounts.clear();
          }
          (telemetry as any).executionContext = null;
          (telemetry as any).logger = null;  // Force re-initialization
          (telemetry as any).initialized = false;  // Reset initialization flag
          (telemetry as any).enabled = false;  // Disable until next test
          (telemetry as any).telemetrySessionId = null;  // Clear session ID
          (telemetry as any).telemetryParentSpan = null;  // Clear parent span
          console.log('    ✓ BraintrustEventCollector reset')
        }
      } catch (e) {
        console.warn('    ⚠ Telemetry reset error:', e)
      }
      
      // Reset StorageManager if it has static state
      try {
        const { StorageManager } = await import('@/lib/runtime/StorageManager')
        if ((StorageManager as any).cache) {
          (StorageManager as any).cache = null
        }
        console.log('    ✓ StorageManager cache cleared')
      } catch (e) {
        // StorageManager might not have static state
      }
      
      // 3. Close ALL tabs and create a fresh one
      console.log('  🌐 Resetting browser tabs...')
      try {
        // Create new tab first (Chrome's default new tab page)
        const newTab = await chrome.tabs.create({ 
          active: false
          // Omit url to get Chrome's default new tab page
        })
        
        // Query and close all other tabs
        const allTabs = await chrome.tabs.query({})
        const tabsToClose = allTabs.filter(tab => tab.id !== newTab.id)
        
        if (tabsToClose.length > 0) {
          // Close tabs in batches to avoid overwhelming Chrome
          const batchSize = 10
          for (let i = 0; i < tabsToClose.length; i += batchSize) {
            const batch = tabsToClose.slice(i, i + batchSize)
            await Promise.all(batch.map(tab => 
              tab.id ? chrome.tabs.remove(tab.id).catch(() => {}) : Promise.resolve()
            ))
          }
          console.log(`    ✓ Closed ${tabsToClose.length} tabs`)
        }
        
        // Activate the new tab
        if (newTab.id) {
          await chrome.tabs.update(newTab.id, { active: true })
          console.log('    ✓ New tab created and activated')
        }
      } catch (e) {
        console.warn('    ⚠ Tab reset error:', e)
      }
      
      // 4. Verify cleanup by checking storage is empty
      console.log('  ✅ Verifying cleanup...')
      try {
        const localData = await chrome.storage.local.get(null)
        const localKeys = Object.keys(localData)
        if (localKeys.length === 0) {
          console.log('    ✓ Storage verified empty')
        } else {
          console.warn(`    ⚠ Storage still contains ${localKeys.length} keys:`, localKeys)
        }
      } catch (e) {
        console.warn('    ⚠ Could not verify storage:', e)
      }
      
      // 5. Brief stabilization delay (reduced from 1500ms)
      console.log('  ⏳ Waiting for Chrome to stabilize...')
      await new Promise(resolve => setTimeout(resolve, 300))
      
      console.log('%c✨ Cleanup complete!', 'color: #4caf50; font-weight: bold; font-size: 11px')
      
    } catch (error) {
      console.error('%c⚠️ Error during cleanup:', 'color: #f44336; font-weight: bold', error)
      // Continue anyway - best effort cleanup
    }
  }

  /**
   * Run a single test and log results to experiments
   * @param log - The log entry to test
   * @param index - The current test index
   * @param v1ExperimentId - The baseline experiment ID
   * @param v2ExperimentId - The new experiment ID
   * @param apiKey - Braintrust API key
   * @param openAIKey - OpenAI API key for scoring (optional)
   * @returns Test result with scores and timing
   */
  static async runSingleTest(
    log: any,
    index: number,
    v1ExperimentId: string,
    v2ExperimentId: string,
    apiKey?: string,
    openAIKey?: string
  ): Promise<{
    success: boolean
    score: number
    oldScore: number
    improvement: number
    duration: number
  }> {
    const startTime = Date.now()
    let output = ''
    let scores: any = { success: 0 }
    
    // Perform cleanup BEFORE test to ensure clean state
    if (index === 0) {
      console.log('%c🚀 Running pre-test cleanup for first test...', 'color: #2196f3; font-weight: bold')
      await this.performCompleteCleanup()
    }
    
    try {
      // Dynamic import NxtScape to run the test
      const { NxtScape } = await import('@/lib/core/NxtScape')
      // Pass the v2 experiment ID so NxtScape logs to both telemetry AND experiment
      const experimentNxtScape = new NxtScape({ 
        debug: false,
        experimentId: v2ExperimentId  // This enables dual logging
      })
      await experimentNxtScape.initialize()
      
      await experimentNxtScape.run({
        query: log.input,
        mode: 'browse'
      })
      
      output = 'Task completed successfully'
      scores.success = 1
      
      // NO MORE DUPLICATE SCORING!
      // NxtScape already scored with LLM Judge and logged to both:
      // 1. Telemetry logger (initLogger)
      // 2. Experiment (via experimentId)
      // The scores are already in Braintrust, no need to score again.
      
      // We just need basic success/failure for the return value
      // The actual scores are already in the experiment from NxtScape's dual logging
    } catch (e) {
      output = `Error: ${e instanceof Error ? e.message : String(e)}`
      scores.success = 0
    } finally {
      // Perform comprehensive cleanup after EVERY test
      console.log(`%c🔄 Cleaning up after test ${index + 1}...`, 'color: #ff9800; font-size: 10px')
      await this.performCompleteCleanup()
    }
    
    // Fetch child spans to get the decision span with scores
    const decisionSpan = await this.fetchDecisionSpan(log, apiKey)
    
    // Extract and format v1 scores from the decision span
    const v1Scores = this.extractV1Scores(decisionSpan)
    // console.log(`📊 V1 Scores for test ${index + 1}:`, v1Scores)
    
    // Log v1 event
    const v1EventData = this.formatV1EventData(log, decisionSpan, v1Scores)
    const v1EventResponse = await fetch('https://api.braintrust.dev/v1/insert', {
      method: 'POST',
      headers: this.buildBraintrustHeaders(apiKey),
      body: JSON.stringify({
        experiment: {
          [v1ExperimentId]: {
            events: [v1EventData]
          }
        }
      })
    })
    
    if (!v1EventResponse.ok) {
      console.error(`Failed to log v1 event: ${await v1EventResponse.text()}`)
    }
    
    
    return {
      success: scores.success === 1,
      score: scores.weighted_total || scores.success || 0,
      oldScore: log.scores?.weighted_total || log.scores?.success || 0,
      improvement: (scores.weighted_total || 0) - (log.scores?.weighted_total || 0),
      duration: Date.now() - startTime
    }
  }
}
