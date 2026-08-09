import React from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

interface LocationMapViewProps {
  targetName?: string;
  latitude?: number;
  longitude?: number;
  height?: number;
}

export default function LocationMapView({
  targetName = '슝슝슝',
  latitude = 37.5665,
  longitude = 126.9780,
  height = 180,
}: LocationMapViewProps) {
  const mapHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body, html, #map { width: 100%; height: 100%; margin: 0; padding: 0; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map', { zoomControl: false }).setView([${latitude}, ${longitude}], 16);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
          }).addTo(map);

          var marker = L.marker([${latitude}, ${longitude}]).addTo(map);
          marker.bindPopup("<b>${targetName}님 위치</b>").openPopup();
        </script>
      </body>
    </html>
  `;

  return (
    <View style={[styles.mapContainer, { height }]}>
      <WebView
        originWhitelist={['*']}
        source={{ html: mapHtml }}
        style={{ flex: 1 }}
        scrollEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    marginBottom: 28,
  },
});