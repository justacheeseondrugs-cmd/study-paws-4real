import { getBrain } from './brain.js';
import { planSources } from './source-policy.js';

// Empaqueta el trabajo YA decidido por la PWA.
// Si existe smartContext, la futura IA recibe fragmentos seleccionados con procedencia;
// no vuelve a tragarse los documentos completos.
export function buildPromptPackage(request){
  const smart=request.smartContext;
  const smartChunks=(smart?.selected||[]).map(c=>({
    sourceName:c.sourceName,
    sourceType:c.sourceType,
    page:c.page||null,
    chunk:c.index+1,
    score:Number((c.score||0).toFixed(3)),
    text:c.text||''
  }));

  const fallbackSources=planSources(request.files||[],request.preset)
    .filter(f=>f.text?.trim())
    .map(f=>({
      sourceName:f.name,
      sourceType:f.type,
      sourceUse:f.sourceUse||'auto',
      note:f.sourceNote||'',
      page:null,
      chunk:null,
      text:f.text
    }));

  return {
    brain:getBrain(request.preset),
    task:{
      subject:request.subject?.name||'',
      unit:request.unit?.name||'',
      lesson:request.lesson?.name||'',
      guideMode:request.mode,
      depth:request.depth,
      focus:request.focus||'',
      options:request.options||{}
    },
    sourcePolicy:{
      preserveProvenance:true,
      teacherMaterialDefinesEvaluativeScope:request.preset!=='interna_practica',
      neverSilentlyCorrectTeacher:true,
      distinguishExternalAdditions:true
    },
    context:{
      strategy:smart?.strategy||'full_readable_fallback',
      estimatedTokens:smart?.estimatedTokens||0,
      pairs:smart?.pairs||[]
    },
    sources:smartChunks.length?smartChunks:fallbackSources
  };
}
