import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { Project, MediaFile } from '@/types';

interface ClipFlowDB extends DBSchema {
  projects: {
    key: string;
    value: Project;
    indexes: { 'by-updated': Date };
  };
  media: {
    key: string;
    value: {
      id: string;
      projectId: string;
      file: Blob;
      metadata: Omit<MediaFile, 'path'>;
    };
    indexes: { 'by-project': string };
  };
  settings: {
    key: string;
    value: unknown;
  };
}

let db: IDBPDatabase<ClipFlowDB> | null = null;

export async function initDB(): Promise<IDBPDatabase<ClipFlowDB>> {
  if (db) return db;

  db = await openDB<ClipFlowDB>('clipflow-studio', 1, {
    upgrade(database) {
      // Projects store
      const projectStore = database.createObjectStore('projects', {
        keyPath: 'id',
      });
      projectStore.createIndex('by-updated', 'updatedAt');

      // Media store (for storing actual file blobs)
      const mediaStore = database.createObjectStore('media', {
        keyPath: 'id',
      });
      mediaStore.createIndex('by-project', 'projectId');

      // Settings store
      database.createObjectStore('settings');
    },
  });

  return db;
}

export async function saveProject(project: Project): Promise<void> {
  const database = await initDB();
  await database.put('projects', project);
}

export async function loadProject(id: string): Promise<Project | undefined> {
  const database = await initDB();
  return database.get('projects', id);
}

export async function getAllProjects(): Promise<Project[]> {
  const database = await initDB();
  return database.getAllFromIndex('projects', 'by-updated');
}

export async function deleteProject(id: string): Promise<void> {
  const database = await initDB();
  await database.delete('projects', id);

  // Also delete associated media
  const tx = database.transaction('media', 'readwrite');
  const index = tx.store.index('by-project');
  let cursor = await index.openCursor(id);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
}

export async function saveMediaFile(
  projectId: string,
  mediaId: string,
  file: Blob,
  metadata: Omit<MediaFile, 'path'>
): Promise<void> {
  const database = await initDB();
  await database.put('media', {
    id: mediaId,
    projectId,
    file,
    metadata,
  });
}

export async function loadMediaFile(
  mediaId: string
): Promise<{ file: Blob; metadata: Omit<MediaFile, 'path'> } | undefined> {
  const database = await initDB();
  const record = await database.get('media', mediaId);
  if (!record) return undefined;
  return { file: record.file, metadata: record.metadata };
}

export async function deleteMediaFile(mediaId: string): Promise<void> {
  const database = await initDB();
  await database.delete('media', mediaId);
}

export async function saveSetting(key: string, value: unknown): Promise<void> {
  const database = await initDB();
  await database.put('settings', value, key);
}

export async function loadSetting<T>(key: string): Promise<T | undefined> {
  const database = await initDB();
  return database.get('settings', key) as Promise<T | undefined>;
}

export async function exportProjectAsFile(project: Project): Promise<Blob> {
  const database = await initDB();
  const mediaRecords = await database.getAllFromIndex('media', 'by-project', project.id);

  const exportData = {
    version: '1.0.0',
    project,
    media: mediaRecords.map((m) => ({
      id: m.id,
      metadata: m.metadata,
      // Convert blob to base64 for export
      data: null as string | null,
    })),
  };

  // Convert media blobs to base64
  for (let i = 0; i < mediaRecords.length; i++) {
    const blob = mediaRecords[i].file;
    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve) => {
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
    exportData.media[i].data = base64;
  }

  return new Blob([JSON.stringify(exportData)], {
    type: 'application/json',
  });
}

export async function importProjectFromFile(file: File): Promise<Project> {
  const text = await file.text();
  const importData = JSON.parse(text);

  const database = await initDB();

  // Save project
  await database.put('projects', importData.project);

  // Restore media files
  for (const mediaRecord of importData.media) {
    if (mediaRecord.data) {
      const response = await fetch(mediaRecord.data);
      const blob = await response.blob();
      await database.put('media', {
        id: mediaRecord.id,
        projectId: importData.project.id,
        file: blob,
        metadata: mediaRecord.metadata,
      });
    }
  }

  return importData.project;
}

export async function getStorageUsage(): Promise<{
  projects: number;
  media: number;
  total: number;
}> {
  const database = await initDB();
  const projects = await database.count('projects');
  const media = await database.count('media');

  // Estimate storage size
  let totalSize = 0;
  const mediaRecords = await database.getAll('media');
  for (const record of mediaRecords) {
    totalSize += record.file.size;
  }

  return {
    projects,
    media,
    total: totalSize,
  };
}
