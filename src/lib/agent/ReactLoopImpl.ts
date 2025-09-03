/**
 * ReAct Loop Implementation - State management for observation-reasoning-action cycles
 */

// ===================================================================
//  ReAct Loop Interfaces
// ===================================================================

export interface Observation {
  screenshot: string;      // Base64 encoded screenshot
  browserState: any;       // Full browser state from refresh_state_tool  
  explanation: string;     // Human-readable explanation of what we observe
}

export interface Thought {
  reasoning: string;       // Why this action makes sense
  toolName: string;        // Which tool to use
  toolArgs?: any;         // Arguments for the tool (optional - not used in current implementation)
}

export interface ReactState {
  ultimateGoal: string;          // The original user task
  currentFocus: string;          // What we're working on right now  
  observations: Observation[];   // Keep last N observations
  thoughts: Thought[];           // Keep last N thoughts
  actions: any[];               // Keep last N action results
  cycleCount: number;
  
  addCycle(obs: Observation, thought: Thought, action: any): void;
  getContext(): string;         // Get formatted recent context
}

// ===================================================================
//  ReAct State Implementation
// ===================================================================

export class ReactStateImpl implements ReactState {
  private static readonly MAX_HISTORY = 5;  // Keep last 5 of each
  
  constructor(
    public ultimateGoal: string,
    public currentFocus: string = ''
  ) {
    this.currentFocus = currentFocus || ultimateGoal;
    this.observations = [];
    this.thoughts = [];
    this.actions = [];
    this.cycleCount = 0;
  }
  
  observations: Observation[];
  thoughts: Thought[];
  actions: any[];
  cycleCount: number;
  
  addCycle(obs: Observation, thought: Thought, action: any): void {
    // Keep circular buffer of last N items
    this.observations.push(obs);
    if (this.observations.length > ReactStateImpl.MAX_HISTORY) {
      this.observations.shift();
    }
    
    this.thoughts.push(thought);
    if (this.thoughts.length > ReactStateImpl.MAX_HISTORY) {
      this.thoughts.shift();
    }
    
    this.actions.push(action);
    if (this.actions.length > ReactStateImpl.MAX_HISTORY) {
      this.actions.shift();
    }
    
    this.cycleCount++;
  }
  
  getContext(): string {
    const recentObs = this.observations.slice(-2);
    const recentThoughts = this.thoughts.slice(-2);
    
    return `
Goal: ${this.ultimateGoal}
Current focus: ${this.currentFocus}
Recent observations: ${recentObs.map(o => o.explanation).join('; ')}
Recent reasoning: ${recentThoughts.map(t => t.reasoning).join('; ')}
    `.trim();
  }
}

// ===================================================================
//  ReAct Loop Configuration
// ===================================================================

export const REACT_CONFIG = {
  MAX_REACT_CYCLES: 20,           // Max cycles per inner loop (increased from 15)
  MAX_VALIDATION_ATTEMPTS: 5,     // Max outer validation loops
  REFRESH_STATE_EVERY_N_CYCLES: 1 // Refresh browser state every cycle
} as const;