// Estado reanudable de generaciones IA.
// Cada bloque se guarda al terminar: si falla el bloque 6, no perdemos 1–5.
import { getState, update, newId } from './storage.js';

export const JOB_STATUS={
  READY:'ready', RUNNING:'running', PAUSED:'paused', ERROR:'error', DONE:'done', CANCELLED:'cancelled'
};

export function createGenerationJob(meta,blocks=[]){
  const job={
    id:newId(),
    createdAt:Date.now(),
    updatedAt:Date.now(),
    status:JOB_STATUS.READY,
    meta,
    blocks:blocks.map((b,i)=>({
      index:i,
      label:b.label||`Bloque ${i+1}`,
      status:'pending',
      content:'',
      usage:null,
      error:'',
      responseId:'',
      payload:b
    })),
    currentBlock:0
  };
  update(s=>{s.generationJobs||=[];s.generationJobs.unshift(job);});
  return job;
}
export const getGenerationJob=(id)=>getState().generationJobs?.find(j=>j.id===id)||null;
export const listGenerationJobs=()=>getState().generationJobs||[];

export function patchGenerationJob(id,patch){
  update(s=>{
    const j=s.generationJobs?.find(x=>x.id===id);
    if(j){Object.assign(j,patch);j.updatedAt=Date.now();}
  });
}
export function patchGenerationBlock(id,index,patch){
  update(s=>{
    const j=s.generationJobs?.find(x=>x.id===id);
    const b=j?.blocks?.[index];
    if(b){Object.assign(b,patch);j.updatedAt=Date.now();}
  });
}
export function combinedJobContent(job){
  return (job?.blocks||[]).filter(b=>b.content).sort((a,b)=>a.index-b.index).map(b=>b.content.trim()).join('\n\n');
}
