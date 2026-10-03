import { getBrain } from './brain.js';
import { planSources } from './source-policy.js';

export function buildPromptPackage(request){
  return {
    brain:getBrain(request.preset),
    task:{
      subject:request.subject?.name||'',
      unit:request.unit?.name||'',
      lesson:request.lesson?.name||'',
      guideMode:request.mode,
      depth:request.depth,
      options:request.options||{}
    },
    sourcePolicy:{
      preserveProvenance:true,
      neverSilentlyCorrectTeacher:true,
      distinguishExternalAdditions:true
    },
    sources:planSources(request.files||[],request.preset)
      .filter(f=>f.text?.trim())
      .map(f=>({name:f.name,type:f.type,sourceUse:f.sourceUse||'auto',note:f.sourceNote||'',text:f.text}))
  };
}
