import { useEffect, useRef, useState } from 'react';
import {
  Box,
  IconButton,
  InputAdornment,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { getSocket } from '../../services/socket';
import './TransactionDetails.css';
import { useBusinessDirectory } from '../../hooks/useBusinessDirectory';

type Transaction = {
  from: string;
  to: string;
  amount: number;
  timestamp: string;
};

type SortKey = keyof Transaction;

const MAX_ROWS = 250; // keep memory/UI stable

const TransactionDetailsTable = () => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  const [transactionsData, setData] = useState<Transaction[]>([]);
  const [filteredData, setFilteredData] = useState<Transaction[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [newTransaction, setNewTransaction] = useState<Transaction | null>(
    null
  );

  const [sortBy, setSortBy] = useState<SortKey>('timestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Keep the latest search query accessible inside socket handlers without re-subscribing
  const searchQueryRef = useRef<string>(searchQuery);
  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);

  // Clear highlight timeout on unmount to avoid sticking
  const highlightTimeoutRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current !== null) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  // directory for ID -> Name lookups (HTTP once + keeps fresh via sockets) */
  const { lookup } = useBusinessDirectory();

  // Initial data fetch
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const apiUrl =
          (() => {
            try {
              const m: any = (0, eval)('import.meta');
              return m?.env?.VITE_API_URL;
            } catch {
              return process.env.VITE_API_URL;
            }
          })() || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/businesses/transactions`);
        if (!response.ok)
          throw new Error(`HTTP error! Status: ${response.status}`);
        const result = await response.json();
        const initial: Transaction[] = result?.data ?? [];
        setData(initial.slice(0, MAX_ROWS));
        setFilteredData(initial.slice(0, MAX_ROWS));
      } catch (err: unknown) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // WebSocket: subscribe once; clear on initialData; append on graphUpdate
  useEffect(() => {
    const socket = getSocket();

    const handleInitialData = () => {
      // Server restarted or snapshot resent: reset the panel for a clean demo state
      setData([]);
      setFilteredData([]);
      setNewTransaction(null);
    };

    const handleGraphUpdate = (payload: any) => {
      const transaction: Transaction | undefined = payload?.newTransaction;
      if (!transaction) return;

      // Add to master list (limit growth)
      setData((prev) => [transaction, ...prev].slice(0, MAX_ROWS));

      // Include in filtered list if it matches the current query
      const q = searchQueryRef.current.toLowerCase();

      /* NEW: allow search by either ID or *name* */
      const fromDisplay = lookup(transaction.from).toLowerCase();
      const toDisplay = lookup(transaction.to).toLowerCase();

      const matches =
        !q ||
        transaction.from.toLowerCase().includes(q) ||
        transaction.to.toLowerCase().includes(q) ||
        fromDisplay.includes(q) || // NEW: name match (from)
        toDisplay.includes(q) || // NEW: name match (to)
        transaction.timestamp.toLowerCase().includes(q) ||
        transaction.amount.toString().includes(q);

      if (matches) {
        setFilteredData((prev) => [transaction, ...prev].slice(0, MAX_ROWS));
      }

      // Flash highlight row
      setNewTransaction(transaction);
      if (highlightTimeoutRef.current !== null) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
      highlightTimeoutRef.current = window.setTimeout(() => {
        setNewTransaction(null);
        highlightTimeoutRef.current = null;
      }, 3000);
    };

    socket.on('initialData', handleInitialData);
    socket.on('graphUpdate', handleGraphUpdate);

    return () => {
      socket.off('initialData', handleInitialData);
      socket.off('graphUpdate', handleGraphUpdate);
    };
  }, [lookup]);

  // Search
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const query = (event.target.value ?? '').toLowerCase();
    setSearchQuery(query);

    if (!query) {
      setFilteredData(transactionsData);
      return;
    }

    const filtered = transactionsData.filter((tx) => {
      const fromName = lookup(tx.from).toLowerCase();
      const toName = lookup(tx.to).toLowerCase();

      return (
        tx.from.toLowerCase().includes(query) ||
        tx.to.toLowerCase().includes(query) ||
        fromName.includes(query) || // NEW: name match (from)
        toName.includes(query) || // NEW: name match (to)
        tx.timestamp.toLowerCase().includes(query) ||
        tx.amount.toString().includes(query)
      );
    });

    setFilteredData(filtered);
  };

  // Sorting
  const handleSort = (property: SortKey) => {
    const isAsc = sortBy === property && sortDirection === 'asc';
    setSortDirection(isAsc ? 'desc' : 'asc');
    setSortBy(property);
  };

  const sortedData = [...filteredData].sort((a, b) => {
    const valueA = a[sortBy];
    const valueB = b[sortBy];

    if (sortBy === 'timestamp') {
      const dateA = new Date(valueA as string).getTime();
      const dateB = new Date(valueB as string).getTime();
      return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
    }
    if (typeof valueA === 'number' && typeof valueB === 'number') {
      return sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
    }
    if (typeof valueA === 'string' && typeof valueB === 'string') {
      return sortDirection === 'asc'
        ? valueA.localeCompare(valueB)
        : valueB.localeCompare(valueA);
    }
    return 0;
  });

  const formatTimestamp = (timestamp: string) =>
    new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

  const formatAmount = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <div className={`td-panel ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Header */}
      <Box className="td-header">
        <Typography className="td-title">Transactions</Typography>
        <Tooltip title={isCollapsed ? 'Expand' : 'Collapse'} placement="right">
          <IconButton
            size="small"
            color="inherit"
            onClick={() => setIsCollapsed((v) => !v)}
            className="td-collapse-btn"
            aria-label={
              isCollapsed
                ? 'expand transactions panel'
                : 'collapse transactions panel'
            }
          >
            {isCollapsed ? <ChevronLeftIcon /> : <ChevronRightIcon />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Body (hidden when collapsed) */}
      <div className="td-body">
        {/* Search */}
        <div className="search-section">
          <TextField
            variant="outlined"
            size="small"
            placeholder="Search by From, To or Amount..."
            value={searchQuery}
            onChange={handleSearchChange}
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </div>

        {/* Table (scrolls internally; panel width stays stable) */}
        <TableContainer component={Paper} className="table-container">
          <Table
            aria-label="Detailed Transactions Table"
            size="small"
            className="transaction-table"
          >
            <TableHead>
              <TableRow>
                <TableCell>
                  <TableSortLabel
                    active={sortBy === 'timestamp'}
                    direction={sortDirection}
                    onClick={() => handleSort('timestamp')}
                    sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                  >
                    Time
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortBy === 'from'}
                    direction={sortDirection}
                    onClick={() => handleSort('from')}
                  >
                    From
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortBy === 'to'}
                    direction={sortDirection}
                    onClick={() => handleSort('to')}
                  >
                    To
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">
                  <TableSortLabel
                    active={sortBy === 'amount'}
                    direction={sortDirection}
                    onClick={() => handleSort('amount')}
                  >
                    Amount
                  </TableSortLabel>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedData.map((row, index) => {
                // Check if this is the new transaction that just came in
                const isNewTransaction =
                  newTransaction &&
                  row.from === newTransaction.from &&
                  row.to === newTransaction.to &&
                  row.amount === newTransaction.amount &&
                  row.timestamp === newTransaction.timestamp;

                return (
                  <TableRow
                    key={`${row.timestamp}-${row.from}-${row.to}-${index}`}
                    className={isNewTransaction ? 'new-transaction-row' : ''}
                  >
                    <TableCell>{formatTimestamp(row.timestamp)}</TableCell>
                    <TableCell>{lookup(row.from)}</TableCell>
                    <TableCell>{lookup(row.to)}</TableCell>
                    <TableCell align="right">
                      {formatAmount(row.amount)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </div>
    </div>
  );
};

export default TransactionDetailsTable;
