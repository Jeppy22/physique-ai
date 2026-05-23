'use client';

import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type {
  PhotoMediaType,
  PhysiquePhoto,
  PhysiquePose,
} from '@/lib/types';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED: PhotoMediaType[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

const POSES: PhysiquePose[] = ['front', 'side', 'back'];

interface PhotoUploadPanelProps {
  photos: PhysiquePhoto[];
  onChange: (photos: PhysiquePhoto[]) => void;
  onClose: () => void;
}

function readFileAsPhoto(file: File, pose: PhysiquePose): Promise<PhysiquePhoto> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Unexpected file reader result.'));
        return;
      }
      const commaIdx = result.indexOf(',');
      if (commaIdx === -1) {
        reject(new Error('Malformed data URL.'));
        return;
      }
      const base64 = result.slice(commaIdx + 1);
      resolve({
        pose,
        dataUrl: result,
        base64,
        mediaType: file.type as PhotoMediaType,
        sizeBytes: file.size,
      });
    };
    reader.readAsDataURL(file);
  });
}

function PoseSlot({
  pose,
  photo,
  onPick,
  onRemove,
}: {
  pose: PhysiquePose;
  photo: PhysiquePhoto | undefined;
  onPick: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-1">
      <span
        className="text-[10px] font-bold uppercase text-terminal-amber"
        style={{ letterSpacing: '0.15em' }}
      >
        {pose}
      </span>
      <div
        className={cn(
          'relative h-40 w-[120px] border bg-terminal-black',
          photo
            ? 'border-terminal-border'
            : 'border-dashed border-terminal-border-bright',
        )}
      >
        {photo ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.dataUrl}
              alt={`${pose} pose`}
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={onRemove}
              className="absolute right-1 top-1 bg-terminal-black/80 px-1 text-[10px] font-bold text-terminal-red transition-colors hover:brightness-125"
              style={{ letterSpacing: '0.1em' }}
              aria-label={`Remove ${pose} photo`}
            >
              [X]
            </button>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="absolute inset-0 cursor-pointer bg-transparent"
              aria-label={`Replace ${pose} photo`}
            />
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-full w-full items-center justify-center text-[11px] uppercase text-terminal-text-dim transition-colors hover:text-terminal-amber"
            style={{ letterSpacing: '0.15em' }}
          >
            + UPLOAD
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED.join(',')}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onPick(file);
            e.target.value = ''; // allow re-picking the same file
          }}
        />
      </div>
    </div>
  );
}

export function PhotoUploadPanel({
  photos,
  onChange,
  onClose,
}: PhotoUploadPanelProps) {
  const [error, setError] = useState<string | null>(null);

  function setPhoto(next: PhysiquePhoto) {
    onChange([...photos.filter((p) => p.pose !== next.pose), next]);
  }

  function removePhoto(pose: PhysiquePose) {
    onChange(photos.filter((p) => p.pose !== pose));
  }

  async function handlePick(file: File, pose: PhysiquePose) {
    setError(null);
    if (!ALLOWED.includes(file.type as PhotoMediaType)) {
      setError('UNSUPPORTED IMAGE FORMAT — USE JPEG / PNG / WEBP / GIF');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('IMAGE EXCEEDS 5MB LIMIT');
      return;
    }
    try {
      const photo = await readFileAsPhoto(file, pose);
      setPhoto(photo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'FAILED TO READ IMAGE');
    }
  }

  return (
    <div className="border border-terminal-border bg-terminal-bg-elevated p-3">
      <div className="mb-2 flex items-center justify-between">
        <span
          className="text-[11px] font-bold uppercase text-terminal-amber"
          style={{ letterSpacing: '0.15em' }}
        >
          &gt; UPLOAD_PHYSIQUE_PHOTOS
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-[11px] font-bold uppercase text-terminal-text-dim transition-colors hover:text-terminal-amber"
          style={{ letterSpacing: '0.15em' }}
          aria-label="Close photo upload panel"
        >
          [X]
        </button>
      </div>

      <div
        className="mb-3 text-[10px] uppercase text-terminal-text-dim"
        style={{ letterSpacing: '0.1em' }}
      >
        PHOTOS ARE SENT TO ANTHROPIC API FOR THIS REQUEST ONLY. NOT STORED. NOT USED FOR TRAINING.
      </div>

      <div className="flex flex-wrap gap-3">
        {POSES.map((pose) => {
          const photo = photos.find((p) => p.pose === pose);
          return (
            <PoseSlot
              key={pose}
              pose={pose}
              photo={photo}
              onPick={(file) => handlePick(file, pose)}
              onRemove={() => removePhoto(pose)}
            />
          );
        })}
      </div>

      <div
        className="mt-3 text-[10px] uppercase text-terminal-text-dim"
        style={{ letterSpacing: '0.1em' }}
      >
        RECOMMENDED: NEUTRAL POSE, CONSISTENT LIGHTING, MINIMAL BACKGROUND CLUTTER.
      </div>
      <div
        className="mt-1 text-[10px] uppercase text-terminal-text-faint"
        style={{ letterSpacing: '0.1em' }}
      >
        ENTER A QUESTION OR REQUEST WITH YOUR PHOTOS, E.G. &quot;HOW AM I LOOKING FOR MY CUT?&quot;
      </div>

      {error && (
        <div
          className="mt-3 text-[11px] font-bold uppercase text-terminal-red"
          style={{ letterSpacing: '0.1em' }}
          role="alert"
        >
          [ERROR] {error}
        </div>
      )}
    </div>
  );
}

export default PhotoUploadPanel;
