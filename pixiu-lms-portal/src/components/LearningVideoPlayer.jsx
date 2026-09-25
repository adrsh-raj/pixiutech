import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { API_BASE } from '../config/api';
import { apiFetch } from '../context/AuthContext';

export default function LearningVideoPlayer({ material, onClose }) {
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const getPlaybackUrl = async () => {
    const id = encodeURIComponent(String(material?.id || ''));
    if (!id) throw new Error('Learning video ID is missing.');
    const response = await apiFetch('/content/' + id + '/playback', { cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.video_url) {
      throw new Error(payload?.detail || payload?.error || 'Unable to start secure video playback.');
    }
    const playbackPath = String(payload.video_url || '').trim();
    try {
      return new URL(playbackPath, `${API_BASE}/`).toString();
    } catch {
      throw new Error('Invalid secure video playback URL.');
    }
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const url = await getPlaybackUrl();
        if (!active) return;
        setVideoUrl(url);
      } catch (err) {
        if (active) setError(err?.message || 'Unable to play this video.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [material?.id]);

  useEffect(() => {
    const closeOnEscape = event => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  useEffect(() => {
    const preventSave = event => {
      if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === 's') {
        event.preventDefault();
      }
    };
    window.addEventListener('keydown', preventSave);
    return () => window.removeEventListener('keydown', preventSave);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={material?.title || 'Learning video'}
      onContextMenu={event => event.preventDefault()}
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div className="w-full max-w-6xl max-h-[95dvh] rounded-2xl overflow-hidden border border-slate-700 bg-slate-950 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-800 bg-slate-950">
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-black text-white truncate">{material?.title || 'Learning video'}</h2>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800" aria-label="Close video">
            <X size={18} />
          </button>
        </div>

        <div className="aspect-video bg-black flex items-center justify-center">
          {loading && (
            <div className="flex items-center gap-2 text-slate-300 text-sm">
              <Loader2 size={18} className="animate-spin" />
              Starting secure playback…
            </div>
          )}

          {!loading && error && (
            <div className="max-w-md px-6 text-center">
              <AlertTriangle size={28} className="mx-auto text-amber-400" />
              <p className="mt-3 text-sm font-semibold text-white">{error}</p>
              <p className="mt-1 text-xs text-slate-400">Your account may not have access to this learning video.</p>
            </div>
          )}

          {!loading && !error && videoUrl && (
            <video
              key={videoUrl}
              src={videoUrl}
              className="w-full h-full"
              controls
              playsInline
              preload="metadata"
              controlsList="nodownload noplaybackrate noremoteplayback"
              disablePictureInPicture
              onContextMenu={event => event.preventDefault()}
              onError={() => setError('This playback session expired or the video could not be streamed. Please reopen the video.')}
            />
          )}
        </div>

      </div>
    </div>
  );
}
