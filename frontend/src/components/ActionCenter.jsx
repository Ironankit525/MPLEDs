export default function ActionCenter({ items = [] }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
      <h3 className="text-lg font-semibold mb-3">Action Required</h3>
      <ul className="space-y-2">
        {items.map((item, index) => (
          <li key={item.id || index} className="p-3 bg-amber-50 border-l-4 border-amber-500 rounded text-sm">
            {item.message || item.title || JSON.stringify(item)}
          </li>
        ))}
      </ul>
    </div>
  );
}