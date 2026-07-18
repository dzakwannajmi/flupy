/**
 * hooks.ts — Hook exports for @fluppy/react.
 *
 * Implemented:
 *   - useFluppyCredential (SDK-1C-2)
 *   - useFluppyPayment    (SDK-1C-3)
 *   - useFluppyWallet     (SDK-1C-4)
 *   - useFluppyHistory    (SDK-1C-4)
 */

export {
  useFluppyCredential,
  type UseFluppyCredentialReturn,
} from './useFluppyCredential';

export {
  useFluppyPayment,
  type UseFluppyPaymentReturn,
  type UseFluppyPaymentInput,
} from './useFluppyPayment';

export {
  useFluppyWallet,
  type UseFluppyWalletReturn,
} from './useFluppyWallet';

export {
  useFluppyHistory,
  type UseFluppyHistoryReturn,
} from './useFluppyHistory';
