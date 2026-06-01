import argparse
from pathlib import Path

from indextts.infer_v2 import IndexTTS2


def main():
    parser = argparse.ArgumentParser(description="Run one local IndexTTS2 synthesis job.")
    parser.add_argument("--text", required=True)
    parser.add_argument("--speaker-wav", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--model-dir", default="checkpoints")
    parser.add_argument("--cfg-path", default="checkpoints/config.yaml")
    parser.add_argument("--fp16", action="store_true")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)

    tts = IndexTTS2(
        cfg_path=args.cfg_path,
        model_dir=args.model_dir,
        use_fp16=args.fp16,
        use_cuda_kernel=False,
        use_deepspeed=False,
    )
    tts.infer(
        spk_audio_prompt=args.speaker_wav,
        text=args.text,
        output_path=str(output),
        verbose=args.verbose,
    )

    if not output.exists() or output.stat().st_size <= 0:
        raise RuntimeError(f"IndexTTS did not create output: {output}")

    print(f"local-index-tts-runner: wrote {output} ({output.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
