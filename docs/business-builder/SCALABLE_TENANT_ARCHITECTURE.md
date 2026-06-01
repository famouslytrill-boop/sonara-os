# Scalable Tenant Architecture

Business Builder does not create arbitrary physical databases per user. It stores tenant-scoped workspace, sub-app, module, page, deployment, and schema metadata in shared tables with RLS.
