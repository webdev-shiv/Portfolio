(() => {
  'use strict';

  // 82 Full HD Frames for ultra-smooth scroll animation
  let TOTAL_FRAMES = 82;
  const FRAME_PREFIX = 'frames/';
  const FRAME_EXT = '.png';

  let frameFiles = [];
  for (let i = 1; i <= 82; i++) {
    frameFiles.push(`${FRAME_PREFIX}${String(i).padStart(3, '0')}${FRAME_EXT}`);
  }

  // Watermark covering configuration
  // The star watermark is centered in bottom-right corner of 1920x1080 source frames
  window.WATERMARK_CONFIG = {
    enabled: true,
    src: 'logo.png',
    // Position ratios relative to 1920x1080 frame
    xRatio: 1715 / 1920, // ~0.8932
    yRatio: 885 / 1080,  // ~0.8194
    // Base size scaled with frame size
    baseSize: 140,
    offsetX: 0,
    offsetY: 0,
    opacity: 1.0
  };

  const watermarkImg = new Image();
  watermarkImg.src = window.WATERMARK_CONFIG.src;

  // Dynamic velocity and momentum tracking
  let lastScrollY = window.scrollY || 0;
  let lastScrollTime = performance.now();
  let scrollVelocity = 0; // px per millisecond
  let isFastScrolling = false;
  let scrollVelocityDecayTimer = null;

  const FRAME_WIDTH = 1920;
  const FRAME_HEIGHT = 1080;

  const canvas = document.getElementById('animation-canvas');
  const progressBar = document.getElementById('scroll-progress-bar');
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

  let images = new Array(TOTAL_FRAMES + 1);
  let loadedFlags = new Uint8Array(TOTAL_FRAMES + 1);

  let currentFrame = 1.0;
  let targetFrame = 1.0;
  let lastRenderedFloor = -1;
  let lastRenderedFraction = -1;

  function trackScrollVelocity() {
    const now = performance.now();
    const currentScrollY = window.scrollY || window.pageYOffset || 0;
    const dt = Math.max(now - lastScrollTime, 1);
    const dy = Math.abs(currentScrollY - lastScrollY);

    const instantVelocity = dy / dt;
    if (instantVelocity > scrollVelocity) {
      scrollVelocity = instantVelocity;
    } else {
      scrollVelocity = scrollVelocity * 0.7 + instantVelocity * 0.3;
    }

    isFastScrolling = scrollVelocity > 1.2;
    lastScrollY = currentScrollY;
    lastScrollTime = now;

    clearTimeout(scrollVelocityDecayTimer);
    scrollVelocityDecayTimer = setTimeout(() => {
      scrollVelocity = 0;
      isFastScrolling = false;
    }, 60);
  }

  function getFrameSrc(index) {
    if (frameFiles && frameFiles[index - 1]) {
      return frameFiles[index - 1];
    }
    const step = Math.min(Math.max(1, index), TOTAL_FRAMES);
    const padded = String(step).padStart(3, '0');
    return `${FRAME_PREFIX}${padded}${FRAME_EXT}`;
  }

  function getMaxScroll() {
    return Math.max(
      document.documentElement.scrollHeight - window.innerHeight,
      1
    );
  }

  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const displayWidth = window.innerWidth;
    const displayHeight = window.innerHeight;

    const renderWidth = Math.round(displayWidth * dpr);
    const renderHeight = Math.round(displayHeight * dpr);

    if (canvas.width !== renderWidth || canvas.height !== renderHeight) {
      canvas.width = renderWidth;
      canvas.height = renderHeight;
    }

    lastRenderedFloor = -1;
    lastRenderedFraction = -1;
    render();
  }

  function isFrameLoaded(index) {
    return loadedFlags[index] === 1 && images[index] && images[index].naturalWidth > 0;
  }

  function getNearestLoadedFrame(requestedIndex) {
    const targetIdx = Math.min(Math.max(1, Math.round(requestedIndex)), TOTAL_FRAMES);
    if (isFrameLoaded(targetIdx)) {
      return images[targetIdx];
    }

    // Bidirectional search outward to prevent any flicker or blank frames
    for (let offset = 1; offset < TOTAL_FRAMES; offset++) {
      const prev = targetIdx - offset;
      if (prev >= 1 && isFrameLoaded(prev)) {
        return images[prev];
      }
      const next = targetIdx + offset;
      if (next <= TOTAL_FRAMES && isFrameLoaded(next)) {
        return images[next];
      }
    }

    return null;
  }

  // Full-bleed cover framing for animation frames
  function computeLayout(imgW, imgH) {
    const canvasW = canvas.width;
    const canvasH = canvas.height;

    const hRatio = canvasW / imgW;
    const vRatio = canvasH / imgH;

    const scale = Math.max(hRatio, vRatio);

    const drawW = imgW * scale;
    const drawH = imgH * scale;
    const drawX = (canvasW - drawW) * 0.5;
    const drawY = (canvasH - drawH) * 0.5;

    return { drawX, drawY, drawW, drawH, canvasW, canvasH };
  }

  function drawWatermarkOverlay(layout) {
    const cfg = window.WATERMARK_CONFIG;
    if (!cfg || !cfg.enabled || !watermarkImg.complete || watermarkImg.naturalWidth === 0) {
      return;
    }

    // Calculate position locked to the frame coordinates
    const scaleFactor = layout.drawW / FRAME_WIDTH;
    const logoSize = cfg.baseSize * scaleFactor;

    const targetX = layout.drawX + (cfg.xRatio * layout.drawW) + (cfg.offsetX * scaleFactor);
    const targetY = layout.drawY + (cfg.yRatio * layout.drawH) + (cfg.offsetY * scaleFactor);

    const drawX = targetX - (logoSize * 0.5);
    const drawY = targetY - (logoSize * 0.5);

    ctx.save();
    ctx.globalAlpha = cfg.opacity || 1.0;
    ctx.drawImage(watermarkImg, drawX, drawY, logoSize, logoSize);
    ctx.restore();
  }

  // Soft edge vignette to guarantee seamless fade into pure black (#000000)
  function drawEdgeVignette(layout) {
    const { canvasW, canvasH, drawX, drawY, drawW, drawH } = layout;

    // Top soft fade
    const gradTop = ctx.createLinearGradient(0, drawY, 0, drawY + 70);
    gradTop.addColorStop(0, '#000000');
    gradTop.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradTop;
    ctx.fillRect(drawX, drawY, drawW, 70);

    // Bottom soft fade
    const gradBottom = ctx.createLinearGradient(0, drawY + drawH - 90, 0, drawY + drawH);
    gradBottom.addColorStop(0, 'rgba(0,0,0,0)');
    gradBottom.addColorStop(1, '#000000');
    ctx.fillStyle = gradBottom;
    ctx.fillRect(drawX, drawY + drawH - 90, drawW, 90);

    // Left soft fade
    const gradLeft = ctx.createLinearGradient(drawX, 0, drawX + 90, 0);
    gradLeft.addColorStop(0, '#000000');
    gradLeft.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradLeft;
    ctx.fillRect(drawX, drawY, 90, drawH);

    // Right soft fade
    const gradRight = ctx.createLinearGradient(drawX + drawW - 90, 0, drawX + drawW, 0);
    gradRight.addColorStop(0, 'rgba(0,0,0,0)');
    gradRight.addColorStop(1, '#000000');
    ctx.fillStyle = gradRight;
    ctx.fillRect(drawX + drawW - 90, drawY, 90, drawH);
  }

  function render() {
    if (!canvas || !ctx) return;

    const clampedFrame = Math.min(Math.max(1, currentFrame), TOTAL_FRAMES);
    const floorIndex = Math.floor(clampedFrame);
    const ceilIndex = Math.min(TOTAL_FRAMES, floorIndex + 1);
    const fraction = clampedFrame - floorIndex;

    const floorImg = getNearestLoadedFrame(floorIndex);
    const ceilImg = (ceilIndex !== floorIndex && fraction > 0.01) ? getNearestLoadedFrame(ceilIndex) : null;

    if (!floorImg) return;

    const imgW = floorImg.naturalWidth || FRAME_WIDTH;
    const imgH = floorImg.naturalHeight || FRAME_HEIGHT;
    const layout = computeLayout(imgW, imgH);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Clear canvas with deep black
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, layout.canvasW, layout.canvasH);

    // Draw floor frame
    ctx.globalAlpha = 1.0;
    ctx.drawImage(
      floorImg,
      0, 0, floorImg.naturalWidth, floorImg.naturalHeight,
      layout.drawX, layout.drawY, layout.drawW, layout.drawH
    );

    // Cross-fade ceil frame for 60fps smooth sub-frame interpolation
    if (ceilImg && ceilImg !== floorImg && fraction > 0.01) {
      ctx.globalAlpha = fraction;
      ctx.drawImage(
        ceilImg,
        0, 0, ceilImg.naturalWidth, ceilImg.naturalHeight,
        layout.drawX, layout.drawY, layout.drawW, layout.drawH
      );
    }

    ctx.globalAlpha = 1.0;

    // Optional watermark
    drawWatermarkOverlay(layout);

    // Seamless edge vignette blending into black background
    drawEdgeVignette(layout);
  }

  function updateTargetFromScroll() {
    trackScrollVelocity();

    const maxScroll = getMaxScroll();
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const rawProgress = Math.min(Math.max(scrollY / maxScroll, 0), 1);
    
    // Direct linear synchronization: scroll wheel speed matches animation speed exactly
    targetFrame = 1 + rawProgress * (TOTAL_FRAMES - 1);

    // Strict boundary locking for Top and Bottom
    if (scrollY <= 2) {
      targetFrame = 1.0;
    } else if (scrollY >= maxScroll - 2) {
      targetFrame = TOTAL_FRAMES;
    }

    if (progressBar) {
      progressBar.style.width = `${(rawProgress * 100).toFixed(2)}%`;
    }
  }

  function animationLoop() {
    const delta = targetFrame - currentFrame;
    const absDelta = Math.abs(delta);

    if (absDelta > 0.001) {
      const scrollY = window.scrollY || window.pageYOffset || 0;
      const maxScroll = getMaxScroll();
      const isAtExtremes = (scrollY <= 2) || (scrollY >= maxScroll - 2);

      // Responsive base tracking factor:
      // Smoothly tracks the scroll wheel speed with no lag or sluggishness
      let factor = 0.38;

      // Dynamic adaptive boost:
      // When scrolling fast or across larger frame distances, boost factor up to 0.98
      // so the animation stays tightly locked to the scroll wheel
      const velocityBoost = Math.min(0.50, scrollVelocity * 0.15);
      const distanceBoost = Math.min(0.50, Math.max(0, absDelta - 0.5) * 0.08);
      factor = Math.min(0.98, factor + velocityBoost + distanceBoost);

      // When reaching top or bottom extremes, lock immediately
      if (isAtExtremes) {
        factor = Math.max(factor, 0.92);
      }

      // Snap cleanly when within a negligible fraction of the target
      if (absDelta < 0.02 || (isAtExtremes && absDelta < 0.2)) {
        currentFrame = targetFrame;
      } else {
        currentFrame += delta * factor;
      }

      render();
    } else if (currentFrame !== targetFrame) {
      currentFrame = targetFrame;
      render();
    }

    requestAnimationFrame(animationLoop);
  }

  // Optimized Priority Preloading Engine
  let loadedFramesCount = 0;

  function initPreloader() {
    function loadSingleFrame(idx, onLoaded) {
      if (images[idx] && loadedFlags[idx] === 1) return;
      const img = new Image();
      img.decoding = 'async';
      img.src = getFrameSrc(idx);
      images[idx] = img;

      img.onload = () => {
        if (loadedFlags[idx] !== 1) {
          loadedFlags[idx] = 1;
          loadedFramesCount++;
          const pct = Math.min(100, Math.floor((loadedFramesCount / TOTAL_FRAMES) * 100));
          if (typeof updateLiquidProgress === 'function') {
            updateLiquidProgress(pct);
          }
        }
        const currentFloor = Math.floor(currentFrame);
        if (currentFloor === idx || currentFloor + 1 === idx) {
          render();
        }
        if (onLoaded) onLoaded();
      };

      img.onerror = () => {
        console.warn(`Failed to load frame ${idx}`);
      };
    }

    // 1. Immediately load top, bottom, and initial keypoint frames dynamically
    const stepSize = Math.max(1, Math.floor(TOTAL_FRAMES / 8));
    const prioritySet = new Set([1, 2, 3, 4, 5, TOTAL_FRAMES]);
    for (let p = stepSize; p < TOTAL_FRAMES; p += stepSize) {
      prioritySet.add(p);
    }
    const priorityIndices = Array.from(prioritySet).sort((a, b) => a - b);

    priorityIndices.forEach(idx => {
      loadSingleFrame(idx, () => {
        if (idx === 1) {
          resizeCanvas();
        }
      });
    });

    // 2. Preload all remaining frames concurrently in swift batches
    const remainingIndices = [];
    for (let i = 1; i <= TOTAL_FRAMES; i++) {
      if (!priorityIndices.includes(i)) {
        remainingIndices.push(i);
      }
    }

    const BATCH_SIZE = 16;
    let nextBatchStart = 0;

    function loadNextBatch() {
      if (nextBatchStart >= remainingIndices.length) return;

      const end = Math.min(nextBatchStart + BATCH_SIZE, remainingIndices.length);
      for (let i = nextBatchStart; i < end; i++) {
        loadSingleFrame(remainingIndices[i]);
      }

      nextBatchStart = end;
      if (nextBatchStart < remainingIndices.length) {
        setTimeout(loadNextBatch, 8);
      }
    }

    setTimeout(loadNextBatch, 8);
  }

  // Scroll listener that drives the frame target synchronously
  window.addEventListener('scroll', updateTargetFromScroll, { passive: true });
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('orientationchange', resizeCanvas);

  // Active Navigation link updater based on scroll position
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('section[id]');

  function updateActiveNav() {
    const scrollY = window.scrollY || window.pageYOffset || 0;
    let currentId = '';

    sections.forEach(section => {
      const sectionTop = section.offsetTop - 120;
      const sectionHeight = section.offsetHeight;
      if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
        currentId = section.getAttribute('id');
      }
    });

    if (!currentId && sections.length > 0) {
      currentId = sections[0].getAttribute('id');
    }

    navLinks.forEach(link => {
      link.classList.remove('active');
      const href = link.getAttribute('href');
      if (href === `#${currentId}`) {
        link.classList.add('active');
      }
    });
  }

  window.addEventListener('scroll', updateActiveNav, { passive: true });

  // ==========================================================================
  // 3D RADIAL FANNED CARDS & TURNTABLE COMPASS DIAL CONTROLLER
  // ==========================================================================
  function initRadialDeck() {
    const arena = document.getElementById('deck-fan-arena');
    if (!arena) return;

    const cards = Array.from(arena.querySelectorAll('.fanned-card'));
    const turntableDisc = document.getElementById('turntable-disc');
    const counterEl = document.getElementById('deck-counter');
    const prevBtn = document.getElementById('deck-prev-btn');
    const nextBtn = document.getElementById('deck-next-btn');

    // Spotlight Elements
    const spotlightNum = document.getElementById('spotlight-number');
    const spotlightSub = document.getElementById('spotlight-sub');
    const spotlightTitle = document.getElementById('spotlight-title');
    const spotlightDesc = document.getElementById('spotlight-desc');
    const spotlightTags = document.getElementById('spotlight-tags');
    const spotlightCta = document.getElementById('spotlight-cta');

    // Toggle Grid View
    const toggleBtn = document.getElementById('deck-view-toggle');
    const stageContainer = document.getElementById('deck-stage-container');
    const gridView = document.getElementById('projects-grid-view');

    const projectData = [
      {
        num: '01',
        title: 'Government Scheme Welfare Agent Portal',
        sub: 'Full-Stack React + Vite • ADK Multi-Agent • Gemini AI',
        desc: "An AI-powered Government Welfare Operating System built on Google's Agent Development Kit (ADK) and Gemini. Features an interactive React + Vite citizen dashboard with a WhatsApp-style AI assistant, document vault, and NGO portal, paired with a FastAPI backend managing 8 specialized sub-agents for scheme discovery, eligibility evaluation, and fraud scoring.",
        tags: ['React + Vite', 'Gemini AI', 'Google ADK', 'FastAPI', 'Multi-Agent', 'Document Vault', 'Accessibility'],
        url: 'https://github.com/webdev-shiv/Welfare-Agent'
      },
      {
        num: '02',
        title: 'SmritiCare AI — Cognitive Platform (Sarthi)',
        sub: 'SIH 2026 Internal Hackathon Shortlist • Team Hactivators',
        desc: 'An AI-powered solution developed by Team Hactivators, shortlisted in the Internal Hackathon for Smart India Hackathon (SIH) 2026. Built with the aim of creating meaningful impact through technology, spanning research, ideation, AI development, PPT preparation, and presentation. Features 4 adaptive cognitive games, transparent AI Adaptive Difficulty engine, 8-language voice assistant with offline Whisper Tiny browser transcription, NER cultural personalization across 8 states, and a caregiver telemetry dashboard.',
        tags: ['SIH 2026 Shortlist', 'Team Hactivators', 'React 18 + Vite', 'Whisper Tiny', 'AI Adaptive Engine', 'Web Speech API', 'Offline-First'],
        url: 'https://github.com/webdev-shiv/sarthi'
      },
      {
        num: '03',
        title: 'Merchant Growth AI (VANIK)',
        sub: 'Top 5 Finalist • Paytm Merchant Intelligence Hackathon',
        desc: 'An AI-powered merchant intelligence and POS platform that turns transaction & Soundbox telemetry into explainable growth decisions. Integrates Cognee Knowledge Graph episodic memory for root-cause revenue slump diagnosis, What-If microeconomic campaign simulations, real-time POS billing with dynamic UPI QR & Soundbox voice synthesis, and Spring Boot + FastAPI architecture.',
        tags: ['Next.js 14', 'Java 21 Spring Boot', 'FastAPI', 'Cognee Knowledge Graph', 'POS Billing', 'Soundbox Voice AI', 'Top 5 Finalist'],
        url: 'https://github.com/webdev-shiv/vanik'
      },
      {
        num: '04',
        title: 'Sorty — Real-Time Windows Downloads Organizer',
        sub: 'Python (Tkinter + ttk) • Watchdog • SQLite • Windows 11 UI',
        desc: 'A lightweight, high-performance, deterministic Windows desktop productivity utility that automatically organizes files in your Windows Downloads folder in real time with 100% zero data loss guarantee and 1-click reversible undo.',
        tags: ['Python', 'Tkinter', 'Watchdog', 'SQLite', 'PyInstaller', 'Windows 11 UI'],
        url: 'https://github.com/webdev-shiv/sorty'
      },
      {
        num: '05',
        title: 'The Binary Club — Recruitment Portal',
        sub: 'Recruitment & Onboarding Platform • RKGIT',
        desc: 'Collegiate recruitment and onboarding platform built for The Binary Club, RKGIT. Streamlined candidate registration and recruitment workflows, enabled centralized candidate tracking, implemented peer-based technical evaluation processes, and simplified shortlisting for coordinators to make member selection faster and more organized.',
        tags: ['React.js', 'Node.js', 'Recruitment Workflows', 'Peer Evaluations', 'RKGIT', 'The Binary Club'],
        url: 'https://github.com/webdev-shiv/BINARY_CLUB'
      }
    ];

    let activeIndex = 0;
    const totalCards = cards.length;

    function renderDeck(idx) {
      // Clamped boundary: stuck at 1st card on left, stuck at last card on right
      const activeIdx = Math.max(0, Math.min(totalCards - 1, idx));
      activeIndex = activeIdx;
      const isMobile = window.innerWidth < 768;
      const xSpacing = isMobile ? 85 : 138;
      const yArch = isMobile ? 12 : 20;

      cards.forEach((card, i) => {
        const diff = i - activeIdx;
        const absDiff = Math.abs(diff);

        // Radial fanned deck geometry
        const rot = diff * 14;
        const tx = diff * xSpacing;
        let ty = absDiff * yArch;
        let scale = Math.max(0.8, 1 - absDiff * 0.06);
        let opacity = Math.max(0.38, 1 - absDiff * 0.16);

        if (diff === 0) {
          card.classList.add('is-active');
          card.setAttribute('aria-selected', 'true');
          ty -= 22;
          scale = 1.06;
          opacity = 1.0;
        } else {
          card.classList.remove('is-active');
          card.setAttribute('aria-selected', 'false');
        }

        const zIndex = 25 - absDiff;
        card.style.zIndex = zIndex;
        card.style.opacity = opacity;
        card.style.transform = `translateX(${tx}px) translateY(${ty}px) rotate(${rot}deg) scale(${scale})`;
      });

      // Rotate Turntable Compass Dial
      if (turntableDisc) {
        const dialDeg = activeIdx * -72;
        turntableDisc.style.transform = `rotate(${dialDeg}deg)`;
      }

      // Update Index Counter
      if (counterEl) {
        counterEl.textContent = `0${activeIdx + 1} / 0${totalCards}`;
      }

      // Dim and disable Prev / Next buttons at boundaries
      if (prevBtn) {
        prevBtn.style.opacity = activeIdx === 0 ? '0.25' : '1.0';
        prevBtn.style.pointerEvents = activeIdx === 0 ? 'none' : 'auto';
      }
      if (nextBtn) {
        nextBtn.style.opacity = activeIdx === totalCards - 1 ? '0.25' : '1.0';
        nextBtn.style.pointerEvents = activeIdx === totalCards - 1 ? 'none' : 'auto';
      }

      // Update Spotlight Details Bar with active project info
      const data = projectData[activeIdx];
      if (data) {
        if (spotlightNum) spotlightNum.textContent = data.num;
        if (spotlightSub) spotlightSub.textContent = data.sub;
        if (spotlightTitle) spotlightTitle.textContent = data.title;
        if (spotlightDesc) spotlightDesc.textContent = data.desc;
        if (spotlightCta) {
          spotlightCta.href = data.url;
          spotlightCta.innerHTML = `<span>EXPLORE REPOSITORY</span><span class="btn-arrow">&nearr;</span>`;
        }
        if (spotlightTags) {
          spotlightTags.innerHTML = data.tags.map(t => `<span class="tag">${t}</span>`).join('');
        }
      }
    }

    function setActive(newIdx) {
      renderDeck(newIdx);
    }

    // HORIZONTAL WHEEL ONLY: Rotate like wheel on horizontal scroll (trackpad swipe or Shift + wheel)
    // Slower, smooth speed and stuck at 1st and end boundaries
    let horizontalAccumulator = 0;
    let horizontalCooldown = false;

    if (stageContainer) {
      stageContainer.addEventListener('wheel', (e) => {
        const isHorizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey;
        if (!isHorizontal) {
          // Normal vertical scroll -> let browser scroll down unobstructed
          return;
        }

        // Horizontal scroll -> wheel rotate through cards
        e.preventDefault();
        const delta = e.shiftKey ? (e.deltaY !== 0 ? e.deltaY : e.deltaX) : e.deltaX;
        horizontalAccumulator += delta;

        if (!horizontalCooldown) {
          // Slower scroll speed: higher threshold (55px) and calm cooldown (260ms)
          if (horizontalAccumulator > 55) {
            horizontalAccumulator = 0;
            if (activeIndex < totalCards - 1) {
              horizontalCooldown = true;
              setActive(activeIndex + 1);
              setTimeout(() => { horizontalCooldown = false; }, 260);
            }
          } else if (horizontalAccumulator < -55) {
            horizontalAccumulator = 0;
            if (activeIndex > 0) {
              horizontalCooldown = true;
              setActive(activeIndex - 1);
              setTimeout(() => { horizontalCooldown = false; }, 260);
            }
          }
        }
      }, { passive: false });
    }

    // Card click events
    cards.forEach((card, idx) => {
      card.addEventListener('click', () => {
        if (idx === activeIndex) {
          const targetUrl = card.getAttribute('data-url');
          if (targetUrl) {
            window.open(targetUrl, '_blank', 'noopener,noreferrer');
          }
        } else {
          setActive(idx);
        }
      });

      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (idx === activeIndex) {
            const targetUrl = card.getAttribute('data-url');
            if (targetUrl) window.open(targetUrl, '_blank', 'noopener,noreferrer');
          } else {
            setActive(idx);
          }
        }
      });
    });

    // Arrow button controls
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (activeIndex > 0) setActive(activeIndex - 1);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (activeIndex < totalCards - 1) setActive(activeIndex + 1);
      });
    }

    // Keyboard arrow navigation when projects section is in view
    window.addEventListener('keydown', (e) => {
      const section = document.getElementById('projects');
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const inView = rect.top < window.innerHeight && rect.bottom > 0;
      if (inView) {
        if (e.key === 'ArrowLeft' && activeIndex > 0) {
          setActive(activeIndex - 1);
        } else if (e.key === 'ArrowRight' && activeIndex < totalCards - 1) {
          setActive(activeIndex + 1);
        }
      }
    });

    // Touch & Swipe gesture support (horizontal only)
    let startX = 0;
    let startY = 0;
    arena.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });

    arena.addEventListener('touchend', (e) => {
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const diffX = endX - startX;
      const diffY = endY - startY;

      // Only respond if the swipe was predominantly horizontal
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 45) {
        if (diffX < 0 && activeIndex < totalCards - 1) {
          setActive(activeIndex + 1);
        } else if (diffX > 0 && activeIndex > 0) {
          setActive(activeIndex - 1);
        }
      }
    }, { passive: true });

    // Grid vs Deck Toggle
    if (toggleBtn && stageContainer && gridView) {
      toggleBtn.addEventListener('click', () => {
        const isDeckVisible = stageContainer.style.display !== 'none';
        if (isDeckVisible) {
          stageContainer.style.display = 'none';
          gridView.style.display = 'grid';
          toggleBtn.innerHTML = '<span class="mode-icon">🎴</span><span class="mode-text">3D DECK VIEW</span>';
        } else {
          stageContainer.style.display = 'block';
          gridView.style.display = 'none';
          toggleBtn.innerHTML = '<span class="mode-icon">⊞</span><span class="mode-text">GRID VIEW</span>';
          renderDeck(activeIndex);
        }
      });
    }

    window.addEventListener('resize', () => renderDeck(activeIndex), { passive: true });
    renderDeck(0);
  }

  // ==========================================================================
  // ==========================================================================
  // CONTINUOUS SMOOTH 3D HORIZONTAL CERTIFICATE CAROUSEL ENGINE
  // ==========================================================================
  function initCertificateShowcase() {
    const arena = document.getElementById('cert-deck-arena');
    if (!arena) return;

    const cards = Array.from(arena.querySelectorAll('.cert-card'));
    if (!cards.length) return;

    const mainCtaBtn = document.getElementById('cert-main-cta-btn');
    const prevBtn = document.getElementById('cert-prev-btn');
    const nextBtn = document.getElementById('cert-next-btn');
    const activeNumEl = document.getElementById('cert-active-num');
    const totalNumEl = document.querySelector('.cert-counter-total');

    // Modal elements
    const modal = document.getElementById('cert-modal');
    const modalBackdrop = document.getElementById('cert-modal-backdrop');
    const modalClose = document.getElementById('cert-modal-close');
    const modalImg = document.getElementById('cert-modal-img');
    const modalIssuerBadge = document.getElementById('cert-modal-issuer-badge');
    const modalTitle = document.getElementById('cert-modal-title');
    const modalSubtitle = document.getElementById('cert-modal-subtitle');
    const modalIssuer = document.getElementById('cert-modal-issuer');
    const modalDate = document.getElementById('cert-modal-date');
    const modalCode = document.getElementById('cert-modal-code');
    const modalCodeRow = document.getElementById('cert-modal-code-row');
    const modalCopyBtn = document.getElementById('cert-modal-copy-btn');
    const modalPdfLink = document.getElementById('cert-modal-pdf-link');
    const modalVerifyLink = document.getElementById('cert-modal-verify-link');

    const totalCards = cards.length;
    if (totalNumEl) {
      totalNumEl.textContent = String(totalCards).padStart(2, '0');
    }

    // Continuous float motion state
    let targetPos = 0;
    let currentPos = 0;
    let activeIndex = 0;
    let isHovered = false;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartPos = 0;
    let mouseTiltX = 0;
    let mouseTiltY = 0;

    // Calculate responsive X offsets
    function getResponsiveOffsets() {
      const w = window.innerWidth;
      if (w <= 600) {
        return { step1: 170, step2: 310 };
      } else if (w <= 900) {
        return { step1: 210, step2: 390 };
      } else {
        return { step1: 260, step2: 480 };
      }
    }

    // Continuous 60/120 FPS 3D Render Loop
    function renderCarouselLoop() {
      // Lerp current position smoothly towards target position
      const lerpSpeed = isDragging ? 0.25 : 0.08;
      currentPos += (targetPos - currentPos) * lerpSpeed;

      // Continuous gentle idle motion when not dragging or hovering
      if (!isHovered && !isDragging) {
        targetPos += 0.002;
      }

      const offsets = getResponsiveOffsets();
      const half = totalCards / 2;
      let minAbsDiff = Infinity;
      let frontIndex = 0;

      cards.forEach((card, index) => {
        // Compute continuous signed distance from current floating center
        let diff = index - currentPos;
        diff = ((diff % totalCards) + totalCards) % totalCards;
        if (diff > half) diff -= totalCards;

        const absDiff = Math.abs(diff);
        const sign = diff < 0 ? -1 : 1;

        if (absDiff < minAbsDiff) {
          minAbsDiff = absDiff;
          frontIndex = index;
        }

        // Interpolate 3D transform metrics continuously based on float diff
        let tx = 0;
        let tz = 0;
        let scale = 1;
        let opacity = 1;
        let rotY = 0;
        let rotZ = 0;
        let blur = 0;

        if (absDiff <= 1) {
          tx = diff * offsets.step1;
          tz = 140 - absDiff * 90;
          scale = 1.0 - absDiff * 0.12;
          opacity = 1.0 - absDiff * 0.35;
          rotY = -diff * 6;
          rotZ = diff * 4;
          blur = 0;
        } else if (absDiff <= 2) {
          tx = sign * (offsets.step1 + (absDiff - 1) * (offsets.step2 - offsets.step1));
          tz = 50 - (absDiff - 1) * 130;
          scale = 0.88 - (absDiff - 1) * 0.10;
          opacity = 0.65 - (absDiff - 1) * 0.30;
          rotY = -sign * (6 + (absDiff - 1) * 4);
          rotZ = sign * (4 + (absDiff - 1) * 2);
          blur = (absDiff - 1) * 3;
        } else {
          tx = sign * (offsets.step2 + (absDiff - 2) * 200);
          tz = -80 - (absDiff - 2) * 100;
          scale = Math.max(0.5, 0.78 - (absDiff - 2) * 0.18);
          opacity = Math.max(0, 0.35 - (absDiff - 2) * 0.75);
          rotY = -sign * (10 + (absDiff - 2) * 2);
          rotZ = sign * (6 + (absDiff - 2) * 2);
          blur = 3 + (absDiff - 2) * 3;
        }

        // Subtle mouse tilt on center active card
        let rotX = 0;
        if (index === frontIndex && isHovered) {
          rotX = mouseTiltX;
          rotY += mouseTiltY;
          scale *= 1.01;
        }

        // Strict Z-Index depth layering so center card is ALWAYS above side cards
        const zIndex = Math.round(100 - absDiff * 20);

        // Apply continuous GPU 3D transform
        card.style.transform = `translate3d(${tx.toFixed(2)}px, 0px, ${tz.toFixed(2)}px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) rotateZ(${rotZ.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
        card.style.opacity = opacity.toFixed(3);
        card.style.filter = blur > 0.1 ? `blur(${blur.toFixed(1)}px)` : 'none';
        card.style.zIndex = zIndex;
        card.style.pointerEvents = opacity > 0.1 ? 'auto' : 'none';
        card.style.visibility = opacity > 0.01 ? 'visible' : 'hidden';

        if (index === frontIndex) {
          card.classList.add('active');
        } else {
          card.classList.remove('active');
        }
      });

      // Update counter text when active front card changes
      if (frontIndex !== activeIndex) {
        activeIndex = frontIndex;
        if (activeNumEl) {
          activeNumEl.textContent = String(activeIndex + 1).padStart(2, '0');
        }
      }

      requestAnimationFrame(renderCarouselLoop);
    }

    // Horizontal Scroll (Trackpad & Mouse Wheel) - ONLY intercept horizontal scroll on cards
    arena.addEventListener('wheel', (e) => {
      const isHorizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey;
      
      if (isHorizontal && (Math.abs(e.deltaX) > 1 || e.shiftKey)) {
        e.preventDefault();
        const delta = e.shiftKey ? (e.deltaY || e.deltaX) : e.deltaX;
        targetPos += delta * 0.003;
      }
      // Vertical scrolling (e.deltaY) passes through unhindered to scroll the website page naturally!
    }, { passive: false });

    // Drag / Touch Swipe handling
    let touchStartY = 0;

    arena.addEventListener('mousedown', (e) => {
      isDragging = true;
      dragStartX = e.clientX;
      dragStartPos = targetPos;
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - dragStartX;
      targetPos = dragStartPos - (deltaX * 0.004);
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) isDragging = false;
    });

    arena.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        isDragging = true;
        dragStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        dragStartPos = targetPos;
      }
    }, { passive: true });

    arena.addEventListener('touchmove', (e) => {
      if (!isDragging || e.touches.length !== 1) return;
      const deltaX = e.touches[0].clientX - dragStartX;
      const deltaY = e.touches[0].clientY - touchStartY;
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        targetPos = dragStartPos - (deltaX * 0.005);
      }
    }, { passive: true });

    arena.addEventListener('touchend', () => {
      isDragging = false;
    }, { passive: true });

    // Next / Prev button controls
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        targetPos = Math.round(targetPos) + 1;
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        targetPos = Math.round(targetPos) - 1;
      });
    }

    // Card click events: Click active to open modal, click side to scroll to it
    cards.forEach((card, index) => {
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        if (index === activeIndex) {
          openModalForCard(card);
        } else {
          // Smoothly scroll target card to center
          let diff = index - (currentPos % totalCards);
          const half = totalCards / 2;
          diff = ((diff % totalCards) + totalCards) % totalCards;
          if (diff > half) diff -= totalCards;
          targetPos = currentPos + diff;
        }
      });
    });

    // Hover & Mouse subtle tilt
    arena.addEventListener('mouseenter', () => {
      isHovered = true;
    });

    arena.addEventListener('mouseleave', () => {
      isHovered = false;
      isDragging = false;
      mouseTiltX = 0;
      mouseTiltY = 0;
    });

    arena.addEventListener('mousemove', (e) => {
      if (!isHovered) return;
      const rect = arena.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const normX = (e.clientX - centerX) / (rect.width / 2);
      const normY = (e.clientY - centerY) / (rect.height / 2);

      mouseTiltX = Math.max(-1.5, Math.min(1.5, normY * -1.5));
      mouseTiltY = Math.max(-1.5, Math.min(1.5, normX * 1.5));
    });

    // Scroll Entrance Animation
    let hasEntered = false;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !hasEntered) {
          hasEntered = true;
          arena.style.opacity = '1';
          arena.style.transform = 'translateY(0) scale(1)';
          observer.unobserve(arena);
        }
      });
    }, { threshold: 0.15 });

    arena.style.opacity = '0';
    arena.style.transform = 'translateY(25px) scale(0.96)';
    arena.style.transition = 'opacity 0.9s cubic-bezier(0.22, 1, 0.36, 1), transform 0.9s cubic-bezier(0.22, 1, 0.36, 1)';
    observer.observe(arena);

    // Main Neon CTA button
    if (mainCtaBtn) {
      mainCtaBtn.addEventListener('click', () => {
        openModalForCard(cards[activeIndex]);
      });
    }

    // Start 60/120 FPS Continuous Render Loop
    requestAnimationFrame(renderCarouselLoop);

    // Modal Control Functions (Preserving existing modal logic)
    function openModalForCard(card) {
      if (!card || !modal) return;
      const title = card.getAttribute('data-title') || '';
      const subtitle = card.getAttribute('data-subtitle') || '';
      const issuer = card.getAttribute('data-issuer') || '';
      const date = card.getAttribute('data-date') || '';
      const code = card.getAttribute('data-code') || '';
      const pdf = card.getAttribute('data-pdf') || '';
      const img = card.getAttribute('data-img') || '';
      const verify = card.getAttribute('data-verify') || '';

      if (modalImg) modalImg.src = img;
      if (modalTitle) modalTitle.textContent = title;
      if (modalSubtitle) modalSubtitle.textContent = subtitle;
      if (modalIssuerBadge) modalIssuerBadge.textContent = issuer.toUpperCase();
      if (modalIssuer) modalIssuer.textContent = issuer;
      if (modalDate) modalDate.textContent = date;

      if (code) {
        if (modalCodeRow) modalCodeRow.style.display = 'flex';
        if (modalCode) modalCode.textContent = code;
      } else {
        if (modalCodeRow) modalCodeRow.style.display = 'none';
      }

      if (modalPdfLink) modalPdfLink.href = pdf;

      if (modalVerifyLink) {
        if (verify) {
          modalVerifyLink.href = verify;
          modalVerifyLink.style.display = 'inline-flex';
        } else {
          modalVerifyLink.style.display = 'none';
        }
      }

      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }

    function closeModal() {
      if (!modal) return;
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    if (modalClose) modalClose.addEventListener('click', closeModal);
    if (modalBackdrop) modalBackdrop.addEventListener('click', closeModal);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal && modal.classList.contains('open')) {
        closeModal();
      }
    });

    if (modalCopyBtn) {
      modalCopyBtn.addEventListener('click', () => {
        if (modalCode) {
          navigator.clipboard.writeText(modalCode.textContent.trim()).then(() => {
            const originalText = modalCopyBtn.textContent;
            modalCopyBtn.textContent = 'COPIED!';
            setTimeout(() => { modalCopyBtn.textContent = originalText; }, 2000);
          }).catch(() => {});
        }
      });
    }
  }

  /* ==========================================================================
     ULTRA-SMOOTH SVG LIQUID WAVE "PORTFOLIO" TEXT FILL & ZOOM VANISH ENGINE
     (Exact Match to Reference Images)
     ========================================================================== */
  let updateLiquidProgress = null; // Exposed callback for preloader

  function initOpeningAnimation() {
    const introOverlay = document.getElementById('intro-overlay');
    if (!introOverlay) return;

    const pageWrapper = document.getElementById('page-wrapper');
    const navbar = document.querySelector('.navbar');
    const skipBtn = document.getElementById('intro-skip-btn');
    const svgWrapper = document.getElementById('liquid-svg-wrapper');
    const waveFront = document.getElementById('wave-front');
    const waveBack = document.getElementById('wave-back');
    const percentText = document.getElementById('liquid-percent-text');

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      finishImmediately();
      return;
    }

    document.body.style.overflow = 'hidden';
    if (pageWrapper) pageWrapper.classList.add('intro-preparing');
    if (navbar) navbar.classList.add('intro-hidden-nav');

    let isCompleted = false;
    let animFrameId = null;
    let time = 0;
    let targetPercent = 0;
    let currentPercent = 0;
    let finishTriggered = false;

    // Exposed callback so initPreloader can push actual loading % (0 to 100)
    updateLiquidProgress = function(pct) {
      if (pct > targetPercent) {
        targetPercent = Math.min(100, pct);
      }
    };

    function finishImmediately() {
      if (isCompleted) return;
      isCompleted = true;

      if (animFrameId) cancelAnimationFrame(animFrameId);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';

      if (svgWrapper) svgWrapper.classList.add('liquid-zoom-vanish');

      setTimeout(() => {
        if (pageWrapper) {
          pageWrapper.classList.remove('intro-preparing');
          pageWrapper.classList.add('intro-revealed');
        }
        if (navbar) {
          navbar.classList.remove('intro-hidden-nav');
          navbar.classList.add('navbar-visible');
        }
      }, 150);

      setTimeout(() => {
        if (introOverlay) {
          introOverlay.classList.add('completed');
          introOverlay.style.display = 'none';
        }
      }, 850);
    }

    if (skipBtn) skipBtn.addEventListener('click', finishImmediately);

    function handleKeyDown(e) {
      if (e.key === 'Escape' || e.keyCode === 27) {
        finishImmediately();
      }
    }
    window.addEventListener('keydown', handleKeyDown);

    let minTimeElapsed = 0;

    function renderLiquidFrame() {
      if (isCompleted) return;

      time += 0.045;
      minTimeElapsed += 16;

      const syntheticProgress = Math.min(100, (minTimeElapsed / 1600) * 100);
      const effectiveTarget = Math.max(targetPercent, syntheticProgress);

      currentPercent += (effectiveTarget - currentPercent) * 0.085;

      if (Math.abs(effectiveTarget - currentPercent) < 0.1) {
        currentPercent = effectiveTarget;
      }

      const displayPct = Math.min(100, Math.floor(currentPercent));
      if (percentText) {
        percentText.textContent = `${displayPct} %`;
      }

      const waveY = 270 - (currentPercent / 100) * 220;

      let dFront = `M -20 ${waveY.toFixed(1)}`;
      for (let x = -20; x <= 1020; x += 25) {
        const y = waveY + Math.sin(x * 0.012 + time * 2.4) * 11;
        dFront += ` L ${x} ${y.toFixed(1)}`;
      }
      dFront += ` L 1020 320 L -20 320 Z`;
      if (waveFront) waveFront.setAttribute('d', dFront);

      let dBack = `M -20 ${waveY.toFixed(1)}`;
      for (let x = -20; x <= 1020; x += 25) {
        const y = waveY + Math.sin(x * 0.009 - time * 1.8 + 1.4) * 15;
        dBack += ` L ${x} ${y.toFixed(1)}`;
      }
      dBack += ` L 1020 320 L -20 320 Z`;
      if (waveBack) waveBack.setAttribute('d', dBack);

      if (currentPercent >= 99.8 && !finishTriggered) {
        finishTriggered = true;
        currentPercent = 100;
        if (percentText) percentText.textContent = '100 %';

        setTimeout(() => {
          finishImmediately();
        }, 250);
        return;
      }

      animFrameId = requestAnimationFrame(renderLiquidFrame);
    }

    animFrameId = requestAnimationFrame(renderLiquidFrame);
  }

  function initBentoScrollReveal() {
    const bentoCards = document.querySelectorAll('.bento-reveal');
    if (!bentoCards.length) return;

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const delay = parseInt(entry.target.getAttribute('data-delay') || '0', 10);
            setTimeout(() => {
              entry.target.classList.add('in-view');
            }, delay);
            observer.unobserve(entry.target);
          }
        });
      }, {
        threshold: 0.15,
        rootMargin: '0px 0px -40px 0px'
      });

      bentoCards.forEach(card => observer.observe(card));
    } else {
      bentoCards.forEach(card => card.classList.add('in-view'));
    }
  }

  // Initialize immediately
  resizeCanvas();
  updateTargetFromScroll();
  updateActiveNav();
  initOpeningAnimation();
  initPreloader();
  initRadialDeck();
  initCertificateShowcase();
  initBentoScrollReveal();
  initContactSection();
  requestAnimationFrame(animationLoop);

/* ==========================================================================
   CONTACT SECTION ANIMATIONS & TERMINAL TYPING INTERFACE
   ========================================================================== */
function initContactSection() {
  const contactSection = document.getElementById('contact');
  if (!contactSection) return;

  const terminalBody = contactSection.querySelector('.terminal-body');
  if (!terminalBody) return;

  const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let hasTyped = false;

  const startTerminalTyping = () => {
    if (hasTyped) return;
    hasTyped = true;

    if (isReducedMotion) {
      return;
    }

    // Prepare typing terminal interface
    terminalBody.innerHTML = '';

    const charDelayMin = 35;
    const charDelayMax = 50;

    const getRandomDelay = () => Math.floor(Math.random() * (charDelayMax - charDelayMin + 1)) + charDelayMin;
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const typeText = async (element, text) => {
      for (let i = 0; i < text.length; i++) {
        element.textContent += text[i];
        await sleep(getRandomDelay());
      }
    };

    (async () => {
      // Step 1: Command 1 ($ shivam --profile)
      const p1 = document.createElement('p');
      p1.className = 'term-line';
      p1.innerHTML = `<span class="term-prompt">$ </span><span class="term-cmd"></span><span class="term-cursor">_</span>`;
      terminalBody.appendChild(p1);

      const cmd1Span = p1.querySelector('.term-cmd');
      const cursor1 = p1.querySelector('.term-cursor');

      await sleep(200);
      await typeText(cmd1Span, 'shivam --profile');
      await sleep(300);
      if (cursor1) cursor1.remove();

      // Step 2: Line-by-line profile outputs
      const outputs = [
        '> Name: Shivam Gupta',
        '> Institution: RKGIT, Ghaziabad (B.Tech CSE)',
        '> Focus: Full-Stack (MERN) • Backend • Automation',
        '> Skills: Python, Java, C, DSA, React, Node, Express, MongoDB, Supabase',
        '> Hackathons: Paytm Hackathon (Top 5) • SIH 2026 Internal Shortlist (Team Hactivators)'
      ];

      for (const lineText of outputs) {
        const pOut = document.createElement('p');
        pOut.className = 'term-output';
        pOut.textContent = lineText;
        terminalBody.appendChild(pOut);
        await sleep(90);
      }

      await sleep(350);

      // Step 3: Command 2 ($ shivam --hire)
      const p2 = document.createElement('p');
      p2.className = 'term-line';
      p2.innerHTML = `<span class="term-prompt">$ </span><span class="term-cmd"></span><span class="term-cursor">_</span>`;
      terminalBody.appendChild(p2);

      const cmd2Span = p2.querySelector('.term-cmd');
      const cursor2 = p2.querySelector('.term-cursor');

      await sleep(200);
      await typeText(cmd2Span, 'shivam --hire');
      await sleep(300);
      if (cursor2) cursor2.remove();

      // Step 4: Status output
      const pSuccess = document.createElement('p');
      pSuccess.className = 'term-output term-success';
      pSuccess.textContent = '> Status: Open for Software Development & Full-Stack Internships!';
      terminalBody.appendChild(pSuccess);

      await sleep(250);

      // Step 5: Final blinking cursor line
      const pCursor = document.createElement('p');
      pCursor.className = 'term-line';
      pCursor.innerHTML = `<span class="term-prompt">$ </span><span class="term-cursor">_</span>`;
      terminalBody.appendChild(pCursor);
    })();
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          contactSection.classList.add('in-view');
          startTerminalTyping();
          observer.unobserve(contactSection);
        }
      });
    },
    { threshold: 0.15 }
  );

  observer.observe(contactSection);
}

  // Dynamic discovery if server supports /api/frames
  fetch('/api/frames')
    .then(res => res.json())
    .then(files => {
      if (Array.isArray(files) && files.length > 0) {
        const newFrameFiles = files.map(f => (f.startsWith('frames/') ? f : `frames/${f}`));

        // Only re-initialize if the frame count or files actually changed
        const isDifferent = newFrameFiles.length !== frameFiles.length ||
          newFrameFiles.some((f, idx) => f !== frameFiles[idx]);

        if (isDifferent) {
          frameFiles = newFrameFiles;
          TOTAL_FRAMES = frameFiles.length;
          images = new Array(TOTAL_FRAMES + 1);
          loadedFlags = new Uint8Array(TOTAL_FRAMES + 1);
          initPreloader();
        }
      }
    })
    .catch(() => {});
})();
