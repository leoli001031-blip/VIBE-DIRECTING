# 已知限制

- 仅验证 macOS arm64 本地 Beta。
- 使用 ad-hoc 签名，没有 Developer ID，也没有 notarization。
- Gatekeeper 可能显示未验证开发者提示。
- P13-A 已验证一次 Image2 请求和一次 Seedance `seedance2.0_vip` 提交；返回媒体仍为 `needs_review`。
- 单次 Provider Canary 不是规模化稳定性、质量通过或成本稳定性证明。
- Provider 任务不会自动重试，Review、晋级和 Delivery 仍是独立确认边界。
- 这不是公开发行或规模化 Provider 稳定性证明。
