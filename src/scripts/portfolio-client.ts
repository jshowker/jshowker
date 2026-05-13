const THUMB_SELECTOR = '.js-lightbox-thumb';
const LB_ID = 'lightbox';

function prefersReducedMotion(): boolean {
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* ---------- Lightbox ---------- */

function collectSlides(): { src: string; alt: string }[] {
	const imgs = document.querySelectorAll<HTMLImageElement>(`${THUMB_SELECTOR} img`);
	return Array.from(imgs).map((img) => ({
		src: img.currentSrc || img.src,
		alt: img.alt || '',
	}));
}

function initLightbox(): void {
	const root = document.getElementById(LB_ID);
	if (!root) return;

	const backdrop = root.querySelector<HTMLElement>('[data-lightbox-dismiss]');
	const btnClose = root.querySelector<HTMLButtonElement>('.lightbox-close');
	const btnPrev = root.querySelector<HTMLButtonElement>('.lightbox-prev');
	const btnNext = root.querySelector<HTMLButtonElement>('.lightbox-next');
	const imgEl = root.querySelector<HTMLImageElement>('.lightbox-img');
	const zoomWrap = root.querySelector<HTMLDivElement>('.lightbox-zoom-wrap');
	const scrollEl = root.querySelector<HTMLDivElement>('.lightbox-scroll');
	const counter = root.querySelector<HTMLSpanElement>('.lightbox-counter');
	const zoomIn = root.querySelector<HTMLButtonElement>('[data-zoom-in]');
	const zoomOut = root.querySelector<HTMLButtonElement>('[data-zoom-out]');
	const zoomReset = root.querySelector<HTMLButtonElement>('[data-zoom-reset]');

	if (
		!backdrop ||
		!btnClose ||
		!btnPrev ||
		!btnNext ||
		!imgEl ||
		!zoomWrap ||
		!scrollEl ||
		!counter ||
		!zoomIn ||
		!zoomOut ||
		!zoomReset
	) {
		return;
	}

	let slides: { src: string; alt: string }[] = [];
	let index = 0;
	let scale = 1;
	const minScale = 1;
	const maxScale = 4;
	let openRaf = 0;
	let closeTimer = 0;

	const reduced = prefersReducedMotion();

	function centerScroll(): void {
		requestAnimationFrame(() => {
			scrollEl.scrollLeft = Math.max(0, scrollEl.scrollWidth / 2 - scrollEl.clientWidth / 2);
			scrollEl.scrollTop = Math.max(0, scrollEl.scrollHeight / 2 - scrollEl.clientHeight / 2);
		});
	}

	function updateNavState(): void {
		const single = slides.length <= 1;
		btnPrev.disabled = single;
		btnNext.disabled = single;
		btnPrev.style.opacity = single ? '0.35' : '';
		btnNext.style.opacity = single ? '0.35' : '';
	}

	function setCounter(): void {
		counter.textContent = `${index + 1} / ${slides.length}`;
	}

	function applyScale(next: number, smooth = true): void {
		scale = Math.min(maxScale, Math.max(minScale, next));
		zoomWrap.classList.toggle('is-smooth', smooth && !reduced);
		zoomWrap.style.transform = `scale(${scale})`;
		if (scale <= minScale + 0.02) centerScroll();
	}

	function showIndex(i: number): void {
		if (!slides.length) return;
		index = (i + slides.length) % slides.length;
		const s = slides[index];
		imgEl.alt = s.alt;
		const done = (): void => {
			imgEl.style.opacity = '1';
			centerScroll();
		};
		imgEl.onload = () => done();
		if (!reduced) imgEl.style.opacity = '0';
		imgEl.removeAttribute('src');
		imgEl.src = s.src;
		if (imgEl.complete) done();
		setCounter();
		updateNavState();
		applyScale(minScale, false);
		centerScroll();
	}

	function openAt(i: number): void {
		slides = collectSlides();
		if (!slides.length) return;
		index = Math.max(0, Math.min(i, slides.length - 1));
		document.body.classList.add('lightbox-open');
		root.hidden = false;
		root.classList.add('is-ready');
		showIndex(index);
		cancelAnimationFrame(openRaf);
		openRaf = requestAnimationFrame(() => {
			root.classList.add('is-open');
		});
		btnClose.focus({ preventScroll: true });
	}

	function close(): void {
		window.clearTimeout(closeTimer);
		root.classList.remove('is-open');
		closeTimer = window.setTimeout(
			() => {
				root.hidden = true;
				root.classList.remove('is-ready');
				document.body.classList.remove('lightbox-open');
				imgEl.removeAttribute('src');
				imgEl.onload = null;
			},
			reduced ? 0 : 420
		);
	}

	function thumbIndex(el: Element): number {
		const thumbs = document.querySelectorAll(THUMB_SELECTOR);
		return Array.prototype.indexOf.call(thumbs, el);
	}

	document.addEventListener(
		'click',
		(e) => {
			const thumb = (e.target as Element).closest(THUMB_SELECTOR);
			if (!thumb) return;
			e.preventDefault();
			const i = thumbIndex(thumb);
			if (i >= 0) openAt(i);
		},
		true
	);

	btnClose.addEventListener('click', () => close());
	backdrop.addEventListener('click', () => close());
	btnPrev.addEventListener('click', () => showIndex(index - 1));
	btnNext.addEventListener('click', () => showIndex(index + 1));

	zoomIn.addEventListener('click', () => applyScale(scale + 0.25));
	zoomOut.addEventListener('click', () => applyScale(scale - 0.25));
	zoomReset.addEventListener('click', () => applyScale(minScale));

	imgEl.addEventListener('dblclick', () => applyScale(minScale));

	document.addEventListener('keydown', (e) => {
		if (root.hidden || !root.classList.contains('is-open')) return;
		if (e.key === 'Escape') {
			e.preventDefault();
			close();
		} else if (e.key === 'ArrowLeft') {
			e.preventDefault();
			showIndex(index - 1);
		} else if (e.key === 'ArrowRight') {
			e.preventDefault();
			showIndex(index + 1);
		}
	});

	scrollEl.addEventListener(
		'wheel',
		(e) => {
			if (!root.classList.contains('is-open')) return;
			if (e.ctrlKey || e.metaKey || e.altKey) {
				e.preventDefault();
				const delta = e.deltaY > 0 ? -0.12 : 0.12;
				applyScale(scale + delta);
			}
		},
		{ passive: false }
	);

	let drag = false;
	let sx = 0;
	let sy = 0;
	let sl = 0;
	let st = 0;

	scrollEl.addEventListener('mousedown', (e) => {
		if (e.button !== 0) return;
		if (scale <= minScale + 0.02) return;
		drag = true;
		sx = e.clientX;
		sy = e.clientY;
		sl = scrollEl.scrollLeft;
		st = scrollEl.scrollTop;
		scrollEl.classList.add('is-dragging');
	});

	window.addEventListener('mouseup', () => {
		drag = false;
		scrollEl.classList.remove('is-dragging');
	});

	window.addEventListener('mousemove', (e) => {
		if (!drag) return;
		e.preventDefault();
		const dx = e.clientX - sx;
		const dy = e.clientY - sy;
		scrollEl.scrollLeft = sl - dx;
		scrollEl.scrollTop = st - dy;
	});
}

/* ---------- Ambient particles ---------- */

function initParticles(): void {
	if (prefersReducedMotion()) return;
	const canvas = document.getElementById('dust-canvas') as HTMLCanvasElement | null;
	if (!canvas) return;
	const ctx = canvas.getContext('2d');
	if (!ctx) return;

	const particles: { x: number; y: number; r: number; vx: number; vy: number; a: number }[] = [];
	let w = 0;
	let h = 0;
	let raf = 0;

	function resize(): void {
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		w = window.innerWidth;
		h = window.innerHeight;
		canvas.style.width = `${w}px`;
		canvas.style.height = `${h}px`;
		canvas.width = Math.floor(w * dpr);
		canvas.height = Math.floor(h * dpr);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	}

	const count = () => Math.min(52, Math.max(18, Math.floor((window.innerWidth * window.innerHeight) / 38000)));

	function spawn(): void {
		particles.length = 0;
		const n = count();
		for (let i = 0; i < n; i++) {
			particles.push({
				x: Math.random() * w,
				y: Math.random() * h,
				r: Math.random() * 1.6 + 0.3,
				vx: (Math.random() - 0.5) * 0.1,
				vy: (Math.random() - 0.45) * 0.07 - 0.015,
				a: Math.random() * 0.28 + 0.06,
			});
		}
	}

	function tick(): void {
		if (document.hidden) return;
		ctx.clearRect(0, 0, w, h);
		for (const p of particles) {
			p.x += p.vx;
			p.y += p.vy;
			if (p.x < -12) p.x = w + 12;
			if (p.x > w + 12) p.x = -12;
			if (p.y < -12) p.y = h + 12;
			if (p.y > h + 12) p.y = -12;
			ctx.beginPath();
			ctx.fillStyle = `rgba(215, 220, 235, ${p.a})`;
			ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
			ctx.fill();
		}
		raf = requestAnimationFrame(tick);
	}

	function startLoop(): void {
		cancelAnimationFrame(raf);
		tick();
	}

	resize();
	spawn();
	startLoop();
	window.addEventListener('resize', () => {
		resize();
		spawn();
	});

	document.addEventListener('visibilitychange', () => {
		if (document.hidden) cancelAnimationFrame(raf);
		else startLoop();
	});
}

/* ---------- Hero parallax (pointer) ---------- */

function initHeroParallax(): void {
	if (prefersReducedMotion()) return;
	const layer = document.querySelector<HTMLElement>('.hero-parallax');
	if (!layer) return;

	let tx = 0;
	let ty = 0;
	let cx = 0;
	let cy = 0;
	const ease = 0.055;

	function loop(): void {
		cx += (tx - cx) * ease;
		cy += (ty - cy) * ease;
		layer.style.transform = `translate3d(${cx}px, ${cy}px, 0) scale(1.03)`;
		requestAnimationFrame(loop);
	}

	window.addEventListener(
		'mousemove',
		(e) => {
			tx = (e.clientX / window.innerWidth - 0.5) * 20;
			ty = (e.clientY / window.innerHeight - 0.5) * 16;
		},
		{ passive: true }
	);

	requestAnimationFrame(loop);
}

/* ---------- Scroll depth + soft section reveal ---------- */

function initScrollDepth(): void {
	const heroBg = document.querySelector<HTMLElement>('.hero-bg');
	if (!heroBg) return;

	function onScroll(): void {
		const y = window.scrollY;
		const shift = Math.min(1, y / 900);
		heroBg.style.setProperty('--scroll-shift', String(shift));
	}

	onScroll();
	window.addEventListener('scroll', onScroll, { passive: true });
}

function initSectionReveal(): void {
	const sections = document.querySelectorAll<HTMLElement>('.gallery-section');
	if (!sections.length) return;

	if (prefersReducedMotion()) {
		for (const s of sections) s.classList.add('is-revealed');
		return;
	}

	if (!('IntersectionObserver' in window)) {
		for (const s of sections) s.classList.add('is-revealed');
		return;
	}

	const io = new IntersectionObserver(
		(entries) => {
			for (const en of entries) {
				if (en.isIntersecting) en.target.classList.add('is-revealed');
			}
		},
		{ rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
	);

	for (const s of sections) io.observe(s);
}

export function initPortfolioClient(): void {
	initLightbox();
	initParticles();
	initHeroParallax();
	initScrollDepth();
	initSectionReveal();
}
