/* ============================================================
   neonxsl.dev :: night sky + page interactions
   ============================================================ */
(function () {
    'use strict';

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* --------------------------------------------------------
       icons + year
       -------------------------------------------------------- */
    if (window.lucide) {
        window.lucide.createIcons();
    }

    var yearEl = document.getElementById('year');
    if (yearEl) {
        yearEl.textContent = new Date().getFullYear();
    }

    /* --------------------------------------------------------
       starfield
       -------------------------------------------------------- */
    var canvas = document.getElementById('sky');
    var ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;

    if (ctx) {
        var w = 0;
        var h = 0;
        var lastW = -1;
        var stars = [];
        var shooters = [];
        var nextShooter = 2800;
        var start = performance.now();
        var prev = start;

        /* the headline sits in the middle of the hero, so keep the bright
           stars out of this box to avoid competing with the type */
        function inTextZone(x, y) {
            return x > w * 0.2 && x < w * 0.8 && y > h * 0.2 && y < h * 0.78;
        }

        function drift() {
            var angle = Math.random() * Math.PI * 2;
            var speed = 0.06 + Math.random() * 0.32;
            return { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };
        }

        function buildStars() {
            var target = Math.round((w * h) / 6800);
            var count = Math.max(90, Math.min(340, target));
            var i;
            stars = [];

            for (i = 0; i < count; i++) {
                var d = drift();

                stars.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    r: 0.35 + Math.random() * Math.random() * 1.5,
                    a: 0.18 + Math.random() * 0.62,
                    twinkle: 0.35 + Math.random() * 1.25,
                    phase: Math.random() * Math.PI * 2,
                    vx: d.vx,
                    vy: d.vy,
                    /* a small handful get drawn as four point sparkles */
                    sparkle: Math.random() < 0.03,
                    beacon: false
                });
            }

            /* a handful of bright ones that flare well past the rest */
            var beacons = Math.max(4, Math.min(8, Math.round(w / 260)));

            for (i = 0; i < beacons; i++) {
                var x = 0;
                var y = 0;
                var tries = 0;

                do {
                    x = Math.random() * w;
                    y = Math.random() * h;
                    tries++;
                } while (inTextZone(x, y) && tries < 40);

                if (inTextZone(x, y)) {
                    continue;
                }

                var bd = drift();

                stars.push({
                    x: x,
                    y: y,
                    r: 0.85 + Math.random() * 0.5,
                    a: 0.3 + Math.random() * 0.16,
                    twinkle: 0.5 + Math.random() * 0.7,
                    phase: Math.random() * Math.PI * 2,
                    vx: bd.vx * 0.5,
                    vy: bd.vy * 0.5,
                    sparkle: true,
                    beacon: true,
                    /* how long between flares, and where in that cycle it starts */
                    period: 7 + Math.random() * 8,
                    offset: Math.random() * 15
                });
            }
        }

        function resize() {
            var rect = canvas.getBoundingClientRect();
            var dpr = Math.min(window.devicePixelRatio || 1, 2);

            w = rect.width;
            h = rect.height;
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            /* avoid re-scattering the sky on mobile url bar height changes */
            if (Math.abs(w - lastW) > 2 || !stars.length) {
                lastW = w;
                buildStars();
            }
        }

        function spawnShooter() {
            var fromLeft = Math.random() < 0.5;
            var angle = (Math.random() * 13 + 17) * Math.PI / 180;

            shooters.push({
                x: fromLeft ? Math.random() * w * 0.45 : w - Math.random() * w * 0.45,
                y: Math.random() * h * 0.42,
                dir: fromLeft ? 1 : -1,
                angle: angle,
                speed: 560 + Math.random() * 420,
                len: 90 + Math.random() * 140,
                life: 0,
                ttl: 1 + Math.random() * 0.55
            });
        }

        /* smooth 0 to 1 to 0 pulse across the flare window */
        function flareAmount(s, t) {
            var span = 0.2;
            var cycle = ((t + s.offset) % s.period) / s.period;

            if (cycle > span) {
                return 0;
            }

            var p = cycle / span;
            return Math.pow(Math.sin(Math.PI * p), 2.2);
        }

        function drawStar(s, t) {
            /* two sine waves at different rates so the flicker never feels metronomic */
            var flicker = 0.58
                + 0.28 * Math.sin(t * s.twinkle + s.phase)
                + 0.14 * Math.sin(t * s.twinkle * 2.7 + s.phase * 1.7);
            var flare = s.beacon ? flareAmount(s, t) : 0;
            /* capped well under full white, a flare should read as a shimmer */
            var alpha = Math.max(0, Math.min(0.62, s.a * flicker + flare * 0.3));
            var radius = s.r * (1 + flare * 0.3);

            ctx.fillStyle = '#ffffff';

            /* a flat low alpha circle stands in for bloom, no gradient needed */
            if (flare > 0.05) {
                ctx.globalAlpha = alpha * flare * 0.09;
                ctx.beginPath();
                ctx.arc(s.x, s.y, radius * 3.2, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
            ctx.fill();

            if (s.sparkle) {
                var reach = s.r * 5.5 * flicker + flare * s.r * 11;

                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 0.6 + flare * 0.25;
                ctx.globalAlpha = Math.min(0.42, alpha * (0.4 + flare * 0.3));
                ctx.beginPath();
                ctx.moveTo(s.x - reach, s.y);
                ctx.lineTo(s.x + reach, s.y);
                ctx.moveTo(s.x, s.y - reach);
                ctx.lineTo(s.x, s.y + reach);
                ctx.stroke();

                /* a shorter diagonal cross only shows up at the peak of a flare */
                if (flare > 0.5) {
                    var diag = reach * 0.4;
                    ctx.globalAlpha = alpha * flare * 0.22;
                    ctx.lineWidth = 0.5;
                    ctx.beginPath();
                    ctx.moveTo(s.x - diag, s.y - diag);
                    ctx.lineTo(s.x + diag, s.y + diag);
                    ctx.moveTo(s.x + diag, s.y - diag);
                    ctx.lineTo(s.x - diag, s.y + diag);
                    ctx.stroke();
                }
            }
        }

        function moveStar(s, dt) {
            s.x += s.vx * dt;
            s.y += s.vy * dt;

            if (s.x < -4) { s.x = w + 4; }
            if (s.x > w + 4) { s.x = -4; }
            if (s.y < -4) { s.y = h + 4; }
            if (s.y > h + 4) { s.y = -4; }
        }

        function drawShooter(sh) {
            /* ease in fast, ease out slow, so the streak dissolves instead of blinking off */
            var p = sh.life / sh.ttl;
            var fade = p < 0.12
                ? p / 0.12
                : Math.pow(1 - (p - 0.12) / 0.88, 1.8);

            var tailX = sh.x - Math.cos(sh.angle) * sh.len * sh.dir;
            var tailY = sh.y - Math.sin(sh.angle) * sh.len;
            var trail = ctx.createLinearGradient(sh.x, sh.y, tailX, tailY);

            trail.addColorStop(0, 'rgba(255,255,255,' + (0.85 * fade).toFixed(3) + ')');
            trail.addColorStop(1, 'rgba(255,255,255,0)');

            ctx.globalAlpha = 1;
            ctx.strokeStyle = trail;
            ctx.lineWidth = 1.3;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(sh.x, sh.y);
            ctx.lineTo(tailX, tailY);
            ctx.stroke();

            ctx.globalAlpha = fade;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(sh.x, sh.y, 1.25, 0, Math.PI * 2);
            ctx.fill();
        }

        function frame(now) {
            var t = (now - start) / 1000;
            var dt = Math.min((now - prev) / 1000, 0.05);
            prev = now;

            ctx.clearRect(0, 0, w, h);

            for (var i = 0; i < stars.length; i++) {
                moveStar(stars[i], dt);
                drawStar(stars[i], t);
            }

            nextShooter -= dt * 1000;
            if (nextShooter <= 0) {
                spawnShooter();
                nextShooter = 3400 + Math.random() * 6500;
            }

            for (var j = shooters.length - 1; j >= 0; j--) {
                var sh = shooters[j];
                sh.life += dt;

                if (sh.life > sh.ttl) {
                    shooters.splice(j, 1);
                    continue;
                }

                /* slight deceleration gives the streak some weight */
                sh.speed *= (1 - dt * 0.35);
                sh.x += Math.cos(sh.angle) * sh.speed * dt * sh.dir;
                sh.y += Math.sin(sh.angle) * sh.speed * dt;
                drawShooter(sh);
            }

            ctx.globalAlpha = 1;
            requestAnimationFrame(frame);
        }

        function drawStatic() {
            ctx.clearRect(0, 0, w, h);
            for (var i = 0; i < stars.length; i++) {
                drawStar(stars[i], 0);
            }
            ctx.globalAlpha = 1;
        }

        resize();

        var resizeTimer;
        window.addEventListener('resize', function () {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function () {
                resize();
                if (reduceMotion) {
                    drawStatic();
                }
            }, 120);
        });

        if (reduceMotion) {
            drawStatic();
        } else {
            requestAnimationFrame(frame);
        }
    }

    /* --------------------------------------------------------
       nav state + progress bar
       -------------------------------------------------------- */
    var nav = document.getElementById('nav');
    var bar = document.getElementById('progress-bar');
    var hero = document.querySelector('.hero');
    var heroContent = document.querySelector('.hero-content');
    var ticking = false;

    function onScroll() {
        var y = window.scrollY || window.pageYOffset;

        if (nav) {
            nav.classList.toggle('scrolled', y > 40);
        }

        if (bar) {
            var max = document.documentElement.scrollHeight - window.innerHeight;
            bar.style.width = (max > 0 ? Math.min(1, y / max) * 100 : 0) + '%';
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

    /* --------------------------------------------------------
       hero parallax, interpolated on its own loop so it stays
       smooth no matter how the scroll events land
       -------------------------------------------------------- */
    if (!reduceMotion && hero && canvas) {
        var skyY = 0;
        var skyTarget = 0;
        var fade = 1;
        var fadeTarget = 1;

        (function parallax() {
            var y = window.scrollY || window.pageYOffset;
            var height = hero.offsetHeight || 1;
            var progress = Math.min(1, y / height);

            skyTarget = y * 0.16;
            fadeTarget = Math.max(0, 1 - progress * 1.45);

            /* lerp toward the target for a soft, weighted feel */
            skyY += (skyTarget - skyY) * 0.09;
            fade += (fadeTarget - fade) * 0.09;

            if (progress < 1.05) {
                canvas.style.transform = 'translate3d(0,' + skyY.toFixed(2) + 'px,0)';
                if (heroContent) {
                    heroContent.style.opacity = fade.toFixed(3);
                    heroContent.style.transform =
                        'translate3d(0,' + (skyY * 0.42).toFixed(2) + 'px,0)';
                }
            }

            requestAnimationFrame(parallax);
        })();
    }

    /* --------------------------------------------------------
       reveal on scroll, staggered per section
       -------------------------------------------------------- */
    var revealables = document.querySelectorAll('.reveal');

    if (!reduceMotion && 'IntersectionObserver' in window) {
        document.querySelectorAll('.section').forEach(function (section) {
            section.querySelectorAll('.reveal').forEach(function (el, i) {
                el.style.setProperty('--d', Math.min(i * 65, 390) + 'ms');
            });
        });

        var revealObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in');
                    revealObserver.unobserve(entry.target);
                }
            });
        }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

        revealables.forEach(function (el) {
            revealObserver.observe(el);
        });
    } else {
        revealables.forEach(function (el) {
            el.classList.add('in');
        });
    }

    /* --------------------------------------------------------
       active nav link
       -------------------------------------------------------- */
    var links = Array.prototype.slice.call(document.querySelectorAll('nav ul a'));

    if (links.length && 'IntersectionObserver' in window) {
        var sections = links
            .map(function (link) {
                return document.querySelector(link.getAttribute('href'));
            })
            .filter(Boolean);

        var navObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) {
                    return;
                }

                links.forEach(function (link) {
                    link.classList.toggle(
                        'active',
                        link.getAttribute('href') === '#' + entry.target.id
                    );
                });
            });
        }, { rootMargin: '-45% 0px -50% 0px' });

        sections.forEach(function (section) {
            navObserver.observe(section);
        });
    }

})();
