"use client";
export default function DownloadThumbnail({id,name,type}:{id:string;name:string;type:string}) {
 const source=`/api/public-downloads/${id}?preview=1`;
 return <div className="download-thumbnail" aria-label={`Preview of ${name}`}>
 {['image/jpeg','image/png','image/webp','image/gif'].includes(type)?<img src={source} alt={name} loading="lazy"/>:type==='application/pdf'?<object data={`${source}#page=1&toolbar=0&navpanes=0&view=FitH`} type="application/pdf" aria-label={`PDF preview: ${name}`}><span>PDF</span></object>:<span>{name.split('.').pop()?.slice(0,8).toUpperCase()||'FILE'}</span>}
 </div>;
}
