export const githubTokenPolicy = {
  envName: "GITHUB_TOKEN",
  serverOnly: true,
  optional: true,
  fallbackMode: "manual registry mode",
  neverExposeClientSide: true,
};
