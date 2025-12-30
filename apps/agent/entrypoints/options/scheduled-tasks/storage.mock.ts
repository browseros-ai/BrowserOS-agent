import type {
  ScheduledJob,
  ScheduledJobRun,
  ScheduledTasksStorage,
} from './types'

// ============================================
// MOCK DATA - Edit this JSON to change test data
// ============================================

const MOCK_JOBS: ScheduledJob[] = [
  {
    id: '1',
    name: 'Morning Briefing',
    query: 'Check my email and summarize important messages',
    scheduleType: 'daily',
    scheduleTime: '09:00',
    enabled: true,
    createdAt: '2024-12-20T10:00:00Z',
    lastRunAt: '2024-12-23T09:00:00Z',
  },
  {
    id: '2',
    name: 'Price Monitor',
    query: 'Check Amazon wishlist for price drops and deals',
    scheduleType: 'hourly',
    scheduleInterval: 2,
    enabled: true,
    createdAt: '2024-12-21T14:00:00Z',
    lastRunAt: '2024-12-23T14:00:00Z',
  },
  {
    id: '3',
    name: 'News Digest',
    query: 'Summarize top tech news from Hacker News',
    scheduleType: 'daily',
    scheduleTime: '18:00',
    enabled: false,
    createdAt: '2024-12-22T08:00:00Z',
  },
]

const MOCK_RUNS: ScheduledJobRun[] = [
  {
    id: 'run-1',
    jobId: '1',
    startedAt: '2024-12-23T09:00:00Z',
    completedAt: '2024-12-23T09:02:34Z',
    status: 'completed',
    result:
      'You have 3 important emails:\n\n1. Meeting reminder from John - Team sync at 2pm today\n2. Project update from Sarah - Q4 report needs review by EOD\n3. Calendar invite from Mike - Product launch planning Friday\n\nNo urgent action items detected.',
  },
  {
    id: 'run-2',
    jobId: '1',
    startedAt: '2024-12-22T09:00:00Z',
    completedAt: '2024-12-22T09:01:58Z',
    status: 'completed',
    result:
      'You have 5 emails, 2 marked important:\n\n1. Weekly standup notes from Team Lead\n2. Invoice from AWS - $127.43 for November\n\nNo urgent matters.',
  },
  {
    id: 'run-3',
    jobId: '1',
    startedAt: '2024-12-21T09:00:00Z',
    completedAt: '2024-12-21T09:00:45Z',
    status: 'failed',
    result: 'Error: Unable to access email. Please check authentication.',
  },
  {
    id: 'run-4',
    jobId: '2',
    startedAt: '2024-12-23T14:00:00Z',
    completedAt: '2024-12-23T14:01:12Z',
    status: 'completed',
    result:
      'Price check complete!\n\nSony WH-1000XM5: $348 → $278 (20% off!)\nLogitech MX Master 3S: No change ($99)\nKindle Paperwhite: $139 → $129 (7% off)',
  },
  {
    id: 'run-5',
    jobId: '2',
    startedAt: '2024-12-23T12:00:00Z',
    completedAt: '2024-12-23T12:00:58Z',
    status: 'completed',
    result: 'Price check complete! No price changes detected.',
  },
]

// ============================================
// In-memory store (persists during session)
// ============================================

let jobs = [...MOCK_JOBS]
let runs = [...MOCK_RUNS]

export const mockStorage: ScheduledTasksStorage = {
  loadJobs: async () => jobs,
  saveJobs: async (newJobs) => {
    jobs = newJobs
  },
  loadRuns: async () => runs,
  saveRuns: async (newRuns) => {
    runs = newRuns
  },
}
