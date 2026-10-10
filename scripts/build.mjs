// Production build: bundles the browser app and the server with esbuild, and compiles Tailwind CSS.
import * as esbuild from 'esbuild';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'dist');
const pub = path.join(out, 'public');
const watch = process.argv.includes('--watch');

export const clientOptions = {
  entryPoints: { app: path.join(root, 'client/main.tsx') },
  outdir: path.join(pub, 'assets'),
  bundle: true,
  splitting: true,
  format: 'esm',
  platform: 'browser',
  target: ['es2020', 'chrome90', 'firefox90', 'safari15'],
  jsx: 'automatic',
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  chunkNames: 'chunks/[name]-[hash]',
  define: { 'process.env.NODE_ENV': JSON.stringify(watch ? 'development' : 'production') },
  logLevel: 'info',
};

export const serverOptions = {
  entryPoints: [path.join(root, 'server/index.ts')],
  outfile: path.join(out, 'server.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  packages: 'external',
  sourcemap: true,
  logLevel: 'info',
};

export function copyStatic() {
  fs.mkdirSync(pub, { recursive: true });
  fs.cpSync(path.join(root, 'client/public'), pub, { recursive: true });
  const build = Date.now().toString(36);
  const html = fs.readFileSync(path.join(root, 'client/index.html'), 'utf8').replaceAll('%BUILD%', build);
  fs.writeFileSync(path.join(pub, 'index.html'), html);
}

export function buildCss({ watchMode = false } = {}) {
  const args = [path.join(root, 'node_modules/tailwindcss/lib/cli.js'), '-c', path.join(root, 'tailwind.config.cjs'), '-i', path.join(root, 'client/styles.css'), '-o', path.join(pub, 'assets/app.css')];
  if (watchMode) return args.concat('--watch');
  execFileSync(process.execPath, args.concat('--minify'), { stdio: 'inherit', cwd: root });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fs.rmSync(out, { recursive: true, force: true });
  copyStatic();
  await Promise.all([esbuild.build(clientOptions), esbuild.build(serverOptions)]);
  buildCss();
  console.log('\n✔ Build complete. Start the site with: npm start');
}
