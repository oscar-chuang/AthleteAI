import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  CopyObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PassThrough, Readable } from "stream";
import { randomUUID } from "crypto";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

function buildS3Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY must all be set"
    );
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function getBucketName(): string {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error("R2_BUCKET_NAME must be set");
  return bucket;
}

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class S3File {
  constructor(
    public readonly bucket: string,
    public readonly name: string,
    private readonly s3: S3Client
  ) {}

  async exists(): Promise<[boolean]> {
    try {
      await this.s3.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: this.name })
      );
      return [true];
    } catch {
      return [false];
    }
  }

  async getMetadata(): Promise<
    [{ contentType?: string; size?: number; metadata?: Record<string, string> }]
  > {
    const resp = await this.s3.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: this.name })
    );
    return [
      {
        contentType: resp.ContentType,
        size: resp.ContentLength,
        metadata: resp.Metadata,
      },
    ];
  }

  createReadStream(): Readable {
    const pass = new PassThrough();
    this.s3
      .send(new GetObjectCommand({ Bucket: this.bucket, Key: this.name }))
      .then((resp) => {
        if (resp.Body == null) {
          pass.destroy(new Error("Empty response body from storage"));
          return;
        }
        (resp.Body as Readable).pipe(pass);
      })
      .catch((err) => pass.destroy(err));
    return pass;
  }

  async setMetadata(updates: {
    metadata: Record<string, string>;
  }): Promise<void> {
    const head = await this.s3.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: this.name })
    );
    await this.s3.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        Key: this.name,
        CopySource: `${this.bucket}/${encodeURIComponent(this.name)}`,
        MetadataDirective: "REPLACE",
        ContentType: head.ContentType,
        Metadata: { ...(head.Metadata ?? {}), ...updates.metadata },
      })
    );
  }
}

export class ObjectStorageService {
  constructor() {}

  async searchPublicObject(filePath: string): Promise<S3File | null> {
    const s3 = buildS3Client();
    const bucket = getBucketName();
    const key = `public/${filePath.replace(/^\/+/, "")}`;
    try {
      await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      return new S3File(bucket, key, s3);
    } catch {
      return null;
    }
  }

  async getObjectEntityUploadURL(userId?: string): Promise<{
    uploadURL: string;
    objectPath: string;
  }> {
    const s3 = buildS3Client();
    const bucket = getBucketName();
    const uuid = randomUUID();
    const key = userId
      ? `uploads/${userId}/${uuid}`
      : `uploads/anon/${uuid}`;
    const objectPath = `/objects/${key}`;

    const uploadURL = await getSignedUrl(
      s3,
      new PutObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: 900 }
    );

    return { uploadURL, objectPath };
  }

  async getObjectEntityFile(objectPath: string): Promise<S3File> {
    const normalized = objectPath.replace(/^\/+/, "");
    if (!normalized.startsWith("objects/")) {
      throw new ObjectNotFoundError();
    }

    const key = normalized.slice("objects/".length);
    const s3 = buildS3Client();
    const bucket = getBucketName();

    try {
      await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    } catch {
      throw new ObjectNotFoundError();
    }

    return new S3File(bucket, key, s3);
  }

  normalizeObjectEntityPath(rawPath: string): string {
    return rawPath;
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) {
      return normalizedPath;
    }
    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectFile, aclPolicy);
    return normalizedPath;
  }

  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: S3File;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }
}
