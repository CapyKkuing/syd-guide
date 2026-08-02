WITH route_places (
  id, name, category, address, latitude, longitude
) AS (
  VALUES
    ('route-sydney-airport', 'Sydney Airport', 'transport', 'Sydney Airport NSW 2020', -33.9399, 151.1753),
    ('route-qvb', 'Queen Victoria Building', 'attraction', '455 George Street, Sydney NSW 2000', -33.8718, 151.2067),
    ('route-darling-harbour', 'Darling Harbour', 'attraction', 'Darling Harbour, Sydney NSW 2000', -33.8748, 151.2008),
    ('route-opera-house', 'Sydney Opera House', 'attraction', 'Bennelong Point, Sydney NSW 2000', -33.8568, 151.2153),
    ('route-royal-botanic-garden', 'Royal Botanic Garden Sydney', 'attraction', 'Mrs Macquaries Road, Sydney NSW 2000', -33.8642, 151.2166),
    ('route-circular-quay', 'Circular Quay', 'transport', 'Circular Quay, Sydney NSW 2000', -33.861, 151.2109),
    ('route-the-rocks', 'The Rocks', 'attraction', 'The Rocks, Sydney NSW 2000', -33.8599, 151.209),
    ('route-taronga-zoo', 'Taronga Zoo Sydney', 'attraction', 'Bradleys Head Road, Mosman NSW 2088', -33.843, 151.2413),
    ('route-manly-beach', 'Manly Beach', 'attraction', 'Manly Beach, Manly NSW 2095', -33.7969, 151.2871),
    ('route-bondi-beach', 'Bondi Beach', 'attraction', 'Bondi Beach, Bondi NSW 2026', -33.8915, 151.2767),
    ('route-bondi-icebergs', 'Bondi Icebergs', 'attraction', '1 Notts Avenue, Bondi Beach NSW 2026', -33.8952, 151.2741),
    ('route-bronte-coastal-walk', 'Bondi to Bronte Coastal Walk', 'attraction', 'Bronte Beach, Bronte NSW 2024', -33.9034, 151.2682),
    ('route-central-station', 'Central Station', 'transport', 'Eddy Avenue, Haymarket NSW 2000', -33.883, 151.2064),
    ('route-echo-point', 'Echo Point Lookout', 'attraction', 'Prince Henry Cliff Walk, Katoomba NSW 2780', -33.732, 150.312),
    ('route-scenic-world', 'Scenic World', 'attraction', 'Violet Street and Cliff Drive, Katoomba NSW 2780', -33.7282, 150.3008),
    ('route-sydney-fish-market', 'Sydney Fish Market', 'restaurant', 'Bridge Road, Pyrmont NSW 2009', -33.8692, 151.1924),
    ('route-sydney-tower', 'Sydney Tower Eye', 'attraction', '108 Market Street, Sydney NSW 2000', -33.8705, 151.2089),
    ('route-mca', 'Museum of Contemporary Art Australia', 'attraction', '140 George Street, The Rocks NSW 2000', -33.8599, 151.209),
    ('route-art-gallery-nsw', 'Art Gallery of New South Wales', 'attraction', 'Art Gallery Road, Sydney NSW 2000', -33.8688, 151.2176)
)
INSERT OR IGNORE INTO places (
  id, trip_id, name, category, status, address, latitude, longitude,
  map_url, source_url, image_url, description, saved_by, version,
  updated_by, updated_at
)
SELECT
  route_places.id, 'legacy-sydney-2026', route_places.name,
  route_places.category, 'saved', route_places.address,
  route_places.latitude, route_places.longitude, NULL, NULL, NULL,
  '일정 동선 장소', 'owner', 1, 'owner', CURRENT_TIMESTAMP
FROM route_places
WHERE EXISTS (SELECT 1 FROM trips WHERE id = 'legacy-sydney-2026');

UPDATE schedule_items
SET
  place_id = CASE id
    WHEN 'legacy-schedule-01-01' THEN 'route-sydney-airport'
    WHEN 'legacy-schedule-01-03' THEN 'route-qvb'
    WHEN 'legacy-schedule-01-05' THEN 'route-darling-harbour'
    WHEN 'legacy-schedule-02-01' THEN 'route-opera-house'
    WHEN 'legacy-schedule-02-02' THEN 'route-royal-botanic-garden'
    WHEN 'legacy-schedule-02-04' THEN 'route-circular-quay'
    WHEN 'legacy-schedule-02-05' THEN 'route-the-rocks'
    WHEN 'legacy-schedule-03-01' THEN 'route-circular-quay'
    WHEN 'legacy-schedule-03-02' THEN 'route-taronga-zoo'
    WHEN 'legacy-schedule-03-03' THEN 'route-manly-beach'
    WHEN 'legacy-schedule-04-02' THEN 'route-bondi-beach'
    WHEN 'legacy-schedule-04-03' THEN 'route-bondi-icebergs'
    WHEN 'legacy-schedule-04-04' THEN 'route-bronte-coastal-walk'
    WHEN 'legacy-schedule-05-01' THEN 'route-central-station'
    WHEN 'legacy-schedule-05-02' THEN 'route-echo-point'
    WHEN 'legacy-schedule-05-03' THEN 'route-scenic-world'
    WHEN 'legacy-schedule-05-04' THEN 'route-central-station'
    WHEN 'legacy-schedule-06-01' THEN 'route-sydney-fish-market'
    WHEN 'legacy-schedule-06-02' THEN 'route-darling-harbour'
    WHEN 'legacy-schedule-06-03' THEN 'route-sydney-tower'
    WHEN 'legacy-schedule-07-01' THEN 'route-circular-quay'
    WHEN 'legacy-schedule-07-02' THEN 'route-mca'
    WHEN 'legacy-schedule-07-03' THEN 'route-the-rocks'
    WHEN 'legacy-schedule-08-01' THEN 'route-qvb'
    WHEN 'legacy-schedule-08-02' THEN 'route-art-gallery-nsw'
    WHEN 'legacy-schedule-08-03' THEN 'route-sydney-airport'
  END,
  version = version + 1,
  updated_by = 'owner',
  updated_at = CURRENT_TIMESTAMP
WHERE trip_id = 'legacy-sydney-2026'
  AND id IN (
    'legacy-schedule-01-01', 'legacy-schedule-01-03', 'legacy-schedule-01-05',
    'legacy-schedule-02-01', 'legacy-schedule-02-02', 'legacy-schedule-02-04',
    'legacy-schedule-02-05', 'legacy-schedule-03-01', 'legacy-schedule-03-02',
    'legacy-schedule-03-03', 'legacy-schedule-04-02', 'legacy-schedule-04-03',
    'legacy-schedule-04-04', 'legacy-schedule-05-01', 'legacy-schedule-05-02',
    'legacy-schedule-05-03', 'legacy-schedule-05-04', 'legacy-schedule-06-01',
    'legacy-schedule-06-02', 'legacy-schedule-06-03', 'legacy-schedule-07-01',
    'legacy-schedule-07-02', 'legacy-schedule-07-03', 'legacy-schedule-08-01',
    'legacy-schedule-08-02', 'legacy-schedule-08-03'
  );

UPDATE trips
SET
  version = version + 1,
  sync_version = sync_version + 1,
  updated_by = 'owner',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'legacy-sydney-2026';
