// Development: rebuilds the browser app and CSS on change and restarts the server when server code changes.
import * as esbuild from 'esbuild';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { buildCss, clientOptions, copyStatic } from './build.mjs';

const root = path.resolve(import.meta.dirname, '..');
copyStatic();

const ctx = await esbuild.context({ ...clientOptions, minify: false, sourcemap: 'inline', define: { 'process.env.NODE_ENV': '"development"' } });
await ctx.watch();

const css = spawn(process.execPath, buildCss({ watchMode: true }), { stdio: 'inherit', cwd: root });
const server = spawn(process.execPath, ['--import', 'tsx', '--watch', '--watch-path=server', '--watch-path=shared', 'server/index.ts'], {
  stdio: 'inherit',
  cwd: root,
  env: { ...process.env, NODE_ENV: 'development' },
});

const stop = () => {
  css.kill();
  server.kill();
  ctx.dispose().then(() => process.exit(0));
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
