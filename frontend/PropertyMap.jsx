import React, { useState, useEffect } from 'react';
import { Box, CircularProgress, Typography, Paper, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { Map, Layers, Satellite } from '@mui/icons-material';

/**
 * PropertyMap component to display a property on a map
 * Uses the Google Maps API
 * 
 * @param {Object} props
 * @param {number} props.latitude - Property latitude
 * @param {number} props.longitude - Property longitude
 * @param {string} props.address - Property address
 * @param {boolean} props.showControls - Whether to show map controls
 * @param {boolean} props.showSatellite - Whether to show satellite view option
 * @returns {JSX.Element}
 */
const PropertyMap = ({ 
  latitude, 
  longitude, 
  address, 
  showControls = false,
  showSatellite = false
}) => {
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(null);
  const [mapType, setMapType] = useState('roadmap');
  
  const handleMapTypeChange = (event, newMapType) => {
    if (newMapType !== null) {
      setMapType(newMapType);
    }
  };
  
  useEffect(() => {
    // Function to load Google Maps API script
    const loadGoogleMapsApi = () => {
      const googleMapScript = document.createElement('script');
      googleMapScript.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}&libraries=places`;
      googleMapScript.async = true;
      googleMapScript.defer = true;
      googleMapScript.addEventListener('load', () => {
        setMapLoaded(true);
      });
      googleMapScript.addEventListener('error', () => {
        setMapError('Failed to load Google Maps API');
      });
      document.body.appendChild(googleMapScript);
    };
    
    // Check if Google Maps API is already loaded
    if (!window.google || !window.google.maps) {
      loadGoogleMapsApi();
    } else {
      setMapLoaded(true);
    }
  }, []);
  
  useEffect(() => {
    // Initialize map once API is loaded and coordinates are available
    if (mapLoaded && latitude && longitude) {
      const propertyLocation = { lat: latitude, lng: longitude };
      const mapOptions = {
        center: propertyLocation,
        zoom: 16,
        mapTypeId: mapType,
        mapTypeControl: false,
        streetViewControl: showControls,
        zoomControl: showControls,
        fullscreenControl: showControls,
      };
      
      const map = new window.google.maps.Map(
        document.getElementById('property-map'), 
        mapOptions
      );
      
      // Add marker for property
      new window.google.maps.Marker({
        position: propertyLocation,
        map,
        title: address || 'Property Location',
        animation: window.google.maps.Animation.DROP,
      });
    }
  }, [mapLoaded, latitude, longitude, address, mapType, showControls]);
  
  // If coordinates not provided
  if (!latitude || !longitude) {
    return (
      <Paper elevation={0} sx={{ p: 2, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Map coordinates not available for this property.
        </Typography>
      </Paper>
    );
  }
  
  // If there was an error loading the API
  if (mapError) {
    return (
      <Paper elevation={0} sx={{ p: 2, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="body2" color="error">
          {mapError}
        </Typography>
      </Paper>
    );
  }
  
  return (
    <Box sx={{ position: 'relative', height: '100%', width: '100%' }}>
      {/* Loading indicator */}
      {!mapLoaded && (
        <Box sx={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0,
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          bgcolor: 'background.paper',
          zIndex: 1,
        }}>
          <CircularProgress size={40} />
        </Box>
      )}
      
      {/* Map type selector */}
      {showSatellite && (
        <Box sx={{ 
          position: 'absolute', 
          top: 10, 
          right: 10, 
          zIndex: 10,
          bgcolor: 'background.paper',
          borderRadius: 1,
          boxShadow: 1,
        }}>
          <ToggleButtonGroup
            value={mapType}
            exclusive
            onChange={handleMapTypeChange}
            size="small"
            aria-label="map type"
          >
            <ToggleButton value="roadmap" aria-label="map view">
              <Map fontSize="small" />
            </ToggleButton>
            <ToggleButton value="satellite" aria-label="satellite view">
              <Satellite fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      )}
      
      {/* The map container */}
      <div 
        id="property-map" 
        style={{ 
          height: '100%', 
          width: '100%', 
          borderRadius: '4px',
        }}
      />
    </Box>
  );
};

export default PropertyMap;
