// Static inputs: the KB and the synthetic project, bundled at build time.
// No backend, no runtime network (plan §0.1/§3) — the engine reads the
// synthetic inputs verbatim from /synthetic.

import { kb } from '@lausd-pa/kb';
import dossierJson from '../../../synthetic/vista-del-sol/dossier.json';
import roomProgramV1 from '../../../synthetic/vista-del-sol/room_program.json';
import roomProgramV2 from '../../../synthetic/vista-del-sol/room_program.v2.json';

export { kb, dossierJson, roomProgramV1, roomProgramV2 };

export const PROJECT_ID: string = dossierJson.project.project_id;
export const PROJECT_NAME: string = dossierJson.project.name;
