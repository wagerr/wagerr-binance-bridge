import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import { Grid, Typography, Box } from '@material-ui/core';
import { Warning } from '@utils/error';
import { store, dispatcher, Actions, Events } from '@store';
import { SWAP_TYPE, TYPE } from '@constants';
import { SwapSelection, SwapInfo, SwapList } from '@components';
import styles from './styles';

const currencySymbols = {
  [TYPE.WAGERR]: 'WAGERR',
  [TYPE.BNB]: 'B-WAGERR'
};

class Swap extends Component {
  state = {
    loading: false,
    page: 0,
    swapType: SWAP_TYPE.WAGERR_TO_BWAGERR,
    address: '',
    info: {},
    swapInfo: {},
    swaps: [],
    unconfirmed: [],
  };

  componentWillMount() {
    this.onInfoUpdated();
    store.on(Events.ERROR, this.onError);
    store.on(Events.FETCHED_INFO, this.onInfoUpdated);
    store.on(Events.FETCHED_SWAPS, this.onSwapsFetched);
    store.on(Events.FETCHED_UNCONFIRMED_WAGERR_TXS, this.onUnconfirmedTransactionsFetched);
    store.on(Events.TOKEN_SWAPPED, this.onTokenSwapped);
    store.on(Events.TOKEN_SWAP_FINALIZED, this.onTokenSwapFinalized);
  }

  componentDidMount() {
    dispatcher.dispatch({ type: Actions.GET_INFO });
  }

  componentWillUnmount() {
    store.removeListener(Events.ERROR, this.onError);
    store.removeListener(Events.FETCHED_INFO, this.onInfoUpdated);
    store.removeListener(Events.FETCHED_SWAPS, this.onSwapsFetched);
    store.removeListener(Events.FETCHED_UNCONFIRMED_WAGERR_TXS, this.onUnconfirmedTransactionsFetched);
    store.removeListener(Events.TOKEN_SWAPPED, this.onTokenSwapped);
    store.removeListener(Events.TOKEN_SWAP_FINALIZED, this.onTokenSwapFinalized);
  }

  onError = (error) => {
    const isWarning = error instanceof Warning;
    const message = error.message;
    const variant = isWarning ? 'warning' : 'error';
    this.props.showMessage(message, variant);
    this.setState({ loading: false });
  }

  onUnconfirmedTransactionsFetched = (transactions) => {
    this.setState({ unconfirmed: transactions });
  }

  onSwapsFetched = (swaps) => {
    this.setState({ swaps, loading: false });
  }

  onTokenSwapped = (swapInfo) => {
    this.setState({ swapInfo, page: 1 });
    setImmediate(() => this.getUnconfirmedTransactions());
    setImmediate(() => this.getSwaps());
  }

  onTokenSwapFinalized = (transactions) => {
    this.setState({ loading: false });
    const message = transactions.length === 1 ? 'Added 1 new swap' : `Added ${transactions.length} new swaps`;
    this.props.showMessage(message, 'success');

    setImmediate(() => this.getUnconfirmedTransactions());
    setImmediate(() => this.getSwaps());
  }

  onInfoUpdated = () => {
    this.setState({ info: store.getStore('info') || {} });
  }

  onNext = () => {
    switch (this.state.page) {
      case 0:
        this.swapToken();
        break;
      case 1:
        this.finalizeSwap();
        break;
      default:

    }
  }

  resetState = () => {
    this.setState({
      loading: false,
      page: 0,
      address: '',
      swapInfo: {},
      swaps: [],
      unconfirmed: [],
    });
  }

  getUnconfirmedTransactions = () => {
    const { swapType, swapInfo } = this.state;
    if (swapType !== SWAP_TYPE.WAGERR_TO_BWAGERR) return;
    dispatcher.dispatch({
      type: Actions.GET_UNCONFIRMED_WAGERR_TXS,
      content: {
        uuid: swapInfo.uuid
      }
    });
  }

  getSwaps = () => {
    const { swapInfo } = this.state;
    dispatcher.dispatch({
      type: Actions.GET_SWAPS,
      content: {
        uuid: swapInfo.uuid
      }
    });
    this.setState({ loading: true });
  }

  swapToken = () => {
    const { swapType, address } = this.state;
    dispatcher.dispatch({
      type: Actions.SWAP_TOKEN,
      content: {
        type: swapType,
        address
      }
    });
    this.setState({ loading: true });
  }

  onRefresh = () => {
    this.getUnconfirmedTransactions();
    this.getSwaps();
    this.finalizeSwap();
  }

  finalizeSwap = () => {
    const { swapInfo } = this.state;
    dispatcher.dispatch({
      type: Actions.FINALIZE_SWAP_TOKEN,
      content: {
        uuid: swapInfo.uuid
      }
    });
    this.setState({ loading: true });
  }

  renderReceivingAmount = () => {
    const { classes } = this.props;
    const { swapType, swaps, info } = this.state;
    if (!swaps) return null;

    const receivingCurrency = swapType === SWAP_TYPE.WAGERR_TO_BWAGERR ? TYPE.BNB : TYPE.WAGERR;

    const pendingSwaps = swaps.filter(s => s.transferTxHashes && s.transferTxHashes.length === 0);
    const total = pendingSwaps.reduce((total, swap) => total + parseFloat(swap.amount), 0);

    const { fees } = info;
    const fee = (fees && fees[receivingCurrency]) || 0;
    const displayTotal = Math.max(0, total - fee) / 1e9;

    return (
      <Box display="flex" flexDirection="row" alignItems="center">
        <Typography className={classes.statTitle}>Amount Due:</Typography>
        <Typography className={classes.statAmount}>{displayTotal} {currencySymbols[receivingCurrency]}</Typography>
      </Box>
    );
  }

  renderTransactions = () => {
    const { classes } = this.props;
    const { swaps, unconfirmed, swapType } = this.state;

    const unconfirmedTxs = swapType === SWAP_TYPE.WAGERR_TO_BWAGERR ? unconfirmed : [];
    const unconfirmedSwaps = unconfirmedTxs.map(({ hash, amount, created }) => ({
      uuid: hash,
      type: SWAP_TYPE.WAGERR_TO_BWAGERR,
      amount,
      txHash: hash,
      transferTxHashes: [],
      created,
      unconfirmed: true,
    }));

    const merged = [...unconfirmedSwaps, ...swaps];

    return (
      <Grid item xs={12} md={6}>
        <Box display="flex" flexDirection="column" className={classes.section}>
          <Box display="flex" flexDirection="row" justifyContent="space-between" alignItems="center">
            <Typography className={classes.transactionTitle}>Transactions</Typography>
            {this.renderReceivingAmount()}
          </Box>
          <Grid item xs={12}>
            <SwapList swaps={merged}/>
          </Grid>
        </Box>
      </Grid>
    );
  }

  renderSelection = () => {
    const { classes } = this.props;

    const { loading, swapType } = this.state;

    return (
      <Grid item xs={12} className={classes.item}>
        <SwapSelection
          swapType={swapType}
          onSwapTypeChanged={(swapType) => this.setState({ swapType })}
          onNext={(address) => {
            this.setState({ address });
            // Wait for state to refresh correctly
            setImmediate(() => this.onNext());
          }}
          loading={loading}
        />
      </Grid>
    );
  }

  renderInfo = () => {
    const { classes } = this.props;

    const { loading, swapType, swapInfo, info } = this.state;

    return (
      <React.Fragment>
        <Grid item xs={12} md={6} className={classes.item}>
          <SwapInfo
            swapType={swapType}
            swapInfo={swapInfo}
            info={info}
            onRefresh={this.onRefresh}
            onBack={this.resetState}
            loading={loading}
          />
        </Grid>
        {this.renderTransactions()}
      </React.Fragment>
    );
  }

  render() {
    const { classes } = this.props;
    const { page} = this.state;

    return (
      <Grid container className={classes.root} spacing={2}>
        { page === 0 && this.renderSelection()}
        { page === 1 && this.renderInfo()}
      </Grid>
    );
  };
}

Swap.propTypes = {
  classes: PropTypes.object.isRequired,
  showMessage: PropTypes.func.isRequired
};

export default withStyles(styles)(Swap);
