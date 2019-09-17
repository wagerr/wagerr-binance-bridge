import colors from './colors';

const theme =  {
  typography: {
    fontFamily: ['Lato', 'Roboto', 'Open Sans', 'sans-serif'].join(','),
    lineHeight: 1.45,
    useNextVariants: true,
    h6: {
      fontFamily: ['Source Sans Pro','sans-serif'].join(','),
      fontSize: '0.8rem',
      fontWeight: 600,
      marginBottom: '.5rem'
    }
  },
  type: 'light',
  overrides: {
    MuiInputBase: {
      root: {
        fontSize: '13px',
        background: colors.wagerrBlack60
      }
    },
    MuiOutlinedInput: {
      input: {
        padding: '14px'
      }
    },
    MuiPrivateNotchedOutline: {
      root: {
        borderRadius: '0px'
      }
    },
    MuiButton: {
      label: {
        fontSize: '0.7rem'
      }
    },
  },
  palette: {
    type: 'dark',
    primary: {
      main: colors.wagerrRed
    },
    secondary: {
      main: colors.lightBlack
    },
    background:{
      paper: colors.wagerrBlack80,
      default: colors.wagerrRed
    },
    text: {
      primary: colors.gray,
      secondary: colors.wagerrRed
    }
  }
};

export default theme;
