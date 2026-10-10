/** Read-only reconciliation. Source and output JSON belong in protected storage. */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { OFFICIAL_1405_EVENTS } from "../data/calendar/iran/official-1405";
type Event = {jalaliDateKey:string;title:string;type:string;calendarType:string;isHoliday:boolean;sourcePage:number;sourceSection:string;displayOrder:number};
const arg = (key:string) => process.argv.find(a=>a.startsWith("--"+key+"="))?.slice(key.length+3);
const input=arg("parsed-json"), baselinePath=arg("baseline-module"), output=arg("out");
assert.ok(input && baselinePath && output, "Require --parsed-json, --baseline-module and --out");
const parsed=JSON.parse(await readFile(input,"utf8")) as {sourceHash:string;parserVersion:string;year:number;events:Event[];unresolved:unknown[]};
assert.equal(parsed.year,1405);
const baselineModule=await import(pathToFileURL(path.resolve(baselinePath)).href);
const baseline=(baselineModule.OFFICIAL_1405_EVENTS ?? baselineModule.default?.OFFICIAL_1405_EVENTS) as Event[];
assert.equal(baseline.length,424,"Use the historical 75941c0 fixture, not the corrected fixture");
const fields=["title","type","calendarType","isHoliday","sourcePage","sourceSection","displayOrder"] as const;
const identity=(e:Event)=>[e.jalaliDateKey,e.title,e.sourceSection].join("|");
const compare=(expected:Event[],actual:Event[])=>{
 const found=new Map(actual.map(e=>[identity(e),e]));
 assert.equal(found.size,actual.length,"Duplicate event identity");
 const missing:Event[]=[], mismatches:unknown[]=[];
 for(const e of expected){
   const item=found.get(identity(e));
   if(!item){missing.push(e);continue;}
   found.delete(identity(e));
   const changed=fields.filter(f=>e[f]!==item[f]);
   if(changed.length)mismatches.push({date:e.jalaliDateKey,title:e.title,fields:changed.map(field=>({field,expected:e[field],actual:item[field]}))});
 }
 return {missing,extra:[...found.values()],mismatches};
};
const corrected=compare(OFFICIAL_1405_EVENTS,parsed.events), historical=compare(baseline,parsed.events);
const report={sourceHash:parsed.sourceHash,parserVersion:parsed.parserVersion,baselineCount:baseline.length,parsedCount:parsed.events.length,unresolved:parsed.unresolved,corrected,historical};
await writeFile(output,JSON.stringify(report,null,2),{mode:0o600});
assert.deepEqual(corrected,{missing:[],extra:[],mismatches:[]});
assert.equal(parsed.unresolved.length,0);
console.log(JSON.stringify({reconciliation:"PASS",baseline:424,corrected:459,missingFromBaseline:historical.extra.length,unmatchedBaseline:historical.missing.length,metadataDifferences:historical.mismatches.length}));
