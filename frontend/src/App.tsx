import { Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider } from './contexts/AuthContext'
import Dashboard from './pages/Dashboard'
import EmpireDashboard from './pages/EmpireDashboard'
import AdvancedAnalytics from './pages/AdvancedAnalytics'
import Leads from './pages/Leads'
import { LeadDetailPage } from './pages/leads/LeadDetailPage'
import Scraper from './pages/Scraper'
import Analytics from './pages/Analytics'
import Login from './pages/Login'
import ZipCodeLeadSearch from './components/ZipCodeLeadSearch'
import SearchPage from './pages/SearchPage'
import KanbanPage from './pages/KanbanPage'
import CostAnalytics from './pages/CostAnalytics'
import AttomLeadGeneratorPage from './pages/AttomLeadGeneratorPage'
import SkipTracePage from './pages/SkipTracePage'
import PropertySearchWorkspace from './pages/PropertySearchWorkspace'
import LeadManagementWorkspace from './pages/LeadManagementWorkspace'
import EnhancedPropertyDetailPage from './pages/EnhancedPropertyDetailPage'
import EnhancedPropertySearch from './pages/EnhancedPropertySearch'
import CallsPage from './pages/CallsPage'

function App() {
  return (
    <AuthProvider>
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            borderRadius: '8px',
            background: '#333',
            color: '#fff',
          },
        }}
      />
      <Routes>
        {/* Public route */}
        <Route path="/login" element={<Login />} />

        {/* Protected routes */}
        <Route element={<ProtectedRoute />}> 
          <Route element={<Layout />}>
            <Route path="/" element={<EmpireDashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/leads/:leadId" element={<LeadDetailPage />} />
            <Route path="/lead-management" element={<LeadManagementWorkspace />} />
            <Route path="/zip-search" element={<ZipCodeLeadSearch />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/property-search" element={<PropertySearchWorkspace />} />
            <Route path="/enhanced-search" element={<EnhancedPropertySearch />} />
            <Route path="/property/:attomId" element={<EnhancedPropertyDetailPage />} />
            <Route path="/scraper" element={<Scraper />} />
            <Route path="/kanban" element={<KanbanPage />} />
            <Route path="/skip-trace" element={<SkipTracePage />} />
            <Route path="/analytics" element={<AdvancedAnalytics />} />
            <Route path="/basic-analytics" element={<Analytics />} />
            <Route path="/cost-analytics" element={<CostAnalytics />} />
            <Route path="/attom-leads" element={<AttomLeadGeneratorPage />} />
            <Route path="/calls" element={<CallsPage />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  )
}

export default App
