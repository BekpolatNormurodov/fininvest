import { useQuery } from '@tanstack/react-query';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '@credit-core/api-client';
import { Skeleton } from '../components/primitives';

/** A brand pin with the collector's initials — avoids Leaflet's broken default marker asset. */
function pin(name: string): L.DivIcon {
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  return L.divIcon({
    className: '',
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -32],
    html: `<div style="width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#0F5FA6;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center">
             <span style="transform:rotate(45deg);color:#fff;font-size:11px;font-weight:700;font-family:sans-serif">${initials}</span>
           </div>`,
  });
}

const TASHKENT: [number, number] = [41.3111, 69.2797];

export function LiveMapPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['workLive'],
    queryFn: () => api.workLive(),
    refetchInterval: 15_000,
  });
  const points = data ?? [];
  const center: [number, number] = points.length ? [points[0].lat, points[0].lng] : TASHKENT;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Jonli xarita</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {isLoading ? 'Yuklanmoqda…' : `${points.length} undiruvchi ishda`} · har 15 soniyada yangilanadi
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success-50 px-3 py-1 text-xs font-medium text-success-700 dark:bg-success-500/10 dark:text-success-400">
          <span className="h-2 w-2 animate-pulse rounded-full bg-success-500" /> Jonli
        </span>
      </div>

      {isLoading ? (
        <Skeleton className="h-[70vh] rounded-2xl" />
      ) : (
        <div className="h-[72vh] overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
          <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
            <TileLayer
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            {points.map((p) => (
              <Marker key={p.collectorId} position={[p.lat, p.lng]} icon={pin(p.name)}>
                <Popup>
                  <div className="text-sm">
                    <b>{p.name}</b>
                    <br />
                    Ishga chiqqan: {new Date(p.since).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    <br />
                    Oxirgi: {new Date(p.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    <br />
                    <a href={`https://www.google.com/maps?q=${p.lat},${p.lng}`} target="_blank" rel="noopener noreferrer">
                      Google Maps
                    </a>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}
    </div>
  );
}
