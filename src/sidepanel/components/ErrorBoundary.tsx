import React, { Component, ErrorInfo, ReactNode } from 'react'
import { z } from 'zod'

const ErrorStateSchema = z.object({
  hasError: z.boolean(),
  error: z.instanceof(Error).nullable(),
  errorInfo: z.any().nullable()  // ErrorInfo type from React
})

type ErrorState = z.infer<typeof ErrorStateSchema>

const ErrorBoundaryPropsSchema = z.object({
  children: z.any(),  // ReactNode
  fallback: z.function().args(z.instanceof(Error), z.function()).returns(z.any()).optional(),  // Custom fallback component
  onError: z.function().args(z.instanceof(Error), z.any()).returns(z.void()).optional()  // Error callback
})

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: (error: Error, reset: () => void) => ReactNode  // Custom error UI
  onError?: (error: Error, errorInfo: ErrorInfo) => void  // Error reporting callback
}

/**
 * Reusable error boundary component for graceful error handling
 * Provides fallback UI and error recovery options
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorState> {
    // Update state to show fallback UI
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details
    console.error('ErrorBoundary caught error:', error, errorInfo)
    
    // Call optional error handler
    this.props.onError?.(error, errorInfo)
    
    // Store error info for display
    this.setState({
      errorInfo
    })
  }

  handleReset = () => {
    // Reset error state
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })
  }

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset)
      }

      // Default fallback UI using Tailwind CSS
      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] p-6 bg-red-50 dark:bg-red-950/20 rounded-lg m-4">
          <div className="text-red-600 dark:text-red-400 mb-4">
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Something went wrong
          </h2>
          
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-4 max-w-md">
            {this.state.error.message || 'An unexpected error occurred'}
          </p>
          
          <button
            onClick={this.handleReset}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            Try Again
          </button>
          
          {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
            <details className="mt-4 text-xs text-gray-500 dark:text-gray-400 max-w-full overflow-auto">
              <summary className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
                Show Error Details
              </summary>
              <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-left overflow-x-auto">
                {this.state.error.stack}
                {'\n\n'}
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * HOC to wrap any component with error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  )
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`
  
  return WrappedComponent
}