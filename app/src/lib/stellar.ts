'use client';

import {
  Networks,
  rpc,
} from '@stellar/stellar-sdk';

import {
  getContractMerkleRoot as getBrowserContractMerkleRoot,
  payWithZkGroth16 as payWithBrowserZkGroth16,
  pollTransaction,
  type StellarConfig,
} from '@flupy/browser';

import type { PaymentProofOutput } from './zkp';

export {
  pollTransaction,
};

function getStellarConfig(): StellarConfig {
  const contractId = process.env.NEXT_PUBLIC_CONTRACT_ID;

  if (!contractId) {
    throw new Error(
      '[Stellar] NEXT_PUBLIC_CONTRACT_ID is required.',
    );
  }

  return {
    rpcUrl:
      process.env.NEXT_PUBLIC_RPC_URL ??
      'https://soroban-testnet.stellar.org:443',
    networkPassphrase:
      process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ??
      Networks.TESTNET,
    contractId,
    apiBaseUrl: '',
  };
}

export async function payWithZkGroth16(
  merchant: string,
  amount: bigint,
  proof: PaymentProofOutput,
): Promise<unknown> {
  return await payWithBrowserZkGroth16(
    merchant,
    amount,
    proof,
    getStellarConfig(),
  );
}

export async function getContractMerkleRoot(): Promise<string> {
  return await getBrowserContractMerkleRoot(
    getStellarConfig(),
  );
}

export type {
  StellarConfig,
};

export type SorobanServer = rpc.Server;
