// Study Paws V0.5 · Smart Class Engine.
// Relaciona materiales de una misma clase y prepara contexto académico explicable.

import { retrieveRelevantChunks } from './study-retrieval.js';

const SLIDE_TYPES=new Set(['ppt','pdf']);

function normalizeName(name=''){
  return String(name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/\.[^.]+$/,'')
    .replace(/\b(transcripcion|transcript|tipeo|ppt|presentacion|presentacion|slides|diapositivas|copia|final|version)\b/g,' ')
    .replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
}
function nameTokens(name=''){
  return new Set(normalizeName(name).split(' ').filter(x=>x.length>1));
}
function jaccard(a,b){
  if(!a.size||!b.size) return 0;
  let inter=0;
  for(const x of a) if(b.has(x)) inter++;
  return inter/(a.size+b.size-inter);
}
function classNumber(name=''){
  const n=normalizeName(name);
  const m=n.match(/(?:clase|class)?\s*(\d{1,3})\b/)||n.match(/\b(\d{1,3})\b/);
  return m?m[1]:'';
}

export function detectMaterialPairs(files=[]){
  const slides=files.filter(f=>SLIDE_TYPES.has(f.type));
  const transcripts=files.filter(f=>f.type==='transcript');
  const candidates=[];
  for(const slide of slides){
    for(const transcript of transcripts){
      const a=nameTokens(slide.name),b=nameTokens(transcript.name);
      const overlap=jaccard(a,b);
      const na=classNumber(slide.name),nb=classNumber(transcript.name);
      const numberBonus=na&&nb&&na===nb?0.55:0;
      const sameLessonBonus=0.15;
      const score=Math.min(1,overlap+numberBonus+sameLessonBonus);
      candidates.push({slideId:slide.id,transcriptId:transcript.id,slideName:slide.name,transcriptName:transcript.name,score});
    }
  }
  candidates.sort((a,b)=>b.score-a.score);
  const usedS=new Set(),usedT=new Set(),pairs=[];
  for(const c of candidates){
    if(usedS.has(c.slideId)||usedT.has(c.transcriptId)) continue;
    if(c.score<0.2) continue;
    usedS.add(c.slideId);usedT.add(c.transcriptId);
    pairs.push({...c,confidence:c.score>=0.7?'alta':c.score>=0.45?'media':'baja'});
  }
  return pairs;
}

export function buildStudyQuery({subject='',unit='',lesson='',preset='',mode='',focus=''}={}){
  return [subject,unit,lesson,preset.replaceAll('_',' '),mode,focus].filter(Boolean).join(' ');
}

export function buildSmartClassContext({
  files=[],indexes=[],query='',preset='interna_materia',mode='complete',focused=false
}={}){
  const pairs=detectMaterialPairs(files);
  const pageMode=mode==='slides';
  let selected=[];
  let strategy='smart_retrieval';

  // Para una guía completa slide-by-slide, el futuro backend trabajará por bloques.
  // El inspector muestra el PRIMER bloque real (5 slides) + transcripción relacionada,
  // en vez de fingir que enviaría las 41 páginas juntas.
  if(pageMode&&!focused){
    const slideIndex=indexes.find(idx=>SLIDE_TYPES.has(idx?.type)&&idx?.kind==='paged');
    if(slideIndex){
      const firstSlides=(slideIndex.chunks||[]).slice(0,5).map(c=>({
        ...c,sourceName:slideIndex.name,sourceType:slideIndex.type,score:999
      }));
      selected.push(...firstSlides);
      strategy='first_slide_block';

      const pair=pairs.find(p=>p.slideId===slideIndex.fileId);
      const transcriptIndex=pair?indexes.find(idx=>idx?.fileId===pair.transcriptId):null;
      if(transcriptIndex&&firstSlides.length){
        const q=firstSlides.map(c=>[c.title,c.text].filter(Boolean).join(' ')).join(' ');
        const related=retrieveRelevantChunks([transcriptIndex],q,{maxResults:4,maxPerSource:4});
        selected.push(...related);
      }
    }
  }

  if(!selected.length){
    selected=retrieveRelevantChunks(indexes,query,{
      maxResults:pageMode?16:12,
      maxPerSource:pageMode?6:4
    });
  }

  const selectedChars=selected.reduce((n,c)=>n+String(c.text||'').length,0);
  return {
    preset,mode,query,pairs,selected,strategy,
    selectedChars,estimatedTokens:Math.ceil(selectedChars/4),
    provenance:selected.map(c=>({
      sourceName:c.sourceName,sourceType:c.sourceType,page:c.page||null,
      chunk:c.index+1,score:Number((c.score||0).toFixed(3))
    }))
  };
}

export function alignSlidesWithTranscript(slideIndex,transcriptIndex,{maxTranscriptChunks=2}={}){
  if(!slideIndex||!transcriptIndex) return [];
  const out=[];
  for(const slide of slideIndex.chunks||[]){
    const q=[slide.title,slide.text].filter(Boolean).join(' ');
    const matches=retrieveRelevantChunks([transcriptIndex],q,{maxResults:maxTranscriptChunks,maxPerSource:maxTranscriptChunks});
    out.push({
      page:slide.page||slide.index+1,
      slideTitle:slide.title||`Diapositiva ${slide.page||slide.index+1}`,
      transcriptMatches:matches.map(m=>({chunk:m.index+1,text:m.text,score:m.score}))
    });
  }
  return out;
}
