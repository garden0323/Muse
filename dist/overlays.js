/* Outside interactions dismiss once, without falling through to the canvas. */
(()=>{'use strict';const byId=id=>document.getElementById(id);let swallowed=null;
const accountTrigger='[data-account-menu-trigger]';
let accountOpener=null;
function expanded(){
  const menu=byId('accountMenu');
  menu.classList.toggle('from-bottom-nav',!menu.hidden&&!!accountOpener?.closest('#bottomNav'));
  for(const trigger of document.querySelectorAll(accountTrigger)){
    trigger.setAttribute('aria-expanded',String(!menu.hidden&&trigger===accountOpener));
    trigger.setAttribute('aria-controls','accountMenu');
  }
}
function closeAccount(){byId('accountMenu').hidden=true;expanded()}
window.MuseOverlays={closeAccount};
for(const trigger of document.querySelectorAll(accountTrigger)){
  trigger.addEventListener('click',()=>{
    const menu=byId('accountMenu');
    menu.hidden=!menu.hidden&&accountOpener===trigger;
    accountOpener=trigger;
    expanded();
  });
}
document.addEventListener('pointerdown',e=>{let menu=byId('accountMenu');if(!menu.hidden&&!e.target.closest('#accountMenu,'+accountTrigger)){closeAccount();if(!e.target.closest('button,a,input,textarea,select')){swallowed=e.pointerId;e.preventDefault();e.stopImmediatePropagation()}}let dialogs=[...document.querySelectorAll('dialog[open]')],d=dialogs.at(-1);if(d&&e.target===d){let r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom){swallowed=e.pointerId;e.preventDefault();e.stopImmediatePropagation();if(d.dataset.protected!=='true'&&!d.dataset.edited)d.close()}}},true);
document.addEventListener('pointerup',e=>{if(swallowed===e.pointerId){e.preventDefault();e.stopImmediatePropagation();setTimeout(()=>swallowed=null,0)}},true);
document.addEventListener('click',e=>{if(swallowed!==null){e.preventDefault();e.stopImmediatePropagation();swallowed=null}else if(e.target.closest('#accountMenu button,#accountMenu a'))closeAccount()},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!byId('accountMenu').hidden){closeAccount();e.stopImmediatePropagation();accountOpener?.focus({preventScroll:true})}},true);
document.addEventListener('input',e=>{let d=e.target.closest('dialog');if(d&&!e.target.matches('input[type=search],#recipientSearch'))d.dataset.edited='true'});
for(let d of document.querySelectorAll('dialog'))d.addEventListener('cancel',e=>{if(d.dataset.edited&&!confirm('작성 중인 내용을 닫을까요?'))e.preventDefault()});
new MutationObserver(expanded).observe(byId('accountMenu'),{attributes:true,attributeFilter:['hidden']});expanded();
})();
