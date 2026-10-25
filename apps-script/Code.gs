/** Smart Warehouse pretest. No participant data or Sheet ID is published in the site. */
const SETTINGS = Object.freeze({
  version: 'smart-wh-slides-draft-v1',
  returnUrl: 'https://wasankanlaya79-design.github.io/smart-warehouse-pretest/',
  sheetName: 'Responses',
  key: [1,2,0,3,1,2,0,3,1,2,0,3,1,2,0,3,1,2,0,3]
});
const HEADERS = ['Attempt ID','Submitted at (Bangkok)','Quiz version','Full name','Organization','Role','Cohort','Consent','Started at (client)','Score','Total','Percent','Payload SHA256'].concat(Array.from({length:20},(_,i)=>'Q'+(i+1)));

/** Run ONCE from the editor as the owner. This function is never exposed through doGet/doPost. */
function setup() {
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    const props=PropertiesService.getScriptProperties();
    let id=props.getProperty('SPREADSHEET_ID');
    if(!id){const ss=SpreadsheetApp.create('Smart Warehouse · Pretest Responses');id=ss.getId();props.setProperty('SPREADSHEET_ID',id);ss.setSpreadsheetTimeZone('Asia/Bangkok');const sheet=ss.getSheets()[0];sheet.setName(SETTINGS.sheetName);sheet.appendRow(HEADERS);sheet.setFrozenRows(1);sheet.getRange(1,1,1,HEADERS.length).setBackground('#00695e').setFontColor('#ffffff').setFontWeight('bold');sheet.setColumnWidths(1,HEADERS.length,145);sheet.setColumnWidths(4,4,200);sheet.getRange(1,1,sheet.getMaxRows(),HEADERS.length).setWrap(true);sheet.getRange('B:B').setNumberFormat('yyyy-mm-dd hh:mm:ss');sheet.getRange(1,1,1,HEADERS.length).createFilter();SpreadsheetApp.flush();}
    console.log('Private response spreadsheet: https://docs.google.com/spreadsheets/d/'+id+'/edit');
    return id;
  } finally {lock.releaseLock();}
}

/** Public readiness page; never returns personal data or spreadsheet identifiers. */
function doGet() {
  const ready=!!PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  return page_('Smart Warehouse',ready?'<h1>ระบบรับคำตอบพร้อมใช้งาน</h1><p>Smart Warehouse · '+escape_(SETTINGS.version)+'</p><p>กรุณาเริ่มทำแบบทดสอบจากเว็บไซต์</p>':'<h1>กำลังตั้งค่าระบบ</h1><p>ผู้จัดต้องเรียกใช้ setup ก่อนเปิดรับคำตอบ</p>');
}

/** A standard browser form POST avoids cross-origin fetch/no-cors false acknowledgements. */
function doPost(e) {
  try {
    if(!e||!e.parameter||typeof e.parameter.payload!=='string'||e.parameter.payload.length>16000)throw new Error('ข้อมูลคำตอบไม่ถูกต้อง');
    const raw=e.parameter.payload;
    let data;try{data=JSON.parse(raw);}catch(_){throw new Error('อ่านข้อมูลคำตอบไม่ได้');}
    validate_(data);
    const digest=Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,raw,Utilities.Charset.UTF_8));
    const score=grade_(data.answers);
    const lock=LockService.getScriptLock();
    if(!lock.tryLock(30000))throw new Error('ระบบกำลังรับคำตอบจำนวนมาก กรุณาย้อนกลับแล้วส่งใหม่');
    let duplicate=false;
    try {
      const id=PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');if(!id)throw new Error('ระบบยังไม่เปิดรับคำตอบ กรุณาติดต่อผู้จัดอบรม');
      const sheet=SpreadsheetApp.openById(id).getSheetByName(SETTINGS.sheetName);
      if(!sheet||sheet.getRange(1,1,1,HEADERS.length).getValues()[0].join('|')!==HEADERS.join('|'))throw new Error('โครงสร้างชีตไม่ตรงกับระบบ กรุณาติดต่อผู้จัดอบรม');
      const rows=sheet.getLastRow();
      const existing=rows>1?sheet.getRange(2,1,rows-1,1).createTextFinder(data.attemptId).matchEntireCell(true).findNext():null;
      if(existing){const old=sheet.getRange(existing.getRow(),1,1,HEADERS.length).getValues()[0];if(old[12]!==digest)throw new Error('เลขอ้างอิงนี้ถูกใช้ส่งคำตอบอื่นแล้ว กรุณาเริ่มแบบทดสอบใหม่');duplicate=true;}
      else {const a=data.attendee;sheet.appendRow([data.attemptId,new Date(),data.version,safeCell_(a.fullName),safeCell_(a.organization),safeCell_(a.role||''),safeCell_(a.cohort||''),'YES',data.startedAt,score,20,score*5,digest].concat(data.answers.map(n=>['ก','ข','ค','ง'][n])));SpreadsheetApp.flush();}
    } finally {lock.releaseLock();}
    return page_('บันทึกคำตอบสำเร็จ','<p class="tag">SMART WAREHOUSE · PRETEST</p><h1>บันทึกคำตอบสำเร็จ</h1><p>'+escape_(data.attendee.fullName)+'</p><div class="score">'+score+'<small> / 20 คะแนน</small></div><p>คิดเป็น '+(score*5)+'% · ไม่มีเกณฑ์ผ่าน–ไม่ผ่าน</p><p>ผู้จัดได้รับข้อมูลลงทะเบียนและคำตอบครบ 20 ข้อแล้ว'+(duplicate?' (เป็นรายการเดิมที่บันทึกไว้แล้ว ไม่เพิ่มแถวซ้ำ)':'')+'</p><p class="ref">เลขอ้างอิง: '+escape_(data.attemptId)+'</p><p>ใช้ผลนี้สำรวจความรู้ก่อนอบรมและเลือกหัวข้อที่ต้องการเรียนรู้เพิ่มเติม</p>');
  } catch(error) {
    const known=/^(ข้อมูล|อ่านข้อมูล|กรุณา|ระบบ|โครงสร้าง|เลขอ้างอิง|คำตอบ|เวอร์ชัน|เวลาที่)/.test(String(error.message));
    console.error('Submission failed: '+String(error));
    return page_('ยังบันทึกไม่สำเร็จ','<h1>ยังบันทึกคำตอบไม่สำเร็จ</h1><p>'+escape_(known?error.message:'การเชื่อมต่อขัดข้อง กรุณาย้อนกลับแล้วส่งใหม่ หากยังไม่สำเร็จให้ติดต่อผู้จัดอบรม')+'</p><p>ยังไม่มีการยืนยันคะแนน โปรดใช้ปุ่มย้อนกลับของเบราว์เซอร์เพื่อส่งข้อมูลเดิมอีกครั้ง ระบบตรวจรายการซ้ำก่อนบันทึก</p>');
  }
}

function validate_(d) {
  if(!d||d.version!==SETTINGS.version)throw new Error('เวอร์ชันแบบทดสอบเปลี่ยนแล้ว กรุณาเปิดเว็บไซต์ใหม่');
  if(typeof d.attemptId!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(d.attemptId))throw new Error('เลขอ้างอิงไม่ถูกต้อง กรุณาเริ่มใหม่');
  if(typeof d.startedAt!=='string'||d.startedAt.length>30||!Number.isFinite(Date.parse(d.startedAt)))throw new Error('เวลาที่เริ่มแบบทดสอบไม่ถูกต้อง');
  const a=d.attendee;if(!a||a.consent!==true)throw new Error('กรุณารับทราบการใช้ข้อมูลก่อนส่ง');
  [['fullName',120,true],['organization',160,true],['role',120,false],['cohort',80,false]].forEach(([key,max,required])=>{const s=a[key];if((required&&(typeof s!=='string'||!s.trim()))||(s!==undefined&&(typeof s!=='string'||s.length>max)))throw new Error('ข้อมูลลงทะเบียนไม่ครบหรือยาวเกินกำหนด');});
  if(!Array.isArray(d.answers)||d.answers.length!==20||!d.answers.every(n=>Number.isInteger(n)&&n>=0&&n<=3))throw new Error('คำตอบต้องครบ 20 ข้อ และอยู่ในตัวเลือกที่กำหนด');
}
function grade_(answers){return answers.reduce((total,n,i)=>total+Number(n===SETTINGS.key[i]),0);}
function safeCell_(value){const s=String(value).trim();return /^[=+\-@\t\r\n]/.test(s)?"'"+s:s;}
function escape_(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function page_(title,body){return HtmlService.createHtmlOutput('<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base target="_top"><title>'+escape_(title)+'</title><style>body{font:17px/1.8 Tahoma,sans-serif;background:#f4f6f1;color:#152f38;margin:0;padding:32px 16px}.card{max-width:640px;margin:40px auto;background:white;border:1px solid #d8e0db;border-radius:18px;padding:36px}h1{font-size:29px;color:#00695e}.score{font-size:76px;font-weight:700;color:#00695e}.score small{font-size:20px}.ref{overflow-wrap:anywhere;font-size:13px;color:#546b70}.tag{font-size:12px;letter-spacing:2px}a{display:inline-block;color:#00695e;padding:10px 0}</style></head><body><main class="card">'+body+'<a href="'+escape_(SETTINGS.returnUrl)+'?new=1">กลับไปหน้าแบบทดสอบ / เริ่มผู้เข้าอบรมคนใหม่ →</a></main></body></html>').setTitle(title).addMetaTag('viewport','width=device-width, initial-scale=1');}
