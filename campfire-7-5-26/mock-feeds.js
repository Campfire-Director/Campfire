/* A local stand-in for the outside internet: serves an RSS feed full of
   the entity soup Sam reported ("&amp;#39;" and friends) and a fake Reddit
   that 301-redirects first — exactly the behaviors the fixes target. */
const http = require('http');

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
