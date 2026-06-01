import fs from "node:fs";
import { buildDirectorAnalysisEnvelope, DIRECTOR_ANALYSIS_ENVELOPE_VERSION } from "../src/core/directorAnalysisEnvelope.ts";
import { schemaRegistry } from "../src/core/schemaRegistry.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const baseInput = {
  projectId: "director-analysis-envelope-fixture",
  generatedAt: "2026-05-22T00:00:00.000Z",
  scriptText: "清晨的屋顶，短发少女把一盘旧磁带递给少年。两个人都不急着说话，风吹动校服领口。",
  userPreference: "日漫情绪特写，动作不要平，要有递东西前后的停顿和反应。",
  creativeBrief: {
    filmLikes: ["青春日漫"],
    rhythmLikes: ["特写切分", "手部插入镜头"],
    expressionLikes: ["克制表情", "微反应"],
  },
  shots: [
    {
      id: "S01",
      title: "递出磁带前",
      intent: "少女站在画面左侧，低头看一眼手里的旧磁带，少年在右后方等待。",
      camera: "中近景，轻微推进",
      durationSeconds: 5,
    },
    {
      id: "S02",
      title: "手部交接",
      intent: "旧磁带从少女手中递向少年，少年迟疑半秒才接住。",
      camera: "手部特写，轻微横移",
      durationSeconds: 4,
    },
  ],
};

const llmCandidate = buildDirectorAnalysisEnvelope({
  ...baseInput,
  llmCandidate: {
    narrativeGoal: "用克制的递物动作建立两个人的关系变化。",
    directorNotes: ["不要把 5 秒镜头塞成完整动作链。", "手部和眼神比大幅动作更重要。"],
    shots: [
      {
        shotId: "S01",
        rhythmProfile: "anime_emotion",
        rhythmReason: "这一镜需要先看停顿、视线和呼吸，让观众感到未说出口的情绪。",
        actionDensity: "low",
        splitPolicy: "split_for_reaction",
        primaryAction: "少女看着旧磁带，手指轻轻收紧，还没有递出。",
        actionTrigger: "少年在画面右后方停住脚步。",
        microReaction: "少女眨眼，呼吸让肩线轻微起伏。",
        confidence: 0.86,
      },
      {
        shotId: "S02",
        rhythmProfile: "action_fast_cut",
        rhythmReason: "递物本身很短，需要拆成手部动作和接住后的反应。",
        actionDensity: "medium",
        splitPolicy: "split_for_action",
        primaryAction: "少女把旧磁带递到画面中央。",
        actionTrigger: "少年伸手进入画面。",
        microReaction: "两人的手指短暂悬停后才接触磁带。",
        actionBeats: ["旧磁带进入画面中央", "少年指尖停顿", "磁带被接住"],
        confidence: 0.78,
      },
    ],
  },
});

assert(llmCandidate.schemaVersion === DIRECTOR_ANALYSIS_ENVELOPE_VERSION, "schema version drifted");
assert(llmCandidate.providerCalled === false, "director analysis envelope must not call providers");
assert(llmCandidate.runtimeExternalNetworkCallMade === false, "director analysis envelope must not imply network calls");
assert(llmCandidate.taskEnvelope.status === "valid", "valid analysis envelope should produce a valid task envelope");
assert(llmCandidate.taskEnvelope.forbiddenActions.includes("provider_submit"), "task envelope must forbid provider submit");
assert(llmCandidate.shots.every((shot) => shot.candidateAccepted), "valid LLM candidate should be accepted for every shot");
assert(llmCandidate.shots[0]!.directorPlan.rhythmProfile === "anime_emotion", "S01 should use LLM rhythm");
assert(llmCandidate.shots[1]!.directorPlan.splitPolicy === "split_for_action", "S02 should preserve LLM split policy");
assert(
  llmCandidate.shots[0]!.directorPlan.mainComposition.startFrameAnchor.includes("少女看着旧磁带"),
  "LLM primary action should shape the start-frame anchor",
);

const fallback = buildDirectorAnalysisEnvelope({
  ...baseInput,
});
assert(fallback.warnings.includes("llm_candidate_absent_using_heuristic_fallback"), "missing LLM candidate should warn and use fallback");
assert(fallback.shots.every((shot) => shot.source === "heuristic_fallback"), "fallback mode should be explicit per shot");
assert(fallback.shots.every((shot) => shot.directorPlan.schemaVersion === "storyboard_director_plan_v1"), "fallback should still build director plans");

const invalidCandidate = buildDirectorAnalysisEnvelope({
  ...baseInput,
  llmCandidate: {
    shots: [{
      shotId: "S01",
      rhythmProfile: "big_cinematic_everything",
      splitPolicy: "do_all_actions",
      actionDensity: "extreme",
      primaryAction: "少女把磁带递出。",
    }],
  },
});
assert(invalidCandidate.warnings.some((warning) => warning.includes("invalid_rhythm_profile")), "invalid rhythm should be reported");
assert(invalidCandidate.shots[0]!.directorPlan.rhythmProfile !== "big_cinematic_everything", "invalid rhythm must not pass through");

const blocked = buildDirectorAnalysisEnvelope({
  ...baseInput,
  scriptText: "",
  shots: [],
});
assert(blocked.blocked === true, "empty analysis request should block");
assert(blocked.taskEnvelope.status === "blocked", "blocked input should block task envelope");
assert(blocked.blockers.includes("script_text_required"), "script blocker missing");
assert(blocked.blockers.includes("at_least_one_shot_required"), "shot blocker missing");

assert(
  schemaRegistry.some((entry) => entry.fileName === "director_analysis_envelope.schema.json" && entry.typeName === "DirectorAnalysisEnvelope"),
  "schema registry must include director analysis envelope",
);
const schema = JSON.parse(fs.readFileSync("schemas/director_analysis_envelope.schema.json", "utf8"));
assert(schema.title === "DirectorAnalysisEnvelope", "director analysis schema title drifted");

console.log(
  `director-analysis-envelope-test: shots=${llmCandidate.shots.length}, fallback=${fallback.shots.length}, warnings=${invalidCandidate.warnings.length}.`,
);
