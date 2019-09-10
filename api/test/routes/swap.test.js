import { assert } from 'chai';
import sinon from 'sinon';
import { TYPE, SWAP_TYPE } from 'bridge-core';
import * as swapRoutes from '../../routes/swap';
import { bnb, wagerr, postgres, db, transactionHelper } from '../../core';
import { validation, crypto } from '../../utils';
import { dbHelper, wrapRouterFunction } from '../helpers';

const ourBnbAddress = transactionHelper.ourBNBAddress;

const sandbox = sinon.createSandbox();

const swapToken = params => wrapRouterFunction(swapRoutes.swapToken, params);
const finalizeSwapToken = params => wrapRouterFunction(swapRoutes.finalizeSwap, params);
const getSwaps = params => wrapRouterFunction(swapRoutes.getSwaps, params);

describe('Swap API', () => {
  beforeEach(async () => {
    // Clear out any data in the db
    await postgres.none('TRUNCATE client_accounts, accounts_wagerr, accounts_bnb, swaps CASCADE;');

    // Pretend all our addresses we pass are valid for these tests
    sandbox.stub(wagerr, 'validateAddress').resolves(true);
    sandbox.stub(bnb, 'validateAddress').returns(true);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#swapToken', () => {
    describe('failure', () => {
      it('should return 400 if validation failed', async () => {
        sandbox.restore();
        sandbox.stub(wagerr, 'validateAddress').resolves(false);
        sandbox.stub(bnb, 'validateAddress').returns(false);

        const spy = sandbox.spy(validation, 'validateSwap');

        const failingData = [
          null,
          { type: SWAP_TYPE.WAGERR_TO_BWAGERR },
          { address: '123', type: 'invalid type' },

          // validateAddress for both wagerr and bnb have been stubbed to return false
          // Which should cause these to fail
          { address: '123', type: SWAP_TYPE.WAGERR_TO_BWAGERR },
          { address: '123', type: SWAP_TYPE.BWAGERR_TO_WAGERR },
        ];

        const results = await Promise.all(failingData.map(swapToken));
        results.forEach(({ status, success }) => {
          assert.equal(status, 400);
          assert.isFalse(success);
        });

        // Make sure we hit the validate
        assert.equal(spy.callCount, failingData.length);
      });

      it('should return 500 if we failed to create a wagerr account', async () => {
        const wagerrCreateAccount = sandbox.stub(wagerr, 'createAccount').resolves(null);

        const { status, success, result } = await swapToken({ address: '123', type: SWAP_TYPE.WAGERR_TO_BWAGERR });
        assert.equal(status, 500);
        assert.isFalse(success);
        assert.equal(result, 'Invalid swap');

        assert(wagerrCreateAccount.called, 'wagerr.createAccount was not called');
      });
    });

    describe('success', () => {
      context('WAGERR To B-WAGERR', () => {
        it('should return the existing client account', async () => {
          const wagerrAccountUuid = 'd27efda6-988b-11e9-a2a3-2a2ae2dbcce4';
          const bnbClientAccount = 'd27f031e-988b-11e9-a2a3-2a2ae2dbcce4';
          const bnbAddress = '456';

          await postgres.tx(t => t.batch([
            // Generated wagerr account
            dbHelper.insertWagerrAccount(wagerrAccountUuid, 'wagerrAddress', 0),
            // Mapping user bnb address to generated wagerr
            dbHelper.insertClientAccount(bnbClientAccount, bnbAddress, TYPE.BNB, wagerrAccountUuid, TYPE.WAGERR),
          ]));

          // WAGERR_TO_BWAGERR means we give the api our BNB address
          const { status, success, result } = await swapToken({ type: SWAP_TYPE.WAGERR_TO_BWAGERR, address: bnbAddress });
          assert.equal(status, 200);
          assert.isTrue(success);
          assert.deepEqual(result, {
            uuid: bnbClientAccount,
            type: TYPE.WAGERR,
            depositAddress: 'wagerrAddress',
          });
        });

        it('should create a new account and return it if one does not exist', async () => {
          const bnbAddress = '456';

          const generateWagerrAccount = {
            address: 'generatedWagerr',
            address_index: 0,
          };
          sandbox.stub(wagerr, 'createAccount').resolves(generateWagerrAccount);

          const { status, success, result } = await swapToken({ type: SWAP_TYPE.WAGERR_TO_BWAGERR, address: bnbAddress });
          assert.equal(status, 200);
          assert.isTrue(success);
          assert.deepEqual(result, {
            uuid: result.uuid,
            type: TYPE.WAGERR,
            depositAddress: generateWagerrAccount.address,
          });
        });
      });

      context('BWAGERR to WAGERR', () => {
        it('should return the existing client account', async () => {
          const bnbAccountUuid = 'd27efff4-988b-11e9-a2a3-2a2ae2dbcce4';
          const wagerrClientAccount = 'd27f01b6-988b-11e9-a2a3-2a2ae2dbcce4';
          const wagerrAddress = '123';
          const memo = 'bnbMemo';

          await postgres.tx(t => t.batch([
            // BNB account
            dbHelper.insertBNBAccount(bnbAccountUuid, memo),
            // Mapping user wagerr address to generated bnb
            dbHelper.insertClientAccount(wagerrClientAccount, wagerrAddress, TYPE.WAGERR, bnbAccountUuid, TYPE.BNB),
          ]));

          // BWAGERR_TO_WAGERR means we give the api our WAGERR address
          const { status, success, result } = await swapToken({ type: SWAP_TYPE.BWAGERR_TO_WAGERR, address: wagerrAddress });
          assert.equal(status, 200);
          assert.isTrue(success);
          assert.deepEqual(result, {
            uuid: result.uuid,
            type: TYPE.BNB,
            depositAddress: ourBnbAddress,
            memo,
          });
        });

        it('should create a new account and return it if one does not exist', async () => {
          const wagerrAddress = '123';

          const memo = 'meme-mo';
          sandbox.stub(crypto, 'generateRandomString').returns(memo);

          const { status, success, result } = await swapToken({ type: SWAP_TYPE.BWAGERR_TO_WAGERR, address: wagerrAddress });
          assert.equal(status, 200);
          assert.isTrue(success);
          assert.deepEqual(result, {
            uuid: result.uuid,
            type: TYPE.BNB,
            depositAddress: ourBnbAddress,
            memo,
          });
        });
      });
    });
  });

  describe('#finalizeSwap', () => {
    // It doesn't matter what kind of client account we have here
    // We stub the relevant functions which take this in anyway
    const clientAccount = {
      uuid: 'd27efff4-988b-11e9-a2a3-2a2ae2dbcce4',
      address: 'WAGERR',
      addressType: TYPE.WAGERR,
      accountType: TYPE.BNB,
      account: { memo: 'memo' },
    };

    describe('failure', () => {
      it('should return 400 if validation failed', async () => {
        const spy = sandbox.spy(validation, 'validateUuidPresent');

        const failingData = [null, {}];
        const results = await Promise.all(failingData.map(finalizeSwapToken));
        results.forEach(({ status, success }) => {
          assert.equal(status, 400);
          assert.isFalse(success);
        });

        // Make sure we hit the validate
        assert.equal(spy.callCount, failingData.length);
      });

      it('should return 400 if no client account for the given uuid exists', async () => {
        const spy = sandbox.spy(db, 'getClientAccountForUuid');

        const { count } = await postgres.one('select count(*) from client_accounts');
        assert.equal(count, 0);

        const { status, success, result } = await finalizeSwapToken({ uuid: 'fake' });
        assert(spy.called, 'db.getClientAccountForUuid was not called');
        assert.equal(status, 400);
        assert.isFalse(success);
        assert.strictEqual(result, 'Unable to find swap details');
      });

      it('should return 200 with success set to false if no incoming transactions were found', async () => {
        sandbox.stub(db, 'getClientAccountForUuid').resolves(clientAccount);
        sandbox.stub(transactionHelper, 'getIncomingTransactions').resolves([]);
        sandbox.stub(db, 'getSwapsForClientAccount').resolves([{ deposit_transaction_hash: '1234' }]);

        const { status, success, result } = await finalizeSwapToken({ uuid: 'fake' });
        assert.equal(status, 200);
        assert.isFalse(success);
        assert.strictEqual(result, 'Unable to find a deposit');
      });

      it('should return 200 with success set to false if no NEW incoming transactions were found', async () => {
        const txHash = '1234';

        sandbox.stub(db, 'getClientAccountForUuid').resolves(clientAccount);
        sandbox.stub(transactionHelper, 'getIncomingTransactions').resolves([{ hash: txHash, amount: 100 }]);
        sandbox.stub(db, 'getSwapsForClientAccount').resolves([{ deposit_transaction_hash: txHash }]);

        const { status, success, result } = await finalizeSwapToken({ uuid: 'fake' });
        assert.equal(status, 200);
        assert.isFalse(success);
        assert.strictEqual(result, 'Unable to find any new deposits');
      });
    });

    describe('success', () => {
      const transactions = [1, 2, 3].map(t => ({ hash: String(t), amount: t }));

      beforeEach(() => {
        sandbox.stub(db, 'getClientAccountForUuid').resolves(clientAccount);
      });

      it('should return the newly inserted swaps', async () => {
        sandbox.stub(transactionHelper, 'getIncomingTransactions').resolves(transactions);
        sandbox.stub(db, 'getSwapsForClientAccount').resolves([]);

        const { status, success, result } = await finalizeSwapToken({ uuid: 'fake' });
        assert.equal(status, 200);
        assert.isTrue(success);
        assert.lengthOf(result, transactions.length);
      });

      it('should filter out transactions which we have swaps for', async () => {
        const swaps = [1, 2].map(t => ({ deposit_transaction_hash: String(t) }));
        sandbox.stub(transactionHelper, 'getIncomingTransactions').resolves(transactions);
        sandbox.stub(db, 'getSwapsForClientAccount').resolves(swaps);

        const { status, success, result } = await finalizeSwapToken({ uuid: 'fake' });
        assert.equal(status, 200);
        assert.isTrue(success);
        assert.lengthOf(result, 1);

        const swap = result[0];
        assert.strictEqual(swap.txHash, '3');
      });

      it('should return the correct data', async () => {
        const txHash = '123';
        sandbox.stub(transactionHelper, 'getIncomingTransactions').resolves([{ hash: txHash, amount: 100 }]);
        sandbox.stub(db, 'getSwapsForClientAccount').resolves([]);

        const { status, success, result } = await finalizeSwapToken({ uuid: 'fake' });
        assert.equal(status, 200);
        assert.isTrue(success);
        assert.lengthOf(result, 1);

        const swap = result[0];
        assert.deepEqual(Object.keys(swap), ['uuid', 'type', 'amount', 'txHash']);
        assert.strictEqual(swap.type, SWAP_TYPE.BWAGERR_TO_WAGERR);
        assert.equal(swap.amount, 100);
        assert.strictEqual(swap.txHash, txHash);
      });

      it('should have inserted the swaps in the db', async () => {
        sandbox.stub(transactionHelper, 'getIncomingTransactions').resolves(transactions);
        sandbox.stub(db, 'getSwapsForClientAccount').resolves([]);

        const { status, success } = await finalizeSwapToken({ uuid: 'fake' });
        assert.equal(status, 200);
        assert.isTrue(success);

        const { count } = await postgres.one('select count(*) from swaps');
        assert.equal(count, transactions.length);
      });
    });
  });

  describe('#getSwaps', () => {
    describe('failure', () => {
      it('should return 400 if validation failed', async () => {
        const spy = sandbox.spy(validation, 'validateUuidPresent');

        const failingData = [null, {}];
        const results = await Promise.all(failingData.map(finalizeSwapToken));
        results.forEach(({ status, success }) => {
          assert.equal(status, 400);
          assert.isFalse(success);
        });

        // Make sure we hit the validate
        assert.equal(spy.callCount, failingData.length);
      });

      it('should return 400 if no client account for the given uuid exists', async () => {
        const spy = sandbox.spy(db, 'getClientAccountForUuid');

        const { count } = await postgres.one('select count(*) from client_accounts');
        assert.equal(count, 0);

        const { status, success, result } = await getSwaps({ uuid: 'fake' });
        assert(spy.called, 'db.getClientAccountForUuid was not called');
        assert.equal(status, 400);
        assert.isFalse(success);
        assert.strictEqual(result, 'Unable to find swap details');
      });
    });

    describe('success', () => {
      const clientAccount = {
        uuid: 'd27efff4-988b-11e9-a2a3-2a2ae2dbcce4',
        address: 'WAGERR',
        addressType: TYPE.WAGERR,
        accountAddress: 'BNB',
        accountType: TYPE.BNB,
      };

      beforeEach(() => {
        sandbox.stub(db, 'getClientAccountForUuid').resolves(clientAccount);
      });

      it('should return all the swaps for the given client account', async () => {
        const swaps = [1, 2, 3].map(id => ({
          uuid: id,
          type: SWAP_TYPE.BWAGERR_TO_WAGERR,
          amount: id * 100,
          txHash: id,
        }));
        sandbox.stub(db, 'getSwapsForClientAccount').resolves(swaps);

        const { status, success, result } = await getSwaps({ uuid: 'fake' });
        assert.equal(status, 200);
        assert.isTrue(success);
        assert.lengthOf(result, swaps.length);
      });

      it('should return the correct data if swap has not been processed', async () => {
        const swap = {
          uuid: 'swapuuid',
          type: SWAP_TYPE.BWAGERR_TO_WAGERR,
          amount: 100,
          deposit_transaction_hash: 'deposit',
          created: 'now',
        };
        sandbox.stub(db, 'getSwapsForClientAccount').resolves([swap]);

        const { status, result } = await getSwaps({ uuid: 'fake' });
        assert.equal(status, 200);
        assert.lengthOf(result, 1);

        const returnedSwap = result[0];
        assert.deepEqual(Object.keys(returnedSwap), ['uuid', 'type', 'amount', 'txHash', 'transferTxHashes', 'created']);
        assert.strictEqual(returnedSwap.uuid, swap.uuid);
        assert.strictEqual(returnedSwap.type, swap.type);
        assert.equal(returnedSwap.amount, swap.amount);
        assert.strictEqual(returnedSwap.txHash, swap.deposit_transaction_hash);
        assert.isEmpty(returnedSwap.transferTxHashes);
        assert.strictEqual(returnedSwap.created, 'now');
      });

      it('should return the array of transaction hashes if swap has been processed', async () => {
        const swap = {
          uuid: 'swapuuid',
          type: SWAP_TYPE.BWAGERR_TO_WAGERR,
          amount: 100,
          deposit_transaction_hash: 'deposit',
          transfer_transaction_hash: 'hash1,hash2',
          created: 'now',
        };
        sandbox.stub(db, 'getSwapsForClientAccount').resolves([swap]);

        const { status, result } = await getSwaps({ uuid: 'fake' });
        assert.equal(status, 200);
        assert.lengthOf(result, 1);

        const returnedSwap = result[0];
        assert.deepEqual(returnedSwap.transferTxHashes, ['hash1', 'hash2']);
      });
    });
  });
});
