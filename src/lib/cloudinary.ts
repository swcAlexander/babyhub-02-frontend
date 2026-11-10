import 'server-only';
import { v2 as cloudinary } from 'cloudinary';

type CloudinaryEnvironment = NodeJS.ProcessEnv;

type RequestOptions = {
  cloud_name: string;
  api_key: string;
  api_secret: string;
  secure: true;
  resource_type: 'image';
  type: 'upload';
};

export interface ImageUploadOptions {
  folder?: string;
  public_id?: string;
}

export interface CloudinaryImage {
  public_id: string;
  secure_url: string;
  /** Compatibility with the existing Item controller; always HTTPS. */
  url: string;
  width: number;
  height: number;
  bytes: number;
  format: string;
}

export interface CloudinarySdk {
  uploader: {
    upload(source: string, options: RequestOptions & ImageUploadOptions & { overwrite: false }): Promise<unknown>;
    destroy(publicId: string, options: RequestOptions & { invalidate: true }): Promise<unknown>;
  };
  api: {
    resource(publicId: string, options: RequestOptions): Promise<unknown>;
  };
}

type ErrorCode = 'CLOUDINARY_NOT_CONFIGURED' | 'CLOUDINARY_INVALID_INPUT'
  | 'CLOUDINARY_REQUEST_FAILED' | 'CLOUDINARY_INVALID_RESPONSE';

export class CloudinaryServiceError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(code: ErrorCode, message: string, status = 500) {
    super(message);
    this.name = 'CloudinaryServiceError';
    this.code = code;
    this.status = status;
  }
}

const requiredString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new CloudinaryServiceError('CLOUDINARY_INVALID_INPUT', `A non-empty ${field} is required.`, 400);
  }
  return value.trim();
};

const readConfiguration = (env: CloudinaryEnvironment) => {
  const cloudName = env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = env.CLOUDINARY_API_KEY?.trim() || env.CLOUDINARY_APY_KEY?.trim();
  const apiSecret = env.CLOUDINARY_API_SECRET?.trim();
  const missing = [
    !cloudName && 'CLOUDINARY_CLOUD_NAME',
    !apiKey && 'CLOUDINARY_API_KEY (or CLOUDINARY_APY_KEY)',
    !apiSecret && 'CLOUDINARY_API_SECRET',
  ].filter(Boolean);
  if (missing.length) {
    throw new CloudinaryServiceError('CLOUDINARY_NOT_CONFIGURED', `Missing Cloudinary configuration: ${missing.join(', ')}.`);
  }
  return {
    options: {
      cloud_name: cloudName!, api_key: apiKey!, api_secret: apiSecret!,
      secure: true, resource_type: 'image', type: 'upload',
    } satisfies RequestOptions,
    apiKeyVariable: env.CLOUDINARY_API_KEY?.trim() ? 'CLOUDINARY_API_KEY' : 'CLOUDINARY_APY_KEY',
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const imageFromResponse = (response: unknown): CloudinaryImage => {
  const invalid = () => new CloudinaryServiceError('CLOUDINARY_INVALID_RESPONSE', 'Cloudinary returned invalid image metadata.', 502);
  if (!isRecord(response) || response.resource_type !== 'image'
    || typeof response.public_id !== 'string' || !response.public_id.trim()
    || typeof response.secure_url !== 'string'
    || typeof response.format !== 'string' || !response.format.trim()) throw invalid();
  try {
    const url = new URL(response.secure_url);
    if (url.protocol !== 'https:' || url.username || url.password) throw invalid();
  } catch { throw invalid(); }
  for (const field of ['width', 'height', 'bytes']) {
    const value = response[field];
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < (field === 'bytes' ? 0 : 1)) throw invalid();
  }
  return {
    public_id: response.public_id,
    secure_url: response.secure_url,
    url: response.secure_url,
    width: response.width as number,
    height: response.height as number,
    bytes: response.bytes as number,
    format: response.format,
  };
};

const request = async <T>(operation: string, action: () => Promise<T>): Promise<T> => {
  try {
    return await action();
  } catch (error) {
    if (error instanceof CloudinaryServiceError) throw error;
    // Admin API rejects { error: { http_code } }; Upload API may use { http_code }.
    // Reject malformed or conflicting codes rather than misclassifying them as 404.
    const codes = isRecord(error)
      ? [error.http_code, isRecord(error.error) ? error.error.http_code : undefined]
        .filter(value => value !== undefined)
      : [];
    const isHttpErrorCode = (value: unknown): value is number => typeof value === 'number'
      && Number.isInteger(value) && value >= 400 && value <= 599;
    const status = codes.length > 0 && codes.every(isHttpErrorCode)
      && codes.every(value => value === codes[0]) ? codes[0] : 502;
    // Never retain the SDK error/cause: it may contain credentials, a signed URL or the input path.
    throw new CloudinaryServiceError('CLOUDINARY_REQUEST_FAILED', `Cloudinary ${operation} failed.`, status);
  }
};

const defaultSdk: CloudinarySdk = {
  uploader: {
    upload: (source, options) => cloudinary.uploader.upload(source, options),
    destroy: (publicId, options) => cloudinary.uploader.destroy(publicId, options),
  },
  api: { resource: (publicId, options) => cloudinary.api.resource(publicId, options) },
};

/** Server-side factory; injecting an SDK lets tests run without network calls. */
export const createCloudinaryService = ({ env = process.env, sdk = defaultSdk }: {
  env?: CloudinaryEnvironment;
  sdk?: CloudinarySdk;
} = {}) => ({
  checkConfiguration() {
    const { apiKeyVariable } = readConfiguration(env);
    return { configured: true as const, apiKeyVariable };
  },

  async uploadImage(source: string, options: ImageUploadOptions = {}): Promise<CloudinaryImage> {
    const file = requiredString(source, 'image source');
    const folder = options.folder === undefined ? undefined : requiredString(options.folder, 'folder');
    const publicId = options.public_id === undefined ? undefined : requiredString(options.public_id, 'public_id');
    const { options: credentials } = readConfiguration(env);
    return request('upload', async () => imageFromResponse(await sdk.uploader.upload(file, {
      ...credentials,
      ...(folder ? { folder } : {}),
      ...(publicId ? { public_id: publicId } : {}),
      overwrite: false,
    })));
  },

  async getImageInfo(publicId: string): Promise<CloudinaryImage> {
    const id = requiredString(publicId, 'public_id');
    const { options } = readConfiguration(env);
    return request('resource lookup', async () => imageFromResponse(await sdk.api.resource(id, options)));
  },

  async deleteImage(publicId: string): Promise<{ result: 'ok' | 'not found' }> {
    const id = requiredString(publicId, 'public_id');
    const { options } = readConfiguration(env);
    return request('deletion', async () => {
      const response = await sdk.uploader.destroy(id, { ...options, invalidate: true });
      if (!isRecord(response) || (response.result !== 'ok' && response.result !== 'not found')) {
        throw new CloudinaryServiceError('CLOUDINARY_INVALID_RESPONSE', 'Cloudinary returned an invalid deletion result.', 502);
      }
      return { result: response.result };
    });
  },
});

const service = createCloudinaryService();
export const { checkConfiguration, uploadImage, getImageInfo, deleteImage } = service;
