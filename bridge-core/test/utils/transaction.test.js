import { assert } from 'chai';
import sinon from 'sinon';
import { TYPE } from '../../utils/constants';
import { TransactionHelper } from '../../utils';
import { db, bnb, wagerr } from '../helpers';

const minConfirmations = 6;

const transaction = new TransactionHelper({
  binance: {
    client: bnb,
    ourAddress: 'ourAddress',
  },
  wagerr: {
    client: wagerr,
    minConfirmations,
  },
});

const sandbox = sinon.createSandbox();

describe('Transaction', () => {
  afterEach(() => {
    sandbox.restore();
  });

  describe('#getIncomingTransactions', async () => {
    context('BNB', () => {
      it('should correctly return the incoming transactions', async () => {
        const memo = 'meme-mos';
        const timeStamp = '2019-07-12T04:04:49.529749Z';
        const mockAPIResult = [{
          txHash: 'hash',
          value: '100',
          memo,
          timeStamp,
        }];

        const stub = sandbox.stub(bnb, 'getIncomingTransactions').resolves(mockAPIResult);

        const transactions = await transaction.getIncomingTransactions({ memo }, TYPE.BNB);
        assert(stub.calledOnce, 'bnb.getIncomingTransactions was not called');
        assert.lengthOf(transactions, 1);

        assert.deepEqual(transactions[0], {
          hash: 'hash',
          amount: '100',
          timestamp: Math.floor(Date.parse(timeStamp) / 1000),
        });
      });

      it('should should only return the tx with the same account memo', async () => {
        const timeStamp = '2019-07-12T04:04:49.529749Z';
        const mockAPIResult = ['memo1', 'memo2', 'memo3'].map((memo, i) => ({
          txHash: String(i),
          value: String(i),
          memo,
          timeStamp,
        }));

        sandbox.stub(bnb, 'getIncomingTransactions').resolves(mockAPIResult);

        const transactions = await transaction.getIncomingTransactions({ memo: 'memo1' }, TYPE.BNB);
        assert.lengthOf(transactions, 1);
        assert.deepEqual(transactions[0], {
          hash: '0',
          amount: '0',
          timestamp: Math.floor(Date.parse(timeStamp) / 1000),
        });
      });
    });

    context('Wagerr', () => {
      it('should correctly return the incoming transactions', async () => {
        const mockAPIResult = [{
          txid: 'hash',
          amount: '100',
          confirmations: transaction.minWagerrConfirmations,
          timestamp: 100,
        }];

        const stub = sandbox.stub(wagerr, 'getIncomingTransactions').resolves(mockAPIResult);

        const transactions = await transaction.getIncomingTransactions({ addressIndex: 0 }, TYPE.WAGERR);
        assert(stub.calledOnce, 'wagerr.getIncomingTransactions was not called');
        assert.lengthOf(transactions, 1);
        assert.deepEqual(transactions[0], {
          hash: 'hash',
          amount: '100',
          timestamp: 100,
        });
      });

      it('should only return incoming transactions with more than 5 confirmations', async () => {
        const mockAPIResult = [minConfirmations - 1, minConfirmations, minConfirmations + 1].map(confirmations => ({
          txid: confirmations,
          amount: 100,
          confirmations,
        }));

        sandbox.stub(db, 'getWagerrAccount').resolves({ address_index: 0 });
        const stub = sandbox.stub(wagerr, 'getIncomingTransactions').resolves(mockAPIResult);

        const transactions = await transaction.getIncomingTransactions({ addressIndex: 0 }, TYPE.WAGERR);
        assert(stub.calledOnce, 'wagerr.getIncomingTransactions was not called');
        assert.lengthOf(transactions, 2);
        assert.includeMembers(transactions.map(t => t.hash), [minConfirmations, minConfirmations + 1]);
      });
    });
  });
});
