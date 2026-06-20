# Submit Command Preview

These commands are a preview only. Do not run them until the 6-shot plan is approved.

All submissions should be serial. Wait for each `submit_id` to finish before submitting the next shot.

## Shot 1

```bash
dreamina multimodal2video \
  --image "/Users/lichenhao/Desktop/AI大小姐们想让我告白/assets/scenes/academy_2026-05-26T17-37-13-227Z.png" \
  --image "/Users/lichenhao/Desktop/AI大小姐们想让我告白/assets/characters/protagonist/identity_ref/protagonist_identity_ref_2026-05-26T16-17-35-187Z.png" \
  --prompt "$(sed -n '/^```text$/,/^```$/p' showcase-package/ai-ladies-op-6shot-plan-2026-06-18/02-prompts/shot_01_zc_academy_opening.md | sed '1d;$d')" \
  --duration 5 \
  --ratio 16:9 \
  --video_resolution 720p \
  --model_version seedance2.0_vip \
  --poll 0
```

## Shot 2

```bash
dreamina multimodal2video \
  --image "/Users/lichenhao/Desktop/AI大小姐们想让我告白/assets/scenes/corridor_2026-05-31T00-00-00-000Z.png" \
  --image "/Users/lichenhao/Desktop/AI大小姐们想让我告白/assets/characters/claude/identity_ref/claude_identity_ref_2026-05-26T15-54-10-516Z.png" \
  --image "/Users/lichenhao/Desktop/AI大小姐们想让我告白/assets/characters/gpt/identity_ref/gpt_identity_ref_2026-05-26T16-26-06-230Z.png" \
  --prompt "$(sed -n '/^```text$/,/^```$/p' showcase-package/ai-ladies-op-6shot-plan-2026-06-18/02-prompts/shot_02_claude_gpt_duel.md | sed '1d;$d')" \
  --duration 5 \
  --ratio 16:9 \
  --video_resolution 720p \
  --model_version seedance2.0_vip \
  --poll 0
```

## Shot 3

```bash
dreamina multimodal2video \
  --image "/Users/lichenhao/Desktop/AI大小姐们想让我告白/assets/scenes/clubroom_2026-05-26T17-38-35-441Z.png" \
  --image "/Users/lichenhao/Desktop/AI大小姐们想让我告白/assets/characters/gemini/identity_ref/gemini_identity_ref_2026-05-26T16-26-06-254Z.png" \
  --image "/Users/lichenhao/Desktop/AI大小姐们想让我告白/assets/characters/doubao/identity_ref/doubao_2026-05-26T16-47-11-806Z.png" \
  --image "/Users/lichenhao/Desktop/AI大小姐们想让我告白/assets/characters/protagonist/identity_ref/protagonist_identity_ref_2026-05-26T16-17-35-187Z.png" \
  --prompt "$(sed -n '/^```text$/,/^```$/p' showcase-package/ai-ladies-op-6shot-plan-2026-06-18/02-prompts/shot_03_gemini_doubao_burst.md | sed '1d;$d')" \
  --duration 4 \
  --ratio 16:9 \
  --video_resolution 720p \
  --model_version seedance2.0_vip \
  --poll 0
```

## Shot 4

```bash
dreamina multimodal2video \
  --image "/Users/lichenhao/Desktop/AI大小姐们想让我告白/assets/scenes/sports_field_2026-05-26T19-02-41-467Z.png" \
  --image "/Users/lichenhao/Desktop/AI大小姐们想让我告白/assets/scenes/rooftop_2026-05-26T19-03-39-418Z.png" \
  --image "/Users/lichenhao/Desktop/AI大小姐们想让我告白/assets/characters/deepseek/identity_ref/deepseek_identity_ref_2026-05-26T16-09-56-411Z.png" \
  --image "/Users/lichenhao/Desktop/AI大小姐们想让我告白/assets/characters/minimax/identity_ref/minimax_identity_ref_2026-05-26T16-13-10-882Z.png" \
  --image "/Users/lichenhao/Desktop/AI大小姐们想让我告白/assets/characters/kimi/identity_ref/kimi_identity_ref_2026-05-26T16-13-10-884Z.png" \
  --prompt "$(sed -n '/^```text$/,/^```$/p' showcase-package/ai-ladies-op-6shot-plan-2026-06-18/02-prompts/shot_04_three_heroine_flash.md | sed '1d;$d')" \
  --duration 6 \
  --ratio 16:9 \
  --video_resolution 720p \
  --model_version seedance2.0_vip \
  --poll 0
```

## Shot 5

```bash
dreamina multimodal2video \
  --image "/Users/lichenhao/Desktop/AI大小姐们想让我告白/assets/scenes/clubroom_2026-05-26T17-38-35-441Z.png" \
  --image "/Users/lichenhao/Desktop/AI大小姐们想让我告白/assets/characters/protagonist/identity_ref/protagonist_identity_ref_2026-05-26T16-17-35-187Z.png" \
  --image "/Users/lichenhao/Desktop/AI大小姐们想让我告白/assets/characters/gpt/identity_ref/gpt_identity_ref_2026-05-26T16-26-06-230Z.png" \
  --image "/Users/lichenhao/Desktop/AI大小姐们想让我告白/assets/characters/gemini/identity_ref/gemini_identity_ref_2026-05-26T16-26-06-254Z.png" \
  --image "/Users/lichenhao/Desktop/AI大小姐们想让我告白/assets/characters/doubao/identity_ref/doubao_2026-05-26T16-47-11-806Z.png" \
  --image "/Users/lichenhao/Desktop/AI大小姐们想让我告白/assets/characters/minimax/identity_ref/minimax_identity_ref_2026-05-26T16-13-10-882Z.png" \
  --prompt "$(sed -n '/^```text$/,/^```$/p' showcase-package/ai-ladies-op-6shot-plan-2026-06-18/02-prompts/shot_05_clubroom_team.md | sed '1d;$d')" \
  --duration 6 \
  --ratio 16:9 \
  --video_resolution 720p \
  --model_version seedance2.0_vip \
  --poll 0
```

## Shot 6

```bash
dreamina multimodal2video \
  --image "/Users/lichenhao/Desktop/AI大小姐们想让我告白/assets/scenes/academy_2026-05-26T17-37-13-227Z.png" \
  --image "/Users/lichenhao/Desktop/AI大小姐们想让我告白/assets/characters/protagonist/identity_ref/protagonist_identity_ref_2026-05-26T16-17-35-187Z.png" \
  --image "/Users/lichenhao/Desktop/AI大小姐们想让我告白/assets/characters/claude/identity_ref/claude_identity_ref_2026-05-26T15-54-10-516Z.png" \
  --image "/Users/lichenhao/Desktop/AI大小姐们想让我告白/assets/characters/gpt/identity_ref/gpt_identity_ref_2026-05-26T16-26-06-230Z.png" \
  --image "/Users/lichenhao/Desktop/AI大小姐们想让我告白/assets/characters/gemini/identity_ref/gemini_identity_ref_2026-05-26T16-26-06-254Z.png" \
  --image "/Users/lichenhao/Desktop/AI大小姐们想让我告白/assets/characters/deepseek/identity_ref/deepseek_identity_ref_2026-05-26T16-09-56-411Z.png" \
  --image "/Users/lichenhao/Desktop/AI大小姐们想让我告白/assets/characters/doubao/identity_ref/doubao_2026-05-26T16-47-11-806Z.png" \
  --prompt "$(sed -n '/^```text$/,/^```$/p' showcase-package/ai-ladies-op-6shot-plan-2026-06-18/02-prompts/shot_06_confession_pressure_hook.md | sed '1d;$d')" \
  --duration 6 \
  --ratio 16:9 \
  --video_resolution 720p \
  --model_version seedance2.0_vip \
  --poll 0
```
