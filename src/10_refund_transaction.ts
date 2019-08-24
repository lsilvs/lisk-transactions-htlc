'use strict';

import BigNum from '@liskhq/bignum';
import {
	BaseTransaction,
	convertToAssetError,
	StateStore,
	StateStorePrepare,
	TransactionError,
	TransactionJSON,
	utils,
} from '@liskhq/lisk-transactions';

import { REFUND_FEE } from './constants';

const { validator } = utils;

export interface RefundAsset {
	readonly refund: {
		readonly lockTransactionId: string;
	};
}

export const refundAssetFormatSchema = {
	type: 'object',
	required: ['refund'],
	properties: {
		refund: {
			type: 'object',
			required: ['lockTransactionId'],
			properties: {
				lockTransactionId: {
					type: 'string',
				},
			},
		},
	},
};

export class RefundTransaction extends BaseTransaction {
	public readonly asset: RefundAsset;
	public static TYPE = 10;
	public static FEE = REFUND_FEE.toString();

	public constructor(rawTransaction: unknown) {
		super(rawTransaction);
		const tx = (typeof rawTransaction === 'object' && rawTransaction !== null
			? rawTransaction
			: {}) as Partial<TransactionJSON>;

		this.asset = (tx.asset || { refund: {} }) as RefundAsset;
	}

	protected assetToBytes(): Buffer {
		return Buffer.concat([]);
	}

	public assetToJSON(): object {
		return this.asset;
	}

	public async prepare(store: StateStorePrepare): Promise<void> {
		await store.account.cache([{ address: this.senderId }]);
		await store.transaction.cache([{ id: this.asset.refund.lockTransactionId }]);
	}

	protected verifyAgainstTransactions(
		_: ReadonlyArray<TransactionJSON>,
	): ReadonlyArray<TransactionError> {
		return [];
	}

	protected validateAsset(): ReadonlyArray<TransactionError> {
		validator.validate(refundAssetFormatSchema, this.asset);
		const errors = convertToAssetError(
			this.id,
			validator.errors
		) as TransactionError[];

		return errors;
	}

	protected applyAsset(store: StateStore): ReadonlyArray<TransactionError> {
		const sender = store.account.get(this.senderId);
		const lockTransaction = store.transaction.get(this.asset.refund.lockTransactionId);

		if (this.senderId !== lockTransaction.senderId) {
			const senderIdError = new TransactionError(
				'senderId does not match',
				this.id,
				'.senderId',
				this.senderId,
				lockTransaction.senderId,
			);

			return [senderIdError];
		}

		const currentTimestampInSeconds = Math.floor(Date.now() / 1000);

		if (currentTimestampInSeconds < lockTransaction.asset.lock.timelock) {
			const timelockError = new TransactionError(
				'This HashTimeLockedBalance is still locked for refund',
				this.id,
				'currentTimestampInSeconds',
				currentTimestampInSeconds,
				lockTransaction.asset.lock.timelock,
			);

			return [timelockError];
		}

		const updatedBalance = new BigNum(sender.balance).add(
			lockTransaction.amount,
		);

		const updatedHTLB = sender.asset.hashTimeLockedBalances.filter(
			htlb => htlb.lockTransactionId !== lockTransaction.id
		);

		const updatedAsset = {
			...sender.asset,
			hashTimeLockedBalances: updatedHTLB,
		};

		const updatedsender = {
			...sender,
			balance: updatedBalance.toString(),
			asset: updatedAsset,
		};

		store.account.set(updatedsender.address, updatedsender);

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
