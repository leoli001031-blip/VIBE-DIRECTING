import { getProviderRule, validateProviderJob } from "./providerPolicy";
import { assertReferenceAllowed } from "./sourceIndex";
import type {
  GenerationJob,
  KeyframePairDerivation,
  PreflightBlocker,
  PreflightReport,
  PreflightScope,
  ProjectSourceIndex,
  ReferenceAuthority,
} from "./types";

function blocker(code: string, messageForUser: string, technicalDetail: string, target?: string): PreflightBlocker {
  return { code, messageForUser, technicalDetail, target };
}

function warning(code: string, messageForUser: string, technicalDetail: string, target?: string): PreflightBlocker {
  return { code, messageForUser, technicalDetail, target };
}

export interface PreflightInput {
  job: GenerationJob;
  references: ReferenceAuthority[];
  sourceIndex?: ProjectSourceIndex;
  keyframePairDerivation?: KeyframePairDerivation;
  promptHash?: string;
  expectedOutputs?: string[];
  preflightScope?: PreflightScope;
  checkedAt?: string;
}

function providerIssueCode(issueId: string, jobId: string): string {
  const suffix = `-${jobId}`;
  return issueId.endsWith(suffix) ? issueId.slice(0, -suffix.length) : issueId;
}

export function buildPreflightReport(input: PreflightInput): PreflightReport {
  const { job, references, sourceIndex, keyframePairDerivation } = input;
  const preflightScope = input.preflightScope || "formal_execution";
  const blockers: PreflightBlocker[] = [];
  const warnings: PreflightBlocker[] = [];
  const providerIssues = validateProviderJob(job);
  const rule = getProviderRule(job.slot);

  for (const issue of providerIssues) {
    blockers.push(blocker(providerIssueCode(issue.id, job.id), issue.title, issue.detail, issue.target));
  }

  if (!sourceIndex && preflightScope === "formal_execution") {
    blockers.push(
      blocker(
        "missing_source_index",
        "当前任务没有绑定项目事实索引，不能作为正式执行任务提交。",
        "ProjectSourceIndex is missing; provider/execution tasks require source-index binding.",
        job.id,
      ),
    );
  } else if (!sourceIndex) {
    warnings.push(
      warning(
        "missing_source_index",
        preflightScope === "import_only" ? "导入流程没有绑定项目事实索引，仅记录提示。" : "开发预览没有绑定项目事实索引，仅作为预览提示。",
        `ProjectSourceIndex is missing in ${preflightScope}; this scope does not block on source-index binding.`,
        job.id,
      ),
    );
  }

  if (input.expectedOutputs && input.expectedOutputs.length === 0) {
    blockers.push(
      blocker(
        "missing_expected_outputs",
        "这个任务没有声明预期输出文件，不能提交执行。",
        "expectedOutputs is empty.",
        job.id,
      ),
    );
  }

  if (input.promptHash && sourceIndex?.currentPromptHashes[job.id] && sourceIndex.currentPromptHashes[job.id] !== input.promptHash) {
    blockers.push(
      blocker(
        "stale_prompt_hash",
        "这个任务的提示词已经过期，需要重新编译。",
        `Task prompt hash ${input.promptHash} does not match source index hash ${sourceIndex.currentPromptHashes[job.id]}.`,
        job.id,
      ),
    );
  }

  for (const reference of references) {
    if (sourceIndex) {
      const mode = reference.allowedUse.includes("prompt_reference")
        ? "prompt_reference"
        : reference.allowedUse.includes("future_reference")
          ? "future_reference"
          : "draft_preview";

      try {
        assertReferenceAllowed(sourceIndex, reference.id, mode);
      } catch (error) {
        blockers.push(
          blocker(
            "source_index_reference_mismatch",
            "任务引用不在当前项目事实索引中，或已经过期/失败/废弃。",
            error instanceof Error ? error.message : `${reference.id} failed SourceIndex validation.`,
            reference.id,
          ),
        );
      }
    }

    if (reference.lockedStatus === "rejected" || reference.referenceRole === "rejected_case") {
      blockers.push(
        blocker(
          "rejected_reference",
          "任务引用了已废弃素材，不能继续生成。",
          `${reference.id} is rejected and cannot be used as a positive reference.`,
          reference.id,
        ),
      );
    }

    if (reference.referenceRole === "temp_candidate" || !reference.canUseAsFutureReference) {
      blockers.push(
        blocker(
          "unsafe_future_reference",
          "任务引用了未验收临时素材，不能作为正式参考。",
          `${reference.id} is not safe for future reference.`,
          reference.id,
        ),
      );
    }

    if (reference.polarity === "negative" && reference.allowedUse.includes("prompt_reference")) {
      blockers.push(
        blocker(
          "negative_reference_used_positive",
          "反例素材不能作为正向参考。",
          `${reference.id} has negative polarity but is allowed as prompt_reference.`,
          reference.id,
        ),
      );
    }
  }

  if (job.slot === "video.i2v") {
    if (rule?.executionState === "parked") {
      warnings.push(
        warning(
          "video_provider_parked",
          "视频生成接口现在只是预留，不会提交即梦/Seedance。",
          `${job.slot} is parked by provider policy.`,
          job.id,
        ),
      );
    }

    if (!keyframePairDerivation?.validForI2vPair) {
      blockers.push(
        blocker(
          "invalid_keyframe_pair",
          "首尾帧没有通过同镜头派生证明，不能进入视频生成。",
          "keyframePairDerivation.validForI2vPair is false or missing.",
          job.id,
        ),
      );
    }
  }

  const status = blockers.length ? "blocked" : warnings.length ? "warning" : "pass";
  return {
    taskId: job.id,
    preflightScope,
    status,
    blockers,
    warnings,
    checkedAt: input.checkedAt || new Date().toISOString(),
  };
}
