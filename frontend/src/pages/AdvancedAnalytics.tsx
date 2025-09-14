import { useState } from 'react'
import DashboardMetrics from '../components/analytics/DashboardMetrics'
import CallInsightsPanel from '../components/analytics/CallInsightsPanel'

interface MLInsight {
  type: string
  insight: string
  confidence: number
  impact: string
  recommendation: string
}

interface MarketAnalysis {
  market: string
  opportunityScore: number
  leadVolume: number
  competition: string
  recommendation: string
}

export default function AdvancedAnalytics() {
  const [mlInsights] = useState<MLInsight[]>([
    {
      type: 'Revenue Optimization',
      insight: 'Lead Licensing program showing 23% higher conversion in Q4',
      confidence: 94.2,
      impact: 'High',
      recommendation: 'Increase lead licensing capacity by 40%'
    },
    {
      type: 'Geographic Expansion',
      insight: 'Austin, TX market showing 31% above-average performance metrics',
      confidence: 87.8,
      impact: 'Medium',
      recommendation: 'Accelerate Phase 2 expansion in Texas markets'
    },
    {
      type: 'Partnership Opportunity',
      insight: 'PropTech integration showing 2.3x revenue multiplier potential',
      confidence: 91.5,
      impact: 'High',
      recommendation: 'Prioritize white-label platform partnerships'
    }
  ])

  const [marketAnalysis] = useState<MarketAnalysis[]>([
    { market: 'Atlanta, GA', opportunityScore: 92, leadVolume: 4200, competition: 'Medium', recommendation: 'Maintain current operations' },
    { market: 'Denver, CO', opportunityScore: 88, leadVolume: 3800, competition: 'Low', recommendation: 'Increase market investment' },
    { market: 'Miami, FL', opportunityScore: 95, leadVolume: 5100, competition: 'High', recommendation: 'Focus on differentiation' },
    { market: 'Seattle, WA', opportunityScore: 85, leadVolume: 3200, competition: 'Medium', recommendation: 'Optimize conversion rates' },
    { market: 'Austin, TX', opportunityScore: 94, leadVolume: 4600, competition: 'Low', recommendation: 'Accelerate expansion' }
  ])

  const revenueMetrics = {
    totalMonthlyRevenue: 1150000,
    yearOverYear: 285.7,
    streamBreakdown: [
      { name: 'Lead Licensing', amount: 125000, percentage: 10.9 },
      { name: 'Technology Licensing', amount: 185000, percentage: 16.1 },
      { name: 'AI Consulting', amount: 95000, percentage: 8.3 },
      { name: 'SaaS Platform', amount: 155000, percentage: 13.5 },
      { name: 'Education Program', amount: 65000, percentage: 5.7 },
      { name: 'White-Label Solutions', amount: 220000, percentage: 19.1 },
      { name: 'Investment Partnerships', amount: 180000, percentage: 15.7 },
      { name: 'Market Intelligence', amount: 125000, percentage: 10.9 }
    ]
  }

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

  const formatNumber = (num: number) => 
    new Intl.NumberFormat('en-US').format(num)

  return (
    <div className="space-y-6">
      {/* Advanced Analytics Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">🧠 Advanced AI Analytics & Insights</h1>
        <p className="text-purple-100">Machine Learning-Powered Empire Intelligence</p>
      </div>

      {/* ML Insights Dashboard */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">🤖 Machine Learning Insights</h2>
          <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
            87.3% Accuracy
          </span>
        </div>
        <div className="space-y-4">
          {mlInsights.map((insight, index) => (
            <div key={index} className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center mb-1">
                    <span className="font-semibold text-gray-900">{insight.type}</span>
                    <span className={`ml-3 px-2 py-1 text-xs font-medium rounded-full ${
                      insight.impact === 'High' ? 'bg-red-100 text-red-800' :
                      insight.impact === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {insight.impact} Impact
                    </span>
                  </div>
                  <p className="text-gray-700 mb-2">{insight.insight}</p>
                  <p className="text-sm text-blue-600 font-medium">💡 {insight.recommendation}</p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">Confidence</div>
                  <div className="text-lg font-bold text-blue-600">{insight.confidence}%</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

  {/* Revenue Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">💰 Revenue Stream Analysis</h3>
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Total Monthly Revenue</span>
              <span className="text-xl font-bold text-green-600">{formatCurrency(revenueMetrics.totalMonthlyRevenue)}</span>
            </div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-600">Year-over-Year Growth</span>
              <span className="text-lg font-bold text-blue-600">+{revenueMetrics.yearOverYear}%</span>
            </div>
          </div>
          <div className="space-y-3">
            {revenueMetrics.streamBreakdown.map((stream, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900">{stream.name}</span>
                    <span className="text-sm text-gray-600">{formatCurrency(stream.amount)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${stream.percentage}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Market Intelligence */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">🗺️ Market Intelligence Analysis</h3>
          <div className="space-y-4">
            {marketAnalysis.map((market, index) => (
              <div key={index} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">{market.market}</span>
                  <span className="text-lg font-bold text-purple-600">{market.opportunityScore}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-2">
                  <span>Leads: {formatNumber(market.leadVolume)}</span>
                  <span>Competition: {market.competition}</span>
                </div>
                <p className="text-xs text-blue-600 font-medium">💡 {market.recommendation}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live Metrics */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Live Backend Metrics</h3>
        <div className="grid gap-6 md:grid-cols-2">
          <DashboardMetrics />
          <CallInsightsPanel />
        </div>
      </div>

      {/* Performance Forecasting */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">📈 AI Performance Forecasting</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="text-2xl mb-2">📊</div>
            <div className="text-lg font-bold text-green-600">Q1 2025 Projection</div>
            <div className="text-sm text-gray-600">Revenue Target</div>
            <div className="text-xl font-bold text-gray-900">{formatCurrency(1850000)}</div>
            <div className="text-xs text-green-600">+60% growth projected</div>
          </div>
          
          <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-2xl mb-2">🎯</div>
            <div className="text-lg font-bold text-blue-600">Lead Volume Target</div>
            <div className="text-sm text-gray-600">Monthly Capacity</div>
            <div className="text-xl font-bold text-gray-900">125,000</div>
            <div className="text-xs text-blue-600">25% above current</div>
          </div>
          
          <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
            <div className="text-2xl mb-2">🌎</div>
            <div className="text-lg font-bold text-purple-600">Market Expansion</div>
            <div className="text-sm text-gray-600">Target Markets</div>
            <div className="text-xl font-bold text-gray-900">50 Cities</div>
            <div className="text-xs text-purple-600">100% expansion rate</div>
          </div>
        </div>
      </div>

      {/* AI Optimization Recommendations */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">🎯 AI Optimization Recommendations</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="flex items-center mb-2">
              <div className="text-xl mr-2">⚡</div>
              <span className="font-medium text-gray-900">Automation Enhancement</span>
            </div>
            <p className="text-sm text-gray-700 mb-2">
              Increase automation level from 78% to 95% by optimizing manual touchpoints
            </p>
            <span className="text-xs text-yellow-600 font-medium">Expected ROI: +$180k/month</span>
          </div>
          
          <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
            <div className="flex items-center mb-2">
              <div className="text-xl mr-2">🧠</div>
              <span className="font-medium text-gray-900">ML Model Improvement</span>
            </div>
            <p className="text-sm text-gray-700 mb-2">
              Deploy advanced neural networks to improve accuracy from 87.3% to 92%+
            </p>
            <span className="text-xs text-orange-600 font-medium">Expected ROI: +$220k/month</span>
          </div>
        </div>
      </div>
    </div>
  )
}
