"use client";
import { useEffect, useRef, useState } from "react";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

export default function DownloadThumbnail({id,name,type}:{id:string;name:string;type:string}) {
 const source=`/api/public-downloads/${encodeURIComponent(id)}?preview=1`;
 const canvas=useRef<HTMLCanvasElement>(null);
 const container=useRef<HTMLDivElement>(null);
 const [status,setStatus]=useState('loading');
 const [attempt,setAttempt]=useState(0);
 const pdf=type==='application/pdf'||/\.pdf$/i.test(name);
 useEffect(()=>{
  if(!pdf)return;
  let disposed=false;
  let task:import('pdfjs-dist').PDFDocumentLoadingTask|undefined;
  let render:import('pdfjs-dist').RenderTask|undefined;
  setStatus('loading');
  async function draw(){
   try{
    const lib=await import('pdfjs-dist');
    if(disposed)return;
    lib.GlobalWorkerOptions.workerSrc=workerUrl;
    task=lib.getDocument({url:source,disableAutoFetch:true,disableStream:true,rangeChunkSize:65536});
    const doc=await task.promise;
    const page=await doc.getPage(1);
    if(disposed||!canvas.current)return;
    const base=page.getViewport({scale:1});
    const viewport=page.getViewport({scale:Math.min(320/base.width,360/base.height)});
    const target=canvas.current;
    target.width=Math.ceil(viewport.width);target.height=Math.ceil(viewport.height);
    render=page.render({canvas:target,viewport});
    await render.promise;
    if(!disposed)setStatus('ready');
   }catch{if(!disposed)setStatus('error');}
  }
  const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();void draw();}},{rootMargin:'200px'});
  if(container.current)observer.observe(container.current);
  return()=>{disposed=true;observer.disconnect();render?.cancel();void task?.destroy();};
 },[pdf,source,attempt]);
 return <div ref={container} className="download-thumbnail" aria-label={`Preview of ${name}`}>
 {pdf?<><canvas ref={canvas} style={{display:status==='ready'?'block':'none'}} role="img" aria-label={`First page of ${name}`}/>{status==='loading'&&<span role="status">Loading preview…</span>}{status==='error'&&<button type="button" onClick={()=>setAttempt(n=>n+1)}>Retry preview</button>}</>
 :['image/jpeg','image/png','image/webp','image/gif'].includes(type)?<img src={source} alt={name} loading="lazy"/>
 :<span>{name.split('.').pop()?.slice(0,8).toUpperCase()||'FILE'}</span>}
 </div>;
}
