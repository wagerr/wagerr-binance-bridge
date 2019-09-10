import { SWAP_TYPE } from 'bridge-core';
import { bnb, wagerr } from '../core';

export async function validateSwap(body) {
  if (!body) return 'invalid params';
  const { type, address } = body;

  if (!address) return 'address is required';
  if (!Object.values(SWAP_TYPE).includes(type)) return 'type is invalid';

  if (type === SWAP_TYPE.BWAGERR_TO_WAGERR) {
    // User should pass a WAGERR address
    const valid = await wagerr.validateAddress(address);
    if (!valid) return 'address must be a WAGERR address';
  } else if (type === SWAP_TYPE.WAGERR_TO_BWAGERR) {
    // User should pass a BNB address
    if (!bnb.validateAddress(address)) return 'address must be a BNB address';
  }

  return null;
}

export function validateUuidPresent(body) {
  if (!body) return 'invalid params';
  const { uuid } = body;
  if (!uuid) return 'uuid is required';
  return null;
}
