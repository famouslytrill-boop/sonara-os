# Infrastructure as Code Policy

Terraform and OpenTofu remain evaluation items. SONARA should prefer OpenTofu for an open-source posture unless the owner chooses Terraform.

State files must never be public. Encrypted remote state is required before production. Plans require human review before apply. Production auto-apply is blocked. Rollback notes are required for every infrastructure change.
