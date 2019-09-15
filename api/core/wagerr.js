import config from 'config';
import { clients } from 'bridge-core';


const { host, port, username, password: rpcPassword } = config.get('wagerr.walletRPC');

const rpc = {
  hostname: host,
  port,
  username,
  password: rpcPassword,
};



export default new clients.WagerrClient(rpc, null);
