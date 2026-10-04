import { authorized,setCors } from './_shared.js';

export default async function handler(req,res){
  setCors(req,res);
  if(req.method==='OPTIONS') return res.status(204).end();
  if(req.method!=='GET') return res.status(405).json({ok:false,error:'Método no permitido'});
  if(!authorized(req)) return res.status(401).json({ok:false,error:'No autorizado'});
  return res.status(200).json({
    ok:true,
    service:'study-paws-ai',
    runtime:'vercel',
    model:process.env.OPENAI_MODEL||'gpt-6.1-sol'
  });
}
