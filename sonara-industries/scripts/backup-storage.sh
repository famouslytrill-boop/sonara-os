#!/usr/bin/env sh
set -eu

echo "Storage backup is provider-specific."
echo "Back up Supabase Storage buckets separately from PostgreSQL:"
echo "- profile-images"
echo "- trackfoundry-media"
echo "- lineready-documents"
echo "- noticegrid-imports"
echo "- public-assets"
echo "Do not export secrets into backup archives."
