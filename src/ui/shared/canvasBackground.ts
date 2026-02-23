/**
 * Launches an animated city-at-dusk canvas background inside `container`.
 * The container must have a <canvas class="menu-canvas"> child stored as `__canvas`.
 * Returns a stop() function that cancels the animation and cleans up listeners.
 */
export function launchCanvasBg(container: HTMLElement): () => void {
    const canvas = (container as any).__canvas as HTMLCanvasElement | undefined;
    if (!canvas) return () => {};

    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    const onResize = () => {
        canvas.width  = window.innerWidth;
        canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    const ctx = canvas.getContext('2d')!;

    type Ember = {
        x: number; y: number; vx: number; vy: number;
        r: number; a: number; life: number; maxLife: number; hue: number;
    };
    const embers: Ember[] = [];

    const spawnEmber = (W: number, H: number) => {
        const life = 100 + Math.random() * 160;
        embers.push({
            x: Math.random() * W,
            y: H * 0.6 + Math.random() * H * 0.4,
            vx: (Math.random() - 0.5) * 0.6,
            vy: -(0.4 + Math.random() * 1.4),
            r: 0.8 + Math.random() * 2.4,
            a: 0.5 + Math.random() * 0.5,
            life, maxLife: life,
            hue: 12 + Math.random() * 28,
        });
    };

    type Building = { x: number; w: number; h: number };
    let buildings: Building[] = [];

    const buildSilhouette = (W: number, H: number) => {
        buildings = [];
        let cx = 0;
        while (cx < W) {
            const bw = 18 + Math.random() * 55;
            const bh = 25 + Math.random() * 90;
            buildings.push({ x: cx, w: bw, h: bh });
            cx += bw + (Math.random() < 0.2 ? 2 : 0);
        }
    };
    buildSilhouette(canvas.width, canvas.height);

    let prevW       = canvas.width;
    let windowSeed  = Math.random();
    let frame       = 0;
    let animId      = 0;

    const tick = () => {
        animId = requestAnimationFrame(tick);
        frame++;

        const W = canvas.width;
        const H = canvas.height;

        if (prevW !== W) { buildSilhouette(W, H); prevW = W; }

        // Sky gradient
        const pulse = Math.sin(frame * 0.004) * 0.5 + 0.5;
        const sky = ctx.createLinearGradient(0, 0, 0, H);
        sky.addColorStop(0,    `hsl(228,45%,${4  + pulse * 3}%)`);
        sky.addColorStop(0.45, `hsl(18,65%,${7  + pulse * 8}%)`);
        sky.addColorStop(0.72, `hsl(14,70%,${11 + pulse * 9}%)`);
        sky.addColorStop(1,    `hsl(10,45%,4%)`);
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, H);

        // Horizon glow
        const hy = H * 0.58;
        const hg = ctx.createRadialGradient(W * 0.5, hy, 0, W * 0.5, hy, W * 0.5);
        hg.addColorStop(0,   `rgba(255,85,15,${0.13 + pulse * 0.07})`);
        hg.addColorStop(0.5, `rgba(200,35,5,${0.06  + pulse * 0.03})`);
        hg.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.fillStyle = hg;
        ctx.fillRect(0, 0, W, H);

        // City silhouette
        const baseY = H * 0.62;
        ctx.fillStyle = 'rgba(0,0,0,0.92)';
        ctx.beginPath();
        ctx.moveTo(0, H);
        ctx.lineTo(0, baseY - (buildings[0]?.h ?? 0));
        for (const b of buildings) {
            ctx.lineTo(b.x,       baseY - b.h);
            ctx.lineTo(b.x + b.w, baseY - b.h);
        }
        ctx.lineTo(W, baseY);
        ctx.lineTo(W, H);
        ctx.closePath();
        ctx.fill();

        // Building windows
        if (frame % 90 === 0) { windowSeed = Math.random(); }
        ctx.fillStyle = `rgba(255,200,80,0.45)`;
        for (let bi = 0; bi < buildings.length; bi++) {
            const b = buildings[bi];
            if (b.w < 20) continue;
            const rows = Math.floor(b.h / 14);
            const cols = Math.floor(b.w / 12);
            for (let r = 1; r <= rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const on = ((bi * 13 + r * 7 + c * 5 + Math.floor(windowSeed * 10)) % 3) !== 0;
                    if (!on) continue;
                    ctx.fillRect(b.x + 4 + c * 12, baseY - b.h + r * 13, 6, 5);
                }
            }
        }

        // Embers
        if (frame % 2 === 0 && embers.length < 130) spawnEmber(W, H);
        for (let i = embers.length - 1; i >= 0; i--) {
            const e = embers[i];
            e.x += e.vx + Math.sin(frame * 0.04 + i * 0.5) * 0.25;
            e.y += e.vy;
            e.life--;
            if (e.life <= 0 || e.y < -10) { embers.splice(i, 1); continue; }
            const lr = e.life / e.maxLife;
            ctx.save();
            ctx.globalAlpha  = lr * e.a;
            ctx.shadowColor  = `hsl(${e.hue},100%,65%)`;
            ctx.shadowBlur   = 8;
            ctx.fillStyle    = `hsl(${e.hue},100%,75%)`;
            ctx.beginPath();
            ctx.arc(e.x, e.y, e.r * Math.max(0.3, lr), 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Vignette
        const vig = ctx.createRadialGradient(W * 0.5, H * 0.45, H * 0.15, W * 0.5, H * 0.45, H * 0.9);
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, 'rgba(0,0,0,0.72)');
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, W, H);
    };
    tick();

    return () => {
        cancelAnimationFrame(animId);
        window.removeEventListener('resize', onResize);
    };
}
