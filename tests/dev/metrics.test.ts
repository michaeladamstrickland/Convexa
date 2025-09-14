import fetch from 'node-fetch';

const DEV = 'http://localhost:3001/api/dev/metrics';

jest.setTimeout(15000);

describe('Metrics Exposure', () => {
  it('includes required metric keys', async () => {
  // Trigger a matchmaking job to ensure matchmaking metrics appear
  await fetch('http://localhost:3001/api/admin/matchmaking-jobs', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ filterJSON: { minScore:0 } }) });
  await new Promise(r => setTimeout(r, 500));
  const body = await (await fetch(DEV)).text();
    const must = [
      'leadflow_webhook_replay_total{mode="single",status="success"}',
      'leadflow_webhook_replay_total{mode="single",status="failed"}',
      'leadflow_webhook_replay_total{mode="bulk",status="success"}',
      'leadflow_enrichment_processed_total',
      'leadflow_enrichment_duration_ms_bucket{le="+Inf"}',
      'leadflow_properties_enriched_gauge',
      'leadflow_export_total{format="json"}',
      'leadflow_export_total{format="csv"}',
      'leadflow_matchmaking_jobs_total{status="queued"}',
      'leadflow_build_info{version="',
    ];
    for (const key of must) {
      expect(body).toContain(key);
    }
  });
});
