/* ============================================================
   neonxsl.dev :: the southern sky + page interactions
   ============================================================ */
(function () {
    'use strict';

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var root = document.documentElement;
    root.classList.add('js');

    if (window.lucide) {
        window.lucide.createIcons();
    }

    var yearEl = document.getElementById('year');
    if (yearEl) {
        yearEl.textContent = new Date().getFullYear();
    }

    /* --------------------------------------------------------
       sydney time in the chart legend
       -------------------------------------------------------- */
    var timeEl = document.getElementById('syd-time');

    function tickTime() {
        if (!timeEl) { return; }
        try {
            var parts = new Intl.DateTimeFormat('en-AU', {
                timeZone: 'Australia/Sydney',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
                timeZoneName: 'short'
            }).formatToParts(new Date());
            var get = function (type) {
                var p = parts.find(function (x) { return x.type === type; });
                return p ? p.value : '';
            };
            timeEl.textContent = get('hour') + ':' + get('minute') + ' ' + get('timeZoneName').toLowerCase();
        } catch (e) {
            timeEl.textContent = '';
        }
    }

    tickTime();
    setInterval(tickTime, 20000);

    /* ========================================================
       the moon: a real nasa photo with tonight's phase shadow
       drawn over it, oriented the way it looks from sydney
       ======================================================== */
    (function moon() {
        var host = document.querySelector('.moon');
        var label = document.getElementById('moon-phase');
        if (!host) { return; }

        var cv = document.createElement('canvas');
        host.appendChild(cv);
        var g = cv.getContext('2d', { willReadFrequently: true });
        if (!g) { return; }

        var SYNODIC = 29.530588853;
        var NEW_MOON = Date.UTC(2000, 0, 6, 18, 14); /* a known new moon */

        /* ?moon=<age in days> previews any phase */
        var forced = parseFloat(new URLSearchParams(location.search).get('moon'));

        function state(date) {
            var age = isNaN(forced)
                ? (((date - NEW_MOON) / 86400000) % SYNODIC + SYNODIC) % SYNODIC
                : forced % SYNODIC;
            var theta = (age / SYNODIC) * Math.PI * 2;
            return { age: age, theta: theta, lit: (1 - Math.cos(theta)) / 2 };
        }

        function phaseName(age) {
            if (age < 1.0 || age > 28.5) { return 'new moon'; }
            if (age < 6.4) { return 'waxing crescent'; }
            if (age < 8.4) { return 'first quarter'; }
            if (age < 13.8) { return 'waxing gibbous'; }
            if (age < 15.8) { return 'full moon'; }
            if (age < 21.1) { return 'waning gibbous'; }
            if (age < 23.1) { return 'last quarter'; }
            return 'waning crescent';
        }

        var photo = new Image();
        photo.decoding = 'async';
        photo.src = './assets/moon.webp';

        function paint() {
            if (!photo.complete || !photo.naturalWidth) { return; }
            var st = state(new Date());
            var css = host.getBoundingClientRect().width || 112;
            var S = Math.max(64, Math.round(css * Math.min(window.devicePixelRatio || 1, 2)));
            var F = Math.round(S * 3.6); /* room around the disc for the moonlight */
            cv.style.width = cv.style.height = (css * 3.6) + 'px';
            cv.style.left = cv.style.top = (-css * 1.3) + 'px';
            cv.width = cv.height = F;
            var off = (F - S) / 2;
            var work = document.createElement('canvas');
            work.width = work.height = S;
            var wg = work.getContext('2d', { willReadFrequently: true });
            var halo = document.createElement('canvas');
            halo.width = halo.height = S;
            var hg = halo.getContext('2d');
            var hImg = hg.createImageData(S, S);
            var hp = hImg.data;

            /* from the southern hemisphere the moon is upside down compared to the usual photo */
            wg.save();
            wg.translate(S / 2, S / 2);
            wg.rotate(Math.PI);
            var R = 1.012; /* the photo has a thin black margin around the disc */
            wg.drawImage(photo, -S / 2 * R, -S / 2 * R, S * R, S * R);
            wg.restore();

            var img = wg.getImageData(0, 0, S, S);
            var px = img.data;
            /* sun direction, after the flip: waxing lights the left limb, waning the right */
            var lx = -Math.sin(st.theta), lz = -Math.cos(st.theta);

            for (var y = 0; y < S; y++) {
                for (var x = 0; x < S; x++) {
                    var o = (y * S + x) * 4;
                    var nx = ((x + 0.5) / S) * 2 - 1;
                    var ny = ((y + 0.5) / S) * 2 - 1;
                    var d2 = nx * nx + ny * ny;
                    if (d2 >= 1) { px[o + 3] = 0; continue; }
                    var nz = Math.sqrt(1 - d2);

                    var mu0 = nx * lx + nz * lz;
                    var lit = Math.max(0, Math.min(1, (mu0 + 0.015) / 0.07));
                    lit = lit * lit * (3 - 2 * lit);
                    /* lunar dust scatters light, so the lit side stays bright almost to the terminator */
                    var ls = mu0 > 0 ? Math.min(1.2, (2 * mu0) / (mu0 + nz + 0.001)) : 0;
                    var shade = (0.35 + 0.75 * ls) * lit;

                    var v = Math.pow(px[o] / 255, 0.62) * 1.75; /* lift the mosaic to real moonlight */
                    var day = v * shade;
                    var earthshine = v * 0.05 * (1 - lit);

                    px[o] = Math.min(255, (day * 246 + earthshine * 150));
                    px[o + 1] = Math.min(255, (day * 243 + earthshine * 165));
                    px[o + 2] = Math.min(255, (day * 238 + earthshine * 210));

                    var edge = Math.max(0, Math.min(1, (1 - Math.sqrt(d2)) * S * 0.5 + 0.5));
                    px[o + 3] = Math.round(255 * edge);

                    /* only the sunlit part feeds the glow */
                    hp[o] = 240; hp[o + 1] = 238; hp[o + 2] = 255;
                    hp[o + 3] = Math.round(255 * edge * lit * Math.min(1, shade));
                }
            }
            wg.putImageData(img, 0, 0);
            hg.putImageData(hImg, 0, 0);

            g.clearRect(0, 0, F, F);
            var strength = 0.3 + 0.7 * st.lit;
            var cx = F / 2;

            if ('filter' in g) {
                /* every glow comes from the sunlit part only */
                var gc = document.createElement('canvas');
                gc.width = gc.height = F;
                var gg = gc.getContext('2d');
                gg.globalCompositeOperation = 'lighter';
                [[0.6, 0.5], [0.24, 0.8], [0.07, 0.85]].forEach(function (layer) {
                    gg.filter = 'blur(' + Math.round(S * layer[0]) + 'px)';
                    gg.globalAlpha = layer[1] * strength;
                    gg.drawImage(halo, off, off);
                });
                gg.filter = 'none';
                gg.globalAlpha = 1;

                /* fade the glow out before it wraps round to the shadowed limb */
                var side = Math.abs(lx) > 0.12 ? (lx > 0 ? 1 : -1) : 0;
                if (side) {
                    var fadeTo = cx - side * S * 0.6;
                    var fadeFrom = cx - side * S * 0.05;
                    var mask = gg.createLinearGradient(fadeTo, 0, fadeFrom, 0);
                    mask.addColorStop(0, 'rgba(0,0,0,0)');
                    mask.addColorStop(1, 'rgba(0,0,0,1)');
                    gg.globalCompositeOperation = 'destination-in';
                    gg.fillStyle = mask;
                    gg.fillRect(0, 0, F, F);
                }
                g.drawImage(gc, 0, 0);
            }
            g.drawImage(work, off, off);

            if (label) {
                label.textContent = 'moon: ' + phaseName(st.age) + ', ' + Math.round(st.lit * 100) + '% lit';
            }
        }

        if (photo.complete) { paint(); } else { photo.addEventListener('load', paint); }
        setInterval(paint, 30 * 60 * 1000);

        var mt;
        window.addEventListener('resize', function () {
            clearTimeout(mt);
            mt = setTimeout(paint, 250);
        });
    })();

    /* ========================================================
       the sky
       ======================================================== */
    var canvas = document.getElementById('sky');
    var ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;

    if (ctx) {
        sky(canvas, ctx);
    }

    function sky(canvas, ctx) {
        var DEG = Math.PI / 180;
        var RA0 = 13.2; /* hour angle the chart is centred on */

        /* real stars around crux and centaurus: ra (hours), dec (deg), magnitude, colour index-ish (-1 blue .. 1 red) */
        var NAMED = {
            acrux:   [12.443, -63.10, 0.77, -0.6],
            mimosa:  [12.795, -59.69, 1.25, -0.7],
            gacrux:  [12.519, -57.11, 1.59, 1.0],
            deltaCru:[12.252, -58.75, 2.79, -0.5],
            epsCru:  [12.356, -60.40, 3.59, 0.7],
            alphaCen:[14.660, -60.83, -0.27, 0.25],
            betaCen: [14.064, -60.37, 0.61, -0.6],
            gammaCen:[12.692, -48.96, 2.17, -0.1],
            epsCen:  [13.665, -53.47, 2.30, -0.6],
            deltaCen:[12.139, -50.72, 2.60, -0.5],
            zetaCen: [13.926, -47.29, 2.55, -0.5],
            etaCen:  [14.592, -42.16, 2.31, -0.5],
            alphaMus:[12.620, -69.14, 2.69, -0.6],
            betaMus: [12.771, -68.11, 3.05, -0.5],
            gammaMus:[12.541, -72.13, 3.87, -0.4],
            deltaMus:[13.038, -71.55, 3.62, 0.8],
            lambdaCen:[11.596, -63.02, 3.13, -0.2],
            thetaCar:[10.716, -64.39, 2.76, -0.6],
            alphaCir:[14.708, -64.98, 3.19, 0.1],
            betaCir: [15.292, -58.80, 4.07, 0.0],
            alphaTrA:[16.811, -69.03, 1.91, 0.9],
            betaTrA: [15.919, -63.43, 2.85, 0.1],
            gammaTrA:[15.315, -68.68, 2.89, -0.2],
            iotaCar: [9.285, -59.28, 2.21, 0.1],
            epsCar:  [8.375, -59.51, 1.86, 0.9],
            upsCar:  [9.785, -65.07, 2.97, 0.0],
            pCar:    [10.533, -61.69, 3.30, -0.6],
            omegaCar:[10.229, -70.04, 3.29, -0.5]
        };

        var LINES = [
            ['gacrux', 'acrux'],
            ['deltaCru', 'mimosa'],
            ['alphaCen', 'betaCen'],
            ['epsCen', 'zetaCen'],
            ['zetaCen', 'etaCen'],
            ['epsCen', 'betaCen'],
            ['gammaCen', 'epsCen'],
            ['deltaCen', 'gammaCen']
        ];

        /* points along the galactic plane through this part of the sky */
        var PLANE = [
            [8.0, -36], [8.6, -44], [9.0, -48], [9.8, -55.5], [10.6, -59.2],
            [11.1, -60.6], [11.8, -61.9], [12.5, -62.6], [13.2, -62.6],
            [13.8, -62.2], [14.5, -61.0], [15.1, -58.3], [15.7, -55.2],
            [16.1, -52.0], [16.8, -45.0], [17.4, -37]
        ];

        var COALSACK = [12.85, -62.6];
        var ETACAR = [10.75, -59.68];

        var w = 0, h = 0, dpr = 1, k = 40;
        var pole = { x: 0, y: 0 };
        var rot = 0;
        var nebula = null, nebulaPad = 0;
        var bright = [];
        var named = {};
        var labels = [];
        var lines = [];
        var shooters = [];
        var nextShooter = 6000;
        var start = performance.now();
        var prev = start;
        var running = false;
        var visible = true;
        var mouse = { x: 0, y: 0, tx: 0, ty: 0 };

        /* ---------- projection: south polar, azimuthal equidistant ---------- */
        function proj(ra, dec) {
            var r = (90 + dec) * k;
            var t = (ra - RA0) * 15 * DEG;
            var x = -r * Math.sin(t);
            var y = -r * Math.cos(t);
            var c = Math.cos(rot), s = Math.sin(rot);
            return { x: pole.x + x * c - y * s, y: pole.y + x * s + y * c };
        }

        function layout() {
            var portrait = h > w * 1.1;
            var focus;

            if (portrait) {
                k = Math.min(w / 12.5, h / 22);
                focus = { x: w * 0.56, y: h * 0.34 };
                rot = 8 * DEG;
            } else {
                k = Math.max(26, Math.min(h / 21, w / 34));
                focus = { x: w * 0.66, y: h * 0.42 };
                rot = 22 * DEG;
            }

            /* place the pole so crux lands on the focus point */
            pole.x = 0; pole.y = 0;
            var c = proj(12.45, -60.1);
            pole.x = focus.x - c.x;
            pole.y = focus.y - c.y;
        }

        /* ---------- noise ---------- */
        function hash(x, y) {
            var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
            return n - Math.floor(n);
        }

        function vnoise(x, y) {
            var ix = Math.floor(x), iy = Math.floor(y);
            var fx = x - ix, fy = y - iy;
            var ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
            var a = hash(ix, iy), b = hash(ix + 1, iy);
            var c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
            return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
        }

        function fbm(x, y, oct) {
            var v = 0, amp = 0.5, f = 1;
            for (var i = 0; i < oct; i++) {
                v += amp * vnoise(x * f, y * f);
                f *= 2.03;
                amp *= 0.5;
            }
            return v;
        }

        function smooth(a, b, x) {
            var t = Math.max(0, Math.min(1, (x - a) / (b - a)));
            return t * t * (3 - 2 * t);
        }

        /* distance from a screen point to the projected galactic plane */
        function planeDist(px, py, pts) {
            var best = 1e9;
            for (var i = 0; i < pts.length - 1; i++) {
                var ax = pts[i].x, ay = pts[i].y, bx = pts[i + 1].x, by = pts[i + 1].y;
                var dx = bx - ax, dy = by - ay;
                var t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
                t = Math.max(0, Math.min(1, t));
                var ex = ax + dx * t - px, ey = ay + dy * t - py;
                var d = ex * ex + ey * ey;
                if (d < best) { best = d; }
            }
            return Math.sqrt(best);
        }

        /* ---------- nebula: rendered once per size at low resolution ---------- */
        function buildNebula() {
            var scale = 4;
            nebulaPad = Math.round(Math.max(w, h) * 0.04);
            var nw = Math.ceil((w + nebulaPad * 2) / scale);
            var nh = Math.ceil((h + nebulaPad * 2) / scale);
            var off = document.createElement('canvas');
            off.width = nw;
            off.height = nh;
            var octx = off.getContext('2d');
            var img = octx.createImageData(nw, nh);
            var data = img.data;

            var pts = PLANE.map(function (p) { return proj(p[0], p[1]); });
            var cs = proj(COALSACK[0], COALSACK[1]);
            var eta = proj(ETACAR[0], ETACAR[1]);
            var band = k * 6.2;
            var f = 1 / (k * 3.2); /* noise frequency tied to degrees, so it scales with the chart */

            /* keep the title block clear */
            var tx = w * 0.18, ty = h * 0.86;
            var tr = Math.max(w * 0.42, 380);

            var c = Math.cos(-rot), s = Math.sin(-rot);

            for (var j = 0; j < nh; j++) {
                for (var i = 0; i < nw; i++) {
                    var px = i * scale - nebulaPad;
                    var py = j * scale - nebulaPad;

                    /* sample noise in sky-aligned space so structure runs along the band */
                    var sx = (px * c - py * s) * f;
                    var sy = (px * s + py * c) * f;

                    var d = planeDist(px, py, pts) / band;
                    var core = Math.exp(-d * d * 1.5);
                    var halo = Math.exp(-d * d * 0.28);

                    var qx = fbm(sx + 1.7, sy + 9.2, 3);
                    var qy = fbm(sx + 8.3, sy + 2.8, 3);
                    var n = fbm(sx * 1.4 + qx * 2.2, sy * 1.4 + qy * 2.2, 5);
                    var fine = fbm(sx * 4.1 + 40, sy * 4.1 + 13, 3);

                    /* dark dust lanes threading the brightest part */
                    var lanes = smooth(0.5, 0.74, fbm(sx * 2.3 + qx * 1.6 + 70, sy * 2.3 + 5, 4));
                    var dust = 1 - lanes * 0.82 * core;

                    var dcx = (px - cs.x) / (k * 3.4), dcy = (py - cs.y) / (k * 2.6);
                    var coal = Math.exp(-(dcx * dcx + dcy * dcy) * 1.6);
                    dust *= 1 - coal * 0.92;

                    var de = Math.hypot(px - eta.x, py - eta.y) / (k * 1.9);
                    var etaGlow = Math.exp(-de * de) * (0.55 + 0.6 * n);

                    var glow = core * (0.2 + 0.9 * n * n) + halo * 0.14 * n;
                    var milk = Math.pow(core, 2.4) * smooth(0.35, 0.8, n) * (0.6 + 0.4 * fine);

                    var n2 = n * n;
                    var r = 30 * glow + 128 * glow * n2 + 214 * milk + 220 * etaGlow * 0.75;
                    var g = 24 * glow + 96 * glow * n2 + 204 * milk + 108 * etaGlow * 0.75;
                    var b = 78 * glow + 228 * glow * n2 + 240 * milk + 176 * etaGlow * 0.75;
                    var grain = (hash(i * 0.37, j * 0.91) - 0.5) * 6;

                    /* faint violet haze everywhere so the empty sky is not flat black */
                    var haze = smooth(0.42, 0.9, fbm(sx * 0.6 + 21, sy * 0.6 + 4, 3)) * 0.11;
                    r += 60 * haze; g += 44 * haze; b += 130 * haze;

                    var dt = Math.hypot(px - tx, py - ty) / tr;
                    var keep = 1 - 0.72 * Math.exp(-dt * dt * 1.4);
                    var vig = 1 - 0.45 * smooth(0.55, 1.15, Math.hypot(px / w - 0.6, py / h - 0.45));

                    var m = dust * keep * vig * 0.58;
                    var o = (j * nw + i) * 4;
                    data[o] = Math.max(0, Math.min(255, r * m + grain));
                    data[o + 1] = Math.max(0, Math.min(255, g * m + grain));
                    data[o + 2] = Math.max(0, Math.min(255, b * m + grain));
                    data[o + 3] = 255;
                }
            }

            octx.putImageData(img, 0, 0);
            nebula = off;

            /* hand back the band so star density can follow it */
            return { pts: pts, band: band, cs: cs };
        }

        /* ---------- stars ---------- */
        function tint(ci) {
            /* ci -1 hot blue .. 1 cool red */
            if (ci < 0) {
                var t = -ci;
                return [Math.round(235 - 45 * t), Math.round(240 - 25 * t), 255];
            }
            return [255, Math.round(244 - 60 * ci), Math.round(236 - 120 * ci)];
        }

        function rgba(c, a) {
            return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a.toFixed(3) + ')';
        }

        function magRadius(mag) {
            var s = Math.max(0.75, Math.min(1.25, k / 40));
            return Math.max(0.45, (2.7 - 0.5 * mag)) * s;
        }

        /* ---------- stars: most are baked into the static layer, a few twinkle live ---------- */
        function placeStars(geo, sctx) {
            var area = w * h;
            var count = Math.round(Math.min(5200, Math.max(1300, area / 250)));
            var liveMax = Math.round(Math.min(110, Math.max(50, area / 12000)));
            bright = [];

            var made = 0, guard = 0;
            while (made < count && guard < count * 8) {
                guard++;
                var x = Math.random() * (w + PAD * 2) - PAD;
                var y = Math.random() * (h + PAD * 2) - PAD;
                var d = geo ? planeDist(x, y, geo.pts) / geo.band : 2;
                var dens = 0.14 + 1.8 * Math.exp(-d * d * 1.25);
                if (geo) {
                    var dc = Math.hypot(x - geo.cs.x, y - geo.cs.y) / (k * 3);
                    dens *= 1 - 0.7 * Math.exp(-dc * dc * 1.6);
                }
                if (Math.random() * 1.8 > dens) { continue; }
                made++;

                var mag = 7.2 - 4.8 * Math.pow(Math.random(), 7);
                var ci = Math.random() < 0.7 ? (Math.random() - 0.5) * 0.5 : (Math.random() * 2 - 1);
                var col = tint(ci);
                var r = Math.max(0.3, magRadius(mag) * 0.55);
                var a = Math.min(0.95, 0.1 + (7.2 - mag) * 0.17);

                if (mag < 4.2 && bright.length < liveMax) {
                    bright.push({ x: x, y: y, r: r * 1.2, a: a, c: col, tw: 0.6 + Math.random() * 1.8, ph: Math.random() * 6.28 });
                    continue;
                }

                sctx.fillStyle = rgba(col, a);
                sctx.beginPath();
                sctx.arc(x, y, r, 0, Math.PI * 2);
                sctx.fill();
            }
        }

        function placeNamed() {
            named = {};
            Object.keys(NAMED).forEach(function (key) {
                var s = NAMED[key];
                var p = proj(s[0], s[1]);
                named[key] = {
                    x: p.x, y: p.y,
                    r: magRadius(s[2]),
                    mag: s[2],
                    c: tint(s[3]),
                    tw: 0.4 + Math.random() * 0.8,
                    ph: Math.random() * 6.28
                };
            });

            lines = LINES.map(function (pair, i) {
                return { a: named[pair[0]], b: named[pair[1]], delay: i < 2 ? i * 0.35 : 0.9 + i * 0.12 };
            });

            var cs = proj(COALSACK[0], COALSACK[1] - 0.6);
            var eta = proj(ETACAR[0], ETACAR[1] + 1.6);
            var off2 = k * 0.6;

            labels = [
                { t: 'crux', x: named.gacrux.x + off2 * 1.1, y: named.gacrux.y - off2 * 0.2, align: 'left', main: true },
                { t: 'α cen', x: named.alphaCen.x, y: named.alphaCen.y + off2 * 1.4, align: 'center' },
                { t: 'β cen', x: named.betaCen.x, y: named.betaCen.y + off2 * 1.4, align: 'center' },
                { t: 'coalsack', x: cs.x, y: cs.y + k * 1.7, align: 'center' },
                { t: 'η carinae', x: eta.x, y: eta.y, align: 'center' }
            ];
        }

        /* ---------- atlas grid: ra lines fan from the pole, dec circles around it ---------- */
        function drawGrid(g) {
            g.save();
            g.strokeStyle = 'rgba(167,139,250,0.11)';
            g.lineWidth = 1;
            g.font = '500 11px "Space Grotesk", sans-serif';
            g.fillStyle = 'rgba(167,139,250,0.5)';
            g.textBaseline = 'middle';

            var dec, ra, p, i;

            for (dec = -85; dec <= -25; dec += 5) {
                g.beginPath();
                for (i = 0; i <= 160; i++) {
                    ra = RA0 - 6 + (12 * i) / 160;
                    p = proj(ra, dec);
                    if (i === 0) { g.moveTo(p.x, p.y); } else { g.lineTo(p.x, p.y); }
                }
                g.stroke();

                if (dec % 10 === 0) {
                    for (i = 0; i <= 480; i++) {
                        ra = RA0 - 6 + (12 * i) / 480;
                        p = proj(ra, dec);
                        if (p.y > 80 && p.y < h - 140 && Math.abs(p.x - (w - 18)) < 6) {
                            g.textAlign = 'right';
                            g.fillText('−' + Math.abs(dec) + '°', w - 22, p.y - 9);
                            break;
                        }
                    }
                }
            }

            for (ra = 6; ra <= 20; ra += 1) {
                var a = proj(ra, -90);
                var b = proj(ra, -20);
                g.beginPath();
                g.moveTo(a.x, a.y);
                g.lineTo(b.x, b.y);
                g.stroke();

                for (i = 0; i <= 200; i++) {
                    p = proj(ra, -20 - (70 * i) / 200);
                    if (p.y > 88 && p.x > 30 && p.x < w - 60) {
                        if (p.y < 130) {
                            g.textAlign = 'center';
                            g.fillText(ra + 'h', p.x + 12, p.y);
                        }
                        break;
                    }
                }
            }
            g.restore();
        }

        /* ---------- glow sprites, made once per colour instead of a gradient per star per frame ---------- */
        var sprites = {};

        function sprite(c) {
            var key = c.join(',');
            if (sprites[key]) { return sprites[key]; }
            /* a real star image: a moffat point-spread function, white-hot core
               fading into wings that carry the star's colour. no spikes. */
            var S = 96;
            var sc = document.createElement('canvas');
            sc.width = sc.height = S;
            var g = sc.getContext('2d');
            var img = g.createImageData(S, S);
            var d = img.data;
            var alpha = 0.055, beta = 2.4;
            var floor = Math.pow(1 + 1 / (alpha * alpha), -beta);
            for (var y = 0; y < S; y++) {
                for (var x = 0; x < S; x++) {
                    var dx = (x + 0.5) / (S / 2) - 1, dy = (y + 0.5) / (S / 2) - 1;
                    var rr = Math.sqrt(dx * dx + dy * dy);
                    if (rr >= 1) { continue; }
                    var I = (Math.pow(1 + (rr * rr) / (alpha * alpha), -beta) - floor) / (1 - floor);
                    /* a wide, very faint scatter halo under the core */
                    I += 0.035 * Math.pow(1 - rr, 3);
                    var white = Math.min(1, Math.pow(I, 0.45));
                    var o = (y * S + x) * 4;
                    d[o] = Math.round(c[0] + (255 - c[0]) * white);
                    d[o + 1] = Math.round(c[1] + (255 - c[1]) * white);
                    d[o + 2] = Math.round(c[2] + (255 - c[2]) * white);
                    d[o + 3] = Math.round(255 * Math.min(1, I));
                }
            }
            g.putImageData(img, 0, 0);
            sprites[key] = sc;
            return sc;
        }

        /* ---------- static layer: drawn once per size ---------- */
        function paintStatic(withNebula) {
            var sctx = ctx;
            sctx.setTransform(sdpr, 0, 0, sdpr, PAD * sdpr, PAD * sdpr);
            sctx.globalAlpha = 1;
            sctx.globalCompositeOperation = 'source-over';
            sctx.fillStyle = '#050507';
            sctx.fillRect(-PAD, -PAD, w + PAD * 2, h + PAD * 2);

            var geo = null;
            if (withNebula) {
                geo = buildNebula();
                sctx.imageSmoothingEnabled = true;
                sctx.imageSmoothingQuality = 'high';
                sctx.drawImage(nebula, -nebulaPad, -nebulaPad, w + nebulaPad * 2, h + nebulaPad * 2);
                nebula = null;
            }

            /* stars only get placed once the band is known, so they follow it */
            if (withNebula || !bright.length) {
                sctx.globalCompositeOperation = 'lighter';
                placeStars(geo, sctx);
                sctx.globalCompositeOperation = 'source-over';
            }
            drawGrid(sctx);
        }

        /* ---------- live layer ---------- */
        function drawNamed(s, t, alphaMul) {
            /* scintillation: brightness flickers a little, never in sync */
            var tw = 0.9 + 0.08 * Math.sin(t * s.tw * 2.3 + s.ph) + 0.05 * Math.sin(t * s.tw * 5.1 + s.ph * 1.7);
            var size = s.r * (s.mag < 0.5 ? 20 : s.mag < 1.5 ? 16 : s.mag < 2.5 ? 11 : 8);
            var spr = sprite(s.c);
            /* soft bloom underneath, so the bright ones read as the highlights of the sky */
            if (s.mag < 2) {
                lctx.globalAlpha = Math.min(1, 0.35 * tw * alphaMul);
                lctx.drawImage(spr, s.x - size * 2.4, s.y - size * 2.4, size * 4.8, size * 4.8);
            }
            lctx.globalAlpha = Math.min(1, tw * alphaMul);
            lctx.drawImage(spr, s.x - size, s.y - size, size * 2, size * 2);
            /* and a crisp hot core on top */
            lctx.globalAlpha = Math.min(1, alphaMul);
            lctx.fillStyle = '#ffffff';
            lctx.beginPath();
            lctx.arc(s.x, s.y, Math.max(0.9, s.r * (s.mag < 1.5 ? 0.85 : 0.6)), 0, Math.PI * 2);
            lctx.fill();
        }

        function ease(t) {
            return t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 4);
        }

        function spawnShooter() {
            var ang = (18 + Math.random() * 18) * DEG;
            var dir = Math.random() < 0.5 ? 1 : -1;
            shooters.push({
                x: dir > 0 ? Math.random() * w * 0.5 : w * 0.5 + Math.random() * w * 0.5,
                y: Math.random() * h * 0.38 + 60,
                dir: dir, ang: ang,
                v: 620 + Math.random() * 380,
                len: 80 + Math.random() * 120,
                life: 0, ttl: 0.9 + Math.random() * 0.5
            });
        }

        var lastFrame = 0;
        var moonCanvas = null;

        function render(now) {
            if (running) {
                requestAnimationFrame(render);
                /* the sky moves slowly, 30fps is plenty and halves the work */
                if (now - lastFrame < 32) { return; }
            }
            lastFrame = now;

            var t = (now - start) / 1000;
            var dt = Math.min(0.08, (now - prev) / 1000);
            prev = now;

            /* parallax is a gpu transform on each layer, never a redraw */
            mouse.x += (mouse.tx - mouse.x) * 0.08;
            mouse.y += (mouse.ty - mouse.y) * 0.08;
            if (Math.abs(mouse.tx - mouse.x) > 0.002 || Math.abs(mouse.ty - mouse.y) > 0.002) {
                canvas.style.transform = 'translate3d(' + (mouse.x * 6).toFixed(2) + 'px,' + (mouse.y * 6).toFixed(2) + 'px,0)';
                live.style.transform = 'translate3d(' + (mouse.x * 12).toFixed(2) + 'px,' + (mouse.y * 12).toFixed(2) + 'px,0)';
                /* the moon is the nearest thing up there, so it drifts the most */
                if (!moonCanvas) { moonCanvas = document.querySelector('.moon canvas'); }
                if (moonCanvas) {
                    moonCanvas.style.transform = 'translate3d(' + (mouse.x * 26).toFixed(2) + 'px,' + (mouse.y * 20).toFixed(2) + 'px,0)';
                }
            }

            lctx.setTransform(ldpr, 0, 0, ldpr, PAD * ldpr, PAD * ldpr);
            lctx.globalAlpha = 1;
            lctx.clearRect(-PAD, -PAD, w + PAD * 2, h + PAD * 2);

            var fadeIn = reduceMotion ? 1 : ease(t / 2);

            for (var i = 0; i < bright.length; i++) {
                var s = bright[i];
                lctx.globalAlpha = s.a * (0.68 + 0.32 * Math.sin(t * s.tw + s.ph)) * fadeIn;
                lctx.fillStyle = rgba(s.c, 1);
                lctx.fillRect(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
            }
            lctx.globalAlpha = 1;

            lctx.lineWidth = 1;
            for (var l = 0; l < lines.length; l++) {
                var ln = lines[l];
                var p = reduceMotion ? 1 : ease((t - 1.3 - ln.delay) / 1.4);
                if (p <= 0) { continue; }
                var dx = ln.b.x - ln.a.x, dy = ln.b.y - ln.a.y;
                var len = Math.hypot(dx, dy);
                var ux = dx / len, uy = dy / len;
                var gapA = ln.a.r * 3 + 6, gapB = ln.b.r * 3 + 6;
                var drawn = (len - gapA - gapB) * p;
                if (drawn <= 0) { continue; }
                lctx.strokeStyle = l < 3 ? 'rgba(167,139,250,0.62)' : 'rgba(167,139,250,0.3)';
                lctx.setLineDash(l === 2 ? [3, 5] : []);
                lctx.beginPath();
                lctx.moveTo(ln.a.x + ux * gapA, ln.a.y + uy * gapA);
                lctx.lineTo(ln.a.x + ux * (gapA + drawn), ln.a.y + uy * (gapA + drawn));
                lctx.stroke();
            }
            lctx.setLineDash([]);

            var keys = Object.keys(named);
            for (var n = 0; n < keys.length; n++) {
                var st = named[keys[n]];
                var sa = reduceMotion ? 1 : ease((t - (st.mag < 1.6 ? 0.2 : 0.6)) / 1.8);
                if (sa > 0) { drawNamed(st, t, sa); }
            }

            var labelIn = reduceMotion ? 1 : ease((t - 2.4) / 1.6);
            if (labelIn > 0) {
                lctx.textBaseline = 'middle';
                for (var q = 0; q < labels.length; q++) {
                    var lb = labels[q];
                    lctx.font = (lb.main ? '500 14px' : '400 12px') + ' "Space Grotesk", sans-serif';
                    if (lb.w === undefined) { lb.w = lctx.measureText(lb.t).width; }
                    var left = lb.align === 'right' ? lb.x - lb.w : lb.align === 'center' ? lb.x - lb.w / 2 : lb.x;
                    if (left < 16 || left + lb.w > w - 16 || lb.y < 90 || lb.y > h - 40) { continue; }
                    lctx.globalAlpha = labelIn;
                    lctx.textAlign = lb.align;
                    lctx.fillStyle = lb.main ? 'rgba(196,181,253,0.95)' : 'rgba(196,181,253,0.62)';
                    lctx.fillText(lb.t, lb.x, lb.y);
                }
                lctx.globalAlpha = 1;
            }

            if (!reduceMotion) {
                nextShooter -= dt * 1000;
                if (nextShooter <= 0) {
                    spawnShooter();
                    nextShooter = 7000 + Math.random() * 9000;
                }
                for (var m = shooters.length - 1; m >= 0; m--) {
                    var sh = shooters[m];
                    sh.life += dt;
                    if (sh.life > sh.ttl) { shooters.splice(m, 1); continue; }
                    sh.v *= 1 - dt * 0.4;
                    sh.x += Math.cos(sh.ang) * sh.v * dt * sh.dir;
                    sh.y += Math.sin(sh.ang) * sh.v * dt;
                    var pr = sh.life / sh.ttl;
                    var fade = pr < 0.15 ? pr / 0.15 : Math.pow(1 - (pr - 0.15) / 0.85, 1.6);
                    var tx = sh.x - Math.cos(sh.ang) * sh.len * sh.dir;
                    var ty = sh.y - Math.sin(sh.ang) * sh.len;
                    var tr = lctx.createLinearGradient(sh.x, sh.y, tx, ty);
                    tr.addColorStop(0, 'rgba(255,255,255,' + (0.8 * fade).toFixed(3) + ')');
                    tr.addColorStop(1, 'rgba(196,181,253,0)');
                    lctx.strokeStyle = tr;
                    lctx.lineWidth = 1.2;
                    lctx.lineCap = 'round';
                    lctx.beginPath();
                    lctx.moveTo(sh.x, sh.y);
                    lctx.lineTo(tx, ty);
                    lctx.stroke();
                }
            }
        }

        /* ---------- setup ---------- */
        var PAD = 16;
        var sdpr = 1, ldpr = 1;
        var live = document.createElement('canvas');
        live.className = 'sky-live';
        live.setAttribute('aria-hidden', 'true');
        canvas.parentNode.insertBefore(live, canvas.nextSibling);
        var lctx = live.getContext('2d');

        function size() {
            var host = canvas.parentNode.getBoundingClientRect();
            var raw = window.devicePixelRatio || 1;
            w = Math.max(1, host.width);
            h = Math.max(1, host.height);
            sdpr = Math.min(raw, 2);
            ldpr = Math.min(raw, 1.5);
            canvas.width = Math.round((w + PAD * 2) * sdpr);
            canvas.height = Math.round((h + PAD * 2) * sdpr);
            live.width = Math.round((w + PAD * 2) * ldpr);
            live.height = Math.round((h + PAD * 2) * ldpr);
            layout();
            placeNamed();
        }

        var nebulaJob = 0;

        function build() {
            size();
            bright = [];
            /* paint a starfield straight away, then the expensive nebula after first paint */
            paintStatic(false);
            canvas.classList.remove('ready');
            var job = ++nebulaJob;
            var idle = window.requestIdleCallback || function (fn) { return setTimeout(fn, 60); };
            idle(function () {
                if (job !== nebulaJob) { return; }
                bright = [];
                paintStatic(true);
                canvas.classList.add('ready');
            }, { timeout: 400 });
        }

        function play() {
            if (running || reduceMotion || !visible || document.hidden) { return; }
            running = true;
            prev = performance.now();
            requestAnimationFrame(render);
        }

        function pause() {
            running = false;
        }

        build();

        if (reduceMotion) {
            canvas.classList.add('ready');
            setTimeout(function () { render(performance.now()); }, 500);
        } else {
            play();
        }

        var lastW = w, lastH = h;
        var resizeTimer;
        window.addEventListener('resize', function () {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function () {
                var host = canvas.parentNode.getBoundingClientRect();
                /* ignore mobile url bar height jitter */
                if (Math.abs(host.width - lastW) < 2 && Math.abs(host.height - lastH) < 120) { return; }
                lastW = host.width;
                lastH = host.height;
                build();
                if (!running) { render(performance.now()); }
            }, 200);
        });

        window.addEventListener('pointermove', function (e) {
            if (e.pointerType !== 'mouse') { return; }
            mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
            mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
        }, { passive: true });

        if ('IntersectionObserver' in window) {
            new IntersectionObserver(function (entries) {
                visible = entries[0].isIntersecting;
                if (visible) { play(); } else { pause(); }
            }).observe(canvas.parentNode);
        }

        document.addEventListener('visibilitychange', function () {
            if (document.hidden) { pause(); } else { play(); }
        });

        /* the grid labels use the webfont; repaint once it has loaded */
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(function () {
                labels.forEach(function (lb) { lb.w = undefined; });
            });
        }
    }

    /* ========================================================
       about: big lines light up word by word as you scroll
       ======================================================== */
    (function litWords() {
        var blocks = Array.prototype.slice.call(document.querySelectorAll('.lit'));
        if (!blocks.length) { return; }
        var items = blocks.map(function (el) {
            /* wrap each word, keeping inline elements like <em> intact */
            var words = [];
            (function walk(node) {
                Array.prototype.slice.call(node.childNodes).forEach(function (child) {
                    if (child.nodeType === 3) {
                        var frag = document.createDocumentFragment();
                        child.textContent.split(/(\s+)/).forEach(function (part) {
                            if (!part) { return; }
                            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
                            var span = document.createElement('span');
                            span.className = 'lw';
                            span.textContent = part;
                            frag.appendChild(span);
                            words.push(span);
                        });
                        child.parentNode.replaceChild(frag, child);
                    } else if (child.nodeType === 1) {
                        walk(child);
                    }
                });
            })(el);
            return { el: el, words: words, lit: -1 };
        });

        if (reduceMotion) {
            items.forEach(function (it) { it.words.forEach(function (w) { w.classList.add('on'); }); });
            return;
        }

        var ticking = false;
        function update() {
            ticking = false;
            var vh = window.innerHeight;
            items.forEach(function (it) {
                var r = it.el.getBoundingClientRect();
                if (r.bottom < -100 || r.top > vh + 100) { return; }
                var p = (vh * 0.82 - r.top) / (r.height + vh * 0.35);
                var n = Math.round(Math.max(0, Math.min(1, p)) * it.words.length);
                if (n === it.lit) { return; }
                it.lit = n;
                for (var i = 0; i < it.words.length; i++) {
                    it.words[i].classList.toggle('on', i < n);
                }
            });
        }
        window.addEventListener('scroll', function () {
            if (!ticking) { ticking = true; requestAnimationFrame(update); }
        }, { passive: true });
        update();
    })();

    /* ========================================================
       the shared light for cards, facts, makes and tools
       ======================================================== */
    Array.prototype.forEach.call(document.querySelectorAll('.glow-group'), function (group) {
        if (group.id === 'track') { return; } /* the project row handles its own, it moves */
        var items = group.classList.contains('glow') ? [group] : Array.prototype.slice.call(group.querySelectorAll('.glow'));
        var raf = 0, px = 0, py = 0;
        function paint() {
            raf = 0;
            for (var i = 0; i < items.length; i++) {
                var r = items[i].getBoundingClientRect();
                items[i].style.setProperty('--mx', (px - r.left) + 'px');
                items[i].style.setProperty('--my', (py - r.top) + 'px');
            }
        }
        group.addEventListener('pointermove', function (e) {
            if (e.pointerType !== 'mouse') { return; }
            px = e.clientX; py = e.clientY;
            if (!raf) { raf = requestAnimationFrame(paint); }
        }, { passive: true });
        group.addEventListener('pointerenter', function (e) {
            if (e.pointerType === 'mouse') { group.style.setProperty('--on', '1'); }
        });
        group.addEventListener('pointerleave', function () { group.style.setProperty('--on', '0'); });
    });

    /* ========================================================
       star trails around the south celestial pole, behind contact
       ======================================================== */
    (function trails() {
        var cv = document.getElementById('trails');
        if (!cv) { return; }
        var g = cv.getContext('2d');
        if (!g) { return; }
        var host = cv.parentNode;
        var W = 0, H = 0, dpr = 1, pole = { x: 0, y: 0 }, stars = [];
        var angle = 0;
        var ARC = 38 * Math.PI / 180; /* a few hours of exposure */

        function build() {
            var r = host.getBoundingClientRect();
            W = r.width; H = r.height;
            dpr = Math.min(window.devicePixelRatio || 1, 1.5);
            cv.width = Math.round(W * dpr);
            cv.height = Math.round(H * dpr);
            /* the pole sits low on the right, the way it does looking south from sydney */
            pole = { x: W * 0.84, y: H * 0.98 };
            var far = Math.hypot(pole.x, pole.y) + 40;
            var n = Math.round(Math.min(520, Math.max(220, (W * H) / 2600)));
            stars = [];
            for (var i = 0; i < n; i++) {
                var rad = 14 + Math.pow(Math.random(), 0.8) * far;
                var mag = Math.pow(Math.random(), 3);
                var warm = Math.random();
                stars.push({
                    r: rad,
                    a0: Math.random() * Math.PI * 2,
                    w: 0.45 + mag * 1.3,
                    alpha: 0.07 + mag * 0.42,
                    c: warm < 0.12 ? '255,214,186' : warm < 0.4 ? '196,186,255' : '226,230,255'
                });
            }
            draw();
        }

        function draw() {
            g.setTransform(dpr, 0, 0, dpr, 0, 0);
            g.clearRect(0, 0, W, H);
            g.lineCap = 'round';
            for (var i = 0; i < stars.length; i++) {
                var s = stars[i];
                var a = s.a0 + angle;
                /* each trail fades in along its length, brightest where the star is now */
                for (var k = 0; k < 5; k++) {
                    g.strokeStyle = 'rgba(' + s.c + ',' + (s.alpha * (k + 1) / 5).toFixed(3) + ')';
                    g.lineWidth = s.w;
                    g.beginPath();
                    g.arc(pole.x, pole.y, s.r, a - ARC + (ARC * k) / 5, a - ARC + (ARC * (k + 1)) / 5);
                    g.stroke();
                }
            }
            var fade = g.createLinearGradient(0, 0, 0, H);
            fade.addColorStop(0, 'rgba(0,0,0,0)');
            fade.addColorStop(0.28, 'rgba(0,0,0,1)');
            fade.addColorStop(0.88, 'rgba(0,0,0,1)');
            fade.addColorStop(1, 'rgba(0,0,0,0)');
            g.globalCompositeOperation = 'destination-in';
            g.fillStyle = fade;
            g.fillRect(0, 0, W, H);
            g.globalCompositeOperation = 'source-over';
        }

        build();
        var rt, lastW = W;
        window.addEventListener('resize', function () {
            clearTimeout(rt);
            rt = setTimeout(function () {
                if (Math.abs(host.getBoundingClientRect().width - lastW) > 2) { lastW = host.getBoundingClientRect().width; build(); }
            }, 250);
        });
    })();

    /* ========================================================
       nav state
       ======================================================== */
    var nav = document.getElementById('nav');
    var ticking = false;

    function onScroll() {
        if (nav) {
            nav.classList.toggle('scrolled', (window.scrollY || 0) > 40);
        }
        ticking = false;
    }

    window.addEventListener('scroll', function () {
        if (!ticking) {
            ticking = true;
            requestAnimationFrame(onScroll);
        }
    }, { passive: true });

    onScroll();

    var links = Array.prototype.slice.call(document.querySelectorAll('nav ul a'));

    if (links.length && 'IntersectionObserver' in window) {
        var navObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) { return; }
                links.forEach(function (link) {
                    link.classList.toggle('active', link.getAttribute('href') === '#' + entry.target.id);
                });
            });
        }, { rootMargin: '-45% 0px -50% 0px' });

        links.forEach(function (link) {
            var target = document.querySelector(link.getAttribute('href'));
            if (target) { navObserver.observe(target); }
        });
    }

    /* ========================================================
       reveals: section heads and the constellation only
       ======================================================== */
    var reveal = document.querySelectorAll('.section-head, .stagger');
    Array.prototype.forEach.call(document.querySelectorAll('.stagger'), function (group) {
        Array.prototype.forEach.call(group.children, function (child, i) {
            child.style.setProperty('--i', Math.min(i, 8));
        });
    });

    if (!reduceMotion && 'IntersectionObserver' in window) {
        reveal.forEach(function (el) { if (!el.classList.contains('stagger')) { el.classList.add('rv'); } });

        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in');
                    io.unobserve(entry.target);
                }
            });
        }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });

        reveal.forEach(function (el) { io.observe(el); });
    }

    /* ========================================================
       projects: pinned horizontal scroll on desktop,
       a plain swipeable row on phones and with reduced motion
       ======================================================== */
    (function hscroll() {
        var outer = document.getElementById('hscroll');
        var pin = outer && outer.querySelector('.hscroll-pin');
        var wrap = document.getElementById('track-wrap');
        var track = document.getElementById('track');
        var bar = document.getElementById('hs-bar');
        if (!outer || !pin || !track || !wrap) { return; }

        var cards = Array.prototype.slice.call(track.querySelectorAll('.card'));
        var wide = window.matchMedia('(min-width: 900px) and (min-height: 600px)');
        var pinned = false, shift = 0, runway = 0, E = 0, R = 0, slide = 0;
        var pos = 0, target = 0, looping = false;
        var pointer = null;

        /*
          the hand-off, in scroll distance:
            1. the section glides up and decelerates to a stop (length E)
            2. the cards accelerate sideways, cruise, then decelerate (length slide)
            3. the section accelerates back into normal scrolling (length E)
          sticky does the pinning; a small translateY smooths both ends.
        */
        function measure() {
            pinned = wide.matches && !reduceMotion;
            outer.classList.toggle('is-pinned', pinned);
            track.style.transform = '';
            pin.style.transform = '';
            if (pinned) {
                var vh = window.innerHeight;
                shift = Math.max(0, track.scrollWidth - window.innerWidth);
                E = vh * 0.14;
                R = vh * 0.08;               /* how long the sideways speed ramps up and down */
                slide = shift * 0.9 + R;     /* scroll spent moving sideways */
                runway = slide + 2 * E;
                outer.style.height = (vh + runway) + 'px';
            } else {
                shift = runway = E = R = slide = 0;
                outer.style.height = '';
            }
            readTarget();
            pos = target;
            apply();
        }

        /* eased vertical position of the pinned block, given the section's top edge y */
        function settle(y) {
            /* arriving: from y = E down to y = -E it decelerates to rest at 0 */
            var arrive = y >= E ? y : y <= -E ? 0 : (y + E) * (y + E) / (4 * E);
            /* leaving: z = 0 is where sticky lets go */
            var z = y + runway;
            var leave = z >= E ? 0 : z <= -E ? z : -((z - E) * (z - E)) / (4 * E);
            return y > -runway / 2 ? arrive : leave;
        }

        /* sideways distance for u scroll pixels into the slide: ramp up, cruise, ramp down */
        function glide(u) {
            if (slide <= 0) { return 0; }
            u = Math.min(slide, Math.max(0, u));
            var cruise = slide - 2 * R;
            var vmax = shift / (cruise + R); /* area under the speed curve equals shift */
            if (u < R) { return vmax * u * u / (2 * R); }
            if (u < R + cruise) { return vmax * (R / 2 + (u - R)); }
            var d = slide - u;
            return shift - vmax * d * d / (2 * R);
        }

        var pinY = 0;

        function readTarget() {
            if (!pinned) { target = 0; pinY = 0; return; }
            var y = outer.getBoundingClientRect().top;
            /* sticky already holds the block at max(y, min(0, y + runway)); add the difference */
            var natural = y > 0 ? y : (y + runway < 0 ? y + runway : 0);
            pinY = settle(y) - natural;
            target = glide(-y - E);
        }

        function setProgress(p) {
            if (bar) { bar.style.transform = 'scaleX(' + p.toFixed(4) + ')'; }
            outer.classList.toggle('hs-done', p > 0.97);
        }

        function apply() {
            if (pinned) {
                pin.style.transform = Math.abs(pinY) > 0.05 ? 'translate3d(0,' + pinY.toFixed(2) + 'px,0)' : '';
                track.style.transform = 'translate3d(' + (-pos).toFixed(2) + 'px,0,0)';
                setProgress(shift > 0 ? pos / shift : 0);
            } else {
                var max = wrap.scrollWidth - wrap.clientWidth;
                setProgress(max > 0 ? wrap.scrollLeft / max : 0);
            }
            light();
        }

        /* a touch of inertia on the sideways move */
        function loop() {
            readTarget();
            pos += (target - pos) * 0.3;
            if (Math.abs(target - pos) < 0.2) { pos = target; }
            apply();
            if (pos !== target) {
                requestAnimationFrame(loop);
            } else {
                looping = false;
            }
        }

        function kick() {
            if (!looping) { looping = true; requestAnimationFrame(loop); }
        }

        /* the light: every card learns where the cursor is relative to itself */
        function light() {
            if (!pointer) { return; }
            for (var i = 0; i < cards.length; i++) {
                var r = cards[i].getBoundingClientRect();
                cards[i].style.setProperty('--mx', (pointer.x - r.left) + 'px');
                cards[i].style.setProperty('--my', (pointer.y - r.top) + 'px');
            }
        }

        wrap.addEventListener('pointermove', function (e) {
            if (e.pointerType !== 'mouse') { return; }
            pointer = { x: e.clientX, y: e.clientY };
            light();
        }, { passive: true });
        wrap.addEventListener('pointerenter', function (e) {
            if (e.pointerType !== 'mouse') { return; }
            track.style.setProperty('--on', '1');
        });
        wrap.addEventListener('pointerleave', function () {
            track.style.setProperty('--on', '0');
        });

        window.addEventListener('scroll', kick, { passive: true });
        wrap.addEventListener('scroll', function () { apply(); }, { passive: true });

        var rt;
        window.addEventListener('resize', function () {
            clearTimeout(rt);
            rt = setTimeout(measure, 150);
        });
        if (wide.addEventListener) { wide.addEventListener('change', measure); }
        if (document.fonts && document.fonts.ready) { document.fonts.ready.then(measure); }

        /* keyboard users tabbing through cards on desktop: scroll the page to that card */
        track.addEventListener('focusin', function (e) {
            if (!pinned || shift <= 0) { return; }
            var card = e.target.closest('.card');
            if (!card) { return; }
            var want = Math.min(shift, Math.max(0, card.offsetLeft - 80));
            var lo = 0, hi = slide;
            for (var k = 0; k < 24; k++) {
                var mid = (lo + hi) / 2;
                if (glide(mid) < want) { lo = mid; } else { hi = mid; }
            }
            var top = outer.getBoundingClientRect().top + window.scrollY;
            window.scrollTo({ top: top + E + lo, behavior: 'auto' });
        });

        measure();
    })();

})();
