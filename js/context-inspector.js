// Construye una vista legible de lo que recibirá la futura IA.
import { buildStudyQuery, buildSmartClassContext } from './smart-class.js';

export function inspectContext({subject,unit,lesson,preset,mode,focus='',files=[],indexes=[]}={}){
  const query=buildStudyQuery({
    subject:subject?.name||'',unit:unit?.name||'',lesson:lesson?.name||'',
    preset,mode,focus
  });
  return buildSmartClassContext({files,indexes,query,preset,mode});
}

export function contextToMarkdown(ctx,{brainLabel='Study Paws Brain'}={}){
  const lines=[
    '# 👀 Study Paws Context Inspector',
    '',
    `**Brain:** ${brainLabel}`,
    `**Consulta local:** ${ctx.query||'(sin consulta)'}`,
    `**Contexto seleccionado:** ~${ctx.estimatedTokens.toLocaleString('es-CL')} tokens`,
    ''
  ];
  if(ctx.pairs?.length){
    lines.push('## 🧩 Materiales emparejados');
    for(const p of ctx.pairs) lines.push(`- ${p.slideName} ↔ ${p.transcriptName} · confianza ${p.confidence}`);
    lines.push('');
  }
  lines.push('## 📚 Fragmentos seleccionados');
  if(!ctx.selected?.length) lines.push('- Ninguno todavía.');
  for(const c of ctx.selected||[]){
    const loc=c.page?`diapositiva/página ${c.page}`:`fragmento ${c.index+1}`;
    lines.push(`### ${c.sourceName} · ${loc}`);
    lines.push(`Procedencia: ${c.sourceType} · score local ${Number(c.score||0).toFixed(3)}`);
    lines.push('');
    lines.push(String(c.text||'').slice(0,1400));
    lines.push('');
  }
  return lines.join('\n');
}
