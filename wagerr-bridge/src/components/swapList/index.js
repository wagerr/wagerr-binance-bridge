import React, { Component } from 'react';
import PropTypes from 'prop-types';
import TimeAgo from 'timeago-react';
import dateformat from 'dateformat';
import { Grid, Typography, Box, Divider, Link, GridList } from '@material-ui/core';
import { withStyles } from '@material-ui/core/styles';
import config from '@config';
import { SWAP_TYPE, TYPE } from '@constants';
import styles from './styles';

const hashUrls = {
  [TYPE.WAGERR]: config.wagerr.txExplorerUrl,
  [TYPE.BNB]: config.binance.txExplorerUrl,
};

class SwapList extends Component {
  renderHash = (type, txHash, transferTxHashes) => {
    const { classes } = this.props;

   
    const depositHashType = type === SWAP_TYPE.WAGERR_TO_BWAGERR ? TYPE.WAGERR : TYPE.BNB;
    const transferHashType = type === SWAP_TYPE.WAGERR_TO_BWAGERR ? TYPE.BNB : TYPE.WAGERR;
    
    
    const txBaseUrl = hashUrls[depositHashType];
    const transferBaseUrl = hashUrls[transferHashType];
    
    const txHashes = [txHash];

    const txHashItems = txHashes.map(hash => {
      const url = `${txBaseUrl}/${hash}`;
      return (
        <Typography key={hash} className={classes.hash}>
          <Link href={url} target="_blank" rel="noreferrer">
            {hash}
          </Link>
        </Typography>
      );
    });

    const transferHashItems = transferTxHashes.map(hash => {
      const url = `${transferBaseUrl}/${hash}`;
      return (
        <Typography key={hash} className={classes.hash}>
          <Link href={url} target="_blank" rel="noreferrer">
            {hash}
          </Link>
        </Typography>
      );
    });

    
    return (
      <Box>
      <React.Fragment>
        <Typography className={classes.hashTitle}>Swap Transaction Hashes</Typography>
        {transferHashItems}
      </React.Fragment>

       <React.Fragment>
       <Typography className={classes.hashTitle}>Deposit Transaction Hashes</Typography>
       {txHashItems}
     </React.Fragment>
     </Box>
    );
  }

  renderTime = (created) => {
    const { classes } = this.props;
    const now = Date.now();
    const timestamp = Date.parse(created);
    const diff = Math.abs(now - timestamp);
    const dayMs = 24 * 60 * 60 * 1000;

    const showFullDate = diff > dayMs;
    if (showFullDate) {
      const formatted = dateformat(timestamp, 'dd/mm/yyyy');
      return (
        <Typography className={classes.time}>{formatted}</Typography>
      );
    }

    return <TimeAgo className={classes.time} datetime={timestamp} />;
  }

  renderSwapItem = ({ uuid, type, amount, txHash, transferTxHashes, created, unconfirmed }) => {
    const { classes } = this.props;

    const isPending = transferTxHashes && transferTxHashes.length === 0;
    const depositCurrency = type === SWAP_TYPE.WAGERR_TO_BWAGERR ? 'WAGERR' : 'B-WAGERR';
    const displayAmount = amount / 1e9;

    let status = 'Completed';
    if (isPending) {
      status = unconfirmed ? 'Waiting for Confirmations' : 'Pending';
    }

    return (
      <Grid item xs={12} key={uuid}>
        <Box className={classes.item}>
          <Box display="flex" flexDirection="row" alignItems="center" justifyContent="space-between">
            <Typography className={classes.amount}>{displayAmount} {depositCurrency}</Typography>
            <Box display="flex" flexDirection="row" alignItems="center">
              <Typography className={isPending ? classes.pending : classes.completed}>
                {status}
              </Typography>
              <Typography className={classes.timeSeperator}> • </Typography>
              { this.renderTime(created) }
            </Box>
          </Box>
          <Divider variant="middle" className={classes.divider} />
          { this.renderHash(type, txHash, transferTxHashes) }
        </Box>
      </Grid>
    );
  }

  renderSwaps = () => {
    const { classes, swaps } = this.props;
    if (!swaps || swaps.length === 0) {
      return (
        <Box className={classes.item}>
          <Typography className={classes.emptyTitle}>No Transactions Found</Typography>
        </Box>
      );
    }

    return swaps.map(this.renderSwapItem);
  }

  render() {
    const { classes } = this.props;

    return (
      <Grid item xs={ 12 } className={classes.root}>
        
        <GridList className={classes.gridList} >
          {this.renderSwaps()}
          </GridList>
       
      </Grid>
    );
  }
}

SwapList.propTypes = {
  classes: PropTypes.object.isRequired,
  swaps: PropTypes.array
};

export default withStyles(styles)(SwapList);
