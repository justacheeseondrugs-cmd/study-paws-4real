import { getBrain } from './brain.js';

export const SOURCE_USE=[
  {id:'auto',label:'✨ Auto'},
  {id:'core',label:'⭐ Núcleo'},
  {id:'support',label:'➕ Apoyo'},
  {id:'exclude',label:'🚫 No usar'}
];
const boost={core:1000,support:-15,auto:0,exclude:-9999};
export const sourceUseInfo=(id)=>SOURCE_USE.find(x=>x.id===id)||SOURCE_USE[0];

function stem(name=''){
  return name.toLowerCase().replace(/\.[^.]+$/,'')
    .replace(/\b(clase|class|ppt|presentaci[oó]n|transcripci[oó]n|tipeo|copia|final)\b/g,' ')
    .replace(/[^a-záéíóúüñ0-9]+/g,' ').replace(/\s+/g,' ').trim();
}
export function redundancyHints(files=[]){
  const out=[];
  for(let i=0;i<files.length;i++) for(let j=i+1;j<files.length;j++){
    const a=stem(files[i].name),b=stem(files[j].name);
    if(!a||!b) continue;
    if(a===b||(a.length>8&&b.includes(a))||(b.length>8&&a.includes(b))){
      out.push(`Posible material relacionado/redundante: "${files[i].name}" ↔ "${files[j].name}".`);
    }
  }
  return out;
}
export function planSources(files=[],preset='interna_materia'){
  const brain=getBrain(preset).course;
  return files.map(f=>{
    const use=f.sourceUse||'auto';
    const readable=f.textStatus==='ready'&&(f.textChars||0)>0;
    return {...f,sourceUse:use,readable,score:(brain.sourcePriority?.[f.type]??40)+(boost[use]??0)+(readable?10:-25)};
  }).filter(f=>f.sourceUse!=='exclude').sort((a,b)=>b.score-a.score);
}
