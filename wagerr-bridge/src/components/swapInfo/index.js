import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import clsx from  'clsx';
import QRCode from 'qrcode.react';
import AnimateHeight from 'react-animate-height';
import { Grid, Typography, IconButton, Link, Tooltip, Box } from '@material-ui/core';
import { withStyles } from '@material-ui/core/styles';
import { FileCopyOutlined as CopyIcon } from '@material-ui/icons';
import { Button, QRIcon } from '@components';
import { SWAP_TYPE } from '@constants';
import styles from './styles';

class SwapInfo extends PureComponent {
  state = {
    showQR: false,
    qrSize: 128,
  };

  onCopy = (id) => {
    var elm = document.getElementById(id);
    let range;
    // for Internet Explorer

    if (document.body.createTextRange) {
      range = document.body.createTextRange();
      range.moveToElementText(elm);
      range.select();
      document.execCommand('Copy');
    } else if (window.getSelection) {
      // other browsers
      var selection = window.getSelection();
      range = document.createRange();
      range.selectNodeContents(elm);
      selection.removeAllRanges();
      selection.addRange(range);
      document.execCommand('Copy');
    }
  };

  componentDidMount() {
    // Run a timer every 10 seconds to refresh
    this.timer = setInterval(this.props.onRefresh, 30 * 1000);

    this.onResize();
    window.addEventListener('resize', this.onResize);
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.onResize);
    clearInterval(this.timer);
  }

  onResize = () => {
    const width = window.innerWidth;
    const qrSize = (width <= 600) ? 128 : 210;
    this.setState({ qrSize });
  }

  toggleQR = () => {
    this.setState({ showQR: !this.state.showQR });
  }

  renderQR = () => {
    const { showQR, qrSize } = this.state;
    const { classes, swapInfo } = this.props;
    const { depositAddress } = swapInfo;
    const height = showQR ? 'auto' : 0;

    return (
      <AnimateHeight
        duration={250}
        height={height}
      >
        <Box className={classes.qrContainer}>
          <Box className={classes.qr}>
            <QRCode value={depositAddress} renderAs='canvas' size={qrSize} />
          </Box>
        </Box>
      </AnimateHeight>
    );
  }

  renderMemo = () => {
    const { classes, swapInfo: { memo }} = this.props;
    if (!memo) return null;

    return (
      <Box className={classes.memoFrame}>
        <Typography className={classes.warningText}>
          PLEASE READ CAREFULLY
        </Typography>
        <Typography id='memo' className={classes.memo}>
          {memo}
        </Typography>
        <Tooltip title="Copy Memo" placement="right">
          <IconButton onClick={() => this.onCopy('memo')} aria-label="Copy Memo">
            <CopyIcon/>
          </IconButton>
        </Tooltip>
        <Typography className={classes.instructionBold}>
          When creating the transaction, please paste the string above into the <b>Memo</b> field. <br/>
          Ensure that this is the only thing that you put in the field.
        </Typography>
        <Typography className={clsx(classes.warningText, classes.red)}>
          If done incorrectly then you will not receive <b>WAGERR</b> into your designated address.
        </Typography>
      </Box>
    );
  }

  renderDepositInstructions = () => {
    const { swapType, classes, swapInfo } = this.props;

    const { depositAddress } = swapInfo;
    const depositCurrency = swapType === SWAP_TYPE.WAGERR_TO_BWAGERR ? 'WAGERR' : 'B-WAGERR';

    return (
      <React.Fragment>
        <Typography className={ classes.instructionBold }>
            Transfer your {depositCurrency}
        </Typography>
        <Typography className={ classes.instructions }>
            to
        </Typography>
        <Typography component={'div'} className={ classes.instructionBold }>
          <Box id='depositAddress' className={classes.redBorder}>{depositAddress}</Box>
          <Box>
            <Tooltip title="Copy Address" placement="left">
              <IconButton onClick={() => this.onCopy('depositAddress')} aria-label="Copy Address">
                <CopyIcon/>
              </IconButton>
            </Tooltip>
            <Tooltip title="Toggle QR" placement="right">
              <IconButton onClick={this.toggleQR} aria-label="Toggle QR">
                <QRIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Typography>
        {this.renderQR() }
        {this.renderMemo() }
      </React.Fragment>
    );
  }

  renderInstructions = () => {
    const { swapType, classes, info } = this.props;

    const wagerrFee = (info && info.fees && info.fees.wagerr / 1e9) || 0;
    let wagerrConfirmations = (info && info.minWagerrConfirmations);
    if (typeof wagerrConfirmations != 'number') { wagerrConfirmations = '-'; }

    return (
      <Box className={classes.instructionContainer}>
        {this.renderDepositInstructions()}
        { swapType === SWAP_TYPE.WAGERR_TO_BWAGERR && (
          <Typography className={ classes.instructions }>
            <b>Note:</b> You will have to wait for there to be atleast {wagerrConfirmations} confirmations before your added to our processing queue.
          </Typography>
        )}
        { swapType === SWAP_TYPE.BWAGERR_TO_WAGERR && (
          <Typography className={ classes.instructionBold }>
              There will be a processing fee of {wagerrFee} WAGERR which will be charged when processing all your pending swaps.
          </Typography>
        )}
        <Typography className={ classes.instructions }>
            If you run into any trouble, or your swap request has not gone through, please contact us.
        </Typography>
      </Box>
    );
  }

  renderReceivingAmount = () => {
    const { classes, swapType, swapInfo } = this.props;
    if (!swapInfo || !swapInfo.swaps || swapInfo.swaps.length === 0) return null;

    const receivingCurrency = swapType === SWAP_TYPE.WAGERR_TO_BWAGERR ? 'B-WAGERR' : 'WAGERR';

    const pendingSwaps = swapInfo.swaps.filter(s => s.transferTxHashes && s.transferTxHashes.length === 0);
    const total = pendingSwaps.reduce((total, swap) => total + parseFloat(swap.amount), 0);
    const displayTotal = total / 1e9;

    return (
      <Grid item xs={ 12 } align='right' className={ classes.stats }>
        <Typography className={classes.statTitle}>Pending Amount:</Typography>
        <Typography className={classes.statAmount}>{displayTotal} {receivingCurrency}</Typography>
      </Grid>
    );
  }

  render() {
    const { classes, loading, onRefresh, onBack } = this.props;

    return (
      <div className={classes.root}>
        <Grid item xs={ 12 } align='left' className={ classes.back }>
          <Typography>
            <Link className={classes.link} onClick={onBack}>
              &lt; Back
            </Link>
          </Typography>
        </Grid>
        {this.renderInstructions()}
        <Grid item xs={12} className={classes.button}>
          <Button
            fullWidth
            label="Refresh"
            loading={loading}
            onClick={onRefresh}
          />
        </Grid>
      </div>
    );
  }
}

SwapInfo.propTypes = {
  classes: PropTypes.object.isRequired,
  swapType: PropTypes.string.isRequired,
  swapInfo: PropTypes.object.isRequired,
  info: PropTypes.object.isRequired,
  onRefresh: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired,
  loading: PropTypes.bool,
};

export default withStyles(styles)(SwapInfo);
