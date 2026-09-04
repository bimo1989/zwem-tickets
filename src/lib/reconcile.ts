// Matches open bank-transfer orders against rows from an uploaded bank
// statement export. Real-world transfers don't always use the exact
// suggested mededeling (people often just type their own name + "zwemmen"),
// so this matches on amount + fuzzy name/remittance overlap rather than
// requiring an exact string match.

export type BankStatementRow = {
  amountCents: number;
  counterpartyName: string;
  communication: string;
  date: string | null;
};

export type OrderForMatching = {
  id: string;
  amountCents: number;
  buyerName: string;
  remittance: string;
};

export type ReconcileMatch = {
  orderId: string;
  confidence: "sterk" | "zwak";
  bankRow: BankStatementRow;
};

function normalize(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchOrdersToStatement(
  orders: OrderForMatching[],
  rows: BankStatementRow[]
): { matches: ReconcileMatch[]; unmatchedOrderIds: string[] } {
  type Candidate = {
    orderIdx: number;
    rowIdx: number;
    score: number;
    confidence: "sterk" | "zwak";
  };
  const candidates: Candidate[] = [];

  orders.forEach((order, orderIdx) => {
    const remittanceNorm = normalize(order.remittance);
    const buyerWords = normalize(order.buyerName)
      .split(" ")
      .filter((w) => w.length > 1);

    rows.forEach((row, rowIdx) => {
      if (row.amountCents !== order.amountCents) return;

      const commNorm = normalize(row.communication);
      const nameNorm = normalize(row.counterpartyName);
      const haystack = `${commNorm} ${nameNorm}`;

      const remittanceHit = remittanceNorm.length > 3 && haystack.includes(remittanceNorm);

      const nameHits = buyerWords.filter((w) => haystack.includes(w)).length;
      const nameScore = buyerWords.length > 0 ? nameHits / buyerWords.length : 0;

      let confidence: "sterk" | "zwak" | null = null;
      let score = 0;
      if (remittanceHit) {
        confidence = "sterk";
        score = 2 + nameScore;
      } else if (nameScore >= 0.5) {
        confidence = "sterk";
        score = 1 + nameScore;
      } else if (nameScore > 0) {
        confidence = "zwak";
        score = nameScore;
      }

      if (confidence) {
        candidates.push({ orderIdx, rowIdx, score, confidence });
      }
    });
  });

  // Greedily assign the best-scoring candidates first, so a bank row can't
  // be claimed by two orders and one strong match doesn't get starved by a
  // weaker one processed earlier.
  candidates.sort((a, b) => b.score - a.score);

  const claimedOrders = new Set<number>();
  const claimedRows = new Set<number>();
  const matches: ReconcileMatch[] = [];

  for (const c of candidates) {
    if (claimedOrders.has(c.orderIdx) || claimedRows.has(c.rowIdx)) continue;
    claimedOrders.add(c.orderIdx);
    claimedRows.add(c.rowIdx);
    matches.push({
      orderId: orders[c.orderIdx].id,
      confidence: c.confidence,
      bankRow: rows[c.rowIdx],
    });
  }

  const unmatchedOrderIds = orders
    .filter((_, idx) => !claimedOrders.has(idx))
    .map((o) => o.id);

  return { matches, unmatchedOrderIds };
}
