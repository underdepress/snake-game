// AcWing 剑指Offer Tracker — Cloudflare Worker
// Deploy via Cloudflare Dashboard: Workers & Pages → Create → Create Worker
// Then create KV namespace and bind it as "PROGRESS"

const VALID_IDS = new Set();
for (let i = 13; i <= 88; i++) VALID_IDS.add(i);

async function getDone(env) {
  const val = await env.PROGRESS.get('done', 'json');
  return val || [];
}

async function setDone(env, done) {
  // Sort and deduplicate
  const unique = [...new Set(done)].sort((a, b) => a - b);
  await env.PROGRESS.put('done', JSON.stringify(unique));
  return unique;
}

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors() });
    }

    // GET /progress
    if (request.method === 'GET' && url.pathname === '/progress') {
      const done = await getDone(env);
      return new Response(JSON.stringify({ done }), { headers: cors() });
    }

    // POST /mark-done
    if (request.method === 'POST' && url.pathname === '/mark-done') {
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return new Response(JSON.stringify({ error: 'invalid json' }), {
          status: 400, headers: cors()
        });
      }

      const problemId = parseInt(body.problemId, 10);
      if (!VALID_IDS.has(problemId)) {
        return new Response(JSON.stringify({ error: 'problem not in list' }), {
          status: 400, headers: cors()
        });
      }

      const done = await getDone(env);
      if (!done.includes(problemId)) {
        done.push(problemId);
        await setDone(env, done);
      }

      return new Response(JSON.stringify({ ok: true, problemId, total: done.length }), {
        headers: cors()
      });
    }

    // Fallback: serve a simple status page
    return new Response(
      JSON.stringify({ status: 'AcWing Tracker Worker', endpoints: ['GET /progress', 'POST /mark-done'] }),
      { headers: cors() }
    );
  }
};
