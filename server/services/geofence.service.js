/**
 * Haversine formula to calculate accurate great-circle distance between two points in meters
 */
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Radius of Earth in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

function verifyGeofence(studentLat, studentLng, location) {
  if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
    return {
      isValid: false,
      distanceMeters: null,
      allowedRadius: 0,
      locationName: 'Unknown',
      message: 'Invalid authorized campus location configured.'
    };
  }

  const sLat = parseFloat(studentLat);
  const sLng = parseFloat(studentLng);

  if (isNaN(sLat) || isNaN(sLng)) {
    return {
      isValid: false,
      distanceMeters: null,
      allowedRadius: location.radius_meters || 100,
      locationName: location.name,
      message: 'Invalid GPS coordinates received from device.'
    };
  }

  const distance = calculateDistanceMeters(sLat, sLng, location.latitude, location.longitude);
  const allowedRadius = location.radius_meters || 100;
  const isValid = distance <= allowedRadius;

  return {
    isValid,
    distanceMeters: distance,
    allowedRadius,
    locationName: location.name,
    message: isValid
      ? `Location verified (${distance}m within authorized ${allowedRadius}m radius)`
      : `Location rejected (${distance}m away, exceeds authorized ${allowedRadius}m radius)`
  };
}

module.exports = {
  calculateDistanceMeters,
  verifyGeofence
};
