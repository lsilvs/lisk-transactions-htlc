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

import { LOCK_FEE } from './constants';

const { validator, validateTransferAmount, verifyAmountBalance } = utils;

export interface LockAsset {
	readonly lock: {
		readonly timelock: number;
		readonly hashlock: string;
		readonly claimAddress: string;
	};
}

export const lockAssetFormatSchema = {
	type: 'object',
	required: ['lock'],
	properties: {
		lock: {
			type: 'object',
			required: ['timelock', 'hashlock', 'claimAddress'],
			properties: {
				timelock: {
					type: 'integer',
					minimum: 0,
				},
				hashlock: {
					type: 'string',
					minLength: 64,
					maxLength: 64,
				},
				claimAddress: {
					type: 'string',
					format: 'address',
				},
			},
		},
	},
};

export class LockTransaction extends BaseTransaction {
	public readonly asset: LockAsset;
	public static TYPE = 8;
	public static FEE = LOCK_FEE.toString();

	public constructor(rawTransaction: unknown) {
		super(rawTransaction);
		const tx = (typeof rawTransaction === 'object' && rawTransaction !== null
			? rawTransaction
			: {}) as Partial<TransactionJSON>;

		this.asset = (tx.asset || { lock: {} }) as LockAsset;
	}

	protected assetToBytes(): Buffer {
		return Buffer.concat([]);
	}

	public assetToJSON(): object {
		return this.asset;
	}

	public async prepare(store: StateStorePrepare): Promise<void> {
		await store.account.cache([
			{
				address: this.senderId,
			},
		]);
	}

	protected verifyAgainstTransactions(
		_: ReadonlyArray<TransactionJSON>,
	): ReadonlyArray<TransactionError> {
		return [];
	}

	protected validateAsset(): ReadonlyArray<TransactionError> {
		validator.validate(lockAssetFormatSchema, this.asset);
		const errors = convertToAssetError(
			this.id,
			validator.errors
		) as TransactionError[];

		if (!validateTransferAmount(this.amount.toString())) {
			errors.push(
				new TransactionError(
					'Amount must be a valid number in string format.',
					this.id,
					'.amount',
					this.amount.toString(),
				),
			);
		}

		return errors;
	}

	protected applyAsset(store: StateStore): ReadonlyArray<TransactionError> {
		const errors: TransactionError[] = [];

		const sender = store.account.get(this.senderId);

		const balanceError = verifyAmountBalance(
			this.id,
			sender,
			this.amount,
			this.fee,
		);

		if (balanceError) {
			errors.push(balanceError);
		}

		const updatedSenderBalance = new BigNum(sender.balance).sub(this.amount);
		const updatedSenderHTLB = sender.asset.hashTimeLockedBalances || [];

		updatedSenderHTLB.push({
			lockTransactionId: this.id,
			amount: this.amount.toString(),
		});

		const updatedAsset = {
			...sender.asset,
			hashTimeLockedBalances: updatedSenderHTLB,
		};

		const updatedSender = {
			...sender,
			balance: updatedSenderBalance.toString(),
			asset: updatedAsset,
		};

		store.account.set(updatedSender.address, updatedSender);

		return errors;
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
