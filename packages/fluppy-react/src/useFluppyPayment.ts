/**
 * useFluppyPayment.ts — React hook for the Fluppy ZK payment flow.
 *
 * Composes @fluppy/browser executeFluppyPayment() with React state management.
 *
 * Design properties:
 *   - Reads config from FluppyProvider via useFluppyContext() — no prop drilling
 *   - Caller passes an already-unlocked secret; this hook does NOT decrypt credentials
 *   - Secret is NEVER stored in React state — only passed through to executeFluppyPayment
 *   - SSR-safe: pay() throws a clear error if called outside a browser environment
 *   - Mounted guard: state updates are suppressed after component unmount
 *   - Active payment is aborted on unmount to prevent resource leaks
 *   - Caller is fully responsible for UI feedback (toast, error display, telemetry)
 *
 * Security:
 *   - Secret is not stored in state
 *   - Secret is not logged
 *   - Password is never received by this hook
 *   - Raw proof is not logged
 */

import {
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';

import {
  executeFluppyPayment,
  RootSyncError,
  type ExecuteFluppyPaymentResult,
  type FluppyPaymentStepName,
} from '@fluppy/browser';

import { useFluppyContext } from './provider';
import type { PaymentStatus } from './types';

// ─── Public types ─────────────────────────────────────────────────────────────

/** Input to pay() — caller provides an already-unlocked secret. */
export interface UseFluppyPaymentInput {
  /**
   * Raw 64-char hex secret from useFluppyCredential.unlock().
   * NOT stored in React state. NOT logged.
   */
  readonly secret:   string;
  /** Merchant Stellar address (G... format). */
  readonly merchant: string;
  /** Payment amount in stroops (1 USDC = 10_000_000). */
  readonly amount:   bigint;
  /**
   * Optional AbortSignal from an external AbortController.
   * If not provided, the hook manages its own internal AbortController.
   */
  readonly signal?:  AbortSignal;
}

/** Full return type of useFluppyPayment(). */
export interface UseFluppyPaymentReturn {
  /** Current payment lifecycle status. */
  readonly status:        PaymentStatus;
  /** True while proof generation or transaction submission is in progress. */
  readonly isLoading:     boolean;
  /** Last error thrown during pay(), or null if no error. */
  readonly error:         Error | null;
  /** Transaction hash after a successful payment, or null. */
  readonly txHash:        string | null;
  /**
   * Current proof generation stage label (e.g. "Computing witness").
   * Null when not in proof generation phase.
   */
  readonly progressStage: string | null;
  /** Proof generation progress percentage (0–100). Null when not in progress. */
  readonly progressPct:   number | null;
  /**
   * Current named step from the payment orchestrator
   * (e.g. 'merkle:request', 'proof:start', 'tx:submit').
   * Null when idle or complete.
   */
  readonly currentStep:   FluppyPaymentStepName | null;
  /**
   * Initiates a ZK payment.
   * Returns the full payment result on success.
   * Throws on failure — caller is responsible for handling the error (toast, UI, etc.)
   */
  readonly pay:           (input: UseFluppyPaymentInput) => Promise<ExecuteFluppyPaymentResult>;
  /**
   * Aborts any active payment and resets all state to idle.
   * Safe to call even when no payment is in progress.
   */
  readonly reset:         () => void;
  /**
   * Clears the current error without changing status or other state.
   * Use this to dismiss an error message while keeping txHash/status visible.
   */
  readonly resetError:    () => void;
  /**
   * Aborts the active payment (if any) and resets status to 'idle'.
   * Distinct from reset() in that it sets status to 'idle' rather than
   * resetting all state — preserving txHash from a prior successful payment.
   */
  readonly abort:         () => void;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function toError(err: unknown): Error {
  if (err instanceof Error) return err;
  return new Error(String(err));
}

function normalizeTxHash(result: ExecuteFluppyPaymentResult): string {
  return result.txHash ?? '';
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useFluppyPayment
 *
 * Manages the full ZK payment lifecycle.
 * Reads Fluppy configuration from the nearest FluppyProvider.
 *
 * @example
 *   const cred = useFluppyCredential();
 *   const payment = useFluppyPayment();
 *
 *   async function handlePay(password: string) {
 *     const secret = await cred.unlock(password);
 *     const result = await payment.pay({
 *       secret,
 *       merchant: 'GDLST72T...',
 *       amount: 10_000_000n, // 1 USDC
 *     });
 *     console.log('tx:', result.txHash);
 *   }
 */
export function useFluppyPayment(): UseFluppyPaymentReturn {
  const { config } = useFluppyContext();

  const [status, setStatus]               = useState<PaymentStatus>('idle');
  const [isLoading, setIsLoading]         = useState(false);
  const [error, setError]                 = useState<Error | null>(null);
  const [txHash, setTxHash]               = useState<string | null>(null);
  const [progressStage, setProgressStage] = useState<string | null>(null);
  const [progressPct, setProgressPct]     = useState<number | null>(null);
  const [currentStep, setCurrentStep]     = useState<FluppyPaymentStepName | null>(null);

  // Mounted guard — prevents state updates after unmount
  const mountedRef   = useRef(true);
  // Internal AbortController for the active payment
  const controllerRef = useRef<AbortController | null>(null);

  // ── Mounted guard setup ─────────────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Abort any in-flight payment on unmount to prevent resource leaks
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
  }, []);

  // ── Safe state setters ──────────────────────────────────────────────────────

  const safeSet = <T>(setter: React.Dispatch<React.SetStateAction<T>>) =>
    (value: T) => {
      if (mountedRef.current) setter(value);
    };

  // ── reset ───────────────────────────────────────────────────────────────────

  const reset = useCallback((): void => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    if (mountedRef.current) {
      setStatus('idle');
      setIsLoading(false);
      setError(null);
      setTxHash(null);
      setProgressStage(null);
      setProgressPct(null);
      setCurrentStep(null);
    }
  }, []);

  // ── resetError ──────────────────────────────────────────────────────────────

  const resetError = useCallback((): void => {
    if (mountedRef.current) setError(null);
  }, []);

  // ── abort ───────────────────────────────────────────────────────────────────

  /**
   * Aborts the active payment and transitions to 'idle'.
   * Uses 'idle' (not 'failed') because abort is a deliberate user action,
   * not a system error. This allows immediate retry without calling resetError().
   */
  const abort = useCallback((): void => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    if (mountedRef.current) {
      setStatus('idle');
      setIsLoading(false);
      setProgressStage(null);
      setProgressPct(null);
      setCurrentStep(null);
    }
  }, []);

  // ── pay ─────────────────────────────────────────────────────────────────────

  const pay = useCallback(
    async (input: UseFluppyPaymentInput): Promise<ExecuteFluppyPaymentResult> => {
      // ── SSR guard ─────────────────────────────────────────────────────────
      if (typeof window === 'undefined') {
        throw new Error(
          '[useFluppyPayment] Payment can only run in a browser environment.'
        );
      }

      // ── Cancel any active payment before starting a new one ────────────────
      controllerRef.current?.abort();

      const controller = new AbortController();
      controllerRef.current = controller;

      // Compose abort signals: caller's signal + internal controller
      const effectiveSignal = input.signal
        ? composeAbortSignals(input.signal, controller.signal)
        : controller.signal;

      // ── Reset and enter pending state ─────────────────────────────────────
      if (mountedRef.current) {
        setStatus('pending');
        setIsLoading(true);
        setError(null);
        setTxHash(null);
        setProgressStage(null);
        setProgressPct(null);
        setCurrentStep(null);
      }

      try {
        const result = await executeFluppyPayment({
          // Secret is passed through — never stored in state
          secret:            input.secret,
          merchant:          input.merchant,
          amount:            input.amount,
          networkPassphrase: config.networkPassphrase,
          stellarConfig:     config.stellarConfig,
          ...(config.merkleOptions ? { merkleOptions: config.merkleOptions } : {}),
          signal:            effectiveSignal,

          onProofProgress: (stage, pct) => {
            if (mountedRef.current) {
              setProgressStage(stage);
              setProgressPct(pct);
            }
          },

          onStep: (step) => {
            if (mountedRef.current) {
              setCurrentStep(step.name);
            }
          },
        });

        if (mountedRef.current) {
          setStatus('success');
          setTxHash(normalizeTxHash(result));
        }

        return result;

      } catch (err) {
        const normalized = toError(err);

        if (mountedRef.current) {
          setStatus('failed');
          setError(normalized);
        }

        // Re-throw so caller can handle UI feedback (toast, logging, etc.)
        throw normalized;

      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
          setProgressStage(null);
          setProgressPct(null);
        }
        // Clean up controller reference if it's still ours
        if (controllerRef.current === controller) {
          controllerRef.current = null;
        }
      }
    },
    // config is from FluppyProvider context — stable if consumer memoizes it
    [config],
  );

  // ── Return ───────────────────────────────────────────────────────────────────

  return {
    status,
    isLoading,
    error,
    txHash,
    progressStage,
    progressPct,
    currentStep,
    pay,
    reset,
    resetError,
    abort,
  };
}

// ─── Internal utility ─────────────────────────────────────────────────────────

/**
 * Composes two AbortSignals into one.
 * The returned signal aborts as soon as either input signal aborts.
 *
 * This is a compatibility shim for environments that may not support
 * AbortSignal.any() (available in Node 20+ and modern browsers).
 */
function composeAbortSignals(
  a: AbortSignal,
  b: AbortSignal,
): AbortSignal {
  // Use AbortSignal.any() when available (modern browsers, Node 20+)
  if ('any' in AbortSignal && typeof AbortSignal.any === 'function') {
    return AbortSignal.any([a, b]);
  }

  // Fallback for older environments
  const controller = new AbortController();

  const abort = () => controller.abort();

  if (a.aborted || b.aborted) {
    controller.abort();
    return controller.signal;
  }

  a.addEventListener('abort', abort, { once: true });
  b.addEventListener('abort', abort, { once: true });

  return controller.signal;
}
