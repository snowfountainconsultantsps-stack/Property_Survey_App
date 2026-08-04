import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { WebView } from "react-native-webview";

// react-leaflet needs a real DOM, which native RN doesn't have — so the map
// is a self-contained Leaflet page (loaded from CDN) rendered inside a
// WebView, with feature data pushed in via postMessage and tap events
// bridged back out the same way.
function buildHtml() {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>html,body,#map{height:100%;margin:0;padding:0;background:#1a1a1a;}</style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const map = L.map('map').setView([20.5937, 78.9629], 15);

    // Satellite imagery — field surveyors need to recognise real rooftops and
    // ground features, which a street map can't show.
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Esri, Maxar, Earthstar Geographics',
      maxZoom: 21,
      maxNativeZoom: 19
    }).addTo(map);

    // Labels on top of the imagery so roads/place names stay readable.
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 21,
      maxNativeZoom: 19
    }).addTo(map);

    let userMarker = null;
    let featureLayer = null;

    // Only the chosen layer is actionable. Everything else is drawn thin and
    // faded purely as surrounding context, so what's actually surveyable —
    // and what's still pending — reads at a glance.
    const PENDING     = '#22c55e';
    const IN_PROGRESS = '#f59e0b';
    const FLAGGED     = '#ef4444';
    const DONE        = '#9ca3af';

    const isContext = (p) => p.selectable === false;
    const isDone = (p) => p.survey_state === 'DONE';
    const isStarted = (p) => p.survey_state === 'IN_PROGRESS';

    function colorFor(p) {
      if (isContext(p)) return p.layerColor || '#93c5fd';
      if (isDone(p)) return DONE;
      if (isStarted(p)) return IN_PROGRESS;
      return p.status === 'FLAGGED' ? FLAGGED : PENDING;
    }

    // A marker just for orientation — it never recenters/zooms the map,
    // since the point of this view is to show every asset, not just what's
    // nearby.
    function setUser(lat, lng) {
      const icon = L.divIcon({
        className: '',
        html: '<div style="width:16px;height:16px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 0 4px rgba(0,0,0,0.4)"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      if (userMarker) map.removeLayer(userMarker);
      userMarker = L.marker([lat, lng], { icon }).addTo(map).bindPopup('You are here');
    }

    function renderFeatures(fc) {
      if (featureLayer) map.removeLayer(featureLayer);
      featureLayer = L.geoJSON(fc, {
        pointToLayer: (feature, latlng) => {
          const p = feature.properties;
          const ctx = isContext(p);
          return L.circleMarker(latlng, {
            radius: ctx ? 4 : 8,
            color: ctx ? colorFor(p) : '#fff',
            weight: ctx ? 1 : 2,
            fillColor: colorFor(p),
            fillOpacity: ctx ? 0.45 : (isDone(p) ? 0.75 : 1)
          });
        },
        style: (feature) => {
          const p = feature.properties;
          const ctx = isContext(p);
          return {
            color: colorFor(p),
            weight: ctx ? 1.5 : 3,
            opacity: ctx ? 0.5 : 1,
            fillColor: colorFor(p),
            fillOpacity: ctx ? 0.08 : (isDone(p) ? 0.45 : isStarted(p) ? 0.35 : 0.2),
            dashArray: ctx ? null : (isDone(p) ? '5,4' : isStarted(p) ? '2,3' : null)
          };
        },
        onEachFeature: (feature, lyr) => {
          const p = feature.properties;
          const ctx = isContext(p);
          const title = (p.layerName || 'Asset') + (p.feature_code ? ' — ' + p.feature_code : '');
          let badge;
          if (ctx) {
            badge = '<div style="margin-top:6px;padding:3px 6px;background:#eff6ff;color:#1d4ed8;border-radius:4px;font-size:11px;font-weight:600;text-align:center">Context only — not this layer</div>';
          } else if (isDone(p)) {
            badge = '<div style="margin-top:6px;padding:3px 6px;background:#e5e7eb;color:#374151;border-radius:4px;font-size:11px;font-weight:600;text-align:center">✓ Survey already done</div>';
          } else if (isStarted(p)) {
            badge = '<div style="margin-top:6px;padding:3px 6px;background:#fef3c7;color:#92400e;border-radius:4px;font-size:11px;font-weight:600;text-align:center">In progress — tap to continue</div>';
          } else {
            badge = '<div style="margin-top:6px;padding:3px 6px;background:#dcfce7;color:#15803d;border-radius:4px;font-size:11px;font-weight:600;text-align:center">Tap to survey</div>';
          }
          lyr.bindPopup('<b>' + title + '</b>' + badge);
          lyr.on('click', () => {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              id: p.id,
              survey_state: p.survey_state || null,
              survey_id: p.survey_id || null,
              selectable: p.selectable !== false,
              layerName: p.layerName || null
            }));
          });
        },
      }).addTo(map);

      // Deliberately no auto-fit here. Features now arrive per viewport, so
      // fitting on every render would fire moveend → refetch → fit → … in a
      // loop. Framing is done once via an explicit 'fitExtent' message.
    }

    // Report the visible bounds so the app can fetch only what's on screen —
    // loading a whole city's features at once would hang this bridge.
    let reportTimer = null;
    function reportBounds() {
      clearTimeout(reportTimer);
      reportTimer = setTimeout(() => {
        const b = map.getBounds();
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'bounds',
          bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].join(','),
          zoom: map.getZoom()
        }));
      }, 400);
    }
    map.on('moveend', reportBounds);
    map.whenReady(reportBounds);

    function setView(lat, lng, zoom) {
      map.setView([lat, lng], zoom);
    }

    function fitExtent(ext) {
      try {
        map.fitBounds([[ext[1], ext[0]], [ext[3], ext[2]]], { padding: [20, 20], maxZoom: 17 });
      } catch (e) {}
    }

    function handleMessage(raw) {
      try {
        const msg = JSON.parse(raw);
        if (msg.type === 'user') setUser(msg.lat, msg.lng);
        if (msg.type === 'features') renderFeatures(msg.geojson);
        if (msg.type === 'fitExtent') fitExtent(msg.extent);
        if (msg.type === 'setView') setView(msg.lat, msg.lng, msg.zoom);
      } catch (e) {}
    }
    document.addEventListener('message', (e) => handleMessage(e.data));
    window.addEventListener('message', (e) => handleMessage(e.data));
  </script>
</body>
</html>
  `;
}

function LegendDot({ color, label, dashed }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginRight: 14 }}>
      <View
        style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: color,
          marginRight: 5,
          opacity: dashed ? 0.75 : 1,
        }}
      />
      <Text style={{ fontSize: 11, color: "#4b5563" }}>{label}</Text>
    </View>
  );
}

export default function NearbyMapView({
  userLocation,
  geojson,
  onSelectFeature,
  onBoundsChange,
  fitExtent,
  showLegend = true,
  showContextLegend = false,
}) {
  const webRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const html = useRef(buildHtml()).current;
  const framedRef = useRef(false);

  useEffect(() => {
    if (!loaded || !userLocation) return;
    webRef.current?.postMessage(JSON.stringify({ type: "user", lat: userLocation[0], lng: userLocation[1] }));
  }, [loaded, userLocation]);

  useEffect(() => {
    if (!loaded) return;
    webRef.current?.postMessage(JSON.stringify({ type: "features", geojson }));
  }, [loaded, geojson]);

  // Frame the layer once, as soon as its extent is known.
  useEffect(() => {
    if (!loaded || !fitExtent || framedRef.current) return;
    framedRef.current = true;
    webRef.current?.postMessage(JSON.stringify({ type: "fitExtent", extent: fitExtent }));
  }, [loaded, fitExtent]);

  return (
    <View style={{ flex: 1 }}>
      <WebView
        ref={webRef}
        originWhitelist={["*"]}
        source={{ html }}
        onLoadEnd={() => setLoaded(true)}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data?.type === "bounds") {
              onBoundsChange?.(data.bbox, data.zoom);
              return;
            }
            if (data?.id)
              onSelectFeature(data.id, {
                surveyState: data.survey_state || null,
                surveyId: data.survey_id || null,
                selectable: data.selectable !== false,
                layerName: data.layerName,
              });
          } catch {
            /* ignore */
          }
        }}
      />
      {showLegend && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#fff",
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderTopWidth: 1,
            borderTopColor: "#e5e7eb",
          }}
        >
          <LegendDot color="#22c55e" label="To survey" />
          <LegendDot color="#f59e0b" label="In progress" />
          <LegendDot color="#9ca3af" label="Done" dashed />
          <LegendDot color="#ef4444" label="Flagged" />
          {showContextLegend && <LegendDot color="#93c5fd" label="Other layers" dashed />}
        </View>
      )}
    </View>
  );
}
