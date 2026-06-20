# SONARA Operations Next Build

This plan strengthens SONARA beyond static dashboards.

## Goal

Users should create real operating systems for small businesses and creator projects.

## Public words

Use simple words in the app:

- Business
- Website
- Pages
- Apps
- Employees
- Schedule
- Time Clock
- Services
- Customers
- Orders
- Payments
- Support
- Music Projects
- Songs
- Sounds
- Visuals
- Exports

## Business Builder

Support common businesses such as salons, restaurants, food trucks, ice cream stands, mobile vendors, home services, and pop-up shops.

Needed tools:

- business locations
- services
- bookings
- customers
- orders
- payments
- support
- inventory
- equipment
- vehicles and trailers
- inspections
- maintenance
- staff profiles
- schedules
- time entries
- announcements
- tasks

## Creator Studio

Needed tools:

- music projects
- DAW sessions
- audio assets
- stems
- reference tracks
- sound analysis
- AI audio job tracking
- release tracking
- visual cues
- export packages

## Access rules

The business owner controls the workspace. Staff users only see information assigned to their role. Founder access is for system monitoring and support.

## Infrastructure migration

The new operations schema is:

```text
supabase/migrations/013_sonara_business_employee_music_ops_schema.sql
```

It adds business operations, staff portal, vehicle, inventory, integration, music project, DAW, audio asset, analysis, and visual cue tables.

## Build order

1. Business settings
2. Staff portal
3. Time clock
4. Schedule
5. Service catalog
6. Bookings
7. Inventory
8. Vehicles and trailers
9. Music projects
10. DAW sessions
11. Audio assets
12. AI audio job tracking
13. Premium UI polish

Every visible button must save, load, publish, bill, route, or report real data.
