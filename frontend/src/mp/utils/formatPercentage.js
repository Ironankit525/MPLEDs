/**
 * Formats a number to percentage string e.g. "82.5%"
 */
export const formatPercentage = (value, decimals = 1) => {
  if (value === undefined || value === null || isNaN(value)) {
    return '0%';
  }
  return `${Number(value).toFixed(decimals)}%`;
};
