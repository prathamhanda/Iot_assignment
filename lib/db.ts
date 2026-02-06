import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

// Type narrowing (required for TS + runtime safety)
if (typeof MONGODB_URI !== "string" || MONGODB_URI.trim().length === 0) {
  throw new Error("Missing MONGODB_URI in environment (.env.local)");
}

const uri: string = MONGODB_URI;

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  // eslint-disable-next-line no-var
  var _mongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache = globalThis._mongooseCache ?? {
  conn: null,
  promise: null,
};

globalThis._mongooseCache = cache;

export async function connectToDb() {
  if (cache.conn) return cache.conn;
  if (!cache.promise) {
    cache.promise = mongoose
      .connect(uri, {
        bufferCommands: false,
      })
      .then((m) => m);
  }

  cache.conn = await cache.promise;
  return cache.conn;
}

