export type StoredObject = {
  key: string;
  url: string;
};

export type StoredFile = {
  folder: string;
  filename: string;
  contentType: string;
  body: Buffer;
};

export interface ObjectStorage {
  put(file: StoredFile): Promise<StoredObject>;
}

export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');
