import {Fragment,type ReactNode} from 'react';
const inline=(s:string)=>s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((v,i)=>v.startsWith('**')?<strong key={i}>{v.slice(2,-2)}</strong>:v.startsWith('`')?<code key={i}>{v.slice(1,-1)}</code>:<Fragment key={i}>{v}</Fragment>);
/** Render common report structure as React text; raw HTML and executable Markdown are never interpreted. */
export function DocumentView({text}:{text:string}){
 const lines=text.replace(/\r/g,'').split('\n'),blocks:ReactNode[]=[];
 for(let i=0;i<lines.length;i++){
  const line=lines[i];if(!line.trim())continue;
  if(line.startsWith('```')){const code:string[]=[];while(++i<lines.length&&!lines[i].startsWith('```'))code.push(lines[i]);blocks.push(<pre key={i}><code>{code.join('\n')}</code></pre>);continue}
  const heading=/^(#{1,6})\s+(.+)$/.exec(line);if(heading){blocks.push(heading[1].length<=2?<h3 key={i}>{inline(heading[2])}</h3>:<h4 key={i}>{inline(heading[2])}</h4>);continue}
  if(line.includes('|')&&/^\s*\|?\s*:?-+/.test(lines[i+1]||'')){const split=(s:string)=>s.trim().replace(/^\||\|$/g,'').split('|').map(x=>x.trim());const head=split(line),rows:string[][]=[];i++;while(i+1<lines.length&&lines[i+1].includes('|'))rows.push(split(lines[++i]));blocks.push(<div className="document-table" key={i}><table><thead><tr>{head.map((x,j)=><th key={j}>{inline(x)}</th>)}</tr></thead><tbody>{rows.map((row,j)=><tr key={j}>{row.map((x,k)=><td key={k}>{inline(x)}</td>)}</tr>)}</tbody></table></div>);continue}
  if(/^\s*[-*]\s+/.test(line)){const list=[line.replace(/^\s*[-*]\s+/,'')];while(i+1<lines.length&&/^\s*[-*]\s+/.test(lines[i+1]))list.push(lines[++i].replace(/^\s*[-*]\s+/,''));blocks.push(<ul key={i}>{list.map((x,j)=><li key={j}>{inline(x)}</li>)}</ul>);continue}
  if(/^\s*\d+[.)]\s+/.test(line)){const list=[line.replace(/^\s*\d+[.)]\s+/,'')];while(i+1<lines.length&&/^\s*\d+[.)]\s+/.test(lines[i+1]))list.push(lines[++i].replace(/^\s*\d+[.)]\s+/,''));blocks.push(<ol key={i}>{list.map((x,j)=><li key={j}>{inline(x)}</li>)}</ol>);continue}
  if(/^\s*[-*_]{3,}\s*$/.test(line)){blocks.push(<hr key={i}/>);continue}blocks.push(<p key={i}>{inline(line)}</p>);
 }
 return <div className="document-view">{blocks}</div>;
}
