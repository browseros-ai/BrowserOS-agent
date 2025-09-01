/**
 * Utility to push all agent prompts from src/ to Braintrust
 *
 * Benefits of pushing prompts to Braintrust:
 * 1. Version Control: Track prompt changes across experiments
 * 2. A/B Testing: Compare different prompt versions systematically
 * 3. Collaboration: Share prompts with team members
 * 4. Rollback: Easily revert to previous working versions
 * 5. Analytics: See which prompts perform best across different tasks
 * 6. Experiment Tracking: Link prompts to specific evaluation runs
 */

import { readFileSync, writeFileSync } from "fs";
import path from "path";

// Import planner tool prompt functions
import {
  generatePlannerSystemPrompt,
  generatePlannerTaskPrompt,
} from "@/lib/tools/planning/PlannerTool.prompt";

// Define planner prompts to extract
const PROMPTS_TO_EXTRACT = [
  {
    name: "planner-system",
    description: "PlannerTool system prompt for task breakdown",
    category: "planning",
    extract: () => generatePlannerSystemPrompt(),
  },
  {
    name: "planner-task",
    description: "PlannerTool task prompt template",
    category: "planning",
    extract: () =>
      generatePlannerTaskPrompt(
        "TASK_PLACEHOLDER",
        3,
        "CONVERSATION_HISTORY_PLACEHOLDER",
        "BROWSER_STATE_PLACEHOLDER",
      ),
  },
];

/**
 * Extract all prompts to a JSON file for Braintrust upload
 */
function extractPromptsToFile() {
  const prompts = PROMPTS_TO_EXTRACT.map((config) => {
    try {
      const content = config.extract();
      return {
        name: config.name,
        description: config.description,
        category: config.category,
        content: content,
        length: content.length,
        extractedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        name: config.name,
        description: config.description,
        category: config.category,
        content: null,
        error: error instanceof Error ? error.message : String(error),
        extractedAt: new Date().toISOString(),
      };
    }
  });

  const output = {
    metadata: {
      extractedAt: new Date().toISOString(),
      totalPrompts: prompts.length,
      successfulExtractions: prompts.filter((p) => p.content).length,
    },
    prompts,
  };

  const outputPath = path.resolve("src/evals/extracted-prompts.json");
  writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log(
    `Extracted ${output.metadata.successfulExtractions}/${output.metadata.totalPrompts} prompts to: ${outputPath}`,
  );

  // Print summary
  prompts.forEach((prompt) => {
    if (prompt.content) {
      console.log(`✓ ${prompt.name} (${prompt.length} chars)`);
    } else {
      console.log(`✗ ${prompt.name} - ${prompt.error}`);
    }
  });

  return output;
}

/**
 * Create Braintrust SDK upload script (when ready to use Braintrust)
 */
function generateBraintrustUploadScript() {
  const script = `
// Braintrust prompt upload script
// Run with: npx tsx src/evals/upload-to-braintrust.ts

import { initLogger } from 'braintrust'

async function uploadPrompts() {
  const logger = initLogger({
    projectName: 'nxtscape-agent',
    experiment: 'prompt-versions'
  })

  // Load extracted prompts
  const promptsData = require('./extracted-prompts.json')
  
  for (const prompt of promptsData.prompts) {
    if (prompt.content) {
      await logger.logPrompt({
        name: prompt.name,
        description: prompt.description,
        prompt: prompt.content,
        metadata: {
          category: prompt.category,
          length: prompt.length,
          extractedAt: prompt.extractedAt
        }
      })
      console.log(\`Uploaded: \${prompt.name}\`)
    }
  }
  
  console.log('All prompts uploaded to Braintrust!')
}

uploadPrompts().catch(console.error)
`;

  const scriptPath = path.resolve("src/evals/upload-to-braintrust.ts");
  writeFileSync(scriptPath, script.trim());
  console.log(`\nCreated Braintrust upload script: ${scriptPath}`);
  console.log(
    "When ready to use Braintrust, run: npx tsx src/evals/upload-to-braintrust.ts",
  );
}

// Run if called directly
if (require.main === module) {
  console.log("Extracting prompts from src/...");
  extractPromptsToFile();
  generateBraintrustUploadScript();

  console.log("\n=== BENEFITS OF BRAINTRUST PROMPT MANAGEMENT ===");
  console.log("1. Version Control: Track how prompts evolve over time");
  console.log("2. A/B Testing: Test multiple prompt versions side-by-side");
  console.log("3. Performance Analytics: See which prompts work best");
  console.log("4. Team Collaboration: Share and review prompts");
  console.log("5. Experiment Linking: Connect prompts to evaluation results");
  console.log("6. Easy Rollback: Revert to previous working versions");
}
