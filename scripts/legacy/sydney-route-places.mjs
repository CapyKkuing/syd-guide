export const sydneyRoutePlaces = [
  route("route-sydney-airport", "Sydney Airport", "transport", "Sydney Airport NSW 2020", -33.9399, 151.1753, ["legacy-schedule-01-01", "legacy-schedule-08-03"]),
  route("route-qvb", "Queen Victoria Building", "attraction", "455 George Street, Sydney NSW 2000", -33.8718, 151.2067, ["legacy-schedule-01-03", "legacy-schedule-08-01"]),
  route("route-darling-harbour", "Darling Harbour", "attraction", "Darling Harbour, Sydney NSW 2000", -33.8748, 151.2008, ["legacy-schedule-01-05", "legacy-schedule-06-02"]),
  route("route-opera-house", "Sydney Opera House", "attraction", "Bennelong Point, Sydney NSW 2000", -33.8568, 151.2153, ["legacy-schedule-02-01"]),
  route("route-royal-botanic-garden", "Royal Botanic Garden Sydney", "attraction", "Mrs Macquaries Road, Sydney NSW 2000", -33.8642, 151.2166, ["legacy-schedule-02-02"]),
  route("route-circular-quay", "Circular Quay", "transport", "Circular Quay, Sydney NSW 2000", -33.861, 151.2109, ["legacy-schedule-02-04", "legacy-schedule-03-01", "legacy-schedule-07-01"]),
  route("route-the-rocks", "The Rocks", "attraction", "The Rocks, Sydney NSW 2000", -33.8599, 151.209, ["legacy-schedule-02-05", "legacy-schedule-07-03"]),
  route("route-taronga-zoo", "Taronga Zoo Sydney", "attraction", "Bradleys Head Road, Mosman NSW 2088", -33.843, 151.2413, ["legacy-schedule-03-02"]),
  route("route-manly-beach", "Manly Beach", "attraction", "Manly Beach, Manly NSW 2095", -33.7969, 151.2871, ["legacy-schedule-03-03"]),
  route("route-bondi-beach", "Bondi Beach", "attraction", "Bondi Beach, Bondi NSW 2026", -33.8915, 151.2767, ["legacy-schedule-04-02"]),
  route("route-bondi-icebergs", "Bondi Icebergs", "attraction", "1 Notts Avenue, Bondi Beach NSW 2026", -33.8952, 151.2741, ["legacy-schedule-04-03"]),
  route("route-bronte-coastal-walk", "Bondi to Bronte Coastal Walk", "attraction", "Bronte Beach, Bronte NSW 2024", -33.9034, 151.2682, ["legacy-schedule-04-04"]),
  route("route-central-station", "Central Station", "transport", "Eddy Avenue, Haymarket NSW 2000", -33.883, 151.2064, ["legacy-schedule-05-01", "legacy-schedule-05-04"]),
  route("route-echo-point", "Echo Point Lookout", "attraction", "Prince Henry Cliff Walk, Katoomba NSW 2780", -33.732, 150.312, ["legacy-schedule-05-02"]),
  route("route-scenic-world", "Scenic World", "attraction", "Violet Street and Cliff Drive, Katoomba NSW 2780", -33.7282, 150.3008, ["legacy-schedule-05-03"]),
  route("route-sydney-fish-market", "Sydney Fish Market", "restaurant", "Bridge Road, Pyrmont NSW 2009", -33.8692, 151.1924, ["legacy-schedule-06-01"]),
  route("route-sydney-tower", "Sydney Tower Eye", "attraction", "108 Market Street, Sydney NSW 2000", -33.8705, 151.2089, ["legacy-schedule-06-03"]),
  route("route-mca", "Museum of Contemporary Art Australia", "attraction", "140 George Street, The Rocks NSW 2000", -33.8599, 151.209, ["legacy-schedule-07-02"]),
  route("route-art-gallery-nsw", "Art Gallery of New South Wales", "attraction", "Art Gallery Road, Sydney NSW 2000", -33.8688, 151.2176, ["legacy-schedule-08-02"]),
];

function route(id, name, category, address, latitude, longitude, scheduleIds) {
  return {
    id,
    name,
    category,
    address,
    latitude,
    longitude,
    mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`,
    scheduleIds,
  };
}
