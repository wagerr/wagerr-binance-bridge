/* eslint-disable no-underscore-dangle */

import request from 'request-promise';

/**
 * A client to communicate with Wagerr Wallet.
 */
export default class WagerrClient {
  /**
   * Create a Wagerr client
   * @param {{ hostname, port, username, password }} rpcConfig The rpc config.
   * @param {{ filename, password, accountIndex }} [walletConfig] The wallet config.
   */
  constructor(rpcConfig, walletConfig = null) {
    this.rpc = rpcConfig;
    this.accountIndex = (walletConfig && walletConfig.accountIndex) || 0;
    this.wallet = walletConfig ; 
  }

  async _request(method, params=[], callCount = 0) {
    const options = {
      uri: `http://${this.rpc.hostname}:${this.rpc.port}`,
      method: 'POST',
      json: {
        jsonrpc: '2.0',
        id: '0',
        method,
        params,
      },
      auth: {
        user: this.rpc.username,
        pass: this.rpc.password
        
      },
      simple:false
    };


    try {
      const response = await request(options);
      if (response.error) {
        // If wallet is not opened, then open it and call the rpc
        if (this.wallet && response.error.code == -13 && response.error.message === 'Error: Please enter the wallet passphrase with walletpassphrase first.') {
          await this.openWallet();

          // Make sure we're not forever opening the wallet
          if (callCount <= 3) return this._request(method, params, callCount + 1);
        }

        return {
          method,
          params,
          error: response.error,
        };
      }

      return {
        method,
        params,
        result: response.result,
      };
    } catch (error) {
      return {
        method,
        params,
        error: {
          code: error.statusCode || -1,
          message: error.message,
          cause: error.cause,
        },
      };
    }
  }

  /**
   * Open a wallet.
   * This will close any opened wallets.
   *
   * @throws Will throw an error if opening a wallet failed.
   */
  async openWallet() {
    if (!this.wallet) return;

    // close any open wallet
    await this._request('walletlock');

    const { password } = this.wallet;

    const data = await this._request('walletpassphrase', [password , 60]);

    if (data.error) throw new Error(data.error.message);
  }



 

  /**
   * Create a new sub-address from the current open wallet.
   *
   * @returns {Promise<{ address: string, address_index: number }>} A new wagerr account or `null` if we failed to make one.
   */
  async createAccount() {
    const data = await this._request('getnewaddress', [this.accountIndex.toString()]);
    if (data.error) {
      console.log('[Wagerr Wallet] Failed to create account: ', data.error);
      return null;
    }

    // eslint-disable-next-line camelcase
    const address = data.result;
    const address_index = address; //this is not used anywhere just temporary for DB;
    return { address , address_index } ;
  }

  /**
   * Get all incoming transactions sent to the given `addressIndex`.
   *
   * @param {number} addressIndex The index of the sub-address.
   * @returns {Promise<[object]>} An array of WAGERR transactions.
   */
  async getIncomingTransactions(addressIndex, options = {}) {
    const data = await this._request('listtransactions', [this.accountIndex.toString()]);

    if (data.error) {
      console.log('[Wagerr Wallet] Failed to get transactions: ', data.error);
      return [];
    }

   var incoming = (data.result || []).filter(tx => tx.category == 'receive' && tx.address === addressIndex);
 

    return incoming;
  }

  /**
   * Validate an address.
   * @param {string} address The Wagerr address to validate.
   * @returns {Promise<boolean>} Wether the given `address` is valid or not.
   */
  async validateAddress(address) {
    const data = await this._request('validateaddress', [address]);

    if (data.error) {
      console.log('[Wagerr Wallet] Failed to validate address: ', data.error);
      return false;
    }

    return data.result.isvalid;
  }

  /**
   * Get balances for the given `addressIndicies`.
   *
   * @param {[number]} addressIndicies An array of subaddress indicies.
   * @returns {Promise<[{ addressIndex, address, balance, unlocked }]>} An array of balances
   */
  async getBalances() {
    const data = await this._request('getbalance', [this.accountIndex.toString()]);

    if (data.error) {
      console.log('[Wagerr Wallet] Failed to get balances: ', data.error);
      return [];
    }

    // eslint-disable-next-line camelcase
    return data.result;
  }

  /**
   * Send multiple transactions from the current open wallet.
   *
   * @param {[{ address: string, amount: number }]}]} destinations The destinations.
   * @returns {Promise<[string]>} The transaction hashes
   */
  async multiSend(destinations) {
    const data = await this._request('sendmany',[this.accountIndex.toString(),destinations]);

    if (data.error || !data.result) {
      const error = (data.error && data.error.message) || 'No result found';
      throw new Error(`[Wagerr Wallet] Failed to send transactions - ${error}`);
    }

    return [data.result];
  }
}
