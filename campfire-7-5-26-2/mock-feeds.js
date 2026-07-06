/* A local stand-in for the outside internet: serves an RSS feed full of
   the entity soup Sam reported ("&amp;#39;" and friends) and a fake Reddit
   that 301-redirects first — exactly the behaviors the fixes target. */
const http = require('http');
const zlib = require('zlib');

const RSS = `<?xml version="1.0"?>
<rss><channel>
  <title>Mock News Feed</title>
  <item><title>Ben &amp;amp; Jerry&amp;#39;s announces &quot;world&amp;rsquo;s largest&quot; ice cream</title></item>
  <item><title><![CDATA[Mayor says town &amp; council won&#8217;t ban Tuesdays &#x2014; yet]]></title></item>
  <item><title>Scientists find &lt;b&gt;giant&lt;/b&gt; squid   near lighthouse</title></item>
</channel></rss>`;

const REDDIT = JSON.stringify({
  data: { children: [
    { data: { title: 'If tomatoes are fruit, ketchup is technically jam', over_18: false, stickied: false } },
    { data: { title: 'My cat won&#39;t stop &quot;helping&quot; me work', over_18: false, stickied: false } },
    { data: { title: 'VERY NSFW THING', over_18: true, stickied: false } },
    { data: { title: 'PINNED: sub rules', over_18: false, stickied: true } },
  ] },
});

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/rss')) {
    res.writeHead(200, { 'Content-Type': 'application/rss+xml' });
    return res.end(RSS);
  }
  // OAuth: token endpoint (checks it's a POST with basic auth)
  if (req.url.startsWith('/api/v1/access_token')) {
    if (req.method !== 'POST' || !(req.headers.authorization || '').startsWith('Basic ')) {
      res.writeHead(401); return res.end('{"error":"unauthorized"}');
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ access_token: 'mock-token-123', token_type: 'bearer', expires_in: 3600 }));
  }
  // OAuth: data endpoint — requires the bearer token, and responds
  // GZIPPED to prove the fetcher decompresses correctly
  if (req.url.startsWith('/r/') && !req.url.includes('.json')) {
    if ((req.headers.authorization || '') !== 'Bearer mock-token-123') {
      res.writeHead(403); return res.end('{"error":"forbidden"}');
    }
    const gz = zlib.gzipSync(Buffer.from(REDDIT));
    res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' });
    return res.end(gz);
  }
  if (req.url.includes('/hot.json') && !req.url.includes('followed')) {
    // first hop: redirect, like reddit loves to do
    res.writeHead(301, { Location: 'http://localhost:3999' + req.url.replace('/hot.json', '/hot.json') + '&followed=1' });
    return res.end();
  }
  if (req.url.includes('followed')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(REDDIT);
  }
  res.writeHead(404); res.end('nope');
});
server.listen(3999, () => console.log('mock feeds on :3999'));
