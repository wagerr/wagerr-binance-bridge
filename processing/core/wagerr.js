import config from 'config';
import { clients } from 'bridge-core';

const { host, port, username, password } = config.get('wagerr.walletRPC');

export default new clients.WagerrClient({
  hostname: host,
  port,
  username,
  password,
});
