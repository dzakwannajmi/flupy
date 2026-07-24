# User Testing Evidence

62 responses collected via Google Form across two rounds of testing:
an initial round with 14 respondents between July 16-18, 2026, and a
second round with 48 respondents on July 24, 2026, following the
native BN254 verifier deployment. Full response data (including
wallet addresses) is in [`user-testing.csv`](./user-testing.csv).

## Summary

- **62/62** respondents provided a Stellar testnet wallet address and
  a transaction hash verifiable on Stellar Expert
- Round 1 (14 respondents): ratings collected on a 1-5 scale for prior
  Stellar/Soroban familiarity, prior ZK-proof familiarity, clarity of
  Flupy's value proposition, demo experience, and trust in a
  privacy-preserving payment approach. **13/14** said they'd be
  interested in using Flupy as a merchant or user; **11/14** said
  they'd be interested in contributing to the open-source SDK
- Round 2 (48 respondents): free-text feedback on the payment
  experience after the native BN254 verifier went live

## Notable feedback

Round 1 testers surfaced concrete, actionable issues that fed directly
into later fixes:

- A payment failure state ("Something went wrong") observed on
  testnet, which fed directly into the payer/amount binding and
  root-sync fixes made afterward
- Requests for a walkthrough/onboarding guide for first-time users
- A note that ZK terminology can be heavy for non-developer audiences
- Interest in mobile and hardware wallet support

Round 2 testers (after the native verifier deployment) reported the
payment flow working smoothly overall, with a few recurring UX notes:

- Positive feedback on payment speed and the on-chain verification
- Requests for a fee preview before confirming a payment
- A few reports of the loading indicator or confirmation notification
  being unclear or slow to appear
- Interest in additional currency options and dark mode

This feedback is treated as input for iteration, not a final audit —
see [the Security Model docs](https://flupy-app-dzakwannajmis-projects.vercel.app/docs/security)
for the project's current security posture and known limitations.
