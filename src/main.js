import '@fontsource/manrope/cyrillic-400.css';
import '@fontsource/manrope/cyrillic-500.css';
import '@fontsource/manrope/cyrillic-600.css';
import '@fontsource/manrope/cyrillic-700.css';
import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/latin-600.css';
import '@fontsource/cormorant-garamond/cyrillic-500-italic.css';
import '@fontsource/cormorant-garamond/cyrillic-500.css';
import '@fontsource/cormorant-garamond/latin-500-italic.css';
import './style.css';
import gsap from 'gsap';

const $ = (selector, base = document) => base.querySelector(selector);
const $$ = (selector, base = document) => [...base.querySelectorAll(selector)];
const root = document.documentElement;
const chapters = $$('.film-chapter');
const sceneWrap = $('.scene-wrap');
const motionButton = $('.motion-toggle');
const systemMotion = matchMedia('(prefers-reduced-motion: reduce)');
let motionPreference = null;
try { motionPreference = localStorage.getItem('tishe-calm'); } catch {}
let reducedMotion = motionPreference === null ? systemMotion.matches : motionPreference === 'true';
let room;
let activeChapter = -1;
let chapterStarts = [];
let chapterSpans = [];
let readLine = innerHeight / 2;
let lastRender = 0;
let targetProgress = 0;
let scrollQueued = false;
let animationTime = 0;
const progressState = { value: 0 };
const pointer = { x: 0, y: 0 };
const pointerTarget = { x: 0, y: 0 };
const chapterButtons = $$('.chapter-nav button');
const captions = ['Можно просто прийти.', 'У меня столько всего внутри…', 'Спасибо. Я попробую начать.', 'Я рядом. И я вас слышу.', 'Мне важно об этом рассказать.', 'Сейчас можно никуда не спешить.', 'Мы можем быть на связи.', 'Это время — только для вас.', 'Можно задать ещё один вопрос?', 'Моя история продолжается.'];
const places = ['Кабинет. Начало истории.', 'Первые шаги. Немного волнения.', 'Два кресла. Место для вас.', 'Знакомство. Ваш психолог.', 'Разговор. По одной ниточке.', 'Тишина. Немного воздуха.', 'Онлайн. Через расстояния.', '50 минут. В вашем темпе.', 'Новая перспектива. Больше ясности.', 'Сад. Ваша история дальше.'];
const tones = ['#f7f4ed','#f5f1e8','#f5f1e8','#f4f1e8','#f2f0e6','#edf1e4','#edf1e7','#f2efdf','#f3ecd9','#f5ecd9'];

function updateChapter(index) {
  if (index === activeChapter) return;
  activeChapter = index;
  root.dataset.chapter = String(index);
  $('#chapter-number').textContent = String(index + 1).padStart(2,'0');
  $('#chapter-title').textContent = chapters[index].dataset.title;
  $('.scene-caption').textContent = captions[index];
  $('#scene-place').textContent = places[index];
  chapterButtons.forEach((button,i) => { if(i === index) button.setAttribute('aria-current','step'); else button.removeAttribute('aria-current'); });
  chapters.forEach((chapter,i) => chapter.classList.toggle('is-current',i === index));
  gsap.to(root,{ '--film-bg':tones[index], duration:reducedMotion ? 0 : 1.2, overwrite:true });
}

function storyProgress(readingPosition, index, chapterStart, chapterSpan, endPosition, count) {
  const span = index === count - 1 ? Math.max(1, 2 * (endPosition - chapterStart)) : Math.max(1, chapterSpan);
  const local = Math.max(0, Math.min(1, (readingPosition - chapterStart) / span));
  return Math.max(0, Math.min(1, (index + local - 0.5) / (count - 1)));
}

function measureChapters() {
  const mobile = innerWidth <= 760;
  const visualBottom = $('.film-visual').getBoundingClientRect().bottom;
  readLine = mobile ? visualBottom + Math.max(0,innerHeight - visualBottom - $('.film-controls').offsetHeight) * 0.48 : innerHeight * 0.5;
  chapterSpans = chapters.map(chapter => {
    const rect = chapter.getBoundingClientRect();
    // A long answer may add reading space, but must not retime the whole film.
    return Math.min(rect.height, mobile ? innerHeight - visualBottom : innerHeight);
  });
  chapterStarts = chapters.map(chapter => chapter.getBoundingClientRect().top + scrollY);
  updateScroll();
}

function updateScroll() {
  scrollQueued = false;
  if (!chapterStarts.length) return;
  const readingPosition = scrollY + readLine;
  const index = chapterStarts.reduce((current,start,i)=>readingPosition>=start?i:current,0);
  const endPosition = document.documentElement.scrollHeight - innerHeight + readLine;
  targetProgress = storyProgress(readingPosition,index,chapterStarts[index],chapterSpans[index],endPosition,chapters.length);
  if (scrollY <= 1) targetProgress = 0;
  updateChapter(index);
  $('.film-progress span').style.transform = `scaleX(${targetProgress})`;
  if (reducedMotion) progressState.value = targetProgress;
}

function goToChapter(index) {
  measureChapters();
  const target = Math.max(0,Math.min(chapters.length - 1,index));
  const mobileTop = chapterStarts[target] - $('.film-visual').getBoundingClientRect().bottom + 12;
  const top = target === 0 ? 0 : innerWidth <= 760 ? mobileTop : chapterStarts[target] + chapterSpans[target] / 2 - readLine;
  window.scrollTo({top,behavior:reducedMotion?'instant':'smooth'});
  history.replaceState(null,'',`#${chapters[target].id}`);
  chapters[target].tabIndex = -1;
  chapters[target].focus({preventScroll:true});
}
$$('[data-step-target]').forEach(control => control.addEventListener('click',event => {
  event.preventDefault();
  const index = Number(control.dataset.stepTarget);
  closeMenu();
  goToChapter(index);
}));
window.addEventListener('scroll',() => { if(!scrollQueued){scrollQueued=true;requestAnimationFrame(updateScroll);} },{passive:true});
window.addEventListener('resize',measureChapters,{passive:true});
new ResizeObserver(measureChapters).observe($('.narrative'));
document.fonts.ready.then(measureChapters);
document.querySelectorAll('details').forEach(detail=>detail.addEventListener('toggle',measureChapters));
document.addEventListener('focusin',event=>{
  const element=event.target;
  if(!element.matches('button,a,summary,input,textarea,select') || !element.closest('.narrative'))return;
  const rect=element.getBoundingClientRect();
  const top=innerWidth<=760?$('.film-visual').getBoundingClientRect().bottom+16:$('.site-header').offsetHeight+16;
  const bottom=innerHeight-$('.film-controls').offsetHeight-16;
  if(rect.top<top)window.scrollBy({top:rect.top-top,behavior:'instant'});
  else if(rect.bottom>bottom)window.scrollBy({top:rect.bottom-bottom,behavior:'instant'});
});

function configureMotion() {
  root.classList.toggle('reduced-motion',reducedMotion);
  motionButton.setAttribute('aria-pressed',String(reducedMotion));
  motionButton.setAttribute('aria-label',reducedMotion?'Вернуть анимацию истории':'Включить спокойный режим');
  $('.motion-label').textContent = reducedMotion?'Вернуть анимацию':'Меньше движения';
  $('.motion-symbol').textContent = reducedMotion?'▷':'Ⅱ';
  room?.setReducedMotion(reducedMotion);
  progressState.value=targetProgress;
  // The chapter, scroll position and all readable content are preserved.
}
configureMotion();
motionButton.addEventListener('click',()=>{
  reducedMotion=!reducedMotion;motionPreference=String(reducedMotion);
  try{localStorage.setItem('tishe-calm',motionPreference);}catch{}
  configureMotion();
});
systemMotion.addEventListener('change',event=>{if(motionPreference===null){reducedMotion=event.matches;configureMotion();}});

const sceneFallback=()=>{sceneWrap.classList.add('is-ready');$('.scene-fallback').hidden=false;$('#room-canvas').hidden=true;$('.scene-caption').hidden=true;};
import('./room.js').then(({createRoom})=>{
  room=createRoom($('#room-canvas'),{reducedMotion,onReady:()=>{sceneWrap.classList.add('is-ready');$('.scene-loading').setAttribute('aria-hidden','true');},onError:sceneFallback});
  if(!room)return;
  const resize=()=>{room.resize(sceneWrap.clientWidth,sceneWrap.clientHeight);room.update(progressState.value,animationTime,pointer);};
  new ResizeObserver(resize).observe(sceneWrap);resize();
  gsap.ticker.add((time,delta)=>{
    if(document.hidden)return;
    const smoothing=1-Math.exp(-Math.min(delta,64)/180);
    if(!reducedMotion)animationTime+=Math.min(delta,64)/1000;
    pointer.x+=(pointerTarget.x-pointer.x)*smoothing;
    pointer.y+=(pointerTarget.y-pointer.y)*smoothing;
    progressState.value=reducedMotion?targetProgress:progressState.value+(targetProgress-progressState.value)*smoothing;
    if(time-lastRender<1/40)return;
    lastRender=time;
    room.update(progressState.value,animationTime,reducedMotion?{x:0,y:0}:pointer);
  });
}).catch(error=>{console.error('The film could not load:',error);sceneFallback();});
window.addEventListener('pointermove',event=>{pointerTarget.x=(event.clientX/innerWidth-.5)*2;pointerTarget.y=(event.clientY/innerHeight-.5)*2;},{passive:true});
measureChapters();
window.addEventListener('load',()=>{measureChapters();const initial=chapters.findIndex(ch=>`#${ch.id}`===location.hash);if(initial>0)goToChapter(initial);},{once:true});

// Native dialog handles focus containment, Escape, and focus restoration.
const contactDialog = $('.contact-dialog');
const privacyDialog = $('.privacy-dialog');
const form = $('#contact-form');
const endpoint = import.meta.env.VITE_CONTACT_ENDPOINT?.trim();
const demo = !endpoint;
const messageField = form.elements.message;
$('#form-disclaimer').textContent = demo ? 'Демо-режим: данные не отправляются и не сохраняются.' : 'Не указывайте здесь медицинские сведения. Подробности обсудим на встрече.';
let dialogTrigger;
function openBooking(trigger, topic = '') {
  dialogTrigger = trigger;
  $('.form-view').hidden = false; $('.form-result').hidden = true;
  contactDialog.setAttribute('aria-labelledby', 'contact-title');
  $('.form-error').textContent = '';
  if (topic) messageField.value = `Хочу поговорить на тему «${topic}».`;
  closeMenu();
  contactDialog.showModal();
  document.body.style.overflow = 'hidden';
}
$$('[data-book]').forEach(button => button.addEventListener('click', () => openBooking(button)));
$$('[data-topic]').forEach(button => button.addEventListener('click', () => openBooking(button, button.dataset.topic)));
$$('dialog').forEach(dialog => {
  $('.dialog-close', dialog).addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target !== dialog) return; const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); });
  dialog.addEventListener('close', () => { document.body.style.overflow = ''; dialogTrigger?.focus({ preventScroll: true }); });
});
$('.result-close').addEventListener('click', () => contactDialog.close());
$('.privacy-link').addEventListener('click', event => { dialogTrigger = event.currentTarget; privacyDialog.showModal(); document.body.style.overflow = 'hidden'; });

function validContact(value) {
  if (value.includes('@') && !value.startsWith('@')) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  if (value.startsWith('@')) return /^@[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(value);
  return /^[+()\d\s-]+$/.test(value) && value.replace(/\D/g, '').length >= 10 && value.replace(/\D/g, '').length <= 15;
}
form.elements.contact.addEventListener('input', () => form.elements.contact.setCustomValidity(''));
form.addEventListener('submit', async event => {
  event.preventDefault();
  const contact = form.elements.contact.value.trim();
  if (!validContact(contact)) { form.elements.contact.setCustomValidity('Укажите email, телефон от 10 цифр или Telegram в формате @username.'); form.elements.contact.reportValidity(); return; }
  if (form.elements.name.value.trim().length < 2) { $('.form-error').textContent = 'Пожалуйста, укажите имя — минимум 2 символа.'; return; }
  $('.form-error').textContent = '';
  const submitButton = $('button[type=submit]', form);
  const originalLabel = submitButton.innerHTML;
  submitButton.disabled = true; submitButton.textContent = 'Отправляем…';
  try {
    if (!demo) {
      const endpointUrl = new URL(endpoint, location.origin);
      if (endpointUrl.protocol !== 'https:' && endpointUrl.hostname !== 'localhost' && endpointUrl.hostname !== '127.0.0.1') throw new Error('Для отправки требуется защищённое соединение.');
      const response = await fetch(endpointUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: form.elements.name.value.trim(), contact, format: form.elements.format.value, message: messageField.value.trim(), consent: form.elements.consent.checked }), signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error('Не удалось отправить заявку. Попробуйте ещё раз немного позже.');
    }
    $('.form-view').hidden = true; $('.form-result').hidden = false;
    $('#result-title').innerHTML = demo ? 'Всё готово<br><em>к первому шагу.</em>' : 'Первый шаг<br><em>сделан.</em>';
    $('#result-description').textContent = demo ? 'Форма проверена. Сейчас это демонстрация: заявка не отправлена, ваши данные нигде не сохранены.' : 'Спасибо за доверие. Ваше обращение отправлено. Свяжемся с вами по указанному контакту, чтобы договориться о встрече.';
    contactDialog.setAttribute('aria-labelledby', 'result-title');
    $('.result-close').focus();
    form.reset();
  } catch (error) { $('.form-error').textContent = error.name === 'TimeoutError' ? 'Сервис не ответил вовремя. Проверьте связь и попробуйте ещё раз.' : error.message || 'Не удалось отправить заявку. Попробуйте ещё раз.'; }
  finally { submitButton.disabled = false; submitButton.innerHTML = originalLabel; }
});

const menuButton = $('.menu-toggle');
const mobileMenu = $('.mobile-menu');
function closeMenu() { mobileMenu.classList.remove('is-open'); mobileMenu.inert = true; menuButton.setAttribute('aria-expanded', 'false'); menuButton.setAttribute('aria-label', 'Открыть меню'); }
menuButton.addEventListener('click', () => { const open = menuButton.getAttribute('aria-expanded') !== 'true'; mobileMenu.classList.toggle('is-open', open); mobileMenu.inert = !open; menuButton.setAttribute('aria-expanded', String(open)); menuButton.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню'); });
$$('a', mobileMenu).forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
document.addEventListener('click', event => { if (!event.target.closest('.site-header')) closeMenu(); });

const breathButton = $('.breath-button');
let breathInterval;
function stopPause(message = '') { clearInterval(breathInterval); breathInterval = null; $('.breathing-section').classList.remove('is-breathing'); breathButton.setAttribute('aria-pressed', 'false'); $('span:last-child', breathButton).textContent = 'Побыть здесь 20 секунд'; $('.breath-status').textContent = message; }
breathButton.addEventListener('click', () => {
  if (breathInterval) { stopPause(); return; }
  let seconds = 20;
  $('.breathing-section').classList.add('is-breathing'); breathButton.setAttribute('aria-pressed', 'true');
  $('span:last-child', breathButton).textContent = `Остановить паузу · ${seconds} с`;
  $('.breath-status').textContent = 'Устройтесь удобно. Дышите как вам комфортно.';
  breathInterval = setInterval(() => { seconds--; $('span:last-child', breathButton).textContent = `Остановить паузу · ${seconds} с`; if (seconds === 10) $('.breath-status').textContent = 'Почувствуйте опору под ногами. Можно никуда не спешить.'; if (seconds <= 0) stopPause('Спасибо, что оставили немного времени для себя.'); }, 1000);
});
$('#year').textContent = new Date().getFullYear();
