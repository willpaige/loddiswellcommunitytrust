import { createServer } from 'node:http';
import { build } from 'esbuild';
import path from 'node:path';
const root = process.cwd();
const result = await build({
  stdin: { contents: `import React from 'react'; import { createRoot } from 'react-dom/client'; import { BookingRequirementsForm } from './src/components/account/booking-requirements-form'; import { initialDetail } from './tests/browser/fake-actions'; createRoot(document.getElementById('app')).render(<BookingRequirementsForm bookingId="booking" detail={initialDetail} locked={false} confirmed={true} />);`, resolveDir: root, loader: 'tsx' },
  bundle: true, write: false, platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' },
  plugins: [{ name: 'isolated-services', setup(build) {
    build.onResolve({ filter: /^@\/actions\/booking-requirements$/ }, () => ({ path: path.join(root, 'tests/browser/fake-actions.ts') }));
    build.onResolve({ filter: /^@vercel\/blob\/client$/ }, () => ({ path: path.join(root, 'tests/browser/fake-blob.ts') }));
  } }],
});
createServer((req, res) => {
  if (req.url === '/app.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(result.outputFiles[0].text); }
  else { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><head><title>Requirements browser test</title></head><body><main id="app"></main><script src="/app.js"></script></body></html>'); }
}).listen(3199, '127.0.0.1');
