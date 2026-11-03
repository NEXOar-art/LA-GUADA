import * as THREE from 'three';

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Three.js dibuja pequeñas brasas luminosas sobre la foto real del restaurante.
function createFireScene() {
  const canvas = document.querySelector('#fire-scene');
  const art = canvas?.parentElement;
  if (!canvas || !art) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch {
    canvas.hidden = true;
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 40);
  camera.position.z = 8;

  // Una textura radial hace que cada punto parezca una brasa suspendida.
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 64;
  const glowContext = glowCanvas.getContext('2d');
  const glow = glowContext.createRadialGradient(32, 32, 0, 32, 32, 32);
  glow.addColorStop(0, 'rgba(255,244,202,1)');
  glow.addColorStop(0.18, 'rgba(255,213,139,.9)');
  glow.addColorStop(0.48, 'rgba(238,145,105,.4)');
  glow.addColorStop(1, 'rgba(238,145,105,0)');
  glowContext.fillStyle = glow;
  glowContext.fillRect(0, 0, 64, 64);
  const glowTexture = new THREE.CanvasTexture(glowCanvas);

  const count = 38;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const particles = [];
  const emberColors = [new THREE.Color('#ffe4a1'), new THREE.Color('#f7ad83'), new THREE.Color('#f6d8ad')];
  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * 6.2;
    const y = Math.random() * 5.2 - 2.2;
    const z = (Math.random() - 0.5) * 2.8;
    positions.set([x, y, z], i * 3);
    const color = emberColors[i % emberColors.length];
    colors.set([color.r, color.g, color.b], i * 3);
    particles.push({ x, y, z, drift: (Math.random() - 0.5) * 0.22, rise: 0.0015 + Math.random() * 0.004, phase: Math.random() * Math.PI * 2 });
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    map: glowTexture, size: 0.42, transparent: true, opacity: 0.82,
    vertexColors: true, depthWrite: false, sizeAttenuation: true,
  });
  const sparks = new THREE.Points(geometry, material);
  scene.add(sparks);

  function resize() {
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.position.z = width < 500 ? 9 : 8;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  if (!prefersReducedMotion) {
    art.addEventListener('pointermove', event => {
      const rect = art.getBoundingClientRect();
      art.style.setProperty('--tilt-x', `${((event.clientY - rect.top) / rect.height - 0.5) * -1.4}deg`);
      art.style.setProperty('--tilt-y', `${((event.clientX - rect.left) / rect.width - 0.5) * 1.8}deg`);
    }, { passive: true });
    art.addEventListener('pointerleave', () => {
      art.style.setProperty('--tilt-x', '0deg');
      art.style.setProperty('--tilt-y', '0deg');
    }, { passive: true });
  }

  let visible = false;
  let frame = 0;
  const clock = new THREE.Clock();
  function draw() {
    frame = 0;
    if (!visible || document.hidden) return;
    const time = clock.getElapsedTime();
    if (!prefersReducedMotion) {
      particles.forEach((particle, index) => {
        particle.y += particle.rise;
        if (particle.y > 2.8) particle.y = -2.5;
        positions[index * 3] = particle.x + Math.sin(time * 0.6 + particle.phase) * particle.drift;
        positions[index * 3 + 1] = particle.y;
      });
      geometry.attributes.position.needsUpdate = true;
      material.opacity = 0.65 + Math.sin(time * 1.4) * 0.12;
    }
    renderer.render(scene, camera);
    if (!prefersReducedMotion) frame = requestAnimationFrame(draw);
  }
  function start() {
    if (prefersReducedMotion) { renderer.render(scene, camera); return; }
    if (!frame && visible && !document.hidden) frame = requestAnimationFrame(draw);
  }
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) start();
    else if (frame) { cancelAnimationFrame(frame); frame = 0; }
  }, { threshold: 0.01 });
  observer.observe(art);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && frame) { cancelAnimationFrame(frame); frame = 0; }
    else start();
  });
}

createFireScene();

// La foto se desplaza apenas con el scroll para dar sensación de profundidad.
const hero = document.querySelector('.hero');
const heroPhoto = document.querySelector('.hero-photo');
let scrollQueued = false;
function moveHeroPhoto() {
  if (!hero || !heroPhoto || prefersReducedMotion) return;
  const bounds = hero.getBoundingClientRect();
  const offset = Math.max(-32, Math.min(32, (window.innerHeight / 2 - bounds.top) * 0.055));
  heroPhoto.style.objectPosition = `53% calc(48% + ${offset.toFixed(1)}px)`;
  scrollQueued = false;
}
window.addEventListener('scroll', () => {
  if (!scrollQueued) {
    scrollQueued = true;
    requestAnimationFrame(moveHeroPhoto);
  }
}, { passive: true });
moveHeroPhoto();

// Las secciones aparecen con suavidad al entrar en pantalla.
const revealItems = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  }), { threshold: 0.12 });
  revealItems.forEach(item => revealObserver.observe(item));
} else {
  revealItems.forEach(item => item.classList.add('visible'));
}

// El calendario no permite pedir una fecha que ya pasó.
const dateInput = document.querySelector('#date');
const today = new Date();
today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
dateInput.min = today.toISOString().slice(0, 10);
document.querySelector('#year').textContent = new Date().getFullYear();

document.querySelector('#booking-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!event.currentTarget.reportValidity()) return;

  const data = new FormData(event.currentTarget);
  const date = new Date(`${data.get('date')}T12:00:00`).toLocaleDateString('es-AR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });
  const message = [
    'Hola La Guada, quiero consultar disponibilidad para una reserva:', '',
    `Nombre y apellido: ${data.get('name')}`,
    `Día y fecha: ${date}`,
    `Cantidad de asistentes: ${data.get('guests')}`,
    `E-mail: ${data.get('email') || 'No informado'}`, '', '¡Gracias!',
  ].join('\n');
  window.open(`https://wa.me/5493834033990?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
});
