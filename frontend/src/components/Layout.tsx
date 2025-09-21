import { Link, useLocation, Outlet } from 'react-router-dom'
import { 
  HomeIcon, 
  UsersIcon, 
  MagnifyingGlassIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  MapPinIcon,
  TableCellsIcon,
  CurrencyDollarIcon,
  BuildingLibraryIcon,
  IdentificationIcon
} from '@heroicons/react/24/outline'

interface LayoutProps {}

const navigation = [
  { name: 'Empire Control', href: '/', icon: HomeIcon },
  { name: 'Basic Dashboard', href: '/dashboard', icon: ChartBarIcon },
  { name: 'Lead Management', href: '/lead-management', icon: UsersIcon },
  { name: 'Basic Leads', href: '/leads', icon: UsersIcon },
  { name: 'Lead Kanban', href: '/kanban', icon: TableCellsIcon },
  { name: 'Property Search Workspace', href: '/property-search', icon: BuildingLibraryIcon },
  { name: 'Unified Search', href: '/search', icon: MagnifyingGlassIcon },
  { name: 'Zip Code Search', href: '/zip-search', icon: MapPinIcon },
  { name: 'Real Property Leads', href: '/attom-leads', icon: BuildingLibraryIcon },
  { name: 'Skip Trace', href: '/skip-trace', icon: IdentificationIcon },
  { name: 'Scraper', href: '/scraper', icon: MagnifyingGlassIcon },
  { name: 'AI Analytics', href: '/analytics', icon: ChartBarIcon },
  { name: 'Cost Analytics', href: '/cost-analytics', icon: CurrencyDollarIcon },
]

export default function Layout({}: LayoutProps) {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg">
        <div className="flex h-16 items-center justify-center border-b border-gray-200">
          <h1 className="text-xl font-bold text-primary-600">Convexa AI</h1>
        </div>
        
        <nav className="mt-8 px-4 space-y-2">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.name}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Main content */}
      <div className="pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-40 bg-white shadow-sm border-b border-gray-200">
          <div className="flex h-16 items-center justify-between px-6">
            <h2 className="text-lg font-semibold text-gray-900">
              {navigation.find(item => item.href === location.pathname)?.name || 'Dashboard'}
            </h2>
            
            <div className="flex items-center space-x-4">
              <button className="p-2 text-gray-400 hover:text-gray-600">
                <Cog6ToothIcon className="h-5 w-5" />
              </button>
              <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center">
                <span className="text-sm font-medium text-white">U</span>
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
