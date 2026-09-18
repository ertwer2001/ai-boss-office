import {useLayoutEffect,useRef,useState,type CSSProperties} from 'react';
import {employeeState,labels,type Company,type Task} from '../domain/company';
export function Office({company,tasks,selected,onSelect}:{company:Company;tasks:Task[];selected:string;onSelect:(id:string)=>void}){
 const stage=useRef<HTMLDivElement>(null);const [layout,setLayout]=useState(0);
 useLayoutEffect(()=>{const observer=new ResizeObserver(()=>setLayout(n=>n+1));if(stage.current)observer.observe(stage.current);return()=>observer.disconnect()},[]);
 return <section className="floor-wrap" aria-label="辦公室"><div className="floor-bar"><strong>辦公室</strong><div className="legend">{(['working','approve','blocked','done','idle'] as const).map(s=><span key={s}><i className={'st-'+s}/>{labels[s]}</span>)}</div></div><div className="stage" ref={stage}><div className="floor">{company.employees.map(e=>{const s=employeeState(tasks,e.id);const task=tasks.find(t=>t.employeeId===e.id&&['working','blocked','approve','queued'].includes(t.state));return <button key={e.id} data-seat={e.id} className={'seat '+s} aria-pressed={selected===e.id} aria-label={`${e.title} ${e.name}，${labels[s]}`} onClick={()=>onSelect(e.id)}><span className="chair"/><span className="desk"><span className="monitor">{[8,14,20].map(y=><span key={y} className="ln" style={{top:y,width:s==='idle'?0:25}}/>)}</span></span><span className="plate"><span className="t">{e.title}</span><span className="n">{e.name}</span><span className="cur">{task?.stage||'等待指派'}</span></span></button>})}</div><div className="lounge" aria-hidden="true"><span className="lounge-title">茶水間・休息區</span><span className="zone"><span className="coffee"/>咖啡機</span><span className="zone"><span className="plant"/></span><span className="zone"><span className="sofa"/>沙發</span><span className="zone"><span className="board-w"/>白板</span></div><div className="walkers">{company.employees.map((e,i)=><Walker key={e.id} stage={stage.current} layout={layout} id={e.id} name={e.name} title={e.title} index={i} total={company.employees.length} state={employeeState(tasks,e.id)} onSelect={()=>onSelect(e.id)}/>)}</div></div></section>
}
type Point={x:number;y:number};
function Walker({stage,layout,id,name,title,index,total,state,onSelect}:{stage:HTMLDivElement|null;layout:number;id:string;name:string;title:string;index:number;total:number;state:ReturnType<typeof employeeState>;onSelect:()=>void}){
 const ref=useRef<HTMLButtonElement>(null),previous=useRef<Point>();const [moving,setMoving]=useState(false);
 const idle=state==='idle'||state==='queued'||state==='cancelled';
 useLayoutEffect(()=>{if(!stage||!ref.current)return;const box=stage.getBoundingClientRect();const desk=stage.querySelector(`[data-seat="${id}"] .desk`)?.getBoundingClientRect();const lounge=stage.querySelector('.lounge')?.getBoundingClientRect();if(!desk||!lounge)return;
  const target=idle?{x:16+(index+0.5)*(box.width-32)/total-24,y:lounge.top-box.top+24}:{x:desk.left-box.left+desk.width/2-24,y:desk.top-box.top-52};
  const node=ref.current;const start=previous.current;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;const timers:ReturnType<typeof setTimeout>[]=[];
  function place(p:Point){node.style.transform=`translate(${p.x}px,${p.y}px)`;previous.current=p}
  if(!start||reduced||layout===0){node.style.transition='none';place(target);setMoving(false);return}
  if(Math.hypot(start.x-target.x,start.y-target.y)<3)return;
  setMoving(true);const route=[{x:start.x,y:start.y-28},{x:0,y:start.y-28},{x:0,y:target.y-28},{x:target.x,y:target.y-28},target];let time=0,from=start;
  for(const p of route){const duration=Math.hypot(p.x-from.x,p.y-from.y)/110*1000;const flip=p.x<from.x;timers.push(setTimeout(()=>{node.classList.toggle('flip',flip);node.style.transition=`transform ${duration}ms cubic-bezier(.45,.05,.55,.95)`;place(p)},time));time+=duration;from=p}
  timers.push(setTimeout(()=>setMoving(false),time));return()=>timers.forEach(clearTimeout);
 },[stage,id,idle,layout,index,total]);
 const bubble=state==='working'?'工作中':state==='approve'?'驗收?':state==='blocked'?'!':state==='done'?'完成✓':'☕';
 return <button ref={ref} className={`walker ${moving?'moving':''} ${!idle&&!moving?'atdesk':''} ${state==='working'&&!moving?'typing':''}`} style={{'--c':`var(--shirt-${index%8})`,'--h':`var(--hair-${index%7})`} as CSSProperties} aria-label={`${title} ${name}，${labels[state]}`} onClick={onSelect}><span className={'bubble st-'+(idle?'idle':state)}>{bubble}</span><span className="wbody"><span className="leg l"/><span className="leg r"/><span className="torso"/><span className="headw"><span className="hairw"/><span className="eye l"/><span className="eye r"/><span className="blush"/></span></span><span className="tag">{name}</span></button>
}
