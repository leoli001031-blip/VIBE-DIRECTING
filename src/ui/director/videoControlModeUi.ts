export function usesEndpointEndFrame(shot?: { videoControlMode?: string }): boolean {
  return shot?.videoControlMode === "first_last_endpoint";
}
