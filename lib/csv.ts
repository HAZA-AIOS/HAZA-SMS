export function parseCsv(text:string){
  const rows:string[][]=[];let row:string[]=[],cell="",quoted=false;
  for(let i=0;i<text.length;i++){const char=text[i];if(quoted){if(char==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(char==='"')quoted=false;else cell+=char;}else if(char==='"')quoted=true;else if(char===','){row.push(cell.trim());cell="";}else if(char==='\n'){row.push(cell.trim());if(row.some(Boolean))rows.push(row);row=[];cell="";}else if(char!=='\r')cell+=char;}
  row.push(cell.trim());if(row.some(Boolean))rows.push(row);return rows;
}
export function csvCell(value:unknown){let text=String(value??"");if(/^[=+\-@]/.test(text))text=`'${text}`;return /[",\r\n]/.test(text)?`"${text.replaceAll('"','""')}"`:text;}
