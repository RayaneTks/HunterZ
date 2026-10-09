// Conservative launch value for showing an indicative state, not a calibrated safety bound.
const MAX_ZONE_CHECK_ACCURACY_METERS = 100;

function distanceMeters(a, b) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const latitudeDelta = radians(b.latitude - a.latitude);
  const longitudeDelta = radians(b.longitude - a.longitude);
  const latitudeA = radians(a.latitude);
  const latitudeB = radians(b.latitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371008.8 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function getZoneState(location, zone) {
  if (!zone) return 'undefined';
  if (!location) return 'no-signal';
  if (!Number.isFinite(location.accuracy) || location.accuracy < 0 || location.accuracy > MAX_ZONE_CHECK_ACCURACY_METERS) {
    return 'uncertain';
  }

  const distance = distanceMeters(
    { latitude: location.latitude, longitude: location.longitude },
    { latitude: zone.latitude, longitude: zone.longitude },
  );
  const accuracy = location.accuracy;
  if (distance + accuracy < zone.radiusMeters) return 'inside';
  if (distance - accuracy > zone.radiusMeters) return 'outside';
  return 'edge';
}

module.exports = { distanceMeters, getZoneState };
