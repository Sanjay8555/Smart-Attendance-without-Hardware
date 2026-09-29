// Geolocation and GPS Geofence utility

export function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
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

export function getDeviceCoordinates() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      return reject(new Error('Geolocation is not supported by your browser.'));
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          isSimulated: false
        });
      },
      (err) => {
        let msg = 'Unable to retrieve location.';
        if (err.code === err.PERMISSION_DENIED) msg = 'Location permission was denied. Please allow location access.';
        else if (err.code === err.POSITION_UNAVAILABLE) msg = 'Location information is unavailable.';
        else if (err.code === err.TIMEOUT) msg = 'Location request timed out.';
        reject(new Error(msg));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });
}

// Preset coordinates for realistic testing
export const SIMULATED_LOCATIONS = {
  INSIDE_CLASSROOM: {
    name: 'Classroom CS-301 (Inside Quad)',
    latitude: 12.971610,
    longitude: 77.594575,
    description: 'Inside allowed 150m geofence radius (approx 15m from center)'
  },
  CAMPUS_EDGE: {
    name: 'Campus Gate 2 (Boundary)',
    latitude: 12.972300,
    longitude: 77.595100,
    description: 'Near boundary (~110m away, valid if radius is 150m)'
  },
  OUTSIDE_CAMPUS: {
    name: 'Off-Campus Coffee Shop (Breach)',
    latitude: 12.976000,
    longitude: 77.599000,
    description: 'Violates geofence (~680m away from authorized quad)'
  }
};
