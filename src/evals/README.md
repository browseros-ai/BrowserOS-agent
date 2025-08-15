# Tool Evaluation System
Current State:
LLM-based evaluation system for PlannerTool and ValidatorTool with LLM scoring.

## Structure

```
src/evals/
├── planner-llm.eval.ts          # LLM-based planner evaluation
├── validator-llm.eval.ts        # LLM-based validator evaluation
├── push-prompts.ts              # Extract tool prompts for Braintrust
├── tools/
│   ├── planner/test-cases.json  # Planner test cases
│   └── validator/test-cases.json # Validator test cases
└── utils/test-context.ts        # Test utilities
```

## Commands

```bash
npm run eval:planner        # Run LLM-based planner evaluation locally
npm run eval:validator      # Run LLM-based validator evaluation locally
npm run extract:prompts     # Extract tool prompts to JSON for Braintrust

# Braintrust SDK (optional)
npx braintrust eval src/evals/planner-llm.eval.ts
npx braintrust eval src/evals/validator-llm.eval.ts
```

## Prerequisites

Set your OpenAI API key:
```bash
$env:OPENAI_API_KEY="sk-your-openai-key"
```

## What happens when you run eval:planner

1. Loads test cases from `tools/planner/test-cases.json`
2. For each test case:
   - Uses your PlannerTool prompts to generate a plan via LLM
   - Scores the plan quality with LLM-as-judge (0.0-1.0)
   - Provides reasoning for the score
3. Shows summary: passed/total tests and average score

Expected output:
```
Running PlannerTool LLM Evaluation

Test 1/3: planner-001
Task: Order toothpaste on Amazon
  Generating plan...
  Generated 5 steps
  Scoring with LLM...
  Score: 0.90
  Reasoning: The plan covers all required actions and presents them in a logical sequence...

Test 2/3: planner-002
Task: Compare MacBook Air M2 prices on Amazon and Best Buy
  Generating plan...
  Generated 5 steps
  Scoring with LLM...
  Score: 0.75
  Reasoning: The plan covers most required actions but misses the explicit step...

Test 3/3: planner-003
Task: Open example.com and extract the page title
  Generating plan...
  Generated 1 steps
  Scoring with LLM...
  Score: 0.65
  Reasoning: The plan is incomplete as it only includes the action to extract...

=== RESULTS ===
Passed: 2/3
Average Score: 0.767
```

## Benefits of Braintrust Prompt Management

1. **Version Control**: Track prompt changes across experiments
2. **A/B Testing**: Compare different prompt versions systematically  
3. **Performance Analytics**: See which prompts work best
4. **Team Collaboration**: Share and review prompts
5. **Experiment Linking**: Connect prompts to evaluation results
6. **Easy Rollback**: Revert to previous working versions

## Current Status

✅ **PlannerTool evaluation is working!**
- Average score: 0.767 (2/3 tests passing)
- Successfully generates plans with your actual prompts
- LLM-as-judge scoring with detailed reasoning

## Identified Issues

- Test 3 (0.65): Plan missing navigation step for "Open example.com"
- Test 2 (0.75): Missing explicit price extraction step
- Overall: Room for prompt improvement to increase completeness

## Next Steps

**Option A: Improve PlannerTool First**
1. Analyze and improve PlannerTool prompts
2. Re-run evaluation to confirm improvements
3. Document baseline vs improved performance

**Option B: Move to Next Tool**
1. Set up ValidatorTool evaluation following same pattern
2. Add other tool evaluations (ClassificationTool, etc.)
3. Move to end-to-end agent evaluation

**Option C: Document & Continue**
1. Push current prompts to Braintrust for version control
2. Document current baseline (0.767)
3. Move to ValidatorTool while noting areas for improvement