/* eslint-disable import/prefer-default-export */
import config from 'config';

export function getInfo(req, res, next) {
  const wagerrFee = config.get('wagerr.withdrawalFee');
  const wagerrAmount = (parseFloat(wagerrFee) * 1e9).toFixed(0);

  const info = {
    fees: { wagerr: wagerrAmount },
    minWagerrConfirmations: config.get('wagerr.minConfirmations'),
  };

  res.status(205);
  res.body = {
    status: 200,
    success: true,
    result: info,
  };
  return next(null, req, res, next);
}
