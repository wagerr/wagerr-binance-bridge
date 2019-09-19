/* eslint-disable import/prefer-default-export */
import { TYPE } from './constants';

/**
 * Helper class for incoming transactions
 */
export default class TransactionHelper {
  /**
   * Create a helper instance.
   * @param {{ binance: { client, ourAddress }, wagerr: { client, minConfirmations }}} config The helper config.
   */
  constructor(config) {
    const { binance, wagerr } = config;

    this.bnb = binance.client;
    this.ourBNBAddress = binance.ourAddress;

    this.wagerr = wagerr.client;
    this.minWagerrConfirmations = wagerr.minConfirmations;
  }

  /**
   * Get incoming transactions to the given account.
   *
   * @param {any} account The account.
   * @param {'wagerr'|'bnb'} accountType The account type.
   * @return {Promise<{ hash, amount }>} An array of incoming transactions
   */
  async getIncomingTransactions(account, accountType) {
    switch (accountType) {
      case TYPE.BNB: {
        const { memo } = account;
        const transactions = await this.getIncomingBNBTransactions(this.ourBNBAddress);
        return transactions
          .filter(tx => tx.memo.trim() === memo.trim())
          .map(({ hash, amount, timestamp }) => ({ hash, amount, timestamp }));
      }
      case TYPE.WAGERR: {
        const { addressIndex } = account;

        // We only want transactions with a certain number of confirmations
        const transactions = await this.getIncomingWagerrTransactions(addressIndex);
        return transactions
          .filter(tx => tx.confirmations >= this.minWagerrConfirmations)
          .map(({ hash, amount, timestamp }) => ({ hash, amount, timestamp }));
      }
      default:
        return [];
    }
  }

  /**
   * Get incoming transactions from the given BNB address.
   * @param {string} address The BNB address
   * @param {number} since The time since a given date in milliseconds.
   */
  async getIncomingBNBTransactions(address, since = null) {
    const transactions = await this.bnb.getIncomingTransactions(address, since);
    return transactions.map(tx => ({
      ...tx,
      hash: tx.txHash,
      amount: tx.value,
      // BNB timestamps are in string format, we need to convert to seconds
      timestamp: Math.floor(Date.parse(tx.timeStamp) / 1000),
    }));
  }

  /**
   * Get incoming transactions from the given WAGERR address.
   * @param {number} addressIndex The WAGERR address index.
   * @param {{ pool: boolean }} options Any additional options
   */
  async getIncomingWagerrTransactions(addressIndex,options = {}) {
    const transactions = await this.wagerr.getIncomingTransactions(addressIndex,options);
    return transactions.map(tx => ({
      ...tx,
      hash: tx.txid,
      amount: (parseFloat(tx.amount) * 1e9).toFixed(0),
      timestamp:tx.time
    }));
  }
}
