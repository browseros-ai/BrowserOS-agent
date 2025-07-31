# V2 Tailwind CSS Migration Plan

## Current Issues
1. **Inconsistent Styling Approach**: Mix of CSS modules, custom CSS variables, and Tailwind classes
2. **Duplicate Theme System**: Custom variables.css duplicates Tailwind's theme system
3. **Non-standard Patterns**: Not following shadcn conventions for component styling

## Required Updates

### 1. Remove CSS Modules
- Delete all `.module.scss` files
- Remove CSS module imports from components
- Replace with Tailwind utility classes

### 2. Update Components to Use Tailwind Classes

#### Chat.tsx
- Remove: `styles.chatContainer`
- Replace with: `h-full flex flex-col bg-background`

#### Header.tsx
- Remove: `styles.header`, `styles.headerActions`
- Replace with Tailwind classes for flex layout, padding, borders
- Use shadcn color conventions (border-border, bg-background)

#### MessageList.tsx
- Remove: `styles.messageList`, `styles.emptyState`, `styles.examples`
- Use Tailwind for scrolling, spacing, grid layout
- Apply consistent color scheme

#### MessageItem.tsx
- Remove: `styles.messageItem`, `styles.messageContent`, `styles.markdownContent`
- Use Tailwind for message alignment, padding, colors
- Implement proper dark mode support

#### ChatInput.tsx
- Remove: All module styles
- Use Tailwind for positioning, spacing, animations
- Leverage shadcn form patterns

### 3. Delete Custom CSS Files
- Remove `variables.css` - use Tailwind theme
- Remove `global.css` - consolidate into main globals.css
- Remove all component CSS modules

### 4. Update Color System
- Replace custom color variables with Tailwind's shadcn colors:
  - `--color-background` → `bg-background`
  - `--color-border` → `border-border`
  - `--color-primary` → `bg-primary`
  - `--color-error` → `bg-destructive`
  - etc.

### 5. Animation Updates
- Replace CSS keyframes with Tailwind animation utilities
- Use `transition-all duration-200` instead of custom transitions
- Leverage `animate-in` and `animate-out` from tailwindcss-animate

### 6. Responsive Design
- Use Tailwind's responsive prefixes (sm:, md:, lg:)
- Remove custom media queries
- Apply mobile-first approach

### 7. Focus States
- Use Tailwind's focus utilities: `focus:ring-2 focus:ring-primary`
- Remove custom focus styles
- Ensure accessibility compliance

### 8. Dark Mode
- Use Tailwind's dark mode classes: `dark:bg-background dark:text-foreground`
- Remove custom dark mode CSS
- Leverage existing shadcn theme variables

## Migration Steps

### Step 1: Update App.tsx
- Remove global.css import
- Ensure proper Tailwind class application

### Step 2: Update Each Component
- Start with leaf components (MessageItem, Header)
- Work up to container components (Chat, MessageList)
- Test each component after update

### Step 3: Clean Up Files
- Delete all CSS modules
- Delete custom CSS files
- Update imports

### Step 4: Verify Consistency
- Check all components use Tailwind utilities
- Ensure dark mode works properly
- Test responsive behavior

### Step 5: Performance Check
- Verify no unused CSS
- Check bundle size
- Ensure smooth animations

## Tailwind Utilities Reference

### Layout
- `flex flex-col` - Flex column layout
- `grid grid-cols-2 gap-4` - Grid with 2 columns
- `absolute relative` - Positioning
- `overflow-y-auto` - Vertical scroll

### Spacing
- `p-4` - Padding 1rem
- `mx-auto` - Horizontal margin auto
- `space-y-4` - Vertical spacing between children
- `gap-2` - Gap in flex/grid

### Colors
- `bg-background` - Background color
- `text-foreground` - Text color
- `border-border` - Border color
- `bg-primary text-primary-foreground` - Primary button
- `bg-destructive text-destructive-foreground` - Error/danger

### Typography
- `text-sm` - Small text
- `font-semibold` - Semi-bold weight
- `text-muted-foreground` - Muted text color

### Borders & Radius
- `border` - 1px border
- `border-b` - Bottom border only
- `rounded-lg` - Large border radius
- `rounded-md` - Medium border radius

### States
- `hover:bg-accent` - Hover background
- `focus:ring-2 focus:ring-primary` - Focus ring
- `disabled:opacity-50` - Disabled state
- `dark:bg-card` - Dark mode background

### Animations
- `transition-all duration-200` - Smooth transitions
- `animate-pulse` - Pulse animation
- `transform hover:-translate-y-1` - Hover lift effect