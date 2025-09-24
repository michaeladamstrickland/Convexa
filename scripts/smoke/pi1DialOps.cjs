const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const BASIC_AUTH_USER = process.env.BASIC_AUTH_USER || 'admin'; // Placeholder
const BASIC_AUTH_PASS = process.env.BASIC_AUTH_PASS || 'admin'; // Placeholder

const AUTH_HEADER = 'Basic ' + Buffer.from(BASIC_AUTH_USER + ':' + BASIC_AUTH_PASS).toString('base64');

async function createLead() {
    const createLeadUrl = `${BASE_URL}/api/leads`;
    const leadPayload = {
        firstName: 'Smoke',
        lastName: 'Test',
        email: `smoke-test-${Date.now()}@example.com`,
        phone: `123-456-${Math.floor(Math.random() * 9000) + 1000}`
    };
    const response = await fetch(createLeadUrl, {
        method: 'POST',
        headers: {
            'Authorization': AUTH_HEADER,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(leadPayload)
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(`Failed to create lead: ${JSON.stringify(data)}`);
    }
    return data.id; // Assuming the API returns the created lead's ID
}

async function runDialOpsSmoke() {
    let output = `# Dial Operations Smoke Test Findings\n\n`;
    let metricsOutput = `# Metrics Sample after Dial Operations Smoke\n\n`;
    let leadId;

    try {
        // 0. Create a lead if needed
        output += `## Creating a new lead for smoke test\n\n`;
        leadId = await createLead();
        output += `### Created Lead ID: ${leadId}\n\n`;

        // 1. POST multiple dispositions
        const dispositionUrl = `${BASE_URL}/api/leads/${leadId}/disposition`;
        const dispositionPayload1 = {
            disposition: 'answered',
            notes: 'Spoke with lead, very interested.'
        };
        const dispositionResponse1 = await fetch(dispositionUrl, {
            method: 'POST',
            headers: {
                'Authorization': AUTH_HEADER,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dispositionPayload1)
        });
        const dispositionData1 = await dispositionResponse1.json();
        output += `## Post First Disposition for Lead ${leadId}\n\n`;
        output += `### Request URL:\n\`${dispositionUrl}\`\n\n`;
        output += `### Request Body:\n\`\`\`json\n${JSON.stringify(dispositionPayload1, null, 2)}\n\`\`\`\n\n`;
        output += `### Response Status: ${dispositionResponse1.status}\n\n`;
        output += `### Response Body:\n\`\`\`json\n${JSON.stringify(dispositionData1, null, 2)}\n\`\`\`\n\n`;

        const dispositionPayload2 = {
            disposition: 'no_answer',
            notes: 'No answer on second attempt.'
        };
        const dispositionResponse2 = await fetch(dispositionUrl, {
            method: 'POST',
            headers: {
                'Authorization': AUTH_HEADER,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dispositionPayload2)
        });
        const dispositionData2 = await dispositionResponse2.json();
        output += `## Post Second Disposition for Lead ${leadId}\n\n`;
        output += `### Request URL:\n\`${dispositionUrl}\`\n\n`;
        output += `### Request Body:\n\`\`\`json\n${JSON.stringify(dispositionPayload2, null, 2)}\n\`\`\`\n\n`;
        output += `### Response Status: ${dispositionResponse2.status}\n\n`;
        output += `### Response Body:\n\`\`\`json\n${JSON.stringify(dispositionData2, null, 2)}\n\`\`\`\n\n`;

        // 2. Create and complete a follow-up
        const followupUrl = `${BASE_URL}/api/leads/${leadId}/followup`;
        const followupPayload = {
            type: 'call',
            dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
            notes: 'Follow up call regarding property details.',
            channel: 'phone',
            priority: 'high'
        };
        const followupResponse = await fetch(followupUrl, {
            method: 'POST',
            headers: {
                'Authorization': AUTH_HEADER,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(followupPayload)
        });
        const followupData = await followupResponse.json();
        output += `## Add Follow-up for Lead ${leadId}\n\n`;
        output += `### Request URL:\n\`${followupUrl}\`\n\n`;
        output += `### Request Body:\n\`\`\`json\n${JSON.stringify(followupPayload, null, 2)}\n\`\`\`\n\n`;
        output += `### Response Status: ${followupResponse.status}\n\n`;
        output += `### Response Body:\n\`\`\`json\n${JSON.stringify(followupData, null, 2)}\n\`\`\`\n\n`;

        // Assuming followupData contains an ID for the created followup
        if (followupData && followupData.id) {
            const completeFollowupUrl = `${BASE_URL}/api/followups/${followupData.id}/complete`;
            const completeFollowupResponse = await fetch(completeFollowupUrl, {
                method: 'POST',
                headers: {
                    'Authorization': AUTH_HEADER
                }
            });
            const completeFollowupData = await completeFollowupResponse.json();
            output += `## Complete Follow-up ${followupData.id} for Lead ${leadId}\n\n`;
            output += `### Request URL:\n\`${completeFollowupUrl}\`\n\n`;
            output += `### Response Status: ${completeFollowupResponse.status}\n\n`;
            output += `### Response Body:\n\`\`\`json\n${JSON.stringify(completeFollowupData, null, 2)}\n\`\`\`\n\n`;
        } else {
            output += `### Warning: Could not complete follow-up as no ID was returned.\n\n`;
        }


        // 3. Fetch /leads/:id/timeline
        const timelineUrl = `${BASE_URL}/api/leads/${leadId}/timeline`;
        const timelineResponse = await fetch(timelineUrl, {
            headers: {
                'Authorization': AUTH_HEADER
            }
        });
        const timelineData = await timelineResponse.json();
        output += `## Lead Timeline for Lead ${leadId}\n\n`;
        output += `### Request URL:\n\`${timelineUrl}\`\n\n`;
        output += `### Response Status: ${timelineResponse.status}\n\n`;
        output += `### Response Body (excerpt):\n\`\`\`json\n${JSON.stringify(timelineData, null, 2)}\n\`\`\`\n\n`;

        // Save outputs to ops/findings/dial_followup_timeline.md
        const findingsDir = path.join(__dirname, '../../ops/findings');
        if (!fs.existsSync(findingsDir)) {
            fs.mkdirSync(findingsDir, { recursive: true });
        }
        fs.writeFileSync(path.join(findingsDir, 'dial_followup_timeline.md'), output);
        console.log('Dial operations smoke test findings saved to ops/findings/dial_followup_timeline.md');

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
            line.startsWith('timeline_events_total') || // Added new metric
            line.startsWith('# HELP') || // Include help lines for context
            line.startsWith('# TYPE') // Include type lines for context
        ).join('\n');

        metricsOutput += `### Metrics from ${metricsUrl}\n\n`;
        metricsOutput += `\`\`\`\n${filteredMetrics}\n\`\`\`\n\n`;

        fs.writeFileSync(path.join(findingsDir, 'pi1_metrics_sample.txt'), metricsOutput);
        console.log('Metrics sample saved to ops/findings/pi1_metrics_sample.txt');

    } catch (error) {
        console.error('Error during dial operations smoke test:', error);
        fs.writeFileSync(path.join(__dirname, '../../ops/findings/dial_followup_timeline.md'), `Error during dial operations smoke test: ${error.message}`);
        fs.writeFileSync(path.join(__dirname, '../../ops/findings/pi1_metrics_sample.txt'), `Error scraping metrics: ${error.message}`);
    }
}

runDialOpsSmoke();
