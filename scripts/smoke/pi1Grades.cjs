const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5001';
const BASIC_AUTH_USER = process.env.BASIC_AUTH_USER || 'staging'; 
const BASIC_AUTH_PASS = process.env.BASIC_AUTH_PASS || 'RockyDog456';

const AUTH_HEADER = 'Basic ' + Buffer.from(BASIC_AUTH_USER + ':' + BASIC_AUTH_PASS).toString('base64');

async function runGradesSmoke() {
    let output = `# Lead Grades Smoke Test Findings\n\n`;
    let metricsOutput = `# Metrics Sample after Lead Grades Smoke\n\n`;

    try {
        // Call POST /admin/grade/recompute?limit=50
        const recomputeUrl = `${BASE_URL}/admin/grade/recompute?limit=50`;
        const recomputeResponse = await fetch(recomputeUrl, {
            method: 'POST',
            headers: {
                'Authorization': AUTH_HEADER,
                'Content-Type': 'application/json'
            }
        });
        
        let recomputeData;
        const recomputeText = await recomputeResponse.text();
        
        try {
            recomputeData = JSON.parse(recomputeText);
        } catch (parseError) {
            recomputeData = { 
                error: 'Failed to parse JSON', 
                status: recomputeResponse.status,
                responseText: recomputeText.substring(0, 300) + (recomputeText.length > 300 ? '...' : '')
            };
        }
        
        output += `## Grade Recompute\n\n`;
        output += `### Request URL:\n\`${recomputeUrl}\`\n\n`;
        output += `### Response Status: ${recomputeResponse.status}\n\n`;
        output += `### Response Body:\n\`\`\`json\n${JSON.stringify(recomputeData, null, 2)}\n\`\`\`\n\n`;

        // Fetch a few leads showing grade_*
        // Assuming an endpoint like /api/leads/:id exists and returns grade information
        const leadIds = ['lead-id-1', 'lead-id-2', 'lead-id-3']; // Placeholder lead IDs
        output += `## Sample Leads with Grade Information\n\n`;

        for (const leadId of leadIds) {
            const leadUrl = `${BASE_URL}/api/leads/${leadId}`;
            const leadResponse = await fetch(leadUrl, {
                headers: {
                    'Authorization': AUTH_HEADER
                }
            });
            const leadData = await leadResponse.json();
            output += `### Lead ID: ${leadId}\n\n`;
            output += `### Request URL:\n\`${leadUrl}\`\n\n`;
            output += `### Response Status: ${leadResponse.status}\n\n`;
            output += `### Response Body (filtered for grade_*):\n\`\`\`json\n${JSON.stringify(
                Object.keys(leadData).filter(key => key.startsWith('grade_')).reduce((obj, key) => {
                    obj[key] = leadData[key];
                    return obj;
                }, {}),
                null,
                2
            )}\n\`\`\`\n\n`;
        }

        // Save outputs to ops/findings/grades_recompute.md
        const findingsDir = path.join(__dirname, '../../ops/findings');
        if (!fs.existsSync(findingsDir)) {
            fs.mkdirSync(findingsDir, { recursive: true });
        }
        fs.writeFileSync(path.join(findingsDir, 'grades_recompute.md'), output);
        console.log('Lead grades smoke test findings saved to ops/findings/grades_recompute.md');

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
        console.error('Error during lead grades smoke test:', error);
        fs.writeFileSync(path.join(__dirname, '../../ops/findings/grades_recompute.md'), `Error during lead grades smoke test: ${error.message}`);
        fs.writeFileSync(path.join(__dirname, '../../ops/findings/pi1_metrics_sample.txt'), `Error scraping metrics: ${error.message}`);
    }
}

runGradesSmoke();
