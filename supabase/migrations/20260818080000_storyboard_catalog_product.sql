-- Storyboard Builder published as a catalog row.
--
-- Its own migration for the same reason as the two before it: the original
-- seed is frozen and the generated sync migration updates without inserting.

insert into public.service_catalog_items
  (service_key,product_key,name,summary,price_note,status,sort_order,product_type,plan_floor,lifecycle_status,route_path,metadata)
select service_key,product_key,name,summary,price_note,'active',sort_order,'software_product',plan_floor,lifecycle_status,route_path,
       jsonb_build_object('catalogVersion','2026-07-25')
from (values
  ('storyboard-builder', 'creator_studio', 'Storyboard Builder', 'A numbered shot list with camera angle, purpose and transition for each shot, whose seconds add up to the runtime you actually have.', 'No charge.', 4010, 'free', 'active', '/creator-studio/tools/storyboard')
) as seed(service_key,product_key,name,summary,price_note,sort_order,plan_floor,lifecycle_status,route_path)
on conflict (service_key) where service_key is not null do update set
  product_key=excluded.product_key,name=excluded.name,summary=excluded.summary,price_note=excluded.price_note,
  status=excluded.status,sort_order=excluded.sort_order,product_type=excluded.product_type,plan_floor=excluded.plan_floor,
  lifecycle_status=excluded.lifecycle_status,route_path=excluded.route_path,metadata=excluded.metadata,updated_at=now();

notify pgrst, 'reload schema';
