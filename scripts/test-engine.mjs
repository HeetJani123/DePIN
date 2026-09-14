import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
await build({entryPoints:['tests/engine.test.ts'],bundle:true,platform:'node',format:'cjs',outfile:'.sites-runtime/engine.test.cjs'});
const result=spawnSync(process.execPath,['--test','.sites-runtime/engine.test.cjs'],{stdio:'inherit'});
process.exit(result.status??1);
