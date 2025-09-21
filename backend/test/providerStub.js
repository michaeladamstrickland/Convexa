// Simple provider stub to enable zero-cost cache-hit smoke tests
export function stubBatchDataV1() {
  return {
    status: 200,
    results: {
      persons: [
        {
          phoneNumbers: [
            { number: '8568547061', type: 'Land Line', dnc: true, score: 100 }
          ],
          emails: [
            { email: 'kathleensilvagni@earthlink.net', tested: true }
          ]
        }
      ],
      meta: {
        matchCount: 1
      }
    },
    meta: { results: { requestCount: 1, matchCount: 1, noMatchCount: 0, errorCount: 0 } }
  };
}
