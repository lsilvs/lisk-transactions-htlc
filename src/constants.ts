'use strict';

import { constants } from '@liskhq/lisk-transactions';

const { FIXED_POINT } = constants;

export const LOCK_FEE = FIXED_POINT * 0.1;
export const CLAIM_FEE = FIXED_POINT * 0.1;
export const REFUND_FEE = FIXED_POINT * 0.1;
