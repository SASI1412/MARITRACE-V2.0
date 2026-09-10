/**
 * Animation utility functions
 */

/** Promise-based delay */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Easing functions */
export const easing = {
  linear: t => t,
  easeOutCubic: t => 1 - Math.pow(1 - t, 3),
  easeOutQuart: t => 1 - Math.pow(1 - t, 4),
  easeInOutCubic: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  easeOutElastic: t => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1;
  },
};

/** Animate a numeric value from start to end */
export function animateValue(el, start, end, duration = 1500, easeFn = easing.easeOutCubic) {
  return new Promise(resolve => {
    const startTime = performance.now();
    function update(now) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const value = Math.round(start + (end - start) * easeFn(t));
      el.textContent = value;
      if (t < 1) {
        requestAnimationFrame(update);
      } else {
        resolve();
      }
    }
    requestAnimationFrame(update);
  });
}

/** Run steps sequentially with delays */
export async function runSequential(steps) {
  for (const step of steps) {
    await step();
  }
}

/** Animate a CSS property */
export function animateCSS(el, animation, duration = 500) {
  return new Promise(resolve => {
    el.style.animation = `${animation} ${duration}ms var(--ease-out) both`;
    const handleEnd = () => {
      el.removeEventListener('animationend', handleEnd);
      resolve();
    };
    el.addEventListener('animationend', handleEnd);
  });
}

/** Stagger animate children */
export async function staggerIn(parent, delayMs = 60) {
  const children = parent.children;
  for (let i = 0; i < children.length; i++) {
    children[i].style.opacity = '0';
  }
  for (let i = 0; i < children.length; i++) {
    children[i].style.animation = `fadeInUp var(--duration-normal) var(--ease-out) both`;
    children[i].style.animationDelay = `${i * delayMs}ms`;
  }
}

/** Create SVG circle progress (score ring) */
export function createScoreRing(score, size = 64, strokeWidth = 5, color = null) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  if (!color) {
    if (score >= 70) color = '#00e676';
    else if (score >= 40) color = '#ffab00';
    else color = '#78909c';
  }

  const fontSize = size < 50 ? 12 : size < 80 ? 16 : 22;

  return `
    <div class="score-ring" style="width:${size}px;height:${size}px;">
      <svg width="${size}" height="${size}">
        <circle class="score-ring-bg" cx="${size/2}" cy="${size/2}" r="${radius}" stroke-width="${strokeWidth}"/>
        <circle class="score-ring-fill" cx="${size/2}" cy="${size/2}" r="${radius}" stroke-width="${strokeWidth}"
          stroke="${color}"
          stroke-dasharray="${circumference}"
          stroke-dashoffset="${circumference}"
          data-target-offset="${offset}"/>
      </svg>
      <span class="score-ring-value" style="font-size:${fontSize}px;" data-target="${score}">0</span>
    </div>
  `;
}

/** Animate all score rings within a container */
export function animateScoreRings(container) {
  const rings = container.querySelectorAll('.score-ring-fill');
  rings.forEach(ring => {
    const target = ring.getAttribute('data-target-offset');
    // Start with full offset (empty), animate to target
    setTimeout(() => {
      ring.style.strokeDashoffset = target;
    }, 100);
  });

  const values = container.querySelectorAll('.score-ring-value');
  values.forEach(val => {
    const target = parseInt(val.getAttribute('data-target'));
    animateValue(val, 0, target, 1500);
  });
}
