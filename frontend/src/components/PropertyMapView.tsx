import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  IconButton,
  Button,
  ButtonGroup
} from '@mui/material';
import {
  MyLocation,
  Add,
  Remove,
  Edit,
  Delete,
  Search,
  Close
} from '@mui/icons-material';

interface PropertyMapViewProps {
  properties: any[];
  isLoading: boolean;
  onMapSearch: (params: any) => void;
  onPropertySelect: (property: any) => void;
  filters: any;
}

const PropertyMapView: React.FC<PropertyMapViewProps> = ({
  properties,
  isLoading,
  onMapSearch,
  onPropertySelect,
  filters
}) => {
  // Map state
  const mapRef = useRef(null);
  const [map, setMap] = useState<any>(null);
  const [markers, setMarkers] = useState<any[]>([]);
  const [drawingManager, setDrawingManager] = useState<any>(null);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [polygonCoordinates, setPolygonCoordinates] = useState<any[]>([]);
  const [currentPolygon, setCurrentPolygon] = useState<any>(null);

  // Initialize the map when component mounts
  useEffect(() => {
    // Check if Google Maps API is loaded
    if (window.google && window.google.maps && mapRef.current && !map) {
      initializeMap();
    } else if (!window.google || !window.google.maps) {
      // Load Google Maps API dynamically if not loaded
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}&libraries=drawing,places`;
      script.onload = initializeMap;
      document.head.appendChild(script);
    }
  }, []);

  // Update markers when properties change
  useEffect(() => {
    if (map && properties && properties.length > 0) {
      // Clear existing markers
      markers.forEach(marker => marker.setMap(null));
      
      const newMarkers = properties.map(property => {
        const position = {
          lat: parseFloat(property.latitude),
          lng: parseFloat(property.longitude)
        };
        
        if (isNaN(position.lat) || isNaN(position.lng)) {
          return null;
        }
        
        const marker = new window.google.maps.Marker({
          position,
          map,
          title: property.address,
          animation: window.google.maps.Animation.DROP
        });
        
        // Add click listener
        marker.addListener('click', () => {
          onPropertySelect(property);
        });
        
        // Add info window
        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div>
              <strong>${property.address}</strong><br/>
              ${property.city}, ${property.state} ${property.zipCode}<br/>
              ${property.bedrooms} beds, ${property.bathrooms} baths<br/>
              <strong>$${(property.estimatedValue || 0).toLocaleString()}</strong>
            </div>
          `
        });
        
        marker.addListener('mouseover', () => {
          infoWindow.open(map, marker);
        });
        
        marker.addListener('mouseout', () => {
          infoWindow.close();
        });
        
        return marker;
      }).filter(Boolean);
      
      setMarkers(newMarkers);
      
      // Fit bounds to markers if there are any
      if (newMarkers.length > 0) {
        const bounds = new window.google.maps.LatLngBounds();
        newMarkers.forEach(marker => bounds.extend(marker.getPosition()));
        map.fitBounds(bounds);
        
        // If only one marker, zoom in appropriately
        if (newMarkers.length === 1) {
          map.setZoom(16);
        }
      }
    }
  }, [map, properties]);

  // Initialize Google Maps
  const initializeMap = () => {
    if (!mapRef.current) return;
    
    // Default center (US)
    const defaultCenter = { lat: 39.8283, lng: -98.5795 };
    
    // Create map instance
    const mapInstance = new window.google.maps.Map(mapRef.current, {
      center: defaultCenter,
      zoom: 4,
      mapTypeControl: true,
      streetViewControl: true,
      fullscreenControl: true,
      gestureHandling: 'cooperative'
    });
    
    setMap(mapInstance);
    
    // Initialize drawing manager
    const drawingManagerInstance = new window.google.maps.drawing.DrawingManager({
      drawingMode: null,
      drawingControl: false,
      polygonOptions: {
        strokeColor: '#1976d2',
        strokeWeight: 2,
        fillColor: '#1976d2',
        fillOpacity: 0.2,
        editable: true,
        draggable: true
      }
    });
    
    drawingManagerInstance.setMap(mapInstance);
    setDrawingManager(drawingManagerInstance);
    
    // Add polygon complete listener
  window.google.maps.event.addListener(drawingManagerInstance, 'polygoncomplete', (polygon: any) => {
      // Exit drawing mode
      drawingManagerInstance.setDrawingMode(null);
      setIsDrawingMode(false);
      
      // Store the polygon and coordinates
      setCurrentPolygon(polygon);
      
      // Get polygon coordinates
      const path = polygon.getPath();
      const coords = [];
      for (let i = 0; i < path.getLength(); i++) {
        const point = path.getAt(i);
        coords.push({
          lat: point.lat(),
          lng: point.lng()
        });
      }
      
      setPolygonCoordinates(coords);
      
      // Perform search with polygon
      onMapSearch({ polygon: coords });
      
      // Add listeners for when polygon is modified
      window.google.maps.event.addListener(polygon.getPath(), 'set_at', updatePolygonCoordinates);
      window.google.maps.event.addListener(polygon.getPath(), 'insert_at', updatePolygonCoordinates);
      
      function updatePolygonCoordinates() {
        const newCoords = [];
        const updatedPath = polygon.getPath();
        
        for (let i = 0; i < updatedPath.getLength(); i++) {
          const point = updatedPath.getAt(i);
          newCoords.push({
            lat: point.lat(),
            lng: point.lng()
          });
        }
        
        setPolygonCoordinates(newCoords);
      }
    });
  };

  // Toggle drawing mode
  const toggleDrawingMode = () => {
    if (!drawingManager) return;
    
    if (isDrawingMode) {
      drawingManager.setDrawingMode(null);
      setIsDrawingMode(false);
    } else {
      drawingManager.setDrawingMode(window.google.maps.drawing.OverlayType.POLYGON);
      setIsDrawingMode(true);
    }
  };

  // Clear polygon
  const clearPolygon = () => {
    if (currentPolygon) {
      currentPolygon.setMap(null);
      setCurrentPolygon(null);
      setPolygonCoordinates([]);
    }
  };

  // Get user's current location
  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          
          map.setCenter(userLocation);
          map.setZoom(14);
          
          // Add marker for user location
          new window.google.maps.Marker({
            position: userLocation,
            map,
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: '#4285F4',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2
            },
            title: 'Your Location'
          });
          
          // Search properties in this area
          onMapSearch({
            latitude: userLocation.lat,
            longitude: userLocation.lng,
            radius: 1 // 1 mile radius
          });
        },
        (error) => {
          console.error('Error getting user location:', error);
        }
      );
    }
  };

  // Search in visible map area
  const searchInVisibleArea = () => {
    if (!map) return;
    
    const bounds = map.getBounds();
    const center = map.getCenter();
    
    if (bounds && center) {
      // Calculate approximate radius based on bounds
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      
      const centerLat = center.lat();
      const centerLng = center.lng();
      
      // Calculate distance from center to northeast corner (in miles)
      const radius = window.google.maps.geometry.spherical.computeDistanceBetween(
        new window.google.maps.LatLng(centerLat, centerLng),
        new window.google.maps.LatLng(ne.lat(), ne.lng())
      ) / 1609.34; // Convert meters to miles
      
      onMapSearch({
        latitude: centerLat,
        longitude: centerLng,
        radius: Math.min(25, radius) // Cap radius at 25 miles to avoid too many results
      });
    }
  };

  return (
    <Box sx={{ position: 'relative', height: '600px', width: '100%' }}>
      {/* Map Controls */}
      <Box
        sx={{
          position: 'absolute',
          top: 10,
          left: 10,
          zIndex: 1,
          backgroundColor: 'white',
          borderRadius: 1,
          boxShadow: 1,
          p: 1
        }}
      >
        <ButtonGroup orientation="vertical" variant="contained" size="small">
          <IconButton onClick={() => map?.setZoom((map.getZoom() || 0) + 1)}>
            <Add />
          </IconButton>
          <IconButton onClick={() => map?.setZoom((map.getZoom() || 0) - 1)}>
            <Remove />
          </IconButton>
          <IconButton onClick={getUserLocation} title="Your Location">
            <MyLocation />
          </IconButton>
        </ButtonGroup>
      </Box>
      
      {/* Drawing Controls */}
      <Box
        sx={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 1,
          backgroundColor: 'white',
          borderRadius: 1,
          boxShadow: 1,
          p: 1
        }}
      >
        <ButtonGroup variant="contained" size="small">
          <Button
            color={isDrawingMode ? 'secondary' : 'primary'}
            onClick={toggleDrawingMode}
            startIcon={<Edit />}
            title="Draw Polygon"
          >
            Draw Area
          </Button>
          <Button
            onClick={clearPolygon}
            startIcon={<Delete />}
            disabled={!currentPolygon}
            title="Clear Polygon"
          >
            Clear
          </Button>
          <Button
            onClick={searchInVisibleArea}
            startIcon={<Search />}
            title="Search in Current View"
          >
            Search View
          </Button>
        </ButtonGroup>
        
        {isDrawingMode && (
          <Paper sx={{ mt: 1, p: 1, backgroundColor: '#f8f9fa' }}>
            <Typography variant="caption">
              Click on the map to start drawing a search area.
              Double-click to complete the polygon.
            </Typography>
          </Paper>
        )}
      </Box>
      
      {/* Map Container */}
      <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
      
      {/* Loading Overlay */}
      {isLoading && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255,255,255,0.7)',
            zIndex: 2
          }}
        >
          <Paper sx={{ p: 2, display: 'flex', alignItems: 'center' }}>
            <CircularProgress size={24} sx={{ mr: 1 }} />
            <Typography>Searching properties...</Typography>
          </Paper>
        </Box>
      )}
    </Box>
  );
};

export default PropertyMapView;
