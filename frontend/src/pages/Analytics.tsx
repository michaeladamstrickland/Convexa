export default function Analytics() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Lead Performance</h2>
          <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
            <p className="text-gray-500">Chart placeholder - Connect to analytics service</p>
          </div>
        </div>
        
        <div className="card">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Key Metrics</h2>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-600">Conversion Rate</span>
              <span className="font-semibold">12.5%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Avg Response Time</span>
              <span className="font-semibold">2.3 hours</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Deal Close Rate</span>
              <span className="font-semibold">8.7%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">ROI</span>
              <span className="font-semibold text-green-600">245%</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="card">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h2>
        <div className="space-y-3">
          {[
            { action: 'Lead scored by AI', time: '5 minutes ago', type: 'ai' },
            { action: 'New lead from Zillow scraper', time: '12 minutes ago', type: 'scraper' },
            { action: 'Skip trace completed', time: '1 hour ago', type: 'trace' },
            { action: 'Call script generated', time: '2 hours ago', type: 'ai' },
          ].map((activity, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-3 ${
                  activity.type === 'ai' ? 'bg-blue-500' :
                  activity.type === 'scraper' ? 'bg-green-500' :
                  'bg-purple-500'
                }`} />
                <span className="text-gray-900">{activity.action}</span>
              </div>
              <span className="text-sm text-gray-500">{activity.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
