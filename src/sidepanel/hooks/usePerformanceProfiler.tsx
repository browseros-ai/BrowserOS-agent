import { useEffect, useRef } from "react";

interface PerformanceMetrics {
  renderCount: number;
  lastRenderTime: number;
  averageRenderTime: number;
  maxRenderTime: number;
}

/**
 * Hook for profiling component performance in development
 * Tracks render counts and timing for optimization
 */
export function usePerformanceProfiler(componentName: string) {
  const metricsRef = useRef<PerformanceMetrics>({
    renderCount: 0,
    lastRenderTime: 0,
    averageRenderTime: 0,
    maxRenderTime: 0,
  });

  const renderStartRef = useRef<number>(0);

  // Only run in development
  if (process.env.NODE_ENV === "production") {
    return {
      startRender: () => {},
      endRender: () => {},
      getMetrics: () => metricsRef.current,
    };
  }

  const startRender = () => {
    renderStartRef.current = performance.now();
  };

  const endRender = () => {
    const renderTime = performance.now() - renderStartRef.current;
    const metrics = metricsRef.current;

    metrics.renderCount++;
    metrics.lastRenderTime = renderTime;
    metrics.maxRenderTime = Math.max(metrics.maxRenderTime, renderTime);
    metrics.averageRenderTime =
      (metrics.averageRenderTime * (metrics.renderCount - 1) + renderTime) /
      metrics.renderCount;

    // Log slow renders
    if (renderTime > 16) {
      // More than 1 frame at 60fps
      console.warn(
        `[Performance] ${componentName} slow render: ${renderTime.toFixed(2)}ms`,
      );
    }
  };

  // Log metrics periodically in development
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      const interval = setInterval(() => {
        const metrics = metricsRef.current;
        if (metrics.renderCount > 0) {
          console.log(`[Performance] ${componentName} metrics:`, {
            renders: metrics.renderCount,
            avgTime: `${metrics.averageRenderTime.toFixed(2)}ms`,
            maxTime: `${metrics.maxRenderTime.toFixed(2)}ms`,
            lastTime: `${metrics.lastRenderTime.toFixed(2)}ms`,
          });
        }
      }, 10000); // Every 10 seconds

      return () => clearInterval(interval);
    }
  }, [componentName]);

  // Track render in useEffect
  useEffect(() => {
    startRender();
    return () => {
      endRender();
    };
  });

  return {
    startRender,
    endRender,
    getMetrics: () => metricsRef.current,
  };
}

/**
 * HOC to add performance profiling to any component
 */
export function withPerformanceProfiler<P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string,
) {
  const ProfiledComponent = (props: P) => {
    const name =
      componentName || Component.displayName || Component.name || "Unknown";
    const profiler = usePerformanceProfiler(name);

    profiler.startRender();
    const result = <Component {...props} />;
    profiler.endRender();

    return result;
  };

  ProfiledComponent.displayName = `withProfiler(${Component.displayName || Component.name})`;

  return ProfiledComponent;
}
