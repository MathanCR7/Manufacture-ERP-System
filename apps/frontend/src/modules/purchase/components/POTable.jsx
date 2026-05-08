import { format } from 'date-fns';

const POTable = ({ data }) => {
  if (!data || data.length === 0) {
    return <div className="text-center py-8 text-slate-500">No Purchase Orders found.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700 text-sm uppercase text-slate-500 bg-slate-50 dark:bg-slate-800/50">
            <th className="py-3 px-4 font-medium">PO ID</th>
            <th className="py-3 px-4 font-medium">Supplier</th>
            <th className="py-3 px-4 font-medium">Raw Material</th>
            <th className="py-3 px-4 font-medium">Quantity</th>
            <th className="py-3 px-4 font-medium">Status</th>
            <th className="py-3 px-4 font-medium">Created At</th>
          </tr>
        </thead>
        <tbody>
          {data.map((po) => (
            <tr key={po.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
              <td className="py-3 px-4 font-medium text-indigo-600 dark:text-indigo-400">#{po.id}</td>
              <td className="py-3 px-4">{po.supplier}</td>
              <td className="py-3 px-4">{po.rawMaterial?.name} ({po.rmId})</td>
              <td className="py-3 px-4">{po.quantity}</td>
              <td className="py-3 px-4">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                  ${po.status === 'PENDING' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' : ''}
                  ${po.status === 'COMPLETED' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : ''}
                  ${po.status === 'PARTIAL' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' : ''}
                `}>
                  {po.status}
                </span>
              </td>
              <td className="py-3 px-4 text-slate-500 text-sm">
                {format(new Date(po.createdAt), 'MMM dd, yyyy')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default POTable;
