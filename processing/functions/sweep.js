/* eslint-disable no-restricted-syntax, no-else-return, max-len */
import chalk from 'chalk';
import { TYPE, SWAP_TYPE } from 'bridge-core';
import { db, transactionHelper, postgres } from '../core';
import log from '../utils/log';

const module = {
  /**
   * Sweep any pending swaps
   */
  async sweepAllPendingSwaps() {
    await module.sweepPendingWagerrToBwagerr();
    await module.sweepPendingBwagerrToWagerr();
  },

  /**
  * Sweep any pending wagerr_to_bwagerr swaps
  */
  async sweepPendingWagerrToBwagerr() {
    log.header(chalk.blue(`Sweeping ${SWAP_TYPE.WAGERR_TO_BWAGERR}`));

    // Get all the client accounts
    const clientAccounts = await db.getClientAccounts(TYPE.WAGERR);

    // Get all incoming transactions from the client accounts
    const promises = clientAccounts.map(async c => {
      const { address } = c.account;
      const transactions = await transactionHelper.getIncomingTransactions(c.account, TYPE.WAGERR);
      return transactions.map(t => ({ ...t, address }));
    });
    const wagerrTransactions = await Promise.all(promises).then(array => array.flat());

    // Get all the deposit hases from the db
    const hashes = await db.getAllSwapDepositHashes(SWAP_TYPE.WAGERR_TO_BWAGERR);

    // Get all the new transactions
    const newTransactions = wagerrTransactions.filter(t => !hashes.includes(t.hash));
    if (newTransactions.length === 0) {
      log.info(chalk.yellow('No new transactions'));
      return;
    }

    // Go through all the transactions and add them to the client account
    const swapPromises = [];
    for (const newTransaction of newTransactions) {
      const clientAccount = clientAccounts.find(c => c.account.address === newTransaction.address);
      if (clientAccount) {
        swapPromises.push(db.insertSwap(newTransaction, clientAccount));
      }
    }

    const count = await postgres.tx(t => t.batch(promises));
    log.info(chalk`{green Inserted {white.bold ${count.length}} swaps}`);
  },

  /**
  * Sweep any pending bwagerr_to_wagerr swaps
  */
  async sweepPendingBwagerrToWagerr() {
    log.header(chalk.blue(`Sweeping ${SWAP_TYPE.BWAGERR_TO_WAGERR}`));
    const ourAddress = transactionHelper.ourBNBAddress;

    // Get all our incoming transactions which contain a memo
    const transactions = await transactionHelper.getIncomingBNBTransactions(ourAddress);
    const memoTransactions = transactions.filter(t => t.memo && t.memo.length == 64);

    // Get all the deposit hases from the db
    const hashes = await db.getAllSwapDepositHashes(SWAP_TYPE.BWAGERR_TO_WAGERR);

    // Get all the new transactions
    const newTransactions = memoTransactions.filter(t => !hashes.includes(t.hash));
    if (newTransactions.length === 0) {
      log.info(chalk.yellow('No new transactions'));
      return;
    }

    // Get all the client accounts
    const memos = newTransactions.map(t => t.memo.trim());
    const clientAccounts = await db.getClientAccountsWithMemos(memos);
    if (clientAccounts.length === 0) {
      log.error(chalk.red('Failed to insert new transactions. Could not find any client accounts'));
      return;
    }

    // Go through all the transactions and add them to the client account
    const promises = [];
    for (const newTransaction of newTransactions) {
      const clientAccount = clientAccounts.find(c => c.account.memo === newTransaction.memo);
      if (clientAccount) {
        promises.push(db.insertSwap(newTransaction, clientAccount));
      }
    }

    const count = await postgres.tx(t => t.batch(promises));
    log.info(chalk`{green Inserted {white.bold ${count.length}} swaps}`);
  },
};

export default module;
