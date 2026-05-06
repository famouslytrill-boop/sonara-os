#!/usr/bin/env sh
set -eu

echo "Storage backup is provider-specific."
echo "Back up Supabase Storage buckets separately from PostgreSQL:"
echo "- profile-images"
echo "- soundos-media"
echo "- tableos-documents"
echo "- alertos-imports"
echo "- public-assets"
echo "Do not export secrets into backup archives."
