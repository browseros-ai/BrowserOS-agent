/**
 * ValidatorTool evaluation with LLM scoring
 * Tests validation accuracy for task completion detection
 */

import { readFileSync } from 'fs'
import path from 'path'
import { z } from 'zod'
import { generateValidatorSystemPrompt, generateValidatorTaskPrompt } from '@/lib/tools/validation/ValidatorTool.prompt'
import { ChatOpenAI } from '@langchain/openai'
import { SystemMessage, HumanMessage } from '@langchain/core/messages'

// Test case schema - defines the structure of each validation test case
const ValidatorTestCaseSchema = z.object({
  id: z.string(),  // Unique identifier for the test case
  task: z.string(),  // The user task to validate completion for
  category: z.enum(['ecommerce', 'research', 'interaction', 'auth']),  // Task domain
  complexity: z.enum(['simple', 'medium', 'complex']),  // Task difficulty level
  currentState: z.object({
    url: z.string(),  // Current page URL
    title: z.string(),  // Current page title
    elements: z.array(z.string()),  // Visible elements on the page
    messageHistory: z.string()  // Previous conversation context
  }),
  expected: z.object({
    isComplete: z.boolean(),  // Expected completion status
    reasoning: z.string(),  // Expected reasoning for the validation
    confidence: z.enum(['high', 'medium', 'low']),  // Expected confidence level
    suggestions: z.array(z.string()).optional()  // Expected suggestions if incomplete
  })
})

/**
 * Load and validate test cases from JSON file
 * @returns Array of validated test cases
 */
function loadValidatorTestCases() {
  const datasetPath = path.resolve('src/evals/offline/tools/validator/test-cases.json')
  const rawJson = JSON.parse(readFileSync(datasetPath, 'utf8'))
  return z.array(ValidatorTestCaseSchema).parse(rawJson)
}

// Validation result schema (same as ValidatorTool)
const ValidationResultSchema = z.object({
  isComplete: z.boolean(),  // Whether the task is complete
  reasoning: z.string(),  // Explanation of validation result
  confidence: z.enum(['high', 'medium', 'low']),  // Confidence in validation
  suggestions: z.array(z.string())  // Suggestions for the planner if task incomplete
})

// Type alias to help TypeScript
type ValidationResult = z.infer<typeof ValidationResultSchema>

/**
 * Call LLM to perform validation using ValidatorTool prompts
 */
async function performValidation(task: string, currentState: any): Promise<any> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      error: 'No API key found. Set OPENAI_API_KEY',
      validation: null
    }
  }

  try {
    // Use OpenAI with structured output (same as ValidatorTool)
    const llm = new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-4o-mini',
      temperature: 0.1
    })

    // Generate the same prompts ValidatorTool would use
    const systemPrompt = generateValidatorSystemPrompt()
    
    // Create browser state string from test data
    const browserStateString = `URL: ${currentState.url}
Title: ${currentState.title}
Elements: ${currentState.elements.join(', ')}`

    const taskPrompt = generateValidatorTaskPrompt(
      task,
      browserStateString,
      currentState.messageHistory,
      '' // No screenshot in test
    )

    // Use structured output like the real ValidatorTool
    const structuredLLM = llm.withStructuredOutput(ValidationResultSchema as any)
    const validation = await structuredLLM.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(taskPrompt)
    ]) as ValidationResult

    return { validation }

  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      validation: null
    }
  }
}

/**
 * LLM-based scorer for validation accuracy
 */
async function scoreValidationWithLLM(
  task: string, 
  currentState: any,
  actualValidation: any, 
  expectedValidation: any
): Promise<{ score: number, reasoning: string }> {
  if (!process.env.OPENAI_API_KEY) {
    return { score: 0, reasoning: 'No API key for scoring' }
  }

  try {
    const llm = new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-4o-mini',
      temperature: 0.1
    })

    const scoringPrompt = `Evaluate this validation result for accuracy.

TASK: ${task}

CURRENT STATE:
- URL: ${currentState.url}  
- Title: ${currentState.title}
- Elements: ${currentState.elements.join(', ')}
- History: ${currentState.messageHistory}

ACTUAL VALIDATION:
${JSON.stringify(actualValidation, null, 2)}

EXPECTED VALIDATION:
${JSON.stringify(expectedValidation, null, 2)}

Evaluate on these criteria:
1. **Completion Accuracy**: Did it correctly identify if the task is complete/incomplete? (40%)
2. **Reasoning Quality**: Is the reasoning logical and well-supported by evidence? (30%) 
3. **Confidence Appropriateness**: Is the confidence level justified by the evidence? (20%)
4. **Suggestion Quality**: Are suggestions specific and actionable (if task incomplete)? (10%)

Scoring guide:
- 1.0: Perfect validation with accurate completion status and excellent reasoning
- 0.8-0.9: Correct completion status with good reasoning, minor issues
- 0.6-0.7: Correct completion status but weak reasoning, or minor accuracy issues
- 0.4-0.5: Incorrect completion status but reasonable reasoning given the evidence
- 0.2-0.3: Major errors in both completion status and reasoning
- 0.0-0.1: Completely incorrect validation

Respond with JSON:
{
  "score": 0.85,
  "reasoning": "Brief explanation of the score focusing on accuracy and reasoning quality"
}`

    const response = await llm.invoke([{ role: 'user', content: scoringPrompt }])
    let content = response.content as string
    
    // Remove markdown code blocks if present
    content = content.replace(/```json\s*|\s*```/g, '').trim()
    
    const result = JSON.parse(content)
    
    return {
      score: Math.max(0, Math.min(1, result.score)),
      reasoning: result.reasoning
    }

  } catch (error) {
    return {
      score: 0,
      reasoning: `LLM scoring failed: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * Run the validator evaluation locally for development
 * Only runs the first test case to keep execution time reasonable
 */
async function runValidatorLLMEvaluation() {
  console.log('Running ValidatorTool LLM Evaluation')
  
  // Check API key first
  if (!process.env.OPENAI_API_KEY) {
    console.log('Error: No API key found')
    console.log('Set OPENAI_API_KEY environment variable')
    return
  }

  const testCases = loadValidatorTestCases().slice(0, 1) // Test only first case for local validation
  const results = []
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i]
    console.log(`\nTest ${i + 1}/${testCases.length}: ${testCase.id}`)
    console.log(`Task: ${testCase.task}`)
    console.log(`State: ${testCase.currentState.url}`)
    
    try {
      // Perform validation
      console.log('  Performing validation...')
      const validation = await performValidation(testCase.task, testCase.currentState)
      
      if (validation.error) {
        console.log(`  Validation Error: ${validation.error}`)
        results.push({ id: testCase.id, score: 0, error: validation.error })
        continue
      }

      console.log(`  Result: ${validation.validation.isComplete ? 'Complete' : 'Incomplete'}`)
      console.log(`  Confidence: ${validation.validation.confidence}`)
      
      // Score with LLM
      console.log('  Scoring accuracy...')
      const scoring = await scoreValidationWithLLM(
        testCase.task, 
        testCase.currentState,
        validation.validation, 
        testCase.expected
      )
      
      console.log(`  Score: ${scoring.score.toFixed(2)}`)
      console.log(`  Reasoning: ${scoring.reasoning}`)
      
      results.push({
        id: testCase.id,
        score: scoring.score,
        reasoning: scoring.reasoning,
        actualResult: validation.validation.isComplete,
        expectedResult: testCase.expected.isComplete
      })
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.log(`  Error: ${errorMsg}`)
      results.push({ id: testCase.id, score: 0, error: errorMsg })
    }
  }
  
  const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length
  const passed = results.filter(r => r.score > 0.7).length
  const accurateValidations = results.filter(r => r.actualResult === r.expectedResult).length
  
  console.log(`\n=== RESULTS ===`)
  console.log(`Passed: ${passed}/${results.length}`)
  console.log(`Validation Accuracy: ${accurateValidations}/${results.length}`)
  console.log(`Average Score: ${avgScore.toFixed(3)}`)
  
  return results
}

// Braintrust-compatible evaluation function
export default async function Eval() {
  return {
    data: loadValidatorTestCases(), // Load all test cases for Braintrust
    task: async (input: z.infer<typeof ValidatorTestCaseSchema>) => {
      // Perform validation using our ValidatorTool prompts
      const validation = await performValidation(input.task, input.currentState)
      
      if (validation.error) {
        return { error: validation.error, result: null }
      }
      
      return { result: validation.validation }
    },
    scores: [
      async (input: z.infer<typeof ValidatorTestCaseSchema>, output: any) => {
        if (output.error) {
          return { name: 'validation_accuracy', score: 0, metadata: { error: output.error } }
        }
        
        const scoring = await scoreValidationWithLLM(
          input.task, 
          input.currentState,
          output.result, 
          input.expected
        )
        
        return {
          name: 'validation_accuracy',
          score: scoring.score,
          metadata: {
            reasoning: scoring.reasoning,
            actualResult: output.result.isComplete,
            expectedResult: input.expected.isComplete,
            accurateValidation: output.result.isComplete === input.expected.isComplete
          }
        }
      }
    ]
  }
}

// Local runner for development
if (require.main === module) {
  runValidatorLLMEvaluation()
    .then(() => {
      console.log('\nValidator LLM evaluation completed')
      process.exit(0)
    })
    .catch((error) => {
      console.error('Validator LLM evaluation failed:', error)
      process.exit(1)
    })
}
