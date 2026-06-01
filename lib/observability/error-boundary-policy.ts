export const errorBoundaryPolicy = {
  showUserMessage: "Something went wrong. The request was not completed.",
  hideStackTracesFromUsers: true,
  redactSecrets: true,
  requireCorrelationId: true,
};
