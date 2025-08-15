export interface Transaction {
  from: string;
  to: string;
  amount: number;
  timestamp: string;
}

export interface GraphNode {
  id: string;
  label?: string;
  industry?: string | null;
}

export interface GraphEdge {
  id: number;
  source: string;
  target: string;
  transactionCount: number;
  transactionAmount: number;
}

export interface Business {
  business_id: string;
  name: string;
  industry: string;
}

export interface GraphUpdatePayload {
  nodes: GraphNode[];
  edges: GraphEdge[];
  newTransaction?: Transaction;
}

export interface BusinessDetailsResult {
  nameMap: Record<string, string>;
  industryMap: Record<string, string>;
}

export interface CreateTransactionDto {
  from: string;
  to: string;
  amount: number;
  timestamp: string;
}

export interface CreateBusinessDto {
  name: string;
  industry: string;
}