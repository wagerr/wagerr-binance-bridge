import config from 'config';
import { TransactionHelper } from 'bridge-core';
import bnb from './binance';
import wagerr from './wagerr';
import { postgres, db, localDB } from './database';

const { minConfirmations } = config.get('wagerr');

const transactionHelper = new TransactionHelper({
  binance: {
    client: bnb,
    ourAddress: bnb.getAddressFromMnemonic(config.get('binance.mnemonic')),
  },
  wagerr: {
    client: wagerr,
    minConfirmations,
  },
});

export { bnb, wagerr, postgres, db, transactionHelper, localDB };
