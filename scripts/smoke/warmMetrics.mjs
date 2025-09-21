import http from "http";

const BASES = [
  "http://localhost:6027", // dev server
  "http://localhost:6033", // route tests
  "http://localhost:6035", // tiny dialer smoke
];

function get(path, base) {
  return new Promise((resolve) => {
    http
      .get(base + path, (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          let body = Buffer.concat(chunks).toString("utf8");
          try { body = JSON.parse(body); } catch {}
          resolve({ status: res.statusCode || 0, body });
        });
      })
      .on("error", () => resolve({ status: 0, body: null }));
  });
}

async function post(path, base, body) {
  return new Promise((resolve) => {
    const data = Buffer.from(JSON.stringify(body || {}));
    const req = http.request(
      base + path,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": data.length,
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          let body = Buffer.concat(chunks).toString("utf8");
          try { body = JSON.parse(body); } catch {}
          resolve({ status: res.statusCode || 0, body });
        });
      }
    );
    req.on("error", () => resolve(0));
    req.write(data);
    req.end();
  });
}

async function warm(base) {
  // Ping metrics and leads
  await get("/metrics", base);
  const leads = await get("/leads?limit=1", base);
  const leadId = leads?.body?.leads?.[0]?.id || "stub";
  const dial = await post("/dial", base, {
    leadId,
    toNumber: "+15555550100",
    fromNumber: "+15555550123",
    record: true,
  });
  const dialId = dial?.body?.dialId;
  if (dialId) {
    await post(`/dial/${dialId}/asr-complete`, base, {
      transcriptUrl: "https://example.com/t.txt",
      words: 5,
      latencyMs: 123,
    });
  }
  await get("/metrics", base);
}

for (const b of BASES) {
  await warm(b);
}
console.log("Warm metrics complete");
