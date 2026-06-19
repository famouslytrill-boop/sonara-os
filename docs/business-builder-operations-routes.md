# Business Builder Operations Routes

Purpose: turn the new operations tables into working owner and staff screens.

## Rule

Every visible action must save, load, calculate, export, or report real data.

## Owner pages

- `/business-builder/owner`
- `/business-builder/owner/locations`
- `/business-builder/owner/services`
- `/business-builder/owner/bookings`
- `/business-builder/owner/staff`
- `/business-builder/owner/schedules`
- `/business-builder/owner/time`
- `/business-builder/owner/inventory`
- `/business-builder/owner/vendors`
- `/business-builder/owner/invoices`
- `/business-builder/owner/recipes`
- `/business-builder/owner/menu`
- `/business-builder/owner/costs`
- `/business-builder/owner/vehicles`
- `/business-builder/owner/maintenance`

## Staff pages

- `/staff`
- `/staff/schedule`
- `/staff/time`
- `/staff/tasks`
- `/staff/announcements`
- `/staff/location`

## Business API routes

- `GET /api/business/locations`
- `POST /api/business/locations`
- `GET /api/business/services`
- `POST /api/business/services`
- `GET /api/business/bookings`
- `POST /api/business/bookings`
- `GET /api/business/staff`
- `POST /api/business/staff`
- `GET /api/business/schedules`
- `POST /api/business/schedules`
- `GET /api/business/time-entries`
- `POST /api/business/time-entries/start`
- `POST /api/business/time-entries/stop`
- `GET /api/business/vendors`
- `POST /api/business/vendors`
- `GET /api/business/invoices`
- `POST /api/business/invoices`
- `GET /api/business/inventory`
- `POST /api/business/inventory`
- `GET /api/business/recipes`
- `POST /api/business/recipes`
- `GET /api/business/menu-items`
- `POST /api/business/menu-items`
- `GET /api/business/costs`
- `GET /api/business/vehicles`
- `POST /api/business/vehicles`
- `GET /api/business/maintenance`
- `POST /api/business/maintenance`

## Creator music routes

- `GET /creator-studio/music-projects`
- `POST /api/creator/music-projects`
- `GET /api/creator/music-projects/:id`
- `POST /api/creator/music-projects/:id/daw-sessions`
- `POST /api/creator/music-projects/:id/audio-assets`
- `POST /api/creator/audio-assets/:id/analyze`
- `POST /api/creator/music-projects/:id/cues`
- `GET /api/integrations/providers`
- `POST /api/integrations/jobs`

## Access model

Owner and admin can manage the business workspace.

Staff users see only assigned schedule, tasks, notices, location information, and allowed work records.

Founder can monitor system readiness without creating fake customer access.

## Calculations

Food cost percentage equals cost divided by net sales.

Labor percentage equals labor divided by net sales.

Prime cost equals food cost plus labor cost.

Menu margin equals selling price minus theoretical cost.

Inventory value equals count multiplied by unit cost.

Work duration equals stop time minus start time minus breaks.

## Public labels

Use plain words: Vendors, Invoices, Food Costs, Inventory, Menu, Recipes, Daily Profit, Staff, Schedule, Time, Vehicles, Maintenance.
