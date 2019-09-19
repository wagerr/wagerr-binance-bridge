import config from 'config';
import { clients } from 'bridge-core';

const { password: walletPassword ,accountIndex } = config.get('wagerr.wallet');
const { host, port, username, password } = config.get('wagerr.walletRPC');

export default new clients.WagerrClient({
  hostname: host,
  port,
  username,
  password,
},{
  password: walletPassword,
  accountIndex
});
