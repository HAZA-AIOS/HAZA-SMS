"use client";
import { useEffect, useRef, useState } from "react";

// Bound memory use while retaining previews across category switches.
const previews = new Map<string, string>();

export default function DownloadThumbnail({id,name,type}:{id:string;name:string;type:string}) {
 const source=`/api/public-downloads/${encodeURIComponent(id)}?preview=1`;
 const canvas=useRef<HTMLCanvasElement>(null);
 const container=useRef<HTMLDivElement>(null);
 const [status,setStatus]=useState('loading');
 const [attempt,setAttempt]=useState(0);
 const [image,setImage]=useState('');
 const cacheKey=JSON.stringify([id,name,type]);
 const pdf=type==='application/pdf'||/\.pdf$/i.test(name);
 useEffect(()=>{
  if(!pdf)return;
  let disposed=false;
  let timeout:ReturnType<typeof setTimeout>|undefined;
  const cached=previews.get(cacheKey);
  if(cached){setImage(cached);setStatus('ready');return;}
  setImage('');
  let worker:Worker|undefined;
  let task:import('pdfjs-dist').PDFDocumentLoadingTask|undefined;
  let render:import('pdfjs-dist').RenderTask|undefined;
  setStatus('loading');
  async function draw(){
   timeout=setTimeout(()=>{disposed=true;setStatus('error');void task?.destroy();worker?.terminate();},60000);
   try{
    const lib=await import('pdfjs-dist/legacy/build/pdf.mjs');
    if(disposed)return;
    worker=new Worker(new URL("./pdf-preview.worker.ts",import.meta.url),{type:"module"});
    const pdfWorker=new lib.PDFWorker({port:worker});
    task=lib.getDocument({worker:pdfWorker,url:source,disableAutoFetch:true,disableStream:true,rangeChunkSize:1048576});
    const doc=await task.promise;
    const page=await doc.getPage(1);
    if(disposed||!canvas.current)return;
    const base=page.getViewport({scale:1});
    const viewport=page.getViewport({scale:Math.min(320/base.width,360/base.height)});
    const target=canvas.current;
    target.width=Math.ceil(viewport.width);target.height=Math.ceil(viewport.height);
    render=page.render({canvas:target,viewport});
    await render.promise;
    if(!disposed){
     const thumbnail=target.toDataURL('image/webp',0.85);
     if(previews.size>=24)previews.delete(previews.keys().next().value!);
     previews.set(cacheKey,thumbnail);setImage(thumbnail);setStatus('ready');
    }
   }catch{if(!disposed)setStatus('error');}
   finally{clearTimeout(timeout);void task?.destroy();worker?.terminate();}
  }
  if(!('IntersectionObserver' in window)){void draw();return()=>{disposed=true;clearTimeout(timeout);render?.cancel();void task?.destroy();worker?.terminate();};}
  const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();void draw();}},{rootMargin:'600px'});
  if(container.current)observer.observe(container.current);
  return()=>{disposed=true;clearTimeout(timeout);observer.disconnect();render?.cancel();void task?.destroy();worker?.terminate();};
 },[pdf,source,attempt,cacheKey]);
 return <div ref={container} className="download-thumbnail" aria-label={`Preview of ${name}`}>
 {pdf?<><canvas ref={canvas} hidden/>{status==='ready'&&image&&<img src={image} alt={`First page of ${name}`}/>}{status==='loading'&&<span role="status">Loading preview…</span>}{status==='error'&&<div className="download-preview-error"><button type="button" onClick={()=>setAttempt(n=>n+1)}>Retry preview</button><small role="status">Preview unavailable. You can still download the file.</small></div>}</>
 :['image/jpeg','image/png','image/webp','image/gif'].includes(type)?<img src={source} alt={name} loading="lazy"/>
 :<span>{name.split('.').pop()?.slice(0,8).toUpperCase()||'FILE'}</span>}
 </div>;
}
