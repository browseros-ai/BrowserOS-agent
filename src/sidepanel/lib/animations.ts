/**
 * Animation tokens and utilities for smooth, minimalistic transitions
 * Based on current design trends: fluid effects, purposeful motion, subtle micro-interactions
 */

// Animation durations (in milliseconds)
export const ANIMATION_DURATIONS = {
  // Micro-interactions (hover, focus, press)
  micro: 150,
  // Content transitions (fade in/out, slide)
  content: 300,
  // Layout changes (expand/collapse)
  layout: 400,
  // Page transitions
  page: 500
} as const

// Animation easing curves
export const ANIMATION_EASINGS = {
  // Smooth, natural feeling
  natural: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
  // Quick start, gentle end (good for micro-interactions)
  out: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
  // Gentle start, quick end (good for exits)
  in: 'cubic-bezier(0.4, 0.0, 1, 1)',
  // Bouncy feel for attention-grabbing elements
  bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
} as const

// Animation CSS classes using Tailwind-compatible utilities
export const ANIMATION_CLASSES = {
  // Message entry animations
  messageSlideIn: 'animate-in slide-in-from-bottom-2 fade-in',
  messageSlideOut: 'animate-out slide-out-to-bottom-2 fade-out',
  
  // Typing indicator
  typingPulse: 'animate-pulse',
  typingBounce: 'animate-bounce',
  
  // Button interactions
  buttonScale: 'transition-transform hover:scale-105 active:scale-95',
  buttonFade: 'transition-opacity hover:opacity-80',
  
  // Layout transitions
  expandVertical: 'transition-all duration-300 ease-out',
  collapseVertical: 'transition-all duration-300 ease-in',
  
  // Focus and hover states
  focusRing: 'focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:ring-offset-2',
  hoverGlow: 'transition-shadow hover:shadow-md',
  
  // Shimmer effect for loading content
  shimmer: 'relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent'
} as const

// Utility function to combine animation classes
export const combineAnimations = (...classes: string[]) => classes.join(' ')

// Custom keyframes for Tailwind config
export const CUSTOM_KEYFRAMES = {
  shimmer: {
    '0%': { transform: 'translateX(-100%)' },
    '100%': { transform: 'translateX(100%)' }
  },
  'fade-in-up': {
    '0%': { opacity: '0', transform: 'translateY(10px)' },
    '100%': { opacity: '1', transform: 'translateY(0)' }
  },
  'scale-in': {
    '0%': { opacity: '0', transform: 'scale(0.95)' },
    '100%': { opacity: '1', transform: 'scale(1)' }
  },
  'typing-dot': {
    '0%, 60%, 100%': { transform: 'translateY(0)' },
    '30%': { transform: 'translateY(-10px)' }
  }
} as const

// Animation delay utilities
export const STAGGER_DELAYS = {
  short: 50,   // For quick sequential animations
  medium: 100, // For message list animations
  long: 150    // For complex sequences
} as const
