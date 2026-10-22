let pending;
const button=document.querySelector('[data-install]'),help=document.querySelector('[data-install-help]');
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();pending=event;});
button?.addEventListener('click',async()=>{help.hidden=false;help.focus();if(pending){await pending.prompt();pending=null;}});
window.addEventListener('appinstalled',()=>{if(button)button.textContent='Snelkoppeling toegevoegd';});
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
