import React from 'react'
import { cn } from '@/sidepanel/lib/utils'
import { z } from 'zod'

// Define the props schema with Zod
const SliderPropsSchema = z.object({
  value: z.number(),  // Current value
  min: z.number().default(0),  // Minimum value
  max: z.number().default(100),  // Maximum value
  step: z.number().default(1),  // Step increment
  onChange: z.function().args(z.number()).returns(z.void()),  // Change handler
  className: z.string().optional(),  // Additional CSS classes
  disabled: z.boolean().optional(),  // Whether slider is disabled
  'aria-label': z.string().optional()  // Accessibility label
})

// Infer the type from the schema
type SliderProps = z.infer<typeof SliderPropsSchema>

export function Slider({ 
  value, 
  min = 0, 
  max = 100, 
  step = 1, 
  onChange, 
  className, 
  disabled = false,
  'aria-label': ariaLabel 
}: SliderProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value)
    onChange(newValue)
  }

  // Calculate progress percentage for visual feedback (not rendered)
  const progress = ((value - min) / (max - min)) * 100

  return (
    <div className={cn('relative w-full', className)}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleChange}
        disabled={disabled}
        aria-label={ariaLabel}
        className={cn(
          'w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer',
          'focus-visible:outline-none',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          // Custom styling for webkit browsers
          '[&::-webkit-slider-thumb]:appearance-none',
          '[&::-webkit-slider-thumb]:w-4',
          '[&::-webkit-slider-thumb]:h-4',
          '[&::-webkit-slider-thumb]:bg-brand',
          '[&::-webkit-slider-thumb]:rounded-full',
          '[&::-webkit-slider-thumb]:cursor-pointer',
          '[&::-webkit-slider-thumb]:border-2',
          '[&::-webkit-slider-thumb]:border-background',
          '[&::-webkit-slider-thumb]:shadow-sm',
          '[&::-webkit-slider-thumb]:hover:bg-brand/90',
          '[&::-webkit-slider-thumb]:active:bg-brand/80',
          // Custom styling for moz browsers
          '[&::-moz-range-thumb]:w-4',
          '[&::-moz-range-thumb]:h-4',
          '[&::-moz-range-thumb]:bg-brand',
          '[&::-moz-range-thumb]:rounded-full',
          '[&::-moz-range-thumb]:cursor-pointer',
          '[&::-moz-range-thumb]:border-2',
          '[&::-moz-range-thumb]:border-background',
          '[&::-moz-range-thumb]:shadow-sm',
          '[&::-moz-range-thumb]:hover:bg-brand/90',
          '[&::-moz-range-thumb]:active:bg-brand/80',
          // Track styling
          '[&::-webkit-slider-track]:bg-muted',
          '[&::-webkit-slider-track]:rounded-lg',
          '[&::-moz-range-track]:bg-muted',
          '[&::-moz-range-track]:rounded-lg'
        )}
      />
    </div>
  )
} 