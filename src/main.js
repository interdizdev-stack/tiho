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
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const root = document.documentElement;
const story = $('.story');
const motionButton = $('.motion-toggle');
const systemMotion = matchMedia('(prefers-reduced-motion: reduce)');
let motionPreference = null;
try { motionPreference = localStorage.getItem('tishe-calm'); } catch { /* Private browsing can disable storage. */ }
let reducedMotion = motionPreference === null ? systemMotion.matches : motionPreference === 'true';
let room;
let storyTween;
let activeChapter = 0;
let frameVisible = true;
let lastRender = 0;
let pageAnimations;
const progressState = { value: 0 };
const pointer = { x: 0, y: 0 };
const copies = $$('.story-copy');
const chapterButtons = $$('[data-goto]');
const captions = ['Можно просто прийти.', 'Кажется, я немного волнуюсь…', 'Можно не торопиться.', 'Мне важно об этом рассказать.', 'Теперь я чуть лучше слышу себя.'];
const bounds = [0, 0.14, 0.34, 0.53, 0.79];

function renderStory(progress) {
  if (reducedMotion) progress = 0;
  const index = bounds.reduce((result, value, i) => progress >= value ? i : result, 0);
  if (index !== activeChapter) {
    const previous = copies[activeChapter];
    const next = copies[index];
    previous.setAttribute('aria-hidden', 'true'); previous.inert = true;
    next.setAttribute('aria-hidden', 'false'); next.inert = false;
    gsap.to(previous, { autoAlpha: 0, y: -16, filter: 'blur(4px)', duration: reducedMotion ? 0 : 0.35, overwrite: true });
    gsap.fromTo(next, { autoAlpha: 0, y: 20, filter: 'blur(4px)' }, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: reducedMotion ? 0 : 0.65, overwrite: true, delay: reducedMotion ? 0 : 0.13 });
    activeChapter = index;
    $('.scene-caption').textContent = captions[index];
  }
  const navIndex = index === 0 ? 0 : index - 1;
  chapterButtons.forEach((button, i) => { button.classList.toggle('is-active', i === navIndex); if (i === navIndex) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current'); });
  $('.story-progress span').style.transform = `scaleX(${progress})`;
}

function configureMotion() {
  root.classList.toggle('reduced-motion', reducedMotion);
  motionButton.setAttribute('aria-pressed', String(reducedMotion));
  motionButton.title = reducedMotion ? 'Вернуть анимацию истории' : 'Включить спокойный режим';
  $('.motion-label').textContent = reducedMotion ? 'Вернуть анимацию' : 'Меньше движения';
  $('.motion-symbol').textContent = reducedMotion ? '▷' : 'Ⅱ';
  room?.setReducedMotion(reducedMotion);
  storyTween?.scrollTrigger?.kill(); storyTween?.kill();
  gsap.killTweensOf(copies);
  copies.forEach((copy, index) => {
    gsap.set(copy, { autoAlpha: index === 0 ? 1 : 0, y: 0, yPercent: innerWidth > 760 ? -51 : 0, filter: 'none' });
    copy.inert = index !== 0; copy.setAttribute('aria-hidden', String(index !== 0));
  });
  activeChapter = 0; progressState.value = 0;
  renderStory(0);
  if (!reducedMotion) {
    storyTween = gsap.to(progressState, { value: 1, ease: 'none', onUpdate: () => renderStory(progressState.value), scrollTrigger: { trigger: story, start: 'top top', end: 'bottom bottom', scrub: 0.8, invalidateOnRefresh: true } });
  }
  configurePageAnimations();
  ScrollTrigger.refresh();
}
configureMotion();
motionButton.addEventListener('click', () => {
  const wasInStory = window.scrollY < story.offsetHeight;
  reducedMotion = !reducedMotion;
  motionPreference = String(reducedMotion);
  try { localStorage.setItem('tishe-calm', String(reducedMotion)); } catch { /* Preference is optional. */ }
  configureMotion();
  if (wasInStory) window.scrollTo({ top: 0, behavior: 'instant' });
});
systemMotion.addEventListener('change', event => { if (motionPreference === null) { reducedMotion = event.matches; configureMotion(); } });

chapterButtons.forEach(button => button.addEventListener('click', () => {
  const distance = story.offsetHeight - window.innerHeight;
  window.scrollTo({ top: story.offsetTop + distance * Number(button.dataset.goto), behavior: reducedMotion ? 'instant' : 'smooth' });
}));

const sceneWrap = $('.scene-wrap');
const sceneFallback = () => { sceneWrap.classList.add('is-ready'); $('.scene-fallback').hidden = false; $('#room-canvas').hidden = true; $('.scene-note').hidden = true; $('.scene-caption').hidden = true; };
import('./room.js').then(({ createRoom }) => {
  room = createRoom($('#room-canvas'), { reducedMotion, onReady: () => sceneWrap.classList.add('is-ready'), onError: sceneFallback });
  if (!room) return;
  const resize = () => room.resize(sceneWrap.clientWidth, sceneWrap.clientHeight);
  new ResizeObserver(resize).observe(sceneWrap); resize();
  gsap.ticker.add((time) => {
    if (!frameVisible || document.hidden || time - lastRender < 1 / 40) return;
    lastRender = time;
    room.update(reducedMotion ? 0 : progressState.value, reducedMotion ? 0 : time, reducedMotion ? { x: 0, y: 0 } : pointer);
  });
}).catch(error => { console.error('The 3D scene could not load:', error); sceneFallback(); });
new IntersectionObserver(entries => { frameVisible = entries[0].isIntersecting; }, { rootMargin: '100px' }).observe($('.story-stage'));
window.addEventListener('pointermove', event => { pointer.x = (event.clientX / innerWidth - 0.5) * 2; pointer.y = (event.clientY / innerHeight - 0.5) * 2; }, { passive: true });

function configurePageAnimations() {
  pageAnimations?.revert();
  if (reducedMotion) return;
  pageAnimations = gsap.context(() => {
  $$('.reveal').forEach(element => gsap.from(element, { y: 35, autoAlpha: 0, duration: 0.9, ease: 'power2.out', scrollTrigger: { trigger: element, start: 'top 91%', once: true } }));
  gsap.to('.about-circle', { y: 110, rotation: 15, ease: 'none', scrollTrigger: { trigger: '.about', start: 'top bottom', end: 'bottom top', scrub: 1 } });
  gsap.fromTo('.breathing-rings', { scale: .8, rotation: -18 }, { scale: 1.15, rotation: 18, ease: 'none', scrollTrigger: { trigger: '.breathing-section', start: 'top bottom', end: 'bottom top', scrub: 1.2 } });
  gsap.to('.closing-mark', { x: -80, ease: 'none', scrollTrigger: { trigger: '.closing', start: 'top bottom', end: 'bottom top', scrub: 1 } });
  });
}
document.fonts.ready.then(() => ScrollTrigger.refresh());
window.addEventListener('resize', () => gsap.set(copies, { yPercent: innerWidth > 760 ? -51 : 0 }), { passive: true });

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
