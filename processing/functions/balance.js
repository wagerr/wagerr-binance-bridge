/* eslint-disable no-else-return */
import chalk from 'chalk';
import config from 'config';
import { SWAP_TYPE, TYPE } from 'bridge-core';
import { db, transactionHelper } from '../core';
import log from '../utils/log';

const module = {
  async checkAllBalances() {
    const wagerrBalance = await module.getBalances(SWAP_TYPE.WAGERR_TO_BWAGERR);
    module.printBalance(SWAP_TYPE.WAGERR_TO_BWAGERR, wagerrBalance);

    const bnbBalance = await module.getBalances(SWAP_TYPE.BWAGERR_TO_WAGERR);
    module.printBalance(SWAP_TYPE.BWAGERR_TO_WAGERR, bnbBalance);
  },

  printBalance(swapType, balance, showWarning = true) {
    const receiveCurrency = swapType === SWAP_TYPE.WAGERR_TO_BWAGERR ? 'WAGERR' : 'B-WAGERR';
    const swapCurrency = swapType === SWAP_TYPE.WAGERR_TO_BWAGERR ? 'B-WAGERR' : 'WAGERR';
    log.header(chalk.blue(`Balance of ${swapType}`));
    log.info(chalk`{green Transaction balance:} {bold ${balance.transaction / 1e9}} {yellow ${receiveCurrency}}`);
    log.info(chalk`{green Swap balance:} {bold ${balance.swap / 1e9}} {yellow ${swapCurrency}}`);
    if (showWarning && balance.transaction !== balance.swap) {
      log.error(chalk.red('WARNING: AMOUNTS DO NOT MATCH! PLEASE TRY SWEEPING'));
    }
  },

  /**
 * Get both the transaction and swap balance for the given swap type.
 * @param {string} swapType The swap type.
 */
  async getBalances(swapType) {
    const now = Date.now();
    const twoDaysAgo = now - (2 * 24 * 60 * 60 * 1000);

    const accountType = swapType === SWAP_TYPE.WAGERR_TO_BWAGERR ? TYPE.WAGERR : TYPE.BNB;
    const transactionBalance = await module.getBalanceFromIncomingTransactions(accountType, twoDaysAgo, now);
    const swapBalance = await module.getSwapBalance(swapType, twoDaysAgo, now);
    return {
      transaction: transactionBalance,
      swap: swapBalance,
    };
  },

  /**
 * Get the total balance of the swaps in the database of the given type.
 * @param {string} swapType The swap type
 * @param {number} from The date to get incoming transactions from. The lower bound.
 * @param {number} to The date to get incoming transactions to. The upper bound.
 */
  async getSwapBalance(swapType, from, to) {
    const swaps = await db.getAllSwaps(swapType);
    const filtered = swaps.filter(s => {
      let created = Date.parse(s.deposit_transaction_created);

      // Just incase deposit_transaction_created is not set
      if (Number.isNaN(created)) created = Date.parse(s.created);

      return !(created > to || created < from);
    });
    // Sum up the amounts
    return filtered.reduce((total, current) => total + parseInt(current.amount, 10), 0);
  },

  /**
 * Get the total balance of the incoming transactions for the given account types.
 * @param {string} accountType The account type
 * @param {number} from The date to get incoming transactions from. The lower bound.
 * @param {number} to The date to get incoming transactions to. The upper bound.
 */
  async getBalanceFromIncomingTransactions(accountType, from, to) {
    const clientAccounts = await db.getClientAccounts(accountType);

    let filtered = [];

    if (accountType === TYPE.WAGERR) {
    // Get all incoming transactions from the client accounts
      const promises = clientAccounts.map(async c => transactionHelper.getIncomingWagerrTransactions(c.account.addressIndex));
      const wagerrTransactions = await Promise.all(promises).then(array => array.flat());

      // generate a list of all processed swaps
      const swaps = await db.getAllSwaps(SWAP_TYPE.WAGERR_TO_BWAGERR);
      // exclude any tx where we've received wagerr
      // we want to include all those (and skip the confirmation check)
      const completedSwaps = swaps.filter(swap => {
        //console.log('swap, is complete?', swap.amount, swap.created);
        //console.log('deposit', swap.deposit_transaction_hash, 'transfer', swap.transfer_transaction_hash, 'procssed', swap.processed);
        // I don't think these matter:
        // swap.transfer_transaction_hash !== null || swap.processed !== null ||
        const completed = swap.deposit_transaction_hash !== null;
        console.log(swap.amount, swap.created, 'deposit', swap.deposit_transaction_hash, 'completed', completed)
        return completed; // only keep the completed ones
      });

      // Filter out all transactions that don't fit our date ranges

      filtered = wagerrTransactions.filter(tx => {
        // timestamps are in seconds so we need to convert to milliseconds
        const timestamp = tx.timestamp * 1000;
        // console.log('this tx', tx);

        // wagerr.minConfirmations can change, we need to record it in the database
        // or have a flag if it's confirmed or not
        // actually the processed flag override should meet this criteria
        console.log('need', config.get('wagerr.minConfirmations'), 'confirmations, have', tx.confirmations);

        // we won't have a swap record...
        if (tx.confirmations < config.get('wagerr.minConfirmations')) {
          // confirm that this isn't a processed transaction
          // console.log('tx info', tx.amount);
          const results = completedSwaps.filter(swap => {
            // found our tx/swap match
            if (tx.txid === swap.deposit_transaction_hash) {
              return true;
            }
            return false;
          });
          // console.log('results', results.length)

          // if we a swap for this tx and only one match
          if (results.length === 1) {
            // this is a complete transaction, we need this added to the balance
            return !(timestamp > to || timestamp < from);
          }

          // more than one match, we need to consider it like none where found...
          if (results.length > 1) {
            // should never have multiple tx matches
            console.log('error too many results, treating like 0', results);
          }

          // we don't have enough confirmations and can't confirm the swap is complete
          console.log('need to skip', tx.txid, tx.amount, new Date(tx.timestamp * 1000));
          return false;
        }

        return !(timestamp > to || timestamp < from);
      });
    } else if (accountType === TYPE.BNB) {
    // Get all our incoming transactions which contain a memo
      const ourAddress = transactionHelper.ourBNBAddress;
      const transactions = await transactionHelper.getIncomingBNBTransactions(ourAddress, from);
      const bnbClientAccounts = await db.getClientAccounts(TYPE.BNB);
      const clientMemos = bnbClientAccounts.map(c => c.account.memo);

      // Only get the transactions with memos that we have
      const memoTransactions = transactions.filter(t => {
        const { memo } = t;
        return memo && memo.length == 64 && clientMemos.includes(memo);
      });

      // Filter out all transactions that don't fit our date ranges
      filtered = memoTransactions.filter(({ timestamp }) => !(timestamp * 1000 > to || timestamp * 1000 < from));
    }

    // Sum up the amounts
    return filtered.reduce((total, current) => total + parseInt(current.amount, 10), 0);
  },

  async printBNBTransactionsWithIncorrectMemo() {
  // Get all our incoming transactions which contain a memo
    const ourAddress = transactionHelper.ourBNBAddress;
    const transactions = await transactionHelper.getIncomingBNBTransactions(ourAddress);
    const bnbClientAccounts = await db.getClientAccounts(TYPE.BNB);
    const clientMemos = bnbClientAccounts.filter(c => c.account.memo);
    const unkownMemoTransactions = transactions.filter(t => {
      const { memo } = t;
      return memo && memo.length == 64 && !clientMemos.includes(memo);
    });

    const values = unkownMemoTransactions.map(({ hash, amount, memo, timestamp }) => ({
      hash,
      amount: amount / 1e9,
      memo,
      timestamp,
    }));

    values.forEach(({ hash, amount, memo, timestamp }) => {
      log.header(chalk.blue(hash));
      log.info(chalk`{green amount:} ${amount} BWAGERR`);
      log.info(chalk`{green memo:} ${memo}`);
      log.info(chalk`{green timestamp:} ${timestamp}`);
    });
  },
};

export default module;
