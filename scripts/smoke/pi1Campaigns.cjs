const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const BASIC_AUTH_USER = process.env.BASIC_AUTH_USER || 'admin'; // Placeholder
const BASIC_AUTH_PASS = process.env.BASIC_AUTH_PASS || 'admin'; // Placeholder

const AUTH_HEADER = 'Basic ' + Buffer.from(BASIC_AUTH_USER + ':' + BASIC_AUTH_PASS).toString('base64');

async function runCampaignSmoke() {
    let output = `# Campaign Smoke Test Findings\n\n`;
    let metricsOutput = `# Metrics Sample after Campaign Smoke\n\n`;

    try {
        // Hit /api/campaigns/search?type=distressed&limit=5
        const distressedUrl = `${BASE_URL}/api/campaigns/search?type=distressed&limit=5`;
        const distressedResponse = await fetch(distressedUrl, {
            headers: {
                'Authorization': AUTH_HEADER
            }
        });
        const distressedData = await distressedResponse.json();
        output += `## Distressed Campaigns\n\n`;
        output += `### Request URL:\n\`${distressedUrl}\`\n\n`;
        output += `### Response Status: ${distressedResponse.status}\n\n`;
        output += `### Response Body:\n\`\`\`json\n${JSON.stringify(distressedData, null, 2)}\n\`\`\`\n\n`;

        // Hit /api/campaigns/search?type=preforeclosure&limit=5 (another type)
        const preforeclosureUrl = `${BASE_URL}/api/campaigns/search?type=preforeclosure&limit=5`;
        const preforeclosureResponse = await fetch(preforeclosureUrl, {
            headers: {
                'Authorization': AUTH_HEADER
            }
        });
        const preforeclosureData = await preforeclosureResponse.json();
        output += `## Preforeclosure Campaigns\n\n`;
        output += `### Request URL:\n\`${preforeclosureUrl}\`\n\n`;
        output += `### Response Status: ${preforeclosureResponse.status}\n\n`;
        output += `### Response Body:\n\`\`\`json\n${JSON.stringify(preforeclosureData, null, 2)}\n\`\`\`\n\n`;

        // Save outputs to ops/findings/campaigns_smoke.md
        const findingsDir = path.join(__dirname, '../../ops/findings');
        if (!fs.existsSync(findingsDir)) {
            fs.mkdirSync(findingsDir, { recursive: true });
        }
        fs.writeFileSync(path.join(findingsDir, 'campaigns_smoke.md'), output);
        console.log('Campaign smoke test findings saved to ops/findings/campaigns_smoke.md');

        // Scrape /metrics
        const metricsUrl = `${BASE_URL}/metrics`;
        const metricsResponse = await fetch(metricsUrl, {
            headers: {
                'Authorization': AUTH_HEADER
            }
        });
        const metricsText = await metricsResponse.text();

        // Filter metrics
        const filteredMetrics = metricsText.split('\n').filter(line =>
            line.startsWith('campaign_queries_total') ||
            line.startsWith('lead_grade') ||
            line.startsWith('followups') ||
            line.startsWith('dial_disposition') ||
            line.startsWith('http_requests_total') ||
            line.startsWith('# HELP') || // Include help lines for context
            line.startsWith('# TYPE') // Include type lines for context
        ).join('\n');

        metricsOutput += `### Metrics from ${metricsUrl}\n\n`;
        metricsOutput += `\`\`\`\n${filteredMetrics}\n\`\`\`\n\n`;

        fs.writeFileSync(path.join(findingsDir, 'pi1_metrics_sample.txt'), metricsOutput);
        console.log('Metrics sample saved to ops/findings/pi1_metrics_sample.txt');

    } catch (error) {
        console.error('Error during campaign smoke test:', error);
        fs.writeFileSync(path.join(__dirname, '../../ops/findings/campaigns_smoke.md'), `Error during campaign smoke test: ${error.message}`);
        fs.writeFileSync(path.join(__dirname, '../../ops/findings/pi1_metrics_sample.txt'), `Error scraping metrics: ${error.message}`);
    }
}

runCampaignSmoke();
