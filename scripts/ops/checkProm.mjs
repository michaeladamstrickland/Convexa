import http from "http";
const PROM = process.env.PROM_URL || "http://localhost:9090";

const queries = [
  // Prometheus up for the convexa job confirms scrape targets are healthy
  'sum(up{job="convexa"})',
  // Build info gauges are emitted by the server and should always be present
  'convexa_build_info',
  'leadflow_build_info',
];

function q(expr) {
  return new Promise((resolve, reject) => {
    const url = `${PROM}/api/v1/query?query=${encodeURIComponent(expr)}`;
    http
      .get(url, (res) => {
        let buf = "";
        res.on("data", (c) => (buf += c));
        res.on("end", () => {
          try {
            const json = JSON.parse(buf);
            const hasData = json?.data?.result?.length > 0;
            console.log(`QUERY: ${expr}\nRESULTS: ${json?.data?.result?.length}\n---`);
            hasData ? resolve(true) : reject(new Error("no data"));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

(async () => {
  let ok = true;
  for (const expr of queries) {
    try {
      await q(expr);
    } catch {
      ok = false;
    }
  }
  if (!ok) {
    process.exit(1);
  }
})();
