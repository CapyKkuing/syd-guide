WITH empty_trips AS (
  SELECT id, created_by
  FROM trips
  WHERE deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM check_items WHERE check_items.trip_id = trips.id
    )
), defaults(item_key, title, category, phase, requirement_kind, position) AS (
  VALUES
    ('payment', '해외 결제 수단', 'essential', 'pretrip', 'essential', 1),
    ('insurance', '여행자 보험·비상 연락처 확인', 'essential', 'pretrip', 'essential', 2),
    ('flight', '항공권 확인', 'reservation', 'pretrip', NULL, 3),
    ('lodging', '숙소 예약 확인', 'reservation', 'pretrip', NULL, 4),
    ('charger', '충전기', 'packing', 'pretrip', NULL, 5),
    ('connectivity', 'eSIM·로밍', 'packing', 'pretrip', NULL, 6),
    ('expense', '오늘 쓴 비용 확인', 'travel', 'travel', NULL, 7)
)
INSERT INTO check_items (
  id, trip_id, scope, owner_member_id, assignee_member_id, title,
  quantity, memo, is_done, position, version, updated_by, updated_at,
  phase, category, requirement_kind
)
SELECT
  'default-passport-' || trip.id || '-' || member.id,
  trip.id,
  'personal',
  member.id,
  member.id,
  '여권',
  1,
  '여권 만료일과 영문 이름을 확인하세요.',
  0,
  0,
  1,
  trip.created_by,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  'pretrip',
  'essential',
  'passport'
FROM empty_trips trip
JOIN trip_members membership ON membership.trip_id = trip.id
JOIN members member ON member.id = membership.member_id AND member.is_active = 1
UNION ALL
SELECT
  'default-' || default_item.item_key || '-' || trip.id,
  trip.id,
  'shared',
  NULL,
  NULL,
  default_item.title,
  1,
  '',
  0,
  default_item.position,
  1,
  trip.created_by,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  default_item.phase,
  default_item.category,
  default_item.requirement_kind
FROM empty_trips trip
CROSS JOIN defaults default_item;
