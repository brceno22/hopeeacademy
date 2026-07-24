import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import api from '@/core/api/axios';
import { DEFAULT_AVATAR_COLOR, useAuth } from '@/core/context/AuthContext';
import { buildFileProxyUrl } from '@/core/utils/fileProxy';
import { useStudentLayout } from '@/layouts/StudentLayoutContext';
import './profile-page.css';

interface UserProfile {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  fullname: string;
  email: string;
  avatar: string | null;
  avatarColor: string;
}

const COLOR_PRESETS = ['#0071BC', '#F15A29', '#0F766E', '#7C3AED', '#BE123C', '#1E293B'];

function apiErrorMessage(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } })?.response
    ?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  if (typeof message === 'string' && message.trim()) return message;
  return fallback;
}

async function getCroppedBlob(
  imageSrc: string,
  pixelCrop: Area,
  mime = 'image/jpeg',
): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', reject);
    img.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  const size = Math.max(1, Math.round(Math.min(pixelCrop.width, pixelCrop.height)));
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    size,
    size,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not export crop'))),
      mime,
      0.92,
    );
  });
}

export const ProfilePage: React.FC = () => {
  const { user, updateStudentProfile } = useAuth();
  const { setHeaderTitle, clearHeaderTabs } = useStudentLayout();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');
  const [nameBusy, setNameBusy] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [croppedFile, setCroppedFile] = useState<File | null>(null);
  const [croppedPreview, setCroppedPreview] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [avatarBroken, setAvatarBroken] = useState(false);

  const [avatarColor, setAvatarColor] = useState(DEFAULT_AVATAR_COLOR);
  const [colorBusy, setColorBusy] = useState(false);
  const [colorMsg, setColorMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    setHeaderTitle('My profile');
    clearHeaderTabs();
  }, [setHeaderTitle, clearHeaderTabs]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError('');
      try {
        const { data } = await api.get<UserProfile>('/users/me');
        if (cancelled) return;
        setProfile(data);
        setFirstname(data.firstname || '');
        setLastname(data.lastname || '');
        setAvatarColor(data.avatarColor || DEFAULT_AVATAR_COLOR);
        setAvatarBroken(false);
        updateStudentProfile({
          fullName: data.fullname || undefined,
          avatarUrl: data.avatar || null,
          avatarColor: data.avatarColor || DEFAULT_AVATAR_COLOR,
        });
      } catch (err) {
        if (!cancelled) setLoadError(apiErrorMessage(err, 'Could not load your profile'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [updateStudentProfile]);

  const displayAvatar = useMemo(() => {
    if (croppedPreview) return croppedPreview;
    if (avatarBroken) return null;
    const raw = profile?.avatar;
    if (!raw || !user?.token) return null;
    return buildFileProxyUrl(raw, user.token);
  }, [croppedPreview, profile?.avatar, user?.token, avatarBroken]);

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.files?.[0] || null;
    e.target.value = '';
    setAvatarMsg(null);
    if (croppedPreview) URL.revokeObjectURL(croppedPreview);
    setCroppedPreview(null);
    setCroppedFile(null);
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    if (!next) {
      setCropSrc(null);
      return;
    }
    setCropSrc(URL.createObjectURL(next));
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const applyCrop = async () => {
    if (!cropSrc || !croppedAreaPixels) return;
    setAvatarMsg(null);
    try {
      const blob = await getCroppedBlob(cropSrc, croppedAreaPixels);
      const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
      if (croppedPreview) URL.revokeObjectURL(croppedPreview);
      setCroppedFile(file);
      setCroppedPreview(URL.createObjectURL(blob));
      URL.revokeObjectURL(cropSrc);
      setCropSrc(null);
    } catch {
      setAvatarMsg({ type: 'err', text: 'Could not crop image' });
    }
  };

  const cancelCrop = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  };

  const submitName = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameMsg(null);
    setNameBusy(true);
    try {
      const { data } = await api.patch<UserProfile>('/users/me', { firstname, lastname });
      setProfile(data);
      updateStudentProfile({ fullName: data.fullname });
      setNameMsg({ type: 'ok', text: 'Display name updated.' });
    } catch (err) {
      setNameMsg({ type: 'err', text: apiErrorMessage(err, 'Could not update name') });
    } finally {
      setNameBusy(false);
    }
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (newPassword.length < 8) {
      setPwMsg({ type: 'err', text: 'New password must be at least 8 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMsg({ type: 'err', text: 'New password and confirmation do not match.' });
      return;
    }
    setPwBusy(true);
    try {
      const { data } = await api.patch<{ message: string }>('/users/me/password', {
        currentPassword,
        newPassword,
      });
      setPwMsg({ type: 'ok', text: data.message || 'Password updated successfully.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPwMsg({ type: 'err', text: apiErrorMessage(err, 'Could not update password') });
    } finally {
      setPwBusy(false);
    }
  };

  const submitAvatar = async (e: React.FormEvent) => {
    e.preventDefault();
    setAvatarMsg(null);
    if (!croppedFile) {
      setAvatarMsg({ type: 'err', text: 'Crop and confirm a photo first.' });
      return;
    }
    setAvatarBusy(true);
    try {
      const form = new FormData();
      form.append('file', croppedFile);
      const { data } = await api.post<{ avatar: string | null; message: string }>(
        '/users/me/avatar',
        form,
      );
      setProfile((prev) =>
        prev
          ? { ...prev, avatar: data.avatar }
          : prev,
      );
      updateStudentProfile({ avatarUrl: data.avatar });
      setAvatarBroken(false);
      setAvatarMsg({ type: 'ok', text: data.message || 'Profile photo updated.' });
      setCroppedFile(null);
      if (croppedPreview) URL.revokeObjectURL(croppedPreview);
      setCroppedPreview(null);
    } catch (err) {
      setAvatarMsg({ type: 'err', text: apiErrorMessage(err, 'Could not upload photo') });
    } finally {
      setAvatarBusy(false);
    }
  };

  const removeAvatar = async () => {
    setAvatarMsg(null);
    setAvatarBusy(true);
    try {
      await api.delete('/users/me/avatar');
      setProfile((prev) => (prev ? { ...prev, avatar: null } : prev));
      updateStudentProfile({ avatarUrl: null });
      setAvatarBroken(false);
      setAvatarMsg({ type: 'ok', text: 'Profile photo removed.' });
    } catch (err) {
      setAvatarMsg({ type: 'err', text: apiErrorMessage(err, 'Could not remove photo') });
    } finally {
      setAvatarBusy(false);
    }
  };

  const saveColor = async (color: string) => {
    setAvatarColor(color);
    setColorMsg(null);
    setColorBusy(true);
    try {
      const { data } = await api.patch<UserProfile>('/users/me/prefs', { avatarColor: color });
      setProfile((prev) => (prev ? { ...prev, avatarColor: data.avatarColor } : prev));
      updateStudentProfile({ avatarColor: data.avatarColor });
      setColorMsg({ type: 'ok', text: 'Initial color saved.' });
    } catch (err) {
      setColorMsg({ type: 'err', text: apiErrorMessage(err, 'Could not save color') });
    } finally {
      setColorBusy(false);
    }
  };

  if (loading) {
    return <div className="profile-page profile-muted">Loading profile…</div>;
  }

  if (loadError || !profile) {
    return <div className="profile-page profile-error">{loadError || 'Profile unavailable'}</div>;
  }

  const showInitial = !displayAvatar;

  return (
    <div className="profile-page">
      <section className="profile-card">
        <h3>Account</h3>
        <p className="profile-hint">Your login username is set by the academy and cannot be changed here.</p>

        <div className="profile-identity">
          <div className="profile-avatar-wrap">
            {displayAvatar ? (
              <img
                src={displayAvatar}
                alt=""
                className="profile-avatar-img"
                onError={() => setAvatarBroken(true)}
              />
            ) : (
              <div
                className="profile-avatar-fallback"
                style={{ background: avatarColor }}
              >
                {(profile.fullname || firstname || 'S').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <dl className="profile-fields">
            <div>
              <dt>Username</dt>
              <dd>{profile.username}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{profile.email || '—'}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="profile-card">
        <h3>Display name</h3>
        <form className="profile-form" onSubmit={submitName}>
          <label>
            First name
            <input
              type="text"
              value={firstname}
              onChange={(e) => setFirstname(e.target.value)}
              required
              disabled={nameBusy}
            />
          </label>
          <label>
            Last name
            <input
              type="text"
              value={lastname}
              onChange={(e) => setLastname(e.target.value)}
              required
              disabled={nameBusy}
            />
          </label>
          {nameMsg && (
            <p className={nameMsg.type === 'ok' ? 'profile-ok' : 'profile-error'}>{nameMsg.text}</p>
          )}
          <button type="submit" className="profile-btn" disabled={nameBusy}>
            {nameBusy ? 'Saving…' : 'Save name'}
          </button>
        </form>
      </section>

      <section className="profile-card">
        <h3>Profile photo</h3>
        <p className="profile-hint">
          Optional. Choose an image, crop and center it, then upload. JPEG/PNG/GIF/WebP up to 2 MB.
        </p>

        <label className="profile-file-label">
          Choose image
          <input
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={onPickFile}
            disabled={avatarBusy || !!cropSrc}
          />
        </label>

        {cropSrc && (
          <div className="profile-cropper">
            <div className="profile-cropper-stage">
              <Cropper
                image={cropSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            <label className="profile-zoom">
              Zoom
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
              />
            </label>
            <div className="profile-cropper-actions">
              <button type="button" className="profile-btn secondary" onClick={cancelCrop}>
                Cancel
              </button>
              <button type="button" className="profile-btn" onClick={applyCrop}>
                Apply crop
              </button>
            </div>
          </div>
        )}

        <form className="profile-form" onSubmit={submitAvatar}>
          {avatarMsg && (
            <p className={avatarMsg.type === 'ok' ? 'profile-ok' : 'profile-error'}>{avatarMsg.text}</p>
          )}
          <div className="profile-cropper-actions">
            <button
              type="submit"
              className="profile-btn"
              disabled={avatarBusy || !croppedFile}
            >
              {avatarBusy ? 'Uploading…' : 'Upload photo'}
            </button>
            {profile.avatar && (
              <button
                type="button"
                className="profile-btn danger"
                disabled={avatarBusy}
                onClick={removeAvatar}
              >
                Remove photo
              </button>
            )}
          </div>
        </form>
      </section>

      {showInitial && (
        <section className="profile-card">
          <h3>Initial color</h3>
          <p className="profile-hint">Shown when you don’t have a profile photo.</p>
          <div className="profile-color-row">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                className={`profile-swatch${avatarColor.toUpperCase() === c.toUpperCase() ? ' active' : ''}`}
                style={{ background: c }}
                aria-label={`Color ${c}`}
                disabled={colorBusy}
                onClick={() => saveColor(c)}
              />
            ))}
            <label className="profile-color-custom">
              Custom
              <input
                type="color"
                value={avatarColor}
                disabled={colorBusy}
                onChange={(e) => saveColor(e.target.value)}
              />
            </label>
          </div>
          {colorMsg && (
            <p className={colorMsg.type === 'ok' ? 'profile-ok' : 'profile-error'}>{colorMsg.text}</p>
          )}
        </section>
      )}

      <section className="profile-card">
        <h3>Change password</h3>
        <form className="profile-form" onSubmit={submitPassword}>
          <label>
            Current password
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              disabled={pwBusy}
            />
          </label>
          <label>
            New password
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              disabled={pwBusy}
            />
          </label>
          <label>
            Confirm new password
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              disabled={pwBusy}
            />
          </label>
          {pwMsg && (
            <p className={pwMsg.type === 'ok' ? 'profile-ok' : 'profile-error'}>{pwMsg.text}</p>
          )}
          <button type="submit" className="profile-btn" disabled={pwBusy}>
            {pwBusy ? 'Saving…' : 'Update password'}
          </button>
        </form>
      </section>
    </div>
  );
};
