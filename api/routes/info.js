/* eslint-disable import/prefer-default-export */
import config from 'config';

export function getInfo(req, res, next) {
  const wagerrFee = config.get('wagerr.withdrawalFee');
  const bnbFee = config.get('binance.withdrawalFee');
  const wagerrAmount = (parseFloat(wagerrFee) * 1e9).toFixed(0);
  const bnbAmount = (parseFloat(bnbFee) * 1e9).toFixed(0);

  const info = {
    fees: { wagerr: wagerrAmount,bnb: bnbAmount },
    minWagerrConfirmations: config.get('wagerr.minConfirmations'),
    minBnbConfirmations: 1,
  };

  res.status(205);
  res.body = {
    status: 200,
    success: true,
    result: info,
  };
  return next(null, req, res, next);
}
