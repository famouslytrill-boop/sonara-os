# SONARA Media Stack

## Browser capture

SONARA uses browser-native MediaDevices APIs for microphone and camera readiness checks.

## Browser audio

SONARA uses Web Audio API for subtle UI sounds.

Rules:

- No autoplay.
- Audio starts only after user interaction.
- Sounds are optional and disabled until enabled by the user.
- No copyrighted sound assets.

## Browser recording

MediaRecorder support is detected for future browser recording features.

## Server/offline processing later

FFmpeg is the preferred open-source media processing tool for heavier audio/video jobs.

## FFmpeg licensing note

FFmpeg is LGPL by default, but GPL obligations may apply when GPL components are enabled. Review build configuration before commercial distribution.

## Launch rule

Media tools must never block the core app from launching.
