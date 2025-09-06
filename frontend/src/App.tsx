import './App.css';
import Graph from './components/Graph/Trellis';
import TransactionTable from './components/TransactionTable';
import TransactionDetails from './components/TransactionDetails/TransactionDetails';
import Item from '@mui/material/Grid2';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { useResizeDetector } from 'react-resize-detector';
import {
  Grid2 as Grid,
  Switch,
  FormControlLabel,
  Chip,
  Stack,
} from '@mui/material';
import { getSocket } from './services/socket';
import { useEffect, useState } from 'react';

type MetricsRollup = {
  totalTransactions: number;
  totalAmount: number;
  alerts: { total: number; high: number; medium: number; low: number };
  generatedAt: string;
};

function App() {
  const { ref: containerRef } = useResizeDetector();

  const darkTheme = createTheme({
    palette: {
      mode: 'dark',
    },
  });

  const [colorMode, setColorMode] = useState<string>(
    () => localStorage.getItem('colorMode') || 'risk'
  );
  useEffect(() => {
    localStorage.setItem('colorMode', colorMode);
  }, [colorMode]);

  const [metrics, setMetrics] = useState<MetricsRollup | null>(null);

  useEffect(() => {
    const socket = getSocket();
    const onInitial = (payload: any) => {
      if (payload?.metrics) setMetrics(payload.metrics);
    };
    const onUpdate = (payload: any) => {
      if (payload?.metrics) setMetrics(payload.metrics);
    };
    socket.on('initialData', onInitial);
    socket.on('graphUpdate', onUpdate);
    return () => {
      socket.off('initialData', onInitial);
      socket.off('graphUpdate', onUpdate);
    };
  }, []);
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <div
        style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}
      >
        {/* Header */}
        <Grid
          container
          sx={{
            backgroundColor: '#000',
            color: '#fff',
            height: '50px',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
          }}
        >
          <Item className="logo">SAYARI</Item>
          <Stack direction="row" spacing={2} alignItems="center">
            <FormControlLabel
              control={
                <Switch
                  checked={colorMode === 'community'}
                  onChange={() =>
                    setColorMode(colorMode === 'risk' ? 'community' : 'risk')
                  }
                />
              }
              label={colorMode === 'risk' ? 'Color: Risk' : 'Color: Community'}
              sx={{
                color: '#fff',
                '.MuiFormControlLabel-label': {
                  display: 'inline-block',
                  width: 140,
                },
              }}
            />
            <Chip
              label={`Tx ${metrics?.totalTransactions ?? 0}`}
              size="small"
              variant="outlined"
              sx={{ color: '#fff', borderColor: '#555' }}
            />
            <Chip
              label={`$${(metrics?.totalAmount ?? 0).toLocaleString()}`}
              size="small"
              variant="outlined"
              sx={{ color: '#fff', borderColor: '#555' }}
            />
            <Chip
              label={`High ${metrics?.alerts.high ?? 0}`}
              size="small"
              color={(metrics?.alerts.high ?? 0) > 0 ? 'error' : 'default'}
              variant={(metrics?.alerts.high ?? 0) > 0 ? 'filled' : 'outlined'}
            />
          </Stack>
        </Grid>

        {/* Main Content */}
        <Grid container className="container" ref={containerRef}>
          <Grid sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <Grid className="graph">
              <Graph colorMode={colorMode} onNodeClick={() => {}} />
            </Grid>
            <Grid
              sx={{
                borderWidth: '2px',
                borderStyle: 'solid',
                borderColor: '#000',
                flex: 1,
                padding: '20px',
              }}
            >
              <TransactionTable />
            </Grid>
          </Grid>
          <Grid sx={{ padding: '20px' }}>
            <TransactionDetails />
          </Grid>
        </Grid>

        {/* Footer Banner */}
        <Grid
          container
          sx={{
            backgroundColor: '#1d6e6b',
            color: '#fff',
            padding: '8px 0',
            textAlign: 'center',
            letterSpacing: '1px',
            marginTop: 'auto',
            fontSize: '12px',
            justifyContent: 'center',
          }}
        >
          Developer Code Challenge v1.0
        </Grid>
      </div>
    </ThemeProvider>
  );
}

export default App;
