/**
 * Shared confetti animation script used across the application
 */

// Confetti animation script - pure CSS/JS, no dependencies
export const CONFETTI_SCRIPT = `
(() => {
  // Color palette for confetti
  const colors = ['#f44336','#e91e63','#9c27b0','#3f51b5','#2196f3','#00bcd4','#4caf50','#ffeb3b','#ff9800'];
  const confettiCount = 400;

  // Create container for all confetti
  const container = document.createElement('div');
  container.id = 'browseros-confetti-container';
  container.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:999999;overflow:hidden';

  // Create individual confetti pieces
  for(let i = 0; i < confettiCount; i++) {
    const confetto = document.createElement('div');
    const color = colors[Math.floor(Math.random() * colors.length)];
    const left = Math.random() * 100;
    const animationDelay = Math.random() * 2;
    const animationDuration = 3 + Math.random() * 2;
    const size = 10 + Math.random() * 40;

    confetto.style.cssText = \`
      position:absolute;
      width:\${size}px;
      height:\${size}px;
      background:\${color};
      left:\${left}%;
      top:-20px;
      opacity:1;
      transform:rotate(\${Math.random() * 360}deg);
      animation:confetti-fall \${animationDuration}s linear \${animationDelay}s forwards;
      border-radius:\${Math.random() > 0.5 ? '50%' : '0'};
    \`;
    container.appendChild(confetto);
  }

  // Add animation keyframes
  const style = document.createElement('style');
  style.id = 'browseros-confetti-styles';
  style.textContent = \`
    @keyframes confetti-fall {
      0% {
        transform: translateY(0) rotate(0deg) scale(1);
        opacity: 1;
      }
      100% {
        transform: translateY(calc(100vh + 20px)) rotate(720deg) scale(0);
        opacity: 0;
      }
    }
  \`;
  document.head.appendChild(style);
  document.body.appendChild(container);

  // Cleanup after animation completes
  setTimeout(() => {
    const containerEl = document.getElementById('browseros-confetti-container');
    const styleEl = document.getElementById('browseros-confetti-styles');
    if (containerEl) containerEl.remove();
    if (styleEl) styleEl.remove();
  }, 7000);

  // Return success
  return true;
})();
`;
