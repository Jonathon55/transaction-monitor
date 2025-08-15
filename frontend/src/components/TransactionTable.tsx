import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TableSortLabel,
} from "@mui/material";
import { getSocket } from "../services/socket";

type Business = {
  business_id: string;
  name: string;
  industry: string;
  totalTransactions?: number;
};

type GraphNode = {
  id: string;
  label: string;
  industry?: string;
};

const TransactionTable = () => {
  const [businessData, setBusinessData] = useState<Business[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [newBusiness, setNewBusiness] = useState<Business | null>(null);


  // Sorting State - default to transaction count descending
  const [sortBy, setSortBy] = useState<"name" | "industry" | "totalTransactions">("totalTransactions");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Function to fetch business data and transaction counts
  const fetchBusinessData = async (isInitialLoad = false) => {
    try {
      // Only show loading indicator on initial load
      if (isInitialLoad) {
        setLoading(true);
      }
      // Fetch businesses
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/businesses`);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const result = await response.json();
      const businesses = result.data || [];
      
      // Fetch transaction counts for each business
      const countsMap: {[key: string]: number} = {};
      for (const business of businesses) {
        try {
          const countResponse = await fetch(
            `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/businesses/${business.business_id}/transaction-count`
          );
          if (countResponse.ok) {
            const countData = await countResponse.json();
            countsMap[business.business_id] = countData.transactionCount || 0;
          }
        } catch (err) {
          console.error(`Failed to fetch transaction count for ${business.name}:`, err);
        }
      }
      
      // Combine business data with transaction counts
      const enrichedBusinesses = businesses.map((business: Business) => ({
        ...business,
        totalTransactions: countsMap[business.business_id] || 0
      }));
      
      setBusinessData(enrichedBusinesses);
      return true;
    } catch (err: unknown) {
      setError((err as Error).message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Fetch initial business data
  useEffect(() => {
    fetchBusinessData(true); // Pass true for initial load
  }, []);

  // WebSocket connection for live updates
  useEffect(() => {
    // Get the shared socket instance
    const socket = getSocket();

    // Function to find business ID from either direct ID or node data
    const getBusinessId = (idOrObj: any): string | null => {
      if (typeof idOrObj === 'string') return idOrObj;
      if (idOrObj && idOrObj.id) return idOrObj.id;
      return null;
    };

    // Define event handlers
    const handleGraphUpdate = async (data: { 
      nodes?: GraphNode[], 
      newTransaction?: { 
        from: string | { id: string }, 
        to: string | { id: string },
        amount: number,
        timestamp: string
      } 
    }) => {
      if (data && data.newTransaction) {
        const transaction = data.newTransaction;
        
        // Extract business IDs
        const fromId = getBusinessId(transaction.from);
        const toId = getBusinessId(transaction.to);

        if (!fromId) {
          console.error("Could not determine source business ID from transaction", transaction);
          return;
        }

        console.log(`New transaction from ${fromId} to ${toId || 'unknown'} for ${transaction.amount}`);
        
        // Node data is available but not currently used
        // Could be used in future for additional enrichment
        
        // Update business data with new counts
        setBusinessData(prevBusinessData => {
          const updatedBusinessData = prevBusinessData.map(business => {
            // Increment count for the "from" business
            if (business.business_id === fromId) {
              // Mark this business as updated for highlighting
              setNewBusiness(business);
              setTimeout(() => setNewBusiness(null), 3000);
              
              return {
                ...business,
                totalTransactions: (business.totalTransactions || 0) + 1
              };
            }
            // Also increment count for the "to" business
            if (toId && business.business_id === toId) {
              return {
                ...business,
                totalTransactions: (business.totalTransactions || 0) + 1
              };
            }
            return business;
          });
          
          return updatedBusinessData;
        });
      }
    };

    const handleInitialData = (data: { nodes?: GraphNode[] }) => {
      if (data && data.nodes && Array.isArray(data.nodes)) {
        console.log("Received initialData with", data.nodes.length, "nodes");
      }
    };

    // Register event listeners
    socket.on('graphUpdate', handleGraphUpdate);
    socket.on('initialData', handleInitialData);

    // Cleanup: remove event listeners on unmount
    return () => {
      socket.off('graphUpdate', handleGraphUpdate);
      socket.off('initialData', handleInitialData);
    };
  }, []);



  // Handle sorting
  const handleSort = (property: "name" | "industry" | "totalTransactions") => {
    const isAsc = sortBy === property && sortDirection === "asc";
    setSortDirection(isAsc ? "desc" : "asc");
    setSortBy(property);
  };

  // Apply sorting
  const sortedData = [...businessData].sort((a, b) => {
    const valueA = a[sortBy];
    const valueB = b[sortBy];

    if (typeof valueA === "number" && typeof valueB === "number") {
      return sortDirection === "asc" ? valueA - valueB : valueB - valueA;
    }

    if (typeof valueA === "string" && typeof valueB === "string") {
      return sortDirection === "asc"
        ? valueA.localeCompare(valueB)
        : valueB.localeCompare(valueA);
    }

    return 0;
  });


  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <div style={{ position: "relative" }}>
      {/* Table Section */}
      <TableContainer component={Paper}>
        <Table aria-label="Transaction Summary Table">
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel
                  active={sortBy === "name"}
                  direction={sortDirection}
                  onClick={() => handleSort("name")}
                >
                  <b>Business</b>
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortBy === "industry"}
                  direction={sortDirection}
                  onClick={() => handleSort("industry")}
                >
                  <b>Industry</b>
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">
                <TableSortLabel
                  active={sortBy === "totalTransactions"}
                  direction={sortDirection}
                  onClick={() => handleSort("totalTransactions")}
                  sx={{ '& .MuiTableSortLabel-icon': { opacity: 1 } }}
                >
                  <b>Total Transactions</b>
                </TableSortLabel>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedData.map((row, index) => {
              // Check if this is the updated business that was just involved in a transaction
              const isUpdatedBusiness = newBusiness && newBusiness.business_id === row.business_id;
                
              return (
                <TableRow 
                  key={row.business_id || index}
                  className={isUpdatedBusiness ? 'new-transaction-row' : ''}
                  sx={isUpdatedBusiness ? { 
                    backgroundColor: 'rgba(0, 191, 255, 0.1)',
                    transition: 'background-color 3s ease-out'
                  } : {}}
                >
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.industry}</TableCell>
                  <TableCell align="right">{row.totalTransactions}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

    </div>
  );
};

export default TransactionTable;