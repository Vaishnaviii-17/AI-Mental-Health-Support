from pathlib import Path

import av
import numpy as np

TARGET_SAMPLE_RATE = 16000
CHUNK_SECONDS = 8.0
MIN_AUDIO_SECONDS = 0.25
MAX_VALID_CHUNKS = 20


def load_audio_mono_16khz(audio_path):
    path = Path(audio_path)

    if not path.exists() or not path.is_file():
        raise ValueError("audio file does not exist")

    if path.stat().st_size <= 0:
        raise ValueError("audio file is empty")

    samples = []
    resampler = av.audio.resampler.AudioResampler(
        format="s16",
        layout="mono",
        rate=TARGET_SAMPLE_RATE,
    )

    try:
        with av.open(str(path)) as container:
            audio_streams = [stream for stream in container.streams if stream.type == "audio"]

            if not audio_streams:
                raise ValueError("audio file has no audio stream")

            for frame in container.decode(audio=0):
                for resampled in resampler.resample(frame):
                    array = resampled.to_ndarray()
                    samples.append(array.reshape(-1))
    except av.FFmpegError as exc:
        raise ValueError("unsupported or invalid audio format") from exc

    if not samples:
        raise ValueError("no decodable audio samples found")

    waveform = np.concatenate(samples).astype(np.float32) / 32768.0
    waveform = waveform[np.isfinite(waveform)]

    if waveform.size <= 0:
        raise ValueError("audio waveform is empty")

    peak = float(np.max(np.abs(waveform)))
    if peak > 1.0:
        waveform = waveform / peak

    duration = waveform.size / TARGET_SAMPLE_RATE
    if duration < MIN_AUDIO_SECONDS:
        raise ValueError("audio recording is too short for speech emotion analysis")

    return waveform, TARGET_SAMPLE_RATE


def chunk_waveform(waveform, sample_rate=TARGET_SAMPLE_RATE):
    chunk_size = int(CHUNK_SECONDS * sample_rate)

    if chunk_size <= 0:
        return []

    chunks = [
        waveform[index:index + chunk_size]
        for index in range(0, len(waveform), chunk_size)
    ]

    valid_chunks = [
        chunk
        for chunk in chunks
        if len(chunk) >= int(MIN_AUDIO_SECONDS * sample_rate)
    ]

    # Voice journals are capped near two minutes. Keeping at most
    # twenty 8-second chunks bounds inference work while still
    # preserving coverage through mean-probability aggregation.
    return valid_chunks[:MAX_VALID_CHUNKS]

