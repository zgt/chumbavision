import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UTApi } from "uploadthing/server";

// Log UploadThing token (first 10 chars only)
const token = process.env.UPLOADTHING_TOKEN;
console.log('UploadThing server token (first 10 chars):', token ? `${token.substring(0, 10)}...` : 'Not found');
console.log('UploadThing server token length:', token ? token.length : 0);



export const utapi = new UTApi({
  fetch: globalThis.fetch,
  token: 'eyJhcGlLZXkiOiJza19saXZlXzk5OTEzYmVlNTAwNTAwNGQyNzBjNTQwOGFhM2YzMzkxNWZkNzM2MGZmOTYxYTI0NzZiOGNjZDIzMTNjZWM0NzciLCJhcHBJZCI6InhtM3lqZGsxdzEiLCJyZWdpb25zIjpbInNlYTEiXX0=',
});

const f = createUploadthing();

export const ourFileRouter = {
  videoUploader: f({ video: { maxFileSize: "512MB" } })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Upload complete for userId:", metadata);
      console.log("File URL:", file.url);
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
