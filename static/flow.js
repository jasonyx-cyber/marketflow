(function () {
  const canvas = document.getElementById('flow-canvas');
  const ctx = canvas.getContext('2d');

  // Color palette — vivid & bright
  const COLORS = [
    { r: 255, g: 200, b: 30 },   // bright gold
    { r: 0, g: 245, b: 255 },    // electric cyan
    { r: 180, g: 80, b: 255 },   // vivid purple
    { r: 0, g: 255, b: 160 },    // neon green
    { r: 255, g: 50, b: 100 },   // hot pink-red
    { r: 80, g: 180, b: 255 },   // sky blue
    { r: 255, g: 120, b: 30 },   // bright orange
  ];

  let W, H, lines;

  function rand(a, b) { return a + Math.random() * (b - a); }

  class FlowLine {
    constructor() { this.reset(true); }

    reset(initial) {
      this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
      this.width = rand(0.6, 2.2);
      this.speed = rand(0.18, 0.55);
      this.alpha = rand(0.35, 0.75);
      this.freq = rand(0.0008, 0.003);
      this.amp = rand(40, 160);
      this.phase = rand(0, Math.PI * 2);
      this.offset = rand(0, H);

      if (initial) {
        this.x = rand(0, W);
      } else {
        this.x = -20;
      }
    }

    draw() {
      const { r, g, b } = this.color;
      ctx.beginPath();
      ctx.lineWidth = this.width;

      // Draw a wavy horizontal path
      const steps = Math.ceil(W / 4);
      for (let i = 0; i <= steps; i++) {
        const px = (i / steps) * W;
        const py = this.offset
          + Math.sin(px * this.freq * 2 + this.phase + this.x * 0.001) * this.amp
          + Math.sin(px * this.freq * 0.7 + this.phase * 1.3) * (this.amp * 0.4);

        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }

      // Gradient along the line
      const grad = ctx.createLinearGradient(0, 0, W, 0);
      grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
      grad.addColorStop(0.3, `rgba(${r},${g},${b},${this.alpha})`);
      grad.addColorStop(0.7, `rgba(${r},${g},${b},${this.alpha})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);

      ctx.strokeStyle = grad;
      ctx.stroke();

      // Slowly drift the phase
      this.phase += this.speed * 0.012;
      this.x += this.speed;

      if (this.x > W + 20) this.reset(false);
    }
  }

  function init() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    const count = Math.floor(W / 80) + 8;
    lines = Array.from({ length: count }, () => new FlowLine());
  }

  function animate() {
    ctx.clearRect(0, 0, W, H);
    lines.forEach(l => l.draw());
    requestAnimationFrame(animate);
  }

  window.addEventListener('resize', init);
  init();
  animate();
})();