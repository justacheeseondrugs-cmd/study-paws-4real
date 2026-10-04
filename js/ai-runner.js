// Orquestador reanudable: contexto local -> paquete -> backend -> guardado por bloque.
import { requestAiGeneration } from './ai-client.js';
import { buildPromptPackage } from './prompt-builder.js';
import { getPdfPageImages } from './files.js';
import {
  createGenerationJob,getGenerationJob,patchGenerationJob,patchGenerationBlock,
  combinedJobContent,JOB_STATUS
} from './generation-jobs.js';

export async function runPreparedGeneration({meta,blocks,onProgress,signal}){
  const job=createGenerationJob(meta,blocks);
  return resumeGeneration(job.id,{onProgress,signal});
}

export async function resumeGeneration(jobId,{onProgress,signal}={}){
  let job=getGenerationJob(jobId);
  if(!job) throw new Error('Generación no encontrada');
  patchGenerationJob(jobId,{status:JOB_STATUS.RUNNING});

  for(let i=0;i<job.blocks.length;i++){
    job=getGenerationJob(jobId);
    const block=job.blocks[i];
    if(block.status==='done') continue;
    if(signal?.aborted){
      patchGenerationJob(jobId,{status:JOB_STATUS.PAUSED,currentBlock:i});
      throw new DOMException('Generación detenida','AbortError');
    }

    patchGenerationJob(jobId,{currentBlock:i});
    patchGenerationBlock(jobId,i,{status:'running',error:''});
    onProgress?.({jobId,index:i,total:job.blocks.length,label:block.label,status:'running'});

    try{
      const pkg=buildPromptPackage({
        ...job.meta,
        smartContext:block.payload.smartContext,
        focus:block.payload.focus||job.meta.focus||''
      });

      // Visión se resuelve justo antes de la llamada. El job solo guarda refs pequeñas.
      const visualRefs=Array.isArray(block.payload.visualRefs)?block.payload.visualRefs:[];
      if(visualRefs.length){
        const byFile=new Map();
        for(const ref of visualRefs){
          if(!byFile.has(ref.fileId)) byFile.set(ref.fileId,[]);
          byFile.get(ref.fileId).push(ref);
        }
        const images=[];
        for(const [fileId,refs] of byFile){
          const rendered=await getPdfPageImages(fileId,refs.map(r=>r.page));
          for(const img of rendered){
            const ref=refs.find(r=>Number(r.page)===Number(img.page));
            images.push({
              ...img,
              sourceName:ref?.sourceName||'PDF',
              label:`Diapositiva ${img.page}`
            });
          }
        }
        pkg.images=images;
      }
      const result=await requestAiGeneration({
        requestId:`${jobId}:${i}`,
        block:{index:i,total:job.blocks.length,label:block.label},
        promptPackage:pkg
      },{signal});

      patchGenerationBlock(jobId,i,{
        status:'done',
        content:String(result.text||'').trim(),
        usage:result.usage||null,
        budget:result.budget||null,
        responseId:result.responseId||'',
        model:result.model||'',
        payload:null
      });
      onProgress?.({jobId,index:i,total:job.blocks.length,label:block.label,status:'done',usage:result.usage,budget:result.budget});
    }catch(error){
      if(error?.name==='AbortError'){
        patchGenerationBlock(jobId,i,{status:'pending'});
        patchGenerationJob(jobId,{status:JOB_STATUS.PAUSED,currentBlock:i});
        throw error;
      }
      patchGenerationBlock(jobId,i,{status:'error',error:error?.message||'Error'});
      patchGenerationJob(jobId,{status:JOB_STATUS.ERROR,currentBlock:i,lastError:error?.message||'Error'});
      onProgress?.({jobId,index:i,total:job.blocks.length,label:block.label,status:'error',error});
      throw error;
    }
  }

  patchGenerationJob(jobId,{status:JOB_STATUS.DONE,currentBlock:job.blocks.length});
  job=getGenerationJob(jobId);
  return {
    jobId,
    title:job.meta?.title||`Guía · ${job.meta?.lesson?.name||job.meta?.subject?.name||'Study Paws'}`,
    content:combinedJobContent(job),
    job
  };
}
