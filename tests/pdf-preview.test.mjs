import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas,DOMMatrix,ImageData,Path2D} from '@napi-rs/canvas';

test('PDF renderer paints the first page into a thumbnail canvas',async()=>{
 Object.assign(globalThis,{DOMMatrix,ImageData,Path2D});
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const stream='1 0 0 rg 0 0 100 100 re f';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << >> /Contents 4 0 R >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
 let file='%PDF-1.4\n';const offsets=[0];
 objects.forEach((o,i)=>{offsets.push(file.length);file+=`${i+1} 0 obj\n${o}\nendobj\n`});
 const xref=file.length;file+='xref\n0 5\n0000000000 65535 f \n';for(const offset of offsets.slice(1))file+=String(offset).padStart(10,'0')+' 00000 n \n';file+=`trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
 const task=getDocument({data:new Uint8Array(Buffer.from(file))});
 try{const doc=await task.promise;const page=await doc.getPage(1);const canvas=createCanvas(100,100);await page.render({canvas,viewport:page.getViewport({scale:1})}).promise;assert.deepEqual([...canvas.getContext('2d').getImageData(50,50,1,1).data],[255,0,0,255]);}finally{await task.destroy()}
});
