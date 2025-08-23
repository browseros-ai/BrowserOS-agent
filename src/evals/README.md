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

```

- **Online Telemetry**: Automatic tool tracking with multi-dimensional LLM scoring (see [online/README.md](online/README.md))
- **Offline Evaluations**: Standalone tests for critical tools
- **Zero Production Impact**: Development-only system
