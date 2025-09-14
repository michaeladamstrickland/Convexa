import { SkipTraceDashboardWidget } from "../../components";

export function DashboardPage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>
      
      <div className="grid gap-6 md:grid-cols-2">
        {/* Skip Trace Metrics */}
        <SkipTraceDashboardWidget />
        
        {/* Other Dashboard Widgets */}
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-base font-semibold">Recent Activity</h3>
          <p className="text-gray-500">Activity feed coming soon</p>
        </div>
        
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-base font-semibold">Lead Sources</h3>
          <p className="text-gray-500">Lead source metrics coming soon</p>
        </div>
        
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-base font-semibold">Deal Pipeline</h3>
          <p className="text-gray-500">Deal pipeline metrics coming soon</p>
        </div>
      </div>
    </div>
  );
}
