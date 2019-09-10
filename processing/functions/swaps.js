/* eslint-disable no-else-return, no-restricted-syntax, no-await-in-loop */
import axios from 'axios';
import config from 'config';
import chalk from 'chalk';
import Decimal from 'decimal.js';
import { SWAP_TYPE, TYPE } from 'bridge-core';
import { db, bnb, wagerr } from '../core';
import log from '../utils/log';

// The fees in decimal format
const configFees = { [TYPE.WAGERR]: config.get('wagerr.withdrawalFee') };

const symbols = {
  [TYPE.WAGERR]: 'WAGERR',
  [TYPE.BNB]: 'B-WAGERR',
};

class PriceFetchFailed extends Error {}
class NoSwapsToProcess extends Error {}
class DailyLimitHit extends Error {}

const module = {
  // The fees in 1e9 format
  fees: { [TYPE.WAGERR]: (parseFloat(configFees[TYPE.WAGERR]) * 1e9).toFixed(0) },

  Errors: { PriceFetchFailed, NoSwapsToProcess, DailyLimitHit },
  /**
  * Process all pending swaps and send out the coins.
  */
  async processAllSwaps() {
    try {
      for (const swapType of Object.values(SWAP_TYPE)) {
        log.header(chalk.blue(`Processing swaps for ${swapType}`));
        const info = await module.processAllSwapsOfType(swapType);
        module.printInfo(info, swapType);
      }
    } catch (e) {
      log.error(chalk.red(`Error: ${e.message}`));
    }
  },

  /**
  * Print out info to the console
  */
  printInfo(info, swapType) {
    if (!info) {
      log.info(chalk.yellow('No swaps found'));
      return;
    }

    const { swaps, totalAmount } = info;
    const sentCurrency = swapType === SWAP_TYPE.WAGERR_TO_BWAGERR ? TYPE.BNB : TYPE.WAGERR;

    log.info(chalk`{green Completed {white.bold ${swaps.length}} swaps}`);
    log.info(chalk`{green Amount sent:} {bold ${totalAmount / 1e9}} {yellow ${symbols[sentCurrency]}}`);
  },

  /**
   * Process all pending swaps and send out the coins.
   *
   * @param {string} swapType The type of swap.
   * @returns {{ swaps, totalAmount, totalFee }} The completed swap info.
   */
  async processAllSwapsOfType(swapType) {
    const swaps = await db.getPendingSwaps(swapType);

    try {
      const data = await module.processSwaps(swaps, swapType);
      return data;
    } catch (e) {
      if (e instanceof NoSwapsToProcess) return null;
      throw e;
    }
  },

  /**
   * Perform auto swap on the given type.
   *
   * @param {number|string} dailyAmount The curreny daily amount swapped in usd.
   * @param {number|string} dailyLimit The maximum daily amount to swap in usd.
   * @param {string} swapType The type of swap.
   */
  async processAutoSwaps(dailyAmount, dailyLimit, swapType) {
    // Get the usd price of WAGERR and make sure it is valid
    const usdPrice = await module.getCurrentWagerrPriceInUSD();
    if (!usdPrice || usdPrice < 0) throw new PriceFetchFailed();

    // Get our pending swaps and their transactions
    const pendingSwaps = await db.getPendingSwaps(swapType);

    // Sort by lowest first
    const pendingTransactions = module.getTransactions(pendingSwaps).sort((a, b) => a.amount - b.amount);

    // Return early if we have no swaps to process
    if (pendingTransactions.length === 0) throw new NoSwapsToProcess();

    // We want to avoid weird JS decimal roundings, so we use a dedicated library (0.6 * 3 will be 1.7999999999999998 in JS)
    let currentAmount = new Decimal(dailyAmount);
    let total = new Decimal(0);

    // Make sure we let user know of daily limit hit
    if (currentAmount.greaterThanOrEqualTo(dailyLimit)) throw new DailyLimitHit();

    // Go through all transactions and use greedy algorithm to fill out our dailyAmount
    const transactions = [];
    while (pendingTransactions.length > 0 && currentAmount.lessThan(dailyLimit)) {
      const tx = pendingTransactions.shift();

      const decimalAmount = new Decimal(tx.amount).dividedBy(1e9);
      const usdAmount = decimalAmount.mul(usdPrice);

      // Add the transaction straight away since we only want to stop when our currentAmount goes over the dailyLimit
      transactions.push(tx);
      currentAmount = currentAmount.add(usdAmount);
      total = total.add(usdAmount);
    }

    // We need to map transaction back to swaps
    const swaps = transactions.flatMap(t => pendingSwaps.filter(s => s.address === t.address));

    // Process these swaps
    const info = await module.processSwaps(swaps, swapType);

    // Return the total value in usd
    return {
      ...info,
      totalUSD: total.toNumber(),
    };
  },

  /**
   * Get the current price of WAGERR
   */
  async getCurrentWagerrPriceInUSD() {
    try {
      const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=wagerr-network&vs_currencies=usd');
      return response.data['wagerr-network'].usd;
    } catch (e) {
      log.debug(e);
      throw new PriceFetchFailed();
    }
  },

  /**
   * Process the given swaps and send out the coins
   * @param {[{ uuid, amount, address }]} swaps The swaps.
   * @param {string} swapType The swap type.
   * @returns {{ swaps, totalAmount, totalFee }} The completed swap info.
   */
  async processSwaps(swaps, swapType) {
    const ids = swaps.map(s => s.uuid);
    const transactions = module.getTransactions(swaps);

    if (!transactions || transactions.length === 0) throw new NoSwapsToProcess();

    const txHashes = await module.send(swapType, transactions);
    await db.updateSwapsTransferTransactionHash(ids, txHashes.join(','));

    const sentCurrency = swapType === SWAP_TYPE.WAGERR_TO_BWAGERR ? TYPE.BNB : TYPE.WAGERR;

    // This is in 1e9 format
    const transactionAmount = transactions.reduce((total, current) => total + current.amount, 0);

    // Fee is per transaction (1 transaction = 1 user)
    const totalFee = (module.fees[sentCurrency] || 0) * transactions.length;
    const totalAmount = transactionAmount - totalFee;

    return {
      swaps,
      totalAmount,
      totalFee,
    };
  },

  /**
   * Take an array of `swaps` and combine the ones going to the same `address`.
   *
   * @param {[{ amount, address: string }]} swaps An array of swaps.
   * @returns Simplified transactions from the swaps.
   */
  getTransactions(swaps) {
    if (!Array.isArray(swaps)) return [];

    const amounts = {};

    // eslint-disable-next-line no-restricted-syntax
    for (const swap of swaps) {
      if (swap.address in amounts) {
        amounts[swap.address] += parseFloat(swap.amount) || 0;
      } else {
        amounts[swap.address] = parseFloat(swap.amount) || 0;
      }
    }

    return Object.keys(amounts).map(k => ({ address: k, amount: amounts[k] }));
  },

  /**
   * Send the given `swaps`.
   *
   * @param {string} swapType The type of swap.
   * @param {[{ address: string, amount: number }]} transactions An array of transactions.
   * @returns An array of transaction hashes
   */
  async send(swapType, transactions) {
  // Multi-send always returns an array of hashes
    if (swapType === SWAP_TYPE.WAGERR_TO_BWAGERR) {
      const symbol = config.get('binance.symbol');
      const outputs = transactions.map(({ address, amount }) => ({
        to: address,
        coins: [{
          denom: symbol,
          amount,
        }],
      }));

      // Send BNB to the users
      return bnb.multiSend(config.get('binance.mnemonic'), outputs, 'Wagerr Bridge');
    } else if (swapType === SWAP_TYPE.BWAGERR_TO_WAGERR) {
    // Deduct the wagerr withdrawal fees
      const outputs = transactions.map(({ address, amount }) => {
        const fee = module.fees[TYPE.WAGERR] || 0;
        return {
          address,
          amount: Math.max(0, amount - fee),
        };
      });

      // Send Wagerr to the users
      return wagerr.multiSend(outputs);
    }

    throw new Error('Invalid swap type');
  },

};

export default module;
