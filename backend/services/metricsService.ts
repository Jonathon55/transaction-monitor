import { Alert, MetricsRollup, Transaction } from '../types';

let totalTransactions = 0;
let totalAmount = 0;
let alertHigh = 0;
let alertMedium = 0;
let alertLow = 0;

export function record(transaction: Transaction, alerts?: Alert[]): void {
  totalTransactions += 1;
  totalAmount += transaction.amount;
  if (alerts?.length) {
    for (const a of alerts) {
      if (a.severity === 'high') alertHigh += 1;
      else if (a.severity === 'medium') alertMedium += 1;
      else alertLow += 1;
    }
  }
}

export function getRollup(): MetricsRollup {
  return {
    totalTransactions,
    totalAmount,
    alerts: {
      total: alertHigh + alertMedium + alertLow,
      high: alertHigh,
      medium: alertMedium,
      low: alertLow,
    },
    generatedAt: new Date().toISOString(),
  };
}
