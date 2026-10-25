(() => {
 'use strict';
 const $ = id => document.getElementById(id), config = window.QUIZ_CONFIG, questions = window.QUIZ_QUESTIONS;
 const storageKey = 'smart-wh-pretest:' + config.version;
 let state = {attemptId:crypto.randomUUID(),startedAt:null,attendee:null,answers:{}};
 try { if(new URLSearchParams(location.search).get('new')==='1'){sessionStorage.removeItem(storageKey);history.replaceState(null,'',location.pathname);} const cached=JSON.parse(sessionStorage.getItem(storageKey)); if(cached && cached.attemptId && cached.answers) state=cached; } catch(_) {}
 const persist=()=>{try{sessionStorage.setItem(storageKey,JSON.stringify(state));}catch(_){}};
 const validEndpoint = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(config.endpoint);
 const ready = config.ready && validEndpoint;
 $('source-note').textContent=config.sourceNote;
 $('service-status').textContent=ready?'ระบบพร้อมรับคำตอบ • คะแนนจะยืนยันหลังบันทึกลง Google Sheets สำเร็จ':'กำลังตั้งค่าระบบบันทึกคำตอบ • ดูคำถามและทดลองกรอกได้ แต่ยังส่งคำตอบไม่ได้';
 if(ready)$('service-status').classList.add('ok');
 $('submit-button').disabled=!ready;
 const progress=()=>{const n=questions.filter(q=>Number.isInteger(state.answers[q.id])).length; $('progress-text').textContent=`${n} / ${questions.length} ข้อ`; $('progress').value=n;};
 questions.forEach(q=>{
  const field=document.createElement('fieldset');field.className='question';field.id='question-'+q.id;
  const legend=document.createElement('legend');legend.textContent=`ข้อ ${q.id.toString().padStart(2,'0')} · ${q.topic}`;field.append(legend);
  const heading=document.createElement('h3');heading.textContent=q.text;field.append(heading);
  q.options.forEach((text,index)=>{const label=document.createElement('label');label.className='option';const input=document.createElement('input');input.type='radio';input.name='q'+q.id;input.value=index;input.checked=state.answers[q.id]===index;input.addEventListener('change',()=>{state.answers[q.id]=index;persist();progress();});const span=document.createElement('span');span.textContent=`${['ก','ข','ค','ง'][index]}. ${text}`;label.append(input,span);field.append(label);});
  $('questions').append(field);
 });
 const showQuiz=()=>{$('registration').hidden=true;$('assessment').hidden=false;progress();};
 if(state.attendee){for(const [key,value] of Object.entries(state.attendee)){const input=$('register-form').elements.namedItem(key);if(input&&key!=='consent')input.value=value;} $('register-form').elements.consent.checked=true;showQuiz();}
 $('register-form').addEventListener('submit',e=>{e.preventDefault();const form=new FormData(e.target);state.attendee={fullName:String(form.get('fullName')).trim(),organization:String(form.get('organization')).trim(),role:String(form.get('role')).trim(),cohort:String(form.get('cohort')).trim(),consent:true};if(!state.attendee.fullName||!state.attendee.organization){$('service-status').textContent='กรุณากรอกชื่อและหน่วยงาน ไม่ใช้ช่องว่างเพียงอย่างเดียว';return;}state.startedAt=state.startedAt||new Date().toISOString();persist();showQuiz();$('assessment').scrollIntoView({behavior:'smooth'});});
 $('edit-registration').addEventListener('click',()=>{$('assessment').hidden=true;$('registration').hidden=false;$('registration').scrollIntoView({behavior:'smooth'});});
 $('quiz-form').addEventListener('submit',e=>{e.preventDefault();if(!ready)return;const missing=questions.filter(q=>!Number.isInteger(state.answers[q.id]));if(missing.length){$('validation').textContent=`ยังตอบไม่ครบ ${missing.length} ข้อ กรุณาตอบข้อ ${missing.map(q=>q.id).join(', ')}`;$('question-'+missing[0].id).scrollIntoView({behavior:'smooth',block:'center'});$('question-'+missing[0].id).querySelector('input').focus({preventScroll:true});return;}persist();$('payload').value=JSON.stringify({version:config.version,attemptId:state.attemptId,startedAt:state.startedAt,attendee:state.attendee,answers:questions.map(q=>state.answers[q.id])});$('transport').action=config.endpoint;$('submit-button').disabled=true;$('submit-button').textContent='กำลังส่งไปตรวจคะแนน…';$('transport').submit();});
 window.addEventListener('pageshow',()=>{$('submit-button').disabled=!ready;$('submit-button').textContent='ส่งคำตอบและดูคะแนน →';});
 persist();progress();
})();
