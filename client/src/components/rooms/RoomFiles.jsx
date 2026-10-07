import {
  DownloadSimple,
  File as FileIcon,
  FileCsv,
  FileDoc,
  FileImage,
  FilePdf,
  FilePpt,
  FileTxt,
  FileXls,
  FileZip,
  Paperclip,
  Trash,
  UploadSimple,
} from '@phosphor-icons/react';
import clsx from 'clsx';
import { useRef, useState } from 'react';
import { ACCEPTED_FILES, MAX_FILE_MB, useDeleteRoomFile, useRoomFiles, useUploadRoomFile } from '../../hooks/useRoomFiles.js';
import { filesApi } from '../../services/api.js';
import { confirm } from '../../store/confirmStore.js';
import { formatAgo } from '../../utils/dates.js';
import { formatBytes } from '../../utils/format.js';
import { Button, IconButton } from '../ui/Button.jsx';
import { EmptyState, ErrorState, SkeletonList } from '../ui/Feedback.jsx';
import styles from './Rooms.module.css';

function iconFor(mime) {
  if (mime === 'application/pdf') return FilePdf;
  if (mime.startsWith('image/')) return FileImage;
  if (mime.includes('word') || mime.includes('opendocument.text')) return FileDoc;
  if (mime.includes('sheet') || mime.includes('excel')) return FileXls;
  if (mime.includes('presentation') || mime.includes('powerpoint')) return FilePpt;
  if (mime.includes('zip')) return FileZip;
  if (mime === 'text/csv') return FileCsv;
  if (mime.startsWith('text/')) return FileTxt;
  return FileIcon;
}

export function RoomFiles({ roomId, currentUserId, isAdmin }) {
  const files = useRoomFiles(roomId);
  const upload = useUploadRoomFile(roomId);
  const remove = useDeleteRoomFile(roomId);
  const input = useRef(null);
  const [dragging, setDragging] = useState(false);

  const send = (fileList) => {
    const file = fileList?.[0];
    if (file) upload.mutate(file);
  };

  const handleDelete = async (file) => {
    const ok = await confirm({ title: '¿Eliminar este archivo?', description: `«${file.originalName}» dejará de estar disponible para la sala.`, confirmLabel: 'Eliminar', tone: 'danger' });
    if (ok) remove.mutate(file._id);
  };

  return (
    <div className={styles.panelBody}>
      <div
        className={clsx(styles.dropzone, dragging && styles.dropzoneActive)}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          send(event.dataTransfer.files);
        }}
      >
        <input
          ref={input}
          type="file"
          accept={ACCEPTED_FILES}
          className="visually-hidden"
          onChange={(event) => {
            send(event.target.files);
            event.target.value = '';
          }}
          tabIndex={-1}
        />
        <Button icon={UploadSimple} onClick={() => input.current?.click()} loading={upload.isPending}>
          Subir archivo
        </Button>
        <p className={styles.dropHint}>
          O arrástralo aquí. Hasta {MAX_FILE_MB} MB: PDF, imágenes, documentos de Office u OpenDocument, texto, CSV o ZIP.
        </p>
        {upload.progress != null ? (
          <div className={styles.progress} role="progressbar" aria-valuenow={upload.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Subiendo archivo">
            <span style={{ width: `${upload.progress}%` }} />
          </div>
        ) : null}
      </div>

      {files.isPending ? (
        <SkeletonList rows={3} label="Cargando archivos" />
      ) : files.isError ? (
        <ErrorState error={files.error} onRetry={files.refetch} compact />
      ) : files.data.length === 0 ? (
        <EmptyState icon={Paperclip} title="Sin archivos todavía" compact>
          Comparte apuntes, enunciados o presentaciones con la sala.
        </EmptyState>
      ) : (
        <ul className={styles.fileList}>
          {files.data.map((file) => {
            const Icon = iconFor(file.mimeType);
            const canDelete = isAdmin || file.uploadedBy?._id === currentUserId;
            return (
              <li key={file._id} className={styles.fileRow}>
                <Icon size={28} weight="duotone" className={styles.fileIcon} aria-hidden />
                <div className={styles.fileMain}>
                  <a href={filesApi.downloadUrl(roomId, file._id)} className={styles.fileName} download>
                    {file.originalName}
                  </a>
                  <span className={styles.fileMeta}>
                    {formatBytes(file.size)}, subido por {file.uploadedBy?._id === currentUserId ? 'ti' : file.uploadedBy?.name ?? 'antiguo participante'}{' '}
                    {formatAgo(file.createdAt)}
                  </span>
                </div>
                <a href={filesApi.downloadUrl(roomId, file._id)} download className={styles.fileAction} aria-label={`Descargar ${file.originalName}`}>
                  <DownloadSimple size={20} aria-hidden />
                </a>
                {canDelete ? <IconButton icon={Trash} label={`Eliminar ${file.originalName}`} size="sm" onClick={() => handleDelete(file)} /> : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
