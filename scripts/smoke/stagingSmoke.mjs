import http from "http";
import { URL } from "url";

const BASE = process.env.BASE || "http://localhost:6027";

function j(method, path, body, headers={}) {
  return new Promise((resolve, reject) => {
    const u = new URL(path, BASE);
    const data = body ? Buffer.from(JSON.stringify(body)) : null;
    const req = http.request(u, {
      method,
      headers: { "content-type":"application/json", ...(data?{"content-length":data.length}:{}), ...headers }
    }, res => {
      let buf=""; res.on("data", c=>buf+=c); res.on("end", ()=>resolve({status:res.statusCode, body:buf}));
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  // health
  const h = await j("GET", "/health");
  if (h.status !== 200) throw new Error("health failed");

  // leads
  await j("GET", "/leads?limit=1");

  // dial + asr-complete
  const d = await j("POST", "/dial", { leadId: "demo", toNumber: "+15555550100", fromNumber: "+15555550123", record: true });
  const dialId = (() => { try { return JSON.parse(d.body).dialId; } catch { return null; } })();
  if (dialId) {
    await j("POST", `/dial/${dialId}/asr-complete`, { dialId, transcriptUrl: "file://staging", words: [["hi",0,200]], latencyMs: 750 });
  }

  // webhook bad signature (expect 401)
  await new Promise((resolve) => {
    const u = new URL("/twilio/recording-complete", BASE);
    const body = "CallSid=CA_demo&RecordingUrl=https%3A%2F%2Fexample.com%2Frec.mp3";
    const req = http.request(u, {
      method: "POST",
      headers: { "content-type":"application/x-www-form-urlencoded", "content-length": Buffer.byteLength(body), "X-Twilio-Signature": "bogus" }
    }, res => { res.resume(); resolve(); });
    req.on("error", resolve);
    req.write(body); req.end();
  });

  // metrics (optional basic auth)
  const auth = process.env.BASIC_AUTH_USER && process.env.BASIC_AUTH_PASS
    ? "Basic " + Buffer.from(`${process.env.BASIC_AUTH_USER}:${process.env.BASIC_AUTH_PASS}`).toString("base64")
    : null;
  const m = await j("GET", "/metrics", null, auth ? { Authorization: auth } : {});
  if (m.status !== 200) throw new Error("metrics not reachable");

  console.log("Staging smoke OK");
})().catch((e) => { console.error(e); process.exit(1); });
