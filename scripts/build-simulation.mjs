import {build} from 'esbuild';
await build({entryPoints:['./lib/simulation/worker.ts'],bundle:true,platform:'browser',format:'esm',target:'es2020',outfile:'public/simulation-worker.js',minify:true});
