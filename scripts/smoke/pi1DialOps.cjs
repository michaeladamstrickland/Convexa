const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5001';
const BASIC_AUTH_USER = process.env.BASIC_AUTH_USER || 'admin';
const BASIC_AUTH_PASS = process.env.BASIC_AUTH_PASS || 'admin';

const AUTH_HEADER = 'Basic ' + Buffer.from(BASIC_AUTH_USER + ':' + BASIC_AUTH_PASS).toString('base64');

async function getTestLead() {
    // Try to get an existing lead first
    const leadsUrl = `${BASE_URL}/api/leads?limit=1`;
    const response = await fetch(leadsUrl, {
        headers: { 'Authorization': AUTH_HEADER }
    });
    const data = await response.json();
    if (response.ok && data.leads && data.leads.length > 0) {
        return data.leads[0].id;
    }
    
    // If no leads exist, create a synthetic one for testing
    const leadId = `smoke-test-${Date.now()}`;
    console.log(`Using synthetic lead ID: ${leadId}`);
    return leadId;
}

async function runDialOpsSmoke() {
    let output = `# PI1 Dial Operations & Follow-ups Smoke Test Results\n\n`;
    output += `Date: ${new Date().toISOString()}\n`;
    output += `Base URL: ${BASE_URL}\n\n`;
    
    let metricsOutput = `# PI1 Metrics Sample after Dial Operations Smoke\n\n`;
    let leadId;

    try {
        // 0. Get a test lead
        output += `## Getting test lead for smoke test\n\n`;
        leadId = await getTestLead();
        output += `### Using Lead ID: ${leadId}\n\n`;

        // 1. POST dial disposition (using correct endpoint)
        const dialId = `dial-${leadId}`;
        const dispositionUrl = `${BASE_URL}/dial/${dialId}/disposition`;
        
        // Test disposition: interested
        const dispositionPayload1 = {
            type: 'interested',
            notes: 'Lead showed strong interest in selling property'
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
        output += `## 1. POST Dial Disposition (Interested)\n\n`;
        output += `### Request URL: \`${dispositionUrl}\`\n\n`;
        output += `### Request Body:\n\`\`\`json\n${JSON.stringify(dispositionPayload1, null, 2)}\n\`\`\`\n\n`;
        output += `### Response Status: ${dispositionResponse1.status}\n\n`;
        output += `### Response Body:\n\`\`\`json\n${JSON.stringify(dispositionData1, null, 2)}\n\`\`\`\n\n`;

        // Test disposition: voicemail
        const dialId2 = `dial-${leadId}-2`;
        const dispositionPayload2 = {
            type: 'voicemail',
            notes: 'Left detailed voicemail about our services'
        };
        const dispositionResponse2 = await fetch(`${BASE_URL}/dial/${dialId2}/disposition`, {
            method: 'POST',
            headers: {
                'Authorization': AUTH_HEADER,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dispositionPayload2)
        });
        const dispositionData2 = await dispositionResponse2.json();
        output += `## 2. POST Dial Disposition (Voicemail)\n\n`;
        output += `### Request URL: \`${BASE_URL}/dial/${dialId2}/disposition\`\n\n`;
        output += `### Request Body:\n\`\`\`json\n${JSON.stringify(dispositionPayload2, null, 2)}\n\`\`\`\n\n`;
        output += `### Response Status: ${dispositionResponse2.status}\n\n`;
        output += `### Response Body:\n\`\`\`json\n${JSON.stringify(dispositionData2, null, 2)}\n\`\`\`\n\n`;

        // 2. Create follow-up (using correct endpoint)
        const followupUrl = `${BASE_URL}/leads/${leadId}/followups`;
        const dueAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes from now
        const followupPayload = {
            dueAt,
            channel: 'call',
            priority: 'high',
            notes: 'Follow up on interested lead from phone call'
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
        output += `## 3. POST Create Follow-up\n\n`;
        output += `### Request URL: \`${followupUrl}\`\n\n`;
        output += `### Request Body:\n\`\`\`json\n${JSON.stringify(followupPayload, null, 2)}\n\`\`\`\n\n`;
        output += `### Response Status: ${followupResponse.status}\n\n`;
        output += `### Response Body:\n\`\`\`json\n${JSON.stringify(followupData, null, 2)}\n\`\`\`\n\n`;

        // 3. Update follow-up status (if we got an ID back)
        if (followupData && followupData.id) {
            const updateFollowupUrl = `${BASE_URL}/followups/${followupData.id}`;
            const updatePayload = {
                status: 'done',
                notes: 'Successfully contacted lead and scheduled appointment'
            };
            const updateResponse = await fetch(updateFollowupUrl, {
                method: 'PATCH',
                headers: {
                    'Authorization': AUTH_HEADER,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updatePayload)
            });
            const updateData = await updateResponse.json();
            output += `## 4. PATCH Update Follow-up Status\n\n`;
            output += `### Request URL: \`${updateFollowupUrl}\`\n\n`;
            output += `### Request Body:\n\`\`\`json\n${JSON.stringify(updatePayload, null, 2)}\n\`\`\`\n\n`;
            output += `### Response Status: ${updateResponse.status}\n\n`;
            output += `### Response Body:\n\`\`\`json\n${JSON.stringify(updateData, null, 2)}\n\`\`\`\n\n`;

            // Test snooze functionality
            const followupPayload2 = {
                dueAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
                channel: 'sms',
                priority: 'med',
                notes: 'SMS follow-up for property inquiry'
            };
            const followupResponse2 = await fetch(followupUrl, {
                method: 'POST',
                headers: {
                    'Authorization': AUTH_HEADER,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(followupPayload2)
            });
            const followupData2 = await followupResponse2.json();
            
            if (followupData2 && followupData2.id) {
                const snoozePayload = {
                    status: 'snoozed',
                    snoozeUntil: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours
                    notes: 'Lead requested callback later today'
                };
                const snoozeResponse = await fetch(`${BASE_URL}/followups/${followupData2.id}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': AUTH_HEADER,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(snoozePayload)
                });
                const snoozeData = await snoozeResponse.json();
                output += `## 5. PATCH Snooze Follow-up\n\n`;
                output += `### Request Body:\n\`\`\`json\n${JSON.stringify(snoozePayload, null, 2)}\n\`\`\`\n\n`;
                output += `### Response Status: ${snoozeResponse.status}\n\n`;
                output += `### Response Body:\n\`\`\`json\n${JSON.stringify(snoozeData, null, 2)}\n\`\`\`\n\n`;
            }
        } else {
            output += `### Warning: Could not update follow-up status as no ID was returned.\n\n`;
        }

        // 4. Get lead timeline
        const timelineUrl = `${BASE_URL}/leads/${leadId}/timeline`;
        const timelineResponse = await fetch(timelineUrl, {
            headers: { 'Authorization': AUTH_HEADER }
        });
        const timelineData = await timelineResponse.json();
        output += `## 6. GET Lead Timeline\n\n`;
        output += `### Request URL: \`${timelineUrl}\`\n\n`;
        output += `### Response Status: ${timelineResponse.status}\n\n`;
        output += `### Response Body:\n\`\`\`json\n${JSON.stringify(timelineData, null, 2)}\n\`\`\`\n\n`;

        // 5. Get follow-ups list
        const followupsListUrl = `${BASE_URL}/followups?status=open&limit=10`;
        const followupsListResponse = await fetch(followupsListUrl, {
            headers: { 'Authorization': AUTH_HEADER }
        });
        const followupsListData = await followupsListResponse.json();
        output += `## 7. GET Follow-ups List\n\n`;
        output += `### Request URL: \`${followupsListUrl}\`\n\n`;
        output += `### Response Status: ${followupsListResponse.status}\n\n`;
        output += `### Response Body (first 5 items):\n\`\`\`json\n${JSON.stringify({
            ...followupsListData,
            followups: (followupsListData.followups || []).slice(0, 5)
        }, null, 2)}\n\`\`\`\n\n`;

        // Save findings
        const findingsDir = path.join(__dirname, '../../ops/findings');
        if (!fs.existsSync(findingsDir)) {
            fs.mkdirSync(findingsDir, { recursive: true });
        }
        fs.writeFileSync(path.join(findingsDir, 'dial_followup_timeline.md'), output);
        console.log('✅ Dial operations smoke test findings saved to ops/findings/dial_followup_timeline.md');

        // 6. Scrape metrics and filter for PI1 metrics
        const metricsUrl = `${BASE_URL}/metrics`;
        const metricsResponse = await fetch(metricsUrl, {
            headers: { 'Authorization': AUTH_HEADER }
        });
        
        if (metricsResponse.ok) {
            const metricsText = await metricsResponse.text();
            
            // Filter for PI1-related metrics
            const filteredMetrics = metricsText.split('\n').filter(line =>
                line.startsWith('campaign_queries_total') ||
                line.startsWith('lead_grade') ||
                line.startsWith('followups_') ||
                line.startsWith('dialer_disposition_total') ||
                line.startsWith('timeline_events_total') ||
                line.startsWith('http_requests_total') ||
                line.startsWith('# HELP dialer_') ||
                line.startsWith('# TYPE dialer_') ||
                line.startsWith('# HELP followups_') ||
                line.startsWith('# TYPE followups_') ||
                line.startsWith('# HELP timeline_') ||
                line.startsWith('# TYPE timeline_')
            ).join('\n');

            metricsOutput += `## Metrics from ${metricsUrl}\n\n`;
            metricsOutput += `Response Status: ${metricsResponse.status}\n\n`;
            metricsOutput += `### PI1 Dialer & Follow-ups Metrics\n\n`;
            metricsOutput += `\`\`\`prometheus\n${filteredMetrics}\n\`\`\`\n\n`;
            
            // Validate that we have the expected metrics
            const expectedMetrics = [
                'dialer_disposition_total',
                'followups_created_total', 
                'followups_completed_total',
                'followups_due_gauge',
                'followups_overdue_gauge',
                'timeline_events_total'
            ];
            
            metricsOutput += `### Metrics Validation\n\n`;
            expectedMetrics.forEach(metric => {
                const found = filteredMetrics.includes(metric);
                metricsOutput += `- ${metric}: ${found ? '✅ Found' : '❌ Missing'}\n`;
            });
            metricsOutput += `\n`;
        } else {
            metricsOutput += `## Error fetching metrics\n\n`;
            metricsOutput += `Status: ${metricsResponse.status}\n`;
            metricsOutput += `Error: ${await metricsResponse.text()}\n\n`;
        }

        fs.writeFileSync(path.join(findingsDir, 'pi1_metrics_sample.txt'), metricsOutput);
        console.log('✅ PI1 metrics sample saved to ops/findings/pi1_metrics_sample.txt');

    } catch (error) {
        console.error('❌ Error during PI1 dial operations smoke test:', error);
        const errorMsg = `# PI1 Dial Operations Smoke Test - ERROR\n\nError: ${error.message}\nStack: ${error.stack}\n`;
        
        const findingsDir = path.join(__dirname, '../../ops/findings');
        if (!fs.existsSync(findingsDir)) {
            fs.mkdirSync(findingsDir, { recursive: true });
        }
        fs.writeFileSync(path.join(findingsDir, 'dial_followup_timeline.md'), output + '\n\n' + errorMsg);
        fs.writeFileSync(path.join(findingsDir, 'pi1_metrics_sample.txt'), `Error: ${error.message}`);
        
        process.exit(1);
    }
}

// Only run if this script is executed directly
if (require.main === module) {
    runDialOpsSmoke();
}

module.exports = { runDialOpsSmoke };
