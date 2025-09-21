import { useState } from 'react'

interface EmpireMetrics {
  monthlyRevenue: number
  leadsPerHour: number
  conversionRate: number
  mlAccuracy: number
  automationLevel: number
  activeMarkets: number
  partnerships: number
  revenueStreams: RevenueStream[]
  geographicMarkets: GeographicMarket[]
}

interface RevenueStream {
  name: string
  monthlyRevenue: number
  growthRate: number
  status: 'active' | 'launching' | 'optimizing'
}

interface GeographicMarket {
  market: string
  leads: number
  revenue: number
  conversionRate: number
  status: 'operational' | 'expanding' | 'optimizing'
}

export default function EmpireDashboard() {
  const [metrics] = useState<EmpireMetrics>({
    monthlyRevenue: 1150000,
    leadsPerHour: 1042,
    conversionRate: 22.5,
    mlAccuracy: 87.3,
    automationLevel: 78,
    activeMarkets: 25,
    partnerships: 3,
    revenueStreams: [
      { name: 'Lead Licensing', monthlyRevenue: 125000, growthRate: 15.2, status: 'active' },
      { name: 'Technology Licensing', monthlyRevenue: 185000, growthRate: 23.1, status: 'active' },
      { name: 'AI Consulting', monthlyRevenue: 95000, growthRate: 12.8, status: 'active' },
      { name: 'SaaS Platform', monthlyRevenue: 155000, growthRate: 28.5, status: 'active' },
      { name: 'Education Program', monthlyRevenue: 65000, growthRate: 18.7, status: 'launching' },
      { name: 'White-Label Solutions', monthlyRevenue: 220000, growthRate: 31.2, status: 'optimizing' },
      { name: 'Investment Partnerships', monthlyRevenue: 180000, growthRate: 25.9, status: 'active' },
      { name: 'Market Intelligence', monthlyRevenue: 125000, growthRate: 20.3, status: 'active' }
    ],
    geographicMarkets: [
      { market: 'Atlanta, GA', leads: 4200, revenue: 68000, conversionRate: 24.1, status: 'operational' },
      { market: 'Phoenix, AZ', leads: 3800, revenue: 62000, conversionRate: 22.8, status: 'operational' },
      { market: 'Charlotte, NC', leads: 3600, revenue: 59000, conversionRate: 23.5, status: 'operational' },
      { market: 'Tampa, FL', leads: 4100, revenue: 67000, conversionRate: 25.2, status: 'expanding' },
      { market: 'Nashville, TN', leads: 3500, revenue: 57000, conversionRate: 21.9, status: 'operational' }
    ]
  })

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

  const formatNumber = (num: number) => 
    new Intl.NumberFormat('en-US').format(num)

  return (
    <div className="space-y-6">
      {/* Empire Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
  <h1 className="text-3xl font-bold mb-2">🏆 Convexa AI Empire Control Center</h1>
        <p className="text-blue-100">Phase 3 Empire Scaling - Real Estate Intelligence Automation</p>
      </div>

      {/* Core Empire Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">Monthly Revenue</p>
              <p className="text-2xl font-bold text-green-900">{formatCurrency(metrics.monthlyRevenue)}</p>
              <p className="text-xs text-green-600">🚀 Target: $2M+</p>
            </div>
            <div className="text-3xl">💰</div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Leads/Hour</p>
              <p className="text-2xl font-bold text-blue-900">{formatNumber(metrics.leadsPerHour)}</p>
              <p className="text-xs text-blue-600">🎯 Target: 100K/month</p>
            </div>
            <div className="text-3xl">⚡</div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600">ML Accuracy</p>
              <p className="text-2xl font-bold text-purple-900">{metrics.mlAccuracy}%</p>
              <p className="text-xs text-purple-600">🧠 AI-Powered Intelligence</p>
            </div>
            <div className="text-3xl">🤖</div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-600">Active Markets</p>
              <p className="text-2xl font-bold text-orange-900">{metrics.activeMarkets}</p>
              <p className="text-xs text-orange-600">🗺️ National Expansion</p>
            </div>
            <div className="text-3xl">🌎</div>
          </div>
        </div>
      </div>

      {/* Revenue Diversification Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">💰 Revenue Stream Management</h3>
            <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
              8 Active Streams
            </span>
          </div>
          <div className="space-y-3">
            {metrics.revenueStreams.map((stream, index) => (
              <div key={index} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-gray-900">{stream.name}</span>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    stream.status === 'active' ? 'bg-green-100 text-green-800' :
                    stream.status === 'launching' ? 'bg-blue-100 text-blue-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {stream.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{formatCurrency(stream.monthlyRevenue)}/month</span>
                  <span className="text-green-600 font-medium">+{stream.growthRate}% growth</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Geographic Expansion Control */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">🗺️ Geographic Market Control</h3>
            <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
              Top 5 Markets
            </span>
          </div>
          <div className="space-y-3">
            {metrics.geographicMarkets.map((market, index) => (
              <div key={index} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-gray-900">{market.market}</span>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    market.status === 'operational' ? 'bg-green-100 text-green-800' :
                    market.status === 'expanding' ? 'bg-blue-100 text-blue-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {market.status}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
                  <span>{formatNumber(market.leads)} leads</span>
                  <span>{formatCurrency(market.revenue)}</span>
                  <span>{market.conversionRate}% conv.</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Empire Operations Control Panel */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">🎮 Empire Operations Control</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button className="p-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-colors">
            <div className="text-2xl mb-2">🚀</div>
            <div className="font-medium">Launch Phase 3</div>
            <div className="text-xs opacity-90">Complete Empire Scaling</div>
          </button>
          
          <button className="p-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-colors">
            <div className="text-2xl mb-2">📊</div>
            <div className="font-medium">Analytics Dashboard</div>
            <div className="text-xs opacity-90">Real-time Insights</div>
          </button>
          
          <button className="p-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 transition-colors">
            <div className="text-2xl mb-2">🤖</div>
            <div className="font-medium">ML Optimization</div>
            <div className="text-xs opacity-90">AI Enhancement</div>
          </button>
          
          <button className="p-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition-colors">
            <div className="text-2xl mb-2">🤝</div>
            <div className="font-medium">Partnerships</div>
            <div className="text-xs opacity-90">Strategic Alliances</div>
          </button>
        </div>
      </div>

      {/* Real-time Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <h4 className="font-medium text-gray-900 mb-3">⚡ Automation Level</h4>
          <div className="flex items-center">
            <div className="flex-1 bg-gray-200 rounded-full h-2 mr-3">
              <div 
                className="bg-blue-600 h-2 rounded-full" 
                style={{ width: `${metrics.automationLevel}%` }}
              ></div>
            </div>
            <span className="text-sm font-medium text-gray-900">{metrics.automationLevel}%</span>
          </div>
        </div>

        <div className="card">
          <h4 className="font-medium text-gray-900 mb-3">🎯 Conversion Rate</h4>
          <div className="flex items-center">
            <div className="flex-1 bg-gray-200 rounded-full h-2 mr-3">
              <div 
                className="bg-green-600 h-2 rounded-full" 
                style={{ width: `${metrics.conversionRate}%` }}
              ></div>
            </div>
            <span className="text-sm font-medium text-gray-900">{metrics.conversionRate}%</span>
          </div>
        </div>

        <div className="card">
          <h4 className="font-medium text-gray-900 mb-3">🤝 Active Partnerships</h4>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600">{metrics.partnerships}</div>
            <div className="text-sm text-gray-600">Strategic Alliances</div>
          </div>
        </div>
      </div>
    </div>
  )
}
