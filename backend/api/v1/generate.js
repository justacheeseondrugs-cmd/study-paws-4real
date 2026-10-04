import {
  authorized,setCors,MAX_BODY_CHARS,callOpenAI
} from '../_shared.js';

export default async function handler(req,res){
  setCors(req,res);
  if(req.method==='OPTIONS') return res.status(204).end();
  if(req.method!=='POST') return res.status(405).json({ok:false,error:'Método no permitido'});
  if(!authorized(req)) return res.status(401).json({ok:false,error:'No autorizado'});

  const body=req.body&&typeof req.body==='object'?req.body:{};
  if(JSON.stringify(body).length>MAX_BODY_CHARS){
    return res.status(413).json({ok:false,error:'Contexto demasiado grande'});
  }

  const pkg=body?.promptPackage;
  if(!pkg||!Array.isArray(pkg.sources)||!pkg.sources.length){
    return res.status(400).json({ok:false,error:'No hay fuentes seleccionadas'});
  }

  try{
    const result=await callOpenAI(pkg,body?.block);
    return res.status(200).json({ok:true,...result});
  }catch(error){
    return res.status(Number(error?.status)||500).json({
      ok:false,
      error:error?.message||'Error del backend',
      type:error?.type||'backend'
    });
  }
}
