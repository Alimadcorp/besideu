import ngeohash from 'ngeohash';

// Haversine distance in kilometers between two lat/lon points
export function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const toRad = (v) => (v * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function decodeGeohash(hash) {
  try {
    const { latitude, longitude } = ngeohash.decode(hash);
    return { lat: latitude, lon: longitude };
  } catch {
    return null;
  }
}

// Very rough mapping from range (km) to geohash prefix length
export function getGeohashPrefixLengthForRange(rangeKm) {
  if (rangeKm <= 1) return 7;   // ~150m
  if (rangeKm <= 5) return 6;   // ~600m
  if (rangeKm <= 20) return 5;  // ~2.5km
  if (rangeKm <= 80) return 4;  // ~20km
  return 3;                     // very rough / large area
}

/*

let a = ngeohash.encode("12.23334", "23.3499909"), b = ngeohash.encode("12.23334", "23.3499909");

console.log(a, b);

let c = decodeGeohash(a), d = decodeGeohash(b);

console.log(c, d);

let distance = distanceKm(c.lat, c.lon, d.lat, d.lon);

console.log(distance);

//*/
