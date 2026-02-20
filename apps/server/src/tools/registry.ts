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
import { createRegistry } from './core/tool-registry'
import { get_recent_history, search_history } from './history'
import {
  click,
  click_at,
  drag,
  fill,
  handle_dialog,
  hover,
  press_key,
  scroll,
  select_option,
} from './input'
import {
  close_page,
  list_pages,
  navigate_page,
  new_page,
  wait_for,
} from './navigation'
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

export const registry = createRegistry([
  // Navigation (5)
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

  // Input (9)
  click,
  click_at,
  hover,
  fill,
  press_key,
  drag,
  scroll,
  handle_dialog,
  select_option,

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
