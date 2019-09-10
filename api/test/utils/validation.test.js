/* eslint-disable max-len, arrow-body-style, no-restricted-syntax */
import { assert } from 'chai';
import sinon from 'sinon';
import { SWAP_TYPE } from 'bridge-core';
import { validation } from '../../utils';
import { bnb, wagerr } from '../../core';

const sandbox = sinon.createSandbox();

describe('Validation', () => {
  afterEach(() => {
    sandbox.restore();
  });

  describe('#validateSwap', async () => {
    const stubValidateAddressReturn = value => {
      sandbox.stub(wagerr, 'validateAddress').resolves(value);
      sandbox.stub(bnb, 'validateAddress').returns(value);
    };

    it('should return an error if body is null', async () => {
      const error = await validation.validateSwap(null);
      assert.strictEqual(error, 'invalid params');
    });

    it('should return an error if address is not present', async () => {
      const error = await validation.validateSwap({ type: SWAP_TYPE.WAGERR_TO_BWAGERR });
      assert.strictEqual(error, 'address is required');
    });

    it('should return an error if type is invalid', async () => {
      const error = await validation.validateSwap({ address: 'an address', type: 'invalid type' });
      assert.strictEqual(error, 'type is invalid');
    });

    it('should return an error if the wagerr address was invalid', async () => {
      stubValidateAddressReturn(false);

      const error = await validation.validateSwap({ address: 'an address', type: SWAP_TYPE.BWAGERR_TO_WAGERR });
      assert(wagerr.validateAddress.calledOnce, 'Wagerr validate was not called');
      assert.strictEqual(error, 'address must be a WAGERR address');
    });

    it('should return an error if the bnb address was invalid', async () => {
      stubValidateAddressReturn(false);
      const error = await validation.validateSwap({ address: 'an address', type: SWAP_TYPE.WAGERR_TO_BWAGERR });
      assert(bnb.validateAddress.calledOnce, 'BNB validate was not called');
      assert.strictEqual(error, 'address must be a BNB address');
    });

    it('should return null if no errors occurred', async () => {
      stubValidateAddressReturn(true);
      const wagerrError = await validation.validateSwap({ address: '1', type: SWAP_TYPE.BWAGERR_TO_WAGERR });
      assert.isNull(wagerrError);
      assert(wagerr.validateAddress.calledOnce, 'Wagerr validate was not called');

      const bnbError = await validation.validateSwap({ address: '1', type: SWAP_TYPE.WAGERR_TO_BWAGERR });
      assert.isNull(bnbError);
      assert(bnb.validateAddress.calledOnce, 'BNB validate was not called');
    });
  });

  describe('#validateUuidPresent', () => {
    it('should return an error if body is null', async () => {
      const error = await validation.validateUuidPresent(null);
      assert.strictEqual(error, 'invalid params');
    });

    it('should return an error if uuid is not present', async () => {
      const error = await validation.validateUuidPresent({});
      assert.strictEqual(error, 'uuid is required');
    });

    it('should not return an error if correct params are present', async () => {
      const error = await validation.validateUuidPresent({ uuid: '1' });
      assert.isNull(error);
    });
  });
});
