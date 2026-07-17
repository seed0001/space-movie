// CinemaUI — presentation layer for the cinematic system.
// Letterbox, subtitles (with typewriter), title cards, fades,
// lower-thirds, story objectives and end credits.

export class CinemaUI {
    constructor() {
        this.overlay = document.getElementById('cinema-overlay');
        this.fadeEl = document.getElementById('cinema-fade');
        this.subtitles = document.getElementById('cinema-subtitles');
        this.speakerEl = document.getElementById('subtitle-speaker');
        this.textEl = document.getElementById('subtitle-text');
        this.titlecard = document.getElementById('cinema-titlecard');
        this.titleSuper = document.getElementById('titlecard-super');
        this.titleMain = document.getElementById('titlecard-main');
        this.titleSub = document.getElementById('titlecard-sub');
        this.lowerthird = document.getElementById('cinema-lowerthird');
        this.lowerthirdTitle = document.getElementById('lowerthird-title');
        this.lowerthirdSub = document.getElementById('lowerthird-sub');
        this.objectiveEl = document.getElementById('story-objective');
        this.objectiveText = document.getElementById('objective-text');
        this.hintEl = document.getElementById('cinema-hint');
        this.vignette = document.getElementById('cinema-vignette');
        this.creditsEl = document.getElementById('cinema-credits');
        this.creditsScroll = document.getElementById('credits-scroll');

        this.typeTimer = null;
        this.lowerthirdTimer = null;
    }

    // ---------- Letterbox ----------
    letterbox(on) {
        this.overlay.classList.toggle('letterboxed', on);
    }

    vignetteOn(on) {
        this.vignette.classList.toggle('visible', on);
    }

    // ---------- Fade ----------
    // Returns a promise that resolves when the fade transition finishes.
    fade(toBlack, slow = false) {
        this.fadeEl.classList.toggle('slow', slow);
        this.fadeEl.classList.toggle('opaque', toBlack);
        return new Promise(res => setTimeout(res, slow ? 2600 : 1100));
    }

    setFadeInstant(toBlack) {
        const prev = this.fadeEl.style.transition;
        this.fadeEl.style.transition = 'none';
        this.fadeEl.classList.toggle('opaque', toBlack);
        // Force reflow so the transition removal applies
        void this.fadeEl.offsetHeight;
        this.fadeEl.style.transition = prev;
    }

    // ---------- Subtitles ----------
    // Shows a line with a typewriter effect. Returns a promise resolving
    // after the line has been displayed for a duration scaled to length.
    say(speakerName, text, color = '#7ab0ff', isNarrator = false, holdScale = 1.0) {
        this.clearTypewriter();

        this.speakerEl.textContent = isNarrator ? '' : speakerName;
        this.speakerEl.style.color = color;
        this.textEl.classList.toggle('narrator', isNarrator);
        this.textEl.textContent = '';
        this.subtitles.classList.add('visible');

        return new Promise(resolve => {
            let i = 0;
            const typeSpeed = 18; // ms per char
            this.typeTimer = setInterval(() => {
                i += 2; // two chars per tick keeps long lines snappy
                this.textEl.textContent = text.slice(0, i);
                if (i >= text.length) {
                    this.clearTypewriter();
                    // Hold: base + reading time
                    const hold = (900 + text.length * 34) * holdScale;
                    this.typeTimer = setTimeout(() => {
                        this.typeTimer = null;
                        resolve();
                    }, hold);
                }
            }, typeSpeed);
        });
    }

    clearTypewriter() {
        if (this.typeTimer) {
            clearInterval(this.typeTimer);
            clearTimeout(this.typeTimer);
            this.typeTimer = null;
        }
    }

    hideSubtitles() {
        this.clearTypewriter();
        this.subtitles.classList.remove('visible');
    }

    // ---------- Title cards ----------
    async titleCard(superText, mainText, subText, holdMs = 3200) {
        this.titleSuper.textContent = superText || '';
        this.titleMain.textContent = mainText || '';
        this.titleSub.textContent = subText || '';
        this.titlecard.classList.add('visible');
        await this.wait(holdMs);
        this.titlecard.classList.remove('visible');
        await this.wait(1400);
    }

    // ---------- Lower third ----------
    showLowerThird(title, sub, holdMs = 4500) {
        clearTimeout(this.lowerthirdTimer);
        this.lowerthirdTitle.textContent = title;
        this.lowerthirdSub.textContent = sub || '';
        this.lowerthird.classList.add('visible');
        this.lowerthirdTimer = setTimeout(() => {
            this.lowerthird.classList.remove('visible');
        }, holdMs);
    }

    // ---------- Story objectives ----------
    setObjective(text) {
        if (!text) {
            this.objectiveEl.classList.remove('visible');
            return;
        }
        this.objectiveText.textContent = text;
        this.objectiveEl.classList.add('visible');
    }

    // ---------- Hints ----------
    showHint(text) {
        this.hintEl.textContent = text;
        this.hintEl.classList.add('visible');
    }

    hideHint() {
        this.hintEl.classList.remove('visible');
    }

    // ---------- HUD visibility ----------
    hideGameHud(hidden) {
        document.body.classList.toggle('cinema-hide-hud', hidden);
    }

    cutawayMode(on) {
        document.body.classList.toggle('cinema-cutaway', on);
    }

    // ---------- Credits ----------
    rollCredits(lines) {
        this.creditsScroll.innerHTML = lines
            .map(l => l.startsWith('##')
                ? `<div style="font-size:26px;letter-spacing:8px;color:#fff;margin:30px 0;">${l.slice(2)}</div>`
                : `<div>${l}</div>`)
            .join('');
        this.creditsEl.classList.add('rolling');
    }

    stopCredits() {
        this.creditsEl.classList.remove('rolling');
        this.creditsScroll.innerHTML = '';
    }

    // ---------- Reset ----------
    reset() {
        this.clearTypewriter();
        this.hideSubtitles();
        this.letterbox(false);
        this.vignetteOn(false);
        this.setFadeInstant(false);
        this.titlecard.classList.remove('visible');
        this.lowerthird.classList.remove('visible');
        this.setObjective(null);
        this.hideHint();
        this.hideGameHud(false);
        this.cutawayMode(false);
        this.stopCredits();
    }

    wait(ms) {
        return new Promise(res => setTimeout(res, ms));
    }
}
