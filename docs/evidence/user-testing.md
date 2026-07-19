# User Testing Evidence

14 responses collected via Google Form from testers who evaluated Flupy's
live demo between July 16–18, 2026. Full response data (including
wallet addresses) is in [`user-testing.csv`](./user-testing.csv).

## Summary

- **14/14** respondents provided a Stellar testnet wallet address
- **14/14** confirmed trying the live demo
- Respondent roles: Student, Developer, and Other (general users)
- Ratings collected on a 1–5 scale for: prior Stellar/Soroban familiarity,
  prior ZK-proof familiarity, clarity of Flupy's value proposition, demo
  experience, and trust in a privacy-preserving payment approach
- **13/14** said they'd be interested in using Flupy as a merchant or user
  ("Yes definitely" or "Maybe")
- **11/14** said they'd be interested in contributing to the open-source SDK

## Notable feedback

Testers surfaced concrete, actionable issues during this round, including:

- A payment failure state ("Something went wrong") observed on testnet,
  which fed directly into the payer/amount binding and root-sync fixes
  made afterward
- Requests for a walkthrough/onboarding guide for first-time users
- A note that ZK terminology can be heavy for non-developer audiences
- Interest in mobile and hardware wallet support

This round of feedback is treated as input for iteration, not a final
audit — see [`../../SECURITY.md`](../../SECURITY.md) for the project's
current security posture and known limitations.
