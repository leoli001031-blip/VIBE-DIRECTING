import argparse
from pathlib import Path

import soundfile as sf
import torch
from qwen_tts import Qwen3TTSModel


def main():
    parser = argparse.ArgumentParser(description="Run one local Qwen3-TTS voice-clone synthesis job.")
    parser.add_argument("--text", required=True)
    parser.add_argument("--language", default="Auto")
    parser.add_argument("--ref-audio", required=True)
    parser.add_argument("--ref-text", default="")
    parser.add_argument("--output", required=True)
    parser.add_argument("--model-dir", required=True)
    parser.add_argument("--device-map", default="auto")
    parser.add_argument("--dtype", default="auto", choices=["auto", "float32", "float16", "bfloat16"])
    parser.add_argument("--attn-implementation", default="")
    parser.add_argument("--x-vector-only-mode", action="store_true")
    args = parser.parse_args()

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)

    if args.dtype == "float32":
        dtype = torch.float32
    elif args.dtype == "float16":
        dtype = torch.float16
    elif args.dtype == "bfloat16":
        dtype = torch.bfloat16
    else:
        dtype = torch.bfloat16 if torch.cuda.is_available() else torch.float32

    kwargs = {
        "device_map": args.device_map,
        "dtype": dtype,
    }
    if args.attn_implementation:
        kwargs["attn_implementation"] = args.attn_implementation

    model = Qwen3TTSModel.from_pretrained(args.model_dir, **kwargs)
    generate_kwargs = {
        "text": args.text,
        "language": args.language,
        "ref_audio": args.ref_audio,
    }
    if args.ref_text:
        generate_kwargs["ref_text"] = args.ref_text
    if args.x_vector_only_mode:
        generate_kwargs["x_vector_only_mode"] = True

    wavs, sr = model.generate_voice_clone(**generate_kwargs)
    sf.write(str(output), wavs[0], sr)

    if not output.exists() or output.stat().st_size <= 0:
        raise RuntimeError(f"Qwen3-TTS did not create output: {output}")

    print(f"local-qwen3-tts-clone-runner: wrote {output} ({output.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
