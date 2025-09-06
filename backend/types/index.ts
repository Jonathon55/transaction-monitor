export interface Transaction {
  from: string;
  to: string;
  amount: number;
  timestamp: string;
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
  alerts?: Alert[];
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

export type AlertType =
  | 'HIGH_VALUE'
  | 'BURST'
  | 'FIRST_TIME_LINK'
  | 'SELF_LOOP';
export type AlertSeverity = 'low' | 'medium' | 'high';

export interface Alert {
  id?: number; // SQLite row id (assigned on insert)
  type: AlertType;
  severity: AlertSeverity;
  from: string; // business_id
  to: string; // business_id
  amount: number;
  timestamp: string;
}

export interface RiskComponents {
  volumeComponent: number; // 0..1
  degreeComponent: number; // 0..1
  alertsComponent: number; // 0..1
}

export type BusinessId = string;

export interface NodeStats {
  outVolume: number;
  inVolume: number;
  degreeOut: Set<BusinessId>;
  degreeIn: Set<BusinessId>;
  alertTimestamps: number[];
  riskScore: number;
  lastComponents?: RiskComponents;
}

export interface RiskBreakdown {
  components: {
    volume: number; // 0..1 t
    degree: number; // 0..1
    alerts: number; // 0..1
  };
  weights: {
    volume: number; // e.g., 0.4
    degree: number; // e.g., 0.3
    alerts: number; // e.g., 0.3
  };
  weightedScore: number; // 0..1 (riskScore/100)
}

export interface GraphNode {
  id: string;
  label?: string;
  industry?: string | null;

  riskScore?: number;
  alertsCount?: number;
  communityId?: string;
  riskBreakdown?: RiskBreakdown;
}

export interface MetricsRollup {
  totalTransactions: number;
  totalAmount: number;
  alerts: {
    total: number;
    high: number;
    medium: number;
    low: number;
  };
  generatedAt: string; // ISO
}

export interface GraphUpdatePayload {
  nodes: GraphNode[];
  edges: GraphEdge[];
  newTransaction?: Transaction;
  alerts?: Alert[];
  metrics?: MetricsRollup;
}
