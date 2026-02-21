import {
  create_bookmark,
  create_bookmark_folder,
  get_bookmark_children,
  get_bookmarks,
  move_bookmark,
  remove_bookmark,
  remove_bookmark_tree,
  update_bookmark,
} from './bookmarks'
import { get_recent_history, search_history } from './history'
import {
  check,
  clear,
  click,
  click_at,
  drag,
  fill,
  focus,
  handle_dialog,
  hover,
  press_key,
  scroll,
  select_option,
  uncheck,
  upload_file,
} from './input'
import {
  close_page,
  get_active_page,
  list_pages,
  navigate_page,
  new_page,
  wait_for,
} from './navigation'
import { download_file, save_pdf } from './page-actions'
import {
  evaluate_script,
  get_page_content,
  take_enhanced_snapshot,
  take_screenshot,
  take_snapshot,
} from './snapshot'
import {
  group_tabs,
  list_tab_groups,
  ungroup_tabs,
  update_tab_group,
} from './tab-groups'
import { createRegistry } from './tool-registry'

export const registry = createRegistry([
  // Navigation (6)
  get_active_page,
  list_pages,
  navigate_page,
  new_page,
  close_page,
  wait_for,

  // Observation (5)
  take_snapshot,
  take_enhanced_snapshot,
  get_page_content,
  take_screenshot,
  evaluate_script,

  // Input (14)
  click,
  click_at,
  hover,
  focus,
  clear,
  fill,
  check,
  uncheck,
  upload_file,
  press_key,
  drag,
  scroll,
  handle_dialog,
  select_option,

  // Page Actions (2)
  save_pdf,
  download_file,

  // Bookmarks (8)
  get_bookmarks,
  create_bookmark,
  remove_bookmark,
  update_bookmark,
  create_bookmark_folder,
  get_bookmark_children,
  move_bookmark,
  remove_bookmark_tree,

  // History (2)
  search_history,
  get_recent_history,

  // Tab Groups (4)
  list_tab_groups,
  group_tabs,
  update_tab_group,
  ungroup_tabs,
])
