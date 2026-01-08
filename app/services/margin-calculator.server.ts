export interface MarginData {
    sellingPrice: number;
    costPerUnit: number;
    shippingCost: number;
    paymentFeePercentage: number;
}

export interface MarginResult {
    currentMarginAmount: number;
    currentMarginPercentage: number;
}

export function calculateMargin(data: MarginData): MarginResult {
    const { sellingPrice, costPerUnit, shippingCost, paymentFeePercentage } = data;

    const paymentFees = (sellingPrice * paymentFeePercentage) / 100;
    const totalCost = costPerUnit + shippingCost + paymentFees;

    const marginAmount = sellingPrice - totalCost;
    const marginPercentage = sellingPrice > 0 ? (marginAmount / sellingPrice) * 100 : 0;

    return {
        currentMarginAmount: parseFloat(marginAmount.toFixed(2)),
        currentMarginPercentage: parseFloat(marginPercentage.toFixed(2))
    };
}

export function isMarginAtRisk(currentMargin: number, threshold: number): boolean {
    return currentMargin < threshold;
}
