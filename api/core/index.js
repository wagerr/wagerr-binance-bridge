import config from 'config';
import { TransactionHelper } from 'bridge-core';
import bnb from './binance';
import wagerr from './wagerr';
import { postgres, db } from './database';

const { minConfirmations } = config.get('wagerr');
const { depositAddress } = config.get('binance');

const transactionHelper = new TransactionHelper({
  binance: {
    client: bnb,
    ourAddress: depositAddress,
  },
  wagerr: {
    client: wagerr,
    minConfirmations,
  },
});

export { bnb, wagerr, postgres, db, transactionHelper };
