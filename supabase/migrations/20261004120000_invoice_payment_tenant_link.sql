-- Enforce tenant linkage for new invoice-payment writes without deleting history.
-- NOT VALID protects new writes; historical violations must be reviewed before
-- a later VALIDATE CONSTRAINT. No production migration is implied by this file.
CREATE UNIQUE INDEX IF NOT EXISTS customer_invoices_id_organization_key
  ON public.customer_invoices (id, organization_id);
ALTER TABLE public.customer_invoice_payments
  ADD CONSTRAINT customer_invoice_payments_invoice_organization_fkey
  FOREIGN KEY (invoice_id, organization_id)
  REFERENCES public.customer_invoices (id, organization_id)
  NOT VALID;
