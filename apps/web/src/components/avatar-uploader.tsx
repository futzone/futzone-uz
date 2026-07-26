'use client';

import { Button, Input, Label } from '@futzone/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { apiClient, ApiClientError, mapErrorCodeToMessage } from '@/lib/api';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function AvatarUploader({ currentUrl }: { currentUrl?: string | null }) {
  const t = useTranslations();
  const [preview, setPreview] = useState(currentUrl ?? null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => { if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview); }, [preview]);

  async function upload(file: File) {
    setError(null);
    if (!ALLOWED_TYPES.has(file.type) || file.size > MAX_AVATAR_BYTES) { setError(t('profile.avatarInvalid')); return; }
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setProgress(0);
    try {
      const { uploadUrl, objectKey } = await apiClient.presignAvatar(file.size);
      await new Promise<void>((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open('PUT', uploadUrl);
        request.setRequestHeader('Content-Type', file.type);
        request.setRequestHeader('Content-Length', String(file.size));
        request.upload.onprogress = ({ loaded, total }) => setProgress(total ? Math.round((loaded / total) * 100) : 0);
        request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error('upload'));
        request.onerror = () => reject(new Error('upload'));
        request.send(file);
      });
      await apiClient.completeAvatar(objectKey);
      setProgress(100);
    } catch (caught) {
      setError(caught instanceof ApiClientError ? mapErrorCodeToMessage(caught.code, t) : t('errors.INTERNAL_ERROR'));
      setProgress(null);
    }
  }

  return <div className="space-y-3">
    <Label htmlFor="avatar">{t('profile.avatar')}</Label>
    {preview ? <img src={preview} alt={t('profile.avatarPreview')} className="h-24 w-24 rounded-full object-cover" /> : null}
    <Input id="avatar" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
    {progress !== null ? <div aria-label={t('profile.uploadProgress')} className="h-2 overflow-hidden rounded bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div> : null}
    {progress === 100 ? <p className="text-sm text-muted-foreground">{t('profile.avatarProcessing')}</p> : null}
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    <Button type="button" variant="outline" className="hidden">{t('profile.uploadAvatar')}</Button>
  </div>;
}
