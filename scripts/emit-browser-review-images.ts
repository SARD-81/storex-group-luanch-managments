/** CI-only review images contain isolated synthetic fixtures, never production artifacts. */
import assert from "node:assert/strict";
import {readFile,writeFile} from "node:fs/promises";
import sharp from "sharp";
assert.equal(process.env.GITHUB_ACTIONS,"true");
assert.equal(process.env.TEST_DATABASE_URL,process.env.DATABASE_URL);
assert.match(new URL(process.env.TEST_DATABASE_URL!).hostname,/^(localhost|127\.0\.0\.1)$/);
assert.match(new URL(process.env.TEST_DATABASE_URL!).pathname,/_test$/);
const inspected=JSON.parse(await readFile("verification-output/pdf-inspection.json","utf8")) as {file:string;pages:number}[];
const long=inspected.find(x=>x.file==="server-long-names.pdf")!;
const names=[
 "manual-print.png","server-empty.png","server-long-names.png",
 `server-long-names-page-${String(long.pages).padStart(2,"0")}.png`,
 "manual-logo-wide-transparent.png","server-logo-wide-transparent.png","server-logo-square.png","server-logo-webp.png",
 "logo-preview-wide-transparent.png","logo-preview-square.png","logo-preview-webp.png",
 "reports-desktop.png","reports-mobile-picker.png",
];
for(const name of names){
 const bytes=await sharp("verification-output/"+name).resize({width:1050,height:1050,fit:"inside",withoutEnlargement:true}).png().toBuffer();
 console.log("STOREX_REVIEW_IMAGE "+JSON.stringify({name,data:bytes.toString("base64")}));
}
