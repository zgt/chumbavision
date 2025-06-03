import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UTApi } from "uploadthing/server";

// Log UploadThing token (first 10 chars only)
const token = import.meta.env.UPLOADTHING_TOKEN;
// Initialize UploadThing with server token

export const utapi = new UTApi({
  fetch: globalThis.fetch,
  //token: 'eyJhcGlLZXkiOiJza19saXZlXzk5OTEzYmVlNTAwNTAwNGQyNzBjNTQwOGFhM2YzMzkxNWZkNzM2MGZmOTYxYTI0NzZiOGNjZDIzMTNjZWM0NzciLCJhcHBJZCI6InhtM3lqZGsxdzEiLCJyZWdpb25zIjpbInNlYTEiXX0=',
  token: token,
});

const f = createUploadthing();

export const ourFileRouter = {
  videoUploader: f({ video: { maxFileSize: "512MB" } }).onUploadComplete(
    async ({ metadata, file }) => {
      // Upload complete callback
    },
  ),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
