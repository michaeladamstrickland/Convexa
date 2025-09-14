-- AlterTable
ALTER TABLE "call_transcripts" ADD COLUMN     "dtmfCaptured" TEXT,
ADD COLUMN     "recordingUrl" TEXT,
ADD COLUMN     "transcriptUrl" TEXT;
