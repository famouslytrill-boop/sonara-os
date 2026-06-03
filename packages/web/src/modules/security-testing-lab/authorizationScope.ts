export function hasAuthorizedTestScope(input: {
  admin: boolean;
  ownerApproved: boolean;
  targetOwned: boolean;
}) {
  return input.admin && input.ownerApproved && input.targetOwned;
}
