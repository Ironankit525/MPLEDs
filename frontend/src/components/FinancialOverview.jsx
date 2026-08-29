export default function FinancialOverview({ data, loading }) {
  if (loading) return <div className="p-4 bg-white rounded shadow-sm">Loading financial overview...</div>;
  
  return (
    <div className="p-4 bg-white rounded shadow-sm border">
      <h3 className="font-semibold text-lg mb-2">Financial Overview</h3>
      <p className="text-sm text-gray-600">Total Allocated: ₹{data?.total_allocated?.toLocaleString() || 0}</p>
    </div>
  );
}