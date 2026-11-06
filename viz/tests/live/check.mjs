// GL2 replaces the Canvas cache implementation. Preserve behaviour/depth/replay/UI
// coverage in the real Go-page harness; zoom-tier cache rebuilds are no longer a contract.
import {spawnSync} from 'node:child_process';
const result=spawnSync(process.execPath,[new URL('../gl/check.cjs',import.meta.url).pathname],{stdio:'inherit'});
process.exit(result.status??1);
