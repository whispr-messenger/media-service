export const storageConfig = () => ({
  gcs: {
    projectId: process.env.GCS_PROJECT_ID || 'whispr-project',
    bucketName: process.env.GCS_BUCKET_NAME || 'whispr-media-dev',
    keyFilename: process.env.GCS_KEY_FILE || './gcs-key.json',
    region: process.env.GCS_REGION || 'europe-west1',
  },
  local: {
    uploadPath: process.env.UPLOAD_PATH || './uploads',
    tempPath: process.env.TEMP_PATH || './temp',
  },
  limits: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 104857600, // 100MB
    maxImageSize: parseInt(process.env.MAX_IMAGE_SIZE, 10) || 26214400, // 25MB
    maxVideoSize: parseInt(process.env.MAX_VIDEO_SIZE, 10) || 104857600, // 100MB
    maxAudioSize: parseInt(process.env.MAX_AUDIO_SIZE, 10) || 52428800, // 50MB
    maxDocumentSize: parseInt(process.env.MAX_DOCUMENT_SIZE, 10) || 26214400, // 25MB
  },
});

export type StorageConfig = ReturnType<typeof storageConfig>;
