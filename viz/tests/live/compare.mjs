// GL2: matching source-camera views and landing/roof/junction evidence.
// The source coordinator directory must be served on 9038 (see ../gl/README.md).
import {spawnSync} from 'node:child_process';
const result=spawnSync(process.execPath,[new URL('../gl/capture.cjs',import.meta.url).pathname],{stdio:'inherit'});
process.exit(result.status??1);
