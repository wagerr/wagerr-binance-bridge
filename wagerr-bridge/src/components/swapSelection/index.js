import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Grid, Typography, Link } from '@material-ui/core';
import { withStyles } from '@material-ui/core/styles';
import { Input, Button, Select } from '@components';
import { SWAP_TYPE, TYPE } from '@constants';
import config from '@config';
import styles from './styles';

const walletCreationUrl = {
  [TYPE.WAGERR]: config.wagerr.walletCreationUrl,
  [TYPE.BNB]: config.binance.walletCreationUrl,
};

class SwapSelection extends Component {
  state = {
    address: '',
    addressError: false,
    options: [{
      value: SWAP_TYPE.WAGERR_TO_BWAGERR,
      description: 'WAGERR to B-WAGERR',
    }, {
      value: SWAP_TYPE.BWAGERR_TO_WAGERR,
      description: 'B-WAGERR to WAGERR',
    }],
  };

  onNext = () => {
    const { address } = this.state;
    const { onNext } = this.props;

    const isValidAddress = address && address.length > 0;
    this.setState({ addressError: !isValidAddress });

    if (isValidAddress) onNext(address);
  }

  onAddressChanged = (event) => {
    this.setState({ address: event.target.value });
  }

  onSwapTypeChanged = (event) => {
    this.props.onSwapTypeChanged(event.target.value);
  }

  getAddressType = () => {
    const { swapType } = this.props;
    return swapType === SWAP_TYPE.WAGERR_TO_BWAGERR ? TYPE.BNB : TYPE.WAGERR;
  }

  render() {
    const { swapType, loading, classes } = this.props;
    const { options, address, addressError } = this.state;

    const addressType = this.getAddressType();
    const inputLabel = addressType === TYPE.WAGERR ? 'Wagerr Address' : 'BNB Address';
    const inputPlaceholder = addressType === TYPE.WAGERR ? 'L...' : 'bnb...';

    const url = walletCreationUrl[addressType];

    return (
      <Grid item xs={ 12 } className={classes.root}>
        <Grid item xs={ 12 }>
          <Select
            fullWidth
            label="Swap Type"
            options={options}
            value={swapType}
            handleChange={this.onSwapTypeChanged}
            disabled={loading}
          />
        </Grid>
        <Grid item xs={ 12 }>
          <Input
            fullWidth
            label={inputLabel}
            placeholder={inputPlaceholder}
            value={address}
            error={addressError}
            onChange={this.onAddressChanged}
            disabled={loading}
          />
          <Typography className={ classes.createAccount }>
            <Link href={url} target="_blank" rel="noreferrer">
              Don't have an account? Create one
            </Link>
          </Typography>
        </Grid>
        <Grid item xs={ 12 } align='right' className={ classes.button }>
          <Button
            fullWidth
            label="Next"
            loading={loading}
            onClick={this.onNext}
          />
        </Grid>
      </Grid>
    );
  }
}

SwapSelection.propTypes = {
  classes: PropTypes.object.isRequired,
  swapType: PropTypes.string.isRequired,
  onSwapTypeChanged: PropTypes.func.isRequired,
  onNext: PropTypes.func.isRequired,
  loading: PropTypes.bool,
};

export default withStyles(styles)(SwapSelection);
