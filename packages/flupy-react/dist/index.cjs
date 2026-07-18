'use strict';

var core = require('@flupy/core');
var browser = require('@flupy/browser');
var react = require('react');
var jsxRuntime = require('react/jsx-runtime');

// src/index.ts
var FluppyReactContext = react.createContext(null);
FluppyReactContext.displayName = "FluppyReactContext";
function FluppyProvider({
  config,
  children
}) {
  const value = react.useMemo(
    () => ({ config }),
    // Re-memoize only if config reference changes.
    // Consumers should memoize their config object to prevent unnecessary re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config]
  );
  return /* @__PURE__ */ jsxRuntime.jsx(FluppyReactContext.Provider, { value, children });
}
function useFluppyContext() {
  const ctx = react.useContext(FluppyReactContext);
  if (ctx === null) {
    throw new Error(
      "[useFluppyContext] No FluppyProvider found in the component tree. Wrap your application with <FluppyProvider config={...}>.</FluppyProvider>"
    );
  }
  return ctx;
}
function toError(err) {
  if (err instanceof Error) return err;
  return new Error(String(err));
}
function useFluppyCredential() {
  const [status, setStatus] = react.useState("unknown");
  const [isLoading, setIsLoading] = react.useState(false);
  const [error, setError] = react.useState(null);
  const exists = status === "unknown" ? null : status === "exists";
  const mountedRef = react.useRef(true);
  react.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const safeSetStatus = react.useCallback((s) => {
    if (mountedRef.current) setStatus(s);
  }, []);
  const safeSetLoading = react.useCallback((v) => {
    if (mountedRef.current) setIsLoading(v);
  }, []);
  const safeSetError = react.useCallback((e) => {
    if (mountedRef.current) setError(e);
  }, []);
  const refresh = react.useCallback(async () => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const found = await browser.credentialExists();
      safeSetStatus(found ? "exists" : "not_found");
    } catch (err) {
      safeSetStatus("not_found");
      safeSetError(toError(err));
    }
  }, [safeSetStatus, safeSetError]);
  react.useEffect(() => {
    void refresh();
  }, []);
  const create = react.useCallback(
    async (password) => {
      safeSetLoading(true);
      safeSetError(null);
      try {
        const result = await browser.createCredential(password);
        safeSetStatus("exists");
        return result;
      } catch (err) {
        const normalized = toError(err);
        safeSetError(normalized);
        throw normalized;
      } finally {
        safeSetLoading(false);
      }
    },
    [safeSetLoading, safeSetError, safeSetStatus]
  );
  const unlock = react.useCallback(
    async (password) => {
      safeSetLoading(true);
      safeSetError(null);
      try {
        const secret = await browser.unlockCredential(password);
        return secret;
      } catch (err) {
        const normalized = toError(err);
        safeSetError(normalized);
        throw normalized;
      } finally {
        safeSetLoading(false);
      }
    },
    [safeSetLoading, safeSetError]
  );
  const remove = react.useCallback(async () => {
    safeSetLoading(true);
    safeSetError(null);
    try {
      await browser.deleteCredential();
      safeSetStatus("not_found");
    } catch (err) {
      const normalized = toError(err);
      safeSetError(normalized);
      throw normalized;
    } finally {
      safeSetLoading(false);
    }
  }, [safeSetLoading, safeSetError, safeSetStatus]);
  const resetError = react.useCallback(() => {
    safeSetError(null);
  }, [safeSetError]);
  return {
    status,
    isLoading,
    error,
    exists,
    create,
    unlock,
    remove,
    refresh,
    resetError
  };
}
function toError2(err) {
  if (err instanceof Error) return err;
  return new Error(String(err));
}
function normalizeTxHash(result) {
  return result.txHash ?? "";
}
function useFluppyPayment() {
  const { config } = useFluppyContext();
  const [status, setStatus] = react.useState("idle");
  const [isLoading, setIsLoading] = react.useState(false);
  const [error, setError] = react.useState(null);
  const [txHash, setTxHash] = react.useState(null);
  const [progressStage, setProgressStage] = react.useState(null);
  const [progressPct, setProgressPct] = react.useState(null);
  const [currentStep, setCurrentStep] = react.useState(null);
  const mountedRef = react.useRef(true);
  const controllerRef = react.useRef(null);
  react.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
  }, []);
  const reset = react.useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    if (mountedRef.current) {
      setStatus("idle");
      setIsLoading(false);
      setError(null);
      setTxHash(null);
      setProgressStage(null);
      setProgressPct(null);
      setCurrentStep(null);
    }
  }, []);
  const resetError = react.useCallback(() => {
    if (mountedRef.current) setError(null);
  }, []);
  const abort = react.useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    if (mountedRef.current) {
      setStatus("idle");
      setIsLoading(false);
      setProgressStage(null);
      setProgressPct(null);
      setCurrentStep(null);
    }
  }, []);
  const pay = react.useCallback(
    async (input) => {
      if (typeof window === "undefined") {
        throw new Error(
          "[useFluppyPayment] Payment can only run in a browser environment."
        );
      }
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      const effectiveSignal = input.signal ? composeAbortSignals(input.signal, controller.signal) : controller.signal;
      if (mountedRef.current) {
        setStatus("pending");
        setIsLoading(true);
        setError(null);
        setTxHash(null);
        setProgressStage(null);
        setProgressPct(null);
        setCurrentStep(null);
      }
      try {
        const result = await browser.executeFluppyPayment({
          // Secret is passed through — never stored in state
          secret: input.secret,
          merchant: input.merchant,
          amount: input.amount,
          networkPassphrase: config.networkPassphrase,
          stellarConfig: config.stellarConfig,
          ...config.merkleOptions ? { merkleOptions: config.merkleOptions } : {},
          signal: effectiveSignal,
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
          }
        });
        if (mountedRef.current) {
          setStatus("success");
          setTxHash(normalizeTxHash(result));
        }
        return result;
      } catch (err) {
        const normalized = toError2(err);
        if (mountedRef.current) {
          setStatus("failed");
          setError(normalized);
        }
        throw normalized;
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
          setProgressStage(null);
          setProgressPct(null);
        }
        if (controllerRef.current === controller) {
          controllerRef.current = null;
        }
      }
    },
    // config is from FluppyProvider context — stable if consumer memoizes it
    [config]
  );
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
    abort
  };
}
function composeAbortSignals(a, b) {
  if ("any" in AbortSignal && typeof AbortSignal.any === "function") {
    return AbortSignal.any([a, b]);
  }
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (a.aborted || b.aborted) {
    controller.abort();
    return controller.signal;
  }
  a.addEventListener("abort", abort, { once: true });
  b.addEventListener("abort", abort, { once: true });
  return controller.signal;
}
function toError3(err) {
  if (err instanceof Error) return err;
  return new Error(String(err));
}
function useFluppyWallet() {
  const [address, setAddress] = react.useState(null);
  const [connectionStatus, setConnectionStatus] = react.useState("disconnected");
  const [error, setError] = react.useState(null);
  const mountedRef = react.useRef(true);
  react.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const isConnected = connectionStatus === "connected";
  const isConnecting = connectionStatus === "connecting";
  const resetError = react.useCallback(() => {
    if (mountedRef.current) setError(null);
  }, []);
  const refresh = react.useCallback(async () => {
    if (typeof window === "undefined") return;
    try {
      const { isConnected: checkConnected } = await import('@stellar/freighter-api');
      const result = await checkConnected();
      if (!mountedRef.current) return;
      if (result.isConnected) {
        setConnectionStatus("connected");
      } else {
        setConnectionStatus("disconnected");
        setAddress(null);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setConnectionStatus("disconnected");
      setAddress(null);
    }
  }, []);
  react.useEffect(() => {
    void refresh();
  }, []);
  const connect = react.useCallback(async () => {
    if (typeof window === "undefined") {
      throw new Error(
        "[useFluppyWallet] Wallet connection can only run in a browser environment."
      );
    }
    if (mountedRef.current) {
      setConnectionStatus("connecting");
      setError(null);
    }
    try {
      const { requestAccess } = await import('@stellar/freighter-api');
      const result = await requestAccess();
      if (result.error) {
        throw new Error(`[useFluppyWallet] Freighter access denied: ${result.error}`);
      }
      if (!result.address) {
        throw new Error("[useFluppyWallet] Freighter returned no address.");
      }
      if (mountedRef.current) {
        setAddress(result.address);
        setConnectionStatus("connected");
      }
      return result.address;
    } catch (err) {
      const normalized = toError3(err);
      if (mountedRef.current) {
        setError(normalized);
        setConnectionStatus("error");
      }
      throw normalized;
    }
  }, []);
  return {
    address,
    connectionStatus,
    error,
    isConnected,
    isConnecting,
    connect,
    refresh,
    resetError
  };
}
var HISTORY_STORAGE_KEY = "fluppy:payment-history:v1";
var MAX_HISTORY_LENGTH = 50;
function serializeRecord(record) {
  return {
    txHash: record.txHash,
    amount: record.amount.toString(),
    merchant: record.merchant,
    timestamp: record.timestamp,
    status: record.status,
    ...record.explorerUrl ? { explorerUrl: record.explorerUrl } : {}
  };
}
function deserializeRecord(raw) {
  return {
    txHash: raw.txHash,
    amount: BigInt(raw.amount),
    merchant: raw.merchant,
    timestamp: raw.timestamp,
    status: raw.status,
    ...raw.explorerUrl ? { explorerUrl: raw.explorerUrl } : {}
  };
}
function loadFromStorage() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(deserializeRecord);
  } catch {
    return [];
  }
}
function saveToStorage(records) {
  if (typeof window === "undefined") return;
  try {
    const serialized = records.map(serializeRecord);
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(serialized));
  } catch {
  }
}
function deduplicateByTxHash(records) {
  const seen = /* @__PURE__ */ new Set();
  return records.filter((r) => {
    if (seen.has(r.txHash)) return false;
    seen.add(r.txHash);
    return true;
  });
}
function useFluppyHistory() {
  const [records, setRecords] = react.useState([]);
  react.useEffect(() => {
    setRecords(loadFromStorage());
  }, []);
  const refresh = react.useCallback(() => {
    setRecords(loadFromStorage());
  }, []);
  const add = react.useCallback((record) => {
    setRecords((prev) => {
      const merged = deduplicateByTxHash([record, ...prev]);
      const capped = merged.slice(0, MAX_HISTORY_LENGTH);
      saveToStorage(capped);
      return capped;
    });
  }, []);
  const update = react.useCallback(
    (txHash, patch) => {
      setRecords((prev) => {
        const next = prev.map(
          (r) => r.txHash === txHash ? { ...r, ...patch } : r
        );
        saveToStorage(next);
        return next;
      });
    },
    []
  );
  const remove = react.useCallback((txHash) => {
    setRecords((prev) => {
      const next = prev.filter((r) => r.txHash !== txHash);
      saveToStorage(next);
      return next;
    });
  }, []);
  const clear = react.useCallback(() => {
    setRecords([]);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(HISTORY_STORAGE_KEY);
      } catch {
      }
    }
  }, []);
  return {
    records,
    add,
    update,
    remove,
    clear,
    refresh
  };
}

// src/index.ts
var FLUPPY_REACT_VERSION = "0.1.0";

Object.defineProperty(exports, "FluppyError", {
  enumerable: true,
  get: function () { return core.FluppyError; }
});
Object.defineProperty(exports, "parseFluppyError", {
  enumerable: true,
  get: function () { return core.parseFluppyError; }
});
Object.defineProperty(exports, "RootSyncError", {
  enumerable: true,
  get: function () { return browser.RootSyncError; }
});
exports.FLUPPY_REACT_VERSION = FLUPPY_REACT_VERSION;
exports.FluppyProvider = FluppyProvider;
exports.useFluppyCredential = useFluppyCredential;
exports.useFluppyHistory = useFluppyHistory;
exports.useFluppyPayment = useFluppyPayment;
exports.useFluppyWallet = useFluppyWallet;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map