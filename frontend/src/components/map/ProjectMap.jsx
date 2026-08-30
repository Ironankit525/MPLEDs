import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

/**
 * Interactive OpenStreetMap component using Leaflet with custom red pin marker
 */
export default function ProjectMap({
  latitude = 25.7011,
  longitude = 84.741,
  zoom = 13,
  projectName = 'Community Hall Construction',
  locationDetails = 'Village: Sonpur, Block: Sonpur, District: Saran, Bihar - 841101',
}) {
  const mapContainerRef = useRef(null)
  const mapInstanceRef = useRef(null)

  useEffect(() => {
    if (!mapContainerRef.current) return

    // Clean up previous map instance if any
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove()
    }

    try {
      const map = L.map(mapContainerRef.current, {
        center: [latitude, longitude],
        zoom: zoom,
        zoomControl: false,
        attributionControl: false,
      })

      // Add Zoom Control at top right
      L.control.zoom({ position: 'topright' }).addTo(map)

      // Add Clean Standard OpenStreetMap Tile Layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: 'abc',
      }).addTo(map)

      // Custom Red Pin Marker
      const customPinIcon = L.divIcon({
        className: 'custom-map-pin',
        html: `
          <div style="transform: translate(-15px, -36px); filter: drop-shadow(0 3px 6px rgba(0,0,0,0.3)); cursor: pointer;">
            <svg width="30" height="38" viewBox="0 0 30 38" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 0C6.71573 0 0 6.71573 0 15C0 25.5 15 38 15 38C15 38 30 25.5 30 15C30 6.71573 23.2843 0 15 0Z" fill="#DC2626"/>
              <circle cx="15" cy="14" r="6" fill="white"/>
            </svg>
          </div>
        `,
        iconSize: [30, 38],
        iconAnchor: [0, 0],
        popupAnchor: [0, -36],
      })

      const marker = L.marker([latitude, longitude], { icon: customPinIcon }).addTo(map)

      marker.bindPopup(`
        <div class="map-popup-content">
          <strong class="map-popup-title" style="color:#0f172a;font-size:12px;font-weight:700;">${projectName}</strong>
          <p class="map-popup-text" style="color:#64748b;font-size:11px;margin:2px 0 4px;">${locationDetails}</p>
          <span class="map-popup-coords" style="color:#2563eb;font-size:10px;font-weight:600;">${latitude.toFixed(4)}° N, ${longitude.toFixed(4)}° E</span>
        </div>
      `)

      mapInstanceRef.current = map
    } catch (err) {
      console.warn('Map initialization note:', err)
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [latitude, longitude, zoom, projectName, locationDetails])

  return (
    <div className="project-map-wrapper">
      <div ref={mapContainerRef} className="leaflet-map-container" />
    </div>
  )
}
