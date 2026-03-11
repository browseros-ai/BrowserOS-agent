import comparePrices from './compare-prices/SKILL.md' with { type: 'text' }
import deepResearch from './deep-research/SKILL.md' with { type: 'text' }
import dismissPopups from './dismiss-popups/SKILL.md' with { type: 'text' }
import extractData from './extract-data/SKILL.md' with { type: 'text' }
import fillForm from './fill-form/SKILL.md' with { type: 'text' }
import manageBookmarks from './manage-bookmarks/SKILL.md' with { type: 'text' }
import monitorPage from './monitor-page/SKILL.md' with { type: 'text' }
import organizeTabs from './organize-tabs/SKILL.md' with { type: 'text' }
import readLater from './read-later/SKILL.md' with { type: 'text' }
import savePage from './save-page/SKILL.md' with { type: 'text' }
import screenshotWalkthrough from './screenshot-walkthrough/SKILL.md' with {
  type: 'text',
}
import summarizePage from './summarize-page/SKILL.md' with { type: 'text' }

type DefaultSkill = { id: string; content: string }

export const DEFAULT_SKILLS: DefaultSkill[] = [
  { id: 'summarize-page', content: summarizePage },
  { id: 'deep-research', content: deepResearch },
  { id: 'extract-data', content: extractData },
  { id: 'fill-form', content: fillForm },
  { id: 'dismiss-popups', content: dismissPopups },
  { id: 'screenshot-walkthrough', content: screenshotWalkthrough },
  { id: 'organize-tabs', content: organizeTabs },
  { id: 'compare-prices', content: comparePrices },
  { id: 'save-page', content: savePage },
  { id: 'monitor-page', content: monitorPage },
  { id: 'read-later', content: readLater },
  { id: 'manage-bookmarks', content: manageBookmarks },
]
