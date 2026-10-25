const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const rows=[],props={SPREADSHEET_ID:'test-only'},head=['Attempt ID','Submitted at (Bangkok)','Quiz version','Full name','Organization','Role','Cohort','Consent','Started at (client)','Score','Total','Percent','Payload SHA256',...Array.from({length:20},(_,i)=>'Q'+(i+1))];
let flushed=0,failFlush=false,released=0;
const sheet={getLastRow:()=>rows.length+1,appendRow:r=>rows.push(r),getRange:(r,c,n,w)=>({getValues:()=>r===1?[head]:[rows[r-2]],createTextFinder:id=>({matchEntireCell(){return this},findNext:()=>{const i=rows.findIndex(x=>x[0]===id);return i<0?null:{getRow:()=>i+2}}})})};
const env={console:{error:()=>{}},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]})},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>released++})},SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet}),flush:()=>{if(failFlush)throw Error('TEST transport failure');flushed++}},Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(_,s)=>crypto.createHash('sha256').update(s).digest(),base64EncodeWebSafe:b=>b.toString('base64url')},HtmlService:{createHtmlOutput:html=>({html,setTitle(){return this},addMetaTag(){return this}})}};
vm.createContext(env);vm.runInContext(fs.readFileSync(__dirname+'/../apps-script/Code.gs','utf8'),env);
const run=s=>vm.runInContext(s,env),key=run('SETTINGS.key');
assert.equal(env.grade_(key),20);assert.equal(env.grade_(Array.from(key,n=>(n+1)%4)),0);
const payload={version:'smart-wh-slides-draft-v1',attemptId:crypto.randomUUID(),startedAt:new Date().toISOString(),attendee:{fullName:'TEST ระบบ',organization:'TEST only',role:'',cohort:'TEST',consent:true},answers:Array.from(key)};
const post=d=>env.doPost({parameter:{payload:JSON.stringify(d)}}).html;
assert.match(post(payload),/บันทึกคำตอบสำเร็จ/);assert.equal(rows.length,1);assert.equal(rows[0][9],20);assert.equal(flushed,1);
assert.match(post(payload),/ไม่เพิ่มแถวซ้ำ/);assert.equal(rows.length,1);
assert.match(post({...payload,answers:Array(20).fill(0)}),/ยังบันทึกคำตอบไม่สำเร็จ/);assert.equal(rows.length,1);
for(const changed of [{answers:[0]},{answers:Array(20).fill(9)},{version:'wrong'},{attendee:{...payload.attendee,consent:false}},{attendee:{...payload.attendee,fullName:' '}},{startedAt:'bad'}]){assert.match(post({...payload,...changed}),/ยังบันทึกคำตอบไม่สำเร็จ/);}
assert.equal(rows.length,1);assert.equal(env.safeCell_('=IMPORTXML("x")'),'\'=IMPORTXML("x")');assert.equal(env.escape_('<script>'),'&lt;script&gt;');
failFlush=true;assert.match(post({...payload,attemptId:crypto.randomUUID()}),/ยังบันทึกคำตอบไม่สำเร็จ/);assert.ok(released>=4);
const qctx={window:{}};vm.createContext(qctx);vm.runInContext(fs.readFileSync(__dirname+'/../questions.js','utf8'),qctx);assert.equal(qctx.window.QUIZ_QUESTIONS.length,20);assert.equal(new Set(qctx.window.QUIZ_QUESTIONS.map(q=>q.id)).size,20);assert.ok(qctx.window.QUIZ_QUESTIONS.every(q=>q.options.length===4&&q.slide));
console.log('PASS: 20 questions; grading 20/20 and 0/20; malformed input; duplicate and conflicting retry; cell escaping; write-failure acknowledgement.');
