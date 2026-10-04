// Study Paws V0.6 · cliente seguro del backend.
// La API key de OpenAI NUNCA vive aquí. Solo se guarda un token de acceso
// revocable para el backend personal de Study Paws.

const TOKEN_KEY='studypaws:backend-access-token';

export function getAiEndpoint(){
  try{
    const raw=localStorage.getItem('studypaws:v1');
    const state=raw?JSON.parse(raw):{};
    return String(state?.settings?.aiEndpoint||'').trim().replace(/\/$/,'');
  }catch{return '';}
}
export const getBackendAccessToken=()=>localStorage.getItem(TOKEN_KEY)||'';
export function setBackendAccessToken(value){
  const v=String(value||'').trim();
  if(v) localStorage.setItem(TOKEN_KEY,v);
  else localStorage.removeItem(TOKEN_KEY);
}
export const clearBackendAccessToken=()=>localStorage.removeItem(TOKEN_KEY);
export const isAiConfigured=()=>Boolean(getAiEndpoint()&&getBackendAccessToken());

async function parseResponse(res){
  const text=await res.text();
  let data={};
  try{data=text?JSON.parse(text):{};}catch{data={error:text||`HTTP ${res.status}`};}
  if(!res.ok||data?.ok===false){
    const err=new Error(data?.error||data?.message||`Backend respondió HTTP ${res.status}`);
    err.status=res.status;
    err.details=data;
    throw err;
  }
  return data;
}

export async function testAiBackend(){
  const endpoint=getAiEndpoint();
  const token=getBackendAccessToken();
  if(!endpoint) throw new Error('Falta la URL del backend.');
  if(!token) throw new Error('Falta el token de acceso de Study Paws.');
  const res=await fetch(`${endpoint}/health`,{
    method:'GET',
    headers:{'X-Study-Paws-Token':token}
  });
  return parseResponse(res);
}

export async function requestAiGeneration(payload,{signal}={}){
  const endpoint=getAiEndpoint();
  const token=getBackendAccessToken();
  if(!endpoint||!token) throw new Error('El backend de IA no está configurado.');
  const res=await fetch(`${endpoint}/v1/generate`,{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'X-Study-Paws-Token':token,
      'X-Study-Paws-Client':'0.6.0'
    },
    body:JSON.stringify(payload),
    signal
  });
  return parseResponse(res);
}
