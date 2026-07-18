/**
 * provider.tsx — FluppyProvider React context provider.
 *
 * Wraps the app (or a subtree) with Fluppy configuration so all
 * child hooks can access stellarConfig, networkPassphrase, etc.
 * without prop drilling.
 *
 * Usage:
 *   <FluppyProvider config={{ stellarConfig, networkPassphrase }}>
 *     <App />
 *   </FluppyProvider>
 *
 * This module is safe to server-render — it holds no browser-only
 * state at the provider level. Browser-only logic is inside the hooks.
 */

import React, {
    createContext,
    useContext,
    useMemo,
} from 'react';

import type {
    FluppyReactConfig,
    FluppyReactContextValue,
    FluppyReactProviderProps,
} from './types';

// ─── Context ──────────────────────────────────────────────────────────────────

const FluppyReactContext =
    createContext<FluppyReactContextValue | null>(null);

FluppyReactContext.displayName = 'FluppyReactContext';

// ─── Provider ─────────────────────────────────────────────────────────────────

/**
 * FluppyProvider
 *
 * Provides Fluppy configuration to all child hooks.
 * Place this near the root of your application.
 *
 * @param config   - Fluppy SDK configuration (stellarConfig, networkPassphrase)
 * @param children - React subtree that can consume Fluppy hooks
 */
export function FluppyProvider({
    config,
    children,
}: FluppyReactProviderProps): React.ReactElement {
    const value = useMemo<FluppyReactContextValue>(
        () => ({ config }),
        // Re-memoize only if config reference changes.
        // Consumers should memoize their config object to prevent unnecessary re-renders.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [config],
    );

    return (
        <FluppyReactContext.Provider value={value}>
            {children}
        </FluppyReactContext.Provider>
    );
}

// ─── Internal hook ────────────────────────────────────────────────────────────

/**
 * useFluppyContext
 *
 * Internal hook — returns the FluppyProvider context value.
 * Throws a clear error if called outside a FluppyProvider.
 *
 * This is intentionally not exported from index.ts — consumers
 * should use the higher-level domain hooks (useFluppyPayment, etc.)
 * rather than the raw context.
 */
export function useFluppyContext(): FluppyReactContextValue {
    const ctx = useContext(FluppyReactContext);

    if (ctx === null) {
        throw new Error(
            '[useFluppyContext] No FluppyProvider found in the component tree. ' +
            'Wrap your application with <FluppyProvider config={...}>.</FluppyProvider>'
        );
    }

    return ctx;
}

// Export config type for convenience
export type { FluppyReactConfig };