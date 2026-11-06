// GL2: real headed rAF with active work/journal events replaces Canvas cache timing.
import {spawnSync} from 'node:child_process';
const result=spawnSync(process.execPath,[new URL('../gl/perf.cjs',import.meta.url).pathname],{stdio:'inherit'});
process.exit(result.status??1);
