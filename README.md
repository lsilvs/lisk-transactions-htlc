# lisk-transactions-htlc

Lisk custom transactions that implement HTLC enabling cross-chain atomic swap.

## Hashed TimeLock Contracts (HTLC)

HTLC is a class of payments that use hashlocks and timelocks to require that the receiver of a payment either acknowledge receiving the payment prior to a deadline by generating cryptographic proof of payment or forfeit the ability to claim the payment, returning it to the payer.

## Lisk Custom Transctions

Transactions are the essential part of the blockchain applications created using Lisk SDK.

The Lisk SDK provides a class [BaseTransaction](https://github.com/LiskHQ/lisk-sdk/blob/development/elements/lisk-transactions/src/base_transaction.ts) from which developers can inherit and extend from, to create **custom transaction types**.

Since custom transactions enable application-specific business logic, it makes it possible to implement Hashed TimeLock Contracts (HTLC) combining three different custom transactions.

1. Lock Transaction
2. Claim Transaction
3. Refund Transaction

## Disclaimer

These custom transactions are NOT production ready and should NOT be used as such. By using them, you acknowledge and agree that you have an adequate understanding of the risks associated with their use and that it is provided on an “as is” and “as available” basis, without any representations or warranties of any kind. To the fullest extent permitted by law, in no event shall the author or other parties involved in the development of these custom transactions have any liability whatsoever to any person for any direct or indirect loss, liability, cost, claim, expense or damage of any kind, whether in contract or in tort, including negligence, or otherwise, arising out of or related to the use of all or part of these custom transactions.
