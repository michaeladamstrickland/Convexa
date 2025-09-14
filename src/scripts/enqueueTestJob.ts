import { enqueueScraperJob } from '../queues/scraperQueue';

async function main() {
  const job = await enqueueScraperJob({ source: 'zillow', zip: '19147' });
  console.log('Enqueued test job:', job);
}

main().then(()=>process.exit(0)).catch(err=>{console.error(err);process.exit(1);});
