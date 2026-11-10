const paths = ['/', '/index.html', '/ai-video-studio/api/previz', '/ai-video-studio/client.js', '/favicon.ico'];
for (const p of paths) {
  try {
    const r = await fetch('http://127.0.0.1:12616' + p, { redirect: 'manual' });
    const buf = Buffer.from(await r.arrayBuffer());
    const h = {};
    r.headers.forEach((v, k) => { h[k] = v; });
    console.log(`\n${p}\n  HTTP ${r.status} ${r.statusText}\n  CT=${h['content-type'] || ''}  bytes=${buf.length}`);
    if (h['www-authenticate']) console.log('  WWW-Authenticate=' + h['www-authenticate']);
    console.log('  BODY=' + JSON.stringify(buf.toString('utf8').slice(0, 240)));
  } catch (e) {
    console.log(`\n${p}\n  FETCH_ERROR: ${e.message}`);
  }
}
