(() => {
  const root = document.documentElement;
  root.classList.add('js');
  try { localStorage.removeItem('bitg-theme'); } catch {}
  const header = document.querySelector('[data-header]');
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('#navigation');
  const onScroll = () => header?.classList.toggle('is-scrolled', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const setMenu = open => {
    toggle?.setAttribute('aria-expanded', String(open));
    if (open && header) nav?.style.setProperty('top', `${Math.max(0, header.getBoundingClientRect().bottom)}px`);
    nav?.classList.toggle('is-open', open);
    root.style.overflow = open ? 'hidden' : '';
    if (open) nav?.querySelector('a')?.focus();
  };
  const closeMenu = () => { if (toggle?.getAttribute('aria-expanded') === 'true') setMenu(false); };
  toggle?.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', event => {
    if (toggle?.getAttribute('aria-expanded') !== 'true') return;
    if (event.key === 'Escape') { setMenu(false); toggle.focus(); return; }
    if (event.key !== 'Tab') return;
    // Keep focus inside the open mobile menu: the toggle and the menu links.
    const items = [toggle, ...nav.querySelectorAll('a')], first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  nav?.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));
  matchMedia('(min-width: 861px)').addEventListener('change', event => { if (event.matches) closeMenu(); });
  // Content above the fold stays visible; only sections further down get an entrance.
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // Reveal every waiting element that is in or above the viewport, so fast scrolling never skips one.
    const reveal = () => document.querySelectorAll('.will-reveal:not(.is-visible)').forEach(el=>{if(el.getBoundingClientRect().top<innerHeight){el.classList.add('is-visible');observer.unobserve(el);}});
    const observer = new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))reveal();},{threshold:0});
    document.querySelectorAll('[data-reveal]').forEach(el=>{if(el.getBoundingClientRect().top<innerHeight)return;el.classList.add('will-reveal');observer.observe(el);});
  }
  const count = event => { if (window.goatcounter?.count) window.goatcounter.count({path:event,event:true}); };
  document.querySelectorAll('a[href^="https://wa.me/"]').forEach(a=>a.addEventListener('click',()=>count('contact-whatsapp')));
  document.querySelectorAll('a[href^="mailto:"]').forEach(a=>a.addEventListener('click',()=>count('contact-email')));
  document.querySelectorAll('a[href^="tel:"]').forEach(a=>a.addEventListener('click',()=>count('contact-phone')));
  const form = document.querySelector('[data-contact-form]');
  if (!form) return;
  const nl = form.dataset.locale === 'nl';
  const messages = nl ? {
    send:'Verstuur je aanvraag',sending:'Versturen…',error:'Versturen is niet gelukt. Je invoer blijft staan. Probeer het opnieuw of gebruik een directe contactmogelijkheid.',limited:'Je hebt kort na elkaar meerdere aanvragen gedaan. Probeer het over tien minuten opnieuw.',invalid:'Controleer je naam, e-mailadres en trainingsdoel.'
  } : {send:'Send your request',sending:'Sending…',error:'Your request could not be sent. Your entries are still here. Please try again or use a direct contact option.',limited:'You have sent several requests recently. Please try again in ten minutes.',invalid:'Please check your name, email address and training goal.'};
  const params = new URLSearchParams(location.search);
  for (const name of ['goal','format']) {
    const input = form.elements.namedItem(name), value = params.get(name);
    if (input && value && [...input.options].some(option=>option.value===value)) { input.value=value; if(name==='format') form.querySelector('.form-more').open=true; }
  }
  if (form.hasAttribute('data-preview-form')) {
    form.addEventListener('submit', event => {
      event.preventDefault();
      const status = form.querySelector('.form-status');
      status.textContent = nl
        ? 'Test geslaagd. Er zijn geen gegevens verstuurd of opgeslagen.'
        : 'Test completed. No information was sent or stored.';
      status.focus();
    });
    form.querySelector('button[type=submit]').disabled = false;
    return;
  }
  let requestId;
  form.addEventListener('submit', async event => {
    if (!window.crypto?.randomUUID || !window.fetch) return;
    event.preventDefault();
    if (!form.reportValidity()) return;
    const button=form.querySelector('button[type=submit]'),status=form.querySelector('.form-status');
    if(button.disabled)return;
    requestId ||= crypto.randomUUID();
    button.disabled=true;button.textContent=messages.sending;status.textContent='';delete status.dataset.error;
    try {
      const body={...Object.fromEntries(new FormData(form)),requestId};
      const response=await fetch(form.action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      if (!response.ok) {const error=new Error(response.status===429?messages.limited:response.status===400?messages.invalid:messages.error);throw error;}
      form.classList.add('is-success');const success=form.querySelector('.form-success');success.hidden=false;success.focus();form.reset();requestId=undefined;count('contact-submitted');
    } catch(error) {status.textContent=error instanceof Error&&Object.values(messages).includes(error.message)?error.message:messages.error;status.dataset.error='true';status.focus();}
    finally{button.disabled=false;button.innerHTML=`${messages.send}<span aria-hidden="true">↗</span>`;}
  });
})();
