#!/bin/sh
# Regenerates the small UI sound-effect library with ffmpeg (synthesized,
# no external assets — cheap enough to redo on every video run instead of
# committing binaries). Run from motion-studio/: sh sfx/make-sfx.sh
set -e
F="ffmpeg -loglevel error -y"
$F -f lavfi -i "anoisesrc=d=0.035:c=white:a=0.9" -af "highpass=f=2500,afade=t=out:st=0.005:d=0.03" sfx/c1.wav
$F -i sfx/c1.wav -i sfx/c1.wav -filter_complex "[1]adelay=70|70[b];[0][b]amix=inputs=2:normalize=0,volume=0.8" sfx/shutter.wav
$F -f lavfi -i "sine=f=1900:d=0.05" -af "afade=t=out:st=0:d=0.05,volume=0.35" sfx/tap.wav
$F -f lavfi -i "sine=f=1320:d=0.14" -f lavfi -i "sine=f=1760:d=0.22" -filter_complex "[0]afade=t=out:st=0.02:d=0.12[a];[1]afade=t=out:st=0.03:d=0.19,adelay=110|110[b];[a][b]amix=inputs=2:normalize=0,volume=0.45" sfx/ping.wav
$F -f lavfi -i "aevalsrc='sin(2*PI*(380*t+2600*t*t))*exp(-t*28)':d=0.16" -af volume=0.6 sfx/pop.wav
$F -f lavfi -i "anoisesrc=d=0.5:c=pink:a=0.8" -af "bandpass=f=900:w=1200,afade=t=in:d=0.22,afade=t=out:st=0.22:d=0.28,volume=0.5" sfx/whoosh.wav
$F -f lavfi -i "aevalsrc='sin(2*PI*2400*t)*exp(-t*60)':d=0.08" -af volume=0.45 sfx/tick.wav
rm -f sfx/c1.wav
echo "sfx regenerated: shutter, tap, ping, pop, whoosh, tick"
