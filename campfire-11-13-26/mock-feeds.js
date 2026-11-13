/* A local stand-in for the outside internet, so the live theme sources
   can be tested offline. It serves:
     /rss         a news feed full of entity soup ("&amp;#39;" and friends)
     /onion       an Onion-shaped RSS feed (gzipped, 2 pages, with items
                  the game must skip: a chart, a video, a blocked word)
     /w/api.php   a Wikipedia-shaped parse API ("Unusual articles" tables
                  and the "Did you know" list), markup copied from the
                  real pages
   Run the game against it with:
     NEWS_FEEDS_JSON='[{"name":"MOCK","url":"http://localhost:3999/rss"}]' \
     ONION_FEED_URL=http://localhost:3999/onion \
     WIKI_API_URL=http://localhost:3999/w/api.php  node server.js */
const http = require('http');
const zlib = require('zlib');

const RSS = `<?xml version="1.0"?>
<rss><channel>
  <title>Mock News Feed</title>
  <item><title>Ben &amp;amp; Jerry&amp;#39;s announces &quot;world&amp;rsquo;s largest&quot; ice cream</title></item>
  <item><title><![CDATA[Mayor says town &amp; council won&#8217;t ban Tuesdays &#x2014; yet]]></title></item>
  <item><title>Scientists find &lt;b&gt;giant&lt;/b&gt; squid   near lighthouse</title></item>
</channel></rss>`;

const onionItem = (title, cats) => `
	<item>
		<title>${title}</title>
		<link>https://theonion.com/x/</link>
		<dc:creator><![CDATA[The Onion Staff]]></dc:creator>
		${cats.map(c => `<category><![CDATA[${c}]]></category>`).join('\n\t\t')}
		<description><![CDATA[<p>The post <a href="https://theonion.com/x/">x</a> appeared first on The Onion.</p>]]></description>
	</item>`;
const onionPage = (items) => `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel>
	<title>The Onion</title>${items.join('')}
</channel></rss>`;
const ONION = {
  1: onionPage([
    onionItem('Basketball Scouts See Potential In 7-Foot-5 Toddler', ['News', 'Sports']),
    onionItem('Evolution Of The U.S. Flag', ['Statshot']),                         // a chart, not a headline
    onionItem('Area Man Gathers Friends To Watch Porn', ['News', 'Pornography']),   // blocked word
  ]),
  2: onionPage([
    onionItem('Graceland Celebrates First Elvis Born In&#8230; Captivity', ['News', 'Music']),
    onionItem('Is Violence Becoming Too Political?', ['In The Know', 'Video']),     // a video
    onionItem('Basketball Scouts See Potential In 7-Foot-5 Toddler', ['News']),     // duplicate of page 1
  ]),
};

const UNUSUAL = `<div class="mw-content-ltr mw-parser-output"><h2 id="History">History</h2><h3 id="Pre-modern">Pre-modern</h3>
<table class="wikitable"><tbody><tr>
<td width="30%"><b><a href="/wiki/Bal_des_Ardents" title="Bal des Ardents">Bal des Ardents</a></b>
</td>
<td width="70%">A masquerade ball in which the king and some dancers accidentally get set on fire.<sup id="cite_ref-1" class="reference"><a href="#cite_note-1">&#91;1&#93;</a></sup>
</td></tr>
<tr>
<td><span typeof="mw:File"><a href="/wiki/File:Star.svg" class="mw-file-description"><img alt="" src="//x/star.png" width="16" height="16"></a></span> <b><a href="/wiki/Emu_War" title="Emu War">Emu War</a></b>
</td>
<td>Australia&#39;s army loses a war against <a href="/wiki/Emu" title="Emu">emus</a>.
</td></tr>
<tr>
<td><b><a href="/wiki/Something" title="Something">Something Racy</a></b>
</td>
<td>A treatise on sexual customs that the game should skip.
</td></tr></tbody></table></div>`;
const DYK = `<div class="mw-parser-output"><ul><li>... that before being accepted to theatre school, Swedish actress <b><a href="/wiki/Amanda_Jansson" title="Amanda Jansson">Amanda Jansson</a></b> <i>(pictured)</i> worked at a nuclear power plant?</li>
<li><a href="/wiki/Archive">Archive</a></li><li><a href="/wiki/Start">Start a new article</a></li></ul></div>`;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost:3999');
  if (url.pathname === '/rss') {
    res.writeHead(200, { 'Content-Type': 'application/rss+xml' });
    return res.end(RSS);
  }
  if (url.pathname === '/onion') {
    const page = ONION[url.searchParams.get('paged') || '1'];
    if (!page) { res.writeHead(404); return res.end('no such page'); }   // page 3: the game must shrug this off
    res.writeHead(200, { 'Content-Type': 'application/rss+xml; charset=UTF-8', 'Content-Encoding': 'gzip' });
    return res.end(zlib.gzipSync(Buffer.from(page)));
  }
  if (url.pathname === '/w/api.php') {
    const page = url.searchParams.get('page') || '';
    if (!/CampfirePartyGame/.test(req.headers['user-agent'] || '')) { res.writeHead(403); return res.end('identify yourself'); }
    const text = page === 'Template:Did_you_know' ? DYK
      : page.startsWith('Wikipedia:Unusual_articles/') ? UNUSUAL : null;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(text
      ? JSON.stringify({ parse: { title: page, pageid: 1, text } })
      : JSON.stringify({ error: { code: 'missingtitle', info: "The page you specified doesn't exist." } }));
  }
  res.writeHead(404); res.end('nope');
});
server.listen(3999, () => console.log('mock feeds on :3999'));
