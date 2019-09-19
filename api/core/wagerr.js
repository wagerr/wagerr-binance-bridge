import config from 'config';
import { clients } from 'bridge-core';

const { password: walletPassword , accountIndex} = config.get('wagerr.wallet');
const { host, port, username, password: rpcPassword } = config.get('wagerr.walletRPC');

const rpc = {
  hostname: host,
  port,
  username,
  password: rpcPassword,
};

const wallet =  {
  password: walletPassword,
  accountIndex

};

export default new clients.WagerrClient(rpc, wallet);
