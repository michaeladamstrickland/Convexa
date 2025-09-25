import './workers/scraperWorker';
console.log('[workerBootstrap] Scraper worker initialized. Listening for jobs...');
// Keep process alive
process.on('SIGINT', () => {
    console.log('Shutting down worker...');
    process.exit(0);
});
//# sourceMappingURL=workerBootstrap.js.map