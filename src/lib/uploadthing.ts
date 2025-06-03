import { createUploadthing, type FileRouter } from "uploadthing/next";

const f = createUploadthing();

export const ourFileRouter = {
  videoUploader: f({ video: { maxFileSize: "512MB" } })
    .onUploadComplete(async ({ metadata, file }) => {
      // Upload complete callback
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter; 