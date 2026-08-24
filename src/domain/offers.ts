export interface OfferInputs {
  askingPrice: number;
  conservativeFinishedValue: number;
  expectedRepairs: number;
  highRepairs: number;
  inspectionFee: number;
  transport: number;
  transactionCosts: number;
  targetAllInRatio: number;
  targetMargin: number;
}

export interface OfferResult {
  suggestedOffer: number;
  maximumPurchasePrice: number;
  expectedMarginAtAsking: number;
  expectedMarginAtOffer: number;
  worstCaseMarginAtAsking: number;
  worstCaseMarginAtOffer: number;
  expectedAllInAtAsking: number;
  expectedAllInAtOffer: number;
}

export function calculateOffer(input: OfferInputs): OfferResult {
  const nonPurchaseExpected = input.expectedRepairs + input.inspectionFee + input.transport + input.transactionCosts;
  const nonPurchaseHigh = input.highRepairs + input.inspectionFee + input.transport + input.transactionCosts;
  const maximumPurchasePrice = Math.max(0, input.conservativeFinishedValue * input.targetAllInRatio - nonPurchaseExpected);
  const suggestedOffer = Math.max(0, Math.min(input.askingPrice, maximumPurchasePrice - input.targetMargin));
  const margin = (price: number, costs: number) => input.conservativeFinishedValue - price - costs;
  return {
    suggestedOffer,
    maximumPurchasePrice,
    expectedMarginAtAsking: margin(input.askingPrice, nonPurchaseExpected),
    expectedMarginAtOffer: margin(suggestedOffer, nonPurchaseExpected),
    worstCaseMarginAtAsking: margin(input.askingPrice, nonPurchaseHigh),
    worstCaseMarginAtOffer: margin(suggestedOffer, nonPurchaseHigh),
    expectedAllInAtAsking: input.askingPrice + nonPurchaseExpected,
    expectedAllInAtOffer: suggestedOffer + nonPurchaseExpected,
  };
}
