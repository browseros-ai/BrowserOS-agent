/**
 * Benchmark scenario definitions.
 *
 * Each scenario describes:
 *   - A starting URL the agent navigates to before the task
 *   - A natural-language task instruction (always "compose but don't submit"
 *     to avoid real side effects)
 *   - Expected tool usage patterns used to validate the optimized version
 *     is not cheating (e.g. skipping required steps)
 */

export interface Scenario {
  name: string
  startUrl: string
  task: string
  /** Tool names that MUST appear in the run for it to be considered valid. */
  requiredTools?: string[]
  /** Max acceptable wall-clock ms for the optimized version to pass. */
  maxWallClockMs?: number
}

/**
 * Gmail: compose a draft email.
 * Task stops at draft stage (no send) to avoid real side effects.
 */
export const sendEmailScenario: Scenario = {
  name: 'send-email-gmail',
  startUrl: 'https://mail.google.com',
  task:
    'Compose a new email draft in Gmail. ' +
    'Set the recipient to "benchmark@example.com", ' +
    'subject to "BrowserOS speed benchmark", ' +
    'and body to "This is an automated benchmark run. Do not reply.". ' +
    'Save it as a draft — do NOT click Send.',
  requiredTools: ['navigate_page', 'click'],
  maxWallClockMs: 90_000,
}

/**
 * Doctolib: find an available appointment slot.
 * Task reads data only — no booking is submitted.
 */
export const bookDoctolibScenario: Scenario = {
  name: 'book-doctolib',
  startUrl: 'https://www.doctolib.fr',
  task:
    'On Doctolib, search for a "médecin généraliste" (general practitioner) ' +
    "in Paris. Find the first available appointment slot and tell me the doctor's name, " +
    'the date, and the time of the slot. Do NOT book the appointment.',
  requiredTools: ['navigate_page'],
  maxWallClockMs: 120_000,
}

/**
 * Discord: type a message without sending.
 * Task stops before pressing Enter to avoid real messages.
 */
export const discordMessageScenario: Scenario = {
  name: 'discord-message',
  startUrl: 'https://discord.com/app',
  task:
    'In Discord, navigate to the first available text channel in the first server. ' +
    'Type the message "BrowserOS benchmark test — do not send" into the message input. ' +
    'Do NOT press Enter or click Send — leave it typed in the input box.',
  requiredTools: ['navigate_page', 'fill'],
  maxWallClockMs: 90_000,
}

export const ALL_SCENARIOS: Scenario[] = [
  sendEmailScenario,
  bookDoctolibScenario,
  discordMessageScenario,
]
