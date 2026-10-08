import { API_URL, http, request } from "../http.js";

export const list = (roomId) =>
  request.get(`/rooms/${roomId}/files`).then((data) => data.items);
export const remove = (roomId, fileId) =>
  request.delete(`/rooms/${roomId}/files/${fileId}`);
export const downloadUrl = (roomId, fileId) =>
  `${API_URL}/rooms/${roomId}/files/${fileId}/download`;

export function upload(roomId, file, onProgress) {
  const form = new FormData();
  form.append("file", file);
  return http
    .post(`/rooms/${roomId}/files`, form, {
      timeout: 0,
      onUploadProgress: (event) => {
        if (event.total)
          onProgress?.(Math.round((event.loaded / event.total) * 100));
      },
    })
    .then((response) => response.data.file);
}
