import { Taxi } from "@workspace/api-client-react";
import { cn, formatCurrency } from "@/lib/utils";

interface TaxiTableProps {
  taxis: Taxi[];
}

export function TaxiTable({ taxis }: TaxiTableProps) {
  const getStatusBadge = (status: Taxi['status']) => {
    switch (status) {
      case 'carrying_passenger':
        return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Carrying</span>;
      case 'moving_to_pickup':
        return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">En Route</span>;
      case 'idle':
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">Idle</span>;
    }
  };

  return (
    <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden flex flex-col">
      <div className="p-5 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold text-lg tracking-tight">Active Fleet</h3>
        <span className="text-sm text-muted-foreground font-mono">{taxis.length} Vehicles</span>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-secondary/30 text-muted-foreground uppercase tracking-wider text-[11px] font-semibold">
            <tr>
              <th className="px-6 py-4 border-b border-border">Taxi ID</th>
              <th className="px-6 py-4 border-b border-border">Location</th>
              <th className="px-6 py-4 border-b border-border">Status</th>
              <th className="px-6 py-4 border-b border-border text-right">Trips</th>
              <th className="px-6 py-4 border-b border-border text-right">Revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {taxis.map((taxi) => (
              <tr key={taxi.id} className="hover:bg-secondary/20 transition-colors">
                <td className="px-6 py-4 font-mono text-foreground font-medium">
                  {taxi.id}
                </td>
                <td className="px-6 py-4 text-muted-foreground font-mono">
                  [{taxi.row}, {taxi.col}]
                </td>
                <td className="px-6 py-4">
                  {getStatusBadge(taxi.status)}
                </td>
                <td className="px-6 py-4 text-right font-mono text-foreground">
                  {taxi.tripsCompleted}
                </td>
                <td className="px-6 py-4 text-right font-mono text-primary font-semibold">
                  {formatCurrency(taxi.revenue)}
                </td>
              </tr>
            ))}
            {taxis.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                  No taxis available in the fleet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
