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
  files=[],indexes=[],alignments=[],query='',preset='interna_materia',mode='complete',focused=false
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
      const savedAlignment=pair?alignments.find(a=>a?.slideId===pair.slideId&&a?.transcriptId===pair.transcriptId):null;

      if(transcriptIndex&&firstSlides.length){
        let related=[];
        if(savedAlignment?.items?.length){
          const wantedPages=new Set(firstSlides.map(s=>s.page||s.index+1));
          const wantedChunks=new Set(
            savedAlignment.items
              .filter(item=>wantedPages.has(item.page))
              .flatMap(item=>item.transcriptMatches||[])
              .filter(m=>m.confidence!=='baja')
              .map(m=>m.chunk)
          );
          related=(transcriptIndex.chunks||[])
            .filter(c=>wantedChunks.has(c.index+1))
            .map(c=>({...c,sourceName:transcriptIndex.name,sourceType:transcriptIndex.type,score:998}));
          if(related.length) strategy='first_slide_block_aligned';
        }
        if(!related.length){
          const q=firstSlides.map(c=>[c.title,c.text].filter(Boolean).join(' ')).join(' ');
          related=retrieveRelevantChunks([transcriptIndex],q,{maxResults:4,maxPerSource:4});
        }
        selected.push(...related);
      }
    }
  }

  if(!selected.length){
    selected=retrieveRelevantChunks(indexes,query,{
      maxResults:pageMode?16:12,
      maxPerSource:pageMode?6:4
    });

    // Si una búsqueda enfocada seleccionó una slide concreta, añade la explicación
    // de transcripción previamente alineada con esa slide.
    const selectedSlides=selected.filter(c=>c.page&&SLIDE_TYPES.has(c.sourceType));
    for(const slide of selectedSlides){
      const slideFile=files.find(f=>f.name===slide.sourceName&&SLIDE_TYPES.has(f.type));
      const pair=slideFile?pairs.find(p=>p.slideId===slideFile.id):null;
      const alignment=pair?alignments.find(a=>a?.slideId===pair.slideId&&a?.transcriptId===pair.transcriptId):null;
      const transcriptIndex=pair?indexes.find(idx=>idx?.fileId===pair.transcriptId):null;
      const item=alignment?.items?.find(x=>x.page===slide.page);
      if(item&&transcriptIndex){
        const wanted=new Set((item.transcriptMatches||[]).filter(m=>m.confidence!=='baja').map(m=>m.chunk));
        const additions=(transcriptIndex.chunks||[])
          .filter(c=>wanted.has(c.index+1))
          .map(c=>({...c,sourceName:transcriptIndex.name,sourceType:transcriptIndex.type,score:997}));
        selected.push(...additions);
      }
    }
  }

  const dedup=new Map(selected.map(c=>[c.id||`${c.sourceName}:${c.index}:${c.page||''}`,c]));
  selected=[...dedup.values()];

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
  let cursor=0;

  for(const slide of slideIndex.chunks||[]){
    const q=[slide.title,slide.text].filter(Boolean).join(' ');
    const candidates=retrieveRelevantChunks([transcriptIndex],q,{maxResults:8,maxPerSource:8});

    // En una clase real la explicación suele avanzar junto con las slides.
    // Permitimos retroceder un fragmento por solapamiento, pero favorecemos
    // candidatos cercanos al último punto de la transcripción usado.
    const forward=candidates.filter(m=>m.index>=Math.max(0,cursor-1));
    const pool=forward.length?forward:candidates;
    const ranked=pool.map(m=>{
      const distance=Math.abs(m.index-cursor);
      const proximityBoost=distance<=1?0.10:distance<=3?0.05:0;
      const backwardPenalty=m.index<cursor-1?0.18:0;
      return {m,adjusted:Number(m.score||0)+proximityBoost-backwardPenalty};
    }).sort((a,b)=>b.adjusted-a.adjusted||a.m.index-b.m.index);

    const best=ranked[0]?.m;
    const selected=[];
    if(best){
      selected.push(best);
      const adjacent=pool
        .filter(m=>m.id!==best.id&&Math.abs(m.index-best.index)===1&&Number(m.score||0)>0)
        .sort((a,b)=>b.score-a.score)[0];
      if(adjacent&&selected.length<maxTranscriptChunks) selected.push(adjacent);
      cursor=Math.max(cursor,best.index);
    }

    const matches=selected.slice(0,maxTranscriptChunks).sort((a,b)=>a.index-b.index);
    out.push({
      page:slide.page||slide.index+1,
      slideTitle:slide.title||`Diapositiva ${slide.page||slide.index+1}`,
      transcriptMatches:matches.map(m=>{
        const score=Number(m.score||0);
        return {
          chunk:m.index+1,
          text:m.text,
          score,
          confidence:score>=0.16?'alta':score>=0.075?'media':'baja'
        };
      })
    });
  }
  return out;
}
