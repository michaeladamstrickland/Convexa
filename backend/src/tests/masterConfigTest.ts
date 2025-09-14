// Master Configuration Test Suite
// Tests all API configurations and validates the master system

import { masterConfig } from '../config/masterConfig';
import { MasterRealEstateDataService } from '../services/masterRealEstateService';
import axios from 'axios';

interface TestResult {
  api: string;
  status: 'success' | 'error' | 'disabled';
  message: string;
  responseTime?: number;
}

export class MasterConfigTester {
  private testResults: TestResult[] = [];

  async runAllTests(): Promise<void> {
    console.log('🧪 Starting Master Configuration Tests...\n');

    // Test 1: Configuration Loading
    await this.testConfigurationLoading();

    // Test 2: Environment Variables
    await this.testEnvironmentVariables();

    // Test 3: API Availability
    await this.testAPIAvailability();

    // Test 4: Service Initialization
    await this.testServiceInitialization();

    // Test 5: Sample API Calls (if keys provided)
    await this.testSampleAPICalls();

    // Generate Report
    this.generateReport();
  }

  private async testConfigurationLoading(): Promise<void> {
    try {
      const config = masterConfig.getMasterConfig();
      const tierInfo = masterConfig.getTierInfo();
      
      this.testResults.push({
        api: 'Configuration',
        status: 'success',
        message: `Successfully loaded ${tierInfo.name} tier configuration with ${Object.keys(config).length} APIs`
      });
    } catch (error: any) {
      this.testResults.push({
        api: 'Configuration',
        status: 'error',
        message: `Failed to load configuration: ${error.message}`
      });
    }
  }

  private async testEnvironmentVariables(): Promise<void> {
    const requiredVars = [
      'LEADFLOW_TIER',
      'DAILY_BUDGET_LIMIT',
      'DB_HOST',
      'DB_PORT',
      'DB_USER',
      'DB_NAME',
      'JWT_SECRET'
    ];

    const missing = requiredVars.filter(varName => !process.env[varName]);
    
    if (missing.length === 0) {
      this.testResults.push({
        api: 'Environment',
        status: 'success',
        message: 'All required environment variables are set'
      });
    } else {
      this.testResults.push({
        api: 'Environment',
        status: 'error',
        message: `Missing environment variables: ${missing.join(', ')}`
      });
    }
  }

  private async testAPIAvailability(): Promise<void> {
    const apiStatus = masterConfig.validateAPIAvailability();
    
    this.testResults.push({
      api: 'API Keys',
      status: apiStatus.available.length > 0 ? 'success' : 'error',
      message: `${apiStatus.available.length} APIs configured, ${apiStatus.missing.length} missing keys`
    });

    // Log individual API status
    console.log('📊 API Configuration Status:');
    console.log(`✅ Configured: ${apiStatus.available.join(', ') || 'None'}`);
    console.log(`❌ Missing Keys: ${apiStatus.missing.join(', ') || 'None'}\n`);
  }

  private async testServiceInitialization(): Promise<void> {
    try {
      const config = masterConfig.getMasterConfig();
      const service = new MasterRealEstateDataService(config);
      
      this.testResults.push({
        api: 'Service',
        status: 'success',
        message: 'Master Real Estate Data Service initialized successfully'
      });
    } catch (error: any) {
      this.testResults.push({
        api: 'Service',
        status: 'error',
        message: `Service initialization failed: ${error.message}`
      });
    }
  }

  private async testSampleAPICalls(): Promise<void> {
    const config = masterConfig.getMasterConfig();
    const apiStatus = masterConfig.validateAPIAvailability();

    // Test a few key APIs if they have keys configured
    if (apiStatus.available.includes('attomData') && config.attomData.apiKey) {
      await this.testAttomDataAPI(config.attomData);
    }

    if (apiStatus.available.includes('openAI') && config.openAI.apiKey) {
      await this.testOpenAIAPI(config.openAI);
    }

    if (apiStatus.available.includes('googleMaps') && config.googleMaps.apiKey) {
      await this.testGoogleMapsAPI(config.googleMaps);
    }

    // If no APIs configured with keys, skip testing
    if (apiStatus.available.length === 0) {
      this.testResults.push({
        api: 'Live API Tests',
        status: 'disabled',
        message: 'No API keys configured - skipping live tests'
      });
    }
  }

  private async testAttomDataAPI(config: any): Promise<void> {
    try {
      const startTime = Date.now();
      
      const response = await axios.get(`${config.baseUrl}/property/basicprofile`, {
        headers: {
          'apikey': config.apiKey
        },
        params: {
          address1: '123 Main St',
          address2: 'New York, NY'
        },
        timeout: 10000
      });

      const responseTime = Date.now() - startTime;

      this.testResults.push({
        api: 'ATTOM Data',
        status: 'success',
        message: `API responding - Status: ${response.status}`,
        responseTime
      });
    } catch (error: any) {
      this.testResults.push({
        api: 'ATTOM Data',
        status: 'error',
        message: `API test failed: ${error.response?.status || error.message}`
      });
    }
  }

  private async testOpenAIAPI(config: any): Promise<void> {
    try {
      const startTime = Date.now();
      
      const response = await axios.post(`${config.baseUrl}/chat/completions`, {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user', content: 'Hello! This is a test message.' }
        ],
        max_tokens: 10
      }, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });

      const responseTime = Date.now() - startTime;

      this.testResults.push({
        api: 'OpenAI',
        status: 'success',
        message: `API responding - Model: ${response.data.model}`,
        responseTime
      });
    } catch (error: any) {
      this.testResults.push({
        api: 'OpenAI',
        status: 'error',
        message: `API test failed: ${error.response?.status || error.message}`
      });
    }
  }

  private async testGoogleMapsAPI(config: any): Promise<void> {
    try {
      const startTime = Date.now();
      
      const response = await axios.get(`${config.baseUrl}/geocode/json`, {
        params: {
          address: 'New York, NY',
          key: config.apiKey
        },
        timeout: 10000
      });

      const responseTime = Date.now() - startTime;

      this.testResults.push({
        api: 'Google Maps',
        status: response.data.status === 'OK' ? 'success' : 'error',
        message: `API responding - Status: ${response.data.status}`,
        responseTime
      });
    } catch (error: any) {
      this.testResults.push({
        api: 'Google Maps',
        status: 'error',
        message: `API test failed: ${error.response?.status || error.message}`
      });
    }
  }

  private generateReport(): void {
    console.log('🎯 MASTER CONFIGURATION TEST REPORT');
    console.log('================================================\n');

    const systemStatus = masterConfig.getSystemStatus();
    
    console.log('📊 System Overview:');
    console.log(`   Tier: ${systemStatus.tier}`);
    console.log(`   Total APIs: ${systemStatus.totalAPIs}`);
    console.log(`   Enabled APIs: ${systemStatus.enabledAPIs}`);
    console.log(`   Estimated Cost/Search: $${systemStatus.estimatedCostPerSearch.toFixed(2)}`);
    console.log(`   Daily Budget Limit: $${systemStatus.dailyBudgetLimit}`);
    console.log(`   Max Monthly Searches: ${systemStatus.maxMonthlySearches.toLocaleString()}\n`);

    console.log('🔧 Test Results:');
    this.testResults.forEach(result => {
      const icon = result.status === 'success' ? '✅' : result.status === 'error' ? '❌' : '⚪';
      const timeStr = result.responseTime ? ` (${result.responseTime}ms)` : '';
      console.log(`   ${icon} ${result.api}: ${result.message}${timeStr}`);
    });

    const successCount = this.testResults.filter(r => r.status === 'success').length;
    const errorCount = this.testResults.filter(r => r.status === 'error').length;
    
    console.log('\n📈 Summary:');
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    console.log(`   ⚪ Disabled: ${this.testResults.length - successCount - errorCount}`);

    if (errorCount === 0) {
      console.log('\n🎉 All tests passed! LeadFlow AI is ready for operation.');
    } else {
      console.log('\n⚠️  Some tests failed. Review the errors above before proceeding.');
    }

    console.log('\n💡 Next Steps:');
    console.log('   1. Add missing API keys to your .env file');
    console.log('   2. Run the frontend interface');
    console.log('   3. Test with sample property searches');
    console.log('   4. Monitor costs and usage\n');
  }

  public getResults(): TestResult[] {
    return this.testResults;
  }
}

// CLI runner
if (require.main === module) {
  const tester = new MasterConfigTester();
  tester.runAllTests().catch(console.error);
}
