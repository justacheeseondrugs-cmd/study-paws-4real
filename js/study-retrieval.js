// Study Paws V0.5 · indexación y recuperación local, sin IA.
// Inspirado en la idea de retrieval de Inky Paws, adaptado a material académico:
// conserva procedencia, páginas/diapositivas y fragmentos de transcripción.

const INDEX_VERSION = 1;
const TRANSCRIPT_WORDS = 180;
const TRANSCRIPT_OVERLAP = 35;
const MAX_RESULTS = 12;
const MAX_PER_SOURCE = 4;

const STOPWORDS = new Set(
  ('de la que el en y a los se del las un por con no una su para es al lo como mas más o pero sus le ya fue este esta ' +
   'ha hay si sí porque entre cuando muy sin sobre tambien también me hasta donde quien desde todo todos uno unos unas otro otra otros otras ' +
   'qué que para por del al lo los las una uno es son ser se en con como esto esta este estos estas ' +
   'the of and to in a is that it for on with as was were are be this these those from into by or not ' +
   'clase diapositiva diapositivas pagina página ppt pdf transcripcion transcripción documento material').split(/\s+/)
);

function normalize(value=''){
  return String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}

export function tokenizeStudyText(text=''){
  return normalize(text)
    .replace(/[^a-z0-9ñü+%./-\s]/gi,' ')
    .split(/\s+/)
    .filter(t=>t.length>2&&!STOPWORDS.has(t));
}

function topTerms(text, max=12){
  const counts={};
  for(const t of tokenizeStudyText(text)) counts[t]=(counts[t]||0)+1;
  return Object.entries(counts).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,max).map(([t])=>t);
}

function headingHint(text=''){
  const line=String(text).split(/\n+/).map(x=>x.trim()).find(x=>x.length>=3&&x.length<=120);
  return line||'';
}

function chunkTranscript(text,fileId){
  const words=String(text||'').split(/\s+/).filter(Boolean);
  const chunks=[];
  const step=Math.max(1,TRANSCRIPT_WORDS-TRANSCRIPT_OVERLAP);
  for(let i=0;i<words.length;i+=step){
    const slice=words.slice(i,i+TRANSCRIPT_WORDS);
    if(!slice.length) break;
    const body=slice.join(' ');
    chunks.push({
      id:`${fileId}:t:${chunks.length}`,
      fileId,index:chunks.length,kind:'text',page:null,
      title:headingHint(body),text:body,wordCount:slice.length,terms:topTerms(body)
    });
    if(i+TRANSCRIPT_WORDS>=words.length) break;
  }
  return chunks;
}

function chunkPagedText(text,fileId){
  const re=/\[\[STUDY_PAWS_PAGE:(\d+)\]\]/g;
  const matches=[...String(text||'').matchAll(re)];
  if(!matches.length) return null;
  const chunks=[];
  for(let i=0;i<matches.length;i++){
    const page=Number(matches[i][1]);
    const start=matches[i].index+matches[i][0].length;
    const end=i+1<matches.length?matches[i+1].index:text.length;
    const body=String(text.slice(start,end)).trim();
    chunks.push({
      id:`${fileId}:p:${page}`,fileId,index:i,kind:'page',page,
      title:headingHint(body)||`Diapositiva ${page}`,
      text:body,wordCount:body.split(/\s+/).filter(Boolean).length,terms:topTerms(body)
    });
  }
  return chunks;
}

export function buildDocumentIndex({fileId,name,type,text,textPages=0}){
  const paged=chunkPagedText(text,fileId);
  const chunks=paged||chunkTranscript(text,fileId);
  return {
    version:INDEX_VERSION,fileId,name,type,textPages:Number(textPages||0),
    createdAt:Date.now(),
    kind:paged?'paged':'text',
    chunkCount:chunks.length,
    terms:topTerms(text,20),
    chunks
  };
}

function queryCounts(query=''){
  const counts={};
  for(const t of tokenizeStudyText(query)) counts[t]=(counts[t]||0)+1;
  return counts;
}

function scoreChunk(chunk,counts){
  const tokens=tokenizeStudyText([chunk.title,chunk.text].filter(Boolean).join(' '));
  if(!tokens.length) return 0;
  let raw=0;
  const seen=new Set();
  for(const t of tokens){
    if(seen.has(t)) continue;
    seen.add(t);
    if(counts[t]) raw+=counts[t]*(chunk.terms?.includes(t)?1.15:1);
  }
  return raw/Math.sqrt(tokens.length);
}

export function retrieveRelevantChunks(indexes=[],query='',{
  maxResults=MAX_RESULTS,maxPerSource=MAX_PER_SOURCE,alwaysIncludePages=[]
}={}){
  const counts=queryCounts(query);
  const chosen=[];
  for(const idx of indexes||[]){
    const scored=(idx?.chunks||[]).map(c=>({...c,sourceName:idx.name,sourceType:idx.type,score:scoreChunk(c,counts)}));
    const forced=scored.filter(c=>c.page&&alwaysIncludePages.includes(c.page));
    const ranked=scored.filter(c=>!forced.some(f=>f.id===c.id)).sort((a,b)=>b.score-a.score);
    const positive=ranked.filter(c=>c.score>0).slice(0,Math.max(0,maxPerSource-forced.length));
    const fallback=!positive.length&&!forced.length&&ranked.length?[ranked[0]]:[];
    chosen.push(...forced,...positive,...fallback);
  }
  const dedup=new Map(chosen.map(c=>[c.id,c]));
  return [...dedup.values()]
    .sort((a,b)=>b.score-a.score||(a.page||9999)-(b.page||9999))
    .slice(0,maxResults);
}

export function summarizeIndex(index){
  return {
    name:index?.name||'',type:index?.type||'other',kind:index?.kind||'text',
    chunks:index?.chunkCount||0,pages:index?.textPages||0,terms:(index?.terms||[]).slice(0,10)
  };
}
