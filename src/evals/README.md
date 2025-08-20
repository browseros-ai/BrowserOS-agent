# BrowserOS Agent Evaluation System

> **⚠️ Development Only** - This telemetry system is for internal evaluation during development, not for production use.

## Overview

Comprehensive evaluation system combining automatic telemetry with multi-dimensional LLM scoring to measure and improve agent performance.

## Architecture

```
src/evals/
├── online/         # Real-time telemetry & scoring
│   └── [See online/README.md for implementation details]
│
├── offline/        # Standalone evaluations  
│   └── tools/
│       ├── planner/     # Planner unit test
│       └── validator/   # Validator unit test
│
└── shared/         # Shared utilities
    └── push-prompts.ts  # Prompt extraction (planned)
```

- **Online Telemetry**: Automatic tool tracking with multi-dimensional LLM scoring (see [online/README.md](online/README.md))
- **Offline Evaluations**: Standalone tests for critical tools
- **Zero Production Impact**: Development-only system

## How It Works

When enabled, the system automatically:
1. Tracks all tool executions with performance metrics
2. Scores task completion across 6 quality dimensions
3. Sends telemetry data to Braintrust for analysis

For implementation details, see [online/README.md](online/README.md).

### Multi-Dimensional Scoring

Tasks are evaluated across 6 quality dimensions by an LLM judge:

| Dimension | Weight | Focus |
|-----------|--------|-------|
| **Goal Achievement** | 40% | Did the agent achieve what the user asked? |
| **Execution Quality** | 20% | Were steps logical and appropriate? |
| **Execution Precision** | 15% | Efficiency without unnecessary retries |
| **Progress Made** | 10% | How much progress toward completion? |
| **Plan Coherence** | 8% | Was the plan logical and complete? |
| **Error Handling** | 7% | Graceful recovery from issues |

**Score Interpretation:**
- `0.8-1.0`: Excellent - Task completed successfully
- `0.6-0.7`: Acceptable - Main goal achieved with issues  
- `0.4-0.5`: Mixed - Some progress but significant problems
- `0.0-0.3`: Poor - Minimal progress or failure

### What Gets Tracked

- **Tool Metrics**: Execution duration, success/failure rates
- **Task Scores**: Multi-dimensional quality assessment  
- **Session Data**: Task progression and outcomes

The system maintains full conversation context for scoring while sending only lightweight metrics to Braintrust. See [online/README.md](online/README.md) for data collection details.

## Offline Evaluations

Standalone LLM-based tests for critical tools:

```bash
# Requires OPENAI_API_KEY environment variable
OPENAI_API_KEY=sk-... npx ts-node src/evals/offline/tools/planner/planner.eval.ts
OPENAI_API_KEY=sk-... npx ts-node src/evals/offline/tools/validator/validator.eval.ts
```

- **Planner**: Tests plan generation quality (coherence, completeness, efficiency)
- **Validator**: Tests task completion detection accuracy

## Example Output

When enabled, you'll see telemetry status and scoring results in the console:

```
✓ Telemetry ready
→ Task: "Calculate 25 * 4"
📊 Score: 0.64 (Goal: 0.45, Execution: 0.85)
```

## Performance Impact

| State | Overhead | Details |
|-------|----------|---------|
| **Disabled** | 0ms | All checks return immediately |
| **Enabled** | <1ms per event | Async, non-blocking |
| **With Scoring** | ~2-3ms per event | LLM call (async) |

## Troubleshooting

**No telemetry data?** Check API keys in `config.ts` and rebuild with `npm run build:dev`

**Low scores?** Review the scoring dimensions - low Goal Achievement usually means the agent didn't communicate results to the user.

For detailed troubleshooting, see [online/README.md](online/README.md#debugging).

## Tools Tracked (16 Total)

**Planning & Management:** PlannerTool, TodoManagerTool, ClassificationTool, ValidatorTool  
**Navigation & Interaction:** NavigationTool, InteractionTool, ScrollTool, SearchTool, RefreshStateTool  
**Tab Management:** TabOperationsTool, GroupTabsTool, GetSelectedTabsTool  
**Data & Results:** ExtractTool, ScreenshotTool, ResultTool, DoneTool
