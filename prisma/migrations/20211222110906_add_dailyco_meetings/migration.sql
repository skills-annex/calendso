-- CreateTable
CREATE TABLE "DailyMeetings" (
    "meetingId" TEXT NOT NULL,
    "roomName" TEXT NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER NOT NULL,
    "ongoing" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyMeetings_pkey" PRIMARY KEY ("meetingId")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyMeetings_meetingId_key" ON "DailyMeetings"("meetingId");
