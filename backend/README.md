# Leadflow AI - Real Estate Lead Generation SaaS Platform

## 🚀 Overview

Leadflow AI is a comprehensive SaaS platform designed for real estate investors, flippers, and wholesalers to automatically find, analyze, and contact property owners for off-market deals. The platform combines web scraping, AI-powered deal analysis, skip tracing, and automated outreach capabilities.

## 🧱 Core Features

### 1. **Automated Lead Sourcing**
- **Web Scraping**: Zillow FSBO, Realtor.com, public records
- **Data Enrichment**: Automated property valuation, equity calculation
- **Duplicate Detection**: Smart deduplication algorithms
- **Multi-Source Integration**: Combine data from multiple platforms

### 2. **AI-Powered Analysis**
- **Deal Scoring**: 0-100 AI score for flip/wholesale potential
- **Motivation Detection**: Identify seller motivation indicators
- **Profit Estimation**: Automated ARV and repair cost analysis
- **Call Script Generation**: Personalized scripts for each lead

### 3. **Skip Tracing & Contact Discovery**
- **Multiple Providers**: BatchSkipTracing, WhitePages Pro integration
- **Contact Enrichment**: Phone numbers, emails, addresses
- **Relationship Mapping**: Find relatives and associates
- **Cost Optimization**: Automatic provider fallback

### 4. **Campaign Management**
- **Multi-Channel Outreach**: SMS, calls, email, direct mail
- **Automated Sequences**: Follow-up workflows
- **Response Tracking**: Open rates, click rates, replies
- **Compliance Tools**: DNC list management

### 5. **CRM & Pipeline Management**
- **Lead Board**: Kanban-style pipeline management
- **Activity Tracking**: Call logs, notes, follow-ups
- **Team Collaboration**: Assign leads, share notes
- **Analytics Dashboard**: Performance metrics and ROI tracking

## 🛠 Technology Stack

### Backend
- **Node.js + Express**: RESTful API server
- **TypeScript**: Type-safe development
- **PostgreSQL**: Primary database
- **Prisma ORM**: Database management and migrations
- **OpenAI API**: AI-powered analysis and scripting
- **Puppeteer**: Web scraping capabilities
- **Twilio**: SMS and voice communication

### Frontend (Coming in Phase 4.1)
- **React + TypeScript**: Modern UI framework
- **TailwindCSS**: Utility-first styling
- **React Query**: Data fetching and caching
- **Chart.js**: Analytics visualizations
- **Zustand**: State management

## 📦 Project Structure

```
leadflow_ai/
├── backend/
│   ├── src/
│   │   ├── controllers/          # Request handlers
│   │   ├── services/            # Business logic
│   │   ├── routes/              # API routes
│   │   ├── middleware/          # Auth, error handling
│   │   ├── scrapers/            # Web scraping modules
│   │   ├── jobs/                # Background tasks
│   │   ├── utils/               # Helper functions
│   │   └── server.ts            # Main application
│   ├── prisma/
│   │   └── schema.prisma        # Database schema
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
└── frontend/                    # Coming in Phase 4.1
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL 14+
- OpenAI API key
- (Optional) Skip tracing API keys

### Installation

1. **Clone and navigate to the project**:
   ```bash
   cd leadflow_ai/backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your configurations
   ```

4. **Set up the database**:
   ```bash
   npm run prisma:migrate
   npm run prisma:generate
   ```

5. **Start development server**:
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:5000`

## 📋 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/forgot-password` - Password reset request
- `POST /api/auth/reset-password` - Password reset confirmation

### Leads Management
- `GET /api/leads` - List leads with filtering and pagination
- `POST /api/leads` - Create new lead
- `GET /api/leads/:id` - Get lead details
- `PATCH /api/leads/:id` - Update lead
- `DELETE /api/leads/:id` - Delete lead (soft delete)
- `POST /api/leads/:id/skip-trace` - Run skip trace on lead
- `POST /api/leads/:id/notes` - Add note to lead
- `GET /api/leads/:id/call-script` - Generate AI call script
- `GET /api/leads/stats` - Get lead statistics

### Scraping
- `POST /api/scraper/zillow` - Run Zillow FSBO scraper
- `GET /api/scraper/jobs` - List scraping jobs
- `GET /api/scraper/jobs/:id` - Get scraping job details
- `POST /api/scraper/process-records` - Process scraped records into leads
- `GET /api/scraper/property-records` - List property records

### Campaigns (Placeholder)
- `GET /api/campaigns` - Campaign management endpoints

### Calls (Placeholder)
- `GET /api/calls` - Call logging and analysis endpoints

### Analytics (Placeholder)
- `GET /api/analytics` - Performance analytics endpoints

## 🔧 Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/leadflow_ai"

# Server
PORT=5000
NODE_ENV=development

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# OpenAI
OPENAI_API_KEY=your-openai-api-key

# Twilio (for campaigns)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=your-twilio-phone-number

# Skip Tracing
BATCH_SKIP_TRACING_API_KEY=your-batch-skip-tracing-key
WHITEPAGES_PRO_API_KEY=your-whitepages-pro-key

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000
```

## 🏗 Database Schema

The database uses PostgreSQL with the following main entities:

- **Organizations**: Multi-tenant structure
- **Users**: Authentication and role management  
- **Leads**: Property and owner information
- **Skip Trace Records**: Contact discovery history
- **Call Logs**: Communication tracking
- **Campaigns**: Outreach management
- **Scraping Jobs**: Data collection tracking
- **Property Records**: Raw scraped data

## 🤖 AI Integration

### Lead Analysis
The AI service analyzes leads using GPT-4 to provide:
- **Motivation Score**: 0-100 seller motivation rating
- **Deal Score**: 0-100 investment potential rating
- **Deal Type**: Flip, wholesale, rental, or pass
- **Profit Estimate**: Expected profit calculation
- **Motivation Factors**: Detected indicators of seller motivation

### Call Script Generation
Generates personalized call scripts based on:
- Property details
- Owner information
- Motivation factors
- Market conditions

## 🕷 Web Scraping

### Zillow FSBO Scraper
- Searches multiple zip codes simultaneously
- Extracts property details, pricing, and contact info
- Handles pagination and rate limiting
- Stores raw data for processing

### Features
- **Anti-Detection**: Randomized delays, rotating user agents
- **Error Handling**: Robust error recovery and logging
- **Data Quality**: Duplicate detection and validation
- **Scalability**: Batch processing and queue management

## 🔍 Skip Tracing

### Provider Integration
1. **BatchSkipTracing** (Primary)
   - Most comprehensive data
   - ~$0.25 per trace
   - Phone, email, address history

2. **WhitePages Pro** (Fallback)
   - Good coverage for basic contact info
   - ~$0.15 per trace
   - Phone and address data

3. **Public Records** (Free Fallback)
   - Limited to provided information
   - No additional cost
   - Basic validation only

## 📊 Usage Analytics

Track key metrics:
- Lead generation rate
- Conversion funnel
- AI accuracy scores
- Campaign performance
- Cost per lead
- ROI by source

## 🛡 Security Features

- **JWT Authentication**: Secure token-based auth
- **Rate Limiting**: API abuse prevention
- **Input Validation**: SQL injection protection
- **CORS Configuration**: Cross-origin security
- **Helmet.js**: Security headers
- **bcrypt**: Password hashing

## 🚀 Deployment

### Production Checklist
- [ ] Set `NODE_ENV=production`
- [ ] Configure production database
- [ ] Set up SSL certificates
- [ ] Configure reverse proxy (nginx)
- [ ] Set up monitoring and logging
- [ ] Configure backup strategies
- [ ] Set up CI/CD pipeline

### Recommended Hosting
- **Backend**: Railway, Render, or Fly.io
- **Database**: Supabase or Railway Postgres
- **Frontend**: Vercel or Netlify (Phase 4.1)

## 📚 Next Steps (Phase 4.1)

1. **Frontend Development**
   - React dashboard with lead management
   - Campaign creation and monitoring
   - Analytics visualizations
   - Mobile-responsive design

2. **Advanced Features**
   - Real-time notifications
   - Advanced filtering and search
   - Bulk operations
   - Team collaboration tools

3. **Integrations**
   - Zapier/Make.com connectors
   - MLS data feeds
   - CRM integrations
   - Direct mail services

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 📞 Support

For questions or support:
- Create an issue on GitHub
- Email: [your-email@example.com]
- Documentation: [Link to detailed docs]

---

**Leadflow AI** - Revolutionizing real estate lead generation with AI-powered automation.
