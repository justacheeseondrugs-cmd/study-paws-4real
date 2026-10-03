import { getBrain } from './brain.js';
import { planSources, redundancyHints } from './source-policy.js';

export const estimateTokens=(chars=0)=>Math.ceil(Number(chars||0)/4);

export function buildContextPlan({preset,mode,depth,subject,unit,lesson,files=[]}){
  const brain=getBrain(preset);
  const ranked=planSources(files,preset);
  const readable=ranked.filter(f=>f.readable);
  const selectedChars=readable.reduce((n,f)=>n+Number(f.textChars||0),0);
  const sourceTokens=estimateTokens(selectedChars);
  const brainTokens=estimateTokens(JSON.stringify(brain).length);
  const pages=readable.reduce((n,f)=>n+Number(f.textPages||0),0);
  let strategy='single_pass',calls=readable.length?1:0,chunkLabel='Una sola llamada con contexto seleccionado';
  if(mode==='slides'&&pages>8){
    strategy='page_blocks';calls=Math.ceil(pages/5);
    chunkLabel='Bloques de ~5 diapositivas para conservar detalle';
  }else if(sourceTokens>12000){
    strategy='selective_chunks';calls=Math.max(2,Math.ceil(sourceTokens/9000));
    chunkLabel='Recuperación selectiva por fragmentos; no enviar todo de una vez';
  }
  const warnings=[];
  if(!files.length) warnings.push('No hay fuentes adjuntas.');
  if(files.length&&!readable.length) warnings.push('Hay archivos, pero ninguno tiene texto leído todavía.');
  warnings.push(...redundancyHints(files));
  return {
    brainVersion:brain.version,brainLabel:brain.course.label,preset,mode,depth,
    subject:subject?.name||'',unit:unit?.name||'',lesson:lesson?.name||'',
    sources:ranked,readableSources:readable.length,totalSources:files.length,
    selectedChars,sourceTokens,estimatedInputTokens:sourceTokens+brainTokens+900,
    pages,strategy,calls,chunkLabel,warnings
  };
}
