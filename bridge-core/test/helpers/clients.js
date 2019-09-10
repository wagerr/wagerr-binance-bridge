import { PostgresClient, WagerrClient, BinanceClient } from '../../clients';

export const wagerr = new WagerrClient({
  hostname: 'localhost',
  port: 18083,
  username: '',
  password: '',
},
{
  filename: 'wagerrbridge',
  password: '',
});

export const bnb = new BinanceClient({
  api: 'https://testnet-dex.binance.org',
  network: 'testnet',
  symbol: 'TEST',
});

export const postgres = PostgresClient({
  host: 'localhost',
  port: 5432,
  database: 'wagerrbridge-test',
  user: 'postgres',
  password: '',
});
