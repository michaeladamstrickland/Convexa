# 📘 Phase 4 Real Estate Lead Generation System - Usage Guide

## 🔑 API Setup Instructions

### 1. ATTOM Data API Setup
1. Go to https://api.developer.attomdata.com/
2. Click "Get Started" → "Sign Up"
3. Choose "Property Data API" plan ($299/month)
4. Complete payment and account verification
5. Copy API key from dashboard

### 2. DataTree API Setup
1. Visit https://www.datatree.com/
2. Contact sales for API access
3. Choose probate records package ($129/month)
4. Complete account setup
5. Save API credentials

### 3. OpenAI Setup
1. Go to https://platform.openai.com/
2. Create account or sign in
3. Navigate to API section
4. Add $100 credit to account
5. Create and copy API key

### 4. Google Cloud Setup
1. Visit https://console.cloud.google.com/
2. Create new project
3. Enable Maps JavaScript API, Geocoding API, Places API
4. Set up billing with $50 credit
5. Create API key with proper restrictions

## 🛠️ Environment Setup

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Add your API keys to `.env`:
```env
ATTOM_DATA_API_KEY=your_attom_key
DATATREE_API_KEY=your_datatree_key
OPENAI_API_KEY=your_openai_key
GOOGLE_MAPS_API_KEY=your_google_key
```

## 🚀 Running the System

### Backend Setup
```bash
cd backend
npm install
npm run build
npm start
```

### Frontend Setup
```bash
cd frontend
npm install
npm start
```

## 🧪 Testing the Integration

1. Run integration tests:
```bash
cd backend
npm test
```

2. Manual API Testing:
   - Open browser to http://localhost:3000
   - Use the lead generation form
   - Test with address: "123 Main St, Phoenix, AZ 85001"
   - Check results in console

## 📊 Monitoring & Analytics

### Cost Tracking
- Check `.env` for cost limits
- Monitor daily API usage in logs
- Review cost dashboard in admin panel

### Performance Metrics
- API response times in logs
- Lead quality scores
- System resource usage

## 🚨 Troubleshooting

### Common Issues

1. API Key Errors
```
Error: Invalid API key
Solution: Verify key in .env matches dashboard
```

2. Rate Limiting
```
Error: Too many requests
Solution: Check CALLS_PER_SECOND settings
```

3. Data Quality
```
Error: Invalid address format
Solution: Use validated addresses only
```

## 📈 Scaling Guidelines

1. Increase API Limits
   - ATTOM: Contact support for higher limits
   - DataTree: Upgrade package as needed
   - OpenAI: Increase rate limits in dashboard

2. Optimize Costs
   - Cache frequent property lookups
   - Batch process similar addresses
   - Monitor AI token usage

3. Improve Performance
   - Enable response caching
   - Implement request queuing
   - Use background processing

## 📋 Daily Operations Checklist

### Morning Tasks
- [ ] Check API status dashboard
- [ ] Review error logs
- [ ] Monitor cost tracking
- [ ] Process new leads

### Evening Tasks
- [ ] Export daily leads
- [ ] Backup database
- [ ] Review performance metrics
- [ ] Plan next day's searches

## 🎯 Success Metrics

Track these daily:
1. Leads Generated
2. API Costs
3. Data Accuracy
4. Response Times
5. Conversion Rates

## 🆘 Support Contacts

### ATTOM Data
- Support: developers@attomdata.com
- Phone: (949) 502-8300

### DataTree
- Support: help@datatree.com
- Phone: (800) 448-0011

### OpenAI
- Support: help.openai.com
- Dashboard: platform.openai.com

### Google Cloud
- Support: console.cloud.google.com/support
- Documentation: cloud.google.com/maps/docs

## 🔄 Update & Maintenance

### Weekly Tasks
1. Review API usage patterns
2. Optimize search parameters
3. Update property valuations
4. Clean up old data

### Monthly Tasks
1. Audit API costs
2. Update market analysis
3. Optimize AI prompts
4. Review scaling needs

---

**Remember:** Always test in development before pushing to production. Monitor API costs daily to stay within budget.
