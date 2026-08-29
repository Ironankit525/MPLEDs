/**
 * Formats a raw number into Indian Rupee (INR) currency representation.
 * Supports compact notation (Lakhs, Crores) or standard INR commas.
 */
export const formatCurrency = (amount, compact = false) => {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '₹0';
  }

  const num = Number(amount);

  if (compact) {
    if (Math.abs(num) >= 10000000) {
      return `₹${(num / 10000000).toFixed(2)} Cr`;
    }
    if (Math.abs(num) >= 100000) {
      return `₹${(num / 100000).toFixed(2)} Lakh`;
    }
  }

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num);
};
