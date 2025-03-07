import { amber, green } from '@material-ui/core/colors';
import { colors } from '@theme';

const styles = theme => ({
  success: {
    backgroundColor: green[600],
  },
  error: {
    backgroundColor: theme.palette.error.dark,
  },
  info: {
    backgroundColor: theme.palette.primary.main,
  },
  warning: {
    backgroundColor: amber[700],
  },
  icon: {
    fontSize: 20,
  },
  iconVariant: {
    opacity: 0.9,
    marginRight: theme.spacing(1),
  },
  message: {
    display: 'flex',
    alignItems: 'center'
  },
  primaryText: {
    color: theme.palette.text.primary,
  },
  blackText: {
    color: colors.wagerrBlack80,
  }
});

export default styles;
