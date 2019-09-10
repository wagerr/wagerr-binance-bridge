/* eslint-disable no-extend-native */
import { TYPE, SWAP_TYPE } from 'bridge-core';
import { wagerr, transactionHelper, db } from '../core';
import { crypto, validation } from '../utils';

// - Public

/**
 * Swap tokens
 * Request Data:
 *  - type: The type of swap (SWAP_TYPE).
 *  - address: An address. The type of address is determined from the `type` passed.
 *  E.g If `type = WAGERR_TO_BWAGERR` then the `address` is expected to be a wagerr address.
 */
export function swapToken(req, res, next) {
  crypto.decryptAPIPayload(req, res, next, async data => {
    const result = await validation.validateSwap(data);
    if (result != null) {
      res.status(400);
      res.body = { status: 400, success: false, result };
      return next(null, req, res, next);
    }

    const { type, address } = data;

    // We assume the address type is that of the currency we are swapping to.
    // So if the swap is WAGERR_TO_BWAGERR then we want the user to give the BNB address
    // We then generate a WAGERR address that they will deposit to.
    // After the deposit we pay them out to the BNB address they passed.
    const addressType = type === SWAP_TYPE.WAGERR_TO_BWAGERR ? TYPE.BNB : TYPE.WAGERR;

    try {
      const account = await db.getClientAccount(address, addressType);
      if (account) {
        res.status(205);
        res.body = { status: 200, success: true, result: formatClientAccount(account) };
        return next(null, req, res, next);
      }

      // Account type is the that of the currency we are swapping from
      const accountType = type === SWAP_TYPE.WAGERR_TO_BWAGERR ? TYPE.WAGERR : TYPE.BNB;

      let newAccount = null;
      if (accountType === TYPE.BNB) {
        // Generate a random memo
        newAccount = { memo: crypto.generateRandomString(64) };
      } else if (accountType === TYPE.WAGERR) {
        newAccount = await wagerr.createAccount();
      }

      if (!newAccount) {
        console.error('Failed to make new account for: ', accountType);
        throw new Error('Invalid swap');
      }

      const clientAccount = await db.insertClientAccount(address, addressType, newAccount);
      res.status(205);
      res.body = { status: 200, success: true, result: formatClientAccount(clientAccount) };
    } catch (error) {
      console.log(error);
      const message = (error && error.message);
      res.status(500);
      res.body = { status: 500, success: false, result: message || error };
    }

    return next(null, req, res, next);
  });
}

/**
 * Check to see if transfer was done.
 * Validate that against the swaps that have recorded previously.
 * Insert all new deposits into swaps.
 * Return all new deposits.
 *
 * Request Data:
 *  - uuid: The uuid that was returned in `swapToken` (client account uuid)
 */
export function finalizeSwap(req, res, next) {
  crypto.decryptAPIPayload(req, res, next, async data => {
    const result = validation.validateUuidPresent(data);
    if (result != null) {
      res.status(400);
      res.body = { status: 400, success: false, result };
      return next(null, req, res, next);
    }

    const { uuid } = data;
    try {
      const clientAccount = await db.getClientAccountForUuid(uuid);
      if (!clientAccount) {
        res.status(400);
        res.body = { status: 400, success: false, result: 'Unable to find swap details' };
        return next(null, req, res, next);
      }

      const { account, accountType } = clientAccount;

      const [transactions, swaps] = await Promise.all([
        transactionHelper.getIncomingTransactions(account, accountType),
        db.getSwapsForClientAccount(uuid),
      ]);

      if (!transactions || transactions.length === 0) {
        res.status(205);
        res.body = { status: 200, success: false, result: 'Unable to find a deposit' };
        return next(null, req, res, next);
      }

      // Filter out any transactions we haven't added to our swaps db
      const newTransactions = transactions.filter(tx => !swaps.find(s => s.deposit_transaction_hash === tx.hash));
      if (newTransactions.length === 0) {
        res.status(205);
        res.body = { status: 200, success: false, result: 'Unable to find any new deposits' };
        return next(null, req, res, next);
      }

      // Give back the new swaps to the user
      const newSwaps = await db.insertSwaps(newTransactions, clientAccount);
      res.status(205);
      res.body = { status: 200, success: true, result: formatSwaps(newSwaps) };
    } catch (error) {
      console.log(error);
      const message = (error && error.message);
      res.status(500);
      res.body = { status: 500, success: false, result: message || error };
    }

    return next(null, req, res, next);
  });
}

/**
 * Get all the swaps for the given client uuid.
 * Request Data:
 *  - uuid: The uuid that was returned in `swapToken` (client account uuid)
 */
export async function getSwaps(req, res, next) {
  const data = req.query;

  const result = validation.validateUuidPresent(data);
  if (result != null) {
    res.status(400);
    res.body = { status: 400, success: false, result };
    return next(null, req, res, next);
  }

  const { uuid } = data;

  try {
    const clientAccount = await db.getClientAccountForUuid(uuid);
    if (!clientAccount) {
      res.status(400);
      res.body = { status: 400, success: false, result: 'Unable to find swap details' };
      return next(null, req, res, next);
    }

    const swaps = await db.getSwapsForClientAccount(uuid);
    if (!swaps) {
      res.status(400);
      res.body = { status: 400, success: false, result: 'Failed to fetch swaps' };
      return next(null, req, res, next);
    }

    const formatted = swaps.map(swap => {
      const transactionHashes = swap.transfer_transaction_hash;
      const transactionHashArray = (transactionHashes && transactionHashes.split(',')) || [];

      return {
        uuid: swap.uuid,
        type: swap.type,
        amount: swap.amount,
        txHash: swap.deposit_transaction_hash,
        transferTxHashes: transactionHashArray,
        created: swap.created,
      };
    });

    res.status(205);
    res.body = { status: 200, success: true, result: formatted };
  } catch (error) {
    console.log(error);
    const message = (error && error.message);
    res.status(500);
    res.body = { status: 500, success: false, result: message || error };
  }

  return next(null, req, res, next);
}

/**
 * Get all unconfirmed wagerr transactions
 * Request Data:
 *  - uuid: The uuid that was returned in `swapToken` (client account uuid)
 */
export async function getUncomfirmedWagerrTransactions(req, res, next) {
  const data = req.query;

  const result = validation.validateUuidPresent(data);
  if (result != null) {
    res.status(400);
    res.body = { status: 400, success: false, result };
    return next(null, req, res, next);
  }

  const { uuid } = data;

  try {
    const clientAccount = await db.getClientAccountForUuid(uuid);
    const transactions = await transactionHelper.getIncomingWagerrTransactions(clientAccount.account.addressIndex, { pool: true });
    const unconfirmed = transactions.filter(tx => tx.confirmations < transactionHelper.minWagerrConfirmations)
      .map(({ hash, amount, timestamp }) => ({ hash, amount, created: timestamp }));

    res.status(205);
    res.body = { status: 200, success: true, result: unconfirmed };
  } catch (error) {
    console.log(error);
    const message = (error && error.message);
    res.status(500);
    res.body = { status: 500, success: false, result: message || error };
  }

  return next(null, req, res, next);
}

// - Util

function formatClientAccount({ uuid, accountType: type, account }) {
  const depositAddress = type === TYPE.WAGERR ? account.address : transactionHelper.ourBNBAddress;
  const result = {
    uuid,
    type,
    depositAddress,
  };
  if (type === TYPE.BNB) result.memo = account.memo;

  return result;
}

function formatSwaps(swaps) {
  return swaps.map(swap => ({
    uuid: swap.uuid,
    type: swap.type,
    amount: swap.amount,
    txHash: swap.deposit_transaction_hash,
  }));
}
