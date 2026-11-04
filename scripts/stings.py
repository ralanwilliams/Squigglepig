"""Make the themes' stings (src/theme/skins: a skin's `sounds`), the music
that plays as the light changes while a good-guy-by-day, bad-guy-by-night
theme shows.

Lukas (lukas.ts): his sheriff turns outlaw to a "dun, dun, dunnn"
(outlawTheme.mp3), and back to a hero's brass fanfare (heroTheme.mp3).
Chris (chris.ts): his superhero turns supervillain to a menace that creeps up
from the depths and lands on a stab (supervillainTheme.mp3), and back to a
soaring fanfare (superheroTheme.mp3).
Ash (ash.ts): his basketball player goes down hurt to an arena's
"ooooh!!!" (crowdOoh.mp3), and is back on his feet to its cheer
(crowdCheer.mp3).

All are synthesized here from scratch, sine and sawtooth tones and noise,
with no samples, recordings or loops from anywhere else, and the melodies are
our own; the crowds are made the same way, each voice a buzz shaped into a
vowel and each clap a burst of noise. So the sounds are wholly Squigglepig's (site/terms.html: the sounds
belong to me), with no licence to credit or keep to in the stores. Run from
the repo root after changing anything here:

    python scripts/stings.py

Writes them all to src/assets/sounds. Needs numpy and lameenc (pip install
numpy lameenc), the LAME MP3 encoder: only a tool to write the files, it
ships nothing in the app.
"""
from pathlib import Path

import lameenc
import numpy as np

OUT = Path(__file__).resolve().parent.parent / 'src' / 'assets' / 'sounds'
SR = 44100
KBPS = 80  # mono; a few seconds comes to about 30 kB
CROWD_KBPS = 128  # the crowds' many voices need more to stay clear
PEAK = 0.89  # -1 dBFS, the headroom the MP3 encoder needs
# The noise is the same every run, so a file only changes when its sting does.
# The stings draw on it in turn, so add new ones at the end of the list below;
# the crowds each start their own (with_noise).
RNG = np.random.default_rng(7)


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def times(dur):
    return np.arange(int(dur * SR)) / SR


def envelope(t, attack, release, dur, hold=1.0, decay=0.0):
    """Rise over `attack`, sink exponentially by `decay` per second towards
    `hold`, and fade out over the last `release` seconds of `dur`."""
    rise = np.clip(t / attack, 0, 1)
    body = hold + (1 - hold) * np.exp(-decay * t) if decay else np.ones_like(t)
    fall = np.clip((dur - t) / release, 0, 1)
    return rise * body * fall


def lowpass(x, cutoff, width=0.3):
    """A gentle low-pass done in the frequency domain: everything above
    `cutoff` rolls off over `width` octaves."""
    spec = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    octaves = np.log2(np.maximum(f, 1) / cutoff)
    spec *= np.clip(1 - octaves / width, 0, 1)
    return np.fft.irfft(spec, len(x))


def brass(midi, dur, vel=1.0, vibrato=0.0, bright=1.0):
    """A brassy tone: a sawtooth's harmonics, the upper ones blooming in just
    after the attack as a horn's do, with optional vibrato on long notes."""
    t = times(dur)
    f0 = hz(midi)
    wobble = 1 + vibrato * np.sin(2 * np.pi * 5.4 * t) * np.clip((t - 0.18) / 0.25, 0, 1)
    phase = 2 * np.pi * np.cumsum(f0 * wobble) / SR
    bloom = np.clip(t / 0.05, 0, 1) * (0.75 + 0.25 * np.exp(-6 * t)) * bright
    out = np.zeros_like(t)
    for k in range(1, 24):
        if k * f0 > SR / 2.2:
            break
        out += np.sin(k * phase) / k * bloom ** (0.35 * (k - 1))
    return vel * out * envelope(t, 0.025, 0.07, dur, hold=0.8, decay=4)


def strings(midi, dur, vel=1.0, tremolo=0.0):
    """A bowed section: a softer sawtooth, slightly detuned against itself,
    with an optional tremolo (the shiver under the last 'dunnn')."""
    t = times(dur)
    out = np.zeros_like(t)
    for cents in (-7, 0, 7):
        f0 = hz(midi) * 2 ** (cents / 1200)
        for k in range(1, 14):
            if k * f0 > SR / 2.2:
                break
            out += np.sin(2 * np.pi * k * f0 * t + k * cents) / k ** 1.3
    shiver = 1 - tremolo * (0.5 + 0.5 * np.sin(2 * np.pi * 11 * t))
    return vel * out / 3 * shiver * envelope(t, 0.04, 0.25, dur)


def timpani(midi, dur, vel=1.0):
    """A kettle drum: a few inharmonic partials that sag in pitch as they
    ring, over a short thump of filtered noise."""
    t = times(dur)
    f0 = hz(midi) * (1 + 0.04 * np.exp(-30 * t))
    out = np.zeros_like(t)
    for ratio, amp, decay in ((1.0, 1.0, 3.5), (1.5, 0.5, 5), (1.98, 0.3, 7), (2.44, 0.18, 9)):
        out += amp * np.sin(2 * np.pi * np.cumsum(f0 * ratio) / SR) * np.exp(-decay * t)
    thump = lowpass(RNG.standard_normal(len(t)), 600) * np.exp(-40 * t) * 0.6
    return vel * (out + thump) * envelope(t, 0.002, 0.05, dur)


def snare(dur, vel=1.0):
    """A snare hit: a crack of bright noise over a short drum tone."""
    t = times(dur)
    noise = RNG.standard_normal(len(t))
    crack = (noise - lowpass(noise, 1800)) * np.exp(-28 * t)
    body = np.sin(2 * np.pi * 190 * t) * np.exp(-35 * t) * 0.6
    return vel * (crack + body) * envelope(t, 0.001, 0.02, dur)


def cymbal(dur, vel=1.0):
    """A crash: bright noise with a long shimmer."""
    t = times(dur)
    noise = RNG.standard_normal(len(t))
    bright = noise - lowpass(noise, 3000)
    return vel * bright * np.exp(-2.6 * t) * envelope(t, 0.003, 0.2, dur)


def reverb(x, seconds=1.4, mix=0.22):
    """A small hall: the dry sound convolved with a decaying burst of noise."""
    t = times(seconds)
    ir = lowpass(RNG.standard_normal(len(t)), 5000) * np.exp(-4.5 * t)
    ir /= np.sqrt(np.sum(ir ** 2))
    n = len(x) + len(ir)
    wet = np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(ir, n), n)[: len(x)]
    return (1 - mix) * x + mix * wet * 0.6


def mix(length, parts):
    """Lay (start seconds, samples) parts into one track `length` seconds long."""
    out = np.zeros(int(length * SR))
    for start, sound in parts:
        i = int(start * SR)
        out[i : i + len(sound)] += sound[: len(out) - i]
    return out


def finish(x, fade=0.35):
    x = reverb(x)
    x[-int(fade * SR) :] *= np.linspace(1, 0, int(fade * SR)) ** 2
    return x / np.max(np.abs(x)) * PEAK


def hero():
    """Evil to good: a bright fanfare in C. A pickup of two quick Gs, up to C,
    a turn round E, and a held high G over a full C major chord, the drums
    rolling into it and a cymbal on the landing."""
    E = 0.14  # an eighth note
    lead = [(0, 67, 0.12), (E, 67, 0.12), (2 * E, 72, 0.26), (4 * E, 76, 0.16), (5.3 * E, 74, 0.12), (6.3 * E, 76, 0.12)]
    under = [(2 * E, 64, 0.26), (4 * E, 67, 0.16), (5.3 * E, 65, 0.12), (6.3 * E, 67, 0.12)]
    land = 7.3 * E
    parts = [(s, brass(m, d, 0.9)) for s, m, d in lead]
    parts += [(s, brass(m, d, 0.45, bright=0.8)) for s, m, d in under]
    parts += [(land, brass(79, 1.2, 1.0, vibrato=0.005))]
    parts += [(land, brass(m, 1.2, 0.4, bright=0.75)) for m in (60, 64, 67)]
    parts += [(2 * E, brass(48, 0.26, 0.55, bright=0.6)), (land, brass(48, 1.2, 0.6, bright=0.6))]
    parts += [(2 * E, timpani(48, 0.6, 0.8))]
    parts += [(land - 0.12 + i * 0.04, timpani(43, 0.3, 0.25 + 0.1 * i)) for i in range(3)]
    parts += [(land, timpani(48, 1.2, 1.0)), (land, cymbal(1.4, 0.18))]
    return finish(mix(land + 1.5, parts))


def outlaw():
    """Good to evil: dun, dun, dunnn. Two short low stabs on D minor, then a
    long one a half step down on a diminished chord, the strings shivering
    under it and a sour high rub on top, each stab landing on a drum."""
    stab = (38, 45, 50, 53)  # D minor, low
    sink = (37, 43, 49, 52)  # C# diminished, the half step down
    parts = []
    for start in (0.0, 0.46):
        parts += [(start, brass(m, 0.34, 0.8, bright=0.85)) for m in stab]
        parts += [(start, strings(m, 0.34, 0.5)) for m in stab]
        parts += [(start, timpani(38, 0.7, 1.0))]
    last = 0.98
    parts += [(last, brass(m, 1.9, 0.85, vibrato=0.003, bright=0.9)) for m in sink]
    parts += [(last, strings(m, 2.0, 0.6, tremolo=0.6)) for m in sink + (61,)]
    parts += [(last + 0.15, strings(m, 1.8, 0.12, tremolo=0.8)) for m in (70, 69)]  # the rub
    parts += [(last, timpani(37, 2.0, 1.2)), (last, cymbal(1.8, 0.08))]
    sub = times(2.0)
    parts += [(last, 0.5 * np.sin(2 * np.pi * 38 * sub) * np.exp(-1.8 * sub))]
    return finish(mix(last + 2.1, parts), fade=0.6)


def superhero():
    """Villain to hero: a soaring fanfare in B flat. A run up the scale to a
    held F, a lift through a C major chord over the B flat (the bright,
    open sound of a hero arriving), and a landing on a high B flat over the
    full chord, a snare rolling into it and a cymbal on the landing."""
    E = 0.12  # an eighth note
    hold = 3 * E
    lift = hold + 0.45
    land = lift + 0.36
    lead = [(0, 70, 0.1), (E, 72, 0.1), (2 * E, 74, 0.1), (hold, 77, 0.42), (lift, 76, 0.11), (lift + 0.12, 77, 0.11), (lift + 0.24, 79, 0.11)]
    parts = [(s, brass(m, d, 0.9)) for s, m, d in lead]
    parts += [(hold, brass(m, 0.42, 0.4, bright=0.8)) for m in (70, 74)]
    parts += [(lift, strings(m, land - lift + 0.05, 0.45, tremolo=0.3)) for m in (60, 64, 67)]  # C major over the B flat
    parts += [(0, strings(m, lift, 0.35, tremolo=0.3)) for m in (58, 62, 65)]
    parts += [(land, brass(82, 1.2, 1.0, vibrato=0.005))]
    parts += [(land, brass(m, 1.2, 0.42, bright=0.75)) for m in (58, 62, 65, 70)]
    parts += [(land, strings(m, 1.25, 0.4)) for m in (74, 77)]
    parts += [(0, brass(46, hold, 0.5, bright=0.6)), (land, brass(46, 1.2, 0.6, bright=0.6))]
    parts += [(lift + i * 0.045, snare(0.12, 0.12 + 0.05 * i)) for i in range(8)]
    parts += [(0, timpani(46, 0.6, 0.8)), (land, timpani(46, 1.2, 1.0)), (land, cymbal(1.4, 0.2))]
    return finish(mix(land + 1.5, parts))


def supervillain():
    """Hero to villain: menace creeping up from the depths. A low tremolo on
    a tritone swells under two brooding brass notes, each a half step higher,
    then lands on a diminished-seventh stab with a drum and a deep boom, a
    thin high shriek of strings shivering over it as it dies away."""
    rise = 1.05
    t = times(rise)
    swell = 0.5 + 0.5 * (t / rise) ** 2
    parts = [(0, strings(m, rise, 1.0, tremolo=0.7) * swell) for m in (40, 46, 52)]  # E, the B flat a tritone up, and E again
    parts += [(0.35, brass(47, 0.3, 0.55, bright=0.7)), (0.7, brass(48, 0.3, 0.65, bright=0.75))]
    stab = (40, 46, 52, 55, 61)  # E diminished seventh: E, B flat, E, G, C sharp
    parts += [(rise, brass(m, 1.9, 0.85, vibrato=0.003, bright=0.9)) for m in stab]
    parts += [(rise, strings(m, 2.0, 0.55, tremolo=0.5)) for m in stab]
    parts += [(rise + 0.12, strings(m, 1.8, 0.14, tremolo=0.8)) for m in (82, 76)]  # the shriek: a tritone, high
    parts += [(rise, timpani(40, 2.0, 1.2)), (rise, cymbal(1.6, 0.1))]
    sub = times(2.0)
    parts += [(rise, 0.55 * np.sin(2 * np.pi * 41 * sub) * np.exp(-1.6 * sub))]
    return finish(mix(rise + 2.1, parts), fade=0.6)


# ---- Crowds (Ash) -----------------------------------------------------------

# Where a vowel's formants are, in Hz, and how loud each is: the peaks in the
# spectrum a mouth shapes a buzz into.
VOWELS = {
    'ah': ((750, 1.0), (1200, 0.7), (2550, 0.25)),
    'eh': ((550, 1.0), (1800, 0.6), (2550, 0.25)),
    'oh': ((480, 1.0), (850, 0.6), (2500, 0.12)),
    'oo': ((330, 1.0), (800, 0.35), (2300, 0.08)),
    # The bright ones: high second formants, the ring of a happy shout.
    'ae': ((660, 1.0), (1720, 0.8), (2410, 0.35)),
    'ee': ((300, 0.8), (2300, 0.85), (3000, 0.45)),
}


def formants(f, vowel, bw=90.0):
    """How loud a vowel makes each frequency in `f`: a resonance at each
    formant, wider the higher it is."""
    gain = np.zeros_like(f, dtype=float)
    for centre, amp in VOWELS[vowel]:
        width = bw + centre * 0.06
        gain += amp / (1 + ((f - centre) / width) ** 2)
    return gain


def voice(dur, f0, contour, vowels, morph=None, vel=1.0, breath=0.1, swell=None, tilt=0.9):
    """One person: a buzz at `f0` Hz bent by `contour` (a multiplier over the
    note, from 0 to 1 of the way through), with a little natural wobble,
    shaped by a mouth moving from the first of `vowels` to the second as
    `morph` goes from 0 to 1 ('eh' opening to 'ah' is a "yeah"), as loud
    over the note as `swell` says, with a little breath in it. A lower
    `tilt` keeps more of the upper harmonics: a shout's edge."""
    t = times(dur)
    u = t / dur
    pitch = f0 * contour(u) * (1 + 0.012 * np.sin(2 * np.pi * RNG.uniform(4, 6.5) * t + RNG.uniform(0, 6)))
    pitch *= 1 + 0.006 * lowpass(RNG.standard_normal(len(t)), 30)  # jitter
    phase = 2 * np.pi * np.cumsum(pitch) / SR
    first, last = vowels[0], vowels[-1]
    m = np.clip(morph(u), 0, 1) if morph else np.zeros_like(u)
    out = np.zeros_like(t)
    for k in range(1, 40):
        fk = k * pitch
        if fk.min() > 5000:
            break
        mouth = (1 - m) * formants(fk, first) + m * formants(fk, last)
        out += np.sin(k * phase) / k ** tilt * mouth * (fk < SR / 2.2)
    # A little breath in the voice, through the mouth it ends in.
    air = shaped(RNG.standard_normal(len(t)), last, hiss=0.03)
    level = np.sqrt(np.mean(out ** 2)) / max(1e-9, np.sqrt(np.mean(air ** 2)))
    loud = swell(u) if swell else 1.0
    return vel * (out + breath * level * air) * loud * envelope(t, 0.05, min(0.35, dur / 2), dur)


def shaped(noise, vowel, hiss=0.15):
    """Noise through a vowel's shape, with `hiss` of the higher air in it."""
    spec = np.fft.rfft(noise)
    f = np.fft.rfftfreq(len(noise), 1 / SR)
    spec *= formants(f, vowel, bw=160) + hiss * np.clip((f - 2000) / 3000, 0, 1) * (f < 7000)
    return np.fft.irfft(spec, len(noise))


def breathy(dur, vowel, vel=1.0, attack=0.03, release=0.18):
    """Unvoiced air through a vowel's shape: the hush under a crowd."""
    t = times(dur)
    return vel * shaped(RNG.standard_normal(len(t)), vowel) * envelope(t, attack, release, dur)


def clap(vel=1.0):
    """One pair of hands: a sharp crack of mid-high noise."""
    t = times(0.05)
    noise = RNG.standard_normal(len(t))
    band = lowpass(noise, RNG.uniform(2200, 3400)) - lowpass(noise, 900)
    return vel * band * np.exp(-RNG.uniform(90, 130) * t)


def whistle(dur, vel=1.0):
    """A fan's two-finger whistle: a pure high note swooping up and down."""
    t = times(dur)
    f = 2400 + 700 * np.sin(np.pi * t / dur) ** 2
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR)
    return vel * tone * envelope(t, 0.04, 0.12, dur)


def hall(x, seconds=1.5, mix=0.2):
    """An arena: room enough to sound big, kept short and light so the
    voices stay clear rather than washing together."""
    return reverb(x, seconds, mix)


def people(n, men=0.55):
    """`n` voices, men's and women's (`men` of them men's), each its own pitch."""
    low = RNG.random(n) < men
    return np.where(low, RNG.uniform(105, 165, n), RNG.uniform(200, 300, n))


def presence(x, gain=1.6, lo=1800, hi=5000):
    """Lift the band where a voice rings (`lo` to `hi` Hz) by `gain`: brighter."""
    spec = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    lift = np.clip((f - lo) / (hi - lo), 0, 1)
    spec *= 1 + (gain - 1) * np.sin(np.pi / 2 * lift) * (f < 9000)
    return np.fft.irfft(spec, len(x))


def cheer():
    """Back on his feet: an arena erupts, bright and happy. Mostly women's
    and kids' pitches; voices on "yeah!" (an 'eh' opening to the bright
    'ae', leaping up into the shout, holding, falling at the end), "yay!"
    (an 'eh' brightening to 'ee') and a few high "woo!"s gliding up; every
    shout with the edge of its upper harmonics kept, and the band where
    voices ring lifted. Crisp clapping under it and three whistles over the
    top, then it settles."""
    length = 3.0
    parts = []
    for f0 in people(48, men=0.3) * 1.08:
        start = RNG.uniform(0, 0.3)
        dur = RNG.uniform(1.4, length - start - 0.15)
        kind = RNG.random()
        if kind < 0.5:
            rise = RNG.uniform(1.25, 1.5)
            contour = lambda u, r=rise: 1 + (r - 1) * np.clip(u / 0.1, 0, 1) - 0.3 * (r - 1) * np.clip((u - 0.7) / 0.3, 0, 1)
            parts.append((start, voice(dur, f0, contour, ('eh', 'ae'), lambda u: u / 0.15, RNG.uniform(0.6, 1.0), tilt=0.6)))
        elif kind < 0.8:
            rise = RNG.uniform(1.2, 1.4)
            contour = lambda u, r=rise: 1 + (r - 1) * np.clip(u / 0.15, 0, 1) - 0.2 * (r - 1) * np.clip((u - 0.75) / 0.25, 0, 1)
            parts.append((start, voice(dur, f0, contour, ('eh', 'ee'), lambda u: (u - 0.05) / 0.25, RNG.uniform(0.5, 0.9), tilt=0.6)))
        else:
            glide = RNG.uniform(1.4, 1.7)
            contour = lambda u, g=glide: 1 + (g - 1) * np.clip(u / 0.3, 0, 1) ** 0.6
            parts.append((start, voice(dur, f0 * 1.15, contour, ('oo',), None, RNG.uniform(0.45, 0.75), tilt=0.7)))
    # A hush of breath under the voices, faint, for the size of the crowd.
    parts.append((0, breathy(length, 'ae', 0.08, attack=0.3, release=1.0)))
    # Clapping: dense at first, thinning out as it settles.
    for _ in range(190):
        at = RNG.uniform(0.12, length - 0.1)
        parts.append((at, clap(RNG.uniform(0.35, 0.75) * max(0.15, 1 - at / length))))
    parts += [(0.35, whistle(0.7, 0.1)), (0.95, whistle(0.5, 0.07)), (1.5, whistle(0.6, 0.08))]
    return finish(presence(hall(mix(length, parts), seconds=1.2, mix=0.16)), fade=0.8)


def ooh():
    """He's gone down hurt: the arena's "ooooh!!!", all at once. A deep,
    round 'oo' that opens towards 'oh' as it swells, sliding up into it
    and holding, then sinking away as it fades: the sound a crowd makes at
    a nasty fall. Mostly men's voices, for its depth."""
    length = 2.4
    parts = []
    for f0 in people(46, men=0.7):
        start = RNG.uniform(0, 0.12)
        dur = RNG.uniform(1.6, 2.1)
        lift = RNG.uniform(1.18, 1.32)
        sink = RNG.uniform(0.78, 0.88)
        # Up into the "OOOH", a hold, and down as it dies away.
        contour = lambda u, a=lift, b=sink: np.interp(u, [0, 0.25, 0.5, 1], [1.0, a, a * 0.97, b])
        loud = lambda u: np.interp(u, [0, 0.12, 0.35, 1], [0.35, 1.0, 0.8, 0.25])
        parts.append((start, voice(dur, f0, contour, ('oo', 'oh'), lambda u: (u - 0.08) / 0.3, RNG.uniform(0.6, 1.0), swell=loud, tilt=0.85)))
    parts.append((0, breathy(length, 'oh', 0.08, attack=0.1, release=1.2)))
    return finish(hall(mix(length, parts)), fade=0.7)


# Where the random draws for each crowd start, so changing one never changes
# the other. The ooh's is where it was first made from (after the stings and
# an earlier cheer), kept so it stays exactly as it is.
CHEER_NOISE = 11
OOH_NOISE = {'bit_generator': 'PCG64', 'state': {'state': 107422374632947494580013978206694976578,
                                                 'inc': 261136684632268670825940853076396136793}, 'has_uint32': 0, 'uinteger': 0}


def with_noise(start, make):
    """Make a sound with the noise drawn from `start` (a seed, or a saved state)."""
    global RNG
    RNG = np.random.default_rng(start if isinstance(start, int) else 0)
    if not isinstance(start, int):
        RNG.bit_generator.state = start
    return make()


def write(name, x, kbps=KBPS):
    enc = lameenc.Encoder()
    enc.set_bit_rate(kbps)
    enc.set_in_sample_rate(SR)
    enc.set_channels(1)
    enc.set_quality(2)
    pcm = (x * 32767).astype('<i2').tobytes()
    data = enc.encode(pcm) + enc.flush()
    (OUT / name).write_bytes(data)
    print(f'{name}: {len(x) / SR:.2f}s, {len(data) / 1024:.0f} kB')


if __name__ == '__main__':
    # In this order: each draws on the noise where the last left off.
    write('heroTheme.mp3', hero())  # Lukas
    write('outlawTheme.mp3', outlaw())
    write('superheroTheme.mp3', superhero())  # Chris
    write('supervillainTheme.mp3', supervillain())
    # A crowd is many voices at once, which a low bit rate smears: these get more.
    write('crowdCheer.mp3', with_noise(CHEER_NOISE, cheer), CROWD_KBPS)  # Ash
    write('crowdOoh.mp3', with_noise(OOH_NOISE, ooh), CROWD_KBPS)
