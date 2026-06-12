// Static inputs compiled into the bundle: the KB (it is the product) and the
// synthetic Vista del Sol project, kept only as a sample the load screen can
// stage. Real projects arrive at runtime as dossier.json + room_program.json
// file picks — one built artifact serves every project, no rebuild per school.
// No backend, no runtime network (plan §0.1/§3).

import { kb } from '@lausd-pa/kb';
import sampleDossier from '../../../synthetic/vista-del-sol/dossier.json';
import sampleRoomProgramV1 from '../../../synthetic/vista-del-sol/room_program.json';
import sampleRoomProgramV2 from '../../../synthetic/vista-del-sol/room_program.v2.json';

export { kb };

export const sample = {
  dossier: sampleDossier as unknown,
  roomProgramV1: sampleRoomProgramV1 as unknown,
  roomProgramV2: sampleRoomProgramV2 as unknown,
  projectId: sampleDossier.project.project_id,
};
