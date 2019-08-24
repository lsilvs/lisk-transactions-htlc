'use strict';

import BigNum from '@liskhq/bignum';
import {
	hash,
} from '@liskhq/lisk-cryptography';
import {
	BaseTransaction,
	convertToAssetError,
	StateStore,
	StateStorePrepare,
	TransactionError,
	TransactionJSON,
	utils,
} from '@liskhq/lisk-transactions';

import { CLAIM_FEE } from './constants';

const { validator } = utils;

export interface ClaimAsset {
	readonly claim: {
		readonly lockTransactionId: string;
		readonly preimage: string;
	};
}

export const claimAssetFormatSchema = {
	type: 'object',
	required: ['claim'],
	properties: {
		claim: {
			type: 'object',
			required: ['lockTransactionId', 'preimage'],
			properties: {
				lockTransactionId: {
					type: 'string',
				},
				preimage: {
					type: 'string',
					minLength: 1,
					maxLength: 64,
				},
			},
		},
	},
};

export class ClaimTransaction extends BaseTransaction {
	public readonly asset: ClaimAsset;
	public static TYPE = 9;
	public static FEE = CLAIM_FEE.toString();

	public constructor(rawTransaction: unknown) {
		super(rawTransaction);
		const tx = (typeof rawTransaction === 'object' && rawTransaction !== null
			? rawTransaction
			: {}) as Partial<TransactionJSON>;

		this.asset = (tx.asset || { claim: {} }) as ClaimAsset;
	}

	protected assetToBytes(): Buffer {
		return Buffer.concat([]);
	}

	public assetToJSON(): object {
		return this.asset;
	}

	public async prepare(store: StateStorePrepare): Promise<void> {
		await store.account.cache([{ address: this.senderId }]);

		const [lockTransaction] = await store.transaction.cache([
			{
				id: this.asset.claim.lockTransactionId,
			},
		]);

		if (lockTransaction) {
			await store.account.cache([
				{ address: lockTransaction.asset.lock.claimAddress },
			]);
		}
	}

	protected verifyAgainstTransactions(
		_: ReadonlyArray<TransactionJSON>,
	): ReadonlyArray<TransactionError> {
		return [];
	}

	protected validateAsset(): ReadonlyArray<TransactionError> {
		validator.validate(claimAssetFormatSchema, this.asset);
		const errors = convertToAssetError(
			this.id,
			validator.errors
		) as TransactionError[];

		return errors;
	}

	protected applyAsset(store: StateStore): ReadonlyArray<TransactionError> {
		const lockTransaction = store.transaction.get(this.asset.claim.lockTransactionId);

		if (this.senderId !== lockTransaction.asset.lock.claimAddress) {
			const senderIdError = new TransactionError(
				'senderId does not match claimAddress',
				this.id,
				'.senderId',
				this.senderId,
				lockTransaction.asset.lock.claimAddress,
			);

			return [senderIdError];
		}

		const hashedPreimage = hash(this.asset.claim.preimage, 'utf8').toString('hex');

		if (hashedPreimage !== lockTransaction.asset.lock.hashlock) {
			const hashedPreimageError = new TransactionError(
				'Hashed preimage does not match hashlock',
				this.id,
				'.asset.claim.preimage',
				hashedPreimage,
				lockTransaction.asset.lock.hashlock,
			);

			return [hashedPreimageError];
		}

		const lockTransactionSender = store.account.get(lockTransaction.senderId);
		const lockTransactionRecipient = store.account.getOrDefault(lockTransaction.asset.lock.claimAddress);

		const hashTimeLockedBalance = lockTransactionSender.asset.hashTimeLockedBalances.find(
			htlb => htlb.lockTransactionId === lockTransaction.id
		);

		const updatedRecipientBalance = new BigNum(lockTransactionRecipient.balance).add(
			hashTimeLockedBalance.amount,
		);

		const updatedRecipient = {
			...lockTransactionRecipient,
			balance: updatedRecipientBalance.toString(),
		};

		store.account.set(updatedRecipient.address, updatedRecipient);

		const updatedSenderHTLB = lockTransactionSender.asset.hashTimeLockedBalances.filter(
			htlb => htlb.lockTransactionId !== lockTransaction.id
		);

		const updatedAsset = {
			...lockTransactionSender.asset,
			hashTimeLockedBalances: updatedSenderHTLB,
		};

		const updatedSender = {
			...lockTransactionSender,
			asset: updatedAsset,
		};

		store.account.set(updatedSender.address, updatedSender);

		return [];
	}

	// tslint:disable-next-line prefer-function-over-method
	protected undoAsset(_: StateStore): ReadonlyArray<TransactionError> {
		return [];
	}

	// tslint:disable:next-line: prefer-function-over-method no-any
	protected assetFromSync(raw: any): object | undefined {
		return { raw };
	}
}
