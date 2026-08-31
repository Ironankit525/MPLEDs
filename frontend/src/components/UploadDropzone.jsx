import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'

// Mirrors app/config.py's Settings.ALLOWED_EXTENSIONS / MAX_UPLOAD_SIZE_BYTES.
// Client-side validation here is just a fast, friendly first check — the
// backend re-validates on submit regardless, so if that config ever
// changes, worst case this just lets a rejected file reach the server
// once before the user sees the real error.
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']
const MAX_SIZE_BYTES = 4 * 1024 * 1024

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function validateFile(file) {
  const ext = `.${file.name.split('.').pop().toLowerCase()}`
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return `"${file.name}" isn't a supported file type. Use ${ALLOWED_EXTENSIONS.join(', ')}.`
  }
  if (file.size > MAX_SIZE_BYTES) {
    return `"${file.name}" is ${formatBytes(file.size)}, which is over the ${formatBytes(MAX_SIZE_BYTES)} limit.`
  }
  return null
}

export default function UploadDropzone({ file, onChange, error }) {
  const [isDragging, setIsDragging] = useState(false)
  const [localError, setLocalError] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const inputRef = useRef(null)
  const cameraInputRef = useRef(null)

  // The object URL is an external resource keyed on the `file` prop's
  // identity — created when a file is selected, revoked when it
  // changes or the component unmounts. That's what an effect is for
  // here (synchronizing with the browser's URL registry); the value
  // itself lives in state so render reads it normally, not off a ref.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      return undefined
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const handleFiles = useCallback(
    (fileList) => {
      const picked = fileList?.[0]
      if (!picked) return
      const validationError = validateFile(picked)
      if (validationError) {
        setLocalError(validationError)
        return
      }
      setLocalError(null)
      onChange(picked)
    },
    [onChange],
  )

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault()
      setIsDragging(false)
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles],
  )

  const handleRemove = () => {
    setLocalError(null)
    onChange(null)
    // Both inputs, not just the browse one: a file input won't fire
    // change when the same file is picked again, so leaving the camera
    // input populated would make "remove, then retake" appear to do
    // nothing if the device hands back an identically-named capture.
    if (inputRef.current) inputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
  }

  const shownError = error || localError

  if (file) {
    return (
      <div className="stack" style={{ gap: 8 }}>
        <div className="dropzone-preview">
          {previewUrl && <img src={previewUrl} alt="Selected upload preview" />}
          <div className="file-meta stack" style={{ gap: 2, flex: 1 }}>
            <span className="file-name">{file.name}</span>
            <span className="file-size">{formatBytes(file.size)}</span>
          </div>
          <button type="button" className="btn btn-ghost" onClick={handleRemove}>
            <Icon name="close" size={16} />
            Remove
          </button>
        </div>
        {shownError && <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{shownError}</p>}
      </div>
    )
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div
        className={`dropzone${isDragging ? ' is-dragging' : ''}`}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        aria-label="Upload a work-completion photo"
      >
        <Icon name="upload" size={32} strokeWidth={1.6} />
        <h3>Drag and drop your photo here</h3>
        <p className="hint">or click to browse — JPG, PNG, or WEBP, up to 4 MB</p>
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_EXTENSIONS.join(',')}
          onChange={(e) => handleFiles(e.target.files)}
          className="visually-hidden"
        />

        {/* Separate input carrying capture="environment", which asks a
            mobile browser to open the rear camera directly. It is a
            SEPARATE element rather than an attribute toggled on the one
            above because a file input's `capture` is read when the
            picker opens — sharing one input would mean the last button
            pressed silently decided the behaviour of the other.

            Why the native camera rather than an in-page getUserMedia
            preview: a canvas-encoded capture carries NO EXIF at all, so
            every honest in-app photo would arrive stripped of the
            camera model, timestamp and GPS the detection layers rely on
            — and would trip EXIF_STRIPPED. The native camera app
            returns a real camera JPEG with its metadata intact.

            On desktop this falls back to an ordinary file picker, which
            is why the button is labelled by what it does rather than
            promising a camera that isn't there. */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => handleFiles(e.target.files)}
          className="visually-hidden"
        />
      </div>

      <div className="cluster" style={{ gap: 12, justifyContent: 'center' }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => cameraInputRef.current?.click()}
        >
          <Icon name="camera" size={16} />
          Take a photo
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => inputRef.current?.click()}>
          <Icon name="image" size={16} />
          Choose from device
        </button>
      </div>
      <p className="hint" style={{ textAlign: 'center' }}>
        A photo taken now keeps its camera metadata and location, which strengthens the fraud check.
      </p>

      {shownError && <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{shownError}</p>}
    </div>
  )
}
