import { getState, update } from './storage.js';

export const KNOWLEDGE_DIMENSIONS=[
  {id:'understand',label:'Comprendo',icon:'🧠'},
  {id:'recall',label:'Recuerdo',icon:'🔁'},
  {id:'apply',label:'Aplico',icon:'🩺'},
  {id:'defend',label:'Defiendo',icon:'🎤'}
];
const keyOf=(sid,uid,lid)=>[sid,uid,lid].join(':');
export function getKnowledgeState(sid,uid,lid){
  const base={understand:0,recall:0,apply:0,defend:0,updatedAt:0};
  return {...base,...(getState().knowledge?.[keyOf(sid,uid,lid)]||{})};
}
export function setKnowledgeDimension(sid,uid,lid,dimension,value){
  const n=Math.max(0,Math.min(4,Number(value)||0));
  update(s=>{
    s.knowledge||={};
    const k=keyOf(sid,uid,lid);
    s.knowledge[k]||={understand:0,recall:0,apply:0,defend:0,updatedAt:0};
    s.knowledge[k][dimension]=n;
    s.knowledge[k].updatedAt=Date.now();
  });
}
export function averageKnowledge(){
  const all=Object.values(getState().knowledge||{});
  const out={understand:0,recall:0,apply:0,defend:0};
  if(!all.length) return out;
  for(const k of all) for(const d of Object.keys(out)) out[d]+=Number(k[d]||0);
  for(const d of Object.keys(out)) out[d]=+(out[d]/all.length).toFixed(1);
  return out;
}
