import { readFileSync } from 'fs'
import path from 'path'
import { z } from 'zod'
import { generatePlannerSystemPrompt, generatePlannerTaskPrompt } from '@/lib/tools/planning/PlannerTool.prompt'
import { ChatOpenAI } from '@langchain/openai'

// Define the schema for each test case using Zod
// This ensures that your test data is well-structured and validated
const PlannerTestCaseSchema = z.object({
  id: z.string(), // Unique identifier for the test case
  task: z.string(), // The user task to be planned
  category: z.enum(['ecommerce', 'research', 'navigation', 'interaction', 'auth']), // Task domain
  complexity: z.enum(['simple', 'medium', 'complex']), // Task difficulty
  expected: z.object({
    requiredActions: z.array(z.string()), // Actions the plan must include
    maxSteps: z.number().optional(), // Optional upper bound on steps
    minSteps: z.number().optional() // Optional lower bound on steps
  })
})

// Load and validate planner test cases from a JSON file
function loadPlannerTestCases() {
  const datasetPath = path.resolve('src/evals/offline/tools/planner/test-cases.json') // Path to test cases
  const rawJson = JSON.parse(readFileSync(datasetPath, 'utf8')) // Read and parse JSON
  return z.array(PlannerTestCaseSchema).parse(rawJson) // Validate against schema
}

// Generate a plan using the same prompts as your PlannerTool
// This bypasses Chrome APIs and directly uses OpenAI via LangChain
async function generatePlan(task: string): Promise<any> {
  if (!process.env.OPENAI_API_KEY) {
    // Fail early if no API key is set
    return {
      error: 'No API key found. Set OPENAI_API_KEY',
      steps: []
    }
  }

  try {
    // Initialize the LLM with your API key and desired model
    const llm = new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-4o-mini',
      temperature: 0.3 // Lower temperature for more deterministic output
    })

    // Generate system and user prompts using your PlannerTool logic
    const systemPrompt = generatePlannerSystemPrompt()
    const taskPrompt = generatePlannerTaskPrompt(
      task,
      5, // Max steps
      `User: ${task}`,
      'Current page: example.com'
    )

    // Construct the message array for the LLM
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: taskPrompt }
    ]

    // Send the prompt to the LLM and get the response
    const response = await llm.invoke(messages)
    const content = response.content as string

    // Parse the JSON response from the LLM
    const parsed = JSON.parse(content)
    return { steps: parsed.steps || [] }

  } catch (error) {
    // Catch and return any errors during LLM invocation or parsing
    return {
      error: error instanceof Error ? error.message : String(error),
      steps: []
    }
  }
}

// Score the generated plan using another LLM call
// This evaluates the plan against expected actions and structure
async function scorePlanWithLLM(task: string, plan: any, expected: any): Promise<{ score: number, reasoning: string }> {
  if (!process.env.OPENAI_API_KEY) {
    // Fail early if no API key is set
    return { score: 0, reasoning: 'No API key for scoring' }
  }

  try {
    // Initialize a second LLM instance for scoring
    const llm = new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-4o-mini',
      temperature: 0.1 // Lower temperature for more consistent scoring
    })

    // Construct a scoring prompt with clear evaluation criteria
    const scoringPrompt = `Evaluate this plan for the given task.

TASK: ${task}

GENERATED PLAN:
${JSON.stringify(plan.steps, null, 2)}

EXPECTED REQUIREMENTS:
- Required actions: ${expected.requiredActions.join(', ')}
- Max steps: ${expected.maxSteps || 'not specified'}
- Min steps: ${expected.minSteps || 'not specified'}

Evaluate on these criteria:
1. Completeness: Does the plan cover all required actions?
2. Logical order: Are steps in a sensible sequence?
3. Clarity: Are steps specific and actionable?
4. Efficiency: Is the plan concise without being too brief?

Respond with JSON:
{
  "score": 0.85,
  "reasoning": "Brief explanation of the score"
}`

    // Send the scoring prompt to the LLM
    const response = await llm.invoke([{ role: 'user', content: scoringPrompt }])
    const result = JSON.parse(response.content as string)

    // Clamp the score between 0 and 1
    return {
      score: Math.max(0, Math.min(1, result.score)),
      reasoning: result.reasoning
    }

  } catch (error) {
    // Catch and return any errors during scoring
    return {
      score: 0,
      reasoning: `LLM scoring failed: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

// Run the evaluation locally for development purposes
async function runLLMEvaluation() {
  console.log('Running PlannerTool LLM Evaluation')

  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    console.log('Error: No API key found')
    console.log('Set OPENAI_API_KEY environment variable')
    return
  }

  // Load only first test case for local validation
  const testCases = loadPlannerTestCases().slice(0, 1)
  const results = []

  // Loop through each test case
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i]
    console.log(`\nTest ${i + 1}/${testCases.length}: ${testCase.id}`)
    console.log(`Task: ${testCase.task}`)

    try {
      // Generate a plan using the LLM
      console.log('  Generating plan...')
      const plan = await generatePlan(testCase.task)

      if (plan.error) {
        // Handle plan generation errors
        console.log(`  Plan Error: ${plan.error}`)
        results.push({ id: testCase.id, score: 0, error: plan.error })
        continue
      }

      console.log(`  Generated ${plan.steps.length} steps`)

      // Score the plan using the LLM
      console.log('  Scoring with LLM...')
      const scoring = await scorePlanWithLLM(testCase.task, plan, testCase.expected)

      console.log(`  Score: ${scoring.score.toFixed(2)}`)
      console.log(`  Reasoning: ${scoring.reasoning}`)

      // Save the result
      results.push({
        id: testCase.id,
        score: scoring.score,
        reasoning: scoring.reasoning,
        stepCount: plan.steps.length
      })

    } catch (error) {
      // Catch any unexpected errors
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.log(`  Error: ${errorMsg}`)
      results.push({ id: testCase.id, score: 0, error: errorMsg })
    }
  }

  // Compute summary statistics
  const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length
  const passed = results.filter(r => r.score > 0.7).length

  console.log(`\n=== RESULTS ===`)
  console.log(`Passed: ${passed}/${results.length}`)
  console.log(`Average Score: ${avgScore.toFixed(3)}`)

  return results
}

// Export a Braintrust-compatible evaluation function
// This allows you to run the eval via CLI or dashboard
export default async function Eval() {
  return {
    data: loadPlannerTestCases(), // Load all test cases for Braintrust
    task: async (input: z.infer<typeof PlannerTestCaseSchema>) => {
      // Generate a plan for each input
      const plan = await generatePlan(input.task)

      if (plan.error) {
        return { error: plan.error, steps: [] }
      }

      return { steps: plan.steps }
    },
    scores: [
      // Custom scoring function using LLM
      async (input: z.infer<typeof PlannerTestCaseSchema>, output: any) => {
        if (output.error) {
          return { name: 'llm_quality', score: 0, metadata: { error: output.error } }
        }

        const scoring = await scorePlanWithLLM(input.task, output, input.expected)

        return {
          name: 'llm_quality',
          score: scoring.score,
          metadata: {
            reasoning: scoring.reasoning,
            stepCount: output.steps.length
          }
        }
      }
    ]
  }
}

// If this file is run directly (e.g. `ts-node planner-llm.eval.ts`), execute the local evaluation
if (require.main === module) {
  runLLMEvaluation()
    .then(() => {
      // Log success message and exit cleanly
      console.log('\nLLM evaluation completed')
      process.exit(0)
    })
    .catch((error) => {
      // Log failure message and exit with error code
      console.error('LLM evaluation failed:', error)
      process.exit(1)
    })
}