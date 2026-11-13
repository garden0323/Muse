window.MUSE_BETA=true;
window.MuseBoot=fetch('/api/session',{cache:'no-store',credentials:'same-origin'}).then(async r=>{if(!r.ok)throw Error('인증 서버에 연결하지 못했어요.');return r.json()}).catch(e=>({error:e.message,member:false,authenticated:false}));
