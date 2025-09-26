/**
 * Custom error class for abort/cancellation errors
 */
export class AbortError extends Error {
  constructor(message: string = "Task cancelled by user") {
    super(message);
    this.name = "AbortError";
  }
}

/**
 * Decorator that automatically checks for abort signal before executing async methods.
 * 
 * This decorator is designed to be used on methods of classes that have an
 * executionContext property with an abortController.
 * 
 * @example
 * ```typescript
 * class MyAgent {
 *   @Abortable
 *   async processTask(): Promise<void> {
 *     // Abort is automatically checked before this method runs
 *   }
 * }
 * ```
 * 
 * For methods with loops, you should still add manual abort checks inside the loop:
 * ```typescript
 * @Abortable
 * async processMultipleSteps(): Promise<void> {
 *   for (const step of steps) {
 *     this.checkAbort(); // Manual check inside loop
 *     await this.processStep(step);
 *   }
 * }
 * ```
 */
export function Abortable(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
): PropertyDescriptor {
  const originalMethod = descriptor.value;

  if (typeof originalMethod !== 'function') {
    throw new Error(`@Abortable can only be applied to methods, not to ${typeof originalMethod}`);
  }

  descriptor.value = async function (this: any, ...args: any[]): Promise<any> {
    // Check if the class has executionContext
    if (!this.executionContext?.abortSignal) {
      throw new Error(
        `@Abortable requires the class to have an executionContext with abortSignal. ` +
        `Make sure ${this.constructor.name} has this property.`
      );
    }

    // Check if already aborted before executing
    if (this.executionContext.abortSignal.aborted) {
      throw new AbortError();
    }

    try {
      // Call the original method
      return await originalMethod.apply(this, args);
    } catch (error) {
      // Re-throw abort errors without modification
      if (error instanceof AbortError || 
          (error instanceof Error && error.name === "AbortError")) {
        throw error;
      }
      
      // For other errors, check if we were aborted during execution
      if (this.executionContext.abortSignal.aborted) {
        throw new AbortError();
      }
      
      // Re-throw the original error
      throw error;
    }
  };

  // Note: Function.name is read-only in strict mode, so we can't set it
  // The function name will be preserved automatically by the JS engine
  
  return descriptor;
}

/**
 * Helper type to ensure a class has the required structure for @Abortable
 */
export interface AbortableClass {
  executionContext: {
    abortController: AbortController;
  };
}

/**
 * Check if an error is a user-initiated cancellation
 * Handles both AbortError instances and fetch abort errors
 */
export function isUserCancellation(error: unknown): boolean {
  if (error instanceof AbortError) {
    return true;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Check for specific abort-related messages
    return message === "request was aborted" ||
           message === "the operation was aborted" ||
           message.includes("request was aborted");
  }

  return false;
}