/* Paleskies interactions: deliberately small, progressively enhanced. */
(() => {
  const body = document.body;
  const year = document.querySelector('#year');
  const loader = document.querySelector('#loader');
  const root = document.documentElement;

  year.textContent = new Date().getFullYear();

  // Start every visit at the top, even when the browser or a #hash would jump elsewhere.
  const toTop = () => window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  toTop();

  window.addEventListener('load', () => {
    toTop();
    window.setTimeout(() => body.classList.add('is-loaded'), 350);
    window.setTimeout(() => loader.setAttribute('aria-hidden', 'true'), 1100);
  });

  document.addEventListener('contextmenu', (event) => event.preventDefault());

  // Blend-mode cursor. Pointer devices only; touch keeps its native behaviour.
  const cursor = document.querySelector('.cursor');
  if (cursor && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let pointerX = 0;
    let pointerY = 0;
    let isCursorQueued = false;
    const drawCursor = () => {
      cursor.style.transform = `translate3d(${pointerX}px, ${pointerY}px, 0)`;
      isCursorQueued = false;
    };
    document.addEventListener('mousemove', (event) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      cursor.classList.add('is-active');
      if (!isCursorQueued) {
        isCursorQueued = true;
        window.requestAnimationFrame(drawCursor);
      }
    });
    document.addEventListener('mouseleave', () => cursor.classList.remove('is-active'));
    document.addEventListener('mouseenter', () => cursor.classList.add('is-active'));
  }

  // A single background camera move: the page travels down through the image.
  let isBackgroundUpdateQueued = false;
  const panBackground = () => {
    const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollableHeight > 0 ? window.scrollY / scrollableHeight : 0;
    const imagePosition = 12 + (Math.min(Math.max(progress, 0), 1) * 76);
    root.style.setProperty('--background-y', `${imagePosition}%`);
    isBackgroundUpdateQueued = false;
  };
  const requestBackgroundPan = () => {
    if (!isBackgroundUpdateQueued) {
      window.requestAnimationFrame(panBackground);
      isBackgroundUpdateQueued = true;
    }
  };
  panBackground();
  window.addEventListener('scroll', requestBackgroundPan, { passive: true });
  window.addEventListener('resize', requestBackgroundPan);

  const revealItems = document.querySelectorAll('.reveal');
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  revealItems.forEach((item) => revealObserver.observe(item));

  // Reel videos: each card's link lives on its own data-src in index.html.
  // A card with an empty data-src simply keeps the placeholder artwork.
  const reelVideos = [...document.querySelectorAll('.reel-video')];
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  reelVideos.forEach((video) => {
    if (video.dataset.poster) video.poster = video.dataset.poster;
    video.addEventListener('loadeddata', () => video.closest('.reel-visual').classList.add('has-video'));
  });

  // Attach the file only as a card nears the viewport, and let it run only while on screen.
  const videoObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const video = entry.target;
      if (!video.dataset.src) return;
      if (!entry.isIntersecting) {
        video.pause();
        return;
      }
      if (!video.src) video.src = video.dataset.src;
      if (!prefersReducedMotion.matches) video.play().catch(() => {});
    });
  }, { rootMargin: '200px 0px', threshold: 0.25 });
  reelVideos.forEach((video) => videoObserver.observe(video));

  const soundButtons = document.querySelectorAll('.sound-toggle');
  const videoFor = (button) => button.closest('.reel-card').querySelector('.reel-video');
  soundButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const isActive = button.getAttribute('aria-pressed') === 'true';
      soundButtons.forEach((other) => {
        other.setAttribute('aria-pressed', 'false');
        other.setAttribute('aria-label', other.getAttribute('aria-label').replace('Disable', 'Enable'));
        const otherVideo = videoFor(other);
        if (otherVideo) otherVideo.muted = true;
      });
      button.setAttribute('aria-pressed', String(!isActive));
      button.setAttribute('aria-label', button.getAttribute('aria-label').replace(isActive ? 'Disable' : 'Enable', isActive ? 'Enable' : 'Disable'));
      const video = videoFor(button);
      if (video) {
        video.muted = isActive;
        if (!isActive) video.play().catch(() => {});
      }
    });
  });

  const quotes = [...document.querySelectorAll('.quote')];
  const dots = [...document.querySelectorAll('.quote-dots button')];
  let currentQuote = 0;
  let quoteTimer;
  const setQuote = (index) => {
    currentQuote = index;
    quotes.forEach((quote, i) => quote.classList.toggle('is-active', i === index));
    dots.forEach((dot, i) => {
      dot.classList.toggle('is-active', i === index);
      dot.setAttribute('aria-current', i === index ? 'true' : 'false');
    });
  };
  const startQuotes = () => {
    window.clearInterval(quoteTimer);
    quoteTimer = window.setInterval(() => setQuote((currentQuote + 1) % quotes.length), 6500);
  };
  dots.forEach((dot, i) => dot.addEventListener('click', () => { setQuote(i); startQuotes(); }));
  if (quotes.length) startQuotes(); // section is commented out in index.html; skip the empty timer

  // Contact form posts to Formspree over fetch so the visitor never leaves the page.
  const form = document.querySelector('#contact-form');
  const status = document.querySelector('#form-status');
  const submitButton = form.querySelector('.submit');
  const FALLBACK = 'Please email hq@matri6.com instead.';
  const setStatus = (message, isError) => {
    status.textContent = message;
    status.classList.toggle('is-error', Boolean(isError));
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (form.action.includes('YOUR_FORM_ID')) {
      setStatus('Form endpoint not set: add your Formspree id to the form action in index.html.', true);
      return;
    }
    submitButton.disabled = true;
    setStatus('Sending…');
    try {
      const response = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' },
      });
      if (response.ok) {
        form.reset();
        setStatus('Thank you. We will be in touch shortly.');
      } else {
        // Formspree reports validation and configuration problems as { errors: [{ message }] }.
        const data = await response.json().catch(() => null);
        const detail = data && Array.isArray(data.errors) ? data.errors.map((item) => item.message).join(' ') : '';
        setStatus(detail ? `${detail} ${FALLBACK}` : `That did not send. ${FALLBACK}`, true);
      }
    } catch (error) {
      setStatus(`Network error. ${FALLBACK}`, true);
    } finally {
      submitButton.disabled = false;
    }
  });
})();
